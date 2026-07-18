/**
 * Multi-format paystub text extraction.
 * Supports: JPG/PNG/WEBP images, HEIC/HEIF photos, text-based PDFs,
 * scanned PDFs (image-based), and DOCX/DOC Word documents.
 * All paths return a plain string that flows into parsePaystubText().
 */

export type FileKind =
  | 'image'      // JPG, PNG, WEBP
  | 'heic'       // HEIC/HEIF (iPhone photos)
  | 'pdf'        // any PDF — text or scanned
  | 'docx'       // DOCX/DOC Word document
  | 'unsupported'

export interface ExtractionResult {
  text: string
  method: string       // human-readable label for the debug/confidence banner
  warnings: string[]
}

const SIZE_LIMIT = 20 * 1024 * 1024 // 20 MB

// ── Format detection ──────────────────────────────────────────────────────────

/** Detect file type from magic bytes + MIME type, never trust extension alone. */
export async function detectKind(file: File): Promise<FileKind> {
  // Read first 12 bytes for magic numbers
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer())

  // PDF: %PDF
  if (header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46) {
    return 'pdf'
  }
  // PNG: \x89PNG
  if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47) {
    return 'image'
  }
  // JPEG: FF D8 FF
  if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return 'image'
  }
  // WEBP: RIFF????WEBP
  if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 &&
      header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50) {
    return 'image'
  }
  // ZIP-based (DOCX): PK\x03\x04
  if (header[0] === 0x50 && header[1] === 0x4b && header[2] === 0x03 && header[3] === 0x04) {
    // Could be DOCX. Confirm via MIME or name.
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (['docx', 'doc'].includes(ext) || file.type.includes('word') || file.type.includes('officedocument')) {
      return 'docx'
    }
    // Could be other zip; fall through
  }
  // DOC: D0 CF 11 E0 (OLE compound document)
  if (header[0] === 0xd0 && header[1] === 0xcf && header[2] === 0x11 && header[3] === 0xe0) {
    return 'docx' // treat old .doc same path
  }
  // HEIC/HEIF: ftyp box at offset 4 with 'heic', 'heix', 'hevc', 'mif1', 'msf1', 'hevm', 'hevs'
  const ftyp = String.fromCharCode(header[4], header[5], header[6], header[7])
  if (ftyp === 'ftyp') {
    const brand = String.fromCharCode(...Array.from(header.slice(8, 12)))
    if (/^(heic|heix|hevc|mif1|msf1|hevm|hevs)/i.test(brand)) {
      return 'heic'
    }
  }
  // Fallback to MIME type
  const mime = file.type.toLowerCase()
  if (mime.startsWith('image/heic') || mime.startsWith('image/heif')) return 'heic'
  if (mime.startsWith('image/')) return 'image'
  if (mime === 'application/pdf') return 'pdf'
  if (mime.includes('word') || mime.includes('officedocument.wordprocessingml')) return 'docx'

  return 'unsupported'
}

// ── Validation ────────────────────────────────────────────────────────────────

export function validateFile(file: File, kind: FileKind): string | null {
  if (kind === 'unsupported') {
    return `"${file.name}" is not a supported format. Please upload a photo (JPG, PNG, WEBP, HEIC), PDF, or Word document.`
  }
  if (file.size > SIZE_LIMIT) {
    return `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB — please use a file under 20 MB.`
  }
  return null
}

// ── Extraction dispatcher ─────────────────────────────────────────────────────

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
      onProgress(`Running OCR on ${label}…`, 5)
      text = await ocrImage(file, (s, p) => onProgress(s, p))
      method = 'image OCR'
    } else if (kind === 'heic') {
      onProgress(`Converting HEIC photo for ${label}…`, 5)
      const jpeg = await convertHeic(file)
      onProgress(`Running OCR on converted ${label}…`, 20)
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

  // Graceful degradation: warn if almost nothing was extracted
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

// ── Image OCR (Tesseract.js) ──────────────────────────────────────────────────

async function ocrImage(file: File | Blob, onProgress: ProgressCallback): Promise<string> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng', 1, {
    logger: (m: { status: string; progress: number }) => {
      onProgress(m.status, Math.round((m.progress || 0) * 100))
    },
  })
  const { data } = await worker.recognize(file)
  await worker.terminate()
  return data.text
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
  // Import the worker as a Vite asset URL so main lib and worker are always the same version
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  GlobalWorkerOptions.workerSrc = workerUrl

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: arrayBuffer }).promise
  const numPages = pdf.numPages

  // Pass 1: try text extraction
  let textParts: string[] = []
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

  // Pass 2: scanned PDF — render each page to canvas and OCR
  warnings.push('PDF appears to be a scanned image — using OCR (slower, may be less accurate).')
  const ocrParts: string[] = []
  for (let p = 1; p <= numPages; p++) {
    onProgress(`OCR-ing scanned PDF page ${p}/${numPages}…`, 50 + Math.round((p / numPages) * 40))
    const page = await pdf.getPage(p)
    const viewport = page.getViewport({ scale: 2.0 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')!
    // pdfjs-dist v6 uses `canvas` + `transform`; v5 used `canvasContext`
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
