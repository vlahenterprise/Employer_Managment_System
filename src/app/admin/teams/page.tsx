import AdminShell from "@/components/AdminShell";
import { prisma } from "@/server/db";
import { requireAdminUser } from "@/server/current-user";
import { createTeamAction, deleteTeamAction } from "../actions";
import { getRequestLang } from "@/i18n/server";
import { getI18n } from "@/i18n";

export default async function AdminTeamsPage({
  searchParams
}: {
  searchParams: { success?: string; error?: string };
}) {
  const user = await requireAdminUser();
  const lang = getRequestLang();
  const t = getI18n(lang);

  const teams = await prisma.team.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true } } }
  });

  const success = searchParams.success ? decodeURIComponent(searchParams.success) : null;
  const error = searchParams.error ? decodeURIComponent(searchParams.error) : null;

  return (
    <AdminShell
      user={user}
      lang={lang}
      title={t.admin.tabs.teams}
      subtitle={t.admin.teams.subtitle}
      activeTab="teams"
      success={success}
      error={error}
      note={
        lang === "sr"
          ? "Timovi su osnova za reports, tasks, absence, HR i performance. Održavaj ih čistim i bez duplikata."
          : "Teams drive reports, tasks, absence, HR, and performance visibility. Keep them clean and free of duplicates."
      }
    >

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
    </AdminShell>
  );
}
