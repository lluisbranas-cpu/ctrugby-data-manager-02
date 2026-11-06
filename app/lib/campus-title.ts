export function campusParticipationTitle(name: string, year?: string | null) {
  return name.trim() + " · " + (year?.trim() || "Año pendiente");
}
