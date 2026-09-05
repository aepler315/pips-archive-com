import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { LEVELS } from "@/lib/pips/engine";
import { allResults, eraseAll, exportAll, fmt, importAll } from "@/lib/pips/store";

export const Route = createFileRoute("/stats")({ component: StatsPage });

const median = (xs: number[]) => {
  const s = xs.slice().sort((a, b) => a - b);
  if (!s.length) return 0;
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function StatsPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rev, setRev] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const res = useMemo(() => (ready ? allResults() : []), [rev, ready]);
  const days = new Set(res.map((r) => r.date));
  const fullDays = [...days].filter((d) =>
    LEVELS.every((l) => res.some((r) => r.date === d && r.level === l)),
  ).length;
  let streak = 0;
  {
    const sorted = [...days].sort().reverse();
    let cur: string | null = null;
    for (const d of sorted) {
      if (cur && new Date(cur).getTime() - new Date(d).getTime() !== 864e5) break;
      streak++;
      cur = d;
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-[720px] px-4 py-5 sm:px-6">
      <SiteHeader current="stats" />
      <h1 className="font-display mt-8 text-[1.65rem] font-semibold tracking-tight">Your solves</h1>
      <p className="mt-1 mb-5 text-muted-foreground">
        Stored only in this browser. Export to keep a copy or move it elsewhere.
      </p>

      <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Stat k="Puzzles solved" v={String(res.length)} />
        <Stat k="Days fully solved" v={String(fullDays)} />
        <Stat k="Consecutive dates" v={String(streak)} />
      </div>

      <table className="w-full border-collapse tabular-nums">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="py-2 font-medium">Level</th>
            <th className="py-2 text-right font-medium">Solved</th>
            <th className="py-2 text-right font-medium">Best</th>
            <th className="py-2 text-right font-medium">Median</th>
            <th className="py-2 text-right font-medium">Mean</th>
          </tr>
        </thead>
        <tbody>
          {LEVELS.map((l) => {
            const xs = res.filter((r) => r.level === l).map((r) => r.best);
            return (
              <tr key={l} className="border-t border-border">
                <td className="py-2 capitalize">{l}</td>
                <td className="py-2 text-right">{xs.length}</td>
                <td className="py-2 text-right">{xs.length ? fmt(Math.min(...xs)) : "–"}</td>
                <td className="py-2 text-right">{xs.length ? fmt(median(xs)) : "–"}</td>
                <td className="py-2 text-right">{xs.length ? fmt(mean(xs)) : "–"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h2 className="font-display mt-8 text-xl font-semibold">Recent</h2>
      <table className="mt-2 w-full border-collapse tabular-nums">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="py-2 font-medium">Date</th>
            <th className="py-2 font-medium">Level</th>
            <th className="py-2 text-right font-medium">First</th>
            <th className="py-2 text-right font-medium">Best</th>
          </tr>
        </thead>
        <tbody>
          {res.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-3 text-muted-foreground">
                Nothing yet. <Link to="/">Pick a puzzle</Link>.
              </td>
            </tr>
          ) : (
            res
              .slice()
              .sort((a, b) => b.lastAt.localeCompare(a.lastAt))
              .slice(0, 30)
              .map((r) => (
                <tr key={`${r.date}-${r.level}`} className="border-t border-border">
                  <td className="py-2">
                    <Link to="/play/$date/$level" params={{ date: r.date, level: r.level }}>
                      {r.date}
                    </Link>
                  </td>
                  <td className="py-2 capitalize">{r.level}</td>
                  <td className="py-2 text-right">{fmt(r.first)}</td>
                  <td className="py-2 text-right">{fmt(r.best)}</td>
                </tr>
              ))
          )}
        </tbody>
      </table>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            const blob = new Blob([exportAll()], { type: "application/json" });
            const a = Object.assign(document.createElement("a"), {
              href: URL.createObjectURL(blob),
              download: `pips-archive-${new Date().toISOString().slice(0, 10)}.json`,
            });
            a.click();
            URL.revokeObjectURL(a.href);
          }}
        >
          Export
        </Button>
        <Button variant="secondary" onClick={() => fileRef.current?.click()}>
          Import
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            if (confirm("Erase all solve data in this browser?")) {
              eraseAll();
              setRev((n) => n + 1);
            }
          }}
        >
          Erase everything
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const n = importAll(await f.text());
              alert(`Imported ${n} results.`);
              setRev((x) => x + 1);
            } catch (err) {
              alert(`Import failed: ${(err as Error).message}`);
            }
          }}
        />
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-card p-3.5 shadow-[inset_0_0_0_1px_var(--color-border)]">
      <div className="text-sm text-muted-foreground">{k}</div>
      <div className="text-[1.3rem] font-semibold tabular-nums">{v}</div>
    </div>
  );
}
