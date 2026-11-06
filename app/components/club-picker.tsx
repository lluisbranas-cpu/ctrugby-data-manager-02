"use client";
import { searchOptions } from "@/lib/search-options";
import { useId, useMemo, useState } from "react";

type Club = {id: string; name: string};

export function ClubPicker({clubs, ...props}: {clubs: Club[]; value: string; onChange: (id: string) => void; onBlur?: () => void; inputClass?: string}) {
  return <SearchablePicker options={clubs} {...props} label="Club" placeholder="Buscar club…" emptyLabel="Club pendiente de indicar" />;
}

export function SearchablePicker({options: clubs, value, onChange, onBlur, inputClass, label, placeholder, emptyLabel}: {options: Club[]; value: string; onChange: (id: string) => void; onBlur?: () => void; inputClass?: string; label: string; placeholder: string; emptyLabel: string}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const selected = clubs.find(club => club.id === value);
  const matches = useMemo(() => searchOptions(clubs, query), [clubs, query]);
  const options = query.trim() ? matches : [{id: "", name: emptyLabel}, ...matches];
  function choose(club: Club) {onChange(club.id); setOpen(false); setQuery(""); setActive(-1);}
  return <div className="grid min-w-0 gap-[5px] text-[11px] font-bold text-neutral-600" onBlur={event => {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setOpen(false); setQuery(""); setActive(-1); onBlur?.();
  }}>
    {label && <label htmlFor={id}>{label}</label>}
    <div className="relative min-w-0">
      <input id={id} className={inputClass} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={id + "-options"} aria-activedescendant={open && active >= 0 && options[active] ? id + "-option-" + active : undefined} autoComplete="off" placeholder={placeholder} title={selected?.name || placeholder} value={open ? query : selected?.name || ""} onFocus={() => {setOpen(true); setQuery(""); setActive(-1);}} onClick={() => {if (!open) {setOpen(true); setQuery(""); setActive(-1);}}} onChange={event => {setQuery(event.target.value); setActive(-1); setOpen(true);}} onKeyDown={event => {
        if (event.key === "ArrowDown") {event.preventDefault(); setOpen(true); setActive(index => Math.min(index + 1, options.length - 1));}
        else if (event.key === "ArrowUp") {event.preventDefault(); setOpen(true); setActive(index => Math.max(index - 1, 0));}
        else if (event.key === "Enter" && open) {event.preventDefault(); const option = options[active >= 0 ? active : query.trim() ? 0 : -1]; if (option) choose(option);}
        else if (event.key === "Escape") {event.preventDefault(); setOpen(false); setQuery(""); setActive(-1);}
      }} />
      {open && <div className="absolute left-0 top-full z-50 mt-1 max-h-60 w-full min-w-[220px] overflow-y-auto rounded-md border border-neutral-300 bg-white py-1 text-left shadow-lg" id={id + "-options"} role="listbox" aria-label={label + " · opciones por orden alfabético"}>
        {options.map((club,index) => <button key={club.id || "no-club"} id={id + "-option-" + index} type="button" role="option" aria-selected={value === club.id} tabIndex={-1} className={"block w-full whitespace-normal px-3 py-2 text-left text-xs font-normal hover:bg-red-50 " + (active === index ? "bg-red-50 text-red-700" : "text-neutral-800")} onMouseDown={event => event.preventDefault()} onClick={() => choose(club)}>{club.name}</button>)}
        {!options.length && <p role="status" className="px-3 py-2 text-xs font-normal text-neutral-500">No hay coincidencias.</p>}
      </div>}
    </div>
  </div>;
}
