import Link from "next/link";
import ResetPasswordForm from "./ResetPasswordForm";
import { getPasswordResetTokenStatus } from "@/server/password-reset";
import { getBrandingSettings } from "@/server/settings";
import { getRequestLang } from "@/i18n/server";

function copy(lang: "sr" | "en") {
  if (lang === "sr") {
    return {
      title: "Nova lozinka",
      description: "Unesi novu lozinku za svoj EMS nalog.",
      invalid: "Link za reset lozinke je neispravan ili je istekao.",
      back: "Nazad na prijavu"
    };
  }

  return {
    title: "New password",
    description: "Enter a new password for your EMS account.",
    invalid: "The password reset link is invalid or expired.",
    back: "Back to sign in"
  };
}

export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams: { token?: string };
}) {
  const lang = getRequestLang();
  const c = copy(lang);
  const branding = await getBrandingSettings();
  const token = String(searchParams.token ?? "").trim();
  const tokenStatus = await getPasswordResetTokenStatus(token);

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

        {tokenStatus === "valid" ? (
          <ResetPasswordForm lang={lang} token={token} />
        ) : (
          <div className="stack">
            <div className="error">{c.invalid}</div>
            <Link className="button button-secondary" href="/login">
              {c.back}
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
