type ClubLocationInput = {
  name?: string | null;
  city?: string | null;
  province?: string | null;
  region?: string | null;
  country?: string | null;
};

type ClubLocation = { latitude: number; longitude: number; maps_url: string };

const normalize = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-ES")
    .trim();

const mapsSearchUrl = (parts: Array<string | null | undefined>) => {
  const query = parts.map((part) => part?.trim()).filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || "rugby club")}`;
};

const cityCoordinates: Record<string, { latitude: number; longitude: number }> = {
  barcelona: { latitude: 41.3874, longitude: 2.1686 },
};

export function inferClubLocation(input: ClubLocationInput): ClubLocation | null {
  const name = normalize(input.name);
  const city = normalize(input.city);
  if ((name.includes("ber") || name.includes("enginyers")) && city === "barcelona") {
    return {
      latitude: 41.3919,
      longitude: 2.2045,
      maps_url: mapsSearchUrl(["Av. Litoral Mar, 86-96", input.city, input.country]),
    };
  }
  const cityMatch = cityCoordinates[city];
  if (!cityMatch) return null;
  return {
    ...cityMatch,
    maps_url: mapsSearchUrl([input.name, input.city, input.province, input.country]),
  };
}
