import type { ErrorComponentProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

export function AppErrorComponent({ error }: ErrorComponentProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center text-foreground">
      <span className="text-bad-ink" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="font-display text-lg font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        This page hit a snag and couldn&apos;t load. Your solve history lives in this browser and
        wasn&apos;t affected.
      </p>
      <Link
        to="/"
        className="mt-2 inline-flex h-9 items-center rounded-full bg-foreground px-4 text-sm font-medium text-background no-underline hover:bg-foreground/90"
      >
        Back to the archive
      </Link>
      {error.message ? (
        <p className="mt-4 max-w-md text-xs break-words text-muted-foreground/70">
          {error.message}
        </p>
      ) : null}
    </main>
  );
}
