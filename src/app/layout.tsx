import "./globals.css";
import { getBrandingSettings, getThemeCssVars } from "@/server/settings";
import { getRequestLang } from "@/i18n/server";
import LangToggle from "@/components/LangToggle";
import AppNavigation from "@/components/AppNavigation";
import { getCurrentUser } from "@/server/current-user";
import { getPrimaryNavigation } from "@/server/navigation";
import { Inter } from "next/font/google";

const bodyFont = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-body",
  weight: ["400", "500", "600", "700", "800"]
});

export const metadata = {
  title: "Employer Management System",
  description: "Internal HR and operations platform"
};

export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const themeVars = await getThemeCssVars();
  const lang = getRequestLang();
  const branding = await getBrandingSettings();
  const user = await getCurrentUser();
  const navItems = user
    ? getPrimaryNavigation({ role: user.role, hrAddon: user.hrAddon, adminAddon: user.adminAddon })
    : [];
  return (
    <html
      lang={lang}
      style={themeVars as any}
      className={bodyFont.variable}
    >
      <body>
        <LangToggle lang={lang} />
        {branding.logoUrl ? (
          <div className="app-watermark" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={branding.logoUrl} alt="" />
          </div>
        ) : null}
        {branding.poweredByText ? <div className="app-powered">{branding.poweredByText}</div> : null}
        <div className="app-shell">
          {user ? <AppNavigation items={navItems} title={branding.title} logoUrl={branding.logoUrl} /> : null}
          {children}
        </div>
      </body>
    </html>
  );
}
