import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { LEVELS } from "@/lib/pips/engine";
import { allResults, eraseAll, exportAll, fmt, importAll } from "@/lib/pips/store";
import { cn } from "@/lib/utils";

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
  const [importStatus, setImportStatus] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => setReady(true), []);
  // rev is bumped after import/erase to force a re-read of localStorage.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const res = useMemo(() => (ready ? allResults() : []), [rev, ready]);
  const days = new Set(res.map((r) => r.date));
  const fullDays = [...days].filter((d) =>
    LEVELS.every((l) => res.some((r) => r.date === d && r.level === l)),
  ).length;
  let streak = 0;
  {
    const sorted = [...days].sort().reverse();
    const oneDayMs = 864e5;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const mostRecent = sorted[0];
    // A streak is only "current" if it reaches through today or yesterday —
    // otherwise it's a run from the past that already ended, not a live one.
    const isLive =
      !!mostRecent &&
      (mostRecent === today ||
        new Date(today).getTime() - new Date(mostRecent).getTime() === oneDayMs);
    if (isLive) {
      let cur: string | null = null;
      for (const d of sorted) {
        if (cur && new Date(cur).getTime() - new Date(d).getTime() !== oneDayMs) break;
        streak++;
        cur = d;
      }
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
        <Stat k="Current streak" v={String(streak)} />
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

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            const blob = new Blob([exportAll()], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = Object.assign(document.createElement("a"), {
              href: url,
              download: `pips-archive-${new Date().toISOString().slice(0, 10)}.json`,
            });
            // Firefox needs the anchor in the document to honor `download`,
            // and revoking the URL synchronously can race the download —
            // both silent failures with no error to notice. Keep the anchor
            // around and delay the revoke instead.
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          Export
        </Button>
        <Button variant="secondary" onClick={() => fileRef.current?.click()}>
          Import
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost">Erase everything</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Erase all solve data?</AlertDialogTitle>
            <AlertDialogDescription>
              Every solve time and in-progress board in this browser is deleted. Export a copy
              first if you want to keep it — this can&apos;t be undone.
            </AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                destructive
                onClick={() => {
                  eraseAll();
                  setRev((n) => n + 1);
                }}
              >
                Erase everything
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const { imported, progress, skipped } = importAll(await f.text());
              const text =
                `Imported ${imported} result${imported === 1 ? "" : "s"}.` +
                (progress
                  ? ` Restored ${progress} unfinished board${progress === 1 ? "" : "s"}.`
                  : "") +
                (skipped ? ` Skipped ${skipped} malformed entr${skipped === 1 ? "y" : "ies"}.` : "");
              setImportStatus({ ok: true, text });
              setRev((x) => x + 1);
            } catch (err) {
              setImportStatus({ ok: false, text: `Import failed: ${(err as Error).message}` });
            } finally {
              e.target.value = "";
            }
          }}
        />
        {importStatus ? (
          <span
            role="status"
            className={cn("text-sm", importStatus.ok ? "text-ok-ink" : "text-bad-ink")}
          >
            {importStatus.text}
          </span>
        ) : null}
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
