"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";

// Client-side name filter for any table. Hides rows in `bodySelector` whose
// data-name doesn't include the query. Clear button appears once there's text.
export function NameSearch({
  bodySelector,
  placeholder = "Search by name…",
}: {
  bodySelector: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");

  function apply(q: string) {
    setValue(q);
    const term = q.toLowerCase().trim();
    const body = document.querySelector(bodySelector);
    body?.querySelectorAll<HTMLElement>("tr[data-name]").forEach((row) => {
      row.style.display = !term || row.dataset.name!.includes(term) ? "" : "none";
    });
  }

  return (
    <div className="relative w-[230px]">
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => apply(e.target.value)}
        className="h-[33px] rounded-lg pr-8 text-[13px] focus-visible:ring-primary/15"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => apply("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
