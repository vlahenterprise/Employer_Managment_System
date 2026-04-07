"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { getI18n, Lang } from "@/i18n";

export default function LoginForm({ lang, googleEnabled }: { lang: Lang; googleEnabled: boolean }) {
  const t = getI18n(lang);
  const searchParams = useSearchParams();

  const initialError = useMemo(() => {
    const error = searchParams.get("error");
    if (!error) return null;
    if (error === "CredentialsSignin") return t.login.wrongCredentials;
    return t.login.signInFailed;
  }, [searchParams, t]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/dashboard"
    });

    setLoading(false);

    if (!result) {
      setError(t.login.signInFailed);
      return;
    }

    if (result.error) {
      if (result.error === "CredentialsSignin") {
        setError(t.login.wrongCredentials);
        return;
      }
      setError(t.login.signInFailed);
      return;
    }

    window.location.assign(result.url ?? "/dashboard");
  }

  return (
    <div className="stack">
      {googleEnabled ? (
        <button
          className="button button-secondary"
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
        >
          {t.login.continueGoogle}
        </button>
      ) : null}

      <div className="divider">
        <span>{t.login.or}</span>
      </div>

      <form className="stack" onSubmit={onSubmit}>
        <label className="field">
          <span className="label">{t.login.email}</span>
          <input
            className="input"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.login.placeholderEmail}
            required
          />
        </label>

        <label className="field">
          <span className="label">{t.login.password}</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <div className="inline" style={{ justifyContent: "flex-end" }}>
          <Link className="muted small" href="/forgot-password">
            {t.login.forgotPassword}
          </Link>
        </div>

        {error ? <div className="error">{error}</div> : null}

        <button className="button" type="submit" disabled={loading}>
          {loading ? t.login.signingIn : t.login.signIn}
        </button>
      </form>
    </div>
  );
}
