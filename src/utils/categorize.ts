import { Category } from '../types'

// ─── Direction detection ──────────────────────────────────────────────────────
// Determines whether a bank transaction description indicates incoming (credit)
// or outgoing (debit) money, before any category matching is attempted.
// This is the PRIMARY filter — a credit must never match an expense category.

const CREDIT_SIGNALS = /\b(zelle\s+credit|ach\s+credit|direct\s+deposit|payroll|salary|dividend|interest\s+earned|refund|rebate|cash\s+back|cashback|deposit\s+from|received\s+from)\b/i
const DEBIT_SIGNALS  = /\b(zelle\s+debit|ach\s+debit|debit\s+card|mobile\s+purchase|point\s+of\s+sale|pos\s+purchase|withdrawal|autopay|transfer\s+out|payment\s+to)\b/i

export type TxDirection = 'credit' | 'debit' | 'unknown'

export function detectDirection(description: string): TxDirection {
  if (CREDIT_SIGNALS.test(description)) return 'credit'
  if (DEBIT_SIGNALS.test(description))  return 'debit'
  return 'unknown'
}

// ─── Method detection ─────────────────────────────────────────────────────────
// Returns a canonical method tag (e.g. 'zelle', 'ach', 'card') from the description,
// used as a secondary matching signal after direction.

export function detectMethod(description: string): string | null {
  const d = description.toLowerCase()
  if (/\bzelle\b/.test(d))           return 'zelle'
  if (/\bach\b/.test(d))             return 'ach'
  if (/\bdebit\s+card\b/.test(d))    return 'card'
  if (/\bcredit\s+card\b/.test(d))   return 'card'
  if (/\batm\b/.test(d))             return 'atm'
  if (/\bcheck\b/.test(d))           return 'check'
  if (/\bwire\b/.test(d))            return 'wire'
  if (/\bdirect\s+deposit\b/.test(d)) return 'deposit'
  if (/\bpaypal\b/.test(d))          return 'paypal'
  if (/\bvenmo\b/.test(d))           return 'venmo'
  if (/\bapple\s+pay\b/.test(d))     return 'apple_pay'
  return null
}

// ─── Merchant extraction ──────────────────────────────────────────────────────
// Strips bank-added prefixes and trailing noise to reveal the actual payee name.
// Matching keywords against the merchant name (not the raw bank string) prevents
// false positives — e.g. "Zelle Debit To Market" should not match a grocery category.

const BANK_PREFIXES: RegExp[] = [
  /^zelle\s+(?:credit|debit)\s+(?:from|to)\s+/i,
  /^zelle\s+(?:from|to)\s+/i,
  /^ach\s+(?:electronic\s+)?(?:credit|debit)\s+/i,
  /^debit\s+card\s+purchase\s+/i,
  /^check\s+card\s+purchase\s+/i,
  /^mobile\s+(?:banking\s+)?purchase\s+/i,
  /^pos\s+(?:purchase\s+)?/i,
  /^point\s+of\s+sale\s+/i,
  /^online\s+(?:banking\s+)?(?:payment|transfer|purchase)\s+(?:to\s+)?/i,
  /^direct\s+deposit\s+/i,
  /^atm\s+(?:withdrawal\s+)?/i,
  /^recurring\s+(?:payment\s+)?/i,
  /^autopay\s+/i,
  /^wire\s+(?:transfer\s+)?(?:to|from)?\s+/i,
]

const TRAILING_NOISE: RegExp[] = [
  /\s+[A-Z]{2}\s+\d{5}(-\d{4})?$/,       // STATE ZIP
  /\s+\d{5}(-\d{4})?$/,                   // ZIP alone
  /\s+#?\d{6,}$/,                          // long reference numbers
  /\s+ref\s*#?\s*\w+$/i,                  // "ref 12345"
  /\s+\d{1,2}\/\d{1,2}(?:\/\d{2,4})?$/,  // trailing date artifact
]

