export type WebColorSlot = "color1" | "color2" | "color3";
export type WebLanguage = "ca" | "es" | "en";
export type WebColumnStyle = { background: WebColorSlot; featureAccent: WebColorSlot; title1: WebColorSlot; title2: WebColorSlot; h3: WebColorSlot };
export type WebColumnHtml = { es: string; ca: string; en: string };
export type WebMenuItem = { id: string; label: string; href: string; parentId?: string };

export type RugbyCabreraWebConfig = {
  brand: { name: string; primary: string; headerColor: string; textColor: string; menuColor: string; menuTextColor: string; accent: string; secondary: string; headingFont: string; headingSize: number; subtitleFont: string; subtitleSize: number; bodyFont: string; bodySize: number; logo: string; jerseyImage: string; sealImage: string };
  menu: WebMenuItem[];
  languages: WebLanguage[];
  blockTitles: { hero: string; squad: string; contact: string };
  blockOrder: Array<"hero" | "squad" | "contact">;
  layouts: { hero: "one" | "two" | "three"; squad: "one" | "two" | "three"; contact: "one" | "two" | "three" };
  htmlColumns: { hero: WebColumnHtml[]; squad: WebColumnHtml[]; contact: WebColumnHtml[] };
  columnStyles: { hero: WebColumnStyle[]; squad: WebColumnStyle[]; contact: WebColumnStyle[] };
  hero: { eyebrow: string; title: string; accent: string; description: string; cta: string; caption: string; html: string };
  squad: { eyebrow: string; title: string; description: string; note: string; html: string };
  contact: { eyebrow: string; title: string; description: string; cta: string; address: string; phone: string; website: string; html: string };
  aiPrompts: { hero: string; squad: string; contact: string };
};

export type RugbyCabreraWebDocument = { draft: RugbyCabreraWebConfig; published: RugbyCabreraWebConfig };

const rugbyCabreraHeroSpanishHtml = `<p>RUGBY CABRERA DE MAR · RUGBY DE CANTERA</p><h1><span class="title-initial">U</span><span class="title-rest">n club.</span><br><span class="title-initial">U</span><span class="title-rest">na familia.</span></h1><p>Todo por jugar.</p><p>Del primer pase a la próxima conquista. Conoce a quienes dan vida a nuestros colores, dentro y fuera del campo.</p><a href="#plantilla">Descubre nuestros equipos ↓</a><small>PASIÓN · RESPETO · EQUIPO</small>`;

