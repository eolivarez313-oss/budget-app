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

// ── Levenshtein edit distance ─────────────────────────────────────────────────
//
// Used for fuzzy label matching: catches OCR misreads that the character-
// substitution normalization misses (e.g. "Federai" instead of "Federal").
//
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length > b.length) { const t = a; a = b; b = t }  // ensure a is shorter
  const prev = Array.from({ length: a.length + 1 }, (_, i) => i)
  for (let j = 1; j <= b.length; j++) {
    let cur = j
    for (let i = 1; i <= a.length; i++) {
      const temp = prev[i - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      prev[i - 1] = cur
      cur = Math.min(prev[i] + 1, cur + 1, temp)
    }
    prev[a.length] = cur
  }
  return prev[a.length]
}

// Normalised distance 0..1 (lower = more similar)
function editSim(a: string, b: string): number {
  const dist = levenshtein(a.toLowerCase(), b.toLowerCase())
  return dist / Math.max(a.length, b.length, 1)
}

// ── OCR noise normalization ───────────────────────────────────────────────────
//
// Applied to a COPY of each line for label matching only — numbers on the
// original line are preserved for amount extraction.
//
function normalizeForLabel(s: string): string {
  return s
    .replace(/0/g, 'o')
    .replace(/\|/g, 'l')
    .replace(/1(?=[a-z])/gi, 'l')
    .replace(/(?<=[a-z])1/gi, 'l')
    .replace(/\brn\b/g, 'm')
    .replace(/vv/g, 'w')
    .replace(/5(?=[a-z])/gi, 's')
    .replace(/[^a-z0-9\s()\/.\-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

// ── Number extraction ─────────────────────────────────────────────────────────

function extractNumbers(line: string): number[] {
  const cleaned = line.replace(/\$\s*/g, '').replace(/[−–]/g, '-')
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
        return `${m[3]}-${mo}-${m[2].padStart(2, '0')}`
      }
      return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`
    }
  }
  return undefined
}

// ── Label matching — three tiers ──────────────────────────────────────────────
//
// Tier 1 — Direct:   regex matches the original OCR line (highest confidence)
// Tier 2 — Fuzzy-1:  regex matches the character-substitution-normalized line
// Tier 3 — Fuzzy-2:  edit-distance match of candidate keywords vs. line words
//                    (catches remaining OCR misreads — "Federai", "Groes", etc.)
//
type MatchTier = 'direct' | 'fuzzy1' | 'fuzzy2'

// Keywords to compare against words in the line via Levenshtein
// Keep them short (single tokens) for efficient comparison
const FIELD_KEYWORDS: Record<string, string[]> = {
  grossPay:       ['gross', 'earnings', 'salary', 'wages'],
  federalTax:     ['federal', 'withholding', 'fit'],
  stateTax:       ['state', 'sit', 'provincial'],
  socialSecurity: ['social', 'security', 'oasdi', 'fica'],
  medicare:       ['medicare'],
  netPay:         ['net', 'takehome', 'deposit'],
}

function matchLabel(
  rawLine: string,
  normalizedLine: string,
  patterns: RegExp[],
  fieldKey?: string,
): MatchTier | null {
  // Tier 1: direct
  if (patterns.some(p => p.test(rawLine))) return 'direct'
  // Tier 2: OCR-noise normalized
  if (patterns.some(p => p.test(normalizedLine))) return 'fuzzy1'

  // Tier 3: Levenshtein keyword match
  if (fieldKey && FIELD_KEYWORDS[fieldKey]) {
    const lineWords = rawLine.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean)
    const keywords = FIELD_KEYWORDS[fieldKey]
    for (const kw of keywords) {
      for (const lw of lineWords) {
        // Accept match if edit similarity is ≥ 0.75 and word length is similar
        if (lw.length >= 3 && Math.abs(lw.length - kw.length) <= 2 && editSim(lw, kw) <= 0.25) {
          return 'fuzzy2'
        }
      }
    }
  }

  return null
}

function tierToConfidence(tier: MatchTier): FieldConfidence {
  if (tier === 'direct') return 'high'
  return 'medium'  // both fuzzy tiers → medium (CHECK badge in UI)
}

// ── Pattern definitions (comprehensive synonym sets) ─────────────────────────

const GROSS_PAY = [
  /\b(total\s+)?gross\s+(pay|wages|earnings|income|compensation)\b/i,
  /\bregular\s+(pay|earnings|wages)\b/i,
  /\btotal\s+earnings\b/i,
  /\bearnings\s*[-–:]\s*regular\b/i,
  /\bbase\s+(pay|salary|wage)\b/i,
  /\bsalary\s+(this\s+period|current)?\b/i,
  /\bhourly\s+(earnings|wages|pay)\b/i,
  /\bcurrent\s+gross\b/i,
  /\bgross\s+this\s+period\b/i,
  /\bgross\s+wages\b/i,
  /\btotal\s+compensation\b/i,
  /\bregular\s+hours\s+earned\b/i,
  // ADP-style
  /\bearnings\s+regular\b/i,
  /\bstraight\s+time\b/i,
  // Gusto
  /\bsalary\s+pay\b/i,
  // Workday
  /\bworker\s+pay\b/i,
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
  /\bfed\s+wh\b/i,
  // ADP
  /\bfederal\s+taxes\b/i,
  // QuickBooks
  /\bfed\s+income\b/i,
  // Paychex
  /\bfederal\b(?=.*\btax\b)/i,
]

const STATE_TAX = [
  /\bstate\s+income\s+tax\b/i,
  /\bstate\s+(tax|withholding|w[./]?h)\b/i,
  /\bsit\b/i,
  /\bstate\s+tax\s+withheld\b/i,
  /\bst\s+income\s+tax\b/i,
  /\bstate\s+w\/h\b/i,
  /\bprovincial\s+tax\b/i,
  /\bstate\s+taxes\b/i,
  // ADP-style: "CA State Tax", "NY State Tax", etc.
  /\b[A-Z]{2}\s+state\s+tax\b/i,
  /\b[A-Z]{2}\s+income\s+tax\b/i,
  // Workday
  /\bstate\s+withholding\b/i,
  // Rippling
  /\bstate\s+wh\b/i,
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
  /\bsoc\s+sec\s+tax\b/i,
  // ADP
  /\bfica\s+ee\b/i,
  // QuickBooks
  /\bsocial\s+security\s+employee\b/i,
  // Workday / Paychex
  /\bemployee\s+social\s+security\b/i,
  /\boss\b/i,
]

const MEDICARE = [
  /\bmedicare\b/i,
  /\bmed(icare)?\s+tax\b/i,
  /\bfica\s*[-–]\s*med(icare)?\b/i,
  /\bfica\s+medicare\b/i,
  /\bemp(loyee)?\s+medicare\b/i,
  /\bmed\s+tax\b/i,
  /\bmed\s+w\/h\b/i,
  /\bmedical\s+tax\b/i,
  // ADP
  /\bfica\s+med\b/i,
  // Workday
  /\bemployee\s+medicare\b/i,
  // Rippling
  /\bmed\s+ee\b/i,
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
  /\bdeposit\s+amount\b/i,
  // ADP
  /\bnet\s+check\b/i,
  // Gusto
  /\btake\s+home\b/i,
  // Workday
  /\bworker\s+net\b/i,
  // Rippling
  /\bpaycheck\s+amount\b/i,
  /\bpay\s+amount\b/i,
]

const PRE_TAX_PATTERNS = [
  { name: '401(k)', patterns: [
    /\b401\s*\(?k\)?(\s+traditional)?\b/i,
    /\bretirement\s+contribution\b/i,
    /\btraditional\s+401\b/i,
    /\bpre[\s-]tax\s+401\b/i,
    /\bemployee\s+401\b/i,
    /\bdeferred\s+comp\b/i,
    /\b403\s*\(?b\)?\b/i,
    /\b457\s*\(?b\)?\b/i,
  ]},
  { name: 'Health Insurance', patterns: [
    /\bhealth\s*(insurance|ins\.?|plan|premium|benefit|ded)?\b/i,
    /\bmedical\s*(insurance|ins\.?|plan|deduction|premium|ded)?\b/i,
    /\bhealth\s+care\s+plan\b/i,
    /\bmedical\s+benefit\b/i,
    /\bhmo\b/i,
    /\bppo\b/i,
    /\bhealth\s+contribution\b/i,
  ]},
  { name: 'Dental', patterns: [/\bdental\s*(insurance|ins\.?|plan|premium|ded|benefit)?\b/i]},
  { name: 'Vision', patterns: [/\bvision\s*(insurance|ins\.?|plan|premium|ded|benefit)?\b/i]},
  { name: 'HSA', patterns: [
    /\bhsa\b/i,
    /\bhealth\s+savings\s+account\b/i,
    /\bh\.s\.a\b/i,
    /\bhsa\s+contribution\b/i,
  ]},
  { name: 'FSA', patterns: [
    /\bfsa\b/i,
    /\bflexible\s+spending\b/i,
    /\bflex(ible)?\s+(spend|account|benefit)\b/i,
    /\bhealth\s+fsa\b/i,
    /\bdependent\s+care\s+fsa\b/i,
  ]},
  { name: 'Life Insurance', patterns: [
    /\b(basic\s+)?life\s+ins(urance)?\b/i,
    /\bgtl\b/i,
    /\bgroup\s+term\s+life\b/i,
    /\bbasic\s+life\b/i,
    /\bsupplemental\s+life\b/i,
  ]},
  { name: 'Disability Insurance', patterns: [
    /\bshort[\s-]term\s+dis(ability)?\b/i,
    /\blong[\s-]term\s+dis(ability)?\b/i,
    /\b(std|ltd)\b/i,
    /\bdisability\s+ins(urance)?\b/i,
  ]},
  { name: 'Commuter Benefit', patterns: [
    /\bcommuter\b/i,
    /\btransit\s*(benefit|pass|deduction)?\b/i,
    /\bparking\s+(benefit|deduction|pretax)?\b/i,
    /\bmetro\s+card\b/i,
  ]},
]

const POST_TAX_PATTERNS = [
  { name: 'Roth 401(k)', patterns: [
    /\broth\s*401\s*\(?k\)?\b/i,
    /\broth\s+contribution\b/i,
    /\bafter[\s-]tax\s+401\b/i,
    /\broth\s+403\b/i,
  ]},
  { name: 'Roth IRA', patterns: [/\broth\s+ira\b/i]},
  { name: 'Child Support', patterns: [/\bchild\s+support\b/i, /\bchild\s+support\s+order\b/i]},
  { name: 'Wage Garnishment', patterns: [/\bgarnish(ment)?\b/i, /\bwage\s+(garnish|attach)\b/i]},
  { name: 'Union Dues', patterns: [/\bunion\s+dues\b/i, /\bunion\b/i]},
  { name: 'Supplemental Life', patterns: [/\bsupplemental\s+life\s+(after[\s-]tax)?\b/i]},
]

const PTO_ACCRUED = [
  /\b(pto|vacation|sick)\s*(accrued|earned|gained)\b/i,
  /\baccrued\s+(pto|vacation|time)\b/i,
  /\bhours?\s+accrued\b/i,
]
const PTO_USED = [
  /\b(pto|vacation|sick)\s*(used|taken|paid)\b/i,
  /\bused\s+(pto|vacation|time)\b/i,
  /\bhours?\s+used\b/i,
]
const PTO_REM = [
  /\b(pto|vacation|sick)\s*(remaining|balance|avail)\b/i,
  /\bremaining\s+(pto|vacation|time)\b/i,
  /\bpto\s+bal\b/i,
  /\bavailable\s+hours?\b/i,
  /\bvacation\s+balance\b/i,
]

// ── Employer name extraction ──────────────────────────────────────────────────

function extractEmployer(lines: string[]): string | undefined {
  for (const line of lines.slice(0, 10)) {
    const t = line.trim()
    if (!t) continue
    if (/^(employer|company|organization|department|pay\s*stub|earnings\s*statement)/i.test(t)) {
      const after = t.replace(/^[^:]+:\s*/i, '').trim()
      if (after.length > 1) return after
    }
    if (/inc\.?$|llc\.?$|corp\.?$|company$|co\.$|ltd\.?$/i.test(t) && !/\d/.test(t)) return t
    if (!/\d/.test(t) && /^[A-Z][a-zA-Z\s,.'&-]{4,60}$/.test(t) && t.split(/\s+/).length >= 2) return t
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
      const dates = line.match(/\d{1,2}\/\d{1,2}\/\d{4}/g) || []
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

  function setField(key: keyof ParsedPaystub, value: number, tier: MatchTier) {
    ;(result as any)[key] = value
    result.fieldConfidence[key as string] = tierToConfidence(tier)
  }

  function matchAmounts(nums: number[]): { current: number | null; ytd: number | null } {
    if (nums.length === 0) return { current: null, ytd: null }
    if (nums.length === 1) return { current: nums[0], ytd: null }
    return { current: nums[0], ytd: nums[nums.length - 1] }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const norm = normalizedLines[i]
    const nums = extractAmountsWithLookahead(lines, i, 2)
    const { current, ytd } = matchAmounts(nums)

    // ── Gross pay ──────────────────────────────────────────────────────────
    if (result.grossPay == null) {
      const t = matchLabel(line, norm, GROSS_PAY, 'grossPay')
      if (t && current != null && current > 0) {
        setField('grossPay', current, t)
        if (ytd != null && ytd > current) setField('ytdGross', ytd, t)
      }
    }

    // ── Federal tax ────────────────────────────────────────────────────────
    if (result.federalTax == null) {
      const t = matchLabel(line, norm, FEDERAL_TAX, 'federalTax')
      if (t && current != null) {
        setField('federalTax', current, t)
        if (ytd != null && ytd > current) setField('ytdFederalTax', ytd, t)
      }
    }

    // ── State tax ──────────────────────────────────────────────────────────
    if (result.stateTax == null) {
      const t = matchLabel(line, norm, STATE_TAX, 'stateTax')
      if (t && current != null) {
        setField('stateTax', current, t)
        if (ytd != null && ytd > current) setField('ytdStateTax', ytd, t)
      }
    }

    // ── Social Security ────────────────────────────────────────────────────
    if (result.socialSecurity == null) {
      const t = matchLabel(line, norm, SOCIAL_SECURITY, 'socialSecurity')
      if (t && current != null) {
        setField('socialSecurity', current, t)
        if (ytd != null && ytd > current) setField('ytdSocialSecurity', ytd, t)
      }
    }

    // ── Medicare ───────────────────────────────────────────────────────────
    if (result.medicare == null) {
      const t = matchLabel(line, norm, MEDICARE, 'medicare')
      if (t && current != null) {
        setField('medicare', current, t)
        if (ytd != null && ytd > current) setField('ytdMedicare', ytd, t)
      }
    }

    // ── Net pay ────────────────────────────────────────────────────────────
    if (result.netPay == null) {
      const t = matchLabel(line, norm, NET_PAY, 'netPay')
      if (t && current != null && current > 0) {
        setField('netPay', current, t)
        if (ytd != null && ytd > current) setField('ytdNet', ytd, t)
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

  // ── Confidence scoring ────────────────────────────────────────────────────
  //
  // Step 1: coverage-based scoring
  const coreFields = [result.grossPay, result.netPay].filter(v => v != null).length
  const taxFields = [result.federalTax, result.socialSecurity, result.medicare].filter(v => v != null).length
  if (coreFields === 2 && taxFields >= 2) result.confidence = 'high'
  else if (coreFields >= 1) result.confidence = 'medium'
  else result.confidence = 'low'

  // Step 2: math reconciliation — if gross − deductions ≈ net, boost field
  // confidence of core fields to 'high' regardless of match tier.
  // If they DON'T reconcile, demote netPay confidence to 'medium'.
  if (result.grossPay != null && result.netPay != null) {
    const totalDed =
      (result.federalTax ?? 0) +
      (result.stateTax ?? 0) +
      (result.socialSecurity ?? 0) +
      (result.medicare ?? 0) +
      result.preTaxDeductions.reduce((s, d) => s + (d.current ?? 0), 0) +
      result.postTaxDeductions.reduce((s, d) => s + (d.current ?? 0), 0)

    if (totalDed > 0) {
      const computedNet = result.grossPay - totalDed
      const diff = Math.abs(computedNet - result.netPay)
      if (diff <= 1.00) {
        // Numbers check out — elevate confidence for all successfully extracted core fields
        for (const k of ['grossPay', 'netPay', 'federalTax', 'stateTax', 'socialSecurity', 'medicare']) {
          if (result.fieldConfidence[k] === 'medium') result.fieldConfidence[k] = 'high'
        }
      } else {
        // Numbers don't match — flag net pay as needing manual check
        result.fieldConfidence['netPay'] = 'medium'
      }
    }
  }

  // ── Warnings ──────────────────────────────────────────────────────────────
  if (result.confidence === 'low') {
    result.warnings.push('Could not identify key pay fields. The image may be unclear or in an unsupported format. Please review all fields manually.')
  }
  if (!result.payDate) {
    result.warnings.push('Pay date not found — please enter it manually.')
  }

  const fuzzyFields = Object.entries(result.fieldConfidence)
    .filter(([, v]) => v === 'medium')
    .map(([k]) => k)
    .filter(k => !k.startsWith('ytd'))
  if (fuzzyFields.length > 0) {
    result.warnings.push(`Please verify: ${fuzzyFields.join(', ')} (matched with lower certainty).`)
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
