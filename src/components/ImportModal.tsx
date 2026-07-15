import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Upload, Camera, FileText, AlertTriangle, Check, Trash2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { useStore } from '../store/useStore'
import { Button } from './ui/Button'
import { formatCurrency } from '../utils/formatters'
import { Transaction } from '../types'
import { uuid } from '../utils/uuid'
import { suggestCategoryId, detectDirection, merchantKey, TxDirection } from '../utils/categorize'

const GREEN = '#06C68A'
const NAVY = '#1A1F36'
const AMBER = '#f59e0b'

// ─── Duplicate detection ──────────────────────────────────────────────────────
// A transaction is a possible duplicate only when all three signals match:
//   • same merchant (via merchantKey — strips bank prefixes, normalizes)
//   • same amount (within $0.02 for rounding)
//   • same or adjacent date (within 1 day — covers post-date vs transaction-date)
// Returns the first matched existing transaction so we can show context in the UI.

function findPotentialDuplicate(
  tx: { date: string; description: string; amount: number },
  existing: Transaction[]
): Transaction | undefined {
  const txKey = merchantKey(tx.description)
  return existing.find(e => {
    const amountMatch = Math.abs(e.amount - tx.amount) < 0.02
    const daysDiff = Math.abs(new Date(tx.date + 'T12:00:00').getTime() - new Date(e.date + 'T12:00:00').getTime()) / 86400000
    const descMatch = merchantKey(e.description) === txKey
    return amountMatch && daysDiff <= 1 && descMatch
  })
}

// ─── Parser ───────────────────────────────────────────────────────────────────

interface RawTx { date: string; description: string; amount: number }

const MONTH_MAP: Record<string, string> = {
  jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06',
  jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12',
}

