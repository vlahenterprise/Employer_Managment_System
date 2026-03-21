import Link from "next/link";
import { LabelWithTooltip } from "@/components/Tooltip";
import { requireActiveUser } from "@/server/current-user";
import { getBrandingSettings } from "@/server/settings";
import { getOnboardingDetail } from "@/server/onboarding";
import { getRequestLang } from "@/i18n/server";
import UserMenu from "../../dashboard/UserMenu";
import { addOnboardingItemAction, toggleOnboardingItemAction, updateOnboardingAction } from "../actions";
import { IconArrowLeft, IconCheckCircle, IconPdf, IconUsers } from "@/components/icons";
import { getOnboardingOwnerLabel, getOnboardingStatusMeta } from "@/server/recruiting-presentation";

function copy(lang: "sr" | "en") {
  if (lang === "sr") {
    return {
      back: "Onboarding",
      noAccess: "Onboarding detalj nije dostupan.",
      profile: "Osoba i vlasnici procesa",
      checklist: "Checklist",
      checklistHint: "Svaka stavka treba da jasno pokazuje ko je vlasnik, da li je završena i da li postoji Drive dokument koji pomaže sledeći korak.",
      settings: "Podešavanja i linkovi",
      settingsHint: "Ovde se menja status onboarding procesa, početni datum i važni Drive linkovi koji pomažu novom zaposlenom i timu.",
      addItem: "Dodaj stavku",
      openDrive: "Otvori Drive link",
      empty: "Nema stavki.",
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
      completed: "Završeno",
      markDone: "Označi kao gotovo",
      title: "Naslov",
      owner: "Vlasnik",
      driveUrl: "Drive URL",
      description: "Opis",
      progress: "Napredak",
      nextOwner: "Sledeći fokus",
      documents: "Dokumenti",
      noValue: "—"
    };
  }
  return {
    back: "Onboarding",
    noAccess: "Onboarding detail is not available.",
    profile: "Person and owners",
    checklist: "Checklist",
    checklistHint: "Each item should clearly show the owner, whether it is done, and whether there is a Drive document that supports the next step.",
    settings: "Settings and links",
    settingsHint: "Change the onboarding status, start date, and the key Drive links used by the new employee and the team.",
    addItem: "Add item",
    openDrive: "Open Drive link",
    empty: "No items.",
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
    completed: "Completed",
    markDone: "Mark done",
    title: "Title",
    owner: "Owner",
    driveUrl: "Drive URL",
    description: "Description",
    progress: "Progress",
    nextOwner: "Next focus",
    documents: "Documents",
    noValue: "—"
  };
}

