import { getPerson } from "@/lib/queries";
import { PersonView } from "@/components/person-view";

export const metadata = { title: "Employee" };

export default async function PersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { id } = await params;
  const year = Number((await searchParams).year) || new Date().getFullYear();
  const data = await getPerson(id, year);

  return <PersonView data={data} year={year} />;
}