export function extractMerchant(description: string): string {
  let s = description.trim()
  for (const prefix of BANK_PREFIXES) {
    const stripped = s.replace(prefix, '')
    if (stripped !== s) { s = stripped; break }
  }
  for (const trailer of TRAILING_NOISE) {
    s = s.replace(trailer, '')
  }
  return s.replace(/\s+/g, ' ').trim()
}

// Canonical key used as the learning map lookup key
export function merchantKey(description: string): string {
  return extractMerchant(description)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50)
}

// ─── Keyword patterns ─────────────────────────────────────────────────────────
// Matched against the EXTRACTED MERCHANT NAME only, never the raw bank description.
// This prevents bank method prefixes ("Zelle", "ACH") from triggering false category matches.

const MERCHANT_KEYWORD_PATTERNS: Array<{ pattern: RegExp; names: string[] }> = [
  { pattern: /walmart|kroger|safeway|whole foods|trader joe|aldi|publix|food lion|sprouts|wegmans|grocery|supermarket|fresh market|market basket|stop.?&.?shop/i, names: ['grocery', 'groceries', 'food', 'market', 'supermarket'] },
  { pattern: /mcdonald|burger king|wendy|chick.fil|subway|chipotle|taco bell|starbucks|dunkin|panera|pizza|sushi|restaurant|cafe|diner|doordash|uber eats|grubhub|postmates|domino|papa john|kfc|popeye|five guys|shake shack|applebee|olive garden|ihop|waffle house/i, names: ['dining', 'food', 'restaurant', 'eating', 'fast food', 'coffee'] },
  { pattern: /shell|exxon|bp|chevron|texaco|mobil|speedway|wawa|valero|circle k|marathon|sunoco/i, names: ['gas', 'auto', 'car', 'transportation', 'fuel', 'vehicle'] },
  { pattern: /uber|lyft|taxi|transit|metro|bus pass|amtrak|parking|toll/i, names: ['transportation', 'transit', 'commute', 'travel'] },
  { pattern: /netflix|hulu|disney|spotify|apple music|amazon prime|youtube premium|hbo|peacock|paramount|showtime|audible|sling|fubo/i, names: ['subscription', 'entertainment', 'streaming', 'media', 'bills'] },
  { pattern: /cvs|walgreens|rite aid|pharmacy|rx|prescription|doctor|medical|hospital|urgent care|dental|vision|clinic/i, names: ['health', 'medical', 'pharmacy', 'healthcare', 'doctor'] },
  { pattern: /amazon|ebay|etsy|best buy|target|costco|sam.s club|overstock|wayfair|ikea|home depot|lowe.s/i, names: ['shopping', 'retail', 'online', 'home', 'household'] },
  { pattern: /gym|planet fitness|la fitness|ymca|crossfit|anytime fitness|gold.s gym|equinox|crunch|orangetheory/i, names: ['gym', 'fitness', 'health', 'exercise', 'sport'] },
  { pattern: /at.?&.?t|verizon|comcast|xfinity|t.mobile|sprint|electric|utility|water bill|nat.l gas|pg.?&.?e|pseg|duke energy|national grid|internet/i, names: ['utilities', 'bills', 'phone', 'internet', 'electric', 'water', 'cell'] },
  { pattern: /rent|mortgage|hoa|property management|lease/i, names: ['housing', 'rent', 'home', 'mortgage'] },
  { pattern: /movie|cinema|amc|regal|theater|concert|ticketmaster|stubhub|steam|playstation|xbox|nintendo/i, names: ['entertainment', 'fun', 'leisure', 'recreation', 'gaming'] },
  { pattern: /airline|delta|american air|southwest|united air|jetblue|hotel|airbnb|vrbo|booking|expedia|marriott|hilton|hyatt/i, names: ['travel', 'vacation', 'flight', 'hotel', 'trip'] },
  { pattern: /hair|salon|barber|nail|spa|beauty|cosmetic|sephora|ulta/i, names: ['beauty', 'personal care', 'grooming', 'salon'] },
  { pattern: /clothing|fashion|nike|adidas|gap|h&m|zara|nordstrom|macy|tj maxx|marshalls|old navy|banana republic|levi/i, names: ['clothing', 'clothes', 'fashion', 'apparel', 'wear'] },
  { pattern: /pet|petsmart|petco|vet|veterinary/i, names: ['pet', 'pets', 'animal'] },
  { pattern: /book|kindle|course|udemy|coursera|tuition|education|school supply/i, names: ['education', 'books', 'learning', 'school'] },
]

