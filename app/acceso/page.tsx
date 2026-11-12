"use client";

import Link from "@/app/components/sport-link";
import { EmailProfileAccess } from "@/app/components/email-profile-access";
import { AccessReturnActions } from "@/app/components/access-return-actions";
import { PasswordInput } from "@/app/components/password-input";
import Image from "next/image";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "@/lib/sport-navigation";
import { brand } from "@/lib/brand";

type Choice = { index: number; label: string; ending: string | null };
type Setup = { qrCode: string; secret: string };
type AccessReply = { destination?: string; requiresCode?: boolean; requiresPhone?: boolean; setup?: Setup; choices?: Choice[]; error?: string };
type AccessStatus = { googleAdminOAuthEnabled?: boolean };
export default function AccessPage() {
  const router = useRouter();
  const [step, setStep] = useState<"login" | "phone" | "authenticator" | "recover">("login");
  const [privateAccess, setPrivateAccess] = useState(false);
  const [administrator, setAdministrator] = useState(false);
  const [clubAccess, setClubAccess] = useState(false);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [choice, setChoice] = useState(0);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [privateNotice, setPrivateNotice] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);
  const [googleAdminOAuthEnabled, setGoogleAdminOAuthEnabled] = useState(false);
  const googleMfaStarted = useRef(false);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    let active = true;
    const timer = window.setTimeout(() => {
      if (query.get("recuperar") === "1") { setStep("recover"); setPrivateAccess(true); setAdministrator(true); }
      if (query.get("privado") === "1") setPrivateAccess(true);
      setPrivateNotice(query.get("privado") === "1");
      const oauthError = query.get("oauth_error");
      const oauthMessages: Record<string, string> = {
        unavailable: "El acceso con Google aún no está configurado. Puedes continuar con contraseña y app autenticadora.",
        state: "La validación de Google ha caducado o no coincide. Vuelve a iniciar el acceso.",
        cancelled: "Se ha cancelado el acceso con Google.",
        exchange: "No se ha podido validar la respuesta de Google. Vuelve a intentarlo.",
        account: "La cuenta de Google no está confirmada o no se ha podido validar.",
        "not-admin": "La cuenta no tiene un rol de administrador autorizado.",
      };
      if (oauthError) {
        setPrivateAccess(true);
        setAdministrator(true);
        setError(oauthMessages[oauthError] ?? "No se ha podido completar el acceso con Google.");
      }
      if (query.get("google") === "1" && !googleMfaStarted.current) {
        googleMfaStarted.current = true;
        setPrivateAccess(true);
        setAdministrator(true);
        setStep("authenticator");
        setBusy(true);
        void fetch("/api/acceso", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "start-google-admin-mfa" }),
        }).then(async (response) => {
          const data = await response.json() as AccessReply;
          if (!response.ok) throw new Error(data.error ?? "No se ha podido preparar la app autenticadora.");
          if (active) setSetup(data.setup ?? null);
        }).catch((cause: unknown) => {
          if (active) setError(cause instanceof Error ? cause.message : "No se ha podido preparar la app autenticadora.");
        }).finally(() => { if (active) setBusy(false); });
      }
    }, 0);
    void fetch("/api/acceso/estado", { cache: "no-store" })
      .then(async (response): Promise<AccessStatus> => response.ok ? await response.json() as AccessStatus : {})
      .then((status) => { if (active) setGoogleAdminOAuthEnabled(status.googleAdminOAuthEnabled === true); })
      .catch(() => { if (active) setGoogleAdminOAuthEnabled(false); });
    return () => { active = false; window.clearTimeout(timer); };
  }, []);
  async function enterPublic() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/acceso", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "public-mode" }) });
      if (!response.ok) throw new Error("No se ha podido cambiar al acceso público.");
      setPrivateNotice(false); setStep("login"); setSetup(null); setRecoverySent(false);
      window.location.replace("/");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se ha podido cambiar de modo."); }
    finally { setBusy(false); }
  }
  async function enterLocalAdmin() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/acceso", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "local-admin" }) });
      const data = await response.json() as AccessReply;
      if (!response.ok || !data.destination) throw new Error(data.error ?? "No se ha podido abrir la administración local.");
      window.location.replace(data.destination);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se ha podido abrir la administración local."); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const recovering = step === "recover";
      const action = step === "login" ? "login" : step === "phone" ? "select-phone" : "verify-authenticator";
      const response = await fetch(recovering ? "/api/acceso/recuperar" : "/api/acceso", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...values, ...(clubAccess ? { purpose: "club" } : {}), ...(step === "phone" ? { choice, phone: values.phone ?? "" } : {}) }) });
      const data = await response.json() as AccessReply;
      if (!response.ok) throw new Error(data.error ?? "No se ha podido completar el acceso.");
      if (recovering) { setRecoverySent(true); return; }
      if (data.destination) { setSetup(null); router.push(data.destination); router.refresh(); return; }
      if (data.requiresPhone) { setChoices(data.choices ?? []); setChoice(data.choices?.[0]?.index ?? 0); setStep("phone"); return; }
      if (data.requiresCode) { setSetup(data.setup ?? null); setStep("authenticator"); return; }
      throw new Error("Vuelve a iniciar sesión.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se ha podido completar el acceso."); }
    finally { setBusy(false); }
  }
  const restart = () => { setStep("login"); setError(""); setRecoverySent(false); setChoices([]); setSetup(null); };
  const input = "rounded-lg border border-neutral-300 px-3 py-2.5 font-normal";
  const descriptions = { login: clubAccess ? "Introduce el correo y la contraseña de tu cuenta autorizada del club. Después confirma el código de la app autenticadora de tu móvil. Solo podrás consultar las fichas con autorización activa a tu club." : "Introduce tu correo y contraseña. Tu cuenta determina el acceso disponible. Si corresponde, te pediremos el código de tu app autenticadora.", phone: "Elige la ficha vinculada a tu correo. Si tiene teléfono, identifícalo por sus dos últimos dígitos y escribe el número completo.", authenticator: setup ? `La primera vez, añade ${brand.product} a Google Authenticator, Microsoft Authenticator u otra app compatible. Escanea el QR y escribe el código que genere la app.` : `Abre tu app autenticadora e introduce el código de seis cifras de ${brand.product}.`, recover: "Introduce el correo de tu cuenta para recibir un enlace y elegir una contraseña nueva." };
  const localPreview = typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);
  return (
    <main className="directory-app min-h-screen">
      <header className="catalog-topbar">
        <Link href="/" className="catalog-brand">
          <Image src="/ctrugby-logo-contrast.webp" alt="CTRugby" width={100} height={54} />
          <span><strong>RUGBY - HUB</strong></span>
        </Link>
      </header>
      <section className="mx-auto flex min-h-[calc(100vh-74px)] max-w-md items-center px-5 py-10">
        <div className="w-full rounded-2xl border border-neutral-200 bg-white p-7 shadow-sm">
          <p className="text-xs font-black tracking-[.14em] text-red-700">ACCESOS RUGBY</p>
          <h1 className="mt-2 text-3xl font-black">
            {step === "recover" ? "Recuperar contraseña" : clubAccess ? "Acceso por club" : privateAccess ? "Acceso privado" : "Entrar en Rugby"}
          </h1>
          {localPreview && !privateAccess && (
            <button type="button" disabled={busy} onClick={() => void enterLocalAdmin()} className="mt-5 w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-black text-white disabled:opacity-50">
              Entrar como administrador local
            </button>
          )}
          {privateNotice && (
            <aside className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
              <strong>Estás entrando mediante un enlace privado.</strong>
              <p className="mt-2">Inicia sesión con la cuenta asociada a la ficha. Volverás al enlace después de identificarte.</p>
              <button type="button" disabled={busy} className="mt-3 font-bold text-red-700 disabled:opacity-50" onClick={() => void enterPublic()}>Entrar en modo público</button>
            </aside>
          )}
          {!privateAccess && (
            <div className="mt-6 grid gap-3">
              <button type="button" disabled={busy} onClick={() => void enterPublic()} className="rounded-lg bg-red-700 px-4 py-3 text-sm font-black text-white disabled:opacity-50">Acceso público</button>
              <button type="button" disabled={busy} aria-expanded={privateAccess && !clubAccess} onClick={() => { restart(); setPrivateAccess(true); setAdministrator(false); setClubAccess(false); }} className="rounded-lg border border-red-700 px-4 py-3 text-sm font-black text-red-700 disabled:opacity-50">Acceso privado</button>
              <button type="button" disabled={busy} aria-expanded={clubAccess} onClick={() => { restart(); setPrivateAccess(true); setAdministrator(true); setClubAccess(true); }} className="rounded-lg border border-red-700 px-4 py-3 text-sm font-black text-red-700 disabled:opacity-50">Acceso por club</button>
            </div>
          )}
          {privateAccess && !administrator && <EmailProfileAccess />}
          {privateAccess && !clubAccess && (
            <button type="button" disabled={busy} onClick={() => { restart(); setAdministrator(!administrator); }} className="mt-5 w-full text-sm font-bold text-neutral-600">
              {administrator ? "Acceder a mi ficha por correo" : "Acceso de administrador con contraseña"}
            </button>
          )}
          {privateAccess ? administrator ? (
            <>
              <p id="identificacion" className="mt-3 text-sm leading-6 text-neutral-600">{descriptions[step]}</p>
              {setup && step === "authenticator" && (
                <div className="mt-5 rounded-lg border border-neutral-200 p-4">
                  <Image unoptimized src={setup.qrCode} alt="Código QR para vincular CTRugby a tu app autenticadora" width={240} height={240} className="mx-auto" />
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer font-bold">Configurar sin escanear el QR</summary>
                    <p className="mt-2">Añade una cuenta basada en tiempo llamada CTRugby con esta clave:</p>
                    <code className="mt-2 block break-all select-all rounded bg-neutral-100 p-3">{setup.secret}</code>
                  </details>
                  <p className="mt-3 text-xs text-neutral-600">Guarda esta cuenta en tu app y conserva una copia de recuperación en un lugar seguro. No compartas el QR ni la clave.</p>
                </div>
              )}
              {recoverySent ? (
                <p role="status" className="mt-5 rounded-lg bg-green-50 p-3 text-sm text-green-800">Si el correo está vinculado a una cuenta, recibirás un enlace para crear una contraseña nueva.</p>
              ) : (
                <form key={step} className="mt-7 grid gap-4" onSubmit={submit}>
                  {(step === "login" || step === "recover") && (
                    <label className="grid gap-2 text-sm font-bold">
                      Correo electrónico
                      <input name="email" type="email" autoComplete="username" maxLength={254} required className={input} />
                    </label>
                  )}
                  {step === "login" && (
                    <label className="grid gap-2 text-sm font-bold">
                      Contraseña
                      <PasswordInput name="password" autoComplete="current-password" maxLength={1024} required className={input} />
                    </label>
                  )}
                  {step === "phone" && (
                    <>
                      <fieldset className="grid gap-3">
                        <legend className="mb-2 text-sm font-bold">Ficha y contacto</legend>
                        {choices.map((item) => (
                          <label key={item.index} className="flex items-center gap-3 rounded-lg border p-3">
                            <input type="radio" name="choice" value={item.index} checked={choice === item.index} onChange={() => setChoice(item.index)} required />
                            <span>{item.label}{item.ending ? <> · teléfono terminado en <strong>{item.ending}</strong></> : " · sin teléfono"}</span>
                          </label>
                        ))}
                      </fieldset>
                      {choices.find((item) => item.index === choice)?.ending && (
                        <label className="grid gap-2 text-sm font-bold">
                          Teléfono completo
                          <input name="phone" type="tel" autoComplete="tel" placeholder="+34 600 111 222" maxLength={40} required className={input} />
                        </label>
                      )}
                    </>
                  )}
                  {step === "authenticator" && (
                    <label className="grid gap-2 text-sm font-bold">
                      Código de la app autenticadora
                      <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required className={input} />
                    </label>
                  )}
                  <button disabled={busy} className="mt-2 rounded-lg bg-red-700 px-4 py-3 text-sm font-black text-white disabled:opacity-60">
                    {busy ? "Comprobando…" : step === "authenticator" ? "Confirmar y entrar" : step === "recover" ? "Enviar enlace" : "Continuar"}
                  </button>
                </form>
              )}
              {step === "login" && googleAdminOAuthEnabled && !clubAccess && (
                <div className="mt-5">
                  <a href="/api/acceso/google" className="block rounded-lg border border-neutral-300 px-4 py-3 text-center text-sm font-black text-neutral-800 hover:bg-neutral-50">
                    Continuar con Google
                  </a>
                  <p className="mt-2 text-center text-xs text-neutral-500">La contraseña y la app autenticadora siguen disponibles como alternativa.</p>
                </div>
              )}
              {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
              {step !== "recover" && <button type="button" className="mt-4 w-full text-sm font-bold text-red-700" onClick={() => { setSetup(null); setStep("recover"); setError(""); setRecoverySent(false); }}>Recordar contraseña</button>}
              {step !== "login" && <button type="button" className="mt-4 w-full text-sm font-bold text-neutral-600" onClick={restart}>Volver al acceso</button>}
              {step === "login" && !clubAccess && <Link href="/invitado" className="mt-4 block text-center text-sm font-bold text-red-700">Registrarme como invitado</Link>}
            </>
          ) : null : (
            <p className="mt-4 text-sm leading-6 text-neutral-600">Elige acceso público, acceso privado a tu ficha o acceso por club con app autenticadora.</p>
          )}
          <AccessReturnActions disabled={busy} onBack={privateAccess ? () => { restart(); setPrivateAccess(false); setAdministrator(false); setClubAccess(false); setPrivateNotice(false); } : undefined} />
        </div>
      </section>
    </main>
  );
}