// These HTML snippets mirror the content hierarchy of the published Rugby
// Cabrera reference website. They are editable per block in the constructor.
export const rugbyCabreraWebDefaults: RugbyCabreraWebConfig = {
  brand: { name: "Rugby Cabrera", primary: "#101d42", headerColor: "#101d42", textColor: "#f7f7f5", menuColor: "#101d42", menuTextColor: "#f7f7f5", accent: "#e42636", secondary: "#f7f7f5", headingFont: "Arial Black, Arial, sans-serif", headingSize: 78, subtitleFont: "Arial Black, Arial, sans-serif", subtitleSize: 44, bodyFont: "Arial, Helvetica, sans-serif", bodySize: 14, logo: "/clubs/cabrera/logo.png", jerseyImage: "/clubs/cabrera/camiseta.png", sealImage: "/ctrugby-method-seal.png" },
  menu: [
    { id: "club", label: "Club", href: "#club" },
    { id: "instalaciones", label: "Instalaciones", href: "https://rugbycabrera.com/" },
    { id: "equipos", label: "Equipos", href: "#plantilla" },
  ],
  languages: ["ca", "es", "en"],
  blockTitles: { hero: "Hero", squad: "Plantilla", contact: "Contacto" },
  blockOrder: ["hero", "squad", "contact"],
  layouts: { hero: "two", squad: "one", contact: "two" },
  htmlColumns: { hero: [], squad: [], contact: [] },
  columnStyles: { hero: [], squad: [], contact: [] },
  hero: {
    eyebrow: "CABRERA DE MAR · RUGBY DE CANTERA",
    title: "Un club.\nUna familia.",
    accent: "Tot per jugar.",
    description: "De la primera passada a la propera conquesta. Coneix les persones que donen vida als nostres colors, dins i fora del camp.",
    cta: "Descobreix els nostres equips",
    caption: "PASSIÓ · RESPECTE · EQUIP",
    html: `<p>RUGBY CABRERA DE MAR · RUGBY DE CANTERA</p><h1><span class="title-initial">U</span><span class="title-rest">n club.</span><br><span class="title-initial">U</span><span class="title-rest">na família.</span></h1><p>Tot per jugar.</p><p>De la primera passada a la propera conquesta. Coneix les persones que donen vida als nostres colors, dins i fora del camp.</p><a href="#plantilla">Descobreix els nostres equips ↓</a><small>PASSIÓ · RESPECTE · EQUIP</small>`,
  },
  squad: {
    eyebrow: "LAS PERSONAS HACEN EL CLUB",
    title: "Nuestros equipos.",
    description: "Talento que crece. Valores que se quedan.\nEncuentra a cada jugador por su categoría.",
    note: "Datos vinculados a Rugby; las categorías se calculan de forma orientativa según el año de nacimiento.",
    html: `<p>LAS PERSONAS HACEN EL CLUB</p><h2>Nuestros equipos.</h2><p>Talento que crece. Valores que se quedan.<br>Encuentra a cada jugador por su categoría.</p><p>Datos vinculados a Rugby; las categorías se calculan de forma orientativa según el año de nacimiento.</p>`,
  },
  contact: {
    eyebrow: "TU SITIO ESTÁ EN EL CAMPO",
    title: "El próximo pase\npuede ser el tuyo.",
    description: "Escuela, cantera y sénior. Ven a conocer Rugby Cabrera y forma parte del equipo.",
    cta: "Contacta con el club",
    address: "Av. de la Zona Esportiva\n08349 Cabrera de Mar, Barcelona",
    phone: "+34 677 45 65 71",
    website: "rugbycabrera.com",
    html: `<p>TU SITIO ESTÁ EN EL CAMPO</p><h2>El próximo pase<br>puede ser el tuyo.</h2><p>Escuela, cantera y sénior. Ven a conocer Rugby Cabrera y forma parte del equipo.</p><a href="https://rugbycabrera.com/#contacto">Contacta con el club ↗</a><address><strong>RUGBY CABRERA</strong><br>Av. de la Zona Esportiva<br>08349 Cabrera de Mar, Barcelona<br><a href="tel:+34677456571">+34 677 45 65 71</a></address>`,
  },
  aiPrompts: {
    hero: "Construeix el bloc de portada del web de Rugby Cabrera de Mar. Escriu en català, amb un to proper, esportiu i familiar. El bloc ha de contenir: un antetítol que situï Cabrera de Mar i el rugby de cantera; un títol breu de dues línies; una frase destacada inspiradora; una descripció de 20 a 35 paraules sobre club, persones i valors; un CTA curt per anar als equips; i un lema final de tres valors separats per punts centrals. No facis servir HTML ni expliquis el procés.",
    squad: "Construeix el bloc de plantilla de Rugby Cabrera. Escriu en català, amb un to inclusiu i de club de base. Inclou: un antetítol sobre les persones; un títol curt per a la secció d'equips; una descripció de dues frases sobre talent, aprenentatge i valors; i una nota clara que expliqui que les dades provenen del directori i que les categories es calculen orientativament per any de naixement. No facis servir HTML ni expliquis el procés.",
    contact: "Construeix el bloc final de contacte per a Rugby Cabrera. Escriu en català, amb un to obert a famílies, escola, cantera i sènior. Inclou: un antetítol de crida a l'acció; un títol de dues línies; una descripció de 20 a 35 paraules; el text breu del botó de contacte; l'adreça en dues línies; el telèfon; i el domini web. No inventis dades de contacte i no facis servir HTML ni expliquis el procés.",
  },
};

