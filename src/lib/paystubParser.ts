// Paystub OCR text parser — section-aware, layout-position-aware, YTD-discarding
// Handles all major payroll providers (ADP, Gusto, Paychex, QuickBooks, Workday, Rippling)

import { ExtractionResult, LayoutWord } from './paystubExtractor'

// ── Output types ──────────────────────────────────────────────────────────────

export interface ParsedEarning {
  label: string
  rate?: number | null
  hours?: number | null
  amount: number
}

export interface ParsedLineItem {
  name: string
  amount: number
}

export interface ParsedTax {
  label: string          // as on paystub: "FICA", "FIT", "SIT:NY"
  canonicalName: string  // "Social Security", "Federal Income Tax", etc.
  amount: number
}

export type FieldConfidence = 'high' | 'medium' | 'low'

export interface ParsedPaystub {
  employerName?: string
  payDate?: string
  periodStart?: string
  periodEnd?: string
  rawText?: string

  // Current-period breakdown — no YTD
  earnings: ParsedEarning[]
  grossPay: number | null

  deductions: ParsedLineItem[]
  totalDeductions: number | null

  taxes: ParsedTax[]
  totalTaxes: number | null

  netPay: number | null

  ptoAccrued?: number | null
  ptoUsed?: number | null
  ptoRemaining?: number | null

  confidence: 'high' | 'medium' | 'low'
  fieldConfidence: Record<string, FieldConfidence>
  warnings: string[]
}

// ── Consistency check (updated for new shape) ─────────────────────────────────

export interface ConsistencyResult {
  ok: boolean
  computedNet: number
  difference: number
  message: string
}

