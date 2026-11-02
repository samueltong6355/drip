import { useMemo, useState } from 'react';
import { parseStatement } from './lib/parse';
import { detectRecurring } from './lib/detect';
import { sampleCsv } from './lib/sample';
import type { Transaction } from './lib/types';
import Landing from './components/Landing';
import Dashboard from './components/Dashboard';

interface Loaded {
  name: string;
  transactions: Transaction[];
}

export default function App() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recurring = useMemo(() => (loaded ? detectRecurring(loaded.transactions) : []), [loaded]);

  const load = (name: string, csv: string) => {
    const { transactions, error } = parseStatement(csv);
    if (error) return setError(error);
    setError(null);
    setLoaded({ name, transactions });
  };

  if (!loaded) {
    return (
      <Landing
        error={error}
        onFile={async (f) => load(f.name, await f.text())}
        onSample={() => load('sample-checking-statement.csv', sampleCsv())}
      />
    );
  }

  return (
    <Dashboard
      fileName={loaded.name}
      transactions={loaded.transactions}
      recurring={recurring}
      onReset={() => setLoaded(null)}
    />
  );
}
