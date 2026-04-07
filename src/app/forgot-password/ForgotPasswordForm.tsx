"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Lang } from "@/i18n";
import { requestPasswordResetAction } from "./actions";

function copy(lang: Lang) {
  if (lang === "sr") {
    return {
      email: "Email",
      placeholder: "name@company.com",
      submit: "Pošalji reset link",
      sending: "Slanje...",
      invalidEmail: "Unesi ispravan email.",
      success: "Ako nalog postoji, poslat je link za reset lozinke.",
      genericError: "Nešto nije uspelo. Pokušaj ponovo.",
      back: "Nazad na prijavu"
    };
  }

  return {
    email: "Email",
    placeholder: "name@company.com",
    submit: "Send reset link",
    sending: "Sending...",
    invalidEmail: "Please enter a valid email.",
    success: "If the account exists, a password reset link has been sent.",
    genericError: "Something went wrong. Please try again.",
    back: "Back to sign in"
  };
}

export default function ForgotPasswordForm({ lang }: { lang: Lang }) {
  const c = copy(lang);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setMessageType(null);

    startTransition(async () => {
      const result = await requestPasswordResetAction({ email });
      if (!result.ok) {
        setMessage(result.error === "INVALID_EMAIL" ? c.invalidEmail : c.genericError);
        setMessageType("error");
        return;
      }

      setMessage(c.success);
      setMessageType("success");
    });
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <label className="field">
        <span className="label">{c.email}</span>
        <input
          className="input"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={c.placeholder}
          required
        />
      </label>

      {message ? <div className={messageType === "success" ? "success" : "error"}>{message}</div> : null}

      <button className="button" type="submit" disabled={isPending}>
        {isPending ? c.sending : c.submit}
      </button>

      <Link className="button button-secondary" href="/login">
        {c.back}
      </Link>
    </form>
  );
}
