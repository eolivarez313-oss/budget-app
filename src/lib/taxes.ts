/**
 * US Payroll Tax Engine — 2025 Tax Year
 * Source: IRS Publication 15-T (Percentage Method), FICA per IRC §3101/3111,
 *         state DOR publications. Treat as an estimate; actual withholding
 *         depends on employer-specific W-4 elections and payroll setup.
 *
 * Update annually: FEDERAL_BRACKETS, STANDARD_DEDUCTIONS, SS_WAGE_BASE,
 * and any changed STATE_TAX entries.
 */

export type FilingStatus = 'single' | 'married' | 'hoh'

export interface TaxInputs {
  grossAnnual: number              // hourly × hours × workDays/wk × 52
  filingStatus: FilingStatus
  stateCode: string                // e.g. 'TX', 'CA'
  payFrequency: 'weekly' | 'biweekly' | 'semi-monthly' | 'monthly'
  preTax401kPct: number            // e.g. 6 for 6%
  preTaxHealthcareAnnual: number   // annual pre-tax health/dental/vision premium
}

export interface TaxBreakdown {
  // Per-paycheck figures
  grossPay: number
  preTaxDeductions: number
  federalTax: number
  socialSecurity: number
  medicare: number
  stateTax: number
  netPay: number
  // Annual figures
  annualGross: number
  annualPreTax: number
  annualFederalTax: number
  annualSocialSecurity: number
  annualMedicare: number
  annualStateTax: number
  annualNet: number
  effectiveRate: number   // total tax ÷ gross
  netHourlyEquivalent: number  // annualNet / (gross annual / hourly rate)
}

// ── Federal brackets (2025, IRS Rev. Proc. 2024-40) ──────────────────────────

interface Bracket { min: number; rate: number; base: number }

const FEDERAL_BRACKETS: Record<FilingStatus, Bracket[]> = {
  single: [
    { min: 0,       rate: 0.10, base: 0 },
    { min: 11925,   rate: 0.12, base: 1192.50 },
    { min: 48475,   rate: 0.22, base: 5578.50 },
    { min: 103350,  rate: 0.24, base: 17651.00 },
    { min: 197300,  rate: 0.32, base: 40199.00 },
    { min: 250525,  rate: 0.35, base: 57231.00 },
    { min: 626350,  rate: 0.37, base: 188769.50 },
  ],
  married: [
    { min: 0,       rate: 0.10, base: 0 },
    { min: 23850,   rate: 0.12, base: 2385.00 },
    { min: 96950,   rate: 0.22, base: 11157.00 },
    { min: 206700,  rate: 0.24, base: 35302.00 },
    { min: 394600,  rate: 0.32, base: 80398.00 },
    { min: 501050,  rate: 0.35, base: 114534.00 },
    { min: 751600,  rate: 0.37, base: 202124.00 },
  ],
  hoh: [
    { min: 0,       rate: 0.10, base: 0 },
    { min: 17000,   rate: 0.12, base: 1700.00 },
    { min: 64850,   rate: 0.22, base: 7442.00 },
    { min: 103350,  rate: 0.24, base: 15913.00 },
    { min: 197300,  rate: 0.32, base: 38461.00 },
    { min: 250500,  rate: 0.35, base: 55465.00 },
    { min: 626350,  rate: 0.37, base: 187016.00 },
  ],
}

const STANDARD_DEDUCTIONS: Record<FilingStatus, number> = {
  single:  15000,
  married: 30000,
  hoh:     22500,
}

function federalTax(taxableIncome: number, status: FilingStatus): number {
  if (taxableIncome <= 0) return 0
  const brackets = FEDERAL_BRACKETS[status]
  let bracket = brackets[0]
  for (let i = brackets.length - 1; i >= 0; i--) {
    if (taxableIncome >= brackets[i].min) { bracket = brackets[i]; break }
  }
  return bracket.base + (taxableIncome - bracket.min) * bracket.rate
}

// ── FICA (2025) ───────────────────────────────────────────────────────────────

const SS_RATE = 0.062
const SS_WAGE_BASE = 176100   // 2025 Social Security wage base
const MEDICARE_RATE = 0.0145
const ADD_MEDICARE_RATE = 0.009
const ADD_MEDICARE_THRESHOLD: Record<FilingStatus, number> = {
  single: 200000,
  married: 250000,
  hoh: 200000,
}

// ── State income tax tables (2025) ───────────────────────────────────────────
// Format: { type: 'none' | 'flat' | 'brackets', rate?, brackets?, deduction? }

