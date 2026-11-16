"use client";

import { canonicalCountryName, countryOptions } from "@/app/lib/country-flag";
import { searchOptions } from "@/lib/search-options";
import { useEffect, useId, useMemo, useState } from "react";

export function CountryPicker({ value, onChange, className = "", label = "Nacionalidad" }: { value: string; onChange: (value: string) => void; className?: string; label?: string }) {
  const id = useId();
  const [text, setText] = useState(() => canonicalCountryName(value));
  const [open, setOpen] = useState(false);
  const [catalogOptions, setCatalogOptions] = useState<typeof countryOptions>([]);
  useEffect(() => { if (!open) setText(canonicalCountryName(value)); }, [open, value]);
  useEffect(() => { void fetch("/api/paises", { cache: "no-store" }).then(async (response) => { const data = await response.json() as { countries?: { name: string }[] }; if (!response.ok) return; setCatalogOptions((data.countries ?? []).map((country) => ({ id: country.name, name: country.name }))); }).catch(() => {}); }, []);
  const options = catalogOptions.length ? catalogOptions : countryOptions;
  const matches = useMemo(() => searchOptions(options, text).slice(0, 12), [options, text]);
  const choose = (country: string) => { onChange(country); setText(country); setOpen(false); };
  return <div className="relative grid gap-1.5 text-sm font-semibold" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label htmlFor={id}>{label}</label>
    <input id={id} name="ctrugby-nationality-country-search" className={className} value={text} autoComplete="new-password" data-lpignore="true" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-options`} placeholder="Escribe para buscar un país…" onFocus={() => setOpen(true)} onChange={(event) => { setText(event.target.value); onChange(event.target.value); setOpen(true); }} />
    {open && <div id={`${id}-options`} role="listbox" className="absolute left-0 top-full z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-neutral-300 bg-white py-1 shadow-lg">
      {!text.trim() && <button type="button" role="option" className="block w-full px-3 py-2 text-left text-xs font-normal text-neutral-600 hover:bg-red-50" onMouseDown={(event) => event.preventDefault()} onClick={() => choose("")}>Sin indicar</button>}
      {matches.map((country) => <button key={country.id} type="button" role="option" className="block w-full px-3 py-2 text-left text-xs font-normal text-neutral-800 hover:bg-red-50" onMouseDown={(event) => event.preventDefault()} onClick={() => choose(country.id)}>{country.name}</button>)}
      {text.trim() && !matches.length && <p className="px-3 py-2 text-xs font-normal text-neutral-500">No hay países que contengan “{text}”.</p>}
    </div>}
  </div>;
}
