// A range covers rugby seasons ending after the first year through the last.
export function trajectorySeasonYears(value: string): number[] {
  const text = value.trim();
  if (/^20\d{2}$/.test(text)) {
    const year = Number(text);
    return year <= 2035 ? [year] : [];
  }
  const match = text.match(/^(?:20)?(\d{2})\s*[/–-]\s*(?:20)?(\d{2})$/);
  if (!match) return [];
  const start = 2000 + Number(match[1]);
  const end = 2000 + Number(match[2]);
  if (end <= start || end > 2035) return [];
  return Array.from({ length: end - start }, (_, index) => start + index + 1);
}