interface StateTaxDef {
  type: 'none' | 'flat' | 'brackets'
  rate?: number
  brackets?: { min: number; rate: number; base: number }[]
  deduction?: Partial<Record<FilingStatus, number>>
}

// Standard deductions / personal exemptions per filing status for bracket states.
// Simplified — uses approximate standard deduction where applicable.
const STATE_TAX: Record<string, StateTaxDef> = {
  // No income tax
  AK: { type: 'none' },
  FL: { type: 'none' },
  NV: { type: 'none' },
  NH: { type: 'none' },
  SD: { type: 'none' },
  TN: { type: 'none' },
  TX: { type: 'none' },
  WA: { type: 'none' },
  WY: { type: 'none' },

  // Flat-rate states
  AZ: { type: 'flat', rate: 0.025 },
  CO: { type: 'flat', rate: 0.044 },
  GA: { type: 'flat', rate: 0.0549 },
  ID: { type: 'flat', rate: 0.058 },
  IL: { type: 'flat', rate: 0.0495 },
  IN: { type: 'flat', rate: 0.0305 },
  KY: { type: 'flat', rate: 0.04 },
  MA: { type: 'flat', rate: 0.05 },
  MI: { type: 'flat', rate: 0.0425 },
  MS: { type: 'flat', rate: 0.047 },
  NC: { type: 'flat', rate: 0.0475 },
  OK: { type: 'flat', rate: 0.0475 },
  PA: { type: 'flat', rate: 0.0307 },
  UT: { type: 'flat', rate: 0.0455 },

  // Progressive bracket states
  AL: {
    type: 'brackets',
    deduction: { single: 2500, married: 7500, hoh: 4700 },
    brackets: [
      { min: 0,     rate: 0.02, base: 0 },
      { min: 500,   rate: 0.04, base: 10 },
      { min: 3000,  rate: 0.05, base: 110 },
    ],
  },
  AR: {
    type: 'brackets',
    deduction: { single: 2340, married: 4680, hoh: 2340 },
    brackets: [
      { min: 0,     rate: 0.02,  base: 0 },
      { min: 4300,  rate: 0.04,  base: 86 },
      { min: 8500,  rate: 0.044, base: 254 },
    ],
  },
  CA: {
    type: 'brackets',
    deduction: { single: 5202, married: 10404, hoh: 10404 },
    brackets: [
      { min: 0,       rate: 0.01,   base: 0 },
      { min: 10756,   rate: 0.02,   base: 107.56 },
      { min: 25499,   rate: 0.04,   base: 402.42 },
      { min: 40245,   rate: 0.06,   base: 992.24 },
      { min: 55866,   rate: 0.08,   base: 1929.50 },
      { min: 70606,   rate: 0.093,  base: 3109.62 },
      { min: 360659,  rate: 0.103,  base: 30046.12 },
      { min: 432787,  rate: 0.113,  base: 37474.35 },
      { min: 721314,  rate: 0.123,  base: 70083.49 },
      { min: 1000000, rate: 0.133,  base: 104405.48 },
    ],
  },
  CT: {
    type: 'brackets',
    deduction: { single: 15000, married: 24000, hoh: 19000 },
    brackets: [
      { min: 0,      rate: 0.03,   base: 0 },
      { min: 10000,  rate: 0.05,   base: 300 },
      { min: 50000,  rate: 0.055,  base: 2300 },
      { min: 100000, rate: 0.06,   base: 5050 },
      { min: 200000, rate: 0.065,  base: 11050 },
      { min: 250000, rate: 0.069,  base: 14300 },
      { min: 500000, rate: 0.0699, base: 31550 },
    ],
  },
  DC: {
    type: 'brackets',
    deduction: { single: 13850, married: 27700, hoh: 20800 },
    brackets: [
      { min: 0,      rate: 0.04,   base: 0 },
      { min: 10000,  rate: 0.06,   base: 400 },
      { min: 40000,  rate: 0.065,  base: 2200 },
      { min: 60000,  rate: 0.085,  base: 3500 },
      { min: 350000, rate: 0.0925, base: 28150 },
      { min: 1000000,rate: 0.1075, base: 88337.50 },
    ],
  },
  DE: {
    type: 'brackets',
    deduction: { single: 3250, married: 6500, hoh: 3250 },
    brackets: [
      { min: 2000,  rate: 0.022, base: 0 },
      { min: 5000,  rate: 0.039, base: 66 },
      { min: 10000, rate: 0.048, base: 261 },
      { min: 20000, rate: 0.052, base: 741 },
      { min: 25000, rate: 0.0555, base: 1001 },
      { min: 60000, rate: 0.066, base: 2943.50 },
    ],
  },
  HI: {
    type: 'brackets',
    deduction: { single: 2200, married: 4400, hoh: 3212 },
    brackets: [
      { min: 0,      rate: 0.014, base: 0 },
      { min: 2400,   rate: 0.032, base: 33.60 },
      { min: 4800,   rate: 0.055, base: 110.40 },
      { min: 9600,   rate: 0.064, base: 374.40 },
      { min: 14400,  rate: 0.068, base: 681.60 },
      { min: 19200,  rate: 0.072, base: 1007.60 },
      { min: 24000,  rate: 0.076, base: 1353.20 },
      { min: 36000,  rate: 0.079, base: 2265.20 },
      { min: 48000,  rate: 0.0825, base: 3213.20 },
      { min: 150000, rate: 0.09,  base: 11626.70 },
      { min: 175000, rate: 0.10,  base: 13876.70 },
      { min: 200000, rate: 0.11,  base: 16376.70 },
    ],
  },
  IA: { type: 'flat', rate: 0.038 },
  KS: {
    type: 'brackets',
    deduction: { single: 3500, married: 8000, hoh: 6000 },
    brackets: [
      { min: 0,     rate: 0.031, base: 0 },
      { min: 15000, rate: 0.057, base: 465 },
    ],
  },
  LA: {
    type: 'brackets',
    deduction: { single: 4500, married: 9000, hoh: 4500 },
    brackets: [
      { min: 0,     rate: 0.0185, base: 0 },
      { min: 12500, rate: 0.035,  base: 231.25 },
      { min: 50000, rate: 0.0425, base: 1543.75 },
    ],
  },
  ME: {
    type: 'brackets',
    deduction: { single: 14600, married: 29200, hoh: 21900 },
    brackets: [
      { min: 0,     rate: 0.058, base: 0 },
      { min: 26050, rate: 0.0675, base: 1510.90 },
      { min: 61600, rate: 0.0715, base: 3908.55 },
    ],
  },
  MD: {
    type: 'brackets',
    deduction: { single: 2400, married: 4850, hoh: 3000 },
    brackets: [
      { min: 0,      rate: 0.02,   base: 0 },
      { min: 1000,   rate: 0.03,   base: 20 },
      { min: 2000,   rate: 0.04,   base: 50 },
      { min: 3000,   rate: 0.0475, base: 90 },
      { min: 100000, rate: 0.05,   base: 4692.50 },
      { min: 125000, rate: 0.0525, base: 5942.50 },
      { min: 150000, rate: 0.055,  base: 7255.00 },
      { min: 250000, rate: 0.0575, base: 12755.00 },
    ],
  },
  MN: {
    type: 'brackets',
    deduction: { single: 14575, married: 29150, hoh: 21913 },
    brackets: [
      { min: 0,      rate: 0.0535, base: 0 },
      { min: 31690,  rate: 0.068,  base: 1695.42 },
      { min: 104090, rate: 0.0785, base: 6617.14 },
      { min: 193240, rate: 0.0985, base: 13617.29 },
    ],
  },
  MO: {
    type: 'brackets',
    deduction: { single: 14600, married: 29200, hoh: 21900 },
    brackets: [
      { min: 0,    rate: 0.02,  base: 0 },
      { min: 1207, rate: 0.025, base: 24.14 },
      { min: 2414, rate: 0.03,  base: 54.32 },
      { min: 3621, rate: 0.035, base: 90.53 },
      { min: 4828, rate: 0.04,  base: 132.78 },
      { min: 6035, rate: 0.045, base: 181.06 },
      { min: 7242, rate: 0.05,  base: 235.36 },
      { min: 8432, rate: 0.054, base: 294.86 },
    ],
  },
  MT: {
    type: 'brackets',
    deduction: { single: 14600, married: 29200, hoh: 21900 },
    brackets: [
      { min: 0,     rate: 0.047, base: 0 },
      { min: 20500, rate: 0.059, base: 963.50 },
    ],
  },
  NE: {
    type: 'brackets',
    deduction: { single: 7900, married: 15800, hoh: 7900 },
    brackets: [
      { min: 0,     rate: 0.0246, base: 0 },
      { min: 3700,  rate: 0.0351, base: 91.02 },
      { min: 22170, rate: 0.0501, base: 739.51 },
      { min: 35730, rate: 0.0584, base: 1418.79 },
    ],
  },
  NJ: {
    type: 'brackets',
    deduction: { single: 1000, married: 2000, hoh: 1500 },
    brackets: [
      { min: 0,      rate: 0.014,  base: 0 },
      { min: 20000,  rate: 0.0175, base: 280 },
      { min: 35000,  rate: 0.035,  base: 542.50 },
      { min: 40000,  rate: 0.05525,base: 717.50 },
      { min: 75000,  rate: 0.0637, base: 2651.25 },
      { min: 500000, rate: 0.0897, base: 29729.25 },
      { min: 1000000,rate: 0.1075, base: 74579.25 },
    ],
  },
  NM: {
    type: 'brackets',
    deduction: { single: 14600, married: 29200, hoh: 21900 },
    brackets: [
      { min: 0,     rate: 0.017,  base: 0 },
      { min: 5500,  rate: 0.032,  base: 93.50 },
      { min: 11000, rate: 0.047,  base: 269.50 },
      { min: 16000, rate: 0.049,  base: 504.50 },
      { min: 210000,rate: 0.059,  base: 10014.50 },
    ],
  },
  NY: {
    type: 'brackets',
    deduction: { single: 8000, married: 16050, hoh: 11200 },
    brackets: [
      { min: 0,      rate: 0.04,   base: 0 },
      { min: 17150,  rate: 0.045,  base: 686 },
      { min: 23600,  rate: 0.0525, base: 976.25 },
      { min: 27900,  rate: 0.055,  base: 1202.00 },
      { min: 161550, rate: 0.06,   base: 8548.75 },
      { min: 323200, rate: 0.0685, base: 18237.75 },
      { min: 2155350,rate: 0.0965, base: 143754.90 },
      { min: 5000000,rate: 0.103,  base: 418448.15 },
      { min: 25000000,rate: 0.109, base: 2499698.15 },
    ],
  },
  OH: {
    type: 'brackets',
    deduction: { single: 2400, married: 4800, hoh: 2400 },
    brackets: [
      { min: 26050,  rate: 0.02765, base: 0 },
      { min: 100000, rate: 0.03226, base: 2040.89 },
      { min: 115300, rate: 0.03688, base: 2535.85 },
    ],
  },
  OR: {
    type: 'brackets',
    deduction: { single: 2745, married: 5495, hoh: 2745 },
    brackets: [
      { min: 0,     rate: 0.0475, base: 0 },
      { min: 10200, rate: 0.0675, base: 484.50 },
      { min: 25500, rate: 0.0875, base: 1517.25 },
      { min: 125000,rate: 0.099,  base: 10228.50 },
    ],
  },
  RI: {
    type: 'brackets',
    deduction: { single: 10550, married: 21150, hoh: 15800 },
    brackets: [
      { min: 0,     rate: 0.0375, base: 0 },
      { min: 77450, rate: 0.0475, base: 2904.38 },
      { min: 176050,rate: 0.0599, base: 7587.00 },
    ],
  },
  SC: {
    type: 'brackets',
    deduction: { single: 14600, married: 29200, hoh: 21900 },
    brackets: [
      { min: 0,    rate: 0.0,   base: 0 },
      { min: 3460, rate: 0.03,  base: 0 },
      { min: 17330,rate: 0.064, base: 416.10 },
    ],
  },
  VA: {
    type: 'brackets',
    deduction: { single: 8000, married: 16000, hoh: 8000 },
    brackets: [
      { min: 0,    rate: 0.02,  base: 0 },
      { min: 3000, rate: 0.03,  base: 60 },
      { min: 5000, rate: 0.05,  base: 120 },
      { min: 17000,rate: 0.0575,base: 720 },
    ],
  },
  VT: {
    type: 'brackets',
    deduction: { single: 7050, married: 14100, hoh: 10575 },
    brackets: [
      { min: 0,      rate: 0.0335, base: 0 },
      { min: 45400,  rate: 0.066,  base: 1520.90 },
      { min: 110050, rate: 0.076,  base: 5787.80 },
      { min: 229550, rate: 0.0875, base: 14872.60 },
    ],
  },
  WI: {
    type: 'brackets',
    deduction: { single: 12760, married: 23620, hoh: 18730 },
    brackets: [
      { min: 0,     rate: 0.035, base: 0 },
      { min: 14320, rate: 0.044, base: 501.20 },
      { min: 28640, rate: 0.053, base: 1131.28 },
      { min: 315310,rate: 0.075, base: 16318.21 },
    ],
  },
  WV: {
    type: 'brackets',
    deduction: { single: 2000, married: 4000, hoh: 2000 },
    brackets: [
      { min: 0,     rate: 0.0236, base: 0 },
      { min: 10000, rate: 0.032,  base: 236 },
      { min: 25000, rate: 0.054,  base: 716 },
      { min: 40000, rate: 0.054,  base: 1526 },
      { min: 60000, rate: 0.054,  base: 2606 },
    ],
  },
}

