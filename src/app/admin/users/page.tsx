import { LabelWithTooltip } from "@/components/Tooltip";
import AdminShell from "@/components/AdminShell";
import { prisma } from "@/server/db";
import { requireAdminUser } from "@/server/current-user";
import { createUserAction, deleteUserAction, setUserPasswordAction, updateUserAction } from "../actions";
import { getRequestLang } from "@/i18n/server";
import { getI18n } from "@/i18n";
import { getAccessSummary } from "@/server/rbac";
import { isHrModuleEnabled } from "@/server/features";

export default async function AdminUsersPage({
  searchParams
}: {
  searchParams: { success?: string; error?: string };
}) {
  const user = await requireAdminUser();
  const lang = getRequestLang();
  const t = getI18n(lang);
  const hrEnabled = isHrModuleEnabled();

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
    <AdminShell
      user={user}
      lang={lang}
      title={t.admin.tabs.users}
      subtitle={t.admin.users.subtitle}
      activeTab="users"
      success={success}
      error={error}
      note={
        lang === "sr"
          ? `Ovde postavljaš baznu rolu, Admin add-on, tim, menadžera i Drive linkove koji utiču na ostatak sistema.${hrEnabled ? " HR add-on pristup je takođe dostupan." : " HR i zapošljavanje su trenutno isključeni."}`
          : `Set the base role, Admin add-on, team, manager, and Drive links here. These values affect the rest of the system.${hrEnabled ? " HR add-on access is also available." : " HR and hiring are currently disabled."}`
      }
    >

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

              {hrEnabled ? (
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
                    <span className="muted small">
                      {lang === "sr" ? "Dodatni pristup za HR System" : "Extra access for HR System"}
                    </span>
                  </label>
                </label>
              ) : (
                <label className="field">
                  <span className="label">HR add-on</span>
                  <div className="notice notice-muted">
                    <div className="muted small">
                      {lang === "sr"
                        ? "HR i zapošljavanje su trenutno isključeni, pa se HR add-on privremeno ne dodeljuje."
                        : "HR and hiring are currently disabled, so the HR add-on is temporarily unavailable."}
                    </div>
                  </div>
                </label>
              )}

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
                        ? "Primarno se održava kroz Admin → Org struktura za samu poziciju. Ovo polje koristi samo ako želiš lični override za konkretnog zaposlenog."
                        : "Primary job description links should live in Admin → Org structure for the position itself. Use this field only as a per-user override."
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
                        ? "Primarno se održava kroz Admin → Org struktura. Ovde dodaj samo ako za ovog zaposlenog postoji posebna verzija instrukcija."
                        : "Primary work instructions should be maintained through Admin → Org structure. Use this only when a user needs a special override."
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
                      {hrEnabled ? (
                        <span className={`pill ${user.hrAddon ? "pill-blue" : "pill-gray"}`}>
                          {user.hrAddon ? "HR add-on" : "No HR add-on"}
                        </span>
                      ) : null}
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

                  {hrEnabled ? (
                    <label className="field">
                      <span className="label">HR add-on</span>
                      <label className="inline" style={{ alignItems: "center" }}>
                        <input name="hrAddon" type="checkbox" value="1" defaultChecked={user.hrAddon} />
                        <span className="muted small">
                          {lang === "sr"
                            ? "Pristup HR System modulu bez promene osnovne role"
                            : "Access to the HR System without changing the base role"}
                        </span>
                      </label>
                    </label>
                  ) : null}

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
    </AdminShell>
  );
}
