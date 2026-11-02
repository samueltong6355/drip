export interface Transaction {
  date: Date;
  description: string;
  /** Negative = money leaving the account, positive = money coming in. */
  amount: number;
}

export type Cadence = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface Recurring {
  id: string;
  merchant: string;
  category: string;
  cadence: Cadence;
  charges: { date: Date; amount: number }[];
  lastAmount: number;
  firstAmount: number;
  monthlyCost: number;
  yearlyCost: number;
  /** Percent change from first to latest charge. */
  priceChangePct: number;
  lastSeen: Date;
  nextExpected: Date;
  active: boolean;
  /** Amount changes most cycles (utility bills), so price-change % isn't meaningful. */
  variable: boolean;
  kind: 'subscription' | 'bill';
  isNew: boolean;
}
