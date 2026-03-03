"use client";

import { signOut } from "next-auth/react";
import { getI18n, Lang } from "@/i18n";
import { IconLogout, IconUser } from "@/components/icons";

export default function UserMenu({
  name,
  email,
  role,
  position,
  team,
  lang
}: {
  name: string;
  email: string;
  role: string;
  position?: string | null;
  team?: string | null;
  lang: Lang;
}) {
  const t = getI18n(lang);
  return (
    <div className="user-menu">
      <div className="user-meta">
        <div className="user-row">
          <div className="user-avatar" aria-hidden="true">
            <IconUser size={20} />
          </div>
          <div>
            <div className="user-name">{name}</div>
            <div className="user-sub">{email}</div>
          </div>
        </div>
        <div className="user-details">
          {team ? (
            <span>
              {t.admin.users.team}: {team}
            </span>
          ) : null}
          {position ? (
            <span>
              {t.admin.users.position}: {position}
            </span>
          ) : null}
          <span>
            {t.admin.users.role}: {role}
          </span>
        </div>
      </div>

      <div className="user-actions">
        <button
          className="button button-secondary"
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <IconLogout size={18} /> {t.common.logout}
        </button>
      </div>
    </div>
  );
}
