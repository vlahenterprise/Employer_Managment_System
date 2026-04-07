"use client";

import { useState, useTransition } from "react";
import { Lang } from "@/i18n";
import { changePasswordAction } from "./actions";

function copy(lang: Lang) {
  if (lang === "sr") {
    return {
      title: "Bezbednost naloga",
      description: "Promeni lozinku za email prijavu. Za sigurnost prvo unosimo trenutnu lozinku.",
      currentPassword: "Trenutna lozinka",
      newPassword: "Nova lozinka",
      confirmPassword: "Potvrdi novu lozinku",
      submit: "Promeni lozinku",
      saving: "Snimanje...",
      success: "Lozinka je uspešno promenjena.",
      errors: {
        REQUIRED: "Popuni sva polja.",
        PASSWORDS_DO_NOT_MATCH: "Lozinke se ne poklapaju.",
        PASSWORD_TOO_SHORT: "Lozinka mora imati minimum 8 karaktera.",
        PASSWORD_TOO_LONG: "Lozinka je predugačka.",
        PASSWORD_NEEDS_UPPERCASE: "Lozinka mora imati bar jedno veliko slovo.",
        PASSWORD_NEEDS_NUMBER: "Lozinka mora imati bar jedan broj.",
        WRONG_CURRENT_PASSWORD: "Trenutna lozinka nije ispravna.",
        NO_PASSWORD_SET: "Ovaj nalog nema lokalnu lozinku. Koristi Google prijavu ili reset lozinke."
      },
      genericError: "Nešto nije uspelo. Pokušaj ponovo."
    };
  }

  return {
    title: "Account security",
    description: "Change your email sign-in password. For security, enter your current password first.",
    currentPassword: "Current password",
    newPassword: "New password",
    confirmPassword: "Confirm new password",
    submit: "Change password",
    saving: "Saving...",
    success: "Password changed successfully.",
    errors: {
      REQUIRED: "Fill in all fields.",
      PASSWORDS_DO_NOT_MATCH: "Passwords do not match.",
      PASSWORD_TOO_SHORT: "Password must be at least 8 characters.",
      PASSWORD_TOO_LONG: "Password is too long.",
      PASSWORD_NEEDS_UPPERCASE: "Password must include at least one uppercase letter.",
      PASSWORD_NEEDS_NUMBER: "Password must include at least one number.",
      WRONG_CURRENT_PASSWORD: "Current password is not correct.",
      NO_PASSWORD_SET: "This account has no local password. Use Google sign-in or password reset."
    },
    genericError: "Something went wrong. Please try again."
  };
}

export default function ChangePasswordForm({ lang }: { lang: Lang }) {
  const c = copy(lang);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setMessageType(null);

    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const result = await changePasswordAction(formData);
      if (!result.ok) {
        setMessage(c.errors[result.error as keyof typeof c.errors] ?? c.genericError);
        setMessageType("error");
        return;
      }

      form.reset();
      setMessage(c.success);
      setMessageType("success");
    });
  }

  return (
    <section className="panel stack">
      <div>
        <h2 className="h2">{c.title}</h2>
        <p className="muted small">{c.description}</p>
      </div>

      <form className="stack" onSubmit={onSubmit}>
        <label className="field">
          <span className="label">{c.currentPassword}</span>
          <input className="input" type="password" name="currentPassword" autoComplete="current-password" required />
        </label>
        <label className="field">
          <span className="label">{c.newPassword}</span>
          <input className="input" type="password" name="newPassword" autoComplete="new-password" required />
        </label>
        <label className="field">
          <span className="label">{c.confirmPassword}</span>
          <input className="input" type="password" name="confirmPassword" autoComplete="new-password" required />
        </label>

        {message ? <div className={messageType === "success" ? "success" : "error"}>{message}</div> : null}

        <button className="button button-primary" type="submit" disabled={isPending}>
          {isPending ? c.saving : c.submit}
        </button>
      </form>
    </section>
  );
}
