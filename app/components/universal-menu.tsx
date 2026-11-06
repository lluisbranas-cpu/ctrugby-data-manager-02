"use client";

import { usePathname } from "@/lib/sport-navigation";
import { ManagerMenu } from "./manager-menu";

const standaloneRoutes = new Set([
  "/jugadores/nuevo",
  "/jugadores/editar",
  "/prueba",
]);

/** Añade el menú a las páginas que no tienen cabecera de directorio propia. */
export function UniversalMenu() {
  const pathname = usePathname();
  if (!standaloneRoutes.has(pathname)) return null;
  return <div className="universal-manager-menu"><ManagerMenu /></div>;
}

