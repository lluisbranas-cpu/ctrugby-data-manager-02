"use client";

export function PlayerProfilePdfButton({ playerId }: { playerId: string }) {
  const download = async () => {
    const response = await fetch(`/api/jugadores/${playerId}/pdf`, { method: "POST", credentials: "include" });
    if (!response.ok) { const detail = await response.json().catch(() => null) as { error?: string } | null; window.alert(detail?.error || "No se ha podido generar el PDF."); return; }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a"); link.href = url; link.download = `ficha-${playerId}.pdf`; link.click(); URL.revokeObjectURL(url);
  };
  return <button type="button" className="player-profile-pdf-button" title="Descargar PDF de la ficha" aria-label="Descargar PDF de la ficha" onClick={() => void download()}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h8l4 4v16H6V2Zm8 1.8V7h3.2M8 16.5h1.3c1.8 0 1.8-3 0-3H8v5m5-5h-2v5m5-5h-2.5v5M8 16h1.1M13 16h1.7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
  </button>;
}

export function PlayerProfilePrintButton({ playerId }: { playerId: string }) {
  const download = async () => {
    const response = await fetch(`/api/jugadores/${playerId}/pdf`, { method: "POST", credentials: "include" });
    if (!response.ok) { const detail = await response.json().catch(() => null) as { error?: string } | null; window.alert(detail?.error || "No se ha podido generar el PDF."); return; }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a"); link.href = url; link.download = `ficha-${playerId}.pdf`; link.click(); URL.revokeObjectURL(url);
  };
  return <button type="button" className="player-profile-pdf-button player-profile-print-button" title="Descargar PDF" aria-label="Descargar PDF" onClick={() => void download()}>
    Descargar PDF
  </button>;
}
