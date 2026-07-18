/**
 * Multi-format paystub text extraction.
 * Supports: JPG/PNG/WEBP images, HEIC/HEIF photos, text-based PDFs,
 * scanned PDFs (image-based), and DOCX/DOC Word documents.
 *
 * Key improvements over v1:
 *  - Bradley adaptive local thresholding (replaces global contrast stretch)
 *    handles non-uniform lighting from phone photos
 *  - Projection-profile deskew: detects and corrects up to ±10° rotation
 *  - Layout reconstruction from Tesseract word bounding boxes:
 *    groups words by visual row (y-axis), sorts left→right within each row,
 *    so label + amount pairs are on the same reconstructed text line even in
 *    multi-column layouts where raw text order is garbled
 */

export type FileKind =
  | 'image'      // JPG, PNG, WEBP
  | 'heic'       // HEIC/HEIF (iPhone photos)
  | 'pdf'        // any PDF — text or scanned
  | 'docx'       // DOCX/DOC Word document
  | 'unsupported'

export interface ExtractionResult {
  text: string
  method: string
  warnings: string[]
}

const SIZE_LIMIT = 20 * 1024 * 1024 // 20 MB

// ── Format detection ──────────────────────────────────────────────────────────

export async function detectKind(file: File): Promise<FileKind> {
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer())

  if (header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46)
    return 'pdf'
  if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47)
    return 'image'
  if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff)
    return 'image'
  if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 &&
      header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50)
    return 'image'
  if (header[0] === 0x50 && header[1] === 0x4b && header[2] === 0x03 && header[3] === 0x04) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (['docx', 'doc'].includes(ext) || file.type.includes('word') || file.type.includes('officedocument'))
      return 'docx'
  }
  if (header[0] === 0xd0 && header[1] === 0xcf && header[2] === 0x11 && header[3] === 0xe0)
    return 'docx'
  const ftyp = String.fromCharCode(header[4], header[5], header[6], header[7])
  if (ftyp === 'ftyp') {
    const brand = String.fromCharCode(...Array.from(header.slice(8, 12)))
    if (/^(heic|heix|hevc|mif1|msf1|hevm|hevs)/i.test(brand)) return 'heic'
  }
  const mime = file.type.toLowerCase()
  if (mime.startsWith('image/heic') || mime.startsWith('image/heif')) return 'heic'
  if (mime.startsWith('image/')) return 'image'
  if (mime === 'application/pdf') return 'pdf'
  if (mime.includes('word') || mime.includes('officedocument.wordprocessingml')) return 'docx'
  return 'unsupported'
}

export function validateFile(file: File, kind: FileKind): string | null {
  if (kind === 'unsupported')
    return `"${file.name}" is not a supported format. Please upload a photo (JPG, PNG, WEBP, HEIC), PDF, or Word document.`
  if (file.size > SIZE_LIMIT)
    return `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB — please use a file under 20 MB.`
  return null
}

export interface ProgressCallback {
  (status: string, pct: number): void
}

export async function extractText(
  files: File[],
  onProgress: ProgressCallback
): Promise<ExtractionResult> {
  if (!files.length) throw new Error('No files provided.')

  const warnings: string[] = []
  const parts: string[] = []
  const methods: string[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const kind = await detectKind(file)
    const label = `file ${i + 1}/${files.length}`
    onProgress(`Detecting format of ${label}…`, 0)

    const err = validateFile(file, kind)
    if (err) throw new Error(err)

    let text = ''
    let method = ''

    if (kind === 'image') {
      onProgress(`Preprocessing image ${label}…`, 5)
      text = await ocrImage(file, (s, p) => onProgress(s, p))
      method = 'image OCR'
    } else if (kind === 'heic') {
      onProgress(`Converting HEIC photo ${label}…`, 5)
      const jpeg = await convertHeic(file)
      onProgress(`Preprocessing converted ${label}…`, 15)
      text = await ocrImage(jpeg, (s, p) => onProgress(s, p))
      method = 'HEIC → JPEG → OCR'
    } else if (kind === 'pdf') {
      onProgress(`Extracting text from PDF ${label}…`, 5)
      const result = await extractPdf(file, (s, p) => onProgress(s, p))
      text = result.text
      method = result.method
      if (result.warnings.length) warnings.push(...result.warnings)
    } else if (kind === 'docx') {
      onProgress(`Extracting text from document ${label}…`, 5)
      text = await extractDocx(file)
      method = 'DOCX text extraction'
    }

    parts.push(text)
    methods.push(method)
  }

  const combined = parts.join('\n---PAGE BREAK---\n')
  const wordCount = combined.trim().split(/\s+/).filter(Boolean).length
  if (wordCount < 20) {
    warnings.push('Very little text was extracted — the file may be a poor-quality scan or an unsupported layout. Please fill in any missing fields manually.')
  }

  return {
    text: combined,
    method: [...new Set(methods)].join(', '),
    warnings,
  }
}

