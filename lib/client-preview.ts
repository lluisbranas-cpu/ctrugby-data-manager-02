import type { Customer } from "./client-types";

export type PreviewClient = {
  id: string; name: string; category: string; logo: string;
  primary: string; secondary: string; accent: string; surname?: string; typography: string;
  href?: string; demo: boolean;
};

export const previewExamples: PreviewClient[] = [
  { id: "demo-laietans", name: "Rugby Laietans", category: "Agrupación temporal", logo: "", primary: "#262626", secondary: "#fafafa", accent: "#525252", typography: "", href: "/clubs/rugby-laietans", demo: true },
  { id: "demo-ctrugby", name: "Likid", category: "Plataforma", logo: "/likid-logo-inverse.png", primary: "#1b4980", secondary: "#ffffff", accent: "#dc2626", typography: "", href: "/jugadores", demo: true },
  { id: "demo-cabrera", name: "Rugby Cabrera", category: "Club", logo: "/club-shields/ESP0022.png", primary: "#101d42", secondary: "#ffffff", accent: "#e42636", typography: "", href: "/clubs/ESP0022/equipos", demo: true },
  { id: "demo-badalona", name: "Rugby Badalona", category: "Club", logo: "/club-shields/ESP0023.png", primary: "#173858", secondary: "#ffffff", accent: "#48a6cd", typography: "", href: "/clubs/ESP0023/equipos", demo: true },
  { id: "demo-alella", name: "Rugby Alella", category: "Club", logo: "/club-shields/ESP0010.png", primary: "#173d2a", secondary: "#ffffff", accent: "#e6bf12", typography: "", href: "/clubs/ESP0010/equipos", demo: true },
];
const safeColor = (value: string, fallback: string) => /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
export function customerPreview(client: Customer, category: string): PreviewClient {
  return {
    id: client.id, name: client.name, category,
    logo: /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(client.logo) ? client.logo : "",
    primary: safeColor(client.primary_color, "#171717"),
    secondary: safeColor(client.secondary_color, "#ffffff"),
    accent: safeColor(client.accent_color, "#dc2626"),
    surname: safeColor(client.surname_color, "#171717"),
    typography: /^[a-zA-Z0-9 ,"'\-]{1,160}$/.test(client.typography) ? client.typography : "",
    demo: false,
  };
}
export function contrastText(hex: string) {
  const channels = [1, 3, 5].map(index => {
    const value = parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722 > .179 ? "#171717" : "#ffffff";
}

