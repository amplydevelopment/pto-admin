import { getLog } from "@/lib/queries";
import { LogTable } from "@/components/log-table";
import { LogStatusFilter } from "@/components/log-filters";
import { NameSearch } from "@/components/name-search";
import { YearTabs } from "@/components/pto-ui";
import { Button } from "@/components/ui/button";

export const metadata = { title: "PTO Log" };

export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; status?: string }>;
}) {
  const params = await searchParams;
  const year = Number(params.year) || new Date().getFullYear();

  const requests = await getLog({ year, status: params.status });

  const exportQuery = new URLSearchParams({ year: String(year) });
  if (params.status) exportQuery.set("status", params.status);

  const yearHref = (y: number) =>
    `/log?year=${y}${params.status ? `&status=${params.status}` : ""}`;

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <NameSearch bodySelector="[data-log-body]" />
        <YearTabs year={year} hrefFor={yearHref} />
        <LogStatusFilter year={year} status={params.status ?? ""} />
        <Button asChild variant="outline" size="sm" className="ml-auto">
          <a href={`/api/export/log?${exportQuery}`}>Export CSV</a>
        </Button>
      </div>
      <LogTable requests={requests} />
      <p className="border-t px-4 py-3 text-xs text-muted-foreground">
        Showing {requests.length} request(s) with a start date in {year}.
      </p>
    </div>
  );
}
