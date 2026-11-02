/** Builds a realistic 12-month checking account CSV for the demo. */
export function sampleCsv(end = new Date(2026, 9, 31)): string {
  const rows: [Date, string, number][] = [];
  const MONTHS = 14;
  const start = new Date(end.getFullYear(), end.getMonth() - MONTHS + 1, 1);
  let seed = 42;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const monthly = (day: number, desc: string, amt: (i: number) => number, from = 0, to = MONTHS) => {
    for (let i = from; i < to; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, day);
      if (d <= end) rows.push([d, desc.replace('{n}', String(1000 + Math.floor(rand() * 8999))), -amt(i)]);
    }
  };

  monthly(1, 'RENT - MAPLE COURT APTS', () => 1450);
  monthly(3, 'NETFLIX.COM 866-579-7172 CA', (i) => (i < 9 ? 15.49 : 17.99));
  monthly(5, 'SPOTIFY USA #{n}', () => 11.99);
  monthly(8, 'PLANET FITNESS #{n} ITHACA NY', () => 24.99);
  monthly(12, 'ICLOUD STORAGE APPLE.COM 866-712-7753', () => 2.99);
  monthly(14, 'ADOBE *CREATIVE CLOUD 408-536-6000', () => 22.99, 0, 11);
  monthly(17, 'HULU 877-824-4858 CA', () => 7.99, 2, MONTHS);
  monthly(19, 'VERIZON WIRELESS PAYMENT', () => 65 + Math.round(rand() * 400) / 100);
  monthly(22, 'NYTIMES DIGITAL #{n}', (i) => (i < 11 ? 4 : 6.25));
  monthly(25, 'CHATGPT SUBSCRIPTION OPENAI', () => 20, 11, MONTHS);
  monthly(27, 'NYSEG ELECTRIC AUTOPAY', () => 48 + Math.round(rand() * 2400) / 100);
  rows.push([new Date(start.getFullYear(), start.getMonth() + 1, 20), 'AMAZON PRIME*A1B2C ANNUAL', -139]);
  rows.push([new Date(start.getFullYear() + 1, start.getMonth() + 1, 20), 'AMAZON PRIME*Z9Y8X ANNUAL', -139]);

  // Weekly
  for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 7 * 86400000)) {
    rows.push([new Date(d), 'BLUE APRON MEAL KIT', -59.99]);
    if (d.getTime() > end.getTime() - 70 * 86400000) break;
  }

  // Noise: groceries, coffee, takeout, paychecks, transfers
  for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86400000)) {
    const r = rand();
    if (r < 0.25) rows.push([new Date(d), 'STARBUCKS STORE #{n}'.replace('{n}', String(1000 + Math.floor(rand() * 8999))), -(4 + Math.round(rand() * 800) / 100)]);
    else if (r < 0.35) rows.push([new Date(d), 'WEGMANS #{n} ITHACA NY'.replace('{n}', '055'), -(30 + Math.round(rand() * 9000) / 100)]);
    else if (r < 0.42) rows.push([new Date(d), 'UBER EATS PENDING', -(14 + Math.round(rand() * 2500) / 100)]);
    else if (r < 0.45) rows.push([new Date(d), 'VENMO PAYMENT', -(10 + Math.round(rand() * 5000) / 100)]);
    if (d.getDate() === 15 || d.getDate() === 30) rows.push([new Date(d), 'PAYROLL DIRECT DEP CORNELL UNIV', 1240]);
  }

  rows.sort((a, b) => a[0].getTime() - b[0].getTime());
  const fmt = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
  return ['Date,Description,Amount', ...rows.map(([d, s, a]) => `${fmt(d)},"${s}",${a.toFixed(2)}`)].join('\n');
}
