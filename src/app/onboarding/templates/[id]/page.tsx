import Link from "next/link";
import { redirect } from "next/navigation";
import { LabelWithTooltip } from "@/components/Tooltip";
import { requireActiveUser } from "@/server/current-user";
import { getOnboardingTemplateDetail } from "@/server/onboarding";
import { getRequestLang } from "@/i18n/server";
import UserMenu from "../../../dashboard/UserMenu";
import {
  addOnboardingTemplateStepAction,
  deleteOnboardingTemplateStepAction,
  updateOnboardingTemplateAction,
  updateOnboardingTemplateStepAction
} from "../../actions";
import { IconArrowLeft, IconCheckCircle } from "@/components/icons";
import { isHrModuleEnabled } from "@/server/features";

function copy(lang: "sr" | "en") {
  if (lang === "sr") {
    return {
      back: "Onboarding",
      noAccess: "Template nije dostupan.",
      subtitle: "Pozicioni onboarding se definiše ovde, a HR ga kasnije dodeljuje zaposlenom.",
      basics: "Osnove template-a",
      basicsHint: "Jedan template postoji po poziciji iz ORG strukture. Menja se ovde, a koristi se kasnije pri dodeli onboardinga zaposlenom.",
      phases: "Faze onboardinga",
      phasesHint: "Svaka faza može imati opis, mentorstvo, rok u danima od starta i potrebne potvrde HR-a i menadžera.",
      active: "Aktivan template",
      titleField: "Interni naziv template-a",
      position: "Pozicija",
      description: "Opis",
      save: "Sačuvaj template",
      activeUse: "Aktivni onboarding koriste ovaj template",
      noActiveUse: "Još nema aktivnih onboardinga na ovom template-u.",
      phaseTitle: "Naziv faze",
      owner: "Vlasnik",
      dueOffsetDays: "Rok (broj dana od starta)",
      mentor: "Mentor",
      links: "Linkovi (jedan po redu, format: Naslov | URL)",
      hrConfirm: "HR potvrda",
      managerConfirm: "Menadžer potvrda",
      addPhase: "Dodaj fazu",
      updatePhase: "Sačuvaj fazu",
      deletePhase: "Obriši fazu",
      noValue: "—",
      detail: "Detalj"
    };
  }

  return {
    back: "Onboarding",
    noAccess: "Template is not available.",
    subtitle: "The position onboarding blueprint is defined here, then HR assigns it to an employee later.",
    basics: "Template basics",
    basicsHint: "There is one template per position from the ORG structure. Edit it here and use it later when assigning onboarding.",
    phases: "Onboarding phases",
    phasesHint: "Each phase can include a description, mentor, due offset from the start date, and HR/manager confirmations.",
    active: "Template active",
    titleField: "Internal template name",
    position: "Position",
    description: "Description",
    save: "Save template",
    activeUse: "Active onboardings using this template",
    noActiveUse: "No active onboarding is using this template yet.",
    phaseTitle: "Phase title",
    owner: "Owner",
    dueOffsetDays: "Due offset (days from start)",
    mentor: "Mentor",
    links: "Links (one per line, format: Label | URL)",
    hrConfirm: "HR confirmation",
    managerConfirm: "Manager confirmation",
    addPhase: "Add phase",
    updatePhase: "Save phase",
    deletePhase: "Delete phase",
    noValue: "—",
    detail: "Detail"
  };
}

function ownerLabel(lang: "sr" | "en", value: string) {
  if (value === "HR") return "HR";
  if (value === "MANAGER") return lang === "sr" ? "Menadžer" : "Manager";
  if (value === "EMPLOYEE") return lang === "sr" ? "Zaposleni" : "Employee";
  return lang === "sr" ? "Zajednički" : "Shared";
}

