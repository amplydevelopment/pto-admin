import Link from "next/link";
import { getBalances } from "@/lib/queries";
import { Avatar, RemainingCell, TypeBadge, YearTabs } from "@/components/pto-ui";
import { PersonSheet } from "@/components/person-sheet";
import { NameSearch } from "@/components/name-search";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Team Balances" };

export default async function BalancesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; all?: string }>;
}) {
  const params = await searchParams;
  const currentYear = new Date().getFullYear();
  const year = Number(params.year) || currentYear;
  const showAll = params.all === "1";

  const balances = await getBalances(year);
  const rows = showAll ? balances : balances.filter((b) => b.employee.status === "active");

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <NameSearch bodySelector="[data-balances-body]" />
        <YearTabs
          year={year}
          hrefFor={(y) => `/?year=${y}${showAll ? "&all=1" : ""}`}
        />
        <Button asChild variant="ghost" size="sm">
          <Link href={`/?year=${year}${showAll ? "" : "&all=1"}`}>
            {showAll ? "Hide inactive" : "Show inactive"}
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="ml-auto">
          <a href={`/api/export/balances?year=${year}`}>Export CSV</a>
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Allotted</TableHead>
            <TableHead className="text-right">Vacation</TableHead>
            <TableHead className="text-right">Sick</TableHead>
            <TableHead className="text-right">Birthday</TableHead>
            <TableHead className="text-right">Maternity</TableHead>
            <TableHead className="text-right">Paternity</TableHead>
            <TableHead className="text-right">Unpaid</TableHead>
            <TableHead className="text-right">Remaining</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody data-balances-body>
          {rows.map(({ employee, usage, remaining }) => (
            <TableRow
              key={employee.id}
              data-name={employee.display_name.toLowerCase()}
              className={employee.status === "inactive" ? "opacity-45" : ""}
            >
              <TableCell>
                <PersonSheet employeeId={employee.id} year={year} className="group flex items-center gap-2.5">
                  <Avatar name={employee.display_name} />
                  <span className="flex flex-col">
                    <span className="font-medium text-foreground group-hover:underline">
                      {employee.display_name}
                    </span>
                    <span className="text-xs text-muted-foreground">{employee.email}</span>
                  </span>
                </PersonSheet>
              </TableCell>
              <TableCell><TypeBadge type={employee.employment_type} /></TableCell>
              <TableCell className="tnum text-right text-muted-foreground">{remaining?.vacation_days_allotted ?? "—"}</TableCell>
              <TableCell className="tnum text-right">{usage?.vacation_used || <Dot />}</TableCell>
              <TableCell className="tnum text-right">{usage?.sick_used || <Dot />}</TableCell>
              <TableCell className="tnum text-right">{usage?.birthday_used || <Dot />}</TableCell>
              <TableCell className="tnum text-right">{usage?.maternity_used || <Dot />}</TableCell>
              <TableCell className="tnum text-right">{usage?.paternity_used || <Dot />}</TableCell>
              <TableCell className="tnum text-right">{usage?.unpaid_used || <Dot />}</TableCell>
              <TableCell className="text-right">
                <RemainingCell
                  remaining={remaining?.remaining_vacation_days ?? null}
                  allotted={remaining?.vacation_days_allotted ?? null}
                  used={remaining?.vacation_used ?? null}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <p className="border-t px-4 py-3 text-xs text-muted-foreground">
        Numbers are computed live from approved and completed requests — they can&apos;t be edited
        directly. To change someone&apos;s allowance, use “Adjust allocation”.
      </p>
    </div>
  );
}

function Dot() {
  return <span className="text-muted-foreground/40">·</span>;
}
