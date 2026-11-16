"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { rugbyCabreraWebDefaults, type RugbyCabreraWebConfig, type WebColorSlot, type WebColumnHtml, type WebColumnStyle, type WebLanguage } from "@/lib/web-page-config";

type Block = "hero" | "squad" | "contact";
const titles: Record<Block, string> = { hero: "Hero", squad: "Plantilla", contact: "Contacto" };
const columnOptions = ["one", "two", "three"] as const;
const colorOptions: { value: WebColorSlot; label: string }[] = [{ value: "color1", label: "Color 1" }, { value: "color2", label: "Color 2" }, { value: "color3", label: "Color 3" }];
type Country = { id: string; name: string; flag_url: string };
const languageOptions: { value: WebLanguage; label: string; countryIds: string[]; countryNames: string[]; fallbackCountryId: string }[] = [
  { value: "ca", label: "Català", countryIds: ["CAT", "CCAA-CT"], countryNames: ["Catalunya", "Cataluña"], fallbackCountryId: "CCAA-CT" },
  { value: "es", label: "Español", countryIds: ["ES"], countryNames: ["España"], fallbackCountryId: "ES" },
  { value: "en", label: "English", countryIds: ["GB"], countryNames: ["Inglaterra", "Reino Unido"], fallbackCountryId: "GB" },
];
const languageOption = (language: WebLanguage) => languageOptions.find(option => option.value === language) ?? languageOptions[0];
const languageCountry = (language: WebLanguage, countries: Country[]) => {
  const option = languageOption(language);
  return countries.find(country => option.countryIds.includes(country.id) || option.countryNames.includes(country.name)) ?? { id: option.fallbackCountryId, name: option.countryNames[0], flag_url: `/api/paises/bandera/${option.fallbackCountryId}` };
};
const emptyColumnStyle: WebColumnStyle = { background: "color1", featureAccent: "color2", title1: "color3", title2: "color3", h3: "color3" };
const emptyColumnHtml: WebColumnHtml = { es: "", ca: "", en: "" };

function htmlPreviewDocument(html: string, style: WebColumnStyle, brand: RugbyCabreraWebConfig["brand"]) {
  const colors: Record<WebColorSlot, string> = { color1: brand.primary, color2: brand.accent, color3: brand.secondary };
  html = `<style>.jersey-feature:after{display:none}.jersey-feature-triangle{position:absolute;right:-90px;bottom:-70px;z-index:1;width:70%;height:52%;background:var(--feature-accent);clip-path:polygon(42% 0,100% 43%,100% 100%,0 100%)}.jersey-feature-seal,.jersey-feature-logo{top:auto!important;right:auto!important;bottom:18px!important;left:5%!important;width:124px!important;height:124px!important;filter:drop-shadow(0 5px 8px #0003)}.jersey-feature-pill{display:inline-block;margin-top:15px;padding:7px 12px;border-radius:999px;background:var(--feature-accent);color:var(--color-3);font-size:10px;letter-spacing:1.4px}.jersey-feature-pill-bg{position:absolute;z-index:1;top:27%;left:7%;width:82%;height:36%;border-radius:999px;background:var(--feature-accent);opacity:.94;transform:rotate(-14deg)}</style>${html}`;
  return `<!doctype html><html lang="ca"><head><meta charset="utf-8"><style>:root{--color-1:${colors.color1};--color-2:${colors.color2};--color-3:${colors.color3};--feature-accent:${colors[style.featureAccent]}}body{margin:0;padding:38px 30px;background:${colors[style.background]};color:var(--color-3);font-family:${brand.bodyFont};line-height:1.55}.text-color-1{color:var(--color-1)!important}.text-color-2{color:var(--color-2)!important}.text-color-3{color:var(--color-3)!important}p:first-child{margin:0 0 34px;font-size:10px;font-weight:800;letter-spacing:1.7px;color:var(--color-3);opacity:.72}p:first-child:before{content:"•";margin-right:12px;font-size:18px;vertical-align:-1px;color:var(--color-2)}h1{margin:0;font-family:${brand.headingFont};font-size:${brand.headingSize}px;line-height:1.04;color:var(--color-3)}h1 .title-initial{color:var(--color-3)}h1 .title-rest,h1 em{color:inherit;font-style:normal}h1+p{margin:2px 0 16px;font-family:${brand.headingFont};font-size:${brand.headingSize}px;font-weight:900;line-height:1.04;color:var(--color-2)}h1+p+p{max-width:430px;margin:0;font-size:${brand.bodySize}px;color:var(--color-3)}h2{margin:14px 0;font-family:${brand.subtitleFont};font-size:${brand.subtitleSize}px;line-height:1.04;color:var(--color-3);opacity:.5}h3{font-family:${brand.bodyFont};font-size:${brand.bodySize}px;color:var(--color-3)}p{font-size:${brand.bodySize}px}a{display:inline-block;min-width:267px;margin-top:26px;padding:15px 20px;background:var(--color-2);color:var(--color-3);font-weight:700;text-decoration:none}small{display:block;margin-top:34px;font-size:9px;letter-spacing:3px;color:var(--color-3);opacity:.7}address{margin-top:22px;font-style:normal}.jersey-row{display:flex;align-items:flex-end;justify-content:center;gap:18px;margin:24px 0}.jersey-row img{display:block;min-width:0;max-width:calc((100% - 36px)/3);height:250px;object-fit:contain;filter:drop-shadow(0 8px 12px #0003)}.jersey-row img:only-child{max-width:100%;height:310px}.jersey-feature{position:relative;isolation:isolate;min-height:480px;margin:20px -30px;overflow:hidden;background:#f6f6f5}.jersey-feature:after{position:absolute;right:-90px;bottom:-70px;z-index:-1;width:70%;height:52%;background:var(--feature-accent);content:"";clip-path:polygon(42% 0,100% 43%,100% 100%,0 100%)}.jersey-feature-sheet{position:absolute;top:22px;left:10%;width:68%;height:390px;background:#fff;box-shadow:0 14px 24px #0002;transform:rotate(-5deg)}.jersey-feature-shirt{position:absolute;z-index:2;top:17px;left:10%;width:68%;height:390px;object-fit:contain;filter:drop-shadow(0 10px 10px #0004)}.jersey-feature-seal{position:absolute;z-index:3;top:20px;right:9%;width:135px;height:135px;object-fit:contain}.jersey-feature-copy{position:absolute;right:9%;bottom:33px;z-index:4;text-align:right;color:var(--color-1)}.jersey-feature-copy small{margin:0;color:var(--color-1);font-size:8px;letter-spacing:2px;opacity:.7}.jersey-feature-copy strong{display:block;margin-top:5px;font-size:19px}.jersey-feature-copy span{display:block;margin-top:8px;font-size:10px;opacity:.7}</style></head><body>${html}</body></html>`;
}

