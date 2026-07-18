import { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react'
import { Upload, X, Plus, AlertTriangle, CheckCircle, ChevronRight, Loader2, FileImage, Info } from 'lucide-react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Input, Field } from './ui/Input'
import { parsePaystubText, checkConsistency, ParsedPaystub } from '../lib/paystubParser'
import { savePaystub } from '../lib/paystubDb'
import { Paystub, PaystubDeduction } from '../types'
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

interface EditablePaystub {
  employerName: string
  payDate: string
  periodStart: string
  periodEnd: string
  grossPay: string
  federalTax: string
  stateTax: string
  socialSecurity: string
  medicare: string
  netPay: string
  ytdGross: string
  ytdFederalTax: string
  ytdStateTax: string
  ytdSocialSecurity: string
  ytdMedicare: string
  ytdNet: string
  preTaxDeductions: { name: string; current: string; ytd: string }[]
  postTaxDeductions: { name: string; current: string; ytd: string }[]
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
    grossPay: n(p.grossPay),
    federalTax: n(p.federalTax),
    stateTax: n(p.stateTax),
    socialSecurity: n(p.socialSecurity),
    medicare: n(p.medicare),
    netPay: n(p.netPay),
    ytdGross: n(p.ytdGross),
    ytdFederalTax: n(p.ytdFederalTax),
    ytdStateTax: n(p.ytdStateTax),
    ytdSocialSecurity: n(p.ytdSocialSecurity),
    ytdMedicare: n(p.ytdMedicare),
    ytdNet: n(p.ytdNet),
    preTaxDeductions: p.preTaxDeductions.map(d => ({ name: d.name, current: n(d.current), ytd: n(d.ytd) })),
    postTaxDeductions: p.postTaxDeductions.map(d => ({ name: d.name, current: n(d.current), ytd: n(d.ytd) })),
    ptoAccrued: n(p.ptoAccrued),
    ptoUsed: n(p.ptoUsed),
    ptoRemaining: n(p.ptoRemaining),
  }
}

