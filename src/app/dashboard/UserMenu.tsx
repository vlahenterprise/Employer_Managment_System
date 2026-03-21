"use client";

import { signOut } from "next-auth/react";
import { getI18n, Lang } from "@/i18n";
import { IconLogout, IconUser } from "@/components/icons";
import { getAccessSummary } from "@/server/rbac";

export default function UserMenu({
  name,
  email,
  role,
  hrAddon,
  adminAddon,
  position,
  team,
  lang
}: {
  name: string;
  email: string;
  role: string;
  hrAddon?: boolean;
  adminAddon?: boolean;
  position?: string | null;
  team?: string | null;
  lang: Lang;
}) {
  const t = getI18n(lang);
  const access = getAccessSummary({ role: role as any, hrAddon, adminAddon });
  const accessLabels = access.map((item) => {
    if (item === "MANAGER") return lang === "sr" ? "Menadžer" : "Manager";
    if (item === "USER") return lang === "sr" ? "Zaposleni" : "User";
    if (item === "HR_ADDON") return lang === "sr" ? "HR pristup" : "HR access";
    if (item === "ADMIN_ADDON") return lang === "sr" ? "Admin pristup" : "Admin access";
    return item;
  });
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
        <div className="user-access-pills">
          {accessLabels.map((item) => (
            <span key={item} className="pill pill-blue">
              {item}
            </span>
          ))}
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
          <span>{t.admin.users.role}: {accessLabels.join(" · ")}</span>
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
