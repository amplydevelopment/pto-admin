"use client";

import { useState, useTransition } from "react";
import type { getPerson } from "@/lib/queries";
import { loadPerson } from "@/lib/person-action";
import { PersonView } from "@/components/person-view";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";

type PersonData = Awaited<ReturnType<typeof getPerson>>;

// Wraps an employee name: normal click opens the right-side Sheet and loads
// the person on demand; the underlying href keeps deep-links / middle-click
// working to the real /person/[id] page.
export function PersonSheet({
  employeeId,
  year,
  children,
  className,
}: {
  employeeId: string;
  year: number;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<PersonData | null>(null);
  const [pending, startTransition] = useTransition();

  function openSheet(e: React.MouseEvent) {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return; // let new-tab/deep-link through
    e.preventDefault();
    setOpen(true);
    setData(null);
    startTransition(async () => {
      setData(await loadPerson(employeeId, year));
    });
  }

  return (
    <>
      <a href={`/person/${employeeId}?year=${year}`} onClick={openSheet} className={className}>
        {children}
      </a>
      <Sheet open={open} onOpenChange={setOpen}>
        {/* !max-w overrides shadcn's built-in data-[side=right]:sm:max-w-sm cap */}
        <SheetContent className="w-full gap-0 overflow-y-auto p-6 sm:!max-w-4xl">
          <SheetHeader className="sr-only p-0">
            <SheetTitle>Employee details</SheetTitle>
          </SheetHeader>
          {pending || !data ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <PersonView data={data} year={year} />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
