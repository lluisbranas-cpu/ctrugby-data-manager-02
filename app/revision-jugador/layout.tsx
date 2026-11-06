import { PrivateLinkEntry } from "@/app/components/private-link-entry";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Revision de ficha Rugby",
  referrer: "no-referrer",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function PlayerRevisionLayout({ children }: { children: React.ReactNode }) {
  return <PrivateLinkEntry>{children}</PrivateLinkEntry>;
}
