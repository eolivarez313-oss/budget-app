// Paystub OCR text parser — label-based matching for all major payroll providers
// (ADP, Gusto, Paychex, QuickBooks Payroll, Workday, Rippling, etc.)

export interface ParsedDeduction {
  name: string
  current: number | null
  ytd: number | null
}

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
  warnings: string[]
}

// ── Number extraction ─────────────────────────────────────────────────────────

function extractNumbers(line: string): number[] {
  // Strip currency symbols, match amounts like 1,234.56 or 1234.56, possibly negative
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
  // Filter out noise: line numbers, dates (numbers < 4 digits that look like dates)
  return results.filter(n => Math.abs(n) >= 1 || n === 0)
}

function extractPositiveAmounts(line: string): number[] {
  return extractNumbers(line).filter(n => n >= 0)
}

// ── Date extraction ───────────────────────────────────────────────────────────

function extractDate(text: string): string | undefined {
  // Match MM/DD/YYYY, M/D/YYYY, YYYY-MM-DD, Month DD YYYY, etc.
  const patterns = [
    /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/,
    /\b(\d{4})-(\d{2})-(\d{2})\b/,
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})[,\s]+(\d{4})\b/i,
  ]
  for (const p of patterns) {
    const m = text.match(p)
    if (m) {
      if (p === patterns[1]) return m[0] // YYYY-MM-DD already ISO
      if (p === patterns[2]) {
        const months: Record<string, string> = {
          jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
          jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12',
        }
        const mo = months[m[1].toLowerCase().slice(0,3)] || '01'
        const day = m[2].padStart(2, '0')
        return `${m[3]}-${mo}-${day}`
      }
      // MM/DD/YYYY
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
  // Two or more: first = current period, last = YTD
  return { current: nums[0], ytd: nums[nums.length - 1] }
}

const GROSS_PAY = [
  /\b(total\s+)?gross\s+(pay|wages|earnings|income)\b/i,
  /\bregular\s+(pay|earnings)\b/i,
  /\btotal\s+earnings\b/i,
  /\bearnings\s*[-–]\s*regular\b/i,
]

const FEDERAL_TAX = [
  /\bfederal\s+income\s+tax\b/i,
  /\bfed(eral)?\s+(income\s+)?tax\b/i,
  /\bfed(eral)?\s+w[./]?h\b/i,
  /\bfederal\s+withholding\b/i,
  /\bf\.?w\.?t\.?\b/i,
  /\bfit\b/i,
]

const STATE_TAX = [
  /\bstate\s+income\s+tax\b/i,
  /\bstate\s+(tax|withholding|w[./]?h)\b/i,
  /\bsit\b/i,
]

const SOCIAL_SECURITY = [
  /\bsocial\s+sec(urity)?\b/i,
  /\bsoc\.?\s*sec\.?\b/i,
  /\boasdi\b/i,
  /\bss\s+tax\b/i,
  /\bfica\s*[-–]\s*ss\b/i,
  /\bfica\s+social\b/i,
]

const MEDICARE = [
  /\bmedicare\b/i,
  /\bmed(icare)?\s+tax\b/i,
  /\bfica\s*[-–]\s*med(icare)?\b/i,
  /\bfica\s+medicare\b/i,
]

const NET_PAY = [
  /\bnet\s+(pay|wages|earnings|income)\b/i,
  /\btake[\s-]home\s*(pay)?\b/i,
  /\btotal\s+net\b/i,
  /\bcheck\s+amount\b/i,
  /\bnet\s+this\s+period\b/i,
]

// Pre-tax deduction patterns — returns {name, patterns}
const PRE_TAX_PATTERNS = [
  { name: '401(k)', patterns: [/\b401\s*\(?k\)?(\s+traditional)?\b/i, /\bretirement\s+contribution\b/i, /\btraditional\s+401\b/i] },
  { name: 'Health Insurance', patterns: [/\bhealth\s*(insurance|ins\.?|plan|premium|benefit)?\b/i, /\bmedical\s*(insurance|ins\.?|plan|deduction)?\b/i] },
  { name: 'Dental', patterns: [/\bdental\s*(insurance|ins\.?|plan|premium)?\b/i] },
  { name: 'Vision', patterns: [/\bvision\s*(insurance|ins\.?|plan|premium)?\b/i] },
  { name: 'HSA', patterns: [/\bhsa\b/i, /\bhealth\s+savings\s+account\b/i] },
  { name: 'FSA', patterns: [/\bfsa\b/i, /\bflexible\s+spending\b/i, /\bflex(ible)?\s+account\b/i] },
  { name: 'Life Insurance', patterns: [/\b(basic\s+)?life\s+ins(urance)?\b/i, /\bgtl\b/i] },
  { name: 'Disability Insurance', patterns: [/\bshort[\s-]term\s+dis(ability)?\b/i, /\blong[\s-]term\s+dis(ability)?\b/i, /\b(std|ltd)\s+(dis)?\b/i] },
  { name: 'Commuter Benefit', patterns: [/\bcommuter\b/i, /\btransit\b/i, /\bparking\s+benefit\b/i] },
]

const POST_TAX_PATTERNS = [
  { name: 'Roth 401(k)', patterns: [/\broth\s*401\s*\(?k\)?\b/i, /\broth\s+contribution\b/i] },
  { name: 'Roth IRA', patterns: [/\broth\s+ira\b/i] },
  { name: 'Child Support', patterns: [/\bchild\s+support\b/i] },
  { name: 'Wage Garnishment', patterns: [/\bgarnish(ment)?\b/i, /\bwage\s+(garnish|attach)\b/i] },
  { name: 'Union Dues', patterns: [/\bunion\s+dues\b/i] },
]

const PTO_ACCRUED = [/\b(pto|vacation|sick)\s*(accrued|earned|gained)\b/i, /\baccrued\s+(pto|vacation|time)\b/i]
const PTO_USED    = [/\b(pto|vacation|sick)\s*(used|taken|paid)\b/i, /\bused\s+(pto|vacation|time)\b/i]
const PTO_REM     = [/\b(pto|vacation|sick)\s*(remaining|balance|avail)\b/i, /\bremaining\s+(pto|vacation|time)\b/i, /\bpto\s+bal\b/i]

function matches(line: string, patterns: RegExp[]): boolean {
  return patterns.some(p => p.test(line))
}

// ── Employer name extraction ──────────────────────────────────────────────────

function extractEmployer(lines: string[]): string | undefined {
  // Look for "Employer:", "Company:", or the first non-numeric, non-date non-empty line
  for (const line of lines.slice(0, 8)) {
    const t = line.trim()
    if (!t) continue
    if (/^(employer|company|organization|department|pay\s*stub|earnings\s*statement)/i.test(t)) {
      const after = t.replace(/^[^:]+:\s*/i, '').trim()
      if (after.length > 1) return after
    }
    // Heuristic: line of title-cased words, no numbers, 2+ words
    if (!/\d/.test(t) && /^[A-Z][a-zA-Z\s,.'&-]{4,50}$/.test(t) && t.split(/\s+/).length >= 2) {
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
    warnings: [],
  }

  if (!rawText || rawText.trim().length < 20) {
    result.warnings.push('No readable text was extracted — image may be too blurry or low-resolution.')
    return result
  }

  const lines = rawText.split(/\n|\r/).map(l => l.trim()).filter(Boolean)
  const fullText = rawText.toLowerCase()

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
    // "Pay Period: MM/DD/YYYY - MM/DD/YYYY" format
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

  for (const line of lines) {
    const lower = line.toLowerCase()
    const nums = extractPositiveAmounts(line)
    const { current, ytd } = matchAmounts(nums)

    // Gross pay
    if (result.grossPay == null && matches(lower, GROSS_PAY)) {
      if (current != null && current > 0) {
        result.grossPay = current
        if (ytd != null && ytd > 0) result.ytdGross = ytd
      }
      continue
    }

    // Federal tax
    if (result.federalTax == null && matches(lower, FEDERAL_TAX)) {
      if (current != null) {
        result.federalTax = current
        if (ytd != null) result.ytdFederalTax = ytd
      }
      continue
    }

    // State tax
    if (result.stateTax == null && matches(lower, STATE_TAX)) {
      if (current != null) {
        result.stateTax = current
        if (ytd != null) result.ytdStateTax = ytd
      }
      continue
    }

    // Social Security
    if (result.socialSecurity == null && matches(lower, SOCIAL_SECURITY)) {
      if (current != null) {
        result.socialSecurity = current
        if (ytd != null) result.ytdSocialSecurity = ytd
      }
      continue
    }

    // Medicare
    if (result.medicare == null && matches(lower, MEDICARE)) {
      if (current != null) {
        result.medicare = current
        if (ytd != null) result.ytdMedicare = ytd
      }
      continue
    }

    // Net pay
    if (result.netPay == null && matches(lower, NET_PAY)) {
      if (current != null && current > 0) {
        result.netPay = current
        if (ytd != null && ytd > 0) result.ytdNet = ytd
      }
      continue
    }

    // PTO
    if (matches(lower, PTO_ACCRUED)) {
      const n = nums[0]; if (n != null) result.ptoAccrued = n
    } else if (matches(lower, PTO_USED)) {
      const n = nums[0]; if (n != null) result.ptoUsed = n
    } else if (matches(lower, PTO_REM)) {
      const n = nums[0]; if (n != null) result.ptoRemaining = n
    }

    // Pre-tax deductions
    for (const ded of PRE_TAX_PATTERNS) {
      if (!usedPreTax.has(ded.name) && matches(lower, ded.patterns)) {
        if (current != null && current > 0) {
          usedPreTax.add(ded.name)
          result.preTaxDeductions.push({ name: ded.name, current, ytd: ytd ?? null })
        }
        break
      }
    }

    // Post-tax deductions
    for (const ded of POST_TAX_PATTERNS) {
      if (!usedPostTax.has(ded.name) && matches(lower, ded.patterns)) {
        if (current != null && current > 0) {
          usedPostTax.add(ded.name)
          result.postTaxDeductions.push({ name: ded.name, current, ytd: ytd ?? null })
        }
        break
      }
    }
  }

  // ── YTD fallback: sometimes YTD gross/net appear in a dedicated section ──────
  if (!result.ytdGross || !result.ytdNet) {
    for (const line of lines) {
      const lower = line.toLowerCase()
      if (/\bytd\b|\byear[\s-]to[\s-]date\b/i.test(lower)) {
        const nums = extractPositiveAmounts(line)
        if (nums.length >= 2) {
          if (!result.ytdGross && matches(lower, GROSS_PAY)) result.ytdGross = nums[nums.length - 1]
          if (!result.ytdNet && matches(lower, NET_PAY)) result.ytdNet = nums[nums.length - 1]
        }
      }
    }
  }

  // ── Employer fallback: look for company name near top of text ──────────────
  if (!result.employerName) {
    // Try to find a company-sounding proper noun in first 5 non-empty lines
    for (const line of lines.slice(0, 5)) {
      if (/inc\.?$|llc\.?$|corp\.?$|company$|co\.$|ltd\.?$/i.test(line.trim())) {
        result.employerName = line.trim(); break
      }
    }
  }

  // ── Confidence scoring ──────────────────────────────────────────────────────
  const coreFields = [result.grossPay, result.netPay].filter(v => v != null).length
  const taxFields = [result.federalTax, result.socialSecurity, result.medicare].filter(v => v != null).length
  if (coreFields === 2 && taxFields >= 2) result.confidence = 'high'
  else if (coreFields >= 1) result.confidence = 'medium'
  else result.confidence = 'low'

  // ── Warnings ─────────────────────────────────────────────────────────────────
  if (result.confidence === 'low') {
    result.warnings.push('Could not identify key pay fields. The image may be unclear or in an unsupported format. Please review all fields manually.')
  }
  if (!result.payDate) {
    result.warnings.push('Pay date not found — please enter it manually.')
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

  if (totalDeductions === 0) return null // not enough data for check

  const computedNet = p.grossPay - totalDeductions
  const difference = Math.abs(computedNet - p.netPay)
  const ok = difference <= 1.00 // allow $1 rounding

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
