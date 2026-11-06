type ProfessionalRecord = { id: string; club_id: string | null; club_name: string; category: string; category_id?: string | null; season_label: string | null };
const normalize = (value: string) => value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
const compact = (start: number) => String(start).slice(-2) + "/" + String(start + 1).slice(-2);
function seasonStart(label: string | null) {
  const match = label?.trim().match(/^(\d{4}|\d{2})\s*[/–-]\s*(\d{4}|\d{2})$/);
  if (!match) return null;
  const start = match[1].length === 4 ? Number(match[1]) : 2000 + Number(match[1]);
  const end = match[2].length === 4 ? Number(match[2]) : Math.floor((start + 1) / 100) * 100 + Number(match[2]);
  return end === start + 1 ? start : null;
}

// Summarize only recorded consecutive seasons; gaps and category changes stay separate.
export function summarizeProfessionalClubs<T extends ProfessionalRecord>(records: T[]): T[] {
  const buckets = new Map<string, { record: T; year: number }[]>();
  const summaries: { record: T; latest: number | null }[] = [];
  for (const record of records) {
    const year = seasonStart(record.season_label);
    if (year === null) { summaries.push({ record: { ...record }, latest: null }); continue; }
    const key = JSON.stringify([record.club_id || normalize(record.club_name), record.category_id || normalize(record.category)]);
    const entries = buckets.get(key) ?? [];
    if (!entries.some((entry) => entry.year === year)) entries.push({ record, year });
    buckets.set(key, entries);
  }
  for (const entries of buckets.values()) {
    entries.sort((a, b) => b.year - a.year);
    let current: { record: T; latest: number; earliest: number } | null = null;
    for (const entry of entries) {
      if (current && entry.year === current.earliest - 1) {
        current.earliest = entry.year;
        current.record.season_label = compact(current.earliest) + " – " + compact(current.latest);
      } else {
        current = { record: { ...entry.record, season_label: compact(entry.year) }, latest: entry.year, earliest: entry.year };
        summaries.push(current);
      }
    }
  }
  return summaries.sort((a, b) => (b.latest ?? -Infinity) - (a.latest ?? -Infinity)).map((group) => group.record);
}