export default function RugbyCabreraWebEditor() {
  const [config, setConfig] = useState<RugbyCabreraWebConfig>(rugbyCabreraWebDefaults);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [configurationCollapsed, setConfigurationCollapsed] = useState(true);
  const [menusCollapsed, setMenusCollapsed] = useState(false);
  const [htmlCollapsed, setHtmlCollapsed] = useState<Record<Block, boolean>>({ hero: false, squad: false, contact: false });
  const [previewZoom, setPreviewZoom] = useState<Record<string, number>>({});
  const [countries, setCountries] = useState<Country[]>([]);
  const [uploadingJerseys, setUploadingJerseys] = useState<Record<string, boolean>>({});
  const [uploadingMainJersey, setUploadingMainJersey] = useState(false);
  const [uploadingShield, setUploadingShield] = useState(false);
  const [uploadingSeal, setUploadingSeal] = useState(false);
  const htmlInputs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const languageView = (language: WebLanguage) => ({ ...languageOption(language), country: languageCountry(language, countries) });
  const languageChoices = languageOptions.map(option => ({ ...option, country: languageCountry(option.value, countries) }));
  const orderedLanguages = config.languages.map(language => ({ key: language as keyof WebColumnHtml, ...languageView(language) }));

  useEffect(() => {
    void fetch("/api/web/ESP022/home?mode=editor", { cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (data?.config) setConfig(data.config);
        else setNotice("Acceso de administrador requerido para editar esta web.");
      });
  }, []);
  useEffect(() => { window.sessionStorage.setItem("rugby-cabrera-web-draft-preview", JSON.stringify(config)); }, [config]);
  useEffect(() => { void fetch("/api/paises", { cache: "no-store" }).then(response => response.ok ? response.json() : null).then(data => setCountries(Array.isArray(data?.countries) ? data.countries : [])).catch(() => {}); }, []);

  const setHtml = (block: Block, index: number, language: keyof WebColumnHtml, html: string) => setConfig(current => ({
    ...current,
    htmlColumns: { ...current.htmlColumns, [block]: current.htmlColumns[block].map((value, column) => column === index ? { ...value, [language]: html } : value) },
  }));
  const setColumnStyle = (block: Block, index: number, field: keyof WebColumnStyle, value: WebColorSlot) => setConfig(current => ({
    ...current,
    columnStyles: { ...current.columnStyles, [block]: current.columnStyles[block].map((style, column) => column === index ? { ...style, [field]: value } : style) },
  }));
  const applyTextColor = (block: Block, index: number, language: keyof WebColumnHtml, color: WebColorSlot) => {
    const key = `${block}-${index}-${language}`;
    const input = htmlInputs.current[key];
    if (!input) return;
    const from = input.selectionStart;
    const to = input.selectionEnd;
    if (from === to) { setNotice("Selecciona primero el texto al que quieres cambiar el color."); return; }
    const selected = input.value.slice(from, to);
    const colorClass = `text-color-${color.slice(-1)}`;
    const html = `${input.value.slice(0, from)}<span class="${colorClass}">${selected}</span>${input.value.slice(to)}`;
    setHtml(block, index, language, html);
    window.setTimeout(() => { input.focus(); input.setSelectionRange(from, to + `<span class="${colorClass}"></span>`.length); }, 0);
  };
  const uploadJerseys = async (block: Block, index: number, language: keyof WebColumnHtml, files: FileList) => {
    const selected = Array.from(files).slice(0, 3);
    if (!selected.length) return;
    const key = `${block}-${index}-${language}`;
    setUploadingJerseys(current => ({ ...current, [key]: true }));
    setNotice("");
    try {
      const images: string[] = [];
      for (const file of selected) {
        const form = new FormData();
        form.set("id", "ESP0022");
        form.set("file", file);
        const response = await fetch("/api/camisetas", { method: "POST", body: form });
        const data = await response.json() as { photos?: string[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "No se ha podido subir la camiseta.");
        const url = data.photos?.at(-1);
        if (url) images.push(url);
      }
      if (images.length) setConfig(current => ({ ...current, htmlColumns: { ...current.htmlColumns, [block]: current.htmlColumns[block].map((value, column) => column === index ? { ...value, [language]: `${value[language]}<div class="jersey-row">${images.map(url => `<img src="${url}" alt="Camiseta Rugby Cabrera">`).join("")}</div>` } : value) } }));
      setNotice(`${images.length} camiseta${images.length === 1 ? " subida" : "s subidas"} y añadida${images.length === 1 ? "" : "s"} al HTML.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se han podido subir las camisetas."); }
    finally { setUploadingJerseys(current => ({ ...current, [key]: false })); }
  };
  const insertMainJerseyFeature = (block: Block, index: number, language: keyof WebColumnHtml) => {
    const logo = `<img class="jersey-feature-logo" src="${config.brand.logo}" alt="Logo de ${config.brand.name}">`;
    const feature = `<div class="jersey-feature"><div class="jersey-feature-pill-bg"></div><img class="jersey-feature-shirt" src="${config.brand.jerseyImage}" alt="Camiseta Rugby Cabrera">${logo}<div class="jersey-feature-copy"><small>NUESTROS COLORES</small><strong>El orgullo de pertenecer.</strong><span>Rojo en el corazón. Azul en el ADN.</span><b class="jersey-feature-pill">RUGBY CABRERA</b></div></div>`;
    setConfig(current => ({ ...current, htmlColumns: { ...current.htmlColumns, [block]: current.htmlColumns[block].map((value, column) => column === index ? { ...value, [language]: `${value[language]}${feature}` } : value) } }));
  };
  const setLayout = (block: Block, layout: "one" | "two" | "three") => setConfig(current => {
    const count = layout === "three" ? 3 : layout === "two" ? 2 : 1;
    return {
      ...current,
      layouts: { ...current.layouts, [block]: layout },
      htmlColumns: { ...current.htmlColumns, [block]: Array.from({ length: count }, () => ({ ...emptyColumnHtml })) },
      columnStyles: { ...current.columnStyles, [block]: Array.from({ length: count }, () => ({ ...emptyColumnStyle })) },
    };
  });
  const setBrand = (field: "primary" | "accent" | "secondary" | "headerColor" | "textColor" | "menuColor" | "menuTextColor" | "headingFont" | "subtitleFont" | "bodyFont" | "logo" | "jerseyImage" | "sealImage", value: string) => setConfig(current => ({ ...current, brand: { ...current.brand, [field]: value } }));
  const setMenu = (id: string, field: "label" | "href" | "parentId", value: string) => setConfig(current => ({ ...current, menu: current.menu.map(item => item.id === id ? { ...item, [field]: value || undefined } : item) }));
  const setBlockTitle = (block: Block, title: string) => setConfig(current => ({ ...current, blockTitles: { ...current.blockTitles, [block]: title } }));
  const moveBlock = (from: number, to: number) => setConfig(current => {
    if (to < 0 || to >= current.blockOrder.length) return current;
    const blockOrder = [...current.blockOrder];
    const [block] = blockOrder.splice(from, 1);
    blockOrder.splice(to, 0, block);
    return { ...current, blockOrder };
  });
  const addMenu = (parentId?: string) => setConfig(current => ({ ...current, menu: [...current.menu, { id: `menu-${Date.now()}-${current.menu.length}`, label: parentId ? "Nuevo submenú" : "Nuevo título", href: "#inicio", parentId }] }));
  const removeMenu = (id: string) => setConfig(current => ({ ...current, menu: current.menu.filter(item => item.id !== id).map(item => item.parentId === id ? { ...item, parentId: undefined } : item) }));
  const setSize = (field: "headingSize" | "subtitleSize" | "bodySize", value: number) => setConfig(current => ({ ...current, brand: { ...current.brand, [field]: value } }));
  const setLanguage = (position: number, language: WebLanguage) => setConfig(current => {
    const currentOrder = [...current.languages];
    const found = currentOrder.indexOf(language);
    const previous = currentOrder[position];
    if (found >= 0) currentOrder[found] = previous;
    currentOrder[position] = language;
    return { ...current, languages: currentOrder };
  });
  const uploadMainJersey = async (file: File) => {
    setUploadingMainJersey(true); setNotice("");
    try {
      const form = new FormData();
      form.set("id", "ESP0022"); form.set("file", file);
      const response = await fetch("/api/camisetas", { method: "POST", body: form });
      const data = await response.json() as { photos?: string[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se ha podido subir la camiseta.");
      const image = data.photos?.at(-1);
      if (!image) throw new Error("No se ha recibido la imagen subida.");
      setBrand("jerseyImage", image);
      setNotice("Camiseta principal actualizada. Guarda el borrador para aplicarla a la web.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se ha podido subir la camiseta."); }
    finally { setUploadingMainJersey(false); }
  };
  const uploadShield = async (file: File) => {
    setUploadingShield(true); setNotice("");
    try {
      const form = new FormData();
      form.set("file", file); form.set("removeBackground", "1");
      const response = await fetch("/api/clubs/escudo/ESP0022", { method: "POST", body: form });
      const data = await response.json() as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error ?? "No se ha podido subir el escudo.");
      const nextConfig = { ...config, brand: { ...config.brand, logo: `${data.url}?v=${Date.now()}` } };
      setConfig(nextConfig);
      const saveResponse = await fetch("/api/web/ESP022/home", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config: nextConfig }) });
      const saved = await saveResponse.json();
      if (!saveResponse.ok) throw new Error(saved.error ?? "No se ha podido guardar el cambio del escudo.");
      setConfig(saved.config);
      setNotice("Escudo actualizado y borrador guardado.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se ha podido subir el escudo."); }
    finally { setUploadingShield(false); }
  };
  const uploadSeal = async (file: File) => {
    setUploadingSeal(true); setNotice("");
    try {
      const form = new FormData(); form.set("file", file);
      const response = await fetch("/api/web/ESP022/home/sello", { method: "POST", body: form });
      const data = await response.json() as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error ?? "No se ha podido subir el sello.");
      setBrand("sealImage", `${data.url}?v=${Date.now()}`);
      setNotice("Sello actualizado. Guarda el borrador para aplicarlo a la web.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se ha podido subir el sello."); }
    finally { setUploadingSeal(false); }
  };

  async function save() {
    setSaving(true); setNotice("");
    try {
      const response = await fetch("/api/web/ESP022/home", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setConfig(data.config); setNotice("Borrador guardado. La web pública todavía no ha cambiado.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se ha podido guardar."); }
    finally { setSaving(false); }
  }
  async function publish() {
    if (!window.confirm("¿Publicar el borrador actual en la web de Rugby Cabrera?")) return;
    setSaving(true); setNotice("");
    try {
      const response = await fetch("/api/web/ESP022/home", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "publish" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setNotice("Web publicada correctamente.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se ha podido publicar."); }
    finally { setSaving(false); }
  }

  return <main className="min-h-screen bg-slate-100 p-5 text-slate-900 sm:p-8"><div className="mx-auto max-w-6xl">
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-black tracking-[.18em] text-red-700">RUGBY CABRERA · ADMINISTRACIÓN</p><h1 className="text-3xl font-black">Constructor de páginas</h1></div><div className="flex flex-wrap gap-2"><Link href="/rugby/ESP022/web/home?borrador=1" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800">Ver web borrador ↗</Link><Link href="/rugby/ESP022/web/home" className="rounded-lg border bg-white px-4 py-2 text-sm font-bold">Ver web pública ↗</Link></div></header>
    {notice && <p role="status" className="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">{notice}</p>}
    <section className="mb-5 rounded-2xl bg-white p-5 shadow-sm"><button type="button" aria-expanded={!configurationCollapsed} onClick={() => setConfigurationCollapsed(current => !current)} className="flex w-full items-center gap-2 text-left"><span aria-hidden="true" className="text-sm">{configurationCollapsed ? "▶" : "▼"}</span><div><h2 className="text-xl font-black">Configuración web</h2><p className="mt-1 text-sm text-slate-600">Colores, tipografías y recursos de esta página.</p></div></button>
      {!configurationCollapsed && <div className="mt-3 flex justify-end"><button type="button" disabled={saving} onClick={() => void save()} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-sm text-slate-500 transition hover:border-slate-500 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Guardar borrador de configuración" title="Guardar borrador">💾</button></div>}
      {!configurationCollapsed && <>
      <div className="mt-4 grid gap-4 md:grid-cols-3">{([["headerColor", "Color de cabecera"], ["textColor", "Color de textos"], ["menuColor", "Color de menú"], ["menuTextColor", "Texto de menú"], ["primary", "Color 1"], ["accent", "Color 2"], ["secondary", "Color 3"]] as const).map(([field, label]) => <label key={field} className="text-sm font-bold">{label}<div className="mt-1 flex gap-2"><input type="color" value={config.brand[field]} onChange={event => setBrand(field, event.target.value)} className="h-11 w-14 rounded border" /><input value={config.brand[field]} onChange={event => setBrand(field, event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm" /></div></label>)}</div>
      <div className="mt-5 grid gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2 lg:grid-cols-3">
        <div><p className="text-sm font-black">Escudo</p><p className="mt-1 text-xs text-slate-600">Se muestra en la cabecera de la web.</p><div className="mt-3 flex flex-wrap items-center gap-4"><span className="flex h-24 w-24 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-2"><img src={config.brand.logo} alt="Vista previa del escudo" className="h-full w-full object-contain" /></span><label className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800">{uploadingShield ? "Subiendo…" : "Subir escudo"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploadingShield} className="sr-only" onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void uploadShield(file); }} /></label></div></div>
        <div><p className="text-sm font-black">Camiseta principal</p><p className="mt-1 text-xs text-slate-600">Se muestra en la portada pública de la web.</p><div className="mt-3 flex flex-wrap items-center gap-4"><span className="flex h-24 w-24 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-2"><img src={config.brand.jerseyImage} alt="Vista previa de la camiseta" className="h-full w-full object-contain" /></span><label className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800">{uploadingMainJersey ? "Subiendo…" : "Subir camiseta"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploadingMainJersey} className="sr-only" onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void uploadMainJersey(file); }} /></label></div></div>
        <div><p className="text-sm font-black">Sello</p><p className="mt-1 text-xs text-slate-600">Aparece separado sobre la composición de camiseta.</p><div className="mt-3 flex flex-wrap items-center gap-2"><span className="flex h-24 w-24 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-2"><img src={config.brand.sealImage} alt="Vista previa del sello" className="h-full w-full object-contain" /></span><label className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800">{uploadingSeal ? "Subiendo…" : "Subir sello"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploadingSeal} className="sr-only" onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void uploadSeal(file); }} /></label>{config.brand.sealImage !== "/web-media/empty-seal.svg" && <button type="button" title="Quitar sello" aria-label="Quitar sello" disabled={saving} onClick={() => { if (window.confirm("¿Quitar el sello de la composición de camiseta?")) { setBrand("sealImage", "/web-media/empty-seal.svg"); setNotice("Sello quitado. Guarda el borrador para aplicarlo a la web."); } }} className="rounded-lg border border-red-300 bg-white px-3 py-2 text-lg font-black leading-none text-red-700 disabled:opacity-50">×</button>}</div></div>
      </div>
      <div className="mt-5 border-t border-slate-200 pt-4"><p className="text-sm font-black">Idiomas y orden de la web</p><p className="mt-1 text-xs text-slate-600">El primer idioma será el principal. Cada opción y su bandera se obtienen de la tabla de Países.</p><div className="mt-3 grid gap-3 sm:grid-cols-3">{config.languages.map((language, index) => { const view = languageView(language); return <label key={index} className="text-xs font-bold uppercase tracking-wide text-slate-600">{index + 1}.º idioma<span className="mt-1 flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3"><img src={view.country.flag_url} alt="" className="h-4 w-6 object-cover" /><select value={view.country.id} onChange={event => { const choice = languageChoices.find(item => item.country.id === event.target.value); if (choice) setLanguage(index, choice.value); }} className="min-w-0 flex-1 bg-transparent py-3 text-sm font-bold normal-case tracking-normal text-slate-900">{languageChoices.map(choice => <option key={choice.value} value={choice.country.id}>{choice.label} · {choice.country.name}</option>)}</select></span></label>; })}</div></div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">{([["headingFont", "headingSize", "Tipografía de títulos (H1)", 24, 120], ["subtitleFont", "subtitleSize", "Tipografía de subtítulos (H2)", 16, 96], ["bodyFont", "bodySize", "Tipografía de texto (H3)", 10, 32]] as const).map(([font, size, label, min, max]) => <div key={font} className="rounded-lg border border-slate-200 p-3"><p className="text-sm font-black">{label}</p><label className="mt-2 block text-xs font-bold">Tipo<input value={config.brand[font]} onChange={event => setBrand(font, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm" /></label><label className="mt-2 block text-xs font-bold">Tamaño (px)<input type="number" min={min} max={max} value={config.brand[size]} onChange={event => setSize(size, Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm" /></label></div>)}</div>
      </>}
    </section>
    <section className="mb-5 rounded-2xl bg-white p-5 shadow-sm"><button type="button" aria-expanded={!menusCollapsed} onClick={() => setMenusCollapsed(current => !current)} className="flex w-full items-center gap-2 text-left"><span aria-hidden="true" className="text-sm">{menusCollapsed ? "▶" : "▼"}</span><div><h2 className="text-xl font-black">Menús y submenús</h2><p className="mt-1 text-sm text-slate-600">Gestiona los enlaces de navegación de la web.</p></div></button>
      <div className="mt-3 flex justify-end"><button type="button" disabled={saving} onClick={() => void save()} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-sm text-slate-500 transition hover:border-slate-500 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Guardar borrador de menús" title="Guardar borrador">💾</button></div>
      {!menusCollapsed && <div className="mt-4 border-t border-slate-200 pt-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-600">Añade títulos, elimina los que no necesites y elige el menú principal del que cuelga cada submenú.</p><button type="button" onClick={() => addMenu()} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800">Añadir título</button></div><div className="space-y-3">{config.menu.map((item, index) => { const parentMenus = config.menu.filter(option => !option.parentId && option.id !== item.id); return <div key={item.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-xs font-bold uppercase tracking-wide text-slate-600">Título<input aria-label={`Título del menú ${index + 1}`} value={item.label} maxLength={60} onChange={event => setMenu(item.id, "label", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-900" /></label><label className="text-xs font-bold uppercase tracking-wide text-slate-600">Enlace<input aria-label={`Enlace del menú ${index + 1}`} value={item.href} maxLength={500} onChange={event => setMenu(item.id, "href", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-900" /></label><label className="text-xs font-bold uppercase tracking-wide text-slate-600">Cuelga de<select aria-label={`Menú padre de ${item.label || `entrada ${index + 1}`}`} value={item.parentId ?? ""} onChange={event => setMenu(item.id, "parentId", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-900"><option value="">Menú principal</option>{parentMenus.map(parent => <option key={parent.id} value={parent.id}>{parent.label || "Sin título"}</option>)}</select></label><div className="flex items-end gap-2"><button type="button" onClick={() => addMenu(item.parentId ?? item.id)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800">Añadir submenú</button><button type="button" onClick={() => removeMenu(item.id)} className="rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-bold text-red-700">Eliminar</button></div></div>; })}</div></div>}
    </section>
    <div className="space-y-5">{config.blockOrder.map((block, blockIndex) => {
      const columnsClass = config.layouts[block] === "three" ? "lg:grid-cols-3" : config.layouts[block] === "two" ? "lg:grid-cols-2" : "";
      return <section key={block} className="web-editor-block rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center gap-3"><h2 className="text-xl font-black">{config.blockTitles[block]}</h2><button type="button" onClick={() => { const title = window.prompt("Nombre del bloque", config.blockTitles[block]); if (title?.trim()) setBlockTitle(block, title.trim()); }} className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-sm text-slate-600 hover:border-slate-500" aria-label={`Editar nombre de ${config.blockTitles[block]}`} title="Editar nombre">✎</button><button type="button" disabled={blockIndex === 0} onClick={() => moveBlock(blockIndex, blockIndex - 1)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-sm font-black disabled:opacity-40" aria-label={`Subir ${config.blockTitles[block]}`} title="Subir bloque">↑</button><button type="button" disabled={blockIndex === config.blockOrder.length - 1} onClick={() => moveBlock(blockIndex, blockIndex + 1)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-sm font-black disabled:opacity-40" aria-label={`Bajar ${config.blockTitles[block]}`} title="Bajar bloque">↓</button><button type="button" disabled={saving} onClick={() => void save()} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-sm text-slate-500 transition hover:border-slate-500 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50" aria-label={`Guardar ${config.blockTitles[block]}`} title={`Guardar ${config.blockTitles[block]}`}>💾</button><div className="flex items-center gap-1" role="group" aria-label="Columnas del bloque">{columnOptions.map(option => { const count = option === "three" ? 3 : option === "two" ? 2 : 1; return <button key={option} type="button" title={`${count} columnas`} onClick={() => setLayout(block, option)} className={`rounded border p-1.5 ${config.layouts[block] === option ? "border-red-700 bg-red-700 text-white" : "border-slate-300 bg-white text-slate-700"}`}><span className="flex h-4 gap-0.5">{Array.from({ length: count }, (_, index) => <i key={index} className="h-4 w-1.5 rounded-sm bg-current" />)}</span></button>; })}</div></div>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><label className="min-w-52 text-xs font-bold uppercase tracking-wide text-slate-600">Nombre del bloque<input value={config.blockTitles[block]} maxLength={40} onChange={event => setBlockTitle(block, event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold normal-case tracking-normal text-slate-900" /></label><div className="flex items-center gap-2"><button type="button" disabled={blockIndex === 0} onClick={() => moveBlock(blockIndex, blockIndex - 1)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-lg font-black disabled:opacity-40" aria-label={`Subir ${config.blockTitles[block]}`} title="Subir bloque">↑</button><button type="button" disabled={blockIndex === config.blockOrder.length - 1} onClick={() => moveBlock(blockIndex, blockIndex + 1)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-lg font-black disabled:opacity-40" aria-label={`Bajar ${config.blockTitles[block]}`} title="Bajar bloque">↓</button><button type="button" disabled={saving} onClick={() => void save()} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-sm text-slate-500 transition hover:border-slate-500 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50" aria-label={`Guardar ${config.blockTitles[block]}`} title={`Guardar ${config.blockTitles[block]}`}>💾</button></div></div>
        <div className={`grid gap-5 ${columnsClass}`}>{config.htmlColumns[block].map((content, index) => {
          const style = config.columnStyles[block][index] ?? emptyColumnStyle;
          const zoomKey = `${block}-${index}`;
          const zoom = previewZoom[zoomKey] ?? 1;
          return <div key={index} className="space-y-5">
            <p className="text-sm font-black">Columna {index + 1}</p>
            <div className="grid grid-cols-2 gap-3 text-xs font-bold"><div><span>Fondo</span><div className="mt-1 flex gap-2">{colorOptions.map(option => { const color = option.value === "color1" ? config.brand.primary : option.value === "color2" ? config.brand.accent : config.brand.secondary; const selected = style.background === option.value; return <button key={option.value} type="button" title={option.label} onClick={() => setColumnStyle(block, index, "background", option.value)} className={`h-9 w-9 rounded border-2 ${selected ? "border-slate-950 ring-2 ring-slate-400" : "border-transparent"}`} style={{ backgroundColor: color }} />; })}</div></div><div><span>Triángulo de camiseta</span><div className="mt-1 flex gap-2">{colorOptions.map(option => { const color = option.value === "color1" ? config.brand.primary : option.value === "color2" ? config.brand.accent : config.brand.secondary; const selected = style.featureAccent === option.value; return <button key={option.value} type="button" title={option.label} onClick={() => setColumnStyle(block, index, "featureAccent", option.value)} className={`h-9 w-9 rounded border-2 ${selected ? "border-slate-950 ring-2 ring-slate-400" : "border-transparent"}`} style={{ backgroundColor: color }} />; })}</div></div></div>
            <div><div className="mb-1 flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600">Vista previa <img src={languageView(config.languages[0]).country.flag_url} alt="" className="h-4 w-6 object-cover" /> {languageView(config.languages[0]).label}</span><div className="flex items-center gap-1"><button type="button" title="Alejar" onClick={() => setPreviewZoom(current => ({ ...current, [zoomKey]: Math.max(.5, zoom - .1) }))} className="rounded border px-2 py-1 text-sm font-bold">−</button><button type="button" title="Restablecer zoom" onClick={() => setPreviewZoom(current => ({ ...current, [zoomKey]: 1 }))} className="rounded border px-2 py-1 text-xs font-bold">{Math.round(zoom * 100)}%</button><button type="button" title="Acercar" onClick={() => setPreviewZoom(current => ({ ...current, [zoomKey]: Math.min(1.8, zoom + .1) }))} className="rounded border px-2 py-1 text-sm font-bold">+</button></div></div><div className="h-[374px] overflow-auto rounded-lg border border-slate-300 bg-white"><iframe title={`Vista previa HTML de ${titles[block]}, columna ${index + 1}`} sandbox="" srcDoc={htmlPreviewDocument(content[config.languages[0]], style, config.brand)} className="block border-0 bg-white" style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width: `${100 / zoom}%`, height: `${374 / zoom}px` }} /></div></div>
          </div>;
        })}</div>
        <section className="mt-6 border-t border-slate-200 pt-4"><button type="button" aria-expanded={!htmlCollapsed[block]} onClick={() => setHtmlCollapsed(current => ({ ...current, [block]: !current[block] }))} className="flex items-center gap-2 text-sm font-black">{htmlCollapsed[block] ? "▶" : "▼"} HTML del bloque</button>
          {!htmlCollapsed[block] && <div className={`mt-4 grid gap-5 ${columnsClass}`}>{config.htmlColumns[block].map((content, index) => <div key={index} className="space-y-4"><p className="text-sm font-black">Columna {index + 1}</p>{orderedLanguages.map(language => {
            const inputKey = `${block}-${index}-${language.key}`;
            return <label key={language.key} className="block"><span className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600"><img src={language.country.flag_url} alt="" className="h-4 w-6 object-cover" /> {language.label} · HTML del bloque</span><div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2"><span className="mr-1 text-xs font-bold text-slate-600">Color del texto seleccionado:</span>{colorOptions.map(option => { const color = option.value === "color1" ? config.brand.primary : option.value === "color2" ? config.brand.accent : config.brand.secondary; return <button key={option.value} type="button" title={option.label} onClick={() => applyTextColor(block, index, language.key, option.value)} className="h-8 w-8 rounded border-2 border-white ring-1 ring-slate-300" style={{ backgroundColor: color }} />; })}</div><div className="mb-2 flex flex-wrap items-center gap-2"><button type="button" onClick={() => insertMainJerseyFeature(block, index, language.key)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800">Insertar camiseta sobre pastilla</button><span className="text-xs font-bold text-slate-600">o subir camisetas (1, 2 o 3 en fila):</span><input type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={uploadingJerseys[inputKey]} onChange={event => { const files = event.currentTarget.files; event.currentTarget.value = ""; if (files) void uploadJerseys(block, index, language.key, files); }} className="block max-w-full text-xs" />{uploadingJerseys[inputKey] && <span className="text-xs font-bold text-slate-500">Subiendo…</span>}</div><textarea ref={element => { htmlInputs.current[inputKey] = element; }} rows={16} maxLength={12000} spellCheck={false} value={content[language.key]} onChange={event => setHtml(block, index, language.key, event.target.value)} className="w-full rounded-lg border border-slate-300 p-3 font-mono text-sm" /></label>;
          })}</div>)}</div>}
        </section>
      </section>;
    })}</div>
    <footer className="sticky bottom-4 mt-6 flex flex-wrap justify-end gap-3"><button type="button" disabled={saving} onClick={() => void save()} className="rounded-xl border bg-white px-5 py-3 font-black shadow-lg disabled:opacity-50">{saving ? "Guardando…" : "Guardar borrador"}</button><button type="button" disabled={saving} onClick={() => void publish()} className="rounded-xl bg-red-700 px-5 py-3 font-black text-white shadow-lg disabled:opacity-50">Publicar cambios</button></footer>
  </div></main>;
}
