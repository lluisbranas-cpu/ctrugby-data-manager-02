"use client";

import { useEffect } from "react";
import { useRouter } from "@/lib/sport-navigation";

/**
 * Supabase may fall back to the configured site URL when its redirect allow-list
 * does not yet include /restablecer. Preserve a recovery token and take the
 * person to the password-creation screen instead of leaving them on the home.
 */
export default function RecoveryLinkRedirect() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
    if (params.get("type") === "recovery" && params.get("access_token")) {
      router.replace(`/restablecer${hash}`);
    }
  }, [router]);

  return null;
}
