"use client";

import { Trash2 } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & { confirmationHandled?: boolean };

/** All deletion controls use the same icon and ask before invoking the mutation. */
export function DeleteButton({ onClick, confirmationHandled = false, className = "", style, title, "aria-label": label = title ?? "Eliminar entrada", ...props }: Props) {
  return <button {...props} type="button" aria-label={label} title={title ?? label} className={"app-delete-button " + className} style={{ ...style, color: "#b91c1c", backgroundColor: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, minWidth: 32, minHeight: 32 }} onClick={(event) => {
    if (!confirmationHandled && !window.confirm("¿Confirmas que quieres " + label.toLocaleLowerCase("es-ES") + "?")) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    onClick?.(event);
  }}><Trash2 size={16} aria-hidden="true" /></button>;
}
