import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client, server-side only. The browser never gets a Supabase key.
export const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
