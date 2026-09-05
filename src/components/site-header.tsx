import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function SiteHeader({ current }: { current: "archive" | "stats" | "play" }) {
  const item = (to: string, id: "archive" | "stats", label: string) => (
    <Link
      to={to}
      className={cn(
        "text-sm text-muted-foreground no-underline transition-colors hover:text-foreground",
        current === id && "text-foreground underline decoration-foreground/30 underline-offset-4",
      )}
    >
      {label}
    </Link>
  );
  return (
    <header className="flex items-baseline justify-between gap-3">
      <Link to="/" className="font-display text-lg font-semibold tracking-tight text-foreground no-underline">
        Pips Archive
      </Link>
      <nav className="flex gap-4">
        {item("/", "archive", "Archive")}
        {item("/stats", "stats", "Stats")}
      </nav>
    </header>
  );
}
