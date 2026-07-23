import Link from "next/link";
import { auth, signOut } from "@/auth";
import { getEmployees, getLeaveTypes, getBalances, getAllocations } from "@/lib/queries";
import { ActionsMenu } from "@/components/actions/actions-menu";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const readOnly = process.env.READ_ONLY !== "false";
  const year = new Date().getFullYear();
  const [employees, leaveTypes, balances, nextYearAllocations] = await Promise.all([
    getEmployees(),
    getLeaveTypes(),
    getBalances(year),
    getAllocations(year + 1),
  ]);

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="min-h-screen">
      {readOnly && (
        <div
          className="flex items-center gap-3 border-b px-6 py-2 text-[13px]"
          style={{ background: "#fff8e0", borderColor: "#ffe082", color: "var(--ink)" }}
        >
          <span
            className="tnum rounded-[5px] border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
            style={{ background: "#ffedb0", borderColor: "#FFC800", color: "#7a5c00" }}
          >
            Read-only
          </span>
          <span className="flex-1">
            Approvals and denials are managed in ClickUp. This tool records, adjusts, and
            exports entries — balances are computed, never typed.
          </span>
        </div>
      )}
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3">
          <h1 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
            PTO Admin
          </h1>
          <nav className="flex gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link href="/">Team Balances</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/log">PTO Log</Link>
            </Button>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ActionsMenu
              employees={employees}
              leaveTypes={leaveTypes}
              balances={balances.map((b) => ({
                employeeId: b.employee.id,
                remaining: b.remaining?.remaining_vacation_days ?? null,
                allotted: b.remaining?.vacation_days_allotted ?? null,
              }))}
              nextYearAllocated={nextYearAllocations.map((a) => a.employee_id)}
            />
            <form action={logout}>
              <Button variant="ghost" size="sm" type="submit">
                Sign out{session?.user?.email ? ` (${session.user.email})` : ""}
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
      <Toaster richColors />
    </div>
  );
}
