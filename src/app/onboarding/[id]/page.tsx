import Link from "next/link";
import { redirect } from "next/navigation";
import { LabelWithTooltip } from "@/components/Tooltip";
import { requireActiveUser } from "@/server/current-user";
import { getOnboardingDetail } from "@/server/onboarding";
import { getRequestLang } from "@/i18n/server";
import UserMenu from "../../dashboard/UserMenu";
import {
  addOnboardingItemAction,
  assignOnboardingProcessAction,
  confirmOnboardingItemAction,
  toggleOnboardingItemAction,
  updateOnboardingAction,
  updateOnboardingItemAction
} from "../actions";
import { IconArrowLeft, IconCheckCircle, IconPdf, IconUsers } from "@/components/icons";
import { getOnboardingOwnerLabel, getOnboardingStatusMeta } from "@/server/recruiting-presentation";
import { isHrModuleEnabled } from "@/server/features";

function copy(lang: "sr" | "en") {
  if (lang === "sr") {
    return {
      back: "Onboarding",
      noAccess: "Onboarding detalj nije dostupan.",
      profile: "Osoba i vlasnici procesa",
      phases: "Faze onboardinga",
      phasesHint: "Svaka faza može imati rok, mentora, Drive linkove i dve potvrde: HR i menadžer.",
      settings: "Podešavanja i dodela",
      settingsHint: "Ovde HR dodeljuje zaposlenog i template, aktivira onboarding i održava osnovne Drive reference za proces.",
      addItem: "Dodaj fazu",
      openDrive: "Otvori link",
      empty: "Nema faza.",
      status: "Status",
      startDate: "Početni datum",
      jobDescription: "Job description Drive link",
      workInstructions: "Work instructions Drive link",
      onboardingDocs: "Onboarding docs Drive link",
      note: "Napomena",
      save: "Sačuvaj izmene",
      email: "Email",
      team: "Tim",
      manager: "Menadžer",
      hrOwner: "HR vlasnik",
      profileHint: "Ovde vidiš ko je uključen u onboarding i koje su osnovne reference za posao i svakodnevni rad.",
      completed: "Spremno / završeno",
      markDone: "Označi spremnim",
      title: "Naziv faze",
      owner: "Vlasnik",
      driveUrl: "Primarni Drive URL",
      description: "Opis",
      progress: "Napredak",
      nextOwner: "Sledeći fokus",
      documents: "Dokumenti",
      orgSystem: "ORG System",
      documentsHint: "Opis posla i radne instrukcije prvo se održavaju kroz Admin → Org structure, a onboarding ih po potrebi koristi kao fallback.",
      noValue: "—",
      dueDate: "Rok",
      mentor: "Mentor",
      links: "Dodatni linkovi (Naslov | URL po redu)",
      hrConfirm: "HR potvrda",
      managerConfirm: "Menadžer potvrda",
      savePhase: "Sačuvaj fazu",
      template: "Template",
      employee: "Zaposleni",
      assignHint: "HR bira kom zaposlenom onboarding postaje aktivan i koji template se koristi za ovu poziciju.",
      assignTitle: "Dodela i aktivacija",
      confirm: "Potvrdi",
      confirmed: "Potvrđeno",
      phasesLocked: "Faze dolaze iz template-a i menjaju se kroz template editor.",
      openTemplate: "Otvori template"
    };
  }
  return {
    back: "Onboarding",
    noAccess: "Onboarding detail is not available.",
    profile: "Person and owners",
    phases: "Onboarding phases",
    phasesHint: "Each phase can have a due date, mentor, Drive resources, and two confirmations: HR and manager.",
    settings: "Settings and assignment",
    settingsHint: "HR assigns the employee and template here, activates onboarding, and maintains the core Drive references for the process.",
    addItem: "Add phase",
    openDrive: "Open link",
    empty: "No phases.",
    status: "Status",
    startDate: "Start date",
    jobDescription: "Job description Drive link",
    workInstructions: "Work instructions Drive link",
    onboardingDocs: "Onboarding docs Drive link",
    note: "Note",
    save: "Save changes",
    email: "Email",
    team: "Team",
    manager: "Manager",
    hrOwner: "HR owner",
    profileHint: "See who owns the onboarding and which job references support the person during the first weeks.",
    completed: "Ready / completed",
    markDone: "Mark ready",
    title: "Phase title",
    owner: "Owner",
    driveUrl: "Primary Drive URL",
    description: "Description",
    progress: "Progress",
    nextOwner: "Next focus",
    documents: "Documents",
    orgSystem: "ORG System",
    documentsHint: "Job descriptions and work instructions are maintained in Admin → Org structure first, and onboarding uses them as a fallback when needed.",
    noValue: "—",
    dueDate: "Due date",
    mentor: "Mentor",
    links: "Additional links (Label | URL per line)",
    hrConfirm: "HR confirmation",
    managerConfirm: "Manager confirmation",
    savePhase: "Save phase",
    template: "Template",
    employee: "Employee",
    assignHint: "HR decides which employee receives active onboarding and which template is used for this position.",
    assignTitle: "Assignment and activation",
    confirm: "Confirm",
    confirmed: "Confirmed",
    phasesLocked: "Phases come from the template and should be edited through the template editor.",
    openTemplate: "Open template"
  };
}