// ── Adaptive binarization: Bradley's local threshold ─────────────────────────
//
// For each pixel, compare it against the mean of a local S×S window.
// If pixel < localMean * (1 - T), it's foreground (black text).
// Much better than global contrast stretch for photos with uneven lighting.
//
function bradleyBinarize(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  S = 1 / 16,   // window size as fraction of shorter dimension
  T = 18,        // threshold offset %
): void {
  const half = Math.max(4, Math.floor(Math.min(w, h) * S / 2))

  // Build integral image over grayscale values (R channel = grayscale at this point)
  const integral = new Float64Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = data[(y * w + x) * 4]
      integral[y * w + x] = v
        + (x > 0 ? integral[y * w + x - 1] : 0)
        + (y > 0 ? integral[(y - 1) * w + x] : 0)
        - (x > 0 && y > 0 ? integral[(y - 1) * w + x - 1] : 0)
    }
  }

  // Binarize using local window mean
  for (let y = 0; y < h; y++) {
    const y1 = Math.max(0, y - half), y2 = Math.min(h - 1, y + half)
    for (let x = 0; x < w; x++) {
      const x1 = Math.max(0, x - half), x2 = Math.min(w - 1, x + half)
      const count = (x2 - x1 + 1) * (y2 - y1 + 1)
      const sum = integral[y2 * w + x2]
        - (x1 > 0 ? integral[y2 * w + x1 - 1] : 0)
        - (y1 > 0 ? integral[(y1 - 1) * w + x2] : 0)
        + (x1 > 0 && y1 > 0 ? integral[(y1 - 1) * w + x1 - 1] : 0)
      const localMean = sum / count
      const pixel = data[(y * w + x) * 4]
      const v = pixel < localMean * (1 - T / 100) ? 0 : 255
      const i = (y * w + x) * 4
      data[i] = data[i + 1] = data[i + 2] = v
    }
  }
}

