"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function LoginToast({ error }: { error?: string }) {
  useEffect(() => {
    if (!error) return;
    // defer one tick so the Toaster is mounted/subscribed before we fire
    const t = setTimeout(() => toast.error("Invalid Credentials!"), 0);
    return () => clearTimeout(t);
  }, [error]);
  return null;
}