function formatDate(value: Date | null | undefined, lang: "sr" | "en") {
  if (!value) return "—";
  return new Intl.DateTimeFormat(lang === "sr" ? "sr-RS" : "en-GB", { dateStyle: "medium" }).format(value);
}

export default async function OnboardingDetailPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { success?: string; error?: string };
}) {
  if (!isHrModuleEnabled()) {
    redirect("/dashboard");
  }
  const user = await requireActiveUser();
  const lang = getRequestLang();
  const c = copy(lang);
  const detail = await getOnboardingDetail(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      hrAddon: user.hrAddon,
      adminAddon: user.adminAddon
    },
    params.id
  );

  if (!detail.ok) {
    return (
      <main className="page">
        <div className="card stack">
          <div className="error">{c.noAccess}</div>
        </div>
      </main>
    );
  }

  const onboarding = detail.onboarding;
  const success = searchParams.success ? decodeURIComponent(searchParams.success) : null;
  const error = searchParams.error ? decodeURIComponent(searchParams.error) : null;
  const progress = onboarding.items.length
    ? Math.round((onboarding.items.filter((item) => item.isReadyForClose).length / onboarding.items.length) * 100)
    : 0;
  const status = getOnboardingStatusMeta(onboarding.status, lang);
  const jobDescriptionUrl =
    onboarding.jobDescriptionUrl ||
    onboarding.employee?.jobDescriptionUrl ||
    detail.orgResources.jobDescriptionUrl ||
    null;
  const workInstructionsUrl =
    onboarding.workInstructionsUrl ||
    onboarding.employee?.workInstructionsUrl ||
    detail.orgResources.workInstructionsUrl ||
    null;

  return (
    <main className="page">
      <div className="card stack">
        <div className="page-topbar">
          <div className="page-topbar-main stack">
            <div className="header">
              <div>
                <h1 className="brand-title">{onboarding.employee?.name || onboarding.candidate?.fullName || onboarding.process?.positionTitle || "Onboarding"}</h1>
                <p className="muted">{status.label}</p>
              </div>
              <Link className="button button-secondary" href="/onboarding">
                <IconArrowLeft size={18} /> {c.back}
              </Link>
            </div>

            <div className="notice notice-info">
              <div className="notice-icon">
                <IconUsers size={18} />
              </div>
              <div className="stack">
                <div className="notice-title">{c.nextOwner}</div>
                <div className="muted small">{status.nextOwnerLabel}</div>
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

        {success ? <div className="success">{success}</div> : null}
        {error ? <div className="error">{error}</div> : null}

        <div className="grid3 profile-metrics">
          <div className="item item-compact kpi-card">
            <div className="kpi-icon"><IconCheckCircle size={18} /></div>
            <div><div className="kpi-value">{progress}%</div><div className="kpi-label">{c.progress}</div></div>
          </div>
          <div className="item item-compact kpi-card">
            <div className="kpi-icon"><IconUsers size={18} /></div>
            <div><div className="kpi-value">{status.label}</div><div className="kpi-label">{c.status}</div></div>
          </div>
          <div className="item item-compact kpi-card">
            <div className="kpi-icon"><IconArrowLeft size={18} /></div>
            <div><div className="kpi-value">{status.nextOwnerLabel}</div><div className="kpi-label">{c.nextOwner}</div></div>
          </div>
        </div>

        <div className="grid2 profile-grid">
          <section className="panel stack">
            <div className="section-head">
              <div className="section-copy">
                <h2 className="h2">
                  <LabelWithTooltip label={c.settings} tooltip={c.settingsHint} />
                </h2>
              </div>
            </div>
            {detail.permissions.canAssign ? (
              <form className="stack onboarding-assignment-panel" action={assignOnboardingProcessAction}>
                <input type="hidden" name="onboardingId" value={onboarding.id} />
                <div className="small muted">
                  <LabelWithTooltip label={c.assignTitle} tooltip={c.assignHint} />
                </div>
                <div className="grid3">
                  <label className="field">
                    <span className="label">{c.employee}</span>
                    <select className="input" name="employeeId" defaultValue={onboarding.employee?.id || ""}>
                      <option value="">{c.noValue}</option>
                      {detail.users.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name} ({person.email})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span className="label">{c.template}</span>
                    <select className="input" name="templateId" defaultValue={onboarding.templateId || ""}>
                      <option value="">{c.noValue}</option>
                      {detail.templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.title || template.position.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span className="label">{c.startDate}</span>
                    <input
                      className="input"
                      name="startDate"
                      type="date"
                      defaultValue={onboarding.startDate ? new Date(onboarding.startDate).toISOString().slice(0, 10) : ""}
                    />
                  </label>
                </div>
                <button className="button" type="submit">{c.save}</button>
              </form>
            ) : null}

            <form className="stack" action={updateOnboardingAction}>
              <input type="hidden" name="onboardingId" value={onboarding.id} />
              <div className="grid2">
                <label className="field">
                  <span className="label">{c.status}</span>
                  <select className="input" name="status" defaultValue={onboarding.status} disabled={!detail.permissions.canEdit}>
                    {["PLANNED", "ACTIVE", "WAITING_EMPLOYEE_ACTIONS", "WAITING_MANAGER_ACTIONS", "WAITING_HR_ACTIONS", "COMPLETED"].map((value) => (
                      <option key={value} value={value}>{getOnboardingStatusMeta(value, lang).label}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="label">{c.startDate}</span>
                  <input
                    className="input"
                    name="startDate"
                    type="date"
                    defaultValue={onboarding.startDate ? new Date(onboarding.startDate).toISOString().slice(0, 10) : ""}
                    disabled={!detail.permissions.canEdit}
                  />
                </label>
              </div>
              <div className="grid2">
                <label className="field">
                  <span className="label">{c.jobDescription}</span>
                  <input className="input" name="jobDescriptionUrl" type="url" defaultValue={onboarding.jobDescriptionUrl || onboarding.employee?.jobDescriptionUrl || ""} disabled={!detail.permissions.canEdit} />
                </label>
                <label className="field">
                  <span className="label">{c.workInstructions}</span>
                  <input className="input" name="workInstructionsUrl" type="url" defaultValue={onboarding.workInstructionsUrl || onboarding.employee?.workInstructionsUrl || ""} disabled={!detail.permissions.canEdit} />
                </label>
              </div>
              <label className="field">
                <span className="label">{c.onboardingDocs}</span>
                <input className="input" name="onboardingDocsUrl" type="url" defaultValue={onboarding.onboardingDocsUrl || ""} disabled={!detail.permissions.canEdit} />
              </label>
              <label className="field">
                <span className="label">{c.note}</span>
                <textarea className="input" name="note" rows={3} defaultValue={onboarding.note || ""} disabled={!detail.permissions.canEdit} />
              </label>
              {detail.permissions.canEdit ? <button className="button" type="submit">{c.save}</button> : null}
            </form>
          </section>

          <section className="panel stack">
            <div className="section-head">
              <div className="section-copy">
                <h2 className="h2">
                  <LabelWithTooltip label={c.profile} tooltip={c.profileHint} />
                </h2>
              </div>
            </div>
            <div className="detail-list detail-list-compact">
              <div><strong>{c.email}:</strong> {onboarding.employee?.email || onboarding.candidate?.email || c.noValue}</div>
              <div><strong>{c.team}:</strong> {onboarding.team?.name || c.noValue}</div>
              <div><strong>{c.manager}:</strong> {onboarding.manager?.name || c.noValue}</div>
              <div><strong>{c.hrOwner}:</strong> {onboarding.hrOwner?.name || c.noValue}</div>
              <div><strong>{c.template}:</strong> {onboarding.template?.title || onboarding.template?.position.title || onboarding.position?.title || c.noValue}</div>
            </div>
            <div className="stack">
              <div className="small muted">
                <LabelWithTooltip label={c.documents} tooltip={c.documentsHint} />
              </div>
            </div>
            <div className="inline">
              {jobDescriptionUrl ? (
                <a className="button button-secondary" href={jobDescriptionUrl} target="_blank" rel="noreferrer">
                  <IconPdf size={18} /> {lang === "sr" ? "Opis posla" : "Job description"}
                </a>
              ) : null}
              {workInstructionsUrl ? (
                <a className="button button-secondary" href={workInstructionsUrl} target="_blank" rel="noreferrer">
                  <IconPdf size={18} /> {lang === "sr" ? "Radne instrukcije" : "Work instructions"}
                </a>
              ) : null}
              {onboarding.onboardingDocsUrl ? (
                <a className="button button-secondary" href={onboarding.onboardingDocsUrl} target="_blank" rel="noreferrer">
                  <IconPdf size={18} /> {c.documents}
                </a>
              ) : null}
              <Link className="button button-secondary" href="/organization">
                <IconUsers size={18} /> {c.orgSystem}
              </Link>
            </div>
          </section>
        </div>

        <section className="panel stack">
          <div className="section-head">
            <div className="section-copy">
              <h2 className="h2">
                <LabelWithTooltip label={c.phases} tooltip={c.phasesHint} />
              </h2>
            </div>
          </div>

          <div className="list onboarding-phase-list">
            {onboarding.items.map((item) => (
              <div key={item.id} className="item stack onboarding-phase-card">
                <div className="item-top">
                  <div>
                    <div className="item-title">{item.title}</div>
                    <div className="muted small">
                      {getOnboardingOwnerLabel(item.ownerType, lang)} · {item.description || c.noValue}
                    </div>
                  </div>
                  <span className={`pill pill-status ${item.isReadyForClose ? "pill-status-approved" : "pill-status-review"}`}>
                    {item.isReadyForClose ? c.completed : c.markDone}
                  </span>
                </div>

                <div className="detail-list detail-list-compact">
                  <div><strong>{c.dueDate}:</strong> {formatDate(item.dueDate, lang)}</div>
                  <div><strong>{c.mentor}:</strong> {item.mentor?.name || c.noValue}</div>
                  <div><strong>{c.hrConfirm}:</strong> {item.hrConfirmationRequired ? (item.hrConfirmedAt ? c.confirmed : c.noValue) : c.noValue}</div>
                  <div><strong>{c.managerConfirm}:</strong> {item.managerConfirmationRequired ? (item.managerConfirmedAt ? c.confirmed : c.noValue) : c.noValue}</div>
                </div>

                {item.linksResolved.length ? (
                  <div className="inline">
                    {item.linksResolved.map((link) => (
                      <a key={`${item.id}:${link.url}`} className="button button-secondary" href={link.url} target="_blank" rel="noreferrer">
                        {c.openDrive}: {link.label}
                      </a>
                    ))}
                  </div>
                ) : null}

                {detail.permissions.canEdit && !onboarding.templateId ? (
                  <form className="stack onboarding-phase-editor" action={updateOnboardingItemAction}>
                    <input type="hidden" name="onboardingId" value={onboarding.id} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <div className="grid3">
                      <label className="field">
                        <span className="label">{c.title}</span>
                        <input className="input" name="title" defaultValue={item.title} required />
                      </label>
                      <label className="field">
                        <span className="label">{c.owner}</span>
                        <select className="input" name="ownerType" defaultValue={item.ownerType}>
                          {["HR", "MANAGER", "EMPLOYEE", "SHARED"].map((owner) => (
                            <option key={owner} value={owner}>{getOnboardingOwnerLabel(owner, lang)}</option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span className="label">{c.dueDate}</span>
                        <input className="input" type="date" name="dueDate" defaultValue={item.dueDate ? new Date(item.dueDate).toISOString().slice(0, 10) : ""} />
                      </label>
                    </div>
                    <div className="grid2">
                      <label className="field">
                        <span className="label">{c.mentor}</span>
                        <select className="input" name="mentorId" defaultValue={item.mentorId || ""}>
                          <option value="">{c.noValue}</option>
                          {detail.users.map((person) => (
                            <option key={person.id} value={person.id}>{person.name} ({person.email})</option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span className="label">{c.driveUrl}</span>
                        <input className="input" name="driveUrl" type="url" defaultValue={item.driveUrl || ""} />
                      </label>
                    </div>
                    <label className="field">
                      <span className="label">{c.description}</span>
                      <textarea className="input" name="description" rows={2} defaultValue={item.description || ""} />
                    </label>
                    <label className="field">
                      <span className="label">{c.links}</span>
                      <textarea
                        className="input"
                        name="linksText"
                        rows={2}
                        defaultValue={item.linksResolved.map((link) => `${link.label} | ${link.url}`).join("\n")}
                      />
                    </label>
                    <div className="grid2 onboarding-template-flags">
                      <label className="field field-checkbox">
                        <input type="checkbox" name="hrConfirmationRequired" defaultChecked={item.hrConfirmationRequired} />
                        <span>{c.hrConfirm}</span>
                      </label>
                      <label className="field field-checkbox">
                        <input type="checkbox" name="managerConfirmationRequired" defaultChecked={item.managerConfirmationRequired} />
                        <span>{c.managerConfirm}</span>
                      </label>
                    </div>
                    <button className="button button-secondary" type="submit">{c.savePhase}</button>
                  </form>
                ) : null}

                <div className="inline onboarding-phase-actions">
                  <form action={toggleOnboardingItemAction}>
                    <input type="hidden" name="onboardingId" value={onboarding.id} />
                    <input type="hidden" name="itemId" value={item.id} />
                    {item.isCompleted ? null : <input type="hidden" name="completed" value="1" />}
                    <button className={item.isCompleted ? "button button-secondary" : "button"} type="submit">
                      <IconCheckCircle size={18} /> {item.isCompleted ? c.completed : c.markDone}
                    </button>
                  </form>
                  {detail.permissions.canConfirmHr && item.hrConfirmationRequired ? (
                    <form action={confirmOnboardingItemAction}>
                      <input type="hidden" name="onboardingId" value={onboarding.id} />
                      <input type="hidden" name="itemId" value={item.id} />
                      <input type="hidden" name="kind" value="HR" />
                      <input type="hidden" name="confirmed" value={item.hrConfirmedAt ? "0" : "1"} />
                      <button className={item.hrConfirmedAt ? "button button-secondary" : "button button-secondary"} type="submit">
                        HR {item.hrConfirmedAt ? c.confirmed : c.confirm}
                      </button>
                    </form>
                  ) : null}
                  {detail.permissions.canConfirmManager && item.managerConfirmationRequired ? (
                    <form action={confirmOnboardingItemAction}>
                      <input type="hidden" name="onboardingId" value={onboarding.id} />
                      <input type="hidden" name="itemId" value={item.id} />
                      <input type="hidden" name="kind" value="MANAGER" />
                      <input type="hidden" name="confirmed" value={item.managerConfirmedAt ? "0" : "1"} />
                      <button className={item.managerConfirmedAt ? "button button-secondary" : "button button-secondary"} type="submit">
                        {c.managerConfirm} {item.managerConfirmedAt ? c.confirmed : c.confirm}
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            ))}
            {onboarding.items.length === 0 ? <div className="muted small">{c.empty}</div> : null}
          </div>

          {onboarding.templateId ? (
            <div className="notice notice-info">
              <div className="notice-icon">
                <IconPdf size={18} />
              </div>
              <div className="stack">
                <div className="notice-title">{c.phasesLocked}</div>
                <div className="muted small">
                  {onboarding.template?.title || onboarding.template?.position.title || c.template}
                </div>
              </div>
              {onboarding.templateId ? (
                <Link className="button button-secondary" href={`/onboarding/templates/${onboarding.templateId}`}>
                  {c.openTemplate}
                </Link>
              ) : null}
            </div>
          ) : null}

          {detail.permissions.canEdit && !onboarding.templateId ? (
            <form className="stack onboarding-phase-card onboarding-phase-add" action={addOnboardingItemAction}>
              <input type="hidden" name="onboardingId" value={onboarding.id} />
              <div className="grid3">
                <label className="field">
                  <span className="label">{c.title}</span>
                  <input className="input" name="title" type="text" required />
                </label>
                <label className="field">
                  <span className="label">{c.owner}</span>
                  <select className="input" name="ownerType" defaultValue="SHARED">
                    {["HR", "MANAGER", "EMPLOYEE", "SHARED"].map((owner) => (
                      <option key={owner} value={owner}>{getOnboardingOwnerLabel(owner, lang)}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="label">{c.dueDate}</span>
                  <input className="input" name="dueDate" type="date" />
                </label>
              </div>
              <div className="grid2">
                <label className="field">
                  <span className="label">{c.mentor}</span>
                  <select className="input" name="mentorId" defaultValue="">
                    <option value="">{c.noValue}</option>
                    {detail.users.map((person) => (
                      <option key={person.id} value={person.id}>{person.name} ({person.email})</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="label">{c.driveUrl}</span>
                  <input className="input" name="driveUrl" type="url" />
                </label>
              </div>
              <label className="field">
                <span className="label">{c.description}</span>
                <textarea className="input" name="description" rows={2} />
              </label>
              <label className="field">
                <span className="label">{c.links}</span>
                <textarea className="input" name="linksText" rows={2} />
              </label>
              <div className="grid2 onboarding-template-flags">
                <label className="field field-checkbox">
                  <input type="checkbox" name="hrConfirmationRequired" defaultChecked />
                  <span>{c.hrConfirm}</span>
                </label>
                <label className="field field-checkbox">
                  <input type="checkbox" name="managerConfirmationRequired" defaultChecked />
                  <span>{c.managerConfirm}</span>
                </label>
              </div>
              <button className="button" type="submit">{c.addItem}</button>
            </form>
          ) : null}
        </section>
      </div>
    </main>
  );
}