function parseDate(s: string): string | null {
  let m = s.match(/\b(\d{4})[\/\-](\d{2})[\/\-](\d{2})\b/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`

  m = s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s*(\d{4})?\b/i)
  if (m) {
    const mon = MONTH_MAP[m[1].toLowerCase().slice(0, 3)]
    const day = m[2].padStart(2, '0')
    const yr = m[3] || String(new Date().getFullYear())
    return `${yr}-${mon}-${day}`
  }

  m = s.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/)
  if (m) {
    const mon = m[1].padStart(2, '0')
    const day = m[2].padStart(2, '0')
    const raw = m[3]
    const yr = raw ? (raw.length === 2 ? '20' + raw : raw) : String(new Date().getFullYear())
    if (parseInt(mon) > 12 || parseInt(day) > 31) return null
    return `${yr}-${mon}-${day}`
  }

  return null
}

// Lines that are clearly table headers — skip entirely
const HEADER_RE = /^(date|description|details|amount|balance|running|transaction|account|posted|pending|debit|credit|reference|memo|type|category)\b/i

// Dollar-sign amount: $6.75, $1,234.56, $7 (no cents)
const DOLLAR_RE = /\$\s*([\d,]+(?:\.\d{1,2})?)/g
// Bare decimal (tab/space/line-edge bounded) to avoid matching zip codes
const DECIMAL_RE = /(?:^|[\t ])(-?[\d,]+\.\d{2})(?:$|[\t ])/gm

function findAmounts(line: string): number[] {
  const seen = new Set<number>()
  const out: number[] = []
  const push = (raw: string) => {
    const v = parseFloat(raw.replace(/,/g, ''))
    if (v > 0 && v < 100_000 && !seen.has(v)) { seen.add(v); out.push(v) }
  }
  let m: RegExpExecArray | null
  const dr = new RegExp(DOLLAR_RE.source, 'g')
  while ((m = dr.exec(line)) !== null) push(m[1])
  if (out.length === 0) {
    const decr = new RegExp(DECIMAL_RE.source, 'gm')
    while ((m = decr.exec(line)) !== null) push(m[1])
  }
  return out
}

// Strip date and amount tokens, leaving only the description text
function extractDesc(line: string): string {
  return line
    .replace(/\b\d{4}[\/\-]\d{2}[\/\-]\d{2}\b/g, '')
    .replace(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s*(?:\d{4})?\b/gi, '')
    .replace(/\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/g, '')
    .replace(/\$\s*[\d,]+(?:\.\d{1,2})?/g, '')
    .replace(/(?:^|[\t ])[-\(]?[\d,]+\.\d{2}\)?/g, '')
    .replace(/[^\w\s&'.\-#@]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isUsableDesc(s: string): boolean {
  return s.length >= 2 && !/^\d+$/.test(s)
}

// ─── State-machine parser ─────────────────────────────────────────────────────
// Handles 1-line, 2-line, and 3-line-per-transaction bank export formats.
//
// Each line is classified by content (not position):
//   DATE   — matches a date pattern, no amount
//   AMOUNT — matches a dollar amount, no date (bare amount line)
//   DESC   — no date, no amount (merchant name / memo line)
//   MIXED  — contains both date and/or amount AND description text on one line
//
// A transaction accumulates across consecutive lines until a new DATE is seen
// or an AMOUNT is found that completes the record.
//
// Example flows:
//   3-line  →  DATE / DESC / AMOUNT  →  emit on AMOUNT
//   2-line  →  DATE+DESC / AMOUNT    →  emit on AMOUNT
//   2-line  →  DATE / DESC+AMOUNT    →  emit on desc+amount line
//   1-line  →  DATE+DESC+AMOUNT      →  emit immediately
function parseTransactionText(text: string, today: string): RawTx[] {
  const results: RawTx[] = []

  // Accumulator for multi-line transactions
  let accDate = ''
  let accDescs: string[] = []
  let accAmount: number | null = null

  function emit() {
    if (accAmount === null) return
    const description = accDescs.join(' ').replace(/\s+/g, ' ').trim()
    if (isUsableDesc(description) || accDate) {
      results.push({
        date: accDate || today,
        description: description || '(no description)',
        amount: accAmount,
      })
    }
  }

  function flush() { emit(); accDate = ''; accDescs = []; accAmount = null }

  const lines = text.split('\n')

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line.length < 2 || HEADER_RE.test(line)) continue

    const dateVal = parseDate(line)
    const amounts = findAmounts(line)
    const descPart = extractDesc(line)

    const hasDate = !!dateVal
    const hasAmount = amounts.length > 0
    const hasDesc = isUsableDesc(descPart)

    if (hasDate && hasAmount && hasDesc) {
      // ── 1-line format: date + description + amount all together ──────────
      flush()
      results.push({ date: dateVal!, description: descPart, amount: amounts[0] })

    } else if (hasDate && hasAmount) {
      // ── date + amount, no description (rare) ─────────────────────────────
      flush()
      // Hold it: wait to see if next line has a description
      accDate = dateVal!
      accAmount = amounts[0]

    } else if (hasDate && !hasAmount) {
      // ── pure date line — boundary: start of a new transaction ─────────────
      // Emit any complete previous record first
      if (accAmount !== null) flush(); else { accDate = ''; accDescs = []; accAmount = null }
      accDate = dateVal!
      // If there's also description text on this date line (e.g. "Jun 30  STARBUCKS"), capture it
      if (hasDesc) accDescs = [descPart]

    } else if (hasAmount && hasDesc) {
      // ── description + amount on one line (2-line format, second line) ─────
      accDescs.push(descPart)
      accAmount = amounts[0]
      flush()

    } else if (hasAmount) {
      // ── bare amount line (3-line format, third line) ──────────────────────
      // Takes the first amount; subsequent amounts on this line are likely balance columns
      accAmount = amounts[0]
      flush()

    } else if (hasDesc) {
      // ── description-only line ─────────────────────────────────────────────
      accDescs.push(descPart)
    }
    // else: skip (no date, no amount, no usable description)
  }

  // Flush any trailing accumulator
  flush()

  // Deduplicate exact matches within the paste
  const seen = new Set<string>()
  return results.filter(tx => {
    const key = `${tx.date}|${tx.description}|${tx.amount}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ─── Tesseract OCR ────────────────────────────────────────────────────────────

async function extractFromScreenshot(
  imageFile: File,
  onProgress: (pct: number) => void
): Promise<RawTx[]> {
  const { createWorker } = await import('tesseract.js')
  const today = new Date().toISOString().slice(0, 10)
  const worker = await createWorker('eng', 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress(Math.round(m.progress * 100))
    },
  })
  try {
    const { data } = await worker.recognize(imageFile)
    return parseTransactionText(data.text, today)
  } finally {
    await worker.terminate()
  }
}

