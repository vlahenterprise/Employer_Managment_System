import Link from "next/link";
import { redirect } from "next/navigation";
import { LabelWithTooltip } from "@/components/Tooltip";
import { requireActiveUser } from "@/server/current-user";
import { getOnboardingDashboard } from "@/server/onboarding";
import { getRequestLang } from "@/i18n/server";
import {
  assignOnboardingProcessAction,
  createOnboardingTemplateAction
} from "./actions";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCalendar,
  IconCheckCircle,
  IconUsers,
  IconPlus
} from "@/components/icons";
import { getOnboardingStatusMeta } from "@/server/recruiting-presentation";
import { isHrModuleEnabled } from "@/server/features";

function copy(lang: "sr" | "en") {
  if (lang === "sr") {
    return {
      title: "Onboarding",
      subtitle: "Template po poziciji, dodela zaposlenom i praćenje onboarding faza.",
      back: "Dashboard",
      noAccess: "Nemaš pristup onboarding modulu.",
      overviewTitle: "Kako sada radi onboarding",
      overviewText:
        "HR prvo pravi onboarding template za poziciju iz ORG strukture, zatim taj template dodeljuje zaposlenom kada onboarding stvarno treba da postane aktivan.",
      total: "Ukupno",
      active: "Aktivni onboarding",
      waitingEmployee: "Čeka zaposlenog",
      completed: "Završeni onboarding",
      templates: "Template-i",
      readyToAssign: "Spremno za dodelu",
      templatesTitle: "Onboarding template-i po poziciji",
      templatesHint:
        "Svaka pozicija iz ORG strukture može imati svoj onboarding template. Tu se definišu faze, rokovi, mentori i linkovi ka Drive dokumentima.",
      manageTemplate: "Otvori template",
      createTemplate: "Kreiraj template",
      templatePosition: "Pozicija",
      templateSteps: "Faze",
      templateUsage: "Aktivni onboarding",
      noTemplates: "Još nema onboarding template-a.",
      readyTitle: "Spremno za aktivaciju onboardinga",
      readyHint:
        "Ovde HR odlučuje kome onboarding postaje aktivan. Kandidat može biti spreman za onboarding, ali profil i onboarding proces ostaju neaktivni dok HR ne dodeli template i zaposlenog.",
      candidate: "Kandidat",
      team: "Tim",
      manager: "Menadžer",
      template: "Template",
      employee: "Zaposleni",
      startDate: "Početni datum",
      activate: "Aktiviraj onboarding",
      noReady: "Nema kandidata spremnih za aktivaciju onboardinga.",
      standaloneTitle: "Ručno kreiranje onboardinga za zaposlenog",
      standaloneHint:
        "Koristi ovo kada onboarding treba da krene direktno za zaposlenog, bez aktivnog hiring procesa ili kad onboarding želiš da vodiš nezavisno od kandidata.",
      createStandalone: "Kreiraj onboarding",
      listTitle: "Aktivni onboarding procesi",
      listHint: "Svaki red pokazuje status, napredak, template i ko trenutno drži sledeći korak.",
      open: "Otvori onboarding",
      empty: "Nema onboarding stavki za prikaz.",
      progress: "Napredak",
      nextOwner: "Sledeći fokus",
      noValue: "—"
    };
  }
  return {
    title: "Onboarding",
    subtitle: "Templates by position, employee assignment, and onboarding phase tracking.",
    back: "Dashboard",
    noAccess: "You do not have access to the onboarding module.",
    overviewTitle: "How onboarding works now",
    overviewText:
      "HR first builds an onboarding template for a position from the ORG structure, then assigns that template to an employee only when onboarding should truly become active.",
    total: "Total",
    active: "Active onboarding",
    waitingEmployee: "Waiting employee",
    completed: "Completed onboarding",
    templates: "Templates",
    readyToAssign: "Ready to assign",
    templatesTitle: "Onboarding templates by position",
    templatesHint:
      "Each position from the ORG structure can have its own onboarding template. Define phases, due offsets, mentors, and Drive resources here.",
    manageTemplate: "Open template",
    createTemplate: "Create template",
    templatePosition: "Position",
    templateSteps: "Phases",
    templateUsage: "Active onboarding",
    noTemplates: "No onboarding templates yet.",
    readyTitle: "Ready to activate onboarding",
    readyHint:
      "This is where HR decides who gets active onboarding. A candidate can be approved for hire, but the profile onboarding stays inactive until HR assigns the template and employee.",
    candidate: "Candidate",
    team: "Team",
    manager: "Manager",
    template: "Template",
    employee: "Employee",
    startDate: "Start date",
    activate: "Activate onboarding",
    noReady: "No candidates are ready for onboarding activation.",
    standaloneTitle: "Create standalone onboarding for an employee",
    standaloneHint:
      "Use this when onboarding should start directly for an employee, without relying on an active hiring process or when HR wants to run onboarding independently.",
    createStandalone: "Create onboarding",
    listTitle: "Active onboarding processes",
    listHint: "Each row shows the current status, progress, template, and who owns the next move.",
    open: "Open onboarding",
    empty: "No onboarding records to show.",
    progress: "Progress",
    nextOwner: "Next focus",
    noValue: "—"
  };
}

