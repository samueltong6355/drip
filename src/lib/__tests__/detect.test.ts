import { describe, expect, it } from 'vitest';
import { parseStatement } from '../parse';
import { detectRecurring, futureValue, normalizeMerchant } from '../detect';
import { sampleCsv } from '../sample';

describe('normalizeMerchant', () => {
  it('groups noisy bank descriptions', () => {
    expect(normalizeMerchant('NETFLIX.COM 866-579-7172 CA')).toBe('Netflix');
    expect(normalizeMerchant('SPOTIFY USA #4821')).toBe(normalizeMerchant('SPOTIFY USA #9912'));
  });
});

describe('parseStatement', () => {
  it('handles debit/credit columns', () => {
    const r = parseStatement('Posted Date,Payee,Debit,Credit\n01/02/2026,Spotify,11.99,\n01/03/2026,Paycheck,,1000');
    expect(r.transactions.map((t) => t.amount)).toEqual([-11.99, 1000]);
  });
  it('flips sign when purchases are positive', () => {
    const r = parseStatement('Date,Description,Amount\n2026-01-01,A,5\n2026-01-02,B,6\n2026-01-03,C,7\n2026-01-04,D,-100');
    expect(r.transactions[0].amount).toBe(-5);
  });
  it('reports missing columns', () => {
    expect(parseStatement('foo,bar\n1,2').error).toMatch(/columns/);
  });
});

describe('detectRecurring on sample data', () => {
  const recs = detectRecurring(parseStatement(sampleCsv()).transactions);
  const byName = Object.fromEntries(recs.map((r) => [r.merchant, r]));

  it('finds the subscriptions', () => {
    for (const n of ['Netflix', 'Spotify', 'Planet Fitness', 'Hulu', 'Amazon Prime', 'Blue Apron']) {
      expect(byName[n], n).toBeDefined();
    }
  });
  it('ignores irregular spending', () => {
    expect(byName['Starbucks']).toBeUndefined();
    expect(byName['Uber Eats']).toBeUndefined();
    expect(byName['Wegmans Ithaca']).toBeUndefined();
  });
  it('flags the Netflix price hike', () => {
    expect(byName['Netflix'].priceChangePct).toBeCloseTo(16.1, 0);
  });
  it('labels cadence and stopped subscriptions', () => {
    expect(byName['Amazon Prime'].cadence).toBe('yearly');
    expect(byName['Blue Apron'].cadence).toBe('weekly');
    expect(byName['Blue Apron'].active).toBe(false);
    expect(byName['Adobe'].active).toBe(false);
    expect(byName['Netflix'].active).toBe(true);
  });
});

it('futureValue matches the annuity formula', () => {
  expect(futureValue(100, 10)).toBeCloseTo(17308.48, 0);
});
