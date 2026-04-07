import Link from "next/link";
import AdminShell from "@/components/AdminShell";
import { requireAdminUser } from "@/server/current-user";
import { getOrgPickers, getOrgStructure } from "@/server/org-structure";
import { buildOrgPathMap, normalizeOrgSearchText, ORG_TIER_ORDER } from "@/lib/org-system";
import {
  addOrgAssignmentAction,
  addOrgGlobalLinkAction,
  addOrgLinkAction,
  createOrgPositionAction,
  deleteOrgGlobalLinkAction,
  deleteOrgLinkAction,
  deleteOrgPositionAction,
  importDefaultOrgStructureAction,
  removeOrgAssignmentAction,
  syncDefaultOrgStructureAction,
  updateOrgPositionAction
} from "./actions";
import { getRequestLang } from "@/i18n/server";
import { getI18n } from "@/i18n";
import { IconPlus, IconTrash } from "@/components/icons";
import { LabelWithTooltip } from "@/components/Tooltip";
import { GuidancePanel } from "@/components/GuidancePanel";

function tierOptions(lang: "sr" | "en") {
  if (lang === "sr") {
    return [
      { value: "DIRECTOR", label: "Direktor" },
      { value: "MANAGER", label: "Menadžer" },
      { value: "LEAD", label: "Lider" },
      { value: "SUPERVISOR", label: "Supervizor" },
      { value: "STAFF", label: "Pozicija / tim" }
    ];
  }

  return [
    { value: "DIRECTOR", label: "Director" },
    { value: "MANAGER", label: "Manager" },
    { value: "LEAD", label: "Lead" },
    { value: "SUPERVISOR", label: "Supervisor" },
    { value: "STAFF", label: "Staff / team role" }
  ];
}

function tierLabel(lang: "sr" | "en", value: string) {
  return tierOptions(lang).find((option) => option.value === value)?.label ?? value;
}

function nodeKindOptions(lang: "sr" | "en") {
  if (lang === "sr") {
    return [
      { value: "POSITION", label: "Pozicija" },
      { value: "TEAM", label: "Tim / grupa" }
    ];
  }

  return [
    { value: "POSITION", label: "Position" },
    { value: "TEAM", label: "Team / group" }
  ];
}

function nodeKindLabel(lang: "sr" | "en", value: string) {
  return nodeKindOptions(lang).find((option) => option.value === value)?.label ?? value;
}

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

type OrgPositionCardNode = Awaited<ReturnType<typeof getOrgStructure>>["nodes"][number];
type OrgPickerData = Awaited<ReturnType<typeof getOrgPickers>>;
type PickerPosition = OrgPickerData["positions"][number];
type OrgTierFilter = (typeof ORG_TIER_ORDER)[number] | "ALL";

function groupedParentOptions(lang: "sr" | "en", options: PickerPosition[], currentId?: string) {
  return ORG_TIER_ORDER.map((tier) => ({
    tier,
    label: tierLabel(lang, tier),
    positions: options.filter((option) => option.tier === tier && option.id !== currentId)
  }));
}

