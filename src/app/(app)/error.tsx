"use client";

import { Button } from "@/components/ui/button";

// Catches anything thrown while loading data (bad Supabase key, network,
// query error) and shows a recoverable message instead of a crash screen.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto mt-24 max-w-md space-y-4 text-center">
      <h2 className="text-base font-medium">Couldn't load data</h2>
      <p className="text-sm text-muted-foreground">
        {error.message || "Something went wrong talking to the database."}
      </p>
      <p className="text-xs text-muted-foreground">
        If this keeps happening, check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
        in .env.local.
      </p>
      <Button variant="outline" size="sm" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
