/**
 * Convierte los dorsales almacenados en las importaciones a las posiciones de
 * rugby que se muestran en la aplicación. Agrupa puestos equivalentes para no
 * repetir etiquetas (por ejemplo, 6 y 7 son Flanker).
 */
export function rugbyPositionLabel(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const codes = [...new Set(raw.split(/[.,;/\s]+/).filter((code) => /^\d+$/.test(code)).map(Number))].sort((left, right) => left - right);
  if (!codes.length) return raw;

  const has = (code: number) => codes.includes(code);
  const labels: string[] = [];
  if (has(1) && has(2) && has(3)) labels.push("Primera línea");
  else if (has(1) && has(3)) labels.push("Pilares");
  else {
    if (has(1)) labels.push("Pilar izquierdo");
    if (has(2)) labels.push("Talonador");
    if (has(3)) labels.push("Pilar derecho");
  }
  if (has(4) || has(5)) labels.push("Segunda línea");
  if (has(6) || has(7)) labels.push("Flanker");
  if (has(8)) labels.push("Ocho");
  if (has(9)) labels.push("Medio melé");
  if (has(10)) labels.push("Apertura");
  if (has(11) || has(14)) labels.push("Ala");
  if (has(12) || has(13)) labels.push("Centro");
  if (has(15)) labels.push("Zaguero");
  if (/\bchutador\b/i.test(raw)) labels.push("Chutador");
  return labels.length ? labels.join(" · ") : raw;
}