// ─── Review row ───────────────────────────────────────────────────────────────

interface ReviewRow {
  localId: string
  date: string
  description: string
  amount: string
  categoryId: string
  include: boolean
  isDuplicate: boolean
  direction: TxDirection
  matchedExisting?: { description: string; date: string; amount: number }
}

function toReviewRows(
  extracted: RawTx[],
  existingTxs: Transaction[],
  categories: import('../types').Category[],
  merchantRules: Record<string, string>,
): ReviewRow[] {
  return extracted.map(tx => {
    const matched = findPotentialDuplicate(tx, existingTxs)
    const dir = detectDirection(tx.description)
    return {
      localId: uuid(),
      date: tx.date,
      description: tx.description,
      amount: tx.amount.toFixed(2),
      categoryId: suggestCategoryId(tx.description, categories, dir, merchantRules),
      include: true, // always include by default — user decides what to skip
      isDuplicate: !!matched,
      direction: dir,
      matchedExisting: matched ? { description: matched.description, date: matched.date, amount: matched.amount } : undefined,
    }
  })
}

// ─── Weekly breakdown helper ──────────────────────────────────────────────────

function weekStartOf(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day // Monday start
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`
}

function weekBreakdown(rows: ReviewRow[]) {
  const map = new Map<string, { count: number; total: number; we: string }>()
  for (const r of rows) {
    if (!r.include) continue
    const ws = weekStartOf(r.date)
    const prev = map.get(ws) || { count: 0, total: 0, we: '' }
    const weDate = new Date(ws + 'T12:00:00')
    weDate.setDate(weDate.getDate() + 6)
    map.set(ws, { count: prev.count + 1, total: prev.total + (parseFloat(r.amount) || 0), we: weDate.toISOString().slice(0, 10) })
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([ws, v]) => ({ ws, ...v }))
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ImportModalProps { open: boolean; onClose: () => void }
type Step = 'input' | 'processing' | 'summary'
type InputMethod = 'paste' | 'screenshot'

export function ImportModal({ open, onClose }: ImportModalProps) {
  const { state, dispatch } = useStore()
  const sym = state.settings.currencySymbol
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('input')
  const [method, setMethod] = useState<InputMethod>('paste')
  const [pastedText, setPastedText] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [extractErr, setExtractErr] = useState('')
  const [rows, setRows] = useState<ReviewRow[]>([])
  const [showAllClean, setShowAllClean] = useState(false)

  // Derived summary data
  const attentionRows = rows.filter(r => r.isDuplicate || !r.categoryId)
  const cleanRows = rows.filter(r => !r.isDuplicate && r.categoryId)
  const includedCount = rows.filter(r => r.include).length
  const dupCount = rows.filter(r => r.isDuplicate).length
  const weeks = weekBreakdown(rows)
  const totalAmount = rows.filter(r => r.include).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)

  function updateRow(localId: string, patch: Partial<ReviewRow>) {
    setRows(rs => rs.map(r => {
      if (r.localId !== localId) return r
      // When user manually picks a category, save as a permanent merchant rule
      if (patch.categoryId && patch.categoryId !== r.categoryId) {
        dispatch({ type: 'SAVE_MERCHANT_RULE', payload: { key: merchantKey(r.description), categoryId: patch.categoryId } })
      }
      return { ...r, ...patch }
    }))
  }

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return setExtractErr('Please upload an image file.')
    setImageFile(file)
    setExtractErr('')
    setImagePreview(URL.createObjectURL(file))
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]; if (f) handleFile(f)
  }, [])

  // ── Process paste ──
  function handleParsePaste() {
    const text = pastedText.trim()
    if (!text) return setExtractErr('Paste your transaction text first.')
    setExtractErr('')
    setStep('processing')
    // Defer to next tick so the loading UI renders before the (synchronous) parse
    setTimeout(() => {
      const today = new Date().toISOString().slice(0, 10)
      const extracted = parseTransactionText(text, today)
      if (extracted.length === 0) {
        setStep('input')
        setExtractErr("Couldn't find any transactions. Make sure each line has a dollar amount (e.g. $54.32). Check the format tips above.")
        return
      }
      setRows(toReviewRows(extracted, state.transactions, state.categories, state.merchantRules || {}))
      setStep('summary')
    }, 0)
  }

  // ── Process screenshot ──
  async function handleExtractScreenshot() {
    if (!imageFile) return setExtractErr('Please select a screenshot first.')
    setExtractErr('')
    setOcrProgress(0)
    setStep('processing')
    try {
      const extracted = await extractFromScreenshot(imageFile, setOcrProgress)
      if (extracted.length === 0) {
        setStep('input')
        setExtractErr('No transactions found. Try a clearer, higher-contrast screenshot.')
        return
      }
      setRows(toReviewRows(extracted, state.transactions, state.categories, state.merchantRules || {}))
      setStep('summary')
    } catch (err: any) {
      setStep('input')
      setExtractErr(err.message || 'OCR failed. Try a different image.')
    }
  }

  // ── Save ──
  function handleSave() {
    const defaultAccount = state.accounts[0]?.id || ''
    for (const row of rows.filter(r => r.include)) {
      const amount = parseFloat(row.amount)
      if (isNaN(amount) || amount <= 0) continue
      // Use detected direction to set transaction type correctly:
      // credits (Zelle Credit, direct deposit, etc.) → 'income'
      // debits or unknown → 'expense'
      const txType = row.direction === 'credit' ? 'income' : 'expense'
      const fallbackCat = state.categories.find(c => c.type === txType)?.id || ''
      dispatch({
        type: 'ADD_TRANSACTION',
        payload: {
          id: uuid(),
          date: row.date,
          description: row.description.trim(),
          amount,
          type: txType,
          categoryId: row.categoryId || fallbackCat,
          accountId: defaultAccount,
          tags: ['imported'],
          merchantName: row.description.trim(),
        } as Transaction,
      })
    }
    onClose()
  }

  function reset() {
    setStep('input'); setRows([]); setPastedText('')
    setImageFile(null); setImagePreview(null)
    setExtractErr(''); setOcrProgress(0); setShowAllClean(false)
  }

  if (!open) return null

  // ── Tab button style ──
  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    padding: '9px 0', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 13, fontWeight: active ? 600 : 400, transition: 'all 0.15s', border: 'none',
    background: active ? NAVY : '#F0F0F0', color: active ? '#fff' : '#6b7280',
  })

  const cellInput: React.CSSProperties = {
    fontSize: 12, border: '1px solid #E4E4E4', borderRadius: 6, padding: '4px 6px',
    background: '#F9FAFB', color: NAVY, fontFamily: 'inherit', width: '100%',
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }} />

      <div style={{
        position: 'relative', width: '100%',
        maxWidth: step === 'summary' ? 680 : (step === 'input' && method === 'paste') ? 760 : 520,
        maxHeight: 'calc(100vh - 48px)',
        background: '#FAFAFA', borderRadius: 16, border: '1px solid #E4E4E4',
        boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
        display: 'flex', flexDirection: 'column', transition: 'max-width 0.25s',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #EEEEEE', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: NAVY }}>
              {step === 'input' ? 'Import Transactions' : step === 'processing' ? 'Processing…' : 'Import Summary'}
            </h2>
            <p style={{ fontSize: 12, color: '#8A94A6', marginTop: 2 }}>
              {step === 'input' && 'Paste a full month of bank transactions — the app handles the rest.'}
              {step === 'processing' && (method === 'screenshot' ? 'Running on-device OCR — no data leaves your device.' : 'Parsing and auto-categorizing your transactions…')}
              {step === 'summary' && `${rows.length} transaction${rows.length !== 1 ? 's' : ''} found · ${formatCurrency(totalAmount, sym)} total`}
            </p>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #E4E4E4', background: '#F0F0F0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>

          {/* ── INPUT STEP ── */}
          {step === 'input' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {extractErr && (
                <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#dc2626', display: 'flex', gap: 8 }}>
                  <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />{extractErr}
                </div>
              )}

              {/* Method tabs — paste is primary */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={tabStyle(method === 'paste')} onClick={() => { setMethod('paste'); setExtractErr('') }}>
                  <FileText size={15} /> Paste Transactions
                </button>
                <button style={tabStyle(method === 'screenshot')} onClick={() => { setMethod('screenshot'); setExtractErr('') }}>
                  <Camera size={15} /> Upload Screenshot
                </button>
              </div>

              {/* ── Paste panel ── */}
              {method === 'paste' && (
                <>
                  <div style={{ padding: '10px 14px', background: 'rgba(6,198,138,0.06)', border: '1px solid rgba(6,198,138,0.2)', borderRadius: 8, fontSize: 12, color: '#374151' }}>
                    <strong style={{ display: 'block', marginBottom: 3, color: NAVY }}>How to paste from your bank</strong>
                    Go to your bank's transaction history, select all rows, copy, and paste here. The app reads dates, merchants, and amounts automatically — no manual entry needed.
                    <div style={{ marginTop: 6, fontFamily: 'monospace', fontSize: 11, color: '#6b7280', lineHeight: 1.7 }}>
                      07/11/2025&nbsp;&nbsp;Starbucks&nbsp;&nbsp;$6.75&nbsp;&nbsp;$1,247.95<br />
                      Jul 10&nbsp;&nbsp;WAL-MART SUPERCENTER&nbsp;&nbsp;-54.32<br />
                      2025-07-09&nbsp;&nbsp;DOORDASH*ORDER&nbsp;&nbsp;(28.90)
                    </div>
                  </div>

                  <textarea
                    value={pastedText}
                    onChange={e => { setPastedText(e.target.value); setExtractErr('') }}
                    placeholder={"Paste your bank transaction history here…\n\nExample:\n07/11  Starbucks  $6.75\n07/10  Walmart  $54.32\n07/09  Netflix  $15.99"}
                    rows={14}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      fontSize: 12, fontFamily: 'monospace', lineHeight: 1.65,
                      border: '1px solid #D0D5DD', borderRadius: 8,
                      padding: '10px 12px', resize: 'vertical',
                      background: '#F9FAFB', color: NAVY, outline: 'none',
                      whiteSpace: 'pre', overflowX: 'auto', overflowY: 'auto',
                      wordBreak: 'normal', overflowWrap: 'normal',
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = GREEN)}
                    onBlur={e => (e.currentTarget.style.borderColor = '#D0D5DD')}
                  />

                  {pastedText.trim() && (
                    <p style={{ fontSize: 11, color: '#8A94A6', marginTop: -10 }}>
                      {pastedText.trim().split('\n').filter(l => l.trim()).length} lines pasted
                    </p>
                  )}

                  <div style={{ display: 'flex', gap: 10 }}>
                    <Button onClick={handleParsePaste} disabled={!pastedText.trim()} style={{ flex: 1 }}>
                      <Upload size={14} /> Process Transactions
                    </Button>
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                  </div>
                </>
              )}

              {/* ── Screenshot panel ── */}
              {method === 'screenshot' && (
                <>
                  <div style={{ padding: '10px 14px', background: 'rgba(6,198,138,0.06)', border: '1px solid rgba(6,198,138,0.2)', borderRadius: 8, fontSize: 12, color: '#374151' }}>
                    <strong style={{ display: 'block', marginBottom: 3, color: NAVY }}>OCR screenshot import</strong>
                    Upload a screenshot of your bank's transaction list. OCR accuracy depends on image clarity — use Paste Transactions for more reliable results when copy-paste is available.
                  </div>

                  <div
                    onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={onDrop}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: `2px dashed ${dragOver ? GREEN : imageFile ? GREEN : '#D0D5DD'}`,
                      borderRadius: 12, padding: '28px 20px', textAlign: 'center', cursor: 'pointer',
                      background: dragOver ? 'rgba(6,198,138,0.04)' : imageFile ? 'rgba(6,198,138,0.03)' : '#F9FAFB',
                      transition: 'all 0.15s',
                    }}
                  >
                    <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
                    {imagePreview ? (
                      <div>
                        <img src={imagePreview} alt="preview" style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 8, objectFit: 'contain', marginBottom: 10 }} />
                        <p style={{ fontSize: 12, color: GREEN, fontWeight: 500 }}><Check size={12} style={{ display: 'inline', marginRight: 4 }} />{imageFile?.name} — click to change</p>
                      </div>
                    ) : (
                      <>
                        <div style={{ width: 44, height: 44, borderRadius: 10, background: '#EBEBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                          <Camera size={20} style={{ color: '#8A94A6' }} />
                        </div>
                        <p style={{ fontSize: 14, fontWeight: 500, color: NAVY, marginBottom: 4 }}>Drop your bank screenshot here</p>
                        <p style={{ fontSize: 12, color: '#8A94A6' }}>PNG, JPG, or WEBP · click to browse</p>
                      </>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <Button onClick={handleExtractScreenshot} disabled={!imageFile} style={{ flex: 1 }}>
                      <Upload size={14} /> Extract Transactions
                    </Button>
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── PROCESSING STEP ── */}
          {step === 'processing' && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(6,198,138,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', animation: 'spin 1.2s linear infinite' }}>
                <RefreshCw size={22} style={{ color: GREEN }} />
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, color: NAVY, marginBottom: 6 }}>
                {method === 'screenshot' ? 'Reading your screenshot…' : 'Parsing & categorizing…'}
              </p>
              <p style={{ fontSize: 13, color: '#8A94A6', marginBottom: 20 }}>
                {method === 'screenshot' ? 'Running on-device OCR — no data leaves your device.' : 'Matching merchants to your budget categories automatically.'}
              </p>
              {method === 'screenshot' && ocrProgress > 0 && (
                <div style={{ maxWidth: 240, margin: '0 auto' }}>
                  <div style={{ height: 6, borderRadius: 99, background: '#EBEBEB', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: GREEN, borderRadius: 99, width: `${ocrProgress}%`, transition: 'width 0.3s' }} />
                  </div>
                  <p style={{ fontSize: 11, color: '#8A94A6', marginTop: 6 }}>{ocrProgress}%</p>
                </div>
              )}
              <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
            </div>
          )}

          {/* ── SUMMARY STEP ── */}
          {step === 'summary' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Stats bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {[
                  { label: 'Found', value: String(rows.length) },
                  { label: 'Auto-categorized', value: String(cleanRows.length) },
                  { label: 'Possible duplicates', value: String(dupCount), highlight: dupCount > 0, amber: true },
                  { label: 'Need category', value: String(attentionRows.filter(r => !r.isDuplicate).length), highlight: attentionRows.filter(r => !r.isDuplicate).length > 0 },
                ].map(s => (
                  <div key={s.label} style={{ background: '#fff', border: `1px solid ${s.highlight ? '#fde68a' : '#EBEBEB'}`, borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                    <p style={{ fontSize: 22, fontWeight: 700, color: s.highlight ? AMBER : NAVY }}>{s.value}</p>
                    <p style={{ fontSize: 11, color: '#8A94A6', marginTop: 2 }}>{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Weekly breakdown */}
              {weeks.length > 0 && (
                <div style={{ background: '#fff', border: '1px solid #EBEBEB', borderRadius: 10, padding: '14px 16px' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#8A94A6', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Weekly Breakdown</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {weeks.map(w => {
                      const maxCount = Math.max(...weeks.map(x => x.count))
                      return (
                        <div key={w.ws} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 80px', gap: 10, alignItems: 'center', fontSize: 12 }}>
                          <span style={{ color: '#6b7280' }}>{fmtDate(w.ws)}–{fmtDate(w.we)}</span>
                          <div style={{ height: 6, borderRadius: 99, background: '#EBEBEB', overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: GREEN, borderRadius: 99, width: `${(w.count / maxCount) * 100}%` }} />
                          </div>
                          <span style={{ color: NAVY, fontWeight: 500, textAlign: 'right' }}>{w.count} · {formatCurrency(w.total, sym)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Attention items */}
              {attentionRows.length > 0 && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <AlertTriangle size={14} style={{ color: AMBER, flexShrink: 0 }} />
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#92400e' }}>
                      {attentionRows.length} transaction{attentionRows.length !== 1 ? 's' : ''} need your attention
                    </p>
                  </div>
                  {dupCount > 0 && (
                    <p style={{ fontSize: 11, color: '#92400e', marginBottom: 12, paddingLeft: 22 }}>
                      {dupCount} possible duplicate{dupCount !== 1 ? 's' : ''} flagged — included by default. Review and skip any you don't want.
                    </p>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {attentionRows.map(row => (
                      <div key={row.localId} style={{ background: '#fff', borderRadius: 8, padding: '8px 10px', border: '1px solid #fde68a' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '88px 1fr 72px 148px', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: '#6b7280' }}>{row.date}</span>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: 12, fontWeight: 500, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.description}</p>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: NAVY, textAlign: 'right' }}>{sym}{row.amount}</span>
                          {row.isDuplicate ? (
                            <div style={{ display: 'flex', gap: 5 }}>
                              <button onClick={() => updateRow(row.localId, { include: true })}
                                style={{ flex: 1, fontSize: 11, padding: '4px 0', borderRadius: 5, border: `1px solid ${row.include ? GREEN : '#E4E4E4'}`, background: row.include ? 'rgba(6,198,138,0.1)' : '#F5F5F5', color: row.include ? GREEN : '#6b7280', cursor: 'pointer', fontFamily: 'inherit', fontWeight: row.include ? 600 : 400 }}>
                                Keep
                              </button>
                              <button onClick={() => updateRow(row.localId, { include: false })}
                                style={{ flex: 1, fontSize: 11, padding: '4px 0', borderRadius: 5, border: `1px solid ${!row.include ? '#ef4444' : '#E4E4E4'}`, background: !row.include ? 'rgba(239,68,68,0.08)' : '#F5F5F5', color: !row.include ? '#ef4444' : '#6b7280', cursor: 'pointer', fontFamily: 'inherit', fontWeight: !row.include ? 600 : 400 }}>
                                Skip
                              </button>
                            </div>
                          ) : (
                            <select value={row.categoryId}
                              onChange={e => updateRow(row.localId, { categoryId: e.target.value })}
                              style={{ fontSize: 11, border: '1px solid #E4E4E4', borderRadius: 5, padding: '4px 6px', background: '#F9FAFB', color: row.categoryId ? NAVY : '#9CA3AF', fontFamily: 'inherit', width: '100%' }}>
                              <option value="">Uncategorized</option>
                              {state.categories
                                .filter(c => row.direction === 'credit' ? c.type === 'income' : c.type === 'expense')
                                .map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                            </select>
                          )}
                        </div>
                        {row.isDuplicate && row.matchedExisting && (
                          <p style={{ fontSize: 10, color: '#92400e', marginTop: 5, paddingLeft: 0, opacity: 0.8 }}>
                            ⚠ Matches existing: {row.matchedExisting.description} on {row.matchedExisting.date} ({sym}{row.matchedExisting.amount.toFixed(2)})
                          </p>
                        )}
                        {row.isDuplicate && !row.matchedExisting && (
                          <p style={{ fontSize: 10, color: '#92400e', marginTop: 5, opacity: 0.8 }}>⚠ Possible duplicate of an existing transaction</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Expandable: all clean transactions */}
              {cleanRows.length > 0 && (
                <div style={{ border: '1px solid #EBEBEB', borderRadius: 10, overflow: 'hidden' }}>
                  <button
                    onClick={() => setShowAllClean(v => !v)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: NAVY }}>
                      <Check size={14} style={{ display: 'inline', color: GREEN, marginRight: 6, verticalAlign: 'middle' }} />
                      {cleanRows.length} auto-categorized transactions
                    </span>
                    {showAllClean ? <ChevronUp size={16} color="#8A94A6" /> : <ChevronDown size={16} color="#8A94A6" />}
                  </button>

                  {showAllClean && (
                    <div style={{ borderTop: '1px solid #EBEBEB', maxHeight: 320, overflowY: 'auto' }}>
                      {/* Column header */}
                      <div style={{ display: 'grid', gridTemplateColumns: '32px 88px 1fr 72px 148px 28px', gap: 8, padding: '7px 12px', background: '#F9FAFB', fontSize: 10, fontWeight: 600, color: '#8A94A6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <input type="checkbox"
                          checked={cleanRows.every(r => r.include)}
                          onChange={e => setRows(rs => rs.map(r => (!r.isDuplicate && r.categoryId) ? { ...r, include: e.target.checked } : r))}
                          style={{ width: 14, height: 14, accentColor: GREEN, cursor: 'pointer' }} />
                        <span>Date</span><span>Description</span><span>Amount</span><span>Category</span><span />
                      </div>
                      {cleanRows.map(row => (
                        <div key={row.localId} style={{ display: 'grid', gridTemplateColumns: '32px 88px 1fr 72px 148px 28px', gap: 8, padding: '7px 12px', alignItems: 'center', borderTop: '1px solid #F0F0F0', opacity: row.include ? 1 : 0.4 }}>
                          <input type="checkbox" checked={row.include}
                            onChange={e => updateRow(row.localId, { include: e.target.checked })}
                            style={{ width: 14, height: 14, accentColor: GREEN, cursor: 'pointer' }} />
                          <span style={{ fontSize: 11, color: '#6b7280' }}>{row.date}</span>
                          <span style={{ fontSize: 12, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.description}</span>
                          <span style={{ fontSize: 12, fontWeight: 500, color: NAVY }}>{sym}{row.amount}</span>
                          <select value={row.categoryId}
                            onChange={e => updateRow(row.localId, { categoryId: e.target.value })}
                            style={{ fontSize: 11, border: '1px solid #E4E4E4', borderRadius: 5, padding: '3px 5px', background: '#F9FAFB', color: NAVY, fontFamily: 'inherit', width: '100%' }}>
                            <option value="">Uncategorized</option>
                            {state.categories
                              .filter(c => row.direction === 'credit' ? c.type === 'income' : c.type === 'expense')
                              .map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                          </select>
                          <button onClick={() => setRows(rs => rs.filter(r => r.localId !== row.localId))} title="Remove"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C0C0C0', padding: 2, display: 'flex', alignItems: 'center' }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Footer */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
                <Button variant="secondary" onClick={reset}>← Start over</Button>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  {rows.filter(r => r.isDuplicate && !r.include).length > 0 && (
                    <p style={{ fontSize: 11, color: '#8A94A6' }}>
                      {rows.filter(r => r.isDuplicate && !r.include).length} flagged duplicate{rows.filter(r => r.isDuplicate && !r.include).length !== 1 ? 's' : ''} will be skipped
                    </p>
                  )}
                  <Button onClick={handleSave} disabled={includedCount === 0}>
                    <Check size={14} /> Save {includedCount} Transaction{includedCount !== 1 ? 's' : ''}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