// ── Deskew: projection-profile method ────────────────────────────────────────
//
// Downsamples to ≤300px wide for speed, collects dark-pixel coordinates,
// tests angles from -10° to +10° in 0.5° steps, picks the angle that
// maximises the variance of the horizontal projection profile (text lines
// produce sharp peaks when the image is correctly aligned), then rotates
// the full-resolution canvas by that angle.
//
async function deskewCanvas(src: HTMLCanvasElement): Promise<HTMLCanvasElement> {
  const W = src.width, H = src.height
  const SW = Math.min(300, W)
  const SH = Math.round(H * SW / W)

  const small = document.createElement('canvas')
  small.width = SW; small.height = SH
  small.getContext('2d')!.drawImage(src, 0, 0, SW, SH)
  const sd = small.getContext('2d')!.getImageData(0, 0, SW, SH).data

  // Collect foreground pixel coordinates (dark = likely text)
  const fg: Array<[number, number]> = []
  for (let y = 0; y < SH; y++) {
    for (let x = 0; x < SW; x++) {
      if (sd[(y * SW + x) * 4] < 160) fg.push([x, y])
    }
  }

  if (fg.length < 50) return src // not enough content

  // Test angles
  let bestAngle = 0, bestVar = -1
  for (let a = -10; a <= 10; a += 0.5) {
    const rad = a * Math.PI / 180
    const cosA = Math.cos(rad), sinA = Math.sin(rad)
    const proj = new Map<number, number>()
    for (const [x, y] of fg) {
      const ry = Math.round(y * cosA - x * sinA)
      proj.set(ry, (proj.get(ry) ?? 0) + 1)
    }
    const vals = Array.from(proj.values())
    if (vals.length < 2) continue
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length
    const v = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length
    if (v > bestVar) { bestVar = v; bestAngle = a }
  }

  if (Math.abs(bestAngle) < 0.5) return src // negligible — skip rotation

  const diag = Math.ceil(Math.sqrt(W * W + H * H))
  const dst = document.createElement('canvas')
  dst.width = diag; dst.height = diag
  const dctx = dst.getContext('2d')!
  dctx.fillStyle = '#ffffff'
  dctx.fillRect(0, 0, diag, diag)
  dctx.save()
  dctx.translate(diag / 2, diag / 2)
  dctx.rotate(-bestAngle * Math.PI / 180)
  dctx.drawImage(src, -W / 2, -H / 2)
  dctx.restore()
  return dst
}

// ── Layout reconstruction from Tesseract word bounding boxes ─────────────────
//
// Raw Tesseract text output linearises columns in document-reading order,
// which for multi-column paystubs means labels appear before amounts only
// coincidentally. This function re-sorts words by their visual position:
//
//   1. Group words into rows by y-centre proximity
//      (tolerance = 45% of median word height, robust to baseline variation)
//   2. Sort each row left→right by x-position
//   3. Join into text with one visual row per line
//
// Result: "Federal Income Tax  400.00  3,200.00" on one line instead of
// label on line N and amount on line N+47 due to column reading order.
//
function reconstructLayoutText(
  words: Array<{
    text: string
    bbox: { x0: number; y0: number; x1: number; y1: number }
    confidence: number
  }>
): string {
  const valid = words.filter(w => w.confidence >= 15 && w.text.trim())
  if (!valid.length) return ''

  // Sort top-to-bottom for stable greedy row assignment
  const sorted = [...valid].sort((a, b) => {
    return (a.bbox.y0 + a.bbox.y1) / 2 - (b.bbox.y0 + b.bbox.y1) / 2
  })

  // Adaptive row tolerance: 45% of median word height
  const heights = sorted.map(w => w.bbox.y1 - w.bbox.y0).sort((a, b) => a - b)
  const medH = heights[Math.floor(heights.length / 2)] || 20
  const rowTol = Math.max(6, medH * 0.45)

  type Row = { ySum: number; n: number; words: typeof sorted }
  const rows: Row[] = []

  for (const word of sorted) {
    const yc = (word.bbox.y0 + word.bbox.y1) / 2
    let placed = false
    for (const row of rows) {
      if (Math.abs(row.ySum / row.n - yc) <= rowTol) {
        row.words.push(word)
        row.ySum += yc
        row.n++
        placed = true
        break
      }
    }
    if (!placed) rows.push({ ySum: yc, n: 1, words: [word] })
  }

  rows.sort((a, b) => a.ySum / a.n - b.ySum / b.n)

  return rows.map(row => {
    row.words.sort((a, b) => a.bbox.x0 - b.bbox.x0)
    return row.words.map(w => w.text).join(' ')
  }).join('\n')
}

// ── Image preprocessing pipeline ─────────────────────────────────────────────

