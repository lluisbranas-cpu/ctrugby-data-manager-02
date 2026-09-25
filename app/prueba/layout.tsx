import type { Metadata } from "next";
export const metadata: Metadata = { title: "CTRugby · Prueba de almacenamiento", robots: { index: false, follow: false } };
export default function PilotLayout({ children }: { children: React.ReactNode }) { return children; }
