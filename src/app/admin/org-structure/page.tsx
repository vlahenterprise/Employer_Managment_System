import Link from "next/link";
import AdminShell from "@/components/AdminShell";
import { requireAdminUser } from "@/server/current-user";
import { getOrgPickers, getOrgStructure } from "@/server/org-structure";
import {
  addOrgAssignmentAction,
  addOrgGlobalLinkAction,
  addOrgLinkAction,
  createOrgPositionAction,
  deleteOrgGlobalLinkAction,
  deleteOrgLinkAction,
  deleteOrgPositionAction,
  removeOrgAssignmentAction,
  updateOrgPositionAction
} from "./actions";
import { getRequestLang } from "@/i18n/server";
import { getI18n } from "@/i18n";
import { IconPlus, IconTrash } from "@/components/icons";
import { LabelWithTooltip } from "@/components/Tooltip";

function docTypeOptions(lang: "sr" | "en") {
  if (lang === "sr") {
    return [
      { value: "JOB_DESCRIPTION", label: "Opis posla" },
      { value: "WORK_INSTRUCTIONS", label: "Radne instrukcije" },
      { value: "POSITION_PROCESS", label: "Proces za poziciju" },
      { value: "POSITION_INSTRUCTION", label: "Instrukcija za poziciju" }
    ];
  }

  return [
    { value: "JOB_DESCRIPTION", label: "Job description" },
    { value: "WORK_INSTRUCTIONS", label: "Work instructions" },
    { value: "POSITION_PROCESS", label: "Position process" },
    { value: "POSITION_INSTRUCTION", label: "Position instruction" }
  ];
}

function globalTypeOptions(lang: "sr" | "en") {
  if (lang === "sr") {
    return [
      { value: "GLOBAL_PROCESS", label: "Globalni proces" },
      { value: "GLOBAL_INSTRUCTION", label: "Globalna instrukcija" }
    ];
  }

  return [
    { value: "GLOBAL_PROCESS", label: "Global process" },
    { value: "GLOBAL_INSTRUCTION", label: "Global instruction" }
  ];
}

function typeLabel(lang: "sr" | "en", type: string) {
  const map =
    lang === "sr"
      ? {
          JOB_DESCRIPTION: "Opis posla",
          WORK_INSTRUCTIONS: "Radne instrukcije",
          POSITION_PROCESS: "Proces pozicije",
          POSITION_INSTRUCTION: "Instrukcija pozicije",
          GLOBAL_PROCESS: "Globalni proces",
          GLOBAL_INSTRUCTION: "Globalna instrukcija"
        }
      : {
          JOB_DESCRIPTION: "Job description",
          WORK_INSTRUCTIONS: "Work instructions",
          POSITION_PROCESS: "Position process",
          POSITION_INSTRUCTION: "Position instruction",
          GLOBAL_PROCESS: "Global process",
          GLOBAL_INSTRUCTION: "Global instruction"
        };

  return map[type as keyof typeof map] ?? type;
}

