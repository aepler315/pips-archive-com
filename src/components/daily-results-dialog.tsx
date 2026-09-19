import { useMemo, useRef, useState } from "react";
import { Download, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { DailyResultsCard } from "./daily-results-card";
import type { DayResults } from "@/lib/pips/daily-results";
import type { RawDay } from "@/lib/pips/engine";
import { getStapipstics } from "@/lib/pips/stapipstics";
import { buildDailyShareText, copyDailyResults } from "@/lib/pips/result-sharing";
import { downloadResultsPng } from "@/lib/pips/result-image";

import { useAllResults } from "@/lib/pips/use-daily-results";
import { buildPersistentMetrics } from "@/lib/pips/result-metrics";

export function DailyResultsDialog({
  summary,
  raw,
  reason,
  onClose,
  restoreFocus,
}: {
  summary: DayResults;
  raw: RawDay;
  reason: "automatic" | "manual";
  onClose: () => void;
  restoreFocus: () => void;
}) {
  const history = useAllResults();
  const metrics = useMemo(
    () => buildPersistentMetrics(summary, history.results),
    [summary, history.results],
  );
  const facts = useMemo(() => getStapipstics(summary, raw), [summary, raw]);
  const text = summary.complete ? buildDailyShareText(summary) : "";
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [imageStatus, setImageStatus] = useState<"idle" | "busy" | "ready" | "error">("idle");
  const exporting = useRef(false);
  const visibleCard = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  async function share() {
    setCopied(false);
    setCopyError(false);
    try {
      await copyDailyResults(text, navigator.clipboard);
      setCopied(true);
    } catch {
      setCopyError(true);
    }
  }
  async function download() {
    if (exporting.current || !visibleCard.current) return;
    exporting.current = true;
    setImageStatus("busy");
    try {
      const node = visibleCard.current.firstElementChild as HTMLElement;
      await downloadResultsPng(node, summary.date);
      setImageStatus("ready");
    } catch {
      setImageStatus("error");
    } finally {
      exporting.current = false;
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className={`daily-results-dialog ${reason === "automatic" ? "results-automatic" : ""}`}
        closeClassName="results-close"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          titleRef.current?.focus();
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          restoreFocus();
        }}
      >
        <DialogTitle ref={titleRef} tabIndex={-1} className="sr-only">
          {summary.complete ? "Daily results — all three complete" : "Daily results — in progress"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Your first recorded times and puzzle facts for {summary.date}.
        </DialogDescription>
        {reason === "automatic" ? (
          <div className="results-confetti" aria-hidden="true">
            {Array.from({ length: 14 }, (_, i) => (
              <i key={i} style={{ "--pip-i": i } as React.CSSProperties} />
            ))}
          </div>
        ) : null}
        <div className="results-scroll" ref={visibleCard}>
          <DailyResultsCard summary={summary} facts={facts} metrics={metrics} />
        </div>
        <div className="results-actions">
          <div className="results-action-buttons">
            <Button
              variant="secondary"
              onClick={() => void download()}
              disabled={imageStatus === "busy" || !history.ready}
            >
              <Download size={16} />
              {imageStatus === "busy" ? "Generating…" : "Download PNG"}
            </Button>
            <Button onClick={() => void share()} disabled={!summary.complete}>
              <Copy size={16} />
              {copied ? "Copied!" : "Share"}
            </Button>
          </div>
          {!summary.complete ? <p>Finish all three to share your times.</p> : null}
          <p role="status" aria-live="polite">
            {imageStatus === "error"
              ? "Couldn’t create the PNG. Please try again."
              : imageStatus === "ready"
                ? "PNG ready"
                : copied
                  ? "Results copied to clipboard."
                  : ""}
          </p>
          {copyError ? (
            <div role="alert">
              <p>Clipboard unavailable. Select and copy your results:</p>
              <textarea
                aria-label="Results to copy"
                readOnly
                value={text}
                onFocus={(e) => e.target.select()}
                rows={4}
              />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
