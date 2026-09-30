import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { CATEGORY_DETAILS } from '../../components/shared/CategoryChip';
import { WasteCategory } from '../../types/api';
export function DisposalGuide() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api
      .get('/config')
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <div className="space-y-4">
      <Link to="/" className="text-sm">
        ← Home
      </Link>
      <h1 className="font-serif text-3xl">Which waste goes where?</h1>
      <p className="text-sm text-ink-2">
        Separate at source. Check what a receiving service accepts before travelling or arranging
        collection.
      </p>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p>Loading guidance…</p>}
      {data?.disposalGuides.map((g: any) => (
        <section key={g.category} className="bg-surface p-4 rounded-card border border-line">
          <h2 className="font-semibold">
            {CATEGORY_DETAILS[g.category as WasteCategory]?.label} · {g.title}
          </h2>
          <p className="text-sm text-ink-2 mt-2">{g.message}</p>
        </section>
      ))}
      <section className="bg-moss-100 p-4 rounded-card space-y-2">
        <h2 className="font-semibold">Official resources</h2>
        {data?.disposalSources.map((s: any) => (
          <a
            key={s.url}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-sm underline text-moss"
          >
            {s.name} ↗
          </a>
        ))}
        <p className="text-xs">
          These links help you verify options. CivicClean is an independent pilot; it does not book
          government or recycler pickups through these websites.
        </p>
      </section>
      <Link
        to="/report?mode=household"
        className="block bg-moss text-white p-4 rounded-card text-center font-semibold"
      >
        Request disposal help
      </Link>
    </div>
  );
}
