import { NextRequest, NextResponse } from "next/server";
import { requireConsultation } from "@/lib/consultation-access";
import { readPlayerNews, validNewsId } from "@/lib/player-news";
import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function publicAddress(address: string) {
  const [a, b] = address.split(".").map(Number);
  return a > 0 && a < 224 && a !== 10 && a !== 127 && !(a === 169 && b === 254) &&
    !(a === 172 && b >= 16 && b <= 31) && !(a === 192 && (b === 168 || b === 0)) &&
    !(a === 100 && b >= 64 && b <= 127) && !(a === 198 && (b === 18 || b === 19));
}

async function loadPage(url: URL, redirects = 0): Promise<{ html: string; blocked: boolean }> {
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
  return result.redirect ? loadPage(new URL(result.redirect, url), redirects + 1) : result;
}

function plain(value: string) {
  return value.replace(/\[?&hellip;\]?/gi, "…").replace(/<[^>]*>/g, " ").replace(/&(?:nbsp|amp|quot|apos|lt|gt);|&#(?:\d+|x[\da-f]+);/gi, (entity) => {
    const known: Record<string, string> = {"&nbsp;": " ", "&amp;": "&", "&quot;": '"', "&apos;": "'", "&lt;": "<", "&gt;": ">"};
    if (known[entity.toLowerCase()]) return known[entity.toLowerCase()];
    const code = entity.startsWith("&#x") ? parseInt(entity.slice(3), 16) : parseInt(entity.slice(2), 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
  }).replace(/\s+/g, " ").trim();
}

function description(html: string) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attributes: Record<string, string> = {};
    for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attributes[match[1].toLowerCase()] = match[2] ?? match[3];
    if (["description", "og:description", "twitter:description"].includes((attributes.name || attributes.property || "").toLowerCase()) && attributes.content) return plain(attributes.content).slice(0, 450);
  }
  return "";
}

export async function GET(request: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const denied = await requireConsultation(request); if (denied) return denied;
  const {id} = await params;
  const headers = {"Cache-Control": "private, no-store", Vary: "Cookie"};
  if (!validNewsId(id)) return NextResponse.json({error: "Noticia no válida"}, {status: 400, headers});
  const news = (await readPlayerNews()).find((item) => item.id === id && item.published);
  if (!news) return NextResponse.json({error: "Noticia no disponible"}, {status: 404, headers});
  try {
    const page = await loadPage(new URL(news.url));
    return NextResponse.json({summary: description(page.html), canEmbed: !page.blocked}, {headers});
  } catch {
    return NextResponse.json({summary: "", canEmbed: false}, {headers});
  }
}
