type Option = {id: string; name: string};
const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/[^a-z0-9]+/g, " ").trim();
export function searchOptions<T extends Option>(options: readonly T[], query: string): T[] {
  const words = normalized(query).split(/\s+/).filter(Boolean);
  return options.filter(option => {
    const text = normalized(option.name + " " + option.id);
    const initials = normalized(option.name).split(/\s+/).map(word => word[0]).join("");
    return words.every(word => text.includes(word) || initials === word);
  }).sort((a,b) => a.name.localeCompare(b.name, "es", {sensitivity:"base",numeric:true}) || a.id.localeCompare(b.id));
}
