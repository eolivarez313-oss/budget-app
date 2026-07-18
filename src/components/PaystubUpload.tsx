import { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react'
import { Upload, X, Plus, AlertTriangle, CheckCircle, ChevronRight, Loader2, FileText, FileImage, Info } from 'lucide-react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Input, Field } from './ui/Input'
import { parsePaystub, checkConsistency, ParsedPaystub, FieldConfidence, ParsedEarning, ParsedLineItem, ParsedTax } from '../lib/paystubParser'
import { detectKind, validateFile, extractText, FileKind } from '../lib/paystubExtractor'
import { savePaystub } from '../lib/paystubDb'
import { Paystub, PaystubEarning, PaystubLineItem, PaystubTax } from '../types'
import { uuid } from '../utils/uuid'

const GREEN = '#06C68A'
const WARN = '#f59e0b'
const DANGER = '#ef4444'

interface Props {
  open: boolean
  onClose: () => void
  userId: string
  existingPaystubs: Paystub[]
  onConfirmed: (paystub: Paystub) => void
}

type Step = 'upload' | 'processing' | 'review' | 'done'

interface QueuedFile {
  file: File
  kind: FileKind
  previewUrl?: string
}

interface EditableEarning { label: string; amount: string }
interface EditableDeduction { name: string; amount: string }
interface EditableTax { label: string; canonicalName: string; amount: string }

interface EditablePaystub {
  employerName: string
  payDate: string
  periodStart: string
  periodEnd: string
  earnings: EditableEarning[]
  grossPay: string
  deductions: EditableDeduction[]
  totalDeductions: string
  taxes: EditableTax[]
  totalTaxes: string
  netPay: string
  ptoAccrued: string
  ptoUsed: string
  ptoRemaining: string
}

function toEditable(p: ParsedPaystub): EditablePaystub {
  const n = (v?: number | null) => v != null ? v.toFixed(2) : ''
  return {
    employerName: p.employerName ?? '',
    payDate: p.payDate ?? '',
    periodStart: p.periodStart ?? '',
    periodEnd: p.periodEnd ?? '',
    earnings: p.earnings.map(e => ({ label: e.label, amount: n(e.amount) })),
    grossPay: n(p.grossPay),
    deductions: p.deductions.map(d => ({ name: d.name, amount: n(d.amount) })),
    totalDeductions: n(p.totalDeductions),
    taxes: p.taxes.map(t => ({ label: t.label, canonicalName: t.canonicalName, amount: n(t.amount) })),
    totalTaxes: n(p.totalTaxes),
    netPay: n(p.netPay),
    ptoAccrued: n(p.ptoAccrued),
    ptoUsed: n(p.ptoUsed),
    ptoRemaining: n(p.ptoRemaining),
  }
}

function fromEditable(e: EditablePaystub): Paystub {
  const n = (s: string) => s.trim() ? parseFloat(s.replace(/,/g, '')) || null : null
  const na = (s: string) => s.trim() ? parseFloat(s.replace(/,/g, '')) || 0 : 0

  const earnings: PaystubEarning[] = e.earnings
    .filter(ea => ea.label.trim() && ea.amount.trim())
    .map(ea => ({ label: ea.label.trim(), amount: na(ea.amount) }))

  const deductions: PaystubLineItem[] = e.deductions
    .filter(d => d.name.trim() && d.amount.trim())
    .map(d => ({ name: d.name.trim(), amount: na(d.amount) }))

  const taxes: PaystubTax[] = e.taxes
    .filter(t => t.label.trim() && t.amount.trim())
    .map(t => ({ label: t.label.trim(), canonicalName: t.canonicalName.trim() || t.label.trim(), amount: na(t.amount) }))

  return {
    id: uuid(),
    employerName: e.employerName.trim() || undefined,
    payDate: e.payDate.trim() || undefined,
    periodStart: e.periodStart.trim() || undefined,
    periodEnd: e.periodEnd.trim() || undefined,
    grossPay: n(e.grossPay),
    netPay: n(e.netPay),
    earnings,
    deductions,
    taxes,
    totalDeductions: n(e.totalDeductions),
    totalTaxes: n(e.totalTaxes),
    preTaxDeductions: [],
    postTaxDeductions: [],
    ptoAccrued: n(e.ptoAccrued),
    ptoUsed: n(e.ptoUsed),
    ptoRemaining: n(e.ptoRemaining),
    isConfirmed: true,
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function FileThumb({ qf, index, onRemove }: { qf: QueuedFile; index: number; onRemove: () => void }) {
  const isImg = qf.kind === 'image' || qf.kind === 'heic'
  const kindLabel: Record<FileKind, string> = { image: 'Image', heic: 'HEIC', pdf: 'PDF', docx: 'DOCX', unsupported: '?' }
  return (
    <div style={{ position: 'relative', width: 100, height: 130, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' }}>
      {isImg && qf.previewUrl
        ? <img src={qf.previewUrl} alt={`Page ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 8 }}>
            {qf.kind === 'pdf' ? <FileText size={32} color="var(--text-muted)" /> : <FileImage size={32} color="var(--text-muted)" />}
            <span style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', wordBreak: 'break-all' }}>
              {qf.file.name.length > 20 ? qf.file.name.slice(0, 18) + '…' : qf.file.name}
            </span>
          </div>
        )
      }
      <div style={{ position: 'absolute', top: 4, right: 4 }}>
        <button onClick={e => { e.stopPropagation(); onRemove() }}
          style={{ background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={11} color="#fff" />
        </button>
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.55)', padding: '3px 6px', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: '#fff' }}>Page {index + 1}</span>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>{kindLabel[qf.kind]}</span>
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: -4, marginTop: 4 }}>
      {children}
    </p>
  )
}

function ConfidenceField({ label, confidence, children }: { label: string; confidence?: FieldConfidence; children: React.ReactNode }) {
  const border = confidence === 'medium' ? `1px solid ${WARN}` : confidence === 'low' ? `1px solid ${DANGER}` : undefined
  const bg = confidence === 'medium' ? 'rgba(245,158,11,0.06)' : confidence === 'low' ? 'rgba(239,68,68,0.06)' : undefined
  return (
    <div style={{ borderRadius: 6, border, background: bg, padding: border ? '4px 6px 2px' : undefined }}>
      <Field label={
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {label}
          {confidence === 'medium' && <span style={{ fontSize: 9, background: WARN, color: '#fff', borderRadius: 3, padding: '1px 4px', fontWeight: 700 }}>CHECK</span>}
          {confidence === 'low' && <span style={{ fontSize: 9, background: DANGER, color: '#fff', borderRadius: 3, padding: '1px 4px', fontWeight: 700 }}>MISSING</span>}
        </span>
      }>{children}</Field>
    </div>
  )
}

function LineItemTable<T extends { label?: string; name?: string; amount: string; canonicalName?: string }>({
  rows,
  onChange,
  onAdd,
  onRemove,
  showCanonical,
}: {
  rows: T[]
  onChange: (i: number, field: keyof T, val: string) => void
  onAdd: () => void
  onRemove: (i: number) => void
  showCanonical?: boolean
}) {
  const cols = showCanonical
    ? 'minmax(100px,1fr) minmax(120px,1.2fr) 90px 24px'
    : 'minmax(140px,1fr) 90px 24px'
  const headers = showCanonical ? ['Label', 'Description', 'Amount', ''] : ['Name', 'Amount', '']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 6 }}>
        {headers.map(h => (
          <span key={h} style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
        ))}
      </div>
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: cols, gap: 6, alignItems: 'center' }}>
          <Input
            placeholder={showCanonical ? 'e.g. FICA' : 'e.g. Union Dues'}
            value={(row.label ?? row.name ?? '') as string}
            onChange={e => onChange(i, (showCanonical ? 'label' : 'name') as keyof T, e.target.value)}
          />
          {showCanonical && (
            <Input
              placeholder="Social Security"
              value={(row.canonicalName ?? '') as string}
              onChange={e => onChange(i, 'canonicalName' as keyof T, e.target.value)}
            />
          )}
          <Input
            type="number" min="0" step="0.01" placeholder="0.00"
            value={row.amount}
            onChange={e => onChange(i, 'amount' as keyof T, e.target.value)}
          />
          <button type="button" onClick={() => onRemove(i)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
            <X size={14} />
          </button>
        </div>
      ))}
      <button type="button" onClick={onAdd}
        style={{ background: 'none', border: '1px dashed var(--border)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, width: 'fit-content' }}>
        <Plus size={11} /> Add row
      </button>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function PaystubUpload({ open, onClose, userId, existingPaystubs, onConfirmed }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [queue, setQueue] = useState<QueuedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressStatus, setProgressStatus] = useState('')
  const [extractionMethod, setExtractionMethod] = useState('')
  const [parsedRaw, setParsedRaw] = useState<ParsedPaystub | null>(null)
  const [form, setForm] = useState<EditablePaystub | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deductionAlerts, setDeductionAlerts] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  function reset() {
    queue.forEach(q => { if (q.previewUrl) URL.revokeObjectURL(q.previewUrl) })
    setStep('upload'); setQueue([])
    setProgress(0); setProgressStatus(''); setExtractionMethod('')
    setParsedRaw(null); setForm(null)
    setSaving(false); setError(null); setDeductionAlerts([])
  }

  function handleClose() { reset(); onClose() }

  async function addFiles(files: File[]) {
    setError(null)
    const newEntries: QueuedFile[] = []
    for (const file of files) {
      const kind = await detectKind(file)
      const err = validateFile(file, kind)
      if (err) { setError(err); return }
      const previewUrl = kind === 'image' ? URL.createObjectURL(file) : undefined
      newEntries.push({ file, kind, previewUrl })
    }
    setQueue(prev => [...prev, ...newEntries])
  }

  function handleFileInput(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault(); setIsDragging(false)
    addFiles(Array.from(e.dataTransfer.files))
  }

  function removeFile(i: number) {
    setQueue(prev => {
      const q = prev[i]; if (q.previewUrl) URL.revokeObjectURL(q.previewUrl)
      return prev.filter((_, j) => j !== i)
    })
  }

  async function runExtraction() {
    if (!queue.length) { setError('Please add at least one file.'); return }
    setStep('processing'); setProgress(0); setProgressStatus('Starting…')
    try {
      const result = await extractText(
        queue.map(q => q.file),
        (status, pct) => { setProgressStatus(status); setProgress(pct) }
      )
      setExtractionMethod(result.method)

      const parsed = parsePaystub(result)
      parsed.rawText = result.text
      parsed.warnings = [...result.warnings, ...parsed.warnings]
      setParsedRaw(parsed)
      setForm(toEditable(parsed))

      // Deduction change alerts vs most recent prior paystub
      if (existingPaystubs.length > 0) {
        const prior = existingPaystubs[0]
        const alerts: string[] = []
        const priorDeds: { name: string; amount: number }[] = [
          ...(prior.deductions ?? []),
          ...(prior.preTaxDeductions ?? []).map(d => ({ name: d.name, amount: d.current ?? 0 })),
          ...(prior.postTaxDeductions ?? []).map(d => ({ name: d.name, amount: d.current ?? 0 })),
        ]
        for (const nd of parsed.deductions) {
          const od = priorDeds.find(d => d.name.toLowerCase() === nd.name.toLowerCase())
          if (!od && nd.amount > 0) alerts.push(`New deduction detected: ${nd.name} ($${nd.amount.toFixed(2)})`)
          else if (od && Math.abs(nd.amount - od.amount) >= 1) {
            const dir = nd.amount > od.amount ? 'increased' : 'decreased'
            alerts.push(`${nd.name} ${dir} by $${Math.abs(nd.amount - od.amount).toFixed(2)} (was $${od.amount.toFixed(2)}, now $${nd.amount.toFixed(2)})`)
          }
        }
        setDeductionAlerts(alerts)
      }

      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setStep('upload')
    }
  }

  async function confirmSave() {
    if (!form) return
    setSaving(true); setError(null)
    try {
      const paystub = fromEditable(form)
      paystub.rawText = parsedRaw?.rawText
      const saved = await savePaystub(paystub, userId)
      onConfirmed(saved)
      setStep('done')
    } catch (err) {
      setError(`Save failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  // Real-time reconciliation
  const recon = (() => {
    if (!form) return null
    const gross = parseFloat(form.grossPay) || 0
    const deds = parseFloat(form.totalDeductions) || form.deductions.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0)
    const taxes = parseFloat(form.totalTaxes) || form.taxes.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0)
    const net = parseFloat(form.netPay) || 0
    if (gross === 0 || net === 0) return null
    const computed = gross - deds - taxes
    const diff = Math.abs(computed - net)
    const ok = diff <= 0.05
    return { ok, gross, deds, taxes, computed, net, diff }
  })()

  // Helper to update earnings/deductions/taxes arrays
  function updateEarning(i: number, field: keyof EditableEarning, val: string) {
    setForm(f => f ? { ...f, earnings: f.earnings.map((e, j) => j === i ? { ...e, [field]: val } : e) } : f)
  }
  function updateDeduction(i: number, field: keyof EditableDeduction, val: string) {
    setForm(f => f ? { ...f, deductions: f.deductions.map((d, j) => j === i ? { ...d, [field]: val } : d) } : f)
  }
  function updateTax(i: number, field: keyof EditableTax, val: string) {
    setForm(f => f ? { ...f, taxes: f.taxes.map((t, j) => j === i ? { ...t, [field]: val } : t) } : f)
  }

  return (
    <Modal open={open} onClose={handleClose} title="Upload Paystub" size="lg">
      {error && (
        <div style={{ background: 'var(--danger-dim)', border: `1px solid ${DANGER}`, borderRadius: 8, padding: '10px 14px', marginBottom: 14, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <AlertTriangle size={14} color={DANGER} style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontSize: 13, color: DANGER }}>{error}</span>
        </div>
      )}

      {/* ── Upload ─────────────────────────────────────────────────────────── */}
      {step === 'upload' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Upload a photo, PDF, or Word document of your paystub. Only current-period figures are extracted — YTD columns are ignored.
          </p>
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{ border: `2px dashed ${isDragging ? GREEN : 'var(--border)'}`, borderRadius: 12, padding: '32px 24px', textAlign: 'center', cursor: 'pointer', background: isDragging ? 'rgba(6,198,138,0.05)' : 'var(--surface)', transition: 'all 0.15s' }}>
            <Upload size={28} color={isDragging ? GREEN : 'var(--text-muted)'} style={{ margin: '0 auto 10px' }} />
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Drop paystub here, or click to browse</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>JPG · PNG · WEBP · HEIC (iPhone) · PDF · DOCX · up to 20 MB</p>
            <input ref={fileInputRef} type="file" accept="image/*,.heic,.heif,.pdf,.docx,.doc,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple hidden onChange={handleFileInput} />
          </div>

          {queue.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {queue.map((qf, i) => <FileThumb key={i} qf={qf} index={i} onRemove={() => removeFile(i)} />)}
              <button onClick={() => fileInputRef.current?.click()}
                style={{ width: 100, height: 130, borderRadius: 8, border: '1px dashed var(--border)', background: 'var(--surface)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--text-muted)' }}>
                <Plus size={18} /><span style={{ fontSize: 10 }}>Add page</span>
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <Button onClick={runExtraction} disabled={!queue.length} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Extract paystub data <ChevronRight size={14} />
            </Button>
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
          </div>
        </div>
      )}

      {/* ── Processing ─────────────────────────────────────────────────────── */}
      {step === 'processing' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '32px 0' }}>
          <Loader2 size={36} color={GREEN} style={{ animation: 'spin 1s linear infinite' }} />
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Reading your paystub…</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{progressStatus}</p>
          </div>
          <div style={{ width: '100%', maxWidth: 320, background: 'var(--border)', borderRadius: 99, height: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: GREEN, borderRadius: 99, width: `${progress}%`, transition: 'width 0.3s' }} />
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{progress}%</p>
        </div>
      )}

      {/* ── Review ─────────────────────────────────────────────────────────── */}
      {step === 'review' && form && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Confidence banner */}
          {parsedRaw && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 14px', borderRadius: 8, background: parsedRaw.confidence === 'high' ? 'rgba(6,198,138,0.08)' : parsedRaw.confidence === 'medium' ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${parsedRaw.confidence === 'high' ? GREEN : parsedRaw.confidence === 'medium' ? WARN : DANGER}` }}>
              <Info size={14} color={parsedRaw.confidence === 'high' ? GREEN : parsedRaw.confidence === 'medium' ? WARN : DANGER} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12 }}>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                  {parsedRaw.confidence === 'high' ? 'Good extraction' : parsedRaw.confidence === 'medium' ? 'Partial extraction' : 'Low confidence'}
                </span>
                {extractionMethod && <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>via {extractionMethod}</span>}
                {' — '}
                <span style={{ color: 'var(--text-muted)' }}>
                  {parsedRaw.confidence === 'high' ? 'Current-period figures extracted. Review before confirming.' : 'Some fields found. Fill in any missing values.'}
                </span>
                {parsedRaw.warnings.map((w, i) => <p key={i} style={{ marginTop: 4, color: WARN }}>⚠ {w}</p>)}
              </div>
            </div>
          )}

          {/* Deduction change alerts */}
          {deductionAlerts.length > 0 && (
            <div style={{ background: 'rgba(245,158,11,0.08)', border: `1px solid ${WARN}`, borderRadius: 8, padding: '10px 14px' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: WARN, marginBottom: 6 }}>⚠ Deduction changes vs. last paystub:</p>
              {deductionAlerts.map((a, i) => <p key={i} style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>• {a}</p>)}
            </div>
          )}

          {/* Header */}
          <SectionLabel>Employer &amp; Pay Period</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px 140px', gap: 10 }}>
            <Field label="Employer name">
              <Input value={form.employerName} onChange={e => setForm(f => f ? { ...f, employerName: e.target.value } : f)} placeholder="e.g. Acme Corp" />
            </Field>
            <ConfidenceField label="Pay date" confidence={!form.payDate ? 'low' : parsedRaw?.fieldConfidence['payDate']}>
              <Input type="date" value={form.payDate} onChange={e => setForm(f => f ? { ...f, payDate: e.target.value } : f)} />
            </ConfidenceField>
            <Field label="Period start">
              <Input type="date" value={form.periodStart} onChange={e => setForm(f => f ? { ...f, periodStart: e.target.value } : f)} />
            </Field>
            <Field label="Period end">
              <Input type="date" value={form.periodEnd} onChange={e => setForm(f => f ? { ...f, periodEnd: e.target.value } : f)} />
            </Field>
          </div>

          {/* Earnings */}
          <SectionLabel>Earnings <span style={{ fontWeight: 400, color: 'var(--text-muted)', textTransform: 'none', fontSize: 11, letterSpacing: 0 }}>(current period)</span></SectionLabel>
          <LineItemTable
            rows={form.earnings}
            onChange={(i, field, val) => updateEarning(i, field as keyof EditableEarning, val)}
            onAdd={() => setForm(f => f ? { ...f, earnings: [...f.earnings, { label: '', amount: '' }] } : f)}
            onRemove={i => setForm(f => f ? { ...f, earnings: f.earnings.filter((_, j) => j !== i) } : f)}
          />
          <div style={{ maxWidth: 220 }}>
            <ConfidenceField label="Gross Pay" confidence={form.grossPay ? (parsedRaw?.fieldConfidence['grossPay'] ?? 'high') : 'low'}>
              <Input type="number" min="0" step="0.01" placeholder="0.00" value={form.grossPay}
                onChange={e => setForm(f => f ? { ...f, grossPay: e.target.value } : f)} style={{ fontWeight: 700 }} />
            </ConfidenceField>
          </div>

          {/* Deductions */}
          <SectionLabel>Deductions <span style={{ fontWeight: 400, color: 'var(--text-muted)', textTransform: 'none', fontSize: 11, letterSpacing: 0 }}>(current period)</span></SectionLabel>
          <LineItemTable
            rows={form.deductions}
            onChange={(i, field, val) => updateDeduction(i, field as keyof EditableDeduction, val)}
            onAdd={() => setForm(f => f ? { ...f, deductions: [...f.deductions, { name: '', amount: '' }] } : f)}
            onRemove={i => setForm(f => f ? { ...f, deductions: f.deductions.filter((_, j) => j !== i) } : f)}
          />
          <div style={{ maxWidth: 220 }}>
            <Field label="Total Deductions">
              <Input type="number" min="0" step="0.01" placeholder="0.00" value={form.totalDeductions}
                onChange={e => setForm(f => f ? { ...f, totalDeductions: e.target.value } : f)} />
            </Field>
          </div>

          {/* Taxes */}
          <SectionLabel>Taxes Withheld <span style={{ fontWeight: 400, color: 'var(--text-muted)', textTransform: 'none', fontSize: 11, letterSpacing: 0 }}>(current period)</span></SectionLabel>
          <LineItemTable
            rows={form.taxes}
            onChange={(i, field, val) => updateTax(i, field as keyof EditableTax, val)}
            onAdd={() => setForm(f => f ? { ...f, taxes: [...f.taxes, { label: '', canonicalName: '', amount: '' }] } : f)}
            onRemove={i => setForm(f => f ? { ...f, taxes: f.taxes.filter((_, j) => j !== i) } : f)}
            showCanonical
          />
          <div style={{ maxWidth: 220 }}>
            <Field label="Total Taxes Withheld">
              <Input type="number" min="0" step="0.01" placeholder="0.00" value={form.totalTaxes}
                onChange={e => setForm(f => f ? { ...f, totalTaxes: e.target.value } : f)} />
            </Field>
          </div>

          {/* Reconciliation check */}
          {recon && (
            <div style={{ borderRadius: 8, border: `1px solid ${recon.ok ? GREEN : DANGER}`, background: recon.ok ? 'rgba(6,198,138,0.06)' : 'rgba(239,68,68,0.06)', padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: recon.ok ? 0 : 6 }}>
                {recon.ok
                  ? <CheckCircle size={14} color={GREEN} />
                  : <AlertTriangle size={14} color={DANGER} />}
                <span style={{ fontSize: 12, fontWeight: 700, color: recon.ok ? GREEN : DANGER }}>
                  {recon.ok ? 'Reconciled ✓' : 'Does not reconcile'}
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'monospace' }}>
                ${recon.gross.toFixed(2)} gross − ${recon.deds.toFixed(2)} deductions − ${recon.taxes.toFixed(2)} taxes = ${recon.computed.toFixed(2)}
                {!recon.ok && ` (net shows $${recon.net.toFixed(2)}, Δ $${recon.diff.toFixed(2)})`}
              </p>
            </div>
          )}

          {/* Net Pay */}
          <SectionLabel>Net Pay <span style={{ fontWeight: 400, color: 'var(--text-muted)', textTransform: 'none', fontSize: 11, letterSpacing: 0 }}>— becomes your confirmed take-home pay</span></SectionLabel>
          <div style={{ maxWidth: 220 }}>
            <ConfidenceField label="Net Pay (take-home)" confidence={form.netPay ? (parsedRaw?.fieldConfidence['netPay'] ?? 'high') : 'low'}>
              <Input type="number" min="0" step="0.01" placeholder="0.00" value={form.netPay}
                onChange={e => setForm(f => f ? { ...f, netPay: e.target.value } : f)}
                style={{ fontWeight: 700, fontSize: 16 }} />
            </ConfidenceField>
          </div>

          {/* PTO */}
          {(form.ptoAccrued || form.ptoUsed || form.ptoRemaining) && (
            <>
              <SectionLabel>PTO / Vacation Balance</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, maxWidth: 360 }}>
                <Field label="Accrued (hrs)"><Input type="number" min="0" step="0.01" value={form.ptoAccrued} onChange={e => setForm(f => f ? { ...f, ptoAccrued: e.target.value } : f)} /></Field>
                <Field label="Used (hrs)"><Input type="number" min="0" step="0.01" value={form.ptoUsed} onChange={e => setForm(f => f ? { ...f, ptoUsed: e.target.value } : f)} /></Field>
                <Field label="Remaining (hrs)"><Input type="number" min="0" step="0.01" value={form.ptoRemaining} onChange={e => setForm(f => f ? { ...f, ptoRemaining: e.target.value } : f)} /></Field>
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
            <Button onClick={confirmSave} disabled={saving || !form.netPay || parseFloat(form.netPay) <= 0}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {saving ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</> : <><CheckCircle size={14} /> Confirm &amp; set as take-home pay</>}
            </Button>
            <Button variant="secondary" onClick={() => setStep('upload')}>Re-upload</Button>
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
          </div>
        </div>
      )}

      {/* ── Done ───────────────────────────────────────────────────────────── */}
      {step === 'done' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '32px 0', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(6,198,138,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={28} color={GREEN} />
          </div>
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Paystub confirmed!</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Your take-home pay has been updated and the paystub saved to your history.</p>
          </div>
          <Button onClick={handleClose}>Done</Button>
        </div>
      )}
    </Modal>
  )
}