export default async function OnboardingDetailPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { success?: string; error?: string };
}) {
  const user = await requireActiveUser();
  const branding = await getBrandingSettings();
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
    ? Math.round((onboarding.items.filter((item) => item.isCompleted).length / onboarding.items.length) * 100)
    : 0;
  const status = getOnboardingStatusMeta(onboarding.status, lang);

  return (
    <main className="page">
      <div className="card stack">
        <div className="page-topbar">
          <div className="page-topbar-main stack">
            <div className="header">
              <div className="brand">
                {branding.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="brand-logo" src={branding.logoUrl} alt={branding.title} />
                ) : null}
                <div>
                  <h1 className="brand-title">{onboarding.employee?.name || onboarding.candidate?.fullName || "Onboarding"}</h1>
                  <p className="muted">{status.label}</p>
                </div>
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
            <div className="kpi-icon">
              <IconCheckCircle size={18} />
            </div>
            <div>
              <div className="kpi-value">{progress}%</div>
              <div className="kpi-label">{c.progress}</div>
            </div>
          </div>
          <div className="item item-compact kpi-card">
            <div className="kpi-icon">
              <IconUsers size={18} />
            </div>
            <div>
              <div className="kpi-value">{status.label}</div>
              <div className="kpi-label">{c.status}</div>
            </div>
          </div>
          <div className="item item-compact kpi-card">
            <div className="kpi-icon">
              <IconArrowLeft size={18} />
            </div>
            <div>
              <div className="kpi-value">{status.nextOwnerLabel}</div>
              <div className="kpi-label">{c.nextOwner}</div>
            </div>
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
                  <input
                    className="input"
                    name="jobDescriptionUrl"
                    type="url"
                    defaultValue={onboarding.jobDescriptionUrl || onboarding.employee?.jobDescriptionUrl || ""}
                    disabled={!detail.permissions.canEdit}
                  />
                </label>
                <label className="field">
                  <span className="label">{c.workInstructions}</span>
                  <input
                    className="input"
                    name="workInstructionsUrl"
                    type="url"
                    defaultValue={onboarding.workInstructionsUrl || onboarding.employee?.workInstructionsUrl || ""}
                    disabled={!detail.permissions.canEdit}
                  />
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
                <h2 className="h2">{c.profile}</h2>
              </div>
            </div>
            <div className="detail-list detail-list-compact">
              <div><strong>{c.email}:</strong> {onboarding.employee?.email || onboarding.candidate?.email || c.noValue}</div>
              <div><strong>{c.team}:</strong> {onboarding.team?.name || c.noValue}</div>
              <div><strong>{c.manager}:</strong> {onboarding.manager?.name || c.noValue}</div>
              <div><strong>{c.hrOwner}:</strong> {onboarding.hrOwner?.name || c.noValue}</div>
            </div>
            <div className="inline">
              {onboarding.jobDescriptionUrl || onboarding.employee?.jobDescriptionUrl ? (
                <a className="button button-secondary" href={onboarding.jobDescriptionUrl || onboarding.employee?.jobDescriptionUrl || "#"} target="_blank" rel="noreferrer">
                  <IconPdf size={18} /> {lang === "sr" ? "Opis posla" : "Job description"}
                </a>
              ) : null}
              {onboarding.workInstructionsUrl || onboarding.employee?.workInstructionsUrl ? (
                <a className="button button-secondary" href={onboarding.workInstructionsUrl || onboarding.employee?.workInstructionsUrl || "#"} target="_blank" rel="noreferrer">
                  <IconPdf size={18} /> {lang === "sr" ? "Radne instrukcije" : "Work instructions"}
                </a>
              ) : null}
              {onboarding.onboardingDocsUrl ? (
                <a className="button button-secondary" href={onboarding.onboardingDocsUrl} target="_blank" rel="noreferrer">
                  <IconPdf size={18} /> {c.documents}
                </a>
              ) : null}
            </div>
          </section>
        </div>

        <section className="panel stack">
          <div className="section-head">
            <div className="section-copy">
              <h2 className="h2">
                <LabelWithTooltip label={c.checklist} tooltip={c.checklistHint} />
              </h2>
            </div>
          </div>

          <div className="list">
            {onboarding.items.map((item) => (
              <div key={item.id} className="item item-compact">
                <div>
                  <div className="item-title">{item.title}</div>
                  <div className="muted small">
                    {getOnboardingOwnerLabel(item.ownerType, lang)} · {item.description || c.noValue}
                  </div>
                </div>
                <div className="inline">
                  {item.driveUrl ? (
                    <a className="button button-secondary" href={item.driveUrl} target="_blank" rel="noreferrer">
                      {c.openDrive}
                    </a>
                  ) : null}
                  <form action={toggleOnboardingItemAction}>
                    <input type="hidden" name="onboardingId" value={onboarding.id} />
                    <input type="hidden" name="itemId" value={item.id} />
                    {item.isCompleted ? null : <input type="hidden" name="completed" value="1" />}
                    <button className={item.isCompleted ? "button button-secondary" : "button"} type="submit">
                      <IconCheckCircle size={18} /> {item.isCompleted ? c.completed : c.markDone}
                    </button>
                  </form>
                </div>
              </div>
            ))}
            {onboarding.items.length === 0 ? <div className="muted small">{c.empty}</div> : null}
          </div>

          {detail.permissions.canEdit ? (
            <form className="stack" action={addOnboardingItemAction}>
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
                  <span className="label">{c.driveUrl}</span>
                  <input className="input" name="driveUrl" type="url" />
                </label>
              </div>
              <label className="field">
                <span className="label">{c.description}</span>
                <textarea className="input" name="description" rows={2} />
              </label>
              <button className="button" type="submit">{c.addItem}</button>
            </form>
          ) : null}
        </section>
      </div>
    </main>
  );
}
