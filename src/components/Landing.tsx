import { useRef, useState } from 'react';
import { sampleCsv } from '../lib/sample';

interface Props {
  error: string | null;
  onFile: (f: File) => void;
  onSample: () => void;
}

export default function Landing({ error, onFile, onSample }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const downloadSample = () => {
    const url = URL.createObjectURL(new Blob([sampleCsv()], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'sample-checking-statement.csv' });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="landing">
      <header className="brand">
        <Drop /> <span>Drip</span>
      </header>

      <section className="hero">
        <p className="eyebrow">Recurring charge finder</p>
        <h1>
          Find the money that leaves <em>quietly.</em>
        </h1>
        <p className="lede">
          Drop in a bank statement. Drip finds every subscription and repeating bill, flags price hikes you didn't
          notice, and shows what canceling the ones you don't use would be worth over time.
        </p>

        <div
          className={`dropzone ${over ? 'over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const f = e.dataTransfer.files[0];
            if (f) onFile(f);
          }}
          onClick={() => input.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && input.current?.click()}
        >
          <input
            ref={input}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          <strong>Drop a CSV statement here</strong>
          <span>or click to choose a file. Most banks let you export one from the transactions page.</span>
        </div>

        <div className="hero-actions">
          <button className="btn primary" onClick={onSample}>
            Try it with sample data
          </button>
          <button className="btn ghost" onClick={downloadSample}>
            Download the sample CSV
          </button>
        </div>

        {error && <p className="error">{error}</p>}
        <p className="privacy">Your file is read in your browser and never uploaded anywhere.</p>
      </section>

      <section className="how">
        <div>
          <span className="step">01</span>
          <h3>Group</h3>
          <p>Cleans up messy bank descriptions like "NETFLIX.COM 866-579-7172 CA" so each company's charges line up.</p>
        </div>
        <div>
          <span className="step">02</span>
          <h3>Detect</h3>
          <p>Looks for charges that repeat on a schedule (weekly, monthly, yearly) at a steady price.</p>
        </div>
        <div>
          <span className="step">03</span>
          <h3>Decide</h3>
          <p>Mark each one keep or cancel and see your yearly savings, plus what that money could grow into.</p>
        </div>
      </section>
    </div>
  );
}

export function Drop() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden>
      <path d="M16 3C16 3 6 15 6 21a10 10 0 0 0 20 0C26 15 16 3 16 3z" fill="var(--leak)" />
    </svg>
  );
}
