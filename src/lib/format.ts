export const money = (n: number, cents = true) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });

export const shortDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000);

export const cadenceLabel = { weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Every 3 months', yearly: 'Yearly' } as const;
