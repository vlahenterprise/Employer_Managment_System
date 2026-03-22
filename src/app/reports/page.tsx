import Link from "next/link";
import { requireActiveUser } from "@/server/current-user";
import { getActivityTypesForTeam } from "@/server/reports";
import { getAppSettings } from "@/server/app-settings";
import ReportEntry from "./ReportEntry";
import UserMenu from "../dashboard/UserMenu";
import { getRequestLang } from "@/i18n/server";
import { getI18n } from "@/i18n";
import { IconArrowLeft, IconUsers } from "@/components/icons";
import { isManagerRole } from "@/server/rbac";

export default async function ReportsPage() {
  const user = await requireActiveUser();
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
              <div>
                <h1 className="brand-title">{t.reports.entryTitle}</h1>
                <p className="muted">{t.reports.rules(settings.MinDayActivtyDuration, settings.MaxDayActivtyDuration, settings.MaxActivitiesPerDay)}</p>
              </div>
              <div className="inline">
                <Link className="button button-secondary" href="/dashboard">
                  <IconArrowLeft size={18} /> {t.common.backToDashboard}
                </Link>
                {isManagerRole(user.role) ? (
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
            hrAddon={user.hrAddon}
            adminAddon={user.adminAddon}
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