export default async function AdminOrgStructurePage({
  searchParams
}: {
  searchParams: { success?: string; error?: string };
}) {
  const user = await requireAdminUser();
  const lang = getRequestLang();
  const t = getI18n(lang);

  const [{ nodes, globalLinks }, pickers] = await Promise.all([getOrgStructure(), getOrgPickers()]);

  const success = searchParams.success ? decodeURIComponent(searchParams.success) : null;
  const error = searchParams.error ? decodeURIComponent(searchParams.error) : null;

  const positions = [...nodes].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  const positionOptions = [{ id: "", title: "(root)" }, ...pickers.positions];

  return (
    <AdminShell
      user={user}
      lang={lang}
      title={t.admin.tabs.org}
      subtitle={t.admin.org.subtitle}
      activeTab="org"
      success={success}
      error={error}
      actions={
        <Link className="button button-secondary" href="/organization">
          {t.admin.org.viewChart}
        </Link>
      }
      note={
        lang === "sr"
          ? "Ovde admin održava org strukturu, pozicije, Drive dokumenta i globalne procese/instrukcije. ORG System i profili čitaju podatke odavde."
          : "Admins maintain the org structure, positions, Drive documents, and global processes/instructions here. ORG System and profiles read from this source."
      }
    >

        <section className="panel stack">
          <h2 className="h2">
            <LabelWithTooltip
              label={t.admin.org.createTitle}
              tooltip={
                lang === "sr"
                  ? "Kreiraj novu poziciju u hijerarhiji. Naziv pozicije kasnije služi za ORG System, profile i povezane Drive dokumente."
                  : "Create a new position in the hierarchy. The position title later drives ORG System visibility, profiles, and linked Drive documents."
              }
            />
          </h2>
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
          <h2 className="h2">
            <LabelWithTooltip
              label={lang === "sr" ? "Globalni procesi i instrukcije" : "Global processes and instructions"}
              tooltip={
                lang === "sr"
                  ? "Ovde dodaješ dokumenta koja nisu vezana samo za jednu poziciju, već važe šire kroz kompaniju ili timove."
                  : "Add documents here that do not belong to a single position, but apply more broadly across the company or several teams."
              }
            />
          </h2>
          <form className="stack" action={addOrgGlobalLinkAction}>
            <div className="grid3">
              <label className="field">
                <span className="label">{t.admin.org.linkLabel}</span>
                <input className="input" name="label" type="text" required />
              </label>
              <label className="field">
                <span className="label">{lang === "sr" ? "Tip resursa" : "Resource type"}</span>
                <select className="input" name="type" defaultValue="GLOBAL_INSTRUCTION">
                  {globalTypeOptions(lang).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
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
              <span className="label">{lang === "sr" ? "Kratak opis" : "Short note"}</span>
              <textarea className="input" name="description" rows={2} />
            </label>
            <label className="field">
              <span className="label">{t.admin.org.linkUrl}</span>
              <input className="input" name="url" type="url" required placeholder="https://drive.google.com/..." />
            </label>
            <button className="button button-secondary" type="submit">
              <IconPlus size={16} /> {t.common.add}
            </button>
          </form>
          <div className="list">
            {globalLinks.map((link) => (
              <div key={link.id} className="item item-compact">
                <div>
                  <div className="item-title">{link.label}</div>
                  <div className="pills">
                    <span className="pill">{typeLabel(lang, link.type)}</span>
                  </div>
                  {link.description ? <div className="muted small">{link.description}</div> : null}
                  <div className="muted small">{link.url}</div>
                </div>
                <form action={deleteOrgGlobalLinkAction}>
                  <input type="hidden" name="id" value={link.id} />
                  <button className="button button-secondary" type="submit">
                    <IconTrash size={16} /> {t.common.delete}
                  </button>
                </form>
              </div>
            ))}
            {globalLinks.length === 0 ? (
              <div className="muted">{lang === "sr" ? "Još nema globalnih resursa." : "No global resources yet."}</div>
            ) : null}
          </div>
        </section>

        <section className="panel stack">
          <h2 className="h2">
            <LabelWithTooltip
              label={t.admin.org.listTitle}
              tooltip={
                lang === "sr"
                  ? "Svaka pozicija može da ima dodeljene ljude i posebno vezane opise posla, instrukcije i procese. Ti resursi se prikazuju i u ORG System-u."
                  : "Each position can have assigned people and its own job descriptions, instructions, and processes. Those resources are also shown in ORG System."
              }
            />
          </h2>
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
                      <div className="item-title">
                        {lang === "sr" ? "Dokumenta i instrukcije za poziciju" : "Position documents and instructions"}
                      </div>
                      <form className="stack" action={addOrgLinkAction}>
                        <input type="hidden" name="positionId" value={p.id} />
                        <div className="grid2">
                          <label className="field">
                            <span className="label">{t.admin.org.linkLabel}</span>
                            <input className="input" name="label" type="text" required />
                          </label>
                          <label className="field">
                            <span className="label">{lang === "sr" ? "Tip resursa" : "Resource type"}</span>
                            <select className="input" name="type" defaultValue="POSITION_INSTRUCTION">
                              {docTypeOptions(lang).map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <label className="field">
                          <span className="label">{lang === "sr" ? "Kratak opis" : "Short note"}</span>
                          <textarea className="input" name="description" rows={2} />
                        </label>
                        <div className="grid2">
                          <label className="field">
                            <span className="label">{t.admin.org.linkUrl}</span>
                            <input className="input" name="url" type="url" required placeholder="https://drive.google.com/..." />
                          </label>
                          <label className="field">
                            <span className="label">{t.admin.org.order}</span>
                            <input className="input" name="order" type="number" min={0} defaultValue={0} />
                          </label>
                        </div>
                        <button className="button button-secondary" type="submit">
                          <IconPlus size={16} /> {t.common.add}
                        </button>
                      </form>
                      <div className="list">
                        {p.links.map((l) => (
                          <div key={l.id} className="item item-compact">
                            <div>
                              <div className="item-title">{l.label}</div>
                              <div className="pills">
                                <span className="pill">{typeLabel(lang, l.type)}</span>
                              </div>
                              {l.description ? <div className="muted small">{l.description}</div> : null}
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
    </AdminShell>
  );
}
