export type ClientType = { id: string; name: string; characteristics: string; track_participations: boolean; version: number };
export type Customer = { id: string; name: string; type_id: string; characteristics: string; participations: number | null; primary_color: string; secondary_color: string; accent_color: string; surname_color: string; style: string; typography: string; logo: string; version: number };

export function validateClientInput(body: Record<string, unknown>, kind: "type" | "client") {
  const text = (key: string, max: number, required = false) => {
    const value = typeof body[key] === "string" ? body[key].trim() : "";
    if ((required && !value) || value.length > max) throw new Error(`Revisa el campo ${key} (máximo ${max} caracteres).`);
    return value;
  };
  const common = { name: text("name", 160, true), characteristics: text("characteristics", 4000) };
  if (kind === "type") {
    if (typeof body.track_participations !== "boolean") throw new Error("Indica si el tipo registra participaciones.");
    return { ...common, track_participations: body.track_participations };
  }
  const color = (key: string) => { const value = text(key, 7, true); if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error("Usa colores en formato #RRGGBB."); return value; };
  const participations = body.participations;
  if (participations !== null && (typeof participations !== "number" || !Number.isSafeInteger(participations) || participations < 0 || participations > 2147483647)) throw new Error("Las participaciones deben ser un número entero igual o mayor que cero.");
  const logo = text("logo", 700000);
  if (logo && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(logo)) throw new Error("Sube un logotipo PNG, JPG o WebP de hasta 500 KB.");
  return { ...common, type_id: text("type_id", 36, true), participations, primary_color: color("primary_color"), secondary_color: color("secondary_color"), accent_color: color("accent_color"), surname_color: color("surname_color"), style: text("style", 2000), typography: text("typography", 160), logo };
}
