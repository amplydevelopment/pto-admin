// Next.js 16 renamed middleware.ts → proxy.ts (runs on the Node.js runtime,
// which the auth check needs since it queries Supabase in `authorize`).
export { auth as proxy } from "@/auth";

export const config = {
  matcher: ["/((?!login|api/auth|_next|favicon.ico).*)"],
};
