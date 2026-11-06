"use client";
import { Pencil, Save, X } from "lucide-react";
import type { ReactNode } from "react";
export function PlayerEditBlock({title,editing,busy,locked,className,onEdit,onSave,onCancel,children}:{title:string;editing:boolean;busy:boolean;locked:boolean;className:string;onEdit:()=>void;onSave:()=>void;onCancel:()=>void;children:ReactNode}) {
  const buttonClass = "inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-neutral-300 bg-white text-neutral-700 disabled:opacity-40";
  return <section className={className} aria-label={title}><div className="flex justify-end gap-2 col-span-full">{editing ? <><button type="button" className={buttonClass} disabled={busy} title={"Guardar " + title} aria-label={"Guardar " + title} onClick={onSave}><Save size={16} aria-hidden="true" /></button><button type="button" className={buttonClass} disabled={busy} title="Salir sin guardar" aria-label={"Salir sin guardar " + title} onClick={onCancel}><X size={16} aria-hidden="true" /></button></> : <button type="button" className={buttonClass} disabled={busy || locked} title={"Editar " + title} aria-label={"Editar " + title} onClick={onEdit}><Pencil size={16} aria-hidden="true" /></button>}</div><fieldset disabled={!editing || busy} className="contents">{children}</fieldset></section>;
}
