import Link from "next/link";
import { LabelWithTooltip } from "@/components/Tooltip";
import { prisma } from "@/server/db";
import { requireAdminUser } from "@/server/current-user";
import { createUserAction, deleteUserAction, setUserPasswordAction, updateUserAction } from "../actions";
import { getRequestLang } from "@/i18n/server";
import { getI18n } from "@/i18n";
import { IconArrowLeft } from "@/components/icons";
import { getAccessSummary } from "@/server/rbac";

export default async function AdminUsersPage({
  searchParams
}: {
  searchParams: { success?: string; error?: string };
}) {
  await requireAdminUser();
  const lang = getRequestLang();
  const t = getI18n(lang);

  const [teams, users] = await Promise.all([
    prisma.team.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        position: true,
        role: true,
        status: true,
        hrAddon: true,
        adminAddon: true,
        carryOverAnnualLeave: true,
        employmentDate: true,
        jobDescriptionUrl: true,
        workInstructionsUrl: true,
        teamId: true,
        managerId: true,
        passwordHash: true,
        team: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true, email: true } }
      }
    })
  ]);

  const usersForView = users.map(({ passwordHash, ...user }) => ({
    ...user,
    hasPassword: Boolean(passwordHash)
  }));

  const success = searchParams.success ? decodeURIComponent(searchParams.success) : null;
  const error = searchParams.error ? decodeURIComponent(searchParams.error) : null;

  return (
    <main className="page">
      <div className="card stack">
        <div className="header">
          <div>
            <h1>{t.admin.title}</h1>
            <p className="muted">{t.admin.users.subtitle}</p>
          </div>
          <div className="inline">
            <Link className="button button-secondary" href="/dashboard">
              <IconArrowLeft size={18} /> {t.common.backToDashboard}
            </Link>
          </div>
        </div>

        <div className="tabs">
          <Link className="tab tab-active" href="/admin/users">
            {t.admin.tabs.users}
          </Link>
          <Link className="tab" href="/admin/teams">
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
          <h2 className="h2">{t.admin.users.newUser}</h2>

          <form className="stack" action={createUserAction}>
            <div className="grid2">
              <label className="field">
                <span className="label">{t.login.email}</span>
                <input className="input" name="email" type="email" required />
              </label>

              <label className="field">
                <span className="label">{t.admin.users.name}</span>
                <input className="input" name="name" type="text" required />
              </label>

              <label className="field">
                <span className="label">{t.admin.users.position}</span>
                <input className="input" name="position" type="text" placeholder={t.admin.users.optional} />
              </label>

              <label className="field">
                <span className="label">{t.admin.users.password}</span>
                <input
                  className="input"
                  name="password"
                  type="password"
                  placeholder={t.admin.users.passwordOptional}
                />
              </label>

              <label className="field">
                <span className="label">{t.admin.users.role}</span>
                <select className="input" name="role" defaultValue="USER">
                  <option value="MANAGER">MANAGER</option>
                  <option value="USER">USER</option>
                </select>
              </label>

              <label className="field">
                <span className="label">
                  <LabelWithTooltip
                    label="HR add-on"
                    tooltip={
                      lang === "sr"
                        ? "Dodatni pristup za Hiring, Candidates, Talent Pool i Onboarding. Nije osnovna rola, već dopunski pristup."
                        : "Extra access for Hiring, Candidates, Talent Pool, and Onboarding. It is not a base role; it is an extra access layer."
                    }
                  />
                </span>
                <label className="inline" style={{ alignItems: "center" }}>
                  <input name="hrAddon" type="checkbox" value="1" />
                  <span className="muted small">Dodatni pristup za HR System</span>
                </label>
              </label>

              <label className="field">
                <span className="label">
                  <LabelWithTooltip
                    label="Admin add-on"
                    tooltip={
                      lang === "sr"
                        ? "Daje pristup Settings i Access sekcijama. Koristi se za konfiguraciju sistema, ne za dnevni HR rad."
                        : "Grants access to Settings and Access sections. Use it for configuration, not for day-to-day HR operations."
                    }
                  />
                </span>
                <label className="inline" style={{ alignItems: "center" }}>
                  <input name="adminAddon" type="checkbox" value="1" />
                  <span className="muted small">Dodatni pristup za Settings i Access</span>
                </label>
              </label>

              <label className="field">
                <span className="label">{t.admin.users.status}</span>
                <select className="input" name="status" defaultValue="ACTIVE">
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </label>

              <label className="field">
                <span className="label">{t.admin.users.carryOver}</span>
                <input className="input" name="carryOverAnnualLeave" type="number" min={0} defaultValue={0} />
              </label>

              <label className="field">
                <span className="label">{t.admin.users.team}</span>
                <select className="input" name="teamId" defaultValue="">
                  <option value="">{t.admin.users.none}</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="label">
                  <LabelWithTooltip
                    label={t.admin.users.manager}
                    tooltip={
                      lang === "sr"
                        ? "Direktni nadređeni određuje approvals, performance tok i team visibility za ovog korisnika."
                        : "The direct manager drives approvals, performance flow, and team visibility for this user."
                    }
                  />
                </span>
                <select className="input" name="managerId" defaultValue="">
                  <option value="">{t.admin.users.none}</option>
                  {usersForView.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="label">
                  <LabelWithTooltip
                    label="Employment date"
                    tooltip={
                      lang === "sr"
                        ? "Koristi se za profil, onboarding pregled i druge zaposleničke sažetke."
                        : "Used in the employee profile, onboarding visibility, and related employment summaries."
                    }
                  />
                </span>
                <input className="input" name="employmentDate" type="date" />
              </label>

              <label className="field">
                <span className="label">
                  <LabelWithTooltip
                    label="Job description Drive URL"
                    tooltip={
                      lang === "sr"
                        ? "Ovde ide Google Drive link ka opisu posla. Dokument ostaje na Drive-u, a u aplikaciji čuvamo samo URL."
                        : "Use a Google Drive link to the job description. The document stays in Drive while the app stores only the URL."
                    }
                  />
                </span>
                <input className="input" name="jobDescriptionUrl" type="url" placeholder="https://drive.google.com/..." />
              </label>

              <label className="field">
                <span className="label">
                  <LabelWithTooltip
                    label="Work instructions Drive URL"
                    tooltip={
                      lang === "sr"
                        ? "Ovde dodaj Drive link ka radnim instrukcijama za ovu poziciju ili zaposlenog."
                        : "Use this for the Google Drive link to work instructions for this position or employee."
                    }
                  />
                </span>
                <input className="input" name="workInstructionsUrl" type="url" placeholder="https://drive.google.com/..." />
              </label>
            </div>

            <button className="button" type="submit">
              {t.admin.users.createUser}
            </button>
          </form>
        </section>

        <section className="stack">
          <h2 className="h2">{t.admin.users.users}</h2>
          <div className="list">
            {usersForView.map((user) => (
              <div key={user.id} className="item stack">
                <div className="item-top">
                  <div>
                    <div className="item-title">{user.name}</div>
                    <div className="muted small">{user.email}</div>
                    <div className="muted small">
                      {user.team ? `${t.admin.users.team}: ${user.team.name}` : `${t.admin.users.team}: —`} ·{" "}
                      {user.manager ? `${t.admin.users.manager}: ${user.manager.name}` : `${t.admin.users.manager}: —`} ·{" "}
                      {user.position ? `${t.admin.users.position}: ${user.position}` : `${t.admin.users.position}: —`} ·{" "}
                      {`${t.admin.users.carryOver}: ${user.carryOverAnnualLeave}`}
                    </div>
                  </div>
                  <div className="inline">
                    <div className="pills">
                      <span className="pill">{user.role}</span>
                      <span className={`pill ${user.status === "ACTIVE" ? "pill-green" : "pill-gray"}`}>
                        {user.status}
                      </span>
                      <span className={`pill ${user.hrAddon ? "pill-blue" : "pill-gray"}`}>
                        {user.hrAddon ? "HR add-on" : "No HR add-on"}
                      </span>
                      <span className={`pill ${user.adminAddon ? "pill-blue" : "pill-gray"}`}>
                        {user.adminAddon ? "Admin add-on" : "No admin add-on"}
                      </span>
                      {getAccessSummary(user as any).map((entry) => (
                        <span key={`${user.id}-${entry}`} className="pill pill-status pill-status-review">
                          {entry}
                        </span>
                      ))}
                      <span className={`pill ${user.hasPassword ? "pill-blue" : "pill-gray"}`}>
                        {user.hasPassword ? t.admin.users.passwordSet : t.admin.users.passwordMissing}
                      </span>
                    </div>
                    <form action={deleteUserAction}>
                      <input type="hidden" name="userId" value={user.id} />
                      <button className="button button-danger" type="submit">
                        {t.admin.users.deleteUser}
                      </button>
                    </form>
                  </div>
                </div>

                <form className="grid3" action={updateUserAction}>
                  <input type="hidden" name="userId" value={user.id} />

                  <label className="field">
                    <span className="label">{t.admin.users.name}</span>
                    <input className="input" name="name" type="text" defaultValue={user.name} required />
                  </label>

                  <label className="field">
                    <span className="label">{t.admin.users.position}</span>
                    <input
                      className="input"
                      name="position"
                      type="text"
                      defaultValue={user.position ?? ""}
                      placeholder={t.admin.users.optional}
                    />
                  </label>

                  <label className="field">
                    <span className="label">{t.admin.users.role}</span>
                    <select className="input" name="role" defaultValue={user.role}>
                      <option value="MANAGER">MANAGER</option>
                      <option value="USER">USER</option>
                    </select>
                  </label>

                  <label className="field">
                    <span className="label">HR add-on</span>
                    <label className="inline" style={{ alignItems: "center" }}>
                      <input name="hrAddon" type="checkbox" value="1" defaultChecked={user.hrAddon} />
                      <span className="muted small">Pristup HR System modulu bez promene osnovne role</span>
                    </label>
                  </label>

                  <label className="field">
                    <span className="label">Admin add-on</span>
                    <label className="inline" style={{ alignItems: "center" }}>
                      <input name="adminAddon" type="checkbox" value="1" defaultChecked={user.adminAddon} />
                      <span className="muted small">Pristup Settings i Access modulima bez promene osnovne role</span>
                    </label>
                  </label>

                  <label className="field">
                    <span className="label">{t.admin.users.status}</span>
                    <select className="input" name="status" defaultValue={user.status}>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                  </label>

                  <label className="field">
                    <span className="label">{t.admin.users.carryOver}</span>
                    <input
                      className="input"
                      name="carryOverAnnualLeave"
                      type="number"
                      min={0}
                      defaultValue={user.carryOverAnnualLeave}
                    />
                  </label>

                  <label className="field">
                    <span className="label">{t.admin.users.team}</span>
                    <select className="input" name="teamId" defaultValue={user.teamId ?? ""}>
                      <option value="">{t.admin.users.none}</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span className="label">{t.admin.users.manager}</span>
                    <select className="input" name="managerId" defaultValue={user.managerId ?? ""}>
                      <option value="">{t.admin.users.none}</option>
                      {usersForView
                        .filter((candidate) => candidate.id !== user.id)
                        .map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.name} ({candidate.email})
                          </option>
                        ))}
                    </select>
                  </label>

                  <label className="field">
                    <span className="label">Employment date</span>
                    <input
                      className="input"
                      name="employmentDate"
                      type="date"
                      defaultValue={user.employmentDate ? new Date(user.employmentDate).toISOString().slice(0, 10) : ""}
                    />
                  </label>

                  <label className="field">
                    <span className="label">Job description Drive URL</span>
                    <input
                      className="input"
                      name="jobDescriptionUrl"
                      type="url"
                      defaultValue={user.jobDescriptionUrl ?? ""}
                      placeholder="https://drive.google.com/..."
                    />
                  </label>

                  <label className="field">
                    <span className="label">Work instructions Drive URL</span>
                    <input
                      className="input"
                      name="workInstructionsUrl"
                      type="url"
                      defaultValue={user.workInstructionsUrl ?? ""}
                      placeholder="https://drive.google.com/..."
                    />
                  </label>

                  <div className="field field-actions">
                    <span className="label"> </span>
                    <button className="button button-secondary" type="submit">
                      {t.admin.users.saveChanges}
                    </button>
                  </div>
                </form>

                <form className="inline" action={setUserPasswordAction}>
                  <input type="hidden" name="userId" value={user.id} />
                  <input
                    className="input"
                    name="password"
                    type="password"
                    placeholder={t.admin.users.newPasswordPlaceholder}
                    required
                  />
                  <button className="button button-secondary" type="submit">
                    {t.admin.users.setPassword}
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
