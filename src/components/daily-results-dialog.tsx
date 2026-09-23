import { loadDayAnalysis, type DayAnalysis } from "@/lib/pips/puzzle-analysis";
import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, Send, Share2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { DailyResultsCard } from "./daily-results-card";
import type { DayResults } from "@/lib/pips/daily-results";
import type { RawDay } from "@/lib/pips/engine";
import { getStapipstics } from "@/lib/pips/stapipstics";
import { buildDailyShareText, copyDailyResults } from "@/lib/pips/result-sharing";
import { renderResultsPng, saveResultsPng } from "@/lib/pips/result-image";
import { sendToShelfDrop } from "@/lib/pips/shelf-drop";

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
  const [analysis, setAnalysis] = useState<DayAnalysis>({});
  useEffect(() => {
    let active = true;
    void loadDayAnalysis(raw).then((a) => {
      if (active) setAnalysis(a);
    });
    return () => {
      active = false;
    };
  }, [raw]);
  const metrics = useMemo(
    () => buildPersistentMetrics(summary, history.results),
    [summary, history.results],
  );
  const facts = useMemo(
    () => getStapipstics(summary, raw, history.results),
    [summary, raw, history.results],
  );
  const display = { summary, facts, metrics, analysis };
  const [capture, setCapture] = useState<typeof display | null>(null);
  const text = summary.complete ? buildDailyShareText(summary) : "";
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [copyError, setCopyError] = useState(false);
  const [imageStatus, setImageStatus] = useState<"idle" | "busy" | "ready" | "error">("idle");
  const exporting = useRef(false);
  const visibleCard = useRef<HTMLDivElement>(null);
  const shareRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setMenuOpen(false);
      shareRef.current?.querySelector("button")?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (shareRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [menuOpen]);
  async function renderedCard() {
    if (exporting.current || !visibleCard.current) throw new Error("The results card is not ready");
    exporting.current = true;
    setCapture(display);
    setMenuOpen(false);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    try {
      const node = visibleCard.current?.firstElementChild as HTMLElement | null;
      if (!node) throw new Error("The results card is not laid out");
      return await renderResultsPng(node, summary.date);
    } finally {
      exporting.current = false;
      setCapture(null);
    }
  }
  async function copy() {
    setMenuOpen(false);
    setNotice("");
    setCopyError(false);
    try {
      await copyDailyResults(text, navigator.clipboard);
      setNotice("Results copied to clipboard.");
    } catch {
      setCopyError(true);
    }
  }
  async function sendShelf() {
    setNotice("");
    setCopyError(false);
    setImageStatus("busy");
    try {
      const blob = await renderedCard();
      setNotice(await sendToShelfDrop(`pips-${summary.date}.png`, new Uint8Array(await blob.arrayBuffer())));
      setImageStatus("idle");
    } catch {
      setImageStatus("error");
    }
  }
  async function download() {
    setNotice("");
    setImageStatus("busy");
    try {
      const blob = await renderedCard();
      saveResultsPng(blob, summary.date);
      setImageStatus("ready");
      setNotice("PNG ready");
    } catch {
      setImageStatus("error");
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
          {summary.complete ? "Pips results — all three complete" : "Pips results — in progress"}
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
          <DailyResultsCard {...(capture ?? display)} />
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
            <div className="results-share" ref={shareRef}>
              <Button
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                disabled={!summary.complete || imageStatus === "busy"}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <Share2 size={16} />
                Share
              </Button>
              {menuOpen ? (
                <div className="results-share-menu" role="menu" aria-label="Share results">
                  <Button variant="ghost" role="menuitem" onClick={() => void copy()}>
                    <Copy size={16} />
                    Copy
                  </Button>
                  <Button variant="ghost" role="menuitem" onClick={() => void sendShelf()}>
                    <Send size={16} />
                    Send to ShelfDrop
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
          {!summary.complete ? <p>Finish all three to share your times.</p> : null}
          <p role="status" aria-live="polite">
            {imageStatus === "error" ? "Couldn’t create the PNG. Please try again." : notice}
          </p>
          {copyError ? (
            <div role="alert">
              <p>Clipboard unavailable. Select and copy your results:</p>
              <textarea
                aria-label="Results to copy"
                readOnly
                value={text}
                onFocus={(e) => e.target.select()}
                rows={5}
              />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