function stateTaxAmount(taxableIncome: number, state: string, status: FilingStatus): number {
  const def = STATE_TAX[state.toUpperCase()]
  if (!def || def.type === 'none') return 0

  if (def.type === 'flat') {
    return Math.max(0, taxableIncome) * (def.rate ?? 0)
  }

  // brackets
  const deduction = def.deduction?.[status] ?? 0
  const stateIncome = Math.max(0, taxableIncome - deduction)
  if (stateIncome <= 0) return 0

  const brackets = def.brackets!
  let bracket = brackets[0]
  for (let i = brackets.length - 1; i >= 0; i--) {
    if (stateIncome >= brackets[i].min) { bracket = brackets[i]; break }
  }
  return bracket.base + (stateIncome - bracket.min) * bracket.rate
}

// ── Paycheck periods per year ─────────────────────────────────────────────────

const PERIODS: Record<string, number> = {
  weekly: 52,
  biweekly: 26,
  'semi-monthly': 24,
  monthly: 12,
}

// ── Main calculator ───────────────────────────────────────────────────────────

export function calculateTaxes(inputs: TaxInputs): TaxBreakdown {
  const { grossAnnual, filingStatus, stateCode, payFrequency, preTax401kPct, preTaxHealthcareAnnual } = inputs
  const periods = PERIODS[payFrequency] ?? 26

  // Pre-tax deductions reduce federal/state taxable income
  const annual401k = grossAnnual * (Math.min(preTax401kPct, 100) / 100)
  const annualPreTax = annual401k + Math.max(0, preTaxHealthcareAnnual)

  const federalTaxableIncome = Math.max(0, grossAnnual - annualPreTax - STANDARD_DEDUCTIONS[filingStatus])
  const stateTaxableIncome = Math.max(0, grossAnnual - annualPreTax) // state deduction applied inside stateTaxAmount

  // Federal income tax (annual)
  const annualFederalTax = federalTax(federalTaxableIncome, filingStatus)

  // FICA — applied to wages (gross minus 401k pre-tax, NOT minus healthcare for SS/Medicare)
  const ficaWages = Math.max(0, grossAnnual - annual401k)
  const annualSS = Math.min(ficaWages, SS_WAGE_BASE) * SS_RATE
  const annualMed = ficaWages * MEDICARE_RATE
  const addMedWages = Math.max(0, ficaWages - ADD_MEDICARE_THRESHOLD[filingStatus])
  const annualAddMed = addMedWages * ADD_MEDICARE_RATE
  const annualMedicare = annualMed + annualAddMed

  // State income tax (annual)
  const annualStateTax = stateTaxAmount(stateTaxableIncome, stateCode, filingStatus)

  const annualTotalTax = annualFederalTax + annualSS + annualMedicare + annualStateTax
  const annualNet = grossAnnual - annualPreTax - annualTotalTax

  // Per-paycheck breakdown
  const gross = grossAnnual / periods
  const preTax = annualPreTax / periods
  const federal = annualFederalTax / periods
  const ss = annualSS / periods
  const med = annualMedicare / periods
  const state = annualStateTax / periods
  const net = annualNet / periods

  const effectiveRate = grossAnnual > 0 ? (annualTotalTax / grossAnnual) * 100 : 0

  return {
    grossPay: gross,
    preTaxDeductions: preTax,
    federalTax: federal,
    socialSecurity: ss,
    medicare: med,
    stateTax: state,
    netPay: net,
    annualGross: grossAnnual,
    annualPreTax: annualPreTax,
    annualFederalTax,
    annualSocialSecurity: annualSS,
    annualMedicare,
    annualStateTax,
    annualNet,
    effectiveRate,
    netHourlyEquivalent: 0, // filled by caller if needed
  }
}

// ── State list for UI dropdowns ───────────────────────────────────────────────

export const US_STATES: { code: string; name: string }[] = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DC', name: 'District of Columbia' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
]

// North Dakota isn't in the detailed table above — use flat approximation
STATE_TAX['ND'] = { type: 'flat', rate: 0.025 }
