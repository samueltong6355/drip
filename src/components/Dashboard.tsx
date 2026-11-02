import { useEffect, useMemo, useState } from 'react';
import type { Recurring, Transaction } from '../lib/types';
import { futureValue } from '../lib/detect';
import { cadenceLabel, daysBetween, money, shortDate } from '../lib/format';
import { Drop } from './Landing';

type Decision = 'keep' | 'cancel';
type Filter = 'all' | 'subscription' | 'bill' | 'stopped';

interface Props {
  fileName: string;
  transactions: Transaction[];
  recurring: Recurring[];
  onReset: () => void;
}

function useDecisions(key: string) {
  const storageKey = `drip:decisions:${key}`;
  const [decisions, setDecisions] = useState<Record<string, Decision>>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? '{}');
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(decisions));
    } catch {
      /* storage unavailable, decisions just won't persist */
    }
  }, [storageKey, decisions]);
  return [decisions, setDecisions] as const;
}

export default function Dashboard({ fileName, transactions, recurring, onReset }: Props) {
  const [decisions, setDecisions] = useDecisions(fileName);
  const [filter, setFilter] = useState<Filter>('all');
  const [years, setYears] = useState(10);

  const asOf = transactions[transactions.length - 1].date;
  const from = transactions[0].date;
  const active = recurring.filter((r) => r.active);
  const subs = active.filter((r) => r.kind === 'subscription');

  const monthlyTotal = active.reduce((s, r) => s + r.monthlyCost, 0);
  const subsMonthly = subs.reduce((s, r) => s + r.monthlyCost, 0);
  const canceled = active.filter((r) => decisions[r.id] === 'cancel');
  const savingsMonthly = canceled.reduce((s, r) => s + r.monthlyCost, 0);

  const totalSpend = transactions.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0);
  const months = Math.max(1, daysBetween(from, asOf) / 30.4);
  const shareOfSpend = (monthlyTotal / (totalSpend / months)) * 100;

  const hikes = active.filter((r) => !r.variable && r.priceChangePct > 1);
  const fresh = active.filter((r) => r.isNew);
  const stopped = recurring.filter((r) => !r.active);

  const upcoming = active
    .filter((r) => daysBetween(asOf, r.nextExpected) <= 30 && daysBetween(asOf, r.nextExpected) >= -3)
    .sort((a, b) => a.nextExpected.getTime() - b.nextExpected.getTime());

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of active) m.set(r.category, (m.get(r.category) ?? 0) + r.monthlyCost);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [active]);
  const maxCat = Math.max(...byCategory.map(([, v]) => v), 1);

  const rows = recurring.filter((r) =>
    filter === 'all' ? r.active : filter === 'stopped' ? !r.active : r.active && r.kind === filter,
  );

  const decide = (id: string, d: Decision) =>
    setDecisions((prev) => {
      const next = { ...prev };
      if (next[id] === d) delete next[id];
      else next[id] = d;
      return next;
    });

  const fv = futureValue(savingsMonthly, years);
  const contributed = savingsMonthly * 12 * years;

  return (
    <div className="dash">
      <header className="topbar">
        <div className="brand">
          <Drop /> <span>Drip</span>
        </div>
        <div className="file">
          <span className="mono">{fileName}</span>
          <span className="muted">
            {transactions.length} transactions · {shortDate(from)} {from.getFullYear()} to {shortDate(asOf)}{' '}
            {asOf.getFullYear()}
          </span>
        </div>
        <button className="btn ghost small" onClick={onReset}>
          Load another file
        </button>
      </header>

      <section className="kpis">
        <Kpi label="Recurring per month" value={money(monthlyTotal)} note={`${shareOfSpend.toFixed(0)}% of everything you spend`} />
        <Kpi label="Recurring per year" value={money(monthlyTotal * 12, false)} note={`${active.length} active charges`} />
        <Kpi label="Subscriptions only" value={money(subsMonthly)} note={`${subs.length} services, per month`} />
        <Kpi
          label="Savings from your cancel picks"
          value={money(savingsMonthly * 12, false)}
          note={canceled.length ? `per year, from ${canceled.length} canceled` : 'mark rows "Cancel" below'}
          accent
        />
      </section>

      {(hikes.length > 0 || fresh.length > 0 || stopped.length > 0) && (
        <section className="alerts">
          {hikes.map((r) => (
            <div className="alert hike" key={`h-${r.id}`}>
              <span className="tag">Price went up</span>
              <p>
                <b>{r.merchant}</b> went from {money(r.firstAmount)} to {money(r.lastAmount)} (
                {r.priceChangePct > 0 ? '+' : ''}
                {r.priceChangePct.toFixed(0)}%). That's {money((r.lastAmount - r.firstAmount) * (r.yearlyCost / r.lastAmount))} more a year.
              </p>
            </div>
          ))}
          {fresh.map((r) => (
            <div className="alert new" key={`n-${r.id}`}>
              <span className="tag">New</span>
              <p>
                <b>{r.merchant}</b> started charging {money(r.lastAmount)} {r.cadence} on {shortDate(r.charges[0].date)}. Free
                trial that turned paid?
              </p>
            </div>
          ))}
          {stopped.length > 0 && (
            <div className="alert stopped">
              <span className="tag">Stopped</span>
              <p>
                {stopped.map((r) => r.merchant).join(', ')} stopped charging. Nice, unless you didn't mean to.
              </p>
            </div>
          )}
        </section>
      )}

      <div className="grid">
        <section className="panel list">
          <div className="panel-head">
            <h2>Recurring charges</h2>
            <div className="tabs" role="tablist">
              {(['all', 'subscription', 'bill', 'stopped'] as Filter[]).map((f) => (
                <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
                  {{ all: 'Active', subscription: 'Subscriptions', bill: 'Bills', stopped: 'Stopped' }[f]}
                </button>
              ))}
            </div>
          </div>

          {rows.length === 0 && <p className="empty">Nothing here.</p>}
          <ul className="rows">
            {rows.map((r) => (
              <Row key={r.id} r={r} decision={decisions[r.id]} onDecide={(d) => decide(r.id, d)} />
            ))}
          </ul>
        </section>

        <aside className="side">
          <section className="panel">
            <h2>Coming up in the next 30 days</h2>
            {upcoming.length === 0 && <p className="empty">No charges expected.</p>}
            <ol className="upcoming">
              {upcoming.map((r) => (
                <li key={r.id} className={decisions[r.id] === 'cancel' ? 'struck' : ''}>
                  <span className="mono date">{shortDate(r.nextExpected)}</span>
                  <span className="name">{r.merchant}</span>
                  <span className="mono amt">{r.variable ? '~' : ''}{money(r.lastAmount)}</span>
                </li>
              ))}
            </ol>
            {upcoming.length > 0 && (
              <p className="muted small">Dates are estimated from each charge's usual schedule, counted from your last transaction.</p>
            )}
          </section>

          <section className="panel">
            <h2>Where it goes, per month</h2>
            <ul className="bars">
              {byCategory.map(([cat, v]) => (
                <li key={cat}>
                  <span className="label">{cat}</span>
                  <span className="track">
                    <span className="fill" style={{ width: `${(v / maxCat) * 100}%` }} />
                  </span>
                  <span className="mono">{money(v, false)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel growth">
            <h2>If you invested it instead</h2>
            {savingsMonthly === 0 ? (
              <p className="empty">Mark a few charges "Cancel" to see what that money could grow into.</p>
            ) : (
              <>
                <p className="big mono">{money(fv, false)}</p>
                <p className="muted">
                  after {years} years of putting {money(savingsMonthly)} a month into a broad stock index fund.
                  You'd have put in {money(contributed, false)}; the other {money(fv - contributed, false)} is growth.
                </p>
                <label className="slider">
                  <span>Years</span>
                  <input type="range" min={1} max={30} value={years} onChange={(e) => setYears(+e.target.value)} />
                  <span className="mono">{years}</span>
                </label>
                <details>
                  <summary>How is this calculated?</summary>
                  <p>
                    An index fund is one investment that holds small pieces of hundreds of large companies, so its value
                    tracks the stock market as a whole. Over long periods the US market has averaged about 10% a year,
                    or about 7% after subtracting inflation; this uses 7%. Each month's deposit earns returns, and those returns earn returns too
                    (that's compound growth). Real returns vary a lot year to year, so treat this as an illustration.
                  </p>
                </details>
              </>
            )}
          </section>
        </aside>
      </div>

      <footer className="foot muted small">
        Drip runs entirely in your browser. Nothing you load is uploaded or stored on a server.
      </footer>
    </div>
  );
}

function Kpi({ label, value, note, accent }: { label: string; value: string; note: string; accent?: boolean }) {
  return (
    <div className={`kpi ${accent ? 'accent' : ''}`}>
      <span className="label">{label}</span>
      <span className="value mono">{value}</span>
      <span className="note">{note}</span>
    </div>
  );
}

function Row({ r, decision, onDecide }: { r: Recurring; decision?: Decision; onDecide: (d: Decision) => void }) {
  const recent = r.charges.slice(-12);
  const max = Math.max(...recent.map((c) => c.amount));
  return (
    <li className={`row ${decision ?? ''} ${r.active ? '' : 'inactive'}`}>
      <div className="who">
        <span className="name">{r.merchant}</span>
        <span className="meta">
          {r.category} · {cadenceLabel[r.cadence]}
          {r.isNew && <span className="badge new">new</span>}
          {!r.variable && r.priceChangePct > 1 && <span className="badge hike">+{r.priceChangePct.toFixed(0)}%</span>}
          {r.variable && <span className="badge">amount varies</span>}
        </span>
      </div>
      <div className="spark" aria-label={`${r.charges.length} charges`}>
        {recent.map((c, i) => (
          <span key={i} title={`${shortDate(c.date)}: ${money(c.amount)}`} style={{ height: `${25 + (c.amount / max) * 75}%` }} />
        ))}
      </div>
      <div className="cost">
        <span className="mono">{money(r.lastAmount)}</span>
        <span className="muted small">{money(r.yearlyCost, false)}/yr</span>
      </div>
      <div className="when muted small">
        {r.active ? <>next ~{shortDate(r.nextExpected)}</> : <>last {shortDate(r.lastSeen)}</>}
      </div>
      {r.active ? (
        <div className="decide" role="group" aria-label={`Keep or cancel ${r.merchant}`}>
          <button className={decision === 'keep' ? 'on keep' : ''} onClick={() => onDecide('keep')}>
            Keep
          </button>
          <button className={decision === 'cancel' ? 'on cancel' : ''} onClick={() => onDecide('cancel')}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="decide muted small">stopped</div>
      )}
    </li>
  );
}
