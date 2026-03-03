import Link from "next/link";
import { requireAdminUser } from "@/server/current-user";
import { getOrgPickers, getOrgStructure } from "@/server/org-structure";
import {
  addOrgAssignmentAction,
  addOrgLinkAction,
  createOrgPositionAction,
  deleteOrgLinkAction,
  deleteOrgPositionAction,
  removeOrgAssignmentAction,
  updateOrgPositionAction
} from "./actions";
import { getRequestLang } from "@/i18n/server";
import { getI18n } from "@/i18n";
import { IconArrowLeft, IconPlus, IconTrash } from "@/components/icons";

export default async function AdminOrgStructurePage({
  searchParams
}: {
  searchParams: { success?: string; error?: string };
}) {
  await requireAdminUser();
  const lang = getRequestLang();
  const t = getI18n(lang);

  const [{ nodes }, pickers] = await Promise.all([getOrgStructure(), getOrgPickers()]);

  const success = searchParams.success ? decodeURIComponent(searchParams.success) : null;
  const error = searchParams.error ? decodeURIComponent(searchParams.error) : null;

  const positions = [...nodes].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  const positionOptions = [{ id: "", title: "(root)" }, ...pickers.positions];

  return (
    <main className="page">
      <div className="card stack">
        <div className="header">
          <div>
            <h1>{t.admin.title}</h1>
            <p className="muted">{t.admin.org.subtitle}</p>
          </div>
          <div className="inline">
            <Link className="button button-secondary" href="/organization">
              {t.admin.org.viewChart}
            </Link>
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
          <Link className="tab tab-active" href="/admin/org-structure">
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
          <h2 className="h2">{t.admin.org.createTitle}</h2>
          <form className="stack" action={createOrgPositionAction}>
            <div className="grid3">
              <label className="field">
                <span className="label">{t.admin.org.title}</span>
                <input className="input" name="title" type="text" required />
              </label>
              <label className="field">
                <span className="label">{t.admin.org.parent}</span>
                <select className="input" name="parentId" defaultValue="">
                  {positionOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">{t.admin.org.order}</span>
                <input className="input" name="order" type="number" min={0} defaultValue={0} />
              </label>
            </div>
            <label className="field">
              <span className="label">{t.admin.org.description}</span>
              <textarea className="input" name="description" rows={3} />
            </label>
            <label className="field">
              <span className="label">{t.admin.org.active}</span>
              <select className="input" name="isActive" defaultValue="1">
                <option value="1">{t.common.yes}</option>
                <option value="0">{t.common.no}</option>
              </select>
            </label>
            <button className="button" type="submit">
              <IconPlus size={16} /> {t.admin.org.createBtn}
            </button>
          </form>
        </section>

        <section className="panel stack">
          <h2 className="h2">{t.admin.org.listTitle}</h2>
          <div className="list">
            {positions.map((p) => {
              const assignedIds = new Set(p.users.map((u) => u.id));
              return (
                <details key={p.id} className="item stack">
                  <summary className="item-top" style={{ cursor: "pointer" }}>
                    <div>
                      <div className="item-title">{p.title}</div>
                      <div className="muted small">
                        {t.admin.org.order}: {p.order} · {p.isActive ? t.common.active : t.common.inactive}
                      </div>
                    </div>
                    <div className="pills">
                      <span className="pill">{p.users.length} {t.admin.org.people}</span>
                      <span className="pill">{p.links.length} {t.admin.org.links}</span>
                    </div>
                  </summary>

                  <form className="stack" action={updateOrgPositionAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <div className="grid3">
                      <label className="field">
                        <span className="label">{t.admin.org.title}</span>
                        <input className="input" name="title" type="text" defaultValue={p.title} required />
                      </label>
                      <label className="field">
                        <span className="label">{t.admin.org.parent}</span>
                        <select className="input" name="parentId" defaultValue={p.parentId ?? ""}>
                          {positionOptions.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span className="label">{t.admin.org.order}</span>
                        <input className="input" name="order" type="number" min={0} defaultValue={p.order} />
                      </label>
                    </div>
                    <label className="field">
                      <span className="label">{t.admin.org.description}</span>
                      <textarea className="input" name="description" rows={3} defaultValue={p.description ?? ""} />
                    </label>
                    <label className="field">
                      <span className="label">{t.admin.org.active}</span>
                      <select className="input" name="isActive" defaultValue={p.isActive ? "1" : "0"}>
                        <option value="1">{t.common.yes}</option>
                        <option value="0">{t.common.no}</option>
                      </select>
                    </label>
                    <button className="button" type="submit">
                      {t.common.save}
                    </button>
                  </form>

                  <div className="grid2">
                    <div className="stack">
                      <div className="item-title">{t.admin.org.assignTitle}</div>
                      <form className="inline" action={addOrgAssignmentAction}>
                        <input type="hidden" name="positionId" value={p.id} />
                        <select className="input" name="userId" defaultValue="">
                          <option value="" disabled>
                            {t.admin.org.selectUser}
                          </option>
                          {pickers.users
                            .filter((u) => !assignedIds.has(u.id))
                            .map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name} ({u.email})
                              </option>
                            ))}
                        </select>
                        <button className="button button-secondary" type="submit">
                          {t.common.add}
                        </button>
                      </form>
                      <div className="list">
                        {p.users.map((u) => (
                          <div key={u.id} className="item item-compact">
                            <div>
                              <div className="item-title">{u.name}</div>
                              <div className="muted small">{u.email}</div>
                            </div>
                            <form action={removeOrgAssignmentAction}>
                              <input type="hidden" name="id" value={u.assignmentId} />
                              <button className="button button-secondary" type="submit">
                                {t.common.remove}
                              </button>
                            </form>
                          </div>
                        ))}
                        {p.users.length === 0 ? <div className="muted">{t.admin.org.noAssignees}</div> : null}
                      </div>
                    </div>

                    <div className="stack">
                      <div className="item-title">{t.admin.org.linksTitle}</div>
                      <form className="stack" action={addOrgLinkAction}>
                        <input type="hidden" name="positionId" value={p.id} />
                        <div className="grid2">
                          <label className="field">
                            <span className="label">{t.admin.org.linkLabel}</span>
                            <input className="input" name="label" type="text" required />
                          </label>
                          <label className="field">
                            <span className="label">{t.admin.org.linkUrl}</span>
                            <input className="input" name="url" type="url" required />
                          </label>
                        </div>
                        <label className="field">
                          <span className="label">{t.admin.org.order}</span>
                          <input className="input" name="order" type="number" min={0} defaultValue={0} />
                        </label>
                        <button className="button button-secondary" type="submit">
                          <IconPlus size={16} /> {t.common.add}
                        </button>
                      </form>
                      <div className="list">
                        {p.links.map((l) => (
                          <div key={l.id} className="item item-compact">
                            <div>
                              <div className="item-title">{l.label}</div>
                              <div className="muted small">{l.url}</div>
                            </div>
                            <form action={deleteOrgLinkAction}>
                              <input type="hidden" name="id" value={l.id} />
                              <button className="button button-secondary" type="submit">
                                <IconTrash size={16} /> {t.common.delete}
                              </button>
                            </form>
                          </div>
                        ))}
                        {p.links.length === 0 ? <div className="muted">{t.admin.org.noLinks}</div> : null}
                      </div>
                    </div>
                  </div>

                  <form action={deleteOrgPositionAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="button button-danger" type="submit">
                      <IconTrash size={16} /> {t.common.delete}
                    </button>
                  </form>
                </details>
              );
            })}
            {positions.length === 0 ? <div className="muted">{t.admin.org.empty}</div> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
