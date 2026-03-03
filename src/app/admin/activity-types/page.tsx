import Link from "next/link";
import { prisma } from "@/server/db";
import { requireAdminUser } from "@/server/current-user";
import { createActivityTypeAction, deleteActivityTypeAction, setActivityTypeActiveAction } from "../actions";
import { getRequestLang } from "@/i18n/server";
import { getI18n } from "@/i18n";
import { IconArrowLeft } from "@/components/icons";

export default async function AdminActivityTypesPage({
  searchParams
}: {
  searchParams: { success?: string; error?: string };
}) {
  await requireAdminUser();
  const lang = getRequestLang();
  const t = getI18n(lang);

  const [teams, activityTypes] = await Promise.all([
    prisma.team.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.activityType.findMany({
      orderBy: [{ team: { name: "asc" } }, { name: "asc" }],
      select: { id: true, name: true, isActive: true, teamId: true, team: { select: { name: true } } }
    })
  ]);

  const byTeamId = new Map<string, typeof activityTypes>();
  for (const activityType of activityTypes) {
    const list = byTeamId.get(activityType.teamId) ?? [];
    list.push(activityType);
    byTeamId.set(activityType.teamId, list);
  }

  const success = searchParams.success ? decodeURIComponent(searchParams.success) : null;
  const error = searchParams.error ? decodeURIComponent(searchParams.error) : null;

  return (
    <main className="page">
      <div className="card stack">
        <div className="header">
          <div>
            <h1>{t.admin.title}</h1>
            <p className="muted">{t.admin.activityTypes.subtitle}</p>
          </div>
          <div className="inline">
            <Link className="button button-secondary" href="/dashboard">
              <IconArrowLeft size={18} /> {t.common.backToDashboard}
            </Link>
          </div>
        </div>

        <div className="tabs">
          <Link className="tab" href="/admin/users">
            {t.admin.tabs.users}
          </Link>
          <Link className="tab" href="/admin/teams">
            {t.admin.tabs.teams}
          </Link>
          <Link className="tab" href="/admin/org-structure">
            {t.admin.tabs.org}
          </Link>
          <Link className="tab tab-active" href="/admin/activity-types">
            {t.admin.tabs.activityTypes}
          </Link>
          <Link className="tab" href="/admin/settings">
            {t.admin.tabs.settings}
          </Link>
          <Link className="tab" href="/admin/performance-questions">
            {t.admin.tabs.performanceQuestions}
          </Link>
          <Link className="tab" href="/admin/import">
            {t.admin.tabs.import}
          </Link>
          <Link className="tab" href="/admin/backup">
            {t.admin.tabs.backup}
          </Link>
        </div>

        {success ? <div className="success">{success}</div> : null}
        {error ? <div className="error">{error}</div> : null}

        <section className="panel stack">
          <h2 className="h2">{t.admin.activityTypes.newActivityType}</h2>
          <form className="grid2" action={createActivityTypeAction}>
            <label className="field">
              <span className="label">{t.admin.activityTypes.team}</span>
              <select className="input" name="teamId" required defaultValue={teams[0]?.id ?? ""}>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="label">{t.admin.activityTypes.name}</span>
              <input className="input" name="name" type="text" placeholder="npr. Internal Meetings" required />
            </label>
            <div className="field field-actions">
              <span className="label"> </span>
              <button className="button" type="submit">
                {t.admin.activityTypes.create}
              </button>
            </div>
          </form>
        </section>

        <section className="stack">
          <h2 className="h2">{t.admin.activityTypes.list}</h2>
          <div className="list">
            {teams.map((team) => {
              const list = byTeamId.get(team.id) ?? [];
              return (
                <div key={team.id} className="item stack">
                  <div className="item-top">
                    <div>
                      <div className="item-title">{team.name}</div>
                      <div className="muted small">
                        {t.admin.activityTypes.count}: {list.length}
                      </div>
                    </div>
                  </div>

                  {list.length === 0 ? (
                    <div className="muted">{t.admin.activityTypes.empty}</div>
                  ) : (
                    <div className="list">
                      {list.map((activityType) => (
                        <div key={activityType.id} className="item item-compact">
                          <div>
                            <div className="item-title">{activityType.name}</div>
                            <div className="muted small">
                              {activityType.isActive ? t.common.active : t.common.inactive}
                            </div>
                          </div>
                          <div className="inline">
                            <form action={setActivityTypeActiveAction}>
                              <input type="hidden" name="activityTypeId" value={activityType.id} />
                              <input type="hidden" name="isActive" value={activityType.isActive ? "0" : "1"} />
                              <button className="button button-secondary" type="submit">
                                {activityType.isActive ? t.admin.activityTypes.deactivate : t.admin.activityTypes.activate}
                              </button>
                            </form>
                            <form action={deleteActivityTypeAction}>
                              <input type="hidden" name="activityTypeId" value={activityType.id} />
                              <button className="button button-danger" type="submit">
                                {t.admin.activityTypes.delete}
                              </button>
                            </form>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
