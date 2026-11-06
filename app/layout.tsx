import { AppVersion } from "./components/app-version";
import type { Metadata } from "next";
import { ClientPreviewProvider } from "./components/client-preview";
import Image from "next/image";
import Link from "@/app/components/sport-link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppNavigation } from "./components/app-navigation";
import { LegalFooter } from "./components/legal-footer";
import { UniversalMenu } from "./components/universal-menu";
import RecoveryLinkRedirect from "./components/recovery-link-redirect";
import { brand, productTitle } from "@/lib/brand";
import { activeDataOrigin } from "@/lib/operational-cutover";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: productTitle,
  description: brand.productDescription,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const dataOrigin = activeDataOrigin();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><ClientPreviewProvider development={process.env.NODE_ENV !== "production"}><style>{`.global-likid-logo{position:fixed;z-index:80;top:12px;left:20px;display:flex;align-items:center;height:48px;padding:0 10px;border-radius:8px;background:#1b4980;box-shadow:0 2px 10px #17212b22}.global-likid-logo img{display:block;width:94px;height:auto}body:has(main>header) .global-likid-logo{display:none}@media(max-width:700px){.global-likid-logo{top:9px;left:14px}.global-likid-logo img{width:82px}}`}</style><Link className="global-likid-logo" href="/" aria-label={`${brand.product}, inicio`}><Image src={brand.logo} alt={brand.product} width={94} height={48} priority /></Link>{children}<LegalFooter dataOrigin={dataOrigin} /><AppVersion /><RecoveryLinkRedirect /><UniversalMenu /><AppNavigation /></ClientPreviewProvider></body>
    </html>
  );
}