function fromEditable(e: EditablePaystub): Paystub {
  const n = (s: string) => s.trim() ? parseFloat(s.replace(/,/g, '')) || null : null
  return {
    id: uuid(),
    employerName: e.employerName.trim() || undefined,
    payDate: e.payDate.trim() || undefined,
    periodStart: e.periodStart.trim() || undefined,
    periodEnd: e.periodEnd.trim() || undefined,
    grossPay: n(e.grossPay),
    federalTax: n(e.federalTax),
    stateTax: n(e.stateTax),
    socialSecurity: n(e.socialSecurity),
    medicare: n(e.medicare),
    netPay: n(e.netPay),
    ytdGross: n(e.ytdGross),
    ytdFederalTax: n(e.ytdFederalTax),
    ytdStateTax: n(e.ytdStateTax),
    ytdSocialSecurity: n(e.ytdSocialSecurity),
    ytdMedicare: n(e.ytdMedicare),
    ytdNet: n(e.ytdNet),
    preTaxDeductions: e.preTaxDeductions
      .filter(d => d.name && (d.current || d.ytd))
      .map(d => ({ name: d.name, current: n(d.current), ytd: n(d.ytd) } as PaystubDeduction)),
    postTaxDeductions: e.postTaxDeductions
      .filter(d => d.name && (d.current || d.ytd))
      .map(d => ({ name: d.name, current: n(d.current), ytd: n(d.ytd) } as PaystubDeduction)),
    ptoAccrued: n(e.ptoAccrued),
    ptoUsed: n(e.ptoUsed),
    ptoRemaining: n(e.ptoRemaining),
    isConfirmed: true,
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DeductionRows({
  deductions,
  onChange,
  onAdd,
  onRemove,
}: {
  deductions: { name: string; current: string; ytd: string }[]
  onChange: (i: number, field: 'name' | 'current' | 'ytd', val: string) => void
  onAdd: () => void
  onRemove: (i: number) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {deductions.map((d, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px 28px', gap: 6, alignItems: 'center' }}>
          <Input
            placeholder="Name (e.g. 401(k))"
            value={d.name}
            onChange={e => onChange(i, 'name', e.target.value)}
          />
          <Input
            type="number" min="0" step="0.01" placeholder="Current"
            value={d.current}
            onChange={e => onChange(i, 'current', e.target.value)}
          />
          <Input
            type="number" min="0" step="0.01" placeholder="YTD"
            value={d.ytd}
            onChange={e => onChange(i, 'ytd', e.target.value)}
          />
          <button
            type="button"
            onClick={() => onRemove(i)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
            <X size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        style={{
          background: 'none', border: '1px dashed var(--border)', borderRadius: 6,
          padding: '5px 10px', cursor: 'pointer', fontSize: 11, color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', gap: 4, width: 'fit-content',
        }}>
        <Plus size={11} /> Add row
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function PaystubUpload({ open, onClose, userId, existingPaystubs, onConfirmed }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [ocrStatus, setOcrStatus] = useState('')
  const [parsedRaw, setParsedRaw] = useState<ParsedPaystub | null>(null)
  const [form, setForm] = useState<EditablePaystub | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deductionAlerts, setDeductionAlerts] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setStep('upload'); setImageFiles([]); setImagePreviews([])
    setOcrProgress(0); setOcrStatus(''); setParsedRaw(null); setForm(null)
    setSaving(false); setError(null); setDeductionAlerts([])
  }

  function handleClose() { reset(); onClose() }

  function addFiles(files: File[]) {
    const imgs = files.filter(f => f.type.startsWith('image/'))
    if (!imgs.length) { setError('Please upload image files (PNG, JPG, WEBP).'); return }
    const oversized = imgs.filter(f => f.size > 15 * 1024 * 1024)
    if (oversized.length) { setError('One or more images exceed 15 MB. Please use a smaller file.'); return }
    setError(null)
    setImageFiles(prev => [...prev, ...imgs])
    imgs.forEach(f => {
      const url = URL.createObjectURL(f)
      setImagePreviews(prev => [...prev, url])
    })
  }

  function handleFileInput(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault(); setIsDragging(false)
    addFiles(Array.from(e.dataTransfer.files))
  }

  function removeImage(i: number) {
    URL.revokeObjectURL(imagePreviews[i])
    setImageFiles(prev => prev.filter((_, j) => j !== i))
    setImagePreviews(prev => prev.filter((_, j) => j !== i))
  }

  async function runOCR() {
    if (!imageFiles.length) { setError('Please add at least one image.'); return }
    setStep('processing'); setOcrProgress(0); setOcrStatus('Loading OCR engine…')

    try {
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('eng', 1, {
        logger: (m: { status: string; progress: number }) => {
          setOcrStatus(m.status)
          setOcrProgress(Math.round((m.progress || 0) * 100))
        },
      })

      let combinedText = ''
      for (let i = 0; i < imageFiles.length; i++) {
        setOcrStatus(`Reading page ${i + 1} of ${imageFiles.length}…`)
        const { data } = await worker.recognize(imageFiles[i])
        combinedText += (i > 0 ? '\n---PAGE BREAK---\n' : '') + data.text
      }
      await worker.terminate()

      const parsed = parsePaystubText(combinedText)
      parsed.rawText = combinedText
      setParsedRaw(parsed)
      setForm(toEditable(parsed))

      // Check for deduction changes vs most recent prior paystub
      if (existingPaystubs.length > 0) {
        const prior = existingPaystubs[0]
        const alerts: string[] = []
        const checkDed = (
          newDeds: typeof parsed.preTaxDeductions,
          oldDeds: PaystubDeduction[],
          label: string
        ) => {
          for (const nd of newDeds) {
            const od = oldDeds.find(d => d.name.toLowerCase() === nd.name.toLowerCase())
            if (!od && nd.current) {
              alerts.push(`New ${label} deduction detected: ${nd.name} (${fmt(nd.current)})`)
            } else if (od && nd.current && od.current && Math.abs(nd.current - od.current) >= 1) {
              const dir = nd.current > od.current ? 'increased' : 'decreased'
              alerts.push(`${nd.name} ${dir} by ${fmt(Math.abs(nd.current - od.current))} (was ${fmt(od.current)}, now ${fmt(nd.current)})`)
            }
          }
        }
        checkDed(parsed.preTaxDeductions, prior.preTaxDeductions, 'pre-tax')
        checkDed(parsed.postTaxDeductions, prior.postTaxDeductions, 'post-tax')
        setDeductionAlerts(alerts)
      }

      setStep('review')
    } catch (err) {
      setError(`OCR failed: ${err instanceof Error ? err.message : String(err)}`)
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

  function setField(field: keyof EditablePaystub, value: string) {
    setForm(f => f ? { ...f, [field]: value } : f)
  }

  // Consistency check on current form values
  const consistencyCheck = form ? checkConsistency({
    ...parsedRaw!,
    grossPay: parseFloat(form.grossPay) || null,
    federalTax: parseFloat(form.federalTax) || null,
    stateTax: parseFloat(form.stateTax) || null,
    socialSecurity: parseFloat(form.socialSecurity) || null,
    medicare: parseFloat(form.medicare) || null,
    netPay: parseFloat(form.netPay) || null,
    preTaxDeductions: form.preTaxDeductions.map(d => ({ name: d.name, current: parseFloat(d.current) || null, ytd: parseFloat(d.ytd) || null })),
    postTaxDeductions: form.postTaxDeductions.map(d => ({ name: d.name, current: parseFloat(d.current) || null, ytd: parseFloat(d.ytd) || null })),
  }) : null

  // YTD consistency: new ytdGross >= prior ytdGross?
  const ytdWarning = (() => {
    if (!form?.ytdGross || !existingPaystubs.length) return null
    const newYtd = parseFloat(form.ytdGross)
    const priorYtd = existingPaystubs.find(p => p.ytdGross != null)?.ytdGross
    if (priorYtd && newYtd < priorYtd) {
      return `YTD gross ($${newYtd.toFixed(2)}) is less than prior upload ($${priorYtd.toFixed(2)}) — possible misread.`
    }
    return null
  })()

  return (
    <Modal open={open} onClose={handleClose} title="Upload Paystub" size="lg">
      {error && (
        <div style={{ background: 'var(--danger-dim)', border: `1px solid ${DANGER}`, borderRadius: 8, padding: '10px 14px', marginBottom: 14, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <AlertTriangle size={14} color={DANGER} style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontSize: 13, color: DANGER }}>{error}</span>
        </div>
      )}

      {/* ── Step: Upload ───────────────────────────────────────────────────── */}
      {step === 'upload' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Upload a photo or screenshot of your paystub. Add multiple images if your paystub spans more than one page.
          </p>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${isDragging ? GREEN : 'var(--border)'}`,
              borderRadius: 12, padding: '32px 24px', textAlign: 'center', cursor: 'pointer',
              background: isDragging ? 'rgba(6,198,138,0.05)' : 'var(--surface)',
              transition: 'all 0.15s',
            }}>
            <Upload size={28} color={isDragging ? GREEN : 'var(--text-muted)'} style={{ margin: '0 auto 10px' }} />
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
              Drop paystub image here, or click to browse
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>PNG, JPG, WEBP · up to 15 MB per image</p>
            <input
              ref={fileInputRef} type="file" accept="image/*" multiple hidden
              onChange={handleFileInput}
            />
          </div>

          {/* Image previews */}
          {imagePreviews.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {imagePreviews.map((url, i) => (
                <div key={i} style={{ position: 'relative', width: 100, height: 130, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <img src={url} alt={`Page ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', top: 4, right: 4 }}>
                    <button onClick={e => { e.stopPropagation(); removeImage(i) }}
                      style={{ background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <X size={11} color="#fff" />
                    </button>
                  </div>
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)', padding: '3px 6px' }}>
                    <span style={{ fontSize: 10, color: '#fff' }}>Page {i + 1}</span>
                  </div>
                </div>
              ))}
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: 100, height: 130, borderRadius: 8, border: '1px dashed var(--border)',
                  background: 'var(--surface)', cursor: 'pointer', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--text-muted)',
                }}>
                <Plus size={18} />
                <span style={{ fontSize: 10 }}>Add page</span>
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <Button onClick={runOCR} disabled={!imageFiles.length} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Extract paystub data <ChevronRight size={14} />
            </Button>
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
          </div>
        </div>
      )}

      {/* ── Step: Processing ───────────────────────────────────────────────── */}
      {step === 'processing' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '32px 0' }}>
          <Loader2 size={36} color={GREEN} style={{ animation: 'spin 1s linear infinite' }} />
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Reading your paystub…</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ocrStatus}</p>
          </div>
          <div style={{ width: '100%', maxWidth: 320, background: 'var(--border)', borderRadius: 99, height: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: GREEN, borderRadius: 99, width: `${ocrProgress}%`, transition: 'width 0.3s' }} />
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ocrProgress}%</p>
        </div>
      )}

      {/* ── Step: Review ───────────────────────────────────────────────────── */}
      {step === 'review' && form && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Confidence banner */}
          {parsedRaw && (
            <div style={{
              display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 14px', borderRadius: 8,
              background: parsedRaw.confidence === 'high' ? 'rgba(6,198,138,0.08)' : parsedRaw.confidence === 'medium' ? `rgba(245,158,11,0.08)` : 'rgba(239,68,68,0.08)',
              border: `1px solid ${parsedRaw.confidence === 'high' ? GREEN : parsedRaw.confidence === 'medium' ? WARN : DANGER}`,
            }}>
              <Info size={14} color={parsedRaw.confidence === 'high' ? GREEN : parsedRaw.confidence === 'medium' ? WARN : DANGER} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12 }}>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                  {parsedRaw.confidence === 'high' ? 'Good extraction' : parsedRaw.confidence === 'medium' ? 'Partial extraction' : 'Low confidence'}
                </span>
                {' — '}
                <span style={{ color: 'var(--text-muted)' }}>
                  {parsedRaw.confidence === 'high'
                    ? 'Key fields were identified. Review everything before confirming.'
                    : parsedRaw.confidence === 'medium'
                    ? 'Some fields found. Please fill in any missing values manually.'
                    : 'Few fields identified. Please enter all values manually.'}
                </span>
                {parsedRaw.warnings.map((w, i) => (
                  <p key={i} style={{ marginTop: 4, color: WARN }}>{w}</p>
                ))}
              </div>
            </div>
          )}

          {/* Deduction change alerts */}
          {deductionAlerts.length > 0 && (
            <div style={{ background: `rgba(245,158,11,0.08)`, border: `1px solid ${WARN}`, borderRadius: 8, padding: '10px 14px' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: WARN, marginBottom: 6 }}>⚠ Deduction changes detected vs. your last paystub:</p>
              {deductionAlerts.map((a, i) => (
                <p key={i} style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>• {a}</p>
              ))}
            </div>
          )}

          {/* Consistency check */}
          {consistencyCheck && !consistencyCheck.ok && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: `1px solid ${DANGER}`, borderRadius: 8, padding: '10px 14px' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: DANGER, marginBottom: 4 }}>Numbers don't reconcile</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{consistencyCheck.message}</p>
            </div>
          )}

          {/* YTD warning */}
          {ytdWarning && (
            <div style={{ background: `rgba(245,158,11,0.08)`, border: `1px solid ${WARN}`, borderRadius: 8, padding: '10px 14px' }}>
              <p style={{ fontSize: 12, color: WARN }}>⚠ {ytdWarning}</p>
            </div>
          )}

          {/* ── Fields ────────────────────────────────────────────────────── */}
          <SectionLabel>Employer & Dates</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px 140px', gap: 10 }}>
            <Field label="Employer name">
              <Input value={form.employerName} onChange={e => setField('employerName', e.target.value)} placeholder="e.g. Acme Corp" />
            </Field>
            <Field label="Pay date">
              <Input type="date" value={form.payDate} onChange={e => setField('payDate', e.target.value)} />
            </Field>
            <Field label="Period start">
              <Input type="date" value={form.periodStart} onChange={e => setField('periodStart', e.target.value)} />
            </Field>
            <Field label="Period end">
              <Input type="date" value={form.periodEnd} onChange={e => setField('periodEnd', e.target.value)} />
            </Field>
          </div>

          <SectionLabel>Current Period — Core Pay</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            {[
              { label: 'Gross pay', key: 'grossPay' },
              { label: 'Federal tax', key: 'federalTax' },
              { label: 'State tax', key: 'stateTax' },
              { label: 'Social Security', key: 'socialSecurity' },
              { label: 'Medicare', key: 'medicare' },
            ].map(({ label, key }) => (
              <Field key={key} label={label}>
                <Input type="number" min="0" step="0.01" placeholder="0.00"
                  value={(form as any)[key]}
                  onChange={e => setField(key as keyof EditablePaystub, e.target.value)} />
              </Field>
            ))}
          </div>

          <SectionLabel>
            Net Pay <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>— this becomes your confirmed take-home pay</span>
          </SectionLabel>
          <div style={{ maxWidth: 200 }}>
            <Field label="Net pay (take-home)">
              <Input
                type="number" min="0" step="0.01" placeholder="0.00"
                value={form.netPay}
                onChange={e => setField('netPay', e.target.value)}
                style={{ fontWeight: 700, fontSize: 16 }}
              />
            </Field>
          </div>
          {consistencyCheck?.ok && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: -8 }}>
              <CheckCircle size={13} color={GREEN} />
              <span style={{ fontSize: 12, color: GREEN }}>{consistencyCheck.message}</span>
            </div>
          )}

          <SectionLabel>Year-to-Date (YTD)</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            {[
              { label: 'YTD Gross', key: 'ytdGross' },
              { label: 'YTD Federal', key: 'ytdFederalTax' },
              { label: 'YTD State', key: 'ytdStateTax' },
              { label: 'YTD Soc. Sec.', key: 'ytdSocialSecurity' },
              { label: 'YTD Medicare', key: 'ytdMedicare' },
            ].map(({ label, key }) => (
              <Field key={key} label={label}>
                <Input type="number" min="0" step="0.01" placeholder="0.00"
                  value={(form as any)[key]}
                  onChange={e => setField(key as keyof EditablePaystub, e.target.value)} />
              </Field>
            ))}
          </div>
          <div style={{ maxWidth: 200 }}>
            <Field label="YTD Net Pay">
              <Input type="number" min="0" step="0.01" placeholder="0.00"
                value={form.ytdNet} onChange={e => setField('ytdNet', e.target.value)} />
            </Field>
          </div>

          <SectionLabel>Pre-Tax Deductions</SectionLabel>
          <ColHeaders />
          <DeductionRows
            deductions={form.preTaxDeductions}
            onChange={(i, field, val) =>
              setForm(f => f ? { ...f, preTaxDeductions: f.preTaxDeductions.map((d, j) => j === i ? { ...d, [field]: val } : d) } : f)}
            onAdd={() => setForm(f => f ? { ...f, preTaxDeductions: [...f.preTaxDeductions, { name: '', current: '', ytd: '' }] } : f)}
            onRemove={i => setForm(f => f ? { ...f, preTaxDeductions: f.preTaxDeductions.filter((_, j) => j !== i) } : f)}
          />

          <SectionLabel>Post-Tax Deductions</SectionLabel>
          <ColHeaders />
          <DeductionRows
            deductions={form.postTaxDeductions}
            onChange={(i, field, val) =>
              setForm(f => f ? { ...f, postTaxDeductions: f.postTaxDeductions.map((d, j) => j === i ? { ...d, [field]: val } : d) } : f)}
            onAdd={() => setForm(f => f ? { ...f, postTaxDeductions: [...f.postTaxDeductions, { name: '', current: '', ytd: '' }] } : f)}
            onRemove={i => setForm(f => f ? { ...f, postTaxDeductions: f.postTaxDeductions.filter((_, j) => j !== i) } : f)}
          />

          {/* PTO (optional) */}
          {(form.ptoAccrued || form.ptoUsed || form.ptoRemaining) ? (
            <>
              <SectionLabel>PTO / Vacation Balance</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, maxWidth: 360 }}>
                <Field label="Accrued (hrs)">
                  <Input type="number" min="0" step="0.01" value={form.ptoAccrued} onChange={e => setField('ptoAccrued', e.target.value)} />
                </Field>
                <Field label="Used (hrs)">
                  <Input type="number" min="0" step="0.01" value={form.ptoUsed} onChange={e => setField('ptoUsed', e.target.value)} />
                </Field>
                <Field label="Remaining (hrs)">
                  <Input type="number" min="0" step="0.01" value={form.ptoRemaining} onChange={e => setField('ptoRemaining', e.target.value)} />
                </Field>
              </div>
            </>
          ) : null}

          <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
            <Button
              onClick={confirmSave}
              disabled={saving || !form.netPay || parseFloat(form.netPay) <= 0}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {saving ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</> : <><CheckCircle size={14} /> Confirm &amp; set as take-home pay</>}
            </Button>
            <Button variant="secondary" onClick={() => setStep('upload')}>Re-upload</Button>
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
          </div>
        </div>
      )}

      {/* ── Step: Done ─────────────────────────────────────────────────────── */}
      {step === 'done' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '32px 0', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(6,198,138,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={28} color={GREEN} />
          </div>
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Paystub confirmed!</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Your take-home pay has been updated and the paystub saved to your history.
            </p>
          </div>
          <Button onClick={handleClose}>Done</Button>
        </div>
      )}
    </Modal>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: -6 }}>
      {children}
    </p>
  )
}

function ColHeaders() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px 28px', gap: 6 }}>
      {['Name', 'Current period', 'YTD', ''].map(h => (
        <span key={h} style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
      ))}
    </div>
  )
}

function fmt(n: number): string { return `$${n.toFixed(2)}` }