function AdminOrgPositionCard({
  position,
  positionOptions,
  pickers,
  parentTitle,
  hierarchyPath,
  childCount,
  lang,
  t
}: {
  position: OrgPositionCardNode;
  positionOptions: PickerPosition[];
  pickers: OrgPickerData;
  parentTitle: string;
  hierarchyPath: string;
  childCount: number;
  lang: "sr" | "en";
  t: ReturnType<typeof getI18n>;
}) {
  const assignedIds = new Set(position.users.map((user) => user.id));
  const missingDocs = position.links.length === 0;
  const missingPeople = position.kind === "POSITION" && position.users.length === 0;
  const parentGroups = groupedParentOptions(lang, positionOptions, position.id);

  return (
    <details className="item stack admin-org-card">
      <summary className="admin-org-card-summary">
        <div className="admin-org-card-main">
          <div className="admin-org-card-title-row">
            <div className="item-title">{position.title}</div>
            <div className="pills">
              <span className={`pill pill-org-tier pill-org-tier-${position.tier.toLowerCase()}`}>{tierLabel(lang, position.tier)}</span>
              <span className="pill">{nodeKindLabel(lang, position.kind)}</span>
              {position.teamName ? <span className="pill">{position.teamName}</span> : null}
              <span className="pill">
                {position.users.length} {t.admin.org.people}
              </span>
              <span className="pill">
                {position.links.length} {t.admin.org.links}
              </span>
              <span className="pill">
                {childCount} {lang === "sr" ? "podpozicija" : "child roles"}
              </span>
              {missingPeople ? <span className="pill pill-warn">{lang === "sr" ? "Bez ljudi" : "No people"}</span> : null}
              {missingDocs ? <span className="pill pill-warn">{lang === "sr" ? "Bez dokumenata" : "No docs"}</span> : null}
            </div>
          </div>
          <div className="admin-org-card-meta">
            <span>{lang === "sr" ? "Nadređeni" : "Parent"}: {parentTitle}</span>
            <span>{lang === "sr" ? "Putanja" : "Path"}: {hierarchyPath}</span>
            {position.teamName ? <span>{lang === "sr" ? "Tim" : "Team"}: {position.teamName}</span> : null}
            <span>{t.admin.org.order}: {position.order}</span>
            <span>{position.isActive ? t.common.active : t.common.inactive}</span>
          </div>
        </div>
        <span className="admin-org-card-open">{lang === "sr" ? "Otvori i uredi" : "Open & edit"}</span>
      </summary>

      <div className="admin-org-card-body">
        <div className="admin-org-card-grid">
          <section className="stack admin-org-panel">
            <div className="admin-org-panel-head">
              <div>
                <div className="item-title">{lang === "sr" ? "Osnove čvora" : "Node basics"}</div>
                <div className="muted small">
                  {lang === "sr"
                    ? "Senioritet određuje boju i nivo u chart prikazu, a tip čvora određuje da li je ovo pozicija ili tim."
                    : "Seniority controls chart color and hierarchy level, while node type controls whether this is a position or team."}
                </div>
              </div>
              <Link className="button button-secondary" href={`/organization?focus=${position.id}`}>
                {lang === "sr" ? "Otvori u chart-u" : "Open in chart"}
              </Link>
            </div>
            <form className="stack" action={updateOrgPositionAction}>
              <input type="hidden" name="id" value={position.id} />
              <div className="grid2">
                <label className="field">
                  <span className="label">{t.admin.org.title}</span>
                  <input className="input" name="title" type="text" defaultValue={position.title} required />
                </label>
                <label className="field">
                  <span className="label">{lang === "sr" ? "Senioritet" : "Seniority"}</span>
                  <select className="input" name="tier" defaultValue={position.tier}>
                    {tierOptions(lang).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid2">
                <label className="field">
                  <span className="label">{lang === "sr" ? "Tip čvora" : "Node type"}</span>
                  <select className="input" name="kind" defaultValue={position.kind}>
                    {nodeKindOptions(lang).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="label">{lang === "sr" ? "Povezani tim" : "Linked team"}</span>
                  <select className="input" name="teamId" defaultValue={position.teamId ?? ""}>
                    <option value="">{lang === "sr" ? "(bez povezanog tima)" : "(no linked team)"}</option>
                    {pickers.teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid2">
                <label className="field">
                  <span className="label">{t.admin.org.parent}</span>
                  <select className="input" name="parentId" defaultValue={position.parentId ?? ""}>
                    <option value="">{lang === "sr" ? "(vrh hijerarhije)" : "(top of hierarchy)"}</option>
                    {parentGroups.map((group) =>
                      group.positions.length > 0 ? (
                        <optgroup key={group.tier} label={group.label}>
                          {group.positions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.title}
                            </option>
                          ))}
                        </optgroup>
                      ) : null
                    )}
                  </select>
                </label>
                <label className="field">
                  <span className="label">{t.admin.org.order}</span>
                  <input className="input" name="order" type="number" min={0} defaultValue={position.order} />
                </label>
              </div>
              <div className="grid2">
                <label className="field">
                  <span className="label">{t.admin.org.active}</span>
                  <select className="input" name="isActive" defaultValue={position.isActive ? "1" : "0"}>
                    <option value="1">{t.common.yes}</option>
                    <option value="0">{t.common.no}</option>
                  </select>
                </label>
                <div className="admin-org-mini-stats">
                  <div className="admin-org-mini-stat">
                    <span>{lang === "sr" ? "Ljudi" : "People"}</span>
                    <strong>{position.users.length}</strong>
                  </div>
                  <div className="admin-org-mini-stat">
                    <span>{lang === "sr" ? "Dok." : "Docs"}</span>
                    <strong>{position.links.length}</strong>
                  </div>
                  <div className="admin-org-mini-stat">
                    <span>{lang === "sr" ? "Ispod" : "Children"}</span>
                    <strong>{childCount}</strong>
                  </div>
                </div>
              </div>
              <label className="field">
                <span className="label">{t.admin.org.description}</span>
                <textarea className="input" name="description" rows={3} defaultValue={position.description ?? ""} />
              </label>
              <div className="inline">
                <button className="button" type="submit">
                  {t.common.save}
                </button>
              </div>
            </form>
          </section>

          <section className="stack admin-org-panel">
            <div className="admin-org-panel-head">
              <div>
                <div className="item-title">{t.admin.org.assignTitle}</div>
                <div className="muted small">
                  {lang === "sr" ? "Brzo dodeli ili ukloni ljude sa ove pozicije." : "Quickly assign or remove people from this position."}
                </div>
              </div>
            </div>
            <form className="inline" action={addOrgAssignmentAction}>
              <input type="hidden" name="positionId" value={position.id} />
              <select className="input" name="userId" defaultValue="">
                <option value="" disabled>
                  {t.admin.org.selectUser}
                </option>
                {pickers.users
                  .filter((user) => !assignedIds.has(user.id))
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
              </select>
              <button className="button button-secondary" type="submit">
                {t.common.add}
              </button>
            </form>
            <div className="list admin-org-compact-list">
              {position.users.map((user) => (
                <div key={user.id} className="item item-compact admin-org-mini-item">
                  <div>
                    <div className="item-title">{user.name}</div>
                    <div className="muted small">{user.email}</div>
                  </div>
                  <form action={removeOrgAssignmentAction}>
                    <input type="hidden" name="id" value={user.assignmentId} />
                    <button className="button button-secondary" type="submit">
                      {t.common.remove}
                    </button>
                  </form>
                </div>
              ))}
              {position.users.length === 0 ? <div className="muted">{t.admin.org.noAssignees}</div> : null}
            </div>
          </section>

          <section className="stack admin-org-panel">
            <div className="admin-org-panel-head">
              <div>
                <div className="item-title">{lang === "sr" ? "Dokumenta i instrukcije" : "Documents and instructions"}</div>
                <div className="muted small">
                  {lang === "sr"
                    ? "Koristi Drive linkove za opis posla, procese i radne instrukcije."
                    : "Use Drive links for job descriptions, processes, and work instructions."}
                </div>
              </div>
            </div>
            <form className="stack" action={addOrgLinkAction}>
              <input type="hidden" name="positionId" value={position.id} />
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
                <span className="label">{t.admin.org.linkUrl}</span>
                <input className="input" name="url" type="url" required placeholder="https://drive.google.com/..." />
              </label>
              <div className="grid2">
                <label className="field">
                  <span className="label">{lang === "sr" ? "Kratak opis" : "Short note"}</span>
                  <textarea className="input" name="description" rows={2} />
                </label>
                <label className="field">
                  <span className="label">{t.admin.org.order}</span>
                  <input className="input" name="order" type="number" min={0} defaultValue={0} />
                </label>
              </div>
              <div className="inline">
                <button className="button button-secondary" type="submit">
                  <IconPlus size={16} /> {t.common.add}
                </button>
              </div>
            </form>
            <div className="list admin-org-compact-list">
              {position.links.map((link) => (
                <div key={link.id} className="item item-compact admin-org-mini-item">
                  <div>
                    <div className="item-title">{link.label}</div>
                    <div className="pills">
                      <span className="pill">{typeLabel(lang, link.type)}</span>
                    </div>
                    {link.description ? <div className="muted small">{link.description}</div> : null}
                    <div className="muted small">{link.url}</div>
                  </div>
                  <form action={deleteOrgLinkAction}>
                    <input type="hidden" name="id" value={link.id} />
                    <button className="button button-secondary" type="submit">
                      <IconTrash size={16} /> {t.common.delete}
                    </button>
                  </form>
                </div>
              ))}
              {position.links.length === 0 ? <div className="muted">{t.admin.org.noLinks}</div> : null}
            </div>
          </section>
        </div>

        <div className="admin-org-card-footer">
          <form action={deleteOrgPositionAction}>
            <input type="hidden" name="id" value={position.id} />
            <button className="button button-danger" type="submit">
              <IconTrash size={16} /> {t.common.delete}
            </button>
          </form>
        </div>
      </div>
    </details>
  );
}

export default async function AdminOrgStructurePage({
  searchParams
}: {
  searchParams: { success?: string; error?: string; query?: string; focus?: string; tier?: string };
}) {
  const user = await requireAdminUser();
  const lang = getRequestLang();
  const t = getI18n(lang);

  const [{ nodes, globalLinks }, pickers] = await Promise.all([getOrgStructure(), getOrgPickers()]);

  const success = searchParams.success ? decodeURIComponent(searchParams.success) : null;
  const error = searchParams.error ? decodeURIComponent(searchParams.error) : null;
  const query = searchParams.query ? decodeURIComponent(searchParams.query).trim() : "";
  const focus = searchParams.focus ?? "all";
  const requestedTier = String(searchParams.tier ?? "ALL").toUpperCase() as OrgTierFilter;
  const tier: OrgTierFilter =
    requestedTier === "ALL" || ORG_TIER_ORDER.includes(requestedTier as (typeof ORG_TIER_ORDER)[number]) ? requestedTier : "ALL";

  const positions = [...nodes].sort(
    (a, b) =>
      ORG_TIER_ORDER.indexOf(a.tier) - ORG_TIER_ORDER.indexOf(b.tier) ||
      a.order - b.order ||
      a.title.localeCompare(b.title)
  );
  const pathMap = buildOrgPathMap(positions);
  const parentTitleById = new Map(positions.map((position) => [position.id, position.title] as const));
  const childCountByParentId = positions.reduce(
    (acc, position) => {
      if (position.parentId) acc.set(position.parentId, (acc.get(position.parentId) ?? 0) + 1);
      return acc;
    },
    new Map<string, number>()
  );

  const filteredPositions = positions.filter((position) => {
    const queryNeedle = normalizeOrgSearchText(query);
    const matchesQuery =
      !queryNeedle ||
      normalizeOrgSearchText(position.title).includes(queryNeedle) ||
      normalizeOrgSearchText(position.description).includes(queryNeedle) ||
      normalizeOrgSearchText(position.teamName).includes(queryNeedle) ||
      position.users.some(
        (userRow) =>
          normalizeOrgSearchText(userRow.name).includes(queryNeedle) ||
          normalizeOrgSearchText(userRow.email).includes(queryNeedle)
      ) ||
      position.links.some(
        (link) =>
          normalizeOrgSearchText(link.label).includes(queryNeedle) ||
          normalizeOrgSearchText(link.description).includes(queryNeedle) ||
          normalizeOrgSearchText(link.url).includes(queryNeedle)
      );

    if (!matchesQuery) return false;
    if (tier !== "ALL" && position.tier !== tier) return false;
    if (focus === "needsDocs") return position.links.length === 0;
    if (focus === "needsPeople") return position.kind === "POSITION" && position.users.length === 0;
    if (focus === "inactive") return !position.isActive;
    return true;
  });

  const positionsWithoutDocs = positions.filter((position) => position.links.length === 0).length;
  const positionsWithoutPeople = positions.filter((position) => position.kind === "POSITION" && position.users.length === 0).length;
  const inactivePositions = positions.filter((position) => !position.isActive).length;
  const tierGroups = ORG_TIER_ORDER.map((tierValue) => ({
    tier: tierValue,
    label: tierLabel(lang, tierValue),
    total: positions.filter((position) => position.tier === tierValue).length,
    positions: filteredPositions.filter((position) => position.tier === tierValue)
  }));

  const focusOptions =
    lang === "sr"
      ? [
          { value: "all", label: "Sve pozicije" },
          { value: "needsDocs", label: "Bez dokumentacije" },
          { value: "needsPeople", label: "Bez dodeljenih ljudi" },
          { value: "inactive", label: "Neaktivne" }
        ]
      : [
          { value: "all", label: "All positions" },
          { value: "needsDocs", label: "Missing documents" },
          { value: "needsPeople", label: "Missing people" },
          { value: "inactive", label: "Inactive" }
        ];

  const tierFilterOptions =
    lang === "sr"
      ? [{ value: "ALL", label: "Svi nivoi" }, ...tierOptions(lang)]
      : [{ value: "ALL", label: "All levels" }, ...tierOptions(lang)];

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
        <div className="inline">
          <form action={syncDefaultOrgStructureAction}>
            <button className="button button-secondary" type="submit">
              {lang === "sr" ? "Uskladi finalnu VLAH strukturu" : "Sync final VLAH structure"}
            </button>
          </form>
          <Link className="button button-secondary" href="/organization">
            {t.admin.org.viewChart}
          </Link>
        </div>
      }
      note={
        lang === "sr"
          ? "Ovde admin održava org strukturu, pozicije, Drive dokumenta i globalne procese/instrukcije. ORG System i profili čitaju podatke odavde."
          : "Admins maintain the org structure, positions, Drive documents, and global processes/instructions here. ORG System and profiles read from this source."
      }
    >
      <GuidancePanel
        title={lang === "sr" ? "Preporučeni redosled rada" : "Recommended setup order"}
        description={
          lang === "sr"
            ? "Da bi ORG System ostao čist, prvo postavi hijerarhiju, zatim ljude, pa tek onda Drive dokumenta i globalne procese."
            : "To keep ORG System clean, set hierarchy first, then people, then Drive documents and global processes."
        }
        items={
          lang === "sr"
            ? [
                "Senioritet određuje boju i nivo kartice u chart-u.",
                "Parent određuje linije i reporting odnos; tim može biti podređen menadžeru kao poseban čvor.",
                "Dokumenta drži na Drive-u, a ovde čuvaj samo link i kratak opis."
              ]
            : [
                "Seniority controls chart color and card level.",
                "Parent controls connectors and reporting; a team can sit under a manager as a separate node.",
                "Keep documents in Drive and store only the link and short description here."
              ]
        }
        tone="neutral"
      />

      {positions.length === 0 ? (
        <section className="panel stack">
          <div className="item item-compact admin-org-import-banner">
            <div>
              <div className="item-title">
                {lang === "sr" ? "Brzi početak bez ručnog unosa" : "Quick start without manual setup"}
              </div>
              <div className="muted small">
                {lang === "sr"
                  ? "Možeš odmah da uvezeš VLAH organizacionu strukturu iz pripremljenog template-a, pa kasnije samo dopunjavaš Drive linkove, opise i globalne procese."
                  : "You can import the prepared VLAH organization template first, then only enrich it with Drive links, descriptions, and global processes."}
              </div>
            </div>
            <form action={importDefaultOrgStructureAction}>
              <button className="button" type="submit">
                <IconPlus size={16} /> {lang === "sr" ? "Uvezi VLAH strukturu" : "Import VLAH structure"}
              </button>
            </form>
          </div>
        </section>
      ) : null}

      <section className="panel stack" id="create-position">
        <h2 className="h2">
          <LabelWithTooltip
            label={t.admin.org.createTitle}
            tooltip={
              lang === "sr"
                ? "Kreiraj novu poziciju u hijerarhiji. Senioritet određuje boju kartice i nivo prikaza u ORG System-u."
                : "Create a new position in the hierarchy. Seniority controls card color and level placement in ORG System."
            }
          />
        </h2>
        <form className="stack" action={createOrgPositionAction}>
          <div className="grid2">
            <label className="field">
              <span className="label">{t.admin.org.title}</span>
              <input className="input" name="title" type="text" required />
            </label>
            <label className="field">
              <span className="label">{lang === "sr" ? "Senioritet" : "Seniority"}</span>
              <select className="input" name="tier" defaultValue="STAFF">
                {tierOptions(lang).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid2">
            <label className="field">
              <span className="label">{t.admin.org.parent}</span>
              <select className="input" name="parentId" defaultValue="">
                <option value="">{lang === "sr" ? "(vrh hijerarhije)" : "(top of hierarchy)"}</option>
                {groupedParentOptions(lang, pickers.positions).map((group) =>
                  group.positions.length > 0 ? (
                    <optgroup key={group.tier} label={group.label}>
                      {group.positions.map((position) => (
                        <option key={position.id} value={position.id}>
                          {position.title}
                        </option>
                      ))}
                    </optgroup>
                  ) : null
                )}
              </select>
            </label>
            <label className="field">
              <span className="label">{t.admin.org.order}</span>
              <input className="input" name="order" type="number" min={0} defaultValue={0} />
            </label>
          </div>
          <div className="grid2">
            <label className="field">
              <span className="label">{lang === "sr" ? "Tip čvora" : "Node type"}</span>
              <select className="input" name="kind" defaultValue="POSITION">
                {nodeKindOptions(lang).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="label">{lang === "sr" ? "Povezani tim" : "Linked team"}</span>
              <select className="input" name="teamId" defaultValue="">
                <option value="">{lang === "sr" ? "(bez povezanog tima)" : "(no linked team)"}</option>
                {pickers.teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
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
        <div className="section-head">
          <div>
            <h2 className="h2">{lang === "sr" ? "Brzo upravljanje org strukturom" : "Quick org management"}</h2>
            <div className="muted small">
              {lang === "sr"
                ? "Filtriraj po senioritetu, ljudima i dokumentaciji da brzo pronađeš šta treba da dopuniš."
                : "Filter by seniority, people, and documentation so you can quickly find what still needs work."}
            </div>
          </div>
          <div className="pills">
            <span className="pill">
              {lang === "sr" ? "Ukupno" : "Total"} · {positions.length}
            </span>
            <span className="pill">
              {lang === "sr" ? "Bez dokumenata" : "Missing docs"} · {positionsWithoutDocs}
            </span>
            <span className="pill">
              {lang === "sr" ? "Bez ljudi" : "Missing people"} · {positionsWithoutPeople}
            </span>
            <span className="pill">
              {lang === "sr" ? "Neaktivne" : "Inactive"} · {inactivePositions}
            </span>
          </div>
        </div>

        <div className="admin-org-summary-grid">
          {tierGroups.map((group) => (
            <div key={group.tier} className="admin-org-summary-card">
              <span className={`pill pill-org-tier pill-org-tier-${group.tier.toLowerCase()}`}>{group.label}</span>
              <strong>{group.total}</strong>
              <span className="muted small">{lang === "sr" ? "pozicija" : "positions"}</span>
            </div>
          ))}
        </div>

        <form className="admin-org-filter-grid" method="get">
          <label className="field">
            <span className="label">{lang === "sr" ? "Pretraga" : "Search"}</span>
            <input
              className="input"
              name="query"
              type="search"
              defaultValue={query}
              placeholder={
                lang === "sr"
                  ? "Pozicija, zaposleni, dokument ili Drive link..."
                  : "Position, employee, document, or Drive link..."
              }
            />
          </label>
          <label className="field">
            <span className="label">{lang === "sr" ? "Senioritet" : "Seniority"}</span>
            <select className="input" name="tier" defaultValue={tier}>
              {tierFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">{lang === "sr" ? "Fokus" : "Focus"}</span>
            <select className="input" name="focus" defaultValue={focus}>
              {focusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="inline">
            <button className="button" type="submit">
              {lang === "sr" ? "Primeni filtere" : "Apply filters"}
            </button>
            {(query || focus !== "all" || tier !== "ALL") ? (
              <Link className="button button-secondary" href="/admin/org-structure">
                {lang === "sr" ? "Očisti" : "Clear"}
              </Link>
            ) : null}
          </div>
        </form>
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
        <div className="stack">
          {tierGroups.map((group) =>
            group.positions.length > 0 ? (
              <section key={group.tier} className="stack admin-org-tier-group">
                <div className="section-head">
                  <div>
                    <h3 className="h3">{group.label}</h3>
                    <div className="muted small">
                      {lang === "sr"
                        ? `Pozicije u senioritetu ${group.label.toLowerCase()}.`
                        : `Positions grouped under ${group.label.toLowerCase()}.`}
                    </div>
                  </div>
                  <span className={`pill pill-org-tier pill-org-tier-${group.tier.toLowerCase()}`}>{group.positions.length}</span>
                </div>
                <div className="list">
                  {group.positions.map((position) => (
                    <AdminOrgPositionCard
                      key={position.id}
                      position={position}
                      positionOptions={pickers.positions}
                      pickers={pickers}
                      parentTitle={position.parentId ? parentTitleById.get(position.parentId) ?? (lang === "sr" ? "Nema" : "None") : lang === "sr" ? "Vrh hijerarhije" : "Top of hierarchy"}
                      hierarchyPath={(pathMap.get(position.id) ?? [position.title]).join(" → ")}
                      childCount={childCountByParentId.get(position.id) ?? 0}
                      lang={lang}
                      t={t}
                    />
                  ))}
                </div>
              </section>
            ) : null
          )}
          {positions.length === 0 ? <div className="muted">{t.admin.org.empty}</div> : null}
          {positions.length > 0 && filteredPositions.length === 0 ? (
            <div className="muted">
              {lang === "sr"
                ? "Nema pozicija za izabranu pretragu, nivo senioriteta i fokus filter."
                : "No positions match the selected search, seniority level, and focus filter."}
            </div>
          ) : null}
        </div>
      </section>
    </AdminShell>
  );
}
