"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { scopedSportHref } from "@/lib/sport-routes";

export default function SportLink({ href, ...props }: ComponentProps<typeof Link>) {
  const pathname = usePathname();
  const target = typeof href === "string" ? scopedSportHref(href, pathname) : { ...href, pathname: href.pathname ? scopedSportHref(href.pathname, pathname) : href.pathname };
  return <Link {...props} href={target} />;
}