// ─── Learning map ─────────────────────────────────────────────────────────────
// Persists user-confirmed corrections. Key is `merchantKey|direction` so that
// a "Zelle Credit From John" and a "Zelle Debit To John" can learn independently.

const LEARN_KEY = 'budget_categorize_v2'

interface Learned { categoryId: string; count: number }

function loadMap(): Record<string, Learned> {
  try { return JSON.parse(localStorage.getItem(LEARN_KEY) || '{}') } catch { return {} }
}

function learnKey(description: string, direction: TxDirection): string {
  return merchantKey(description) + '|' + direction
}

export function saveCorrection(description: string, categoryId: string, direction: TxDirection = 'unknown') {
  const map = loadMap()
  const k = learnKey(description, direction)
  map[k] = { categoryId, count: (map[k]?.count || 0) + 1 }
  // Also update the direction-agnostic fallback if this correction is higher-confidence
  const gk = merchantKey(description) + '|any'
  if (!map[gk] || map[k].count >= (map[gk]?.count || 0)) {
    map[gk] = map[k]
  }
  try { localStorage.setItem(LEARN_KEY, JSON.stringify(map)) } catch {}
}

function lookupLearned(description: string, direction: TxDirection): string | null {
  const map = loadMap()
  const specific = map[learnKey(description, direction)]
  if (specific) return specific.categoryId
  const general = map[merchantKey(description) + '|any']
  if (general) return general.categoryId
  return null
}

// ─── Main categorization function ─────────────────────────────────────────────
// Priority order:
//   1. Learned corrections (from prior user edits)
//   2. Direction filter (income cats for credits, expense cats for debits)
//   3. Category-name match against extracted merchant name
//   4. Category keywords (if category has custom keywords field)
//   5. Merchant keyword patterns against extracted merchant name
//
// The direction filter is the key correctness gate: a credit transaction
// will NEVER be matched into an expense category by this function.

export function suggestCategoryId(
  description: string,
  categories: Category[],
  direction?: TxDirection,
): string {
  const dir = direction ?? detectDirection(description)
  const merchant = extractMerchant(description)

  // 1. Learned corrections (highest priority)
  const learned = lookupLearned(description, dir)
  if (learned && categories.find(c => c.id === learned)) return learned

  // 2. Direction filter
  const candidates = categories.filter(cat => {
    if (dir === 'credit') return cat.type === 'income'
    if (dir === 'debit')  return cat.type === 'expense'
    return cat.type === 'expense' // unknown: default to expense candidates
  })
  if (candidates.length === 0) return ''

  // 3. Category-name match against extracted merchant (not raw bank string)
  for (const cat of candidates) {
    const catName = cat.name.toLowerCase()
    if (catName.length >= 3 && merchant.toLowerCase().includes(catName)) return cat.id
  }

  // 4. Custom keywords field on the category
  for (const cat of candidates) {
    if (!cat.keywords?.length) continue
    for (const kw of cat.keywords) {
      const k = kw.toLowerCase().trim()
      if (k.length >= 3 && merchant.toLowerCase().includes(k)) return cat.id
    }
  }

  // 5. Keyword pattern matching — only against extracted merchant name
  for (const { pattern, names } of MERCHANT_KEYWORD_PATTERNS) {
    if (!pattern.test(merchant)) continue
    const matched = candidates.find(cat =>
      names.some(n => cat.name.toLowerCase().includes(n) || n.includes(cat.name.toLowerCase()))
    )
    if (matched) return matched.id
  }

  return ''
}
