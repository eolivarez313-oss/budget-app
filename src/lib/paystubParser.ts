// Paystub OCR text parser — label-based matching for all major payroll providers
// (ADP, Gusto, Paychex, QuickBooks Payroll, Workday, Rippling, etc.)

export interface ParsedDeduction {
  name: string
  current: number | null
  ytd: number | null
}

export type FieldConfidence = 'high' | 'medium' | 'low'

export interface ParsedPaystub {
  employerName?: string
  payDate?: string
  periodStart?: string
  periodEnd?: string
  rawText?: string
  grossPay?: number | null
  federalTax?: number | null
  stateTax?: number | null
  socialSecurity?: number | null
  medicare?: number | null
  netPay?: number | null
  ytdGross?: number | null
  ytdFederalTax?: number | null
  ytdStateTax?: number | null
  ytdSocialSecurity?: number | null
  ytdMedicare?: number | null
  ytdNet?: number | null
  preTaxDeductions: ParsedDeduction[]
  postTaxDeductions: ParsedDeduction[]
  ptoAccrued?: number | null
  ptoUsed?: number | null
  ptoRemaining?: number | null
  confidence: 'high' | 'medium' | 'low'
  /** Per-field extraction confidence — drives UI highlighting in review step */
  fieldConfidence: Record<string, FieldConfidence>
  warnings: string[]
}

// ── OCR noise normalization ───────────────────────────────────────────────────

/**
 * Normalize a text line for label-matching only (NOT for number extraction).
 * Handles common OCR substitutions: 0↔o, 1↔l/i, |↔l, rn↔m, etc.
 * Applied to a copy of the line — original is preserved for number extraction.
 */
