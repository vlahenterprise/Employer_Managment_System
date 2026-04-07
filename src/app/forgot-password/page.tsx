import { redirect } from "next/navigation";
import ForgotPasswordForm from "./ForgotPasswordForm";
import { getCurrentUser } from "@/server/current-user";
import { getBrandingSettings } from "@/server/settings";
import { getRequestLang } from "@/i18n/server";

function copy(lang: "sr" | "en") {
  if (lang === "sr") {
    return {
      title: "Reset lozinke",
      description: "Unesi email adresu naloga. Ako nalog postoji, poslaćemo jednokratni link za reset lozinke."
    };
  }

  return {
    title: "Password reset",
    description: "Enter your account email. If the account exists, we will send a one-time password reset link."
  };
}

export default async function ForgotPasswordPage() {
  const user = await getCurrentUser();
  if (user && user.status === "ACTIVE") redirect("/dashboard");

  const lang = getRequestLang();
  const c = copy(lang);
  const branding = await getBrandingSettings();

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

        <h2 className="h2">{c.title}</h2>
        <p className="muted">{c.description}</p>
        <ForgotPasswordForm lang={lang} />
      </div>
    </main>
  );
}
