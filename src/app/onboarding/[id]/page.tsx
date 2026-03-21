import Link from "next/link";
import { requireActiveUser } from "@/server/current-user";
import { getBrandingSettings } from "@/server/settings";
import { getOnboardingDetail } from "@/server/onboarding";
import { getRequestLang } from "@/i18n/server";
import UserMenu from "../../dashboard/UserMenu";
import { addOnboardingItemAction, toggleOnboardingItemAction, updateOnboardingAction } from "../actions";
import { IconArrowLeft, IconCheckCircle, IconPdf } from "@/components/icons";

function copy(lang: "sr" | "en") {
  if (lang === "sr") {
    return {
      back: "Onboarding",
      noAccess: "Onboarding detalj nije dostupan.",
      profile: "Employee",
      checklist: "Checklist",
      settings: "Details",
      addItem: "Add item",
      openDrive: "Open Drive link",
      empty: "Nema stavki."
    };
  }
  return {
    back: "Onboarding",
    noAccess: "Onboarding detail is not available.",
    profile: "Employee",
    checklist: "Checklist",
    settings: "Details",
    addItem: "Add item",
    openDrive: "Open Drive link",
    empty: "No items."
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
  return (
    <main className="page">
      <div className="card stack">
        <div className="page-topbar">
          <div className="page-topbar-main">
            <div className="header">
              <div className="brand">
                {branding.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="brand-logo" src={branding.logoUrl} alt={branding.title} />
                ) : null}
                <div>
                  <h1 className="brand-title">{onboarding.employee?.name || onboarding.candidate?.fullName || "Onboarding"}</h1>
                  <p className="muted">{onboarding.status}</p>
                </div>
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
            <h2 className="h2">{c.settings}</h2>
            <form className="stack" action={updateOnboardingAction}>
              <input type="hidden" name="onboardingId" value={onboarding.id} />
              <div className="grid2">
                <label className="field">
                  <span className="label">Status</span>
                  <select className="input" name="status" defaultValue={onboarding.status} disabled={!detail.permissions.canEdit}>
                    {["PLANNED", "ACTIVE", "WAITING_EMPLOYEE_ACTIONS", "WAITING_MANAGER_ACTIONS", "WAITING_HR_ACTIONS", "COMPLETED"].map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="label">Start date</span>
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
                  <span className="label">Job description Drive link</span>
                  <input className="input" name="jobDescriptionUrl" type="url" defaultValue={onboarding.jobDescriptionUrl || onboarding.employee?.jobDescriptionUrl || ""} disabled={!detail.permissions.canEdit} />
                </label>
                <label className="field">
                  <span className="label">Work instructions Drive link</span>
                  <input className="input" name="workInstructionsUrl" type="url" defaultValue={onboarding.workInstructionsUrl || onboarding.employee?.workInstructionsUrl || ""} disabled={!detail.permissions.canEdit} />
                </label>
              </div>
              <label className="field">
                <span className="label">Onboarding docs Drive link</span>
                <input className="input" name="onboardingDocsUrl" type="url" defaultValue={onboarding.onboardingDocsUrl || ""} disabled={!detail.permissions.canEdit} />
              </label>
              <label className="field">
                <span className="label">Note</span>
                <textarea className="input" name="note" rows={3} defaultValue={onboarding.note || ""} disabled={!detail.permissions.canEdit} />
              </label>
              {detail.permissions.canEdit ? <button className="button" type="submit">Save</button> : null}
            </form>
          </section>

          <section className="panel stack">
            <h2 className="h2">{c.profile}</h2>
            <div className="detail-list">
              <div><strong>Email:</strong> {onboarding.employee?.email || onboarding.candidate?.email || "—"}</div>
              <div><strong>Team:</strong> {onboarding.team?.name || "—"}</div>
              <div><strong>Manager:</strong> {onboarding.manager?.name || "—"}</div>
              <div><strong>HR:</strong> {onboarding.hrOwner?.name || "—"}</div>
            </div>
            <div className="inline">
              {onboarding.jobDescriptionUrl || onboarding.employee?.jobDescriptionUrl ? (
                <a className="button button-secondary" href={onboarding.jobDescriptionUrl || onboarding.employee?.jobDescriptionUrl || "#"} target="_blank" rel="noreferrer">
                  <IconPdf size={18} /> Job description
                </a>
              ) : null}
              {onboarding.workInstructionsUrl || onboarding.employee?.workInstructionsUrl ? (
                <a className="button button-secondary" href={onboarding.workInstructionsUrl || onboarding.employee?.workInstructionsUrl || "#"} target="_blank" rel="noreferrer">
                  <IconPdf size={18} /> {c.openDrive}
                </a>
              ) : null}
            </div>
          </section>
        </div>

        <section className="panel stack">
          <h2 className="h2">{c.checklist}</h2>
          <div className="list">
            {onboarding.items.map((item) => (
              <div key={item.id} className="item item-compact">
                <div>
                  <div className="item-title">{item.title}</div>
                  <div className="muted small">{item.ownerType} · {item.description || "—"}</div>
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
                      <IconCheckCircle size={18} /> {item.isCompleted ? "Completed" : "Mark done"}
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
                  <span className="label">Title</span>
                  <input className="input" name="title" type="text" required />
                </label>
                <label className="field">
                  <span className="label">Owner</span>
                  <select className="input" name="ownerType" defaultValue="SHARED">
                    {["HR", "MANAGER", "EMPLOYEE", "SHARED"].map((owner) => (
                      <option key={owner} value={owner}>{owner}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="label">Drive URL</span>
                  <input className="input" name="driveUrl" type="url" />
                </label>
              </div>
              <label className="field">
                <span className="label">Description</span>
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
