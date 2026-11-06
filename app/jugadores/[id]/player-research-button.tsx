"use client";

import { useId, useRef, useState } from "react";
import { Search } from "lucide-react";

type Props = { playerId: string; name: string; birthYear: number | null; club: string | null };

export function PlayerResearchButton({ playerId, name, birthYear, club }: Props) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const panelId = useId();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const prompt = [
    `Busca y actualiza la trayectoria y las noticias de ${name}, jugador/a de rugby con ficha ${playerId} en RUGBY - HUB.`,
    [birthYear ? `Año de nacimiento: ${birthYear}.` : "", club ? `Club de referencia: ${club}.` : ""].filter(Boolean).join(" "),
    "Trabaja en la aplicación vigente C:\\ctrugby-data-manager-02 y lee sus instrucciones. Revisa primero la ficha existente para confirmar la identidad y evitar duplicados.",
    "Busca trayectoria por clubes y temporadas, selecciones y palmarés; noticias con fecha y enlace; posición o posiciones de juego, indicando temporada cuando conste; peso en kg y altura en cm con fecha de la fuente; apodo e Instagram oficial verificado.",
    "Prioriza fuentes oficiales de clubes, federaciones y competiciones y contrasta las noticias. No confundas personas con el mismo nombre, no inventes datos ni asignes medidas actuales a temporadas anteriores. Conserva los datos existentes cuando no encuentres información nueva verificable.",
    "Muéstrame los cambios propuestos y sus fuentes antes de guardarlos en la ficha. Señala datos contradictorios o no confirmados."
  ].filter(Boolean).join("\n\n");

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setMessage("Petición copiada. Pégala en este chat para iniciar la búsqueda.");
    } catch {
      textRef.current?.focus();
      textRef.current?.select();
      setMessage("Selecciona y copia el texto de la petición para pegarlo en este chat.");
    }
  }

  return <section className="mb-4 rounded-xl border border-neutral-200 bg-white p-3 print:hidden">
    <button type="button" className="player-profile-participation-button inline-flex items-center gap-2" aria-expanded={open} aria-controls={panelId} onClick={() => { setOpen(!open); setMessage(""); }}>
      <Search size={16} aria-hidden="true" />Preparar búsqueda
    </button>
    {open && <div id={panelId} className="mt-3 space-y-3">
      <p className="text-sm text-neutral-600">Prepara la búsqueda de trayectoria, noticias, posición de juego, peso, altura, apodo e Instagram. Copia la petición y pégala en este chat. Podrás revisar los cambios antes de guardarlos.</p>
      <label className="block text-sm font-semibold" htmlFor={panelId + "-prompt"}>Petición para {name}</label>
      <textarea ref={textRef} id={panelId + "-prompt"} readOnly value={prompt} rows={9} className="block w-full rounded-lg border border-neutral-300 bg-neutral-50 p-3 text-sm leading-relaxed" />
      <button type="button" className="player-profile-participation-button" onClick={() => void copyPrompt()}>Copiar petición</button>
      <p role="status" className="text-sm text-neutral-600">{message}</p>
    </div>}
  </section>;
}