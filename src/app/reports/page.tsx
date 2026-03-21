import Link from "next/link";
import { requireActiveUser } from "@/server/current-user";
import { getActivityTypesForTeam } from "@/server/reports";
import { getAppSettings } from "@/server/app-settings";
import { getBrandingSettings } from "@/server/settings";
import ReportEntry from "./ReportEntry";
import UserMenu from "../dashboard/UserMenu";
import { getRequestLang } from "@/i18n/server";
import { getI18n } from "@/i18n";
import { IconArrowLeft, IconUsers } from "@/components/icons";

export default async function ReportsPage() {
  const user = await requireActiveUser();
  const branding = await getBrandingSettings();
  const lang = getRequestLang();
  const t = getI18n(lang);
  const settings = await getAppSettings();

  const activityTypes = await getActivityTypesForTeam(user.teamId);

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
                  <h1 className="brand-title">{branding.title}</h1>
                  <p className="muted">{branding.subtitle}</p>
                </div>
              </div>
              <div className="inline">
                <Link className="button button-secondary" href="/dashboard">
                  <IconArrowLeft size={18} /> {t.common.backToDashboard}
                </Link>
                {user.role === "ADMIN" || user.role === "HR" ? (
                  <Link className="button button-secondary" href="/reports/manager">
                    <IconUsers size={18} /> {t.reports.managerTitle}
                  </Link>
                ) : null}
              </div>
            </div>
          </div>

          <UserMenu
            name={user.name}
            email={user.email}
            role={user.role}
            position={user.position}
            team={user.team?.name ?? null}
            lang={lang}
          />
        </div>

        <ReportEntry
          lang={lang}
          activityTypes={activityTypes}
          rules={{
            minH: settings.MinDayActivtyDuration,
            maxH: settings.MaxDayActivtyDuration,
            maxAct: settings.MaxActivitiesPerDay
          }}
        />

      </div>
    </main>
  );
}
