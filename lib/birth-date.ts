export function parseBirthInput(value: unknown): {birth_year:number|null;birth_date:string|null} | null {
  const text = value == null ? "" : String(value).trim();
  if (!text) return {birth_year:null,birth_date:null};
  const currentYear = Number(new Intl.DateTimeFormat("en", {timeZone:"Europe/Madrid",year:"numeric"}).format(new Date()));
  if (/^\d{4}$/.test(text)) {const year=Number(text);return year>=1900 && year<=currentYear ? {birth_year:year,birth_date:null} : null;}
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const short = /^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/.exec(text);
  if (!iso && !short) return null;
  const day = Number(iso ? iso[3] : short![1]);
  const month = Number(iso ? iso[2] : short![2]);
  const suffix = Number(short?.[3]);
  const year = iso ? Number(iso[1]) : short![3].length === 4 ? suffix : suffix + (suffix<=currentYear%100 ? 2000 : 1900);
  const date = new Date(Date.UTC(year,month-1,day));
  if (year<1900 || year>currentYear || date.getUTCFullYear()!==year || date.getUTCMonth()!==month-1 || date.getUTCDate()!==day) return null;
  return {birth_year:year,birth_date:date.toISOString().slice(0,10)};
}
export function formatBirthInput(date?: string|null, year?: number|null): string {
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date.slice(8,10)+"/"+date.slice(5,7)+"/"+date.slice(2,4);
  return year ? String(year) : "";
}

export function formatBirthEditInput(date?: string|null, year?: number|null): string {
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date.slice(8,10)+"/"+date.slice(5,7)+"/"+date.slice(0,4);
  return year ? String(year) : "";
}