function normalizeForLabel(s: string): string {
  return s
    // Common letter/digit swaps that appear in OCR output
    .replace(/0/g, 'o')
    .replace(/\|/g, 'l')
    .replace(/1(?=[a-z])/gi, 'l')     // 1 before a letter → l
    .replace(/(?<=[a-z])1/gi, 'l')    // 1 after a letter → l
    .replace(/\brn\b/g, 'm')          // "rn" split → m (e.g. "earn" misread as "earn")
    .replace(/vv/g, 'w')
    .replace(/5(?=[a-z])/gi, 's')     // 5 before letter → s
    .replace(/[^a-z0-9\s()\/.\-]/gi, ' ')  // strip other noise
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

// ── Number extraction ─────────────────────────────────────────────────────────

function extractNumbers(line: string): number[] {
  const cleaned = line
    .replace(/\$\s*/g, '')
    .replace(/[−–]/g, '-')
  const pattern = /(-?\(?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\)?)/g
  const results: number[] = []
  let m: RegExpExecArray | null
  while ((m = pattern.exec(cleaned)) !== null) {
    const raw = m[1]
    const isNeg = raw.startsWith('(') || raw.startsWith('-')
    const n = parseFloat(raw.replace(/[(),]/g, '').replace(/^-/, ''))
    if (!isNaN(n) && n >= 0) results.push(isNeg ? -n : n)
  }
  return results.filter(n => Math.abs(n) >= 1 || n === 0)
}

function extractPositiveAmounts(line: string): number[] {
  return extractNumbers(line).filter(n => n >= 0)
}

/** Extract amounts from a line plus the next N lines (handles split rows) */
function extractAmountsWithLookahead(lines: string[], idx: number, lookahead = 2): number[] {
  let combined = lines[idx]
  for (let k = 1; k <= lookahead && idx + k < lines.length; k++) {
    const next = lines[idx + k].trim()
    // Stop lookahead if next line looks like a label (mostly non-numeric)
    if (next && /[a-zA-Z]{4,}/.test(next) && extractPositiveAmounts(next).length === 0) break
    combined += ' ' + next
  }
  return extractPositiveAmounts(combined)
}

// ── Date extraction ───────────────────────────────────────────────────────────

function extractDate(text: string): string | undefined {
  const patterns = [
    /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/,
    /\b(\d{4})-(\d{2})-(\d{2})\b/,
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})[,\s]+(\d{4})\b/i,
  ]
  for (const p of patterns) {
    const m = text.match(p)
    if (m) {
      if (p === patterns[1]) return m[0]
      if (p === patterns[2]) {
        const months: Record<string, string> = {
          jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
          jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12',
        }
        const mo = months[m[1].toLowerCase().slice(0,3)] || '01'
        const day = m[2].padStart(2, '0')
        return `${m[3]}-${mo}-${day}`
      }
      return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`
    }
  }
  return undefined
}

// ── Label matchers ────────────────────────────────────────────────────────────

type MatchResult = { current: number | null; ytd: number | null }

function matchAmounts(nums: number[]): MatchResult {
  if (nums.length === 0) return { current: null, ytd: null }
  if (nums.length === 1) return { current: nums[0], ytd: null }
  return { current: nums[0], ytd: nums[nums.length - 1] }
}

/**
 * Test `line` (already normalized via normalizeForLabel) against patterns.
 * Returns 'direct' for an exact regex match, 'fuzzy' if match only on normalized
 * text, null if no match.
 */
function matchLabel(rawLine: string, normalizedLine: string, patterns: RegExp[]): 'direct' | 'fuzzy' | null {
  // Direct match on original line (case-insensitive)
  if (patterns.some(p => p.test(rawLine))) return 'direct'
  // Fuzzy match on OCR-normalized line
  if (patterns.some(p => p.test(normalizedLine))) return 'fuzzy'
  return null
}

// ── Pattern definitions (expanded synonym sets) ───────────────────────────────

const GROSS_PAY = [
  /\b(total\s+)?gross\s+(pay|wages|earnings|income|compensation)\b/i,
  /\bregular\s+(pay|earnings|wages)\b/i,
  /\btotal\s+earnings\b/i,
  /\bearnings\s*[-–:]\s*regular\b/i,
  /\bbase\s+(pay|salary|wage)\b/i,
  /\bsalary\s+(this\s+period|current)?\b/i,
  /\bhourly\s+(earnings|wages)\b/i,
  /\bcurrent\s+gross\b/i,
  /\bgross\s+this\s+period\b/i,
]

const FEDERAL_TAX = [
  /\bfederal\s+income\s+tax\b/i,
  /\bfed(eral)?\s+(income\s+)?tax\b/i,
  /\bfed(eral)?\s+w[./]?h\b/i,
  /\bfederal\s+withholding\b/i,
  /\bf\.?w\.?t\.?\b/i,
  /\bfit\b/i,
  /\bfed\s+inc\s+tax\b/i,
  /\bfederal\s+tax\s+withheld\b/i,
  /\bfederal\s+w\/h\b/i,
  /\bus\s+federal\s+tax\b/i,
]

const STATE_TAX = [
  /\bstate\s+income\s+tax\b/i,
  /\bstate\s+(tax|withholding|w[./]?h)\b/i,
  /\bsit\b/i,
  /\bstate\s+tax\s+withheld\b/i,
  /\bst\s+income\s+tax\b/i,
  /\bstate\s+w\/h\b/i,
  /\bprovincial\s+tax\b/i,
]

const SOCIAL_SECURITY = [
  /\bsocial\s+sec(urity)?\b/i,
  /\bsoc\.?\s*sec\.?\b/i,
  /\boasdi\b/i,
  /\bss\s+tax\b/i,
  /\bfica\s*[-–]\s*ss\b/i,
  /\bfica\s+social\b/i,
  /\bsocial\s+security\s+tax\b/i,
  /\bemp(loyee)?\s+oasdi\b/i,
  /\bss\s+w\/h\b/i,
]

const MEDICARE = [
  /\bmedicare\b/i,
  /\bmed(icare)?\s+tax\b/i,
  /\bfica\s*[-–]\s*med(icare)?\b/i,
  /\bfica\s+medicare\b/i,
  /\bemp(loyee)?\s+medicare\b/i,
  /\bmed\s+tax\b/i,
  /\bmed\s+w\/h\b/i,
]

const NET_PAY = [
  /\bnet\s+(pay|wages|earnings|income|amount|check)\b/i,
  /\btake[\s-]home\s*(pay)?\b/i,
  /\btotal\s+net\b/i,
  /\bcheck\s+amount\b/i,
  /\bnet\s+this\s+period\b/i,
  /\bdirect\s+deposit\s+amount\b/i,
  /\bnet\s+direct\s+deposit\b/i,
  /\bpayment\s+amount\b/i,
  /\bnet\s+pay\s+this\s+period\b/i,
  /\bamount\s+paid\b/i,
]

const PRE_TAX_PATTERNS = [
  { name: '401(k)', patterns: [/\b401\s*\(?k\)?(\s+traditional)?\b/i, /\bretirement\s+contribution\b/i, /\btraditional\s+401\b/i, /\bpre[\s-]tax\s+401\b/i] },
  { name: 'Health Insurance', patterns: [/\bhealth\s*(insurance|ins\.?|plan|premium|benefit|ded)?\b/i, /\bmedical\s*(insurance|ins\.?|plan|deduction|premium)?\b/i, /\bhealth\s+care\s+plan\b/i] },
  { name: 'Dental', patterns: [/\bdental\s*(insurance|ins\.?|plan|premium|ded)?\b/i] },
  { name: 'Vision', patterns: [/\bvision\s*(insurance|ins\.?|plan|premium|ded)?\b/i] },
  { name: 'HSA', patterns: [/\bhsa\b/i, /\bhealth\s+savings\s+account\b/i, /\bh\.s\.a\b/i] },
  { name: 'FSA', patterns: [/\bfsa\b/i, /\bflexible\s+spending\b/i, /\bflex(ible)?\s+(spend|account)\b/i] },
  { name: 'Life Insurance', patterns: [/\b(basic\s+)?life\s+ins(urance)?\b/i, /\bgtl\b/i, /\bgroup\s+term\s+life\b/i] },
  { name: 'Disability Insurance', patterns: [/\bshort[\s-]term\s+dis(ability)?\b/i, /\blong[\s-]term\s+dis(ability)?\b/i, /\b(std|ltd)\b/i] },
  { name: 'Commuter Benefit', patterns: [/\bcommuter\b/i, /\btransit\s*(benefit|pass)?\b/i, /\bparking\s+benefit\b/i] },
]

const POST_TAX_PATTERNS = [
  { name: 'Roth 401(k)', patterns: [/\broth\s*401\s*\(?k\)?\b/i, /\broth\s+contribution\b/i, /\bafter[\s-]tax\s+401\b/i] },
  { name: 'Roth IRA', patterns: [/\broth\s+ira\b/i] },
  { name: 'Child Support', patterns: [/\bchild\s+support\b/i] },
  { name: 'Wage Garnishment', patterns: [/\bgarnish(ment)?\b/i, /\bwage\s+(garnish|attach)\b/i] },
  { name: 'Union Dues', patterns: [/\bunion\s+dues\b/i] },
]

const PTO_ACCRUED = [/\b(pto|vacation|sick)\s*(accrued|earned|gained)\b/i, /\baccrued\s+(pto|vacation|time)\b/i, /\bhours?\s+accrued\b/i]
const PTO_USED    = [/\b(pto|vacation|sick)\s*(used|taken|paid)\b/i, /\bused\s+(pto|vacation|time)\b/i, /\bhours?\s+used\b/i]
const PTO_REM     = [/\b(pto|vacation|sick)\s*(remaining|balance|avail)\b/i, /\bremaining\s+(pto|vacation|time)\b/i, /\bpto\s+bal\b/i, /\bavailable\s+hours?\b/i]

// ── Employer name extraction ──────────────────────────────────────────────────

function extractEmployer(lines: string[]): string | undefined {
  for (const line of lines.slice(0, 10)) {
    const t = line.trim()
    if (!t) continue
    if (/^(employer|company|organization|department|pay\s*stub|earnings\s*statement)/i.test(t)) {
      const after = t.replace(/^[^:]+:\s*/i, '').trim()
      if (after.length > 1) return after
    }
    if (/inc\.?$|llc\.?$|corp\.?$|company$|co\.$|ltd\.?$/i.test(t) && !/\d/.test(t)) {
      return t
    }
    if (!/\d/.test(t) && /^[A-Z][a-zA-Z\s,.'&-]{4,60}$/.test(t) && t.split(/\s+/).length >= 2) {
      return t
    }
  }
  return undefined
}

// ── Main parser ───────────────────────────────────────────────────────────────

export function parsePaystubText(rawText: string): ParsedPaystub {
  const result: ParsedPaystub = {
    preTaxDeductions: [],
    postTaxDeductions: [],
    confidence: 'low',
    fieldConfidence: {},
    warnings: [],
  }

  if (!rawText || rawText.trim().length < 20) {
    result.warnings.push('No readable text was extracted — image may be too blurry or low-resolution.')
    return result
  }

  const lines = rawText.split(/\n|\r/).map(l => l.trim()).filter(Boolean)
  const normalizedLines = lines.map(normalizeForLabel)

  // ── Employer ────────────────────────────────────────────────────────────────
  result.employerName = extractEmployer(lines)

  // ── Dates ────────────────────────────────────────────────────────────────────
  for (const line of lines) {
    const lower = line.toLowerCase()
    if (/pay\s*date|check\s*date|payment\s*date/i.test(lower)) {
      const d = extractDate(line)
      if (d && !result.payDate) result.payDate = d
    }
    if (/period\s*(start|begin|from)|start\s*(date)?|begin\s*(date)?/i.test(lower)) {
      const d = extractDate(line)
      if (d && !result.periodStart) result.periodStart = d
    }
    if (/period\s*(end|to|through)|end\s*(date)?/i.test(lower)) {
      const d = extractDate(line)
      if (d && !result.periodEnd) result.periodEnd = d
    }
    if (/pay\s+period/i.test(lower)) {
      const dates = (line.match(/\d{1,2}\/\d{1,2}\/\d{4}/g) || [])
      if (dates.length >= 2) {
        if (!result.periodStart) result.periodStart = extractDate(dates[0] as string)
        if (!result.periodEnd) result.periodEnd = extractDate(dates[1] as string)
      }
      const isoDate = extractDate(line)
      if (isoDate && !result.payDate) result.payDate = isoDate
    }
  }

  // ── Scan each line for field matches ────────────────────────────────────────
  const usedPreTax = new Set<string>()
  const usedPostTax = new Set<string>()

  function setField(
    key: keyof ParsedPaystub,
    value: number,
    matchType: 'direct' | 'fuzzy'
  ) {
    ;(result as any)[key] = value
    result.fieldConfidence[key as string] = matchType === 'direct' ? 'high' : 'medium'
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const norm = normalizedLines[i]
    const nums = extractAmountsWithLookahead(lines, i, 2)
    const { current, ytd } = matchAmounts(nums)

    // ── Gross pay ──────────────────────────────────────────────────────────
    if (result.grossPay == null) {
      const m = matchLabel(line, norm, GROSS_PAY)
      if (m && current != null && current > 0) {
        setField('grossPay', current, m)
        if (ytd != null && ytd > current) setField('ytdGross', ytd, m)
      }
    }

    // ── Federal tax ────────────────────────────────────────────────────────
    if (result.federalTax == null) {
      const m = matchLabel(line, norm, FEDERAL_TAX)
      if (m && current != null) {
        setField('federalTax', current, m)
        if (ytd != null && ytd > current) setField('ytdFederalTax', ytd, m)
      }
    }

    // ── State tax ──────────────────────────────────────────────────────────
    if (result.stateTax == null) {
      const m = matchLabel(line, norm, STATE_TAX)
      if (m && current != null) {
        setField('stateTax', current, m)
        if (ytd != null && ytd > current) setField('ytdStateTax', ytd, m)
      }
    }

    // ── Social Security ────────────────────────────────────────────────────
    if (result.socialSecurity == null) {
      const m = matchLabel(line, norm, SOCIAL_SECURITY)
      if (m && current != null) {
        setField('socialSecurity', current, m)
        if (ytd != null && ytd > current) setField('ytdSocialSecurity', ytd, m)
      }
    }

    // ── Medicare ───────────────────────────────────────────────────────────
    if (result.medicare == null) {
      const m = matchLabel(line, norm, MEDICARE)
      if (m && current != null) {
        setField('medicare', current, m)
        if (ytd != null && ytd > current) setField('ytdMedicare', ytd, m)
      }
    }

    // ── Net pay ────────────────────────────────────────────────────────────
    if (result.netPay == null) {
      const m = matchLabel(line, norm, NET_PAY)
      if (m && current != null && current > 0) {
        setField('netPay', current, m)
        if (ytd != null && ytd > current) setField('ytdNet', ytd, m)
      }
    }

    // ── PTO ────────────────────────────────────────────────────────────────
    if (matchLabel(line, norm, PTO_ACCRUED) && nums[0] != null) result.ptoAccrued = nums[0]
    else if (matchLabel(line, norm, PTO_USED) && nums[0] != null) result.ptoUsed = nums[0]
    else if (matchLabel(line, norm, PTO_REM) && nums[0] != null) result.ptoRemaining = nums[0]

    // ── Pre-tax deductions ─────────────────────────────────────────────────
    for (const ded of PRE_TAX_PATTERNS) {
      if (!usedPreTax.has(ded.name) && matchLabel(line, norm, ded.patterns) && current != null && current > 0) {
        usedPreTax.add(ded.name)
        result.preTaxDeductions.push({ name: ded.name, current, ytd: ytd ?? null })
        break
      }
    }

    // ── Post-tax deductions ────────────────────────────────────────────────
    for (const ded of POST_TAX_PATTERNS) {
      if (!usedPostTax.has(ded.name) && matchLabel(line, norm, ded.patterns) && current != null && current > 0) {
        usedPostTax.add(ded.name)
        result.postTaxDeductions.push({ name: ded.name, current, ytd: ytd ?? null })
        break
      }
    }
  }

  // ── YTD fallback: dedicated YTD section ──────────────────────────────────
  if (!result.ytdGross || !result.ytdNet) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const norm = normalizedLines[i]
      if (/\bytd\b|\byear[\s-]to[\s-]date\b/i.test(line)) {
        const nums = extractAmountsWithLookahead(lines, i, 1)
        if (!result.ytdGross && matchLabel(line, norm, GROSS_PAY)) {
          result.ytdGross = nums[nums.length - 1] ?? null
          if (result.ytdGross) result.fieldConfidence['ytdGross'] = 'medium'
        }
        if (!result.ytdNet && matchLabel(line, norm, NET_PAY)) {
          result.ytdNet = nums[nums.length - 1] ?? null
          if (result.ytdNet) result.fieldConfidence['ytdNet'] = 'medium'
        }
      }
    }
  }

  // ── Employer fallback ─────────────────────────────────────────────────────
  if (!result.employerName) {
    for (const line of lines.slice(0, 5)) {
      if (/inc\.?$|llc\.?$|corp\.?$|company$|co\.$|ltd\.?$/i.test(line.trim())) {
        result.employerName = line.trim(); break
      }
    }
  }

  // ── Overall confidence scoring ────────────────────────────────────────────
  const coreFields = [result.grossPay, result.netPay].filter(v => v != null).length
  const taxFields = [result.federalTax, result.socialSecurity, result.medicare].filter(v => v != null).length
  if (coreFields === 2 && taxFields >= 2) result.confidence = 'high'
  else if (coreFields >= 1) result.confidence = 'medium'
  else result.confidence = 'low'

  // ── Warnings ──────────────────────────────────────────────────────────────
  if (result.confidence === 'low') {
    result.warnings.push('Could not identify key pay fields. The image may be unclear or in an unsupported format. Please review all fields manually.')
  }
  if (!result.payDate) {
    result.warnings.push('Pay date not found — please enter it manually.')
  }

  // Flag fields that were matched fuzzily (OCR noise was corrected)
  const fuzzyFields = Object.entries(result.fieldConfidence).filter(([, v]) => v === 'medium').map(([k]) => k)
  if (fuzzyFields.length > 0) {
    result.warnings.push(`Some fields used OCR-noise correction and may need verification: ${fuzzyFields.join(', ')}`)
  }

  return result
}

// ── Consistency check ─────────────────────────────────────────────────────────

export interface ConsistencyResult {
  ok: boolean
  computedNet: number
  difference: number
  message: string
}

export function checkConsistency(p: ParsedPaystub): ConsistencyResult | null {
  if (p.grossPay == null || p.netPay == null) return null
  const totalDeductions =
    (p.federalTax ?? 0) +
    (p.stateTax ?? 0) +
    (p.socialSecurity ?? 0) +
    (p.medicare ?? 0) +
    p.preTaxDeductions.reduce((s, d) => s + (d.current ?? 0), 0) +
    p.postTaxDeductions.reduce((s, d) => s + (d.current ?? 0), 0)

  if (totalDeductions === 0) return null

  const computedNet = p.grossPay - totalDeductions
  const difference = Math.abs(computedNet - p.netPay)
  const ok = difference <= 1.00

  return {
    ok,
    computedNet,
    difference,
    message: ok
      ? `Numbers reconcile (gross − deductions = $${computedNet.toFixed(2)}).`
      : `Gross (${fmt(p.grossPay)}) minus deductions (${fmt(totalDeductions)}) = ${fmt(computedNet)}, but net pay shows ${fmt(p.netPay)} — difference of ${fmt(difference)}. Please check for missing deductions or OCR errors.`,
  }
}

function fmt(n: number): string { return `$${n.toFixed(2)}` }
