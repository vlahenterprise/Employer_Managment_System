import Link from "next/link";
import { requireActiveUser } from "@/server/current-user";
import { getUserOrgStructure } from "@/server/org-structure";
import { buildChartPalette, getBrandingSettings, getThemeCssVars } from "@/server/settings";
import UserMenu from "../dashboard/UserMenu";
import OrgChart from "./OrgChart";
import { getRequestLang } from "@/i18n/server";
import { getI18n } from "@/i18n";
import { IconArrowLeft } from "@/components/icons";
import { hasAccessAdmin } from "@/server/rbac";

export default async function OrganizationPage() {
  const user = await requireActiveUser();
  const branding = await getBrandingSettings();
  const theme = await getThemeCssVars();
  const palette = buildChartPalette(theme as any);
  const lang = getRequestLang();
  const t = getI18n(lang);

  const { nodes } = await getUserOrgStructure();

  return (
    <main className="page">
      <div className="card stack">
        <div className="page-topbar">
          <div className="page-topbar-main">
            <div className="header">
              <div className="brand">
                {branding.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="brand-logo" src={branding.logoUrl} alt={branding.title} />
                ) : null}
                <div>
                  <h1 className="brand-title">{t.org.title}</h1>
                  <p className="muted">{t.org.subtitle}</p>
                </div>
              </div>
              <div className="inline">
                <Link className="button button-secondary" href="/dashboard">
                  <IconArrowLeft size={18} /> {t.common.backToDashboard}
                </Link>
              </div>
            </div>
          </div>

          <UserMenu
            name={user.name}
            email={user.email}
            role={user.role}
            hrAddon={user.hrAddon}
            adminAddon={user.adminAddon}
            position={user.position}
            team={user.team?.name ?? null}
            lang={lang}
          />
        </div>

        <section className="panel stack">
          <OrgChart
            nodes={nodes}
            palette={palette}
            canEdit={hasAccessAdmin(user)}
            labels={{
              people: t.org.people,
              links: t.org.links,
              noAssignees: t.org.noAssignees,
              noLinks: t.org.noLinks,
              select: t.org.select,
              edit: t.org.edit,
              manageHint: t.org.manageHint
            }}
          />
        </section>

      </div>
    </main>
  );
}
