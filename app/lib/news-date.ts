// News dates use two-digit years; older four-digit input is normalized on read/save.
export function newsDateLabel(value: string): string | null {
  const date = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/);
  if (date) {
    const year = date[3].length === 2 ? 2000 + Number(date[3]) : Number(date[3]);
    const month = Number(date[2]); const day = Number(date[1]);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (year < 2000 || year > 2099 || parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
    return date[1] + "/" + date[2] + "/" + String(year).slice(-2);
  }
  const season = value.trim().match(/^(\d{2}|\d{4})\s*[/–-]\s*(\d{2}|\d{4})$/);
  if (!season) return null;
  const start = season[1].length === 2 ? 2000 + Number(season[1]) : Number(season[1]);
  const end = season[2].length === 2 ? 2000 + Number(season[2]) : Number(season[2]);
  return start >= 2000 && end <= 2099 && end === start + 1 ? String(start).slice(-2) + "/" + String(end).slice(-2) : null;
}

// A uniform date key keeps bare years, dates and season labels comparable.
export function newsDateSortKey(value: string): string {
  const text = value.trim();
  if (/^20\d{2}$/.test(text)) return text + "-01-01";
  const date = text.match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/);
  if (date && newsDateLabel(text)) return (date[3].length === 2 ? "20" + date[3] : date[3]) + "-" + date[2] + "-" + date[1];
  const season = text.match(/^(\d{2}|\d{4})\s*[/–-]\s*(\d{2}|\d{4})$/);
  if (season) {
    const start = season[1].length === 2 ? "20" + season[1] : season[1];
    const end = season[2].length === 2 ? "20" + season[2] : season[2];
    if (Number(end) >= Number(start)) return start + "-07-01";
  }
  return "";
}