export default async function OnboardingTemplatePage({
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
  const detail = await getOnboardingTemplateDetail(
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

  const success = searchParams.success ? decodeURIComponent(searchParams.success) : null;
  const error = searchParams.error ? decodeURIComponent(searchParams.error) : null;
  const template = detail.template;

  return (
    <main className="page">
      <div className="card stack">
        <div className="page-topbar">
          <div className="page-topbar-main stack">
            <div className="header">
              <div>
                <h1 className="brand-title">{template.title || template.position.title}</h1>
                <p className="muted">{c.subtitle}</p>
              </div>
              <Link className="button button-secondary" href="/onboarding">
                <IconArrowLeft size={18} /> {c.back}
              </Link>
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

        <div className="grid2 profile-grid">
          <section className="panel stack">
            <div className="section-copy">
              <h2 className="h2">
                <LabelWithTooltip label={c.basics} tooltip={c.basicsHint} />
              </h2>
            </div>
            <form className="stack" action={updateOnboardingTemplateAction}>
              <input type="hidden" name="templateId" value={template.id} />
              <label className="field">
                <span className="label">{c.titleField}</span>
                <input className="input" name="title" defaultValue={template.title || ""} />
              </label>
              <div className="grid2">
                <label className="field">
                  <span className="label">{c.position}</span>
                  <input className="input" value={template.position.title} readOnly />
                </label>
                <label className="field field-checkbox">
                  <input type="checkbox" name="isActive" defaultChecked={template.isActive} />
                  <span>{c.active}</span>
                </label>
              </div>
              <label className="field">
                <span className="label">{c.description}</span>
                <textarea className="input" name="description" rows={3} defaultValue={template.description || ""} />
              </label>
              <button className="button" type="submit">{c.save}</button>
            </form>
          </section>

          <section className="panel stack">
            <div className="section-copy">
              <h2 className="h2">{c.activeUse}</h2>
            </div>
            <div className="list">
              {template.onboardings.map((onboarding) => (
                <div key={onboarding.id} className="item item-compact">
                  <div>
                    <div className="item-title">{onboarding.employee?.name || onboarding.candidate?.fullName || c.noValue}</div>
                    <div className="muted small">{onboarding.status}</div>
                  </div>
                  <Link className="button button-secondary" href={`/onboarding/${onboarding.id}`}>
                    {c.detail}
                  </Link>
                </div>
              ))}
              {template.onboardings.length === 0 ? <div className="muted small">{c.noActiveUse}</div> : null}
            </div>
          </section>
        </div>

        <section className="panel stack">
          <div className="section-copy">
            <h2 className="h2">
              <LabelWithTooltip label={c.phases} tooltip={c.phasesHint} />
            </h2>
          </div>

          <div className="list onboarding-phase-list">
            {template.steps.map((step) => (
              <div key={step.id} className="item stack onboarding-phase-card">
                <form className="stack" action={updateOnboardingTemplateStepAction}>
                  <input type="hidden" name="templateId" value={template.id} />
                  <input type="hidden" name="stepId" value={step.id} />
                  <input type="hidden" name="order" value={step.order} />
                  <div className="grid3">
                    <label className="field">
                      <span className="label">{c.phaseTitle}</span>
                      <input className="input" name="title" defaultValue={step.title} required />
                    </label>
                    <label className="field">
                      <span className="label">{c.owner}</span>
                      <select className="input" name="ownerType" defaultValue={step.ownerType}>
                        {["HR", "MANAGER", "EMPLOYEE", "SHARED"].map((owner) => (
                          <option key={owner} value={owner}>{ownerLabel(lang, owner)}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span className="label">{c.dueOffsetDays}</span>
                      <input className="input" type="number" min={0} name="dueOffsetDays" defaultValue={step.dueOffsetDays ?? ""} />
                    </label>
                  </div>
                  <div className="grid2">
                    <label className="field">
                      <span className="label">{c.mentor}</span>
                      <select className="input" name="mentorId" defaultValue={step.mentorId || ""}>
                        <option value="">{c.noValue}</option>
                        {detail.users.map((person) => (
                          <option key={person.id} value={person.id}>{person.name} ({person.email})</option>
                        ))}
                      </select>
                    </label>
                    <div className="grid2 onboarding-template-flags">
                      <label className="field field-checkbox">
                        <input type="checkbox" name="hrConfirmationRequired" defaultChecked={step.hrConfirmationRequired} />
                        <span>{c.hrConfirm}</span>
                      </label>
                      <label className="field field-checkbox">
                        <input type="checkbox" name="managerConfirmationRequired" defaultChecked={step.managerConfirmationRequired} />
                        <span>{c.managerConfirm}</span>
                      </label>
                    </div>
                  </div>
                  <label className="field">
                    <span className="label">{c.description}</span>
                    <textarea className="input" name="description" rows={2} defaultValue={step.description || ""} />
                  </label>
                  <label className="field">
                    <span className="label">{c.links}</span>
                    <textarea className="input" name="linksText" rows={3} defaultValue={step.linksText} />
                  </label>
                  <div className="inline">
                    <button className="button" type="submit">{c.updatePhase}</button>
                  </div>
                </form>
                <div className="inline">
                  <div className="muted small">
                    <IconCheckCircle size={16} /> {step.mentor?.name || c.noValue}
                  </div>
                  <form action={deleteOnboardingTemplateStepAction}>
                    <input type="hidden" name="templateId" value={template.id} />
                    <input type="hidden" name="stepId" value={step.id} />
                    <button className="button button-secondary" type="submit">{c.deletePhase}</button>
                  </form>
                </div>
              </div>
            ))}
          </div>

          <form className="stack onboarding-phase-card onboarding-phase-add" action={addOnboardingTemplateStepAction}>
            <input type="hidden" name="templateId" value={template.id} />
            <div className="grid3">
              <label className="field">
                <span className="label">{c.phaseTitle}</span>
                <input className="input" name="title" required />
              </label>
              <label className="field">
                <span className="label">{c.owner}</span>
                <select className="input" name="ownerType" defaultValue="SHARED">
                  {["HR", "MANAGER", "EMPLOYEE", "SHARED"].map((owner) => (
                    <option key={owner} value={owner}>{ownerLabel(lang, owner)}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">{c.dueOffsetDays}</span>
                <input className="input" type="number" min={0} name="dueOffsetDays" />
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
            </div>
            <label className="field">
              <span className="label">{c.description}</span>
              <textarea className="input" name="description" rows={2} />
            </label>
            <label className="field">
              <span className="label">{c.links}</span>
              <textarea className="input" name="linksText" rows={3} />
            </label>
            <button className="button" type="submit">{c.addPhase}</button>
          </form>
        </section>
      </div>
    </main>
  );
}
