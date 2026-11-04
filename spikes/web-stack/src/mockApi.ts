// Stand-in for packages/api-client (issue #12 is not merged yet).
// Same shape the generated client will have: typed calls and the page-number
// envelope from docs/api-conventions.md. Filtering, sorting and paging happen
// here, "on the server", never in the component.
export type Me = { user: { id: number; name: string; language: "es-MX" | "en" }; permissions: string[] };
export type Incident = { code: string; status: "open" | "closed"; type: string; created_at: string };
export type Paged<T> = { count: number; next: string | null; previous: string | null; results: T[] };
export type IncidentParams = { page: number; page_size: number; status?: "open" | "closed"; ordering: string };

const all: Incident[] = Array.from({ length: 57 }, (_, i) => ({
  code: `I-${String(i + 1).padStart(4, "0")}`,
  status: i % 3 === 0 ? "closed" : "open",
  type: ["no_access", "damaged_trap", "lost_device"][i % 3],
  created_at: new Date(Date.UTC(2026, 9, 1 + (i % 28))).toISOString(),
}));

export async function getMe(): Promise<Me> {
  return { user: { id: 1, name: "Sample User", language: "es-MX" }, permissions: ["incidents.view"] };
}

export async function listIncidents(p: IncidentParams): Promise<Paged<Incident>> {
  const rows = p.status ? all.filter((r) => r.status === p.status) : [...all];
  const desc = p.ordering.startsWith("-");
  const key = p.ordering.replace("-", "") as keyof Incident;
  rows.sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * (desc ? -1 : 1));
  const start = (p.page - 1) * p.page_size;
  return {
    count: rows.length,
    next: start + p.page_size < rows.length ? "next" : null,
    previous: p.page > 1 ? "prev" : null,
    results: rows.slice(start, start + p.page_size),
  };
}

// Chart data: weekly index with the numerator and denominator the table also shows.
export const weeklyIndex = [
  { week: "W40", value: 12, denominator: 80 },
  { week: "W41", value: 18, denominator: 82 },
  { week: "W42", value: 9, denominator: 79 },
  { week: "W43", value: 15, denominator: 85 },
];
