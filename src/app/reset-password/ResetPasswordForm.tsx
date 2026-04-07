"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Lang } from "@/i18n";
import { resetPasswordAction } from "./actions";

function copy(lang: Lang) {
  if (lang === "sr") {
    return {
      newPassword: "Nova lozinka",
      confirmPassword: "Potvrdi novu lozinku",
      submit: "Promeni lozinku",
      saving: "Snimanje...",
      success: "Lozinka je promenjena. Sada možeš da se prijaviš.",
      back: "Idi na prijavu",
      errors: {
        PASSWORDS_DO_NOT_MATCH: "Lozinke se ne poklapaju.",
        PASSWORD_TOO_SHORT: "Lozinka mora imati minimum 8 karaktera.",
        PASSWORD_TOO_LONG: "Lozinka je predugačka.",
        PASSWORD_NEEDS_UPPERCASE: "Lozinka mora imati bar jedno veliko slovo.",
        PASSWORD_NEEDS_NUMBER: "Lozinka mora imati bar jedan broj.",
        WRONG_CURRENT_PASSWORD: "Trenutna lozinka nije ispravna.",
        NO_PASSWORD_SET: "Ovaj nalog nema lokalnu lozinku.",
        INVALID_OR_EXPIRED_TOKEN: "Link je neispravan ili je istekao."
      },
      genericError: "Nešto nije uspelo. Pokušaj ponovo."
    };
  }

  return {
    newPassword: "New password",
    confirmPassword: "Confirm new password",
    submit: "Change password",
    saving: "Saving...",
    success: "Password changed. You can now sign in.",
    back: "Go to sign in",
    errors: {
      PASSWORDS_DO_NOT_MATCH: "Passwords do not match.",
      PASSWORD_TOO_SHORT: "Password must be at least 8 characters.",
      PASSWORD_TOO_LONG: "Password is too long.",
      PASSWORD_NEEDS_UPPERCASE: "Password must include at least one uppercase letter.",
      PASSWORD_NEEDS_NUMBER: "Password must include at least one number.",
      WRONG_CURRENT_PASSWORD: "Current password is not correct.",
      NO_PASSWORD_SET: "This account has no local password.",
      INVALID_OR_EXPIRED_TOKEN: "The link is invalid or expired."
    },
    genericError: "Something went wrong. Please try again."
  };
}

export default function ResetPasswordForm({ lang, token }: { lang: Lang; token: string }) {
  const c = copy(lang);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null);
  const [isPending, startTransition] = useTransition();
  const completed = messageType === "success";

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setMessageType(null);

    startTransition(async () => {
      const result = await resetPasswordAction({ token, newPassword, confirmPassword });
      if (!result.ok) {
        setMessage(c.errors[result.error] ?? c.genericError);
        setMessageType("error");
        return;
      }

      setNewPassword("");
      setConfirmPassword("");
      setMessage(c.success);
      setMessageType("success");
    });
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <label className="field">
        <span className="label">{c.newPassword}</span>
        <input
          className="input"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
          disabled={completed}
        />
      </label>
      <label className="field">
        <span className="label">{c.confirmPassword}</span>
        <input
          className="input"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          disabled={completed}
        />
      </label>

      {message ? <div className={messageType === "success" ? "success" : "error"}>{message}</div> : null}

      {completed ? (
        <Link className="button" href="/login">
          {c.back}
        </Link>
      ) : (
        <button className="button" type="submit" disabled={isPending}>
          {isPending ? c.saving : c.submit}
        </button>
      )}
    </form>
  );
}