async function preprocessImage(blob: Blob): Promise<Blob> {
  const img = await createImageBitmap(blob)

  // 1. Upscale if too small — Tesseract accuracy degrades below ~150 DPI
  const MIN_WIDTH = 1800
  const scale = img.width < MIN_WIDTH ? MIN_WIDTH / img.width : 1
  let w = Math.round(img.width * scale)
  let h = Math.round(img.height * scale)

  let canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  let ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)
  img.close()

  // 2. Convert to grayscale (luminance-weighted)
  let imageData = ctx.getImageData(0, 0, w, h)
  const d = imageData.data
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])
    d[i] = d[i + 1] = d[i + 2] = g
  }
  ctx.putImageData(imageData, 0, 0)

  // 3. Deskew (operates on grayscale canvas, returns possibly-larger canvas)
  canvas = await deskewCanvas(canvas)
  w = canvas.width; h = canvas.height
  ctx = canvas.getContext('2d')!

  // 4. Bradley adaptive threshold — produces clean B&W for Tesseract
  imageData = ctx.getImageData(0, 0, w, h)
  bradleyBinarize(imageData.data, w, h)
  ctx.putImageData(imageData, 0, 0)

  return new Promise<Blob>((res, rej) =>
    canvas.toBlob(b => b ? res(b) : rej(new Error('Preprocessing canvas.toBlob failed')), 'image/png')
  )
}

// ── Image OCR (Tesseract.js) ──────────────────────────────────────────────────

async function ocrImage(file: File | Blob, onProgress: ProgressCallback): Promise<string> {
  const preprocessed = await preprocessImage(file)

  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng', 1, {
    logger: (m: { status: string; progress: number }) => {
      onProgress(m.status, Math.round((m.progress || 0) * 100))
    },
  })

  const { data } = await worker.recognize(preprocessed)
  await worker.terminate()

  // Prefer layout-reconstructed text; fall back to raw if reconstruction yields nothing
  const layoutText = reconstructLayoutText(data.words ?? [])
  return layoutText.trim() ? layoutText : data.text
}

// ── HEIC conversion ───────────────────────────────────────────────────────────

async function convertHeic(file: File): Promise<Blob> {
  const heic2any = (await import('heic2any')).default
  const result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 })
  return Array.isArray(result) ? result[0] : result
}

// ── PDF extraction ────────────────────────────────────────────────────────────

async function extractPdf(
  file: File,
  onProgress: ProgressCallback
): Promise<{ text: string; method: string; warnings: string[] }> {
  const warnings: string[] = []

  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist')
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  GlobalWorkerOptions.workerSrc = workerUrl

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: arrayBuffer }).promise
  const numPages = pdf.numPages

  // Pass 1: text layer extraction (fast, accurate for digital PDFs)
  const textParts: string[] = []
  for (let p = 1; p <= numPages; p++) {
    onProgress(`Extracting text from PDF page ${p}/${numPages}…`, Math.round((p / numPages) * 50))
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .join(' ')
    textParts.push(pageText)
  }

  const extractedText = textParts.join('\n---PAGE BREAK---\n')
  const wordCount = extractedText.trim().split(/\s+/).filter(Boolean).length

  if (wordCount >= 30) {
    return { text: extractedText, method: 'PDF text layer', warnings }
  }

  // Pass 2: scanned PDF — render each page to canvas then OCR
  warnings.push('PDF appears to be a scanned image — using OCR (slower, may be less accurate).')
  const ocrParts: string[] = []
  for (let p = 1; p <= numPages; p++) {
    onProgress(`OCR-ing scanned PDF page ${p}/${numPages}…`, 50 + Math.round((p / numPages) * 40))
    const page = await pdf.getPage(p)
    const viewport = page.getViewport({ scale: 3.0 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')!
    await page.render({ canvasContext: ctx as any, canvas, viewport }).promise
    const blob = await new Promise<Blob>((res, rej) =>
      canvas.toBlob(b => b ? res(b) : rej(new Error('Canvas toBlob failed')), 'image/png')
    )
    const pageText = await ocrImage(blob, (s, pct) =>
      onProgress(`OCR page ${p}: ${s}`, 50 + Math.round((p / numPages) * 40) + Math.round(pct * 0.1))
    )
    ocrParts.push(pageText)
  }

  return {
    text: ocrParts.join('\n---PAGE BREAK---\n'),
    method: 'scanned PDF → OCR',
    warnings,
  }
}

// ── DOCX extraction (mammoth) ─────────────────────────────────────────────────

async function extractDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth')
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value
}
