import Papa from 'papaparse';
import type { Transaction } from './types';

const DATE_KEYS = ['date', 'transaction date', 'posted date', 'posting date', 'trans. date'];
const DESC_KEYS = ['description', 'merchant', 'name', 'payee', 'details', 'memo'];
const AMOUNT_KEYS = ['amount', 'transaction amount'];
const DEBIT_KEYS = ['debit', 'withdrawal', 'withdrawals'];
const CREDIT_KEYS = ['credit', 'deposit', 'deposits'];

function findKey(headers: string[], candidates: string[]): string | undefined {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const c of candidates) {
    const i = lower.indexOf(c);
    if (i >= 0) return headers[i];
  }
  for (const c of candidates) {
    const i = lower.findIndex((h) => h.includes(c));
    if (i >= 0) return headers[i];
  }
  return undefined;
}

function toNumber(raw: unknown): number {
  if (raw == null) return NaN;
  let s = String(raw).trim();
  if (!s) return NaN;
  const negParen = /^\(.*\)$/.test(s);
  s = s.replace(/[()$,\s]/g, '');
  const n = parseFloat(s);
  return negParen ? -Math.abs(n) : n;
}

function toDate(raw: unknown): Date | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  // ISO yyyy-mm-dd
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  // US mm/dd/yyyy or mm/dd/yy
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    return new Date(y, +m[1] - 1, +m[2]);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export interface ParseResult {
  transactions: Transaction[];
  error?: string;
}

/**
 * Reads a bank-statement CSV. Handles the two common layouts:
 * one signed "Amount" column, or separate "Debit" / "Credit" columns.
 * Some banks write purchases as positive numbers; if most rows are positive
 * we flip the signs so that spending is always negative.
 */
export function parseStatement(csv: string): ParseResult {
  const out = Papa.parse<Record<string, string>>(csv.trim(), { header: true, skipEmptyLines: true });
  const headers = out.meta.fields ?? [];
  const dateKey = findKey(headers, DATE_KEYS);
  const descKey = findKey(headers, DESC_KEYS);
  const amountKey = findKey(headers, AMOUNT_KEYS);
  const debitKey = findKey(headers, DEBIT_KEYS);
  const creditKey = findKey(headers, CREDIT_KEYS);

  if (!dateKey || !descKey || (!amountKey && !debitKey)) {
    return {
      transactions: [],
      error: `Couldn't find the columns I need. Found: ${headers.join(', ') || 'none'}. Need a date, a description, and an amount (or debit/credit).`,
    };
  }

  const txs: Transaction[] = [];
  for (const row of out.data) {
    const date = toDate(row[dateKey]);
    const description = (row[descKey] ?? '').trim();
    let amount: number;
    if (amountKey) {
      amount = toNumber(row[amountKey]);
    } else {
      const debit = toNumber(row[debitKey!]);
      const credit = creditKey ? toNumber(row[creditKey]) : NaN;
      amount = !isNaN(debit) && debit !== 0 ? -Math.abs(debit) : !isNaN(credit) ? Math.abs(credit) : NaN;
    }
    if (date && description && !isNaN(amount)) txs.push({ date, description, amount });
  }

  if (amountKey && txs.length) {
    const positives = txs.filter((t) => t.amount > 0).length;
    if (positives / txs.length > 0.7) txs.forEach((t) => (t.amount = -t.amount));
  }

  txs.sort((a, b) => a.date.getTime() - b.date.getTime());
  if (!txs.length) return { transactions: [], error: 'No readable rows in that file.' };
  return { transactions: txs };
}
