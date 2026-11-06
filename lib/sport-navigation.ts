"use client";
export * from "next/navigation";
import { usePathname as useNextPathname, useRouter as useNextRouter } from "next/navigation";
import { useMemo } from "react";
import { scopedSportHref, unscopedSportPath } from "./sport-routes";

/** Existing page logic still compares the underlying section path. */
export function usePathname() { return unscopedSportPath(useNextPathname()); }
export function useRouter() {
  const router = useNextRouter();
  const pathname = useNextPathname();
  return useMemo(() => ({ ...router,
    push: (href: string, options?: Parameters<typeof router.push>[1]) => router.push(scopedSportHref(href, pathname), options),
    replace: (href: string, options?: Parameters<typeof router.replace>[1]) => router.replace(scopedSportHref(href, pathname), options),
    prefetch: (href: string, options?: Parameters<typeof router.prefetch>[1]) => router.prefetch(scopedSportHref(href, pathname), options),
  }), [router, pathname]);
}
