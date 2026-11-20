import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import {
  HINT_IMPOSSIBLE_MESSAGE,
  HINT_SHEET_TITLE,
  HINT_TIERS,
  HINT_TIER_COPY,
  HINT_UNAVAILABLE_MESSAGE,
  type HintOffer,
  type HintTier,
} from "@/lib/pips/hints";
import { cn } from "@/lib/utils";

export type HintView =
  | { status: "searching" }
  | { status: "ready"; offer: HintOffer }
  | { status: "impossible" }
  | { status: "unavailable" };

function Pips({ count }: { count: number }) {
  return (
    <span className="hint-pips" aria-hidden="true">
      {HINT_TIERS.map((n) => (
        <i key={n} className={n <= count ? "on" : undefined} />
      ))}
    </span>
  );
}

export function HintDialog({
  view,
  onBuy,
  onClose,
}: {
  view: HintView;
  onBuy: (tier: HintTier) => void;
  onClose: () => void;
}) {
  // Placing a domino is the one purchase that also moves the board, so it asks twice.
  const [confirmPlace, setConfirmPlace] = useState(false);
  const offer = view.status === "ready" ? view.offer : null;
  const unlocked = offer?.highestTier ?? 0;
  useEffect(() => setConfirmPlace(false), [offer?.id]);

  const price = () => "Free";

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="hint-dialog">
        <DialogTitle>{HINT_SHEET_TITLE}</DialogTitle>
        <DialogDescription>
          All hints are free. Use any level of help without adding time or affecting your score. The
          play clock keeps running.
        </DialogDescription>

        {view.status === "searching" ? (
          <p className="mt-4 text-sm" role="status" aria-live="polite">
            Finding a move that still leads to a solution…
          </p>
        ) : view.status === "impossible" ? (
          <p className="mt-4 text-sm text-bad-ink" role="status">
            {HINT_IMPOSSIBLE_MESSAGE}
          </p>
        ) : view.status === "unavailable" ? (
          <p className="mt-4 text-sm" role="status">
            {HINT_UNAVAILABLE_MESSAGE}
          </p>
        ) : null}

        <ul className="mt-4 flex flex-col gap-2" aria-label="Hint levels">
          {HINT_TIERS.map((tier) => {
            const copy = HINT_TIER_COPY[tier];
            const owned = tier <= unlocked;
            const confirming = tier === 3 && confirmPlace;
            return (
              <li key={tier} className={cn("hint-tier", owned && "hint-tier-owned")}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-medium">
                    <Pips count={copy.pips} />
                    {copy.name}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{copy.description}</p>
                </div>
                {owned && tier === 3 ? (
                  // Already paid for: undoing the placement can put the domino back for free.
                  <Button
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    onClick={() => onBuy(3)}
                  >
                    Place again
                  </Button>
                ) : owned ? (
                  <span className="shrink-0 text-xs text-muted-foreground">Unlocked</span>
                ) : confirming ? (
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Button size="sm" onClick={() => onBuy(tier)}>
                      Place · {price()}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmPlace(false)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="shrink-0 tabular-nums"
                    disabled={!offer}
                    aria-label={`${copy.name}, ${price()}`}
                    onClick={() => (tier === 3 ? setConfirmPlace(true) : onBuy(tier))}
                  >
                    {price()}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
