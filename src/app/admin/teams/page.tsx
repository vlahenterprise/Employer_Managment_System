import Link from "next/link";
import { prisma } from "@/server/db";
import { requireAdminUser } from "@/server/current-user";
import { createTeamAction, deleteTeamAction } from "../actions";
import { getRequestLang } from "@/i18n/server";
import { getI18n } from "@/i18n";
import { IconArrowLeft } from "@/components/icons";

export default async function AdminTeamsPage({
  searchParams
}: {
  searchParams: { success?: string; error?: string };
}) {
  await requireAdminUser();
  const lang = getRequestLang();
  const t = getI18n(lang);

  const teams = await prisma.team.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true } } }
  });

  const success = searchParams.success ? decodeURIComponent(searchParams.success) : null;
  const error = searchParams.error ? decodeURIComponent(searchParams.error) : null;

  return (
    <main className="page">
      <div className="card stack">
        <div className="header">
          <div>
            <h1>{t.admin.title}</h1>
            <p className="muted">{t.admin.teams.subtitle}</p>
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
          <Link className="tab tab-active" href="/admin/teams">
            {t.admin.tabs.teams}
          </Link>
          <Link className="tab" href="/admin/org-structure">
            {t.admin.tabs.org}
          </Link>
          <Link className="tab" href="/admin/activity-types">
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
          <h2 className="h2">{t.admin.teams.newTeam}</h2>
          <form className="inline" action={createTeamAction}>
            <input className="input" name="name" type="text" placeholder={t.admin.teams.teamNamePlaceholder} required />
            <button className="button" type="submit">
              {t.admin.teams.createTeam}
            </button>
          </form>
        </section>

        <section className="stack">
          <h2 className="h2">{t.admin.teams.teams}</h2>
          <div className="muted small">{t.admin.teams.deleteNote}</div>
          <div className="list">
            {teams.map((team) => (
              <div key={team.id} className="item item-compact">
                <div>
                  <div className="item-title">{team.name}</div>
                  <div className="muted small">
                    {t.admin.teams.usersCount}: {team._count.users}
                  </div>
                </div>
                <form action={deleteTeamAction}>
                  <input type="hidden" name="teamId" value={team.id} />
                  <button className="button button-danger" type="submit">
                    {t.admin.teams.deleteTeam}
                  </button>
                </form>
              </div>
            ))}
            {teams.length === 0 ? <div className="muted">{t.admin.teams.empty}</div> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
