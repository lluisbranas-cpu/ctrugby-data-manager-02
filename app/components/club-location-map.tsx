"use client";
/* eslint-disable @next/next/no-img-element */

type ClubLocationMapProps = {
  latitude: number;
  longitude: number;
  name: string;
  large?: boolean;
};

const zoom = 15;
const gridSize = 3;

function tilePosition(latitude: number, longitude: number) {
  const scale = 2 ** zoom;
  const x = Math.floor(((longitude + 180) / 360) * scale);
  const latitudeRadians = (latitude * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2) * scale,
  );
  return { x, y, scale };
}

export function ClubLocationMap({
  latitude,
  longitude,
  name,
  large = false,
}: ClubLocationMapProps) {
  const center = tilePosition(latitude, longitude);
  const tiles = Array.from({ length: gridSize ** 2 }, (_, index) => {
    const column = (index % gridSize) - 1;
    const row = Math.floor(index / gridSize) - 1;
    const x = (center.x + column + center.scale) % center.scale;
    const y = Math.max(0, Math.min(center.scale - 1, center.y + row));
    return { key: `${x}-${y}`, src: `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png` };
  });

  return (
    <div
      className={`club-location-map${large ? " is-large" : ""}`}
      role="img"
      aria-label={`Mapa de la ubicación de ${name}`}
    >
      <div className="club-location-map-tiles" aria-hidden="true">
        {tiles.map((tile) => (
          <img key={tile.key} src={tile.src} alt="" />
        ))}
      </div>
      <span className="club-location-map-marker" aria-hidden="true" />
      <span className="club-location-map-attribution">© OpenStreetMap</span>
    </div>
  );
}
