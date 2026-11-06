import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";


function publicAddress(address: string) {
  const [a, b] = address.split(".").map(Number);
  return a > 0 && a < 224 && a !== 10 && a !== 127 && !(a === 169 && b === 254) &&
    !(a === 172 && b >= 16 && b <= 31) && !(a === 192 && (b === 168 || b === 0)) &&
    !(a === 100 && b >= 64 && b <= 127) && !(a === 198 && (b === 18 || b === 19));
}

async function loadPage(url: URL, redirects = 0): Promise<{ html: string; blocked: boolean; url: string }> {
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      (url.port && !["80", "443"].includes(url.port)) || redirects > 3) throw new Error("URL no disponible");
  const addresses = await lookup(url.hostname, {all: true, family: 4});
  if (!addresses.length || addresses.some((item) => !publicAddress(item.address))) throw new Error("Dirección no disponible");
  const address = addresses[0].address;
  const result = await new Promise<{ html: string; blocked: boolean; redirect?: string }>((resolve, reject) => {
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, {
      signal: AbortSignal.timeout(7000),
      headers: { "User-Agent": "CTRUGBY-HUB/1.0", Accept: "text/html", "Accept-Encoding": "identity" },
      lookup: (_hostname, options, callback) => {
        if (typeof options === "object" && options.all) callback(null, [{address, family: 4}]);
        else callback(null, address, 4);
      },
    }, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume(); resolve({html: "", blocked: true, redirect: response.headers.location}); return;
      }
      if (response.statusCode !== 200 || !response.headers["content-type"]?.includes("text/html")) {
        response.resume(); reject(new Error("Vista previa no disponible")); return;
      }
      const framePolicy = response.headers["x-frame-options"];
      const csp = String(response.headers["content-security-policy"] || "");
      const blocked = Boolean(framePolicy) || /frame-ancestors\s+(?!\*\s*(?:;|$))/i.test(csp);
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > 512_000) { resolve({html: Buffer.concat(chunks).toString("utf8"), blocked}); response.destroy(); }
        else chunks.push(chunk);
      });
      response.on("end", () => resolve({html: Buffer.concat(chunks).toString("utf8"), blocked}));
      response.on("error", reject);
    });
    request.on("error", reject);
    request.end();
  });
  return result.redirect ? loadPage(new URL(result.redirect, url), redirects + 1) : {...result, url: url.href};
}

function plain(value: string) {
  return value.replace(/\[?&hellip;\]?/gi, "…").replace(/<[^>]*>/g, " ").replace(/&(?:nbsp|amp|quot|apos|lt|gt);|&#(?:\d+|x[\da-f]+);/gi, (entity) => {
    const known: Record<string, string> = {"&nbsp;": " ", "&amp;": "&", "&quot;": '"', "&apos;": "'", "&lt;": "<", "&gt;": ">"};
    if (known[entity.toLowerCase()]) return known[entity.toLowerCase()];
    const code = entity.startsWith("&#x") ? parseInt(entity.slice(3), 16) : parseInt(entity.slice(2), 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
  }).replace(/\s+/g, " ").trim();
}

export type ArticleMetadata = {title: string; summary: string; image: string | null};
export function parseArticleMetadata(html: string, pageUrl: string): ArticleMetadata {
  const metadata = new Map<string, string>();
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attributes: Record<string, string> = {};
    for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attributes[match[1].toLowerCase()] = match[2] ?? match[3];
    const name = (attributes.property || attributes.name || "").toLowerCase();
    if (name && attributes.content && !metadata.has(name)) metadata.set(name, attributes.content);
  }
  const summary = plain(metadata.get("og:description") || metadata.get("description") || metadata.get("twitter:description") || "").slice(0,450);
  const title = plain(metadata.get("og:title") || metadata.get("twitter:title") || html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").slice(0,300);
  let image: string | null = null;
  const rawImage = metadata.get("og:image:secure_url") || metadata.get("og:image") || metadata.get("twitter:image") || metadata.get("twitter:image:src");
  if (rawImage) try {
    const url = new URL(plain(rawImage), pageUrl);
    if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password && !/^(?:localhost|.*\.localhost|.*\.local)$/.test(url.hostname) && !url.hostname.includes(":") && (!/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) || publicAddress(url.hostname))) image = url.href;
  } catch { /* La fuente no publica una imagen válida. */ }
  return {title, summary, image};
}
const cache = new Map<string, {expires: number; value: Promise<ArticleMetadata>}>();
export async function articleMetadata(url: string): Promise<ArticleMetadata> {
  const known = cache.get(url); if (known && known.expires > Date.now()) return known.value;
  const value = loadPage(new URL(url)).then(page => parseArticleMetadata(page.html, page.url)).catch(() => ({title: "", summary: "", image: null}));
  if (cache.size >= 200) cache.delete(cache.keys().next().value!);
  cache.set(url, {expires: Date.now() + 5 * 60 * 1000, value});
  return value;
}
export async function articleSummary(url: string): Promise<string> {return (await articleMetadata(url)).summary;}
