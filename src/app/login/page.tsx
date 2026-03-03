import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";
import { config } from "@/server/config";
import { getCurrentUser } from "@/server/current-user";
import { getBrandingSettings } from "@/server/settings";
import { getRequestLang } from "@/i18n/server";
import { getI18n } from "@/i18n";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user && user.status === "ACTIVE") redirect("/dashboard");

  const lang = getRequestLang();
  const t = getI18n(lang);
  const branding = await getBrandingSettings();
  const googleEnabled = Boolean(config.auth.googleClientId && config.auth.googleClientSecret);

  return (
    <main className="page">
      <div className="card">
        <div className="brand">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="brand-logo" src={branding.logoUrl} alt={branding.title} />
          ) : null}
          <div>
            <h1 className="brand-title">{branding.title}</h1>
            <p className="muted">{branding.subtitle}</p>
          </div>
        </div>

        <h2 className="h2">{t.login.title}</h2>

        <p className="muted">{t.login.description}</p>
        {user && user.status !== "ACTIVE" ? (
          <div className="error">{t.login.deactivated}</div>
        ) : null}
        <LoginForm lang={lang} googleEnabled={googleEnabled} />
      </div>
    </main>
  );
}
