import type { Cadence, Recurring, Transaction } from './types';

const DAY = 86_400_000;

const CADENCES: { cadence: Cadence; days: number; tol: number; perMonth: number }[] = [
  { cadence: 'weekly', days: 7, tol: 2, perMonth: 52 / 12 },
  { cadence: 'monthly', days: 30.4, tol: 5, perMonth: 1 },
  { cadence: 'quarterly', days: 91, tol: 8, perMonth: 1 / 3 },
  { cadence: 'yearly', days: 365, tol: 12, perMonth: 1 / 12 },
];

const CATEGORY_RULES: [RegExp, string][] = [
  [/netflix|hulu|disney|hbo|max\b|peacock|paramount|youtube|crunchyroll|prime video/i, 'Streaming'],
  [/spotify|apple music|tidal|pandora|soundcloud/i, 'Music'],
  [/adobe|notion|github|figma|openai|chatgpt|claude|microsoft|office|canva|dropbox|1password/i, 'Software'],
  [/icloud|google one|google storage|backblaze/i, 'Cloud storage'],
  [/gym|fitness|planet|equinox|peloton|classpass|strava/i, 'Fitness'],
  [/rent|lease|property|apartment|apts/i, 'Housing'],
  [/electric|energy|water|gas co|internet|verizon|at&t|t-mobile|spectrum|comcast|xfinity/i, 'Bills & utilities'],
  [/times|journal|post|news|substack|economist|bloomberg/i, 'News'],
  [/amazon|prime|costco|walmart/i, 'Shopping'],
  [/blue apron|hellofresh|factor|doordash|dashpass|uber one|grubhub/i, 'Food delivery'],
  [/insurance|geico|lemonade|state farm/i, 'Insurance'],
];

const BILL_CATEGORIES = new Set(['Housing', 'Bills & utilities', 'Insurance']);

export function categorize(merchant: string): string {
  for (const [re, cat] of CATEGORY_RULES) if (re.test(merchant)) return cat;
  return 'Other';
}

/**
 * Bank descriptions are noisy: "NETFLIX.COM 866-579-7172 CA #4821".
 * Strip card/reference numbers, punctuation and payment-processor prefixes
 * so the same company groups together every month.
 */
const FILLER = new Set(['USA', 'INC', 'LLC', 'CO', 'THE', 'SUBSCRIPTION', 'PAYMENT', 'AUTOPAY', 'DIGITAL', 'STORE', 'BILL', 'ANNUAL', 'MEMBERSHIP', 'PENDING', 'MONTHLY', 'RECURRING', 'RENT', 'APTS', '-']);

