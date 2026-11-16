import type { Customer } from "./client-types";

export type PreviewClient = {
  id: string; name: string; category: string; logo: string;
  primary: string; secondary: string; accent: string; surname?: string; typography: string;
  href?: string; scope?: string; demo: boolean;
};

// The only client-facing view. Its portal reads Rugby Cabrera's ESP0022
// roster, seasons and categories, matching the published team site.
export const clientViews: PreviewClient[] = [
  { id: "ctrugby", name: "CTRugby", category: "Campus", logo: "/ctrugby-logo-contrast.webp", primary: "#1b4980", secondary: "#ffffff", accent: "#dc2626", typography: "", scope: "ctrugby", demo: false },
  { id: "rugby-cabrera", name: "Rugby Cabrera", category: "Club", logo: "/club-shields/ESP0022.png", primary: "#101d42", secondary: "#ffffff", accent: "#e42636", typography: "", href: "/rugby/ESP022/web/home", scope: "ESP022", demo: false },
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