const stringValue = (value: unknown, fallback: string, max = 1600) => typeof value === "string" ? value.trim().slice(0, max) || fallback : fallback;
const promptValue = (value: unknown, fallback: string) => typeof value === "string" && !value.startsWith("Devuelve exactamente") ? stringValue(value, fallback, 4000) : fallback;
const colorValue = (value: unknown, fallback: string) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
const fontValue = (value: unknown, fallback: string) => typeof value === "string" && /^[a-zA-Z0-9 ,"'_-]{1,160}$/.test(value) ? value.trim() : fallback;
const sizeValue = (value: unknown, fallback: number, min: number, max: number) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? Math.round(value) : fallback;
const hrefValue = (value: unknown, fallback: string) => typeof value === "string" && (/^https:\/\//.test(value) || value.startsWith("#") || value.startsWith("/")) ? value.slice(0, 500) : fallback;

const htmlValue = (value: unknown, fallback: string) => {
  if (typeof value !== "string" || !value.trim()) return fallback;
  return value.slice(0, 12000)
    .replace(/<\/?(?:script|style|iframe|object|embed|form)[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(?:href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\1/gi, "")
    .trim();
};
const catalanHeroHtml = (value: unknown) => typeof value === "string" ? value
  .replaceAll("Una familia.", "Una família.")
  .replaceAll("Todo por jugar.", "Tot per jugar.")
  .replaceAll("Del primer pase a la próxima conquista. Conoce a quienes dan vida a nuestros colores, dentro y fuera del campo.", "De la primera passada a la propera conquesta. Coneix les persones que donen vida als nostres colors, dins i fora del camp.")
  .replaceAll("Descubre nuestros equipos", "Descobreix els nostres equips")
  .replaceAll("PASIÓN · RESPETO · EQUIPO", "PASSIÓ · RESPECTE · EQUIP")
  .replaceAll("<h1>Un club.<br><em>Una família.</em></h1>", "<h1><span class=\"title-initial\">U</span><span class=\"title-rest\">n club.</span><br><span class=\"title-initial\">U</span><span class=\"title-rest\">na família.</span></h1>")
  : value;
const splitHeroInitials = (value: unknown) => typeof value === "string" ? value
  .replaceAll("<h1>Un club.<br><em>Una familia.</em></h1>", "<h1><span class=\"title-initial\">U</span><span class=\"title-rest\">n club.</span><br><span class=\"title-initial\">U</span><span class=\"title-rest\">na familia.</span></h1>")
  .replaceAll("<h1>Un club.<br><em>Una família.</em></h1>", "<h1><span class=\"title-initial\">U</span><span class=\"title-rest\">n club.</span><br><span class=\"title-initial\">U</span><span class=\"title-rest\">na família.</span></h1>")
  : value;

export function normalizeRugbyCabreraWebConfig(value: unknown): RugbyCabreraWebConfig {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const section = (name: keyof RugbyCabreraWebConfig) => source[name] && typeof source[name] === "object" ? source[name] as Record<string, unknown> : {};
  const hero = section("hero"), squad = section("squad"), contact = section("contact"), brand = section("brand"), htmlColumns = section("htmlColumns"), columnStyles = section("columnStyles");
  const layouts = section("layouts");
  const languageOrder = Array.isArray(source.languages) ? source.languages.filter((language): language is WebLanguage => language === "ca" || language === "es" || language === "en") : [];
  const languages = [...new Set(languageOrder.concat(["ca", "es", "en"]))].slice(0, 3) as WebLanguage[];
  const sourceTitles = section("blockTitles");
  const allowedBlocks = ["hero", "squad", "contact"] as const;
  const requestedOrder = Array.isArray(source.blockOrder) ? source.blockOrder.filter((block): block is "hero" | "squad" | "contact" => typeof block === "string" && allowedBlocks.includes(block as "hero" | "squad" | "contact")) : [];
  const blockOrder = [...new Set(requestedOrder.concat(allowedBlocks))];
  const menu = Array.isArray(source.menu) ? source.menu.slice(0, 12).map((item, index) => {
    const fallback = rugbyCabreraWebDefaults.menu[index] ?? { id: `menu-${index + 1}`, label: "Enlace", href: "#inicio" };
    const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const id = typeof record.id === "string" && /^[a-z0-9_-]{1,60}$/i.test(record.id) ? record.id : fallback.id;
    return { id, label: stringValue(record.label, fallback.label, 60), href: hrefValue(record.href, fallback.href), parentId: typeof record.parentId === "string" ? record.parentId : undefined };
  }) : rugbyCabreraWebDefaults.menu;
  const normalizedMenu = menu.map(item => ({ ...item, parentId: item.parentId && item.parentId !== item.id && menu.some(parent => parent.id === item.parentId) ? item.parentId : undefined }));
  const normalizeBlock = <T extends object>(block: Record<string, unknown>, defaults: T) => Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, key === "html" ? htmlValue(block[key], fallback as string) : stringValue(block[key], fallback as string)])) as T;
  const normalizedLayouts: RugbyCabreraWebConfig["layouts"] = { hero: layouts.hero === "one" || layouts.hero === "three" ? layouts.hero as "one" | "three" : "two", squad: layouts.squad === "two" || layouts.squad === "three" ? layouts.squad as "two" | "three" : "one", contact: layouts.contact === "one" || layouts.contact === "three" ? layouts.contact as "one" | "three" : "two" };
  const normalizeColumns = (block: "hero" | "squad" | "contact", legacyHtml: unknown) => {
    const count = normalizedLayouts[block] === "three" ? 3 : normalizedLayouts[block] === "two" ? 2 : 1;
    const values = Array.isArray(htmlColumns[block]) ? htmlColumns[block] : [];
    return Array.from({ length: count }, (_, index) => {
      const value = values[index] ?? (index === 0 ? legacyHtml : "");
      const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
      const savedSpanish = typeof value === "string" ? value : record.es;
      const spanishValue = typeof savedSpanish === "string" && savedSpanish.trim() ? savedSpanish : block === "hero" && index === 0 ? rugbyCabreraHeroSpanishHtml : "";
      const spanish = block === "hero" ? splitHeroInitials(spanishValue) : spanishValue;
      const catalan = block === "hero" ? splitHeroInitials(record.ca ?? catalanHeroHtml(spanish)) : record.ca ?? spanish;
      return {
        es: typeof spanish === "string" && spanish.trim() ? htmlValue(spanish, "") : "",
        ca: typeof catalan === "string" && catalan.trim() ? htmlValue(catalan, "") : "",
        en: typeof record.en === "string" && record.en.trim() ? htmlValue(record.en, "") : "",
      };
    });
  };
  const colorSlot = (value: unknown, fallback: WebColorSlot): WebColorSlot => value === "color1" || value === "color2" || value === "color3" ? value : fallback;
  const normalizeStyles = (block: "hero" | "squad" | "contact") => {
    const count = normalizedLayouts[block] === "three" ? 3 : normalizedLayouts[block] === "two" ? 2 : 1;
    const values = Array.isArray(columnStyles[block]) ? columnStyles[block] : [];
    return Array.from({ length: count }, (_, index) => {
      const value = values[index] && typeof values[index] === "object" ? values[index] as Record<string, unknown> : {};
      const legacyTitle = colorSlot(value.h1, "color3");
      return { background: colorSlot(value.background, "color1"), featureAccent: colorSlot(value.featureAccent, "color2"), title1: colorSlot(value.title1, legacyTitle), title2: colorSlot(value.title2, legacyTitle), h3: colorSlot(value.h3, "color3") };
    });
  };
  return {
    brand: { name: stringValue(brand.name, rugbyCabreraWebDefaults.brand.name, 80), primary: colorValue(brand.primary, rugbyCabreraWebDefaults.brand.primary), headerColor: colorValue(brand.headerColor, rugbyCabreraWebDefaults.brand.headerColor), textColor: colorValue(brand.textColor, rugbyCabreraWebDefaults.brand.textColor), menuColor: colorValue(brand.menuColor, rugbyCabreraWebDefaults.brand.menuColor), menuTextColor: colorValue(brand.menuTextColor, rugbyCabreraWebDefaults.brand.menuTextColor), accent: colorValue(brand.accent, rugbyCabreraWebDefaults.brand.accent), secondary: colorValue(brand.secondary, rugbyCabreraWebDefaults.brand.secondary), headingFont: fontValue(brand.headingFont, rugbyCabreraWebDefaults.brand.headingFont), headingSize: sizeValue(brand.headingSize, rugbyCabreraWebDefaults.brand.headingSize, 24, 120), subtitleFont: fontValue(brand.subtitleFont, rugbyCabreraWebDefaults.brand.subtitleFont), subtitleSize: sizeValue(brand.subtitleSize, rugbyCabreraWebDefaults.brand.subtitleSize, 16, 96), bodyFont: fontValue(brand.bodyFont, rugbyCabreraWebDefaults.brand.bodyFont), bodySize: sizeValue(brand.bodySize, rugbyCabreraWebDefaults.brand.bodySize, 10, 32), logo: hrefValue(brand.logo, rugbyCabreraWebDefaults.brand.logo), jerseyImage: hrefValue(brand.jerseyImage, rugbyCabreraWebDefaults.brand.jerseyImage), sealImage: hrefValue(brand.sealImage, rugbyCabreraWebDefaults.brand.sealImage) },
    menu: normalizedMenu.length ? normalizedMenu : rugbyCabreraWebDefaults.menu,
    languages,
    blockTitles: { hero: stringValue(sourceTitles.hero, rugbyCabreraWebDefaults.blockTitles.hero, 40), squad: stringValue(sourceTitles.squad, rugbyCabreraWebDefaults.blockTitles.squad, 40), contact: stringValue(sourceTitles.contact, rugbyCabreraWebDefaults.blockTitles.contact, 40) },
    blockOrder,
    layouts: normalizedLayouts,
    htmlColumns: { hero: normalizeColumns("hero", hero.html), squad: normalizeColumns("squad", squad.html), contact: normalizeColumns("contact", contact.html) },
    columnStyles: { hero: normalizeStyles("hero"), squad: normalizeStyles("squad"), contact: normalizeStyles("contact") },
    hero: normalizeBlock(hero, rugbyCabreraWebDefaults.hero),
    squad: normalizeBlock(squad, rugbyCabreraWebDefaults.squad),
    contact: normalizeBlock(contact, rugbyCabreraWebDefaults.contact),
    aiPrompts: Object.fromEntries(Object.entries(rugbyCabreraWebDefaults.aiPrompts).map(([key, fallback]) => [key, promptValue((source.aiPrompts as Record<string, unknown> | undefined)?.[key], fallback)])) as RugbyCabreraWebConfig["aiPrompts"],
  };
}

export function normalizeRugbyCabreraWebDocument(value: unknown): RugbyCabreraWebDocument {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const isVersioned = "draft" in source || "published" in source;
  return {
    draft: normalizeRugbyCabreraWebConfig(isVersioned ? source.draft : value),
    published: normalizeRugbyCabreraWebConfig(isVersioned ? source.published : value),
  };
}