export function normalizeMerchant(desc: string): string {
  let s = desc.toUpperCase();
  s = s.replace(/^(POS|ACH|DEBIT|PURCHASE|RECURRING|CHECKCARD|SQ \*|TST\*|PAYPAL \*|PP\*)\s*/g, '');
  s = s.replace(/\.(COM|NET|IO|CO)\b/g, '');
  s = s.replace(/\*.*$/, ' '); // "AMAZON PRIME*A1B2" -> "AMAZON PRIME"
  s = s.replace(/#\s*\w+/g, ' ');
  s = s.replace(/\d[\d-]{2,}/g, ' ');
  s = s.replace(/\b[A-Z]{2}\b\s*$/g, ' '); // trailing state code
  s = s.replace(/[^A-Z&' ]/g, ' ');
  const words = s.split(/\s+/).filter((w) => w && !FILLER.has(w)).slice(0, 2);
  const name = words.join(' ');
  return name.replace(/\w\S*/g, (w) => w[0] + w.slice(1).toLowerCase());
}

function addInterval(d: Date, c: Cadence): Date {
  if (c === 'weekly') return new Date(d.getTime() + 7 * DAY);
  const months = c === 'monthly' ? 1 : c === 'quarterly' ? 3 : 12;
  return new Date(d.getFullYear(), d.getMonth() + months, d.getDate());
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Finds charges that repeat on a regular schedule at a similar price.
 * A group counts as recurring when:
 *  - it has at least 3 charges (2 is enough for yearly ones),
 *  - most gaps between charges match one cadence (weekly, monthly, ...),
 *  - amounts stay within ~35% of the median (allows price hikes, rejects
 *    "coffee shop I visit randomly with different totals").
 */
export function detectRecurring(txs: Transaction[]): Recurring[] {
  if (!txs.length) return [];
  const statementEnd = Math.max(...txs.map((t) => t.date.getTime()));

  const groups = new Map<string, Transaction[]>();
  for (const t of txs) {
    if (t.amount >= 0) continue; // only money going out
    const key = normalizeMerchant(t.description);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  const results: Recurring[] = [];
  for (const [merchant, list] of groups) {
    const sorted = [...list].sort((a, b) => a.date.getTime() - b.date.getTime());
    // collapse same-day duplicates (refund+recharge noise)
    const charges = sorted.filter((t, i) => i === 0 || t.date.getTime() - sorted[i - 1].date.getTime() > DAY);
    if (charges.length < 2) continue;

    const gaps = charges.slice(1).map((t, i) => (t.date.getTime() - charges[i].date.getTime()) / DAY);
    const g = median(gaps);
    const match = CADENCES.find((c) => Math.abs(g - c.days) <= c.tol);
    if (!match) continue;
    const minCharges = match.cadence === 'yearly' ? 2 : 3;
    if (charges.length < minCharges) continue;
    const onSchedule = gaps.filter((x) => Math.abs(x - match.days) <= match.tol * 1.6).length;
    if (onSchedule / gaps.length < 0.75) continue;

    // Each charge should be close to the one before it. Comparing neighbours
    // (not the overall median) lets a one-time price hike through.
    const amounts = charges.map((t) => Math.abs(t.amount));
    if (amounts.slice(1).some((a, i) => Math.abs(a - amounts[i]) / amounts[i] > 0.6)) continue;

    const last = charges[charges.length - 1];
    const lastAmount = Math.abs(last.amount);
    const firstAmount = amounts[0];
    const intervalMs = match.days * DAY;
    const sinceLast = statementEnd - last.date.getTime();
    const active = sinceLast <= intervalMs + match.tol * 2 * DAY;

    const distinct = new Set(amounts.map((a) => a.toFixed(2))).size;
    const category = categorize(last.description);

    results.push({
      id: merchant.toLowerCase().replace(/\s+/g, '-'),
      merchant,
      category,
      kind: BILL_CATEGORIES.has(category) ? 'bill' : 'subscription',
      variable: distinct > 3,
      cadence: match.cadence,
      charges: charges.map((t) => ({ date: t.date, amount: Math.abs(t.amount) })),
      lastAmount,
      firstAmount,
      monthlyCost: lastAmount * match.perMonth,
      yearlyCost: lastAmount * match.perMonth * 12,
      priceChangePct: ((lastAmount - firstAmount) / firstAmount) * 100,
      lastSeen: last.date,
      nextExpected: addInterval(last.date, match.cadence),
      active,
      isNew: statementEnd - charges[0].date.getTime() < 75 * DAY,
    });
  }

  return results.sort((a, b) => Number(b.active) - Number(a.active) || b.yearlyCost - a.yearlyCost);
}

/**
 * What a monthly amount would grow to if invested every month instead.
 * Uses the future value of a series of equal deposits:
 *   FV = m * ((1 + r)^n - 1) / r, with r = yearly return / 12.
 * 7%/year is roughly the long-run US stock market average after inflation
 * (about 10% before). It's an illustration, not a promise.
 */
export function futureValue(monthly: number, years: number, annualReturn = 0.07): number {
  const r = annualReturn / 12;
  const n = years * 12;
  return monthly * ((Math.pow(1 + r, n) - 1) / r);
}