export default async function OnboardingPage() {
  if (!isHrModuleEnabled()) {
    redirect("/dashboard");
  }
  const user = await requireActiveUser();
  const lang = getRequestLang();
  const c = copy(lang);
  const dashboard = await getOnboardingDashboard({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    hrAddon: user.hrAddon,
    adminAddon: user.adminAddon
  });

  if (!dashboard.ok) {
    return (
      <main className="page">
        <div className="card stack">
          <div className="error">{c.noAccess}</div>
        </div>
      </main>
    );
  }

  const canManage = dashboard.permissions.canManageTemplates;
  const availableEmployees = dashboard.users;
  const activeOnboardingItems = dashboard.items.filter((item) => item.employee || item.status !== "PLANNED");

  return (
    <main className="page">
      <div className="card stack">
        <div className="page-topbar">
          <div className="page-topbar-main stack">
            <div className="header">
              <div>
                <h1 className="brand-title">{c.title}</h1>
                <p className="muted">{c.subtitle}</p>
              </div>
              <Link className="button button-secondary" href="/dashboard">
                <IconArrowLeft size={18} /> {c.back}
              </Link>
            </div>

            <div className="notice notice-info">
              <div className="notice-icon">
                <IconCalendar size={18} />
              </div>
              <div className="stack">
                <div className="notice-title">{c.overviewTitle}</div>
                <div className="muted small">{c.overviewText}</div>
              </div>
            </div>
          </div>

        </div>

        <div className="grid4 profile-metrics">
          <div className="item item-compact kpi-card">
            <div className="kpi-icon"><IconUsers size={18} /></div>
            <div><div className="kpi-value">{dashboard.metrics.total}</div><div className="kpi-label">{c.total}</div></div>
          </div>
          <div className="item item-compact kpi-card">
            <div className="kpi-icon"><IconCalendar size={18} /></div>
            <div><div className="kpi-value">{dashboard.metrics.active}</div><div className="kpi-label">{c.active}</div></div>
          </div>
          <div className="item item-compact kpi-card">
            <div className="kpi-icon"><IconUsers size={18} /></div>
            <div><div className="kpi-value">{dashboard.metrics.waitingEmployee}</div><div className="kpi-label">{c.waitingEmployee}</div></div>
          </div>
          <div className="item item-compact kpi-card">
            <div className="kpi-icon"><IconCheckCircle size={18} /></div>
            <div><div className="kpi-value">{dashboard.metrics.completed}</div><div className="kpi-label">{c.completed}</div></div>
          </div>
        </div>

        {canManage ? (
          <>
            <section className="panel stack">
              <div className="section-head">
                <div className="section-copy">
                  <h2 className="h2">
                    <LabelWithTooltip label={c.templatesTitle} tooltip={c.templatesHint} />
                  </h2>
                </div>
              </div>
              <div className="grid3 onboarding-template-grid">
                {dashboard.positions.map((position) => {
                  const template = dashboard.templates.find((entry) => entry.positionId === position.id) || null;
                  return (
                    <div key={position.id} className="item stack entity-card">
                      <div className="item-top">
                        <div>
                          <div className="item-title">{template?.title || position.title}</div>
                          <div className="muted small">{position.tier}</div>
                        </div>
                        {template ? <span className="pill pill-status pill-status-approved">{c.templates}</span> : <span className="pill">{c.noValue}</span>}
                      </div>
                      <div className="detail-list detail-list-compact">
                        <div><strong>{c.templatePosition}:</strong> {position.title}</div>
                        <div><strong>{c.templateSteps}:</strong> {template?.steps.length ?? 0}</div>
                        <div><strong>{c.templateUsage}:</strong> {template?._count.onboardings ?? 0}</div>
                      </div>
                      {template ? (
                        <Link className="button button-secondary" href={`/onboarding/templates/${template.id}`}>
                          {c.manageTemplate} <IconArrowRight size={18} />
                        </Link>
                      ) : (
                        <form action={createOnboardingTemplateAction}>
                          <input type="hidden" name="positionId" value={position.id} />
                          <button className="button" type="submit">
                            <IconPlus size={18} /> {c.createTemplate}
                          </button>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
              {dashboard.positions.length === 0 ? <div className="muted small">{c.noTemplates}</div> : null}
            </section>

            <section className="panel stack">
              <div className="section-head">
                <div className="section-copy">
                  <h2 className="h2">
                    <LabelWithTooltip label={c.readyTitle} tooltip={c.readyHint} />
                  </h2>
                </div>
              </div>
              <div className="list">
                {dashboard.readyAssignments.map((row) => (
                  <form key={`${row.processId}:${row.candidate.id}`} className="item stack entity-card" action={assignOnboardingProcessAction}>
                    <input type="hidden" name="onboardingId" value={row.onboardingId || ""} />
                    <div className="item-top">
                      <div>
                        <div className="item-title">{row.positionTitle}</div>
                        <div className="muted small">
                          {c.candidate}: {row.candidate.fullName} · {c.team}: {row.team?.name || c.noValue}
                        </div>
                      </div>
                      {row.onboardingStatus ? <span className="pill pill-status pill-status-review">{row.onboardingStatus}</span> : <span className="pill">{c.readyToAssign}</span>}
                    </div>
                    <div className="detail-list detail-list-compact">
                      <div><strong>{c.manager}:</strong> {row.manager?.name || c.noValue}</div>
                      <div><strong>{c.template}:</strong> {row.suggestedTemplateTitle || c.noValue}</div>
                    </div>
                    <div className="grid3">
                      <label className="field">
                        <span className="label">{c.employee}</span>
                        <select className="input" name="employeeId" defaultValue="">
                          <option value="" disabled>{c.employee}</option>
                          {availableEmployees.map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.name} ({person.email})
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span className="label">{c.template}</span>
                        <select className="input" name="templateId" defaultValue={row.suggestedTemplateId || ""}>
                          <option value="" disabled>{c.template}</option>
                          {dashboard.templates.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.title || template.position.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span className="label">{c.startDate}</span>
                        <input className="input" type="date" name="startDate" defaultValue={new Date().toISOString().slice(0, 10)} />
                      </label>
                    </div>
                    <button className="button" type="submit">{c.activate}</button>
                  </form>
                ))}
                {dashboard.readyAssignments.length === 0 ? <div className="muted small">{c.noReady}</div> : null}
              </div>

              <div className="panel stack onboarding-standalone-panel">
                <div className="section-copy">
                  <h3 className="h3">
                    <LabelWithTooltip label={c.standaloneTitle} tooltip={c.standaloneHint} />
                  </h3>
                </div>
                <form className="stack" action={assignOnboardingProcessAction}>
                  <div className="grid3">
                    <label className="field">
                      <span className="label">{c.employee}</span>
                      <select className="input" name="employeeId" defaultValue="">
                        <option value="" disabled>{c.employee}</option>
                        {availableEmployees.map((person) => (
                          <option key={person.id} value={person.id}>
                            {person.name} ({person.email})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span className="label">{c.template}</span>
                      <select className="input" name="templateId" defaultValue="">
                        <option value="" disabled>{c.template}</option>
                        {dashboard.templates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.title || template.position.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span className="label">{c.startDate}</span>
                      <input className="input" type="date" name="startDate" defaultValue={new Date().toISOString().slice(0, 10)} />
                    </label>
                  </div>
                  <button className="button" type="submit">{c.createStandalone}</button>
                </form>
              </div>
            </section>
          </>
        ) : null}

        <section className="panel stack">
          <div className="section-head">
            <div className="section-copy">
              <h2 className="h2">
                <LabelWithTooltip label={c.listTitle} tooltip={c.listHint} />
              </h2>
            </div>
          </div>
          <div className="list">
            {activeOnboardingItems.map((item) => {
              const subject = item.employee?.name || item.candidate?.fullName || item.process?.positionTitle || "Onboarding";
              const status = getOnboardingStatusMeta(item.status, lang);
              return (
                <div key={item.id} className="item stack entity-card">
                  <div className="item-top">
                    <div className="stack">
                      <div className="item-title">{subject}</div>
                      <div className="muted small">
                        {(item.position?.title || item.template?.position.title || item.process?.positionTitle || c.noValue)} · {item.team?.name || c.noValue}
                      </div>
                    </div>
                    <div className="inline">
                      <span className={`pill pill-status pill-status-${status.tone}`}>{status.label}</span>
                      <Link className="button button-secondary" href={`/onboarding/${item.id}`}>
                        {c.open} <IconArrowRight size={18} />
                      </Link>
                    </div>
                  </div>

                  <div className="detail-list detail-list-compact">
                    <div><strong>{c.progress}:</strong> {item.progress}%</div>
                    <div><strong>{c.nextOwner}:</strong> {status.nextOwnerLabel}</div>
                    <div><strong>{c.template}:</strong> {item.template?.title || item.template?.position.title || c.noValue}</div>
                    <div><strong>HR:</strong> {item.hrOwner?.name || c.noValue}</div>
                  </div>
                </div>
              );
            })}
            {activeOnboardingItems.length === 0 ? <div className="muted small">{c.empty}</div> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
