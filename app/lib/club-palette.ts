export type ClubPalette = [string, string, string];

export const defaultClubPalette: ClubPalette = ["#78838c", "#a1a9af", "#dfe3e8"];
export const rugbyCabreraPalette: ClubPalette = ["#07577c", "#2ea8d6", "#e8f3f7"];

export function isClubPalette(value: unknown): value is ClubPalette {
  return Array.isArray(value) && value.length === 3 && value.every((color) => typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color));
}