export function checkConsistency(p: ParsedPaystub): ConsistencyResult | null {
  if (p.grossPay == null || p.netPay == null) return null
  const totalDed = p.totalDeductions ?? p.deductions.reduce((s, d) => s + d.amount, 0)
  const totalTax = p.totalTaxes ?? p.taxes.reduce((s, t) => s + t.amount, 0)
  const totalAll = totalDed + totalTax
  if (totalAll === 0) return null
  const computedNet = p.grossPay - totalAll
  const difference = Math.abs(computedNet - p.netPay)
  const ok = difference <= 0.05
  const f = (n: number) => `$${n.toFixed(2)}`
  return {
    ok, computedNet, difference,
    message: ok
      ? `Reconciled: ${f(p.grossPay)} − ${f(totalDed)} deductions − ${f(totalTax)} taxes = ${f(computedNet)}.`
      : `${f(p.grossPay)} − ${f(totalDed)} deductions − ${f(totalTax)} taxes = ${f(computedNet)}, but net pay shows ${f(p.netPay)} (Δ ${f(difference)}). Check for missing items or OCR errors.`,
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

export function parsePaystub(result: ExtractionResult): ParsedPaystub {
  if (result.layoutWords && result.layoutWords.length > 0) {
    return parsePaystubLayout(result.layoutWords)
  }
  return parsePaystubText(result.text)
}

// ── Shared utilities ──────────────────────────────────────────────────────────

type Section = 'header' | 'earnings' | 'deductions' | 'taxes' | 'netpay' | 'accruals'

function extractDate(text: string): string | undefined {
  const patterns = [
    /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/,
    /\b(\d{4})-(\d{2})-(\d{2})\b/,
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})[,\s]+(\d{4})\b/i,
  ]
  for (const p of patterns) {
    const m = text.match(p)
    if (!m) continue
    if (p === patterns[1]) return m[0]
    if (p === patterns[2]) {
      const months: Record<string, string> = {
        jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
        jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12',
      }
      const mo = months[m[1].toLowerCase().slice(0,3)] || '01'
      return `${m[3]}-${mo}-${m[2].padStart(2,'0')}`
    }
    return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`
  }
  return undefined
}

function parseAmount(s: string): number | null {
  const cleaned = s.replace(/[$,\s]/g, '').replace(/^\((.+)\)$/, '-$1')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

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
  return results.filter(n => Math.abs(n) >= 0.01)
}

/** Extract the label text from a line (removes numbers and common amount patterns) */
function extractLabelText(line: string): string {
  return line
    .replace(/[$\d,.\-()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Tax canonical name map */
const TAX_CANONICAL: Record<string, string> = {
  fica: 'Social Security',
  oasdi: 'Social Security',
  ss: 'Social Security',
  medi: 'Medicare',
  medicare: 'Medicare',
  fit: 'Federal Income Tax',
  fed: 'Federal Income Tax',
  federal: 'Federal Income Tax',
  sit: 'State Income Tax',
  state: 'State Income Tax',
  sdi: 'State Disability Insurance',
  fli: 'Family Leave Insurance',
  pfl: 'Paid Family Leave',
  sui: 'State Unemployment Insurance',
  city: 'City Tax',
  nyc: 'NYC Tax',
  local: 'Local Tax',
}

function canonicalizeTaxLabel(label: string): string {
  const base = label.split(/[:;]/)[0].trim().toLowerCase()
  return TAX_CANONICAL[base] ?? label
}

function isSectionHeader(text: string): Section | null {
  const t = text.toLowerCase().trim()
  // Require fewer than 4 numbers — headers are mostly text
  const nums = extractNumbers(text)
  if (nums.length >= 4) return null

  if (/\btaxes?\s+withheld\b|\btax\s+withhold/i.test(t)) return 'taxes'
  if (/\bearnings?\b/i.test(t) && !/(?:gross|total)\s+earnings/i.test(t) && nums.length === 0) return 'earnings'
  if (/\bdeductions?\b/i.test(t) && nums.length === 0) return 'deductions'
  if (/\bnet\s+pay\b/i.test(t) && nums.length <= 1) return 'netpay'
  if (/\baccruals?\b|\bvacation\s+summary\b|\bpto\s+summary\b/i.test(t) && nums.length === 0) return 'accruals'
  return null
}

function isEarningTotal(text: string): boolean {
  return /gross\s+pay|total\s+earnings|total\s+gross/i.test(text)
}

function isDeductionTotal(text: string): boolean {
  return /^total\b/i.test(text.trim()) || /total\s+deductions?/i.test(text)
}

function isTaxTotal(text: string): boolean {
  return /^total\b/i.test(text.trim()) || /total\s+taxes?/i.test(text)
}

/** Best current-period amount from a list of numbers on an earnings row.
 *  Rate and hours come first (small values), then current amount, then YTD.
 *  Strategy: if ≥3 numbers and first looks like rate (<$100) → skip rate/hours, take next.
 */
function earningAmountFromNums(nums: number[]): number | null {
  if (nums.length === 0) return null
  if (nums.length === 1) return nums[0]
  if (nums.length === 2) return nums[0]  // current + YTD
  // 3 nums: rate/hours + current + YTD, or hours + current + YTD
  if (nums.length === 3) {
    return nums[0] < 100 ? nums[1] : nums[0]
  }
  // 4+ nums: rate + hours + current + YTD
  if (nums.length >= 4 && nums[0] < 100) return nums[2]
  return nums[0]
}

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

function computeConfidence(result: ParsedPaystub): void {
  const hasGross = result.grossPay != null
  const hasNet = result.netPay != null
  const hasTaxes = result.taxes.length > 0 || result.totalTaxes != null
  const hasDeds = result.deductions.length > 0 || result.totalDeductions != null

  if (hasGross && hasNet && hasTaxes) result.confidence = 'high'
  else if (hasGross || hasNet) result.confidence = 'medium'
  else result.confidence = 'low'

  if (hasGross) result.fieldConfidence['grossPay'] = 'high'
  if (hasNet) result.fieldConfidence['netPay'] = 'high'

  // Math reconciliation boost
  if (result.grossPay != null && result.netPay != null) {
    const check = checkConsistency(result)
    if (check?.ok) {
      result.fieldConfidence['grossPay'] = 'high'
      result.fieldConfidence['netPay'] = 'high'
      result.fieldConfidence['totalDeductions'] = 'high'
      result.fieldConfidence['totalTaxes'] = 'high'
    } else if (check && !check.ok) {
      result.fieldConfidence['netPay'] = 'medium'
    }
  }

  if (!hasDeds && !hasTaxes) {
    result.warnings.push('No deductions or taxes found — please verify gross and net pay and fill in any missing items.')
  }
  if (!result.payDate) {
    result.warnings.push('Pay date not found — please enter it manually.')
  }
  if (result.confidence === 'low') {
    result.warnings.push('Few fields identified. Please enter values manually.')
  }
}

function fillTotalsFromItems(result: ParsedPaystub): void {
  if (result.totalDeductions == null && result.deductions.length > 0) {
    result.totalDeductions = result.deductions.reduce((s, d) => s + d.amount, 0)
  }
  if (result.totalTaxes == null && result.taxes.length > 0) {
    result.totalTaxes = result.taxes.reduce((s, t) => s + t.amount, 0)
  }
  if (result.grossPay == null && result.earnings.length > 0) {
    result.grossPay = result.earnings.reduce((s, e) => s + e.amount, 0)
  }
}

// ── Layout-aware parser (uses LayoutWord x/y positions) ───────────────────────
//
// Groups words into rows by y-center proximity, finds the YTD column x-position,
// and only extracts numbers to the LEFT of that column as "current period" values.
// Also handles two-column page layouts (Earnings/Deductions/Taxes left, Net Pay right).
//

interface LayoutRow {
  words: LayoutWord[]
  yCenter: number
}

function groupIntoRows(words: LayoutWord[]): LayoutRow[] {
  const valid = words.filter(w => w.text.trim())
  if (!valid.length) return []

  const sorted = [...valid].sort((a, b) => a.y - b.y)
  const heights = sorted.map(w => w.h).sort((a, b) => a - b)
  const medH = heights[Math.floor(heights.length / 2)] || 20
  const tol = Math.max(6, medH * 0.45)

  type Row = { ySum: number; n: number; words: LayoutWord[] }
  const rows: Row[] = []

  for (const word of sorted) {
    let placed = false
    for (const row of rows) {
      if (Math.abs(row.ySum / row.n - word.y) <= tol) {
        row.words.push(word)
        row.ySum += word.y
        row.n++
        placed = true
        break
      }
    }
    if (!placed) rows.push({ ySum: word.y, n: 1, words: [word] })
  }

  return rows
    .sort((a, b) => a.ySum / a.n - b.ySum / b.n)
    .map(r => ({
      words: r.words.sort((a, b) => a.x - b.x),
      yCenter: r.ySum / r.n,
    }))
}

function getNumericWordsBeforeX(words: LayoutWord[], maxX: number): number[] {
  return words
    .filter(w => w.x < maxX && /^-?\(?\d[\d,]*(\.\d{1,2})?\)?$/.test(w.text.replace(/[$]/g, '')))
    .map(w => parseAmount(w.text))
    .filter((n): n is number => n !== null && Math.abs(n) >= 0.01)
}

function getLabelFromWords(words: LayoutWord[], maxX: number): string {
  return words
    .filter(w => w.x < maxX && !/^-?\(?\d[\d,]*(\.\d{1,2})?\)?$/.test(w.text.replace(/[$]/g, '')))
    .map(w => w.text)
    .join(' ')
    .trim()
}

function parsePaystubLayout(words: LayoutWord[]): ParsedPaystub {
  const rows = groupIntoRows(words)
  const pageWidth = Math.max(...words.map(w => w.x + w.w), 1)

  // Find YTD column x-position from column headers
  let ytdX: number | null = null
  for (const row of rows) {
    for (const w of row.words) {
      if (/^ytd$/i.test(w.text.trim()) || /^year.to.date$/i.test(w.text.trim())) {
        ytdX = w.x
        break
      }
    }
    if (ytdX !== null) break
  }
  const ytdCutoff = ytdX ?? (pageWidth * 0.65)

  // Right column boundary: Net Pay box typically starts at ~55% of page width
  // Detect it by finding "Net Pay" text in the right half of the page
  let rightColX = pageWidth * 0.55
  for (const row of rows) {
    const rowText = row.words.map(w => w.text).join(' ')
    if (/net\s+pay/i.test(rowText)) {
      const netIdx = row.words.findIndex(w => /^net$/i.test(w.text))
      if (netIdx >= 0 && row.words[netIdx].x > pageWidth * 0.4) {
        rightColX = Math.min(rightColX, row.words[netIdx].x - 5)
      }
    }
  }

  const result: ParsedPaystub = {
    earnings: [],
    grossPay: null,
    deductions: [],
    totalDeductions: null,
    taxes: [],
    totalTaxes: null,
    netPay: null,
    confidence: 'low',
    fieldConfidence: {},
    warnings: [],
  }

  let section: Section = 'header'
  const headerLines: string[] = []

  for (const row of rows) {
    // Split row into left column (section data) and right column (Net Pay box)
    const leftWords = row.words.filter(w => w.x < rightColX)
    const rightWords = row.words.filter(w => w.x >= rightColX)
    const leftText = leftWords.map(w => w.text).join(' ')
    const rightText = rightWords.map(w => w.text).join(' ')
    const fullText = row.words.map(w => w.text).join(' ')

    // Extract Net Pay from right column if not yet found
    if (result.netPay == null && rightWords.length > 0 && /net\s+pay/i.test(rightText)) {
      const rightNums = getNumericWordsBeforeX(rightWords, Infinity)
      if (rightNums.length > 0) {
        result.netPay = rightNums[rightNums.length - 1]
        result.fieldConfidence['netPay'] = 'high'
      }
    }

    // Detect dates from full row text in header section
    if (section === 'header') {
      headerLines.push(fullText)
      const lower = fullText.toLowerCase()
      if (/pay\s*date|check\s*date|payment\s*date/i.test(lower)) {
        const d = extractDate(fullText); if (d && !result.payDate) result.payDate = d
      }
      if (/period\s*(start|begin|from)|start\s*date/i.test(lower)) {
        const d = extractDate(fullText); if (d && !result.periodStart) result.periodStart = d
      }
      if (/period\s*(end|to|through)|end\s*date/i.test(lower)) {
        const d = extractDate(fullText); if (d && !result.periodEnd) result.periodEnd = d
      }
      if (/pay\s+period/i.test(lower)) {
        const dates = fullText.match(/\d{1,2}\/\d{1,2}\/\d{4}/g) ?? []
        if (dates.length >= 2) {
          if (!result.periodStart) result.periodStart = extractDate(dates[0])
          if (!result.periodEnd) result.periodEnd = extractDate(dates[1])
        }
      }
    }

    // Detect section header from left column text
    const newSection = isSectionHeader(leftText || fullText)
    if (newSection) {
      section = newSection
      // Also check for dates in header area before first section
      if (section !== 'header') {
        // already in a section, continue
      }
      continue
    }

    // Extract data based on current section
    const leftNums = getNumericWordsBeforeX(leftWords, ytdCutoff)
    const label = getLabelFromWords(leftWords, ytdCutoff)

    if (section === 'earnings') {
      if (isEarningTotal(leftText)) {
        const allNums = getNumericWordsBeforeX(leftWords, ytdCutoff)
        if (allNums.length > 0) {
          // Last number before YTD = current gross pay
          result.grossPay = allNums[allNums.length - 1]
          result.fieldConfidence['grossPay'] = 'high'
        }
      } else if (label && leftNums.length > 0) {
        // Rightmost number before ytdCutoff = current period earning amount
        const amount = leftNums[leftNums.length - 1]
        result.earnings.push({ label, amount })
      }
    }

    else if (section === 'deductions') {
      if (isDeductionTotal(leftText)) {
        if (leftNums.length > 0) {
          result.totalDeductions = leftNums[0]
          result.fieldConfidence['totalDeductions'] = 'high'
        }
      } else if (label && leftNums.length > 0) {
        result.deductions.push({ name: label, amount: leftNums[0] })
      }
    }

    else if (section === 'taxes') {
      if (isTaxTotal(leftText)) {
        if (leftNums.length > 0) {
          result.totalTaxes = leftNums[0]
          result.fieldConfidence['totalTaxes'] = 'high'
        }
      } else if (label && leftNums.length > 0) {
        result.taxes.push({ label, canonicalName: canonicalizeTaxLabel(label), amount: leftNums[0] })
      }
    }

    else if (section === 'netpay' && result.netPay == null) {
      if (leftNums.length > 0) {
        result.netPay = leftNums[leftNums.length - 1]
        result.fieldConfidence['netPay'] = 'high'
      }
    }

    else if (section === 'accruals') {
      const allNums = getNumericWordsBeforeX(row.words, Infinity)
      if (/accrued|earned/i.test(fullText) && allNums[0] != null) result.ptoAccrued = allNums[0]
      else if (/used|taken/i.test(fullText) && allNums[0] != null) result.ptoUsed = allNums[0]
      else if (/remaining|balance/i.test(fullText) && allNums[0] != null) result.ptoRemaining = allNums[0]
    }
  }

  // Extract employer from header lines
  result.employerName = extractEmployer(headerLines)

  fillTotalsFromItems(result)
  computeConfidence(result)
  return result
}

// ── Text-based parser (fallback for digital PDFs and DOCX) ────────────────────
//
// Uses a section-state machine over text lines.
// For each data line, takes the FIRST number as the current-period amount
// (assuming current comes before YTD in the text order).
// For earnings rows with rate+hours, uses a heuristic to skip the rate/hours.
//

export function parsePaystubText(rawText: string): ParsedPaystub {
  const result: ParsedPaystub = {
    earnings: [],
    grossPay: null,
    deductions: [],
    totalDeductions: null,
    taxes: [],
    totalTaxes: null,
    netPay: null,
    confidence: 'low',
    fieldConfidence: {},
    warnings: [],
  }

  if (!rawText || rawText.trim().length < 20) {
    result.warnings.push('No readable text was extracted — image may be too blurry or low-resolution.')
    return result
  }

  const lines = rawText.split(/\n|\r/).map(l => l.trim()).filter(Boolean)

  result.employerName = extractEmployer(lines)

  // Date extraction pass (scan all lines)
  for (const line of lines) {
    const lower = line.toLowerCase()
    if (/pay\s*date|check\s*date|payment\s*date/i.test(lower)) {
      const d = extractDate(line); if (d && !result.payDate) result.payDate = d
    }
    if (/period\s*(start|begin|from)|start\s*(date)?|begin\s*(date)?/i.test(lower)) {
      const d = extractDate(line); if (d && !result.periodStart) result.periodStart = d
    }
    if (/period\s*(end|to|through)|end\s*(date)?/i.test(lower)) {
      const d = extractDate(line); if (d && !result.periodEnd) result.periodEnd = d
    }
    if (/pay\s+period/i.test(lower)) {
      const dates = line.match(/\d{1,2}\/\d{1,2}\/\d{4}/g) ?? []
      if (dates.length >= 2) {
        if (!result.periodStart) result.periodStart = extractDate(dates[0])
        if (!result.periodEnd) result.periodEnd = extractDate(dates[1])
      }
    }
  }

  // Section-state machine
  let section: Section = 'header'

  for (const line of lines) {
    // Check if this line transitions to a new section
    // Handle inline section transitions (e.g., "Gross Pay 956.00 Net Pay 708.19")
    const inlineNetPay = /net\s+pay/i.test(line) && result.netPay == null
    if (inlineNetPay) {
      // Extract net pay before switching
      const afterNetPay = line.replace(/.*\bnet\s+pay\b/i, '')
      const nums = extractNumbers(afterNetPay)
      if (nums.length > 0) {
        result.netPay = nums[0]
        result.fieldConfidence['netPay'] = 'high'
      }
    }

    const newSection = isSectionHeader(line)
    if (newSection) {
      section = newSection
      continue
    }

    const nums = extractNumbers(line)
    const label = extractLabelText(line)

    if (!label || nums.length === 0) continue

    if (section === 'earnings') {
      if (isEarningTotal(line)) {
        if (result.grossPay == null) {
          result.grossPay = nums[0]
          result.fieldConfidence['grossPay'] = 'high'
        }
      } else {
        const amount = earningAmountFromNums(nums)
        if (amount != null && amount > 0 && label.length > 1) {
          result.earnings.push({ label, amount })
        }
      }
    }

    else if (section === 'deductions') {
      if (isDeductionTotal(line)) {
        if (result.totalDeductions == null) {
          result.totalDeductions = nums[0]
          result.fieldConfidence['totalDeductions'] = 'high'
        }
      } else if (label.length > 1 && nums[0] > 0) {
        result.deductions.push({ name: label, amount: nums[0] })
      }
    }

    else if (section === 'taxes') {
      if (isTaxTotal(line)) {
        if (result.totalTaxes == null) {
          result.totalTaxes = nums[0]
          result.fieldConfidence['totalTaxes'] = 'high'
        }
      } else if (label.length > 1 && nums[0] > 0) {
        result.taxes.push({ label, canonicalName: canonicalizeTaxLabel(label), amount: nums[0] })
      }
    }

    else if (section === 'netpay' && result.netPay == null) {
      if (/net\s+pay|take.home|amount/i.test(line)) {
        result.netPay = nums[0]
        result.fieldConfidence['netPay'] = 'high'
      }
    }

    else if (section === 'accruals') {
      if (/accrued|earned/i.test(line) && nums[0] != null) result.ptoAccrued = nums[0]
      else if (/used|taken/i.test(line) && nums[0] != null) result.ptoUsed = nums[0]
      else if (/remaining|balance/i.test(line) && nums[0] != null) result.ptoRemaining = nums[0]
    }

    // Fallback: detect gross/net pay outside explicit sections
    else if (section === 'header') {
      if (/gross\s+pay|total\s+earnings/i.test(line) && result.grossPay == null && nums[0] > 0) {
        result.grossPay = nums[0]
        result.fieldConfidence['grossPay'] = 'medium'
      }
      if (/net\s+pay|take.home/i.test(line) && result.netPay == null && nums[0] > 0) {
        result.netPay = nums[0]
        result.fieldConfidence['netPay'] = 'medium'
      }
    }
  }

  fillTotalsFromItems(result)
  computeConfidence(result)
  return result
}
