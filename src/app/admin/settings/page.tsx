import Link from "next/link";
import { prisma } from "@/server/db";
import { requireAdminUser } from "@/server/current-user";
import { deleteSettingAction, upsertSettingAction } from "../actions";
import { getRequestLang } from "@/i18n/server";
import { getI18n } from "@/i18n";
import { groupLabel, isValidHexColor, KNOWN_SETTINGS, type SettingGroup, type SettingMeta } from "@/server/settings-meta";
import { IconArrowLeft } from "@/components/icons";

function normalizeBool(value: string | undefined | null) {
  const v = String(value ?? "").trim().toLowerCase();
  return ["1", "true", "yes", "y", "on"].includes(v) ? "1" : "0";
}

function renderInput(meta: SettingMeta, value: string, t: ReturnType<typeof getI18n>) {
  const commonProps = {
    className: "input",
    name: "value",
    defaultValue: value || "",
    placeholder: meta.placeholder || ""
  } as any;

  if (meta.type === "boolean") {
    return (
      <select className="input" name="value" defaultValue={normalizeBool(value)}>
        <option value="1">{t.common.yes}</option>
        <option value="0">{t.common.no}</option>
      </select>
    );
  }

  if (meta.type === "number") {
    return (
      <input
        {...commonProps}
        type="number"
        min={meta.min}
        max={meta.max}
        step={meta.step}
        inputMode="numeric"
      />
    );
  }

  if (meta.type === "time") {
    return <input {...commonProps} type="time" />;
  }

  if (meta.type === "url") {
    return <input {...commonProps} type="url" />;
  }

  if (meta.type === "color") {
    const preview = isValidHexColor(value) ? value.trim() : "transparent";
    return (
      <div className="inline" style={{ gap: 10 }}>
        <span
          aria-hidden="true"
          title={value || meta.placeholder || ""}
          className="color-dot"
          style={{ background: preview }}
        />
        <input {...commonProps} type="text" />
      </div>
    );
  }

  if (meta.key === "EmailFooterTask" || meta.key === "EmailFooterLeave") {
    return (
      <textarea
        className="input"
        name="value"
        rows={3}
        defaultValue={value || ""}
        placeholder={meta.placeholder || ""}
        style={{ resize: "vertical" }}
      />
    );
  }

  return <input {...commonProps} type="text" />;
}

export default async function AdminSettingsPage({
  searchParams
}: {
  searchParams: { success?: string; error?: string };
}) {
  await requireAdminUser();
  const lang = getRequestLang();
  const t = getI18n(lang);

  const settingsRows = await prisma.setting.findMany({
    orderBy: { key: "asc" },
    select: { key: true, value: true, updatedAt: true }
  });

  const valueByKey = new Map(settingsRows.map((s) => [s.key, s.value]));
  const updatedAtByKey = new Map(settingsRows.map((s) => [s.key, s.updatedAt]));

  const knownKeys = new Set(KNOWN_SETTINGS.map((s) => s.key));
  const unknownRows = settingsRows.filter((s) => !knownKeys.has(s.key) && !s.key.startsWith("BackupLastRun"));

  const groups = new Map<SettingGroup, SettingMeta[]>();
  for (const meta of KNOWN_SETTINGS) {
    const list = groups.get(meta.group) ?? [];
    list.push(meta);
    groups.set(meta.group, list);
  }

  const success = searchParams.success ? decodeURIComponent(searchParams.success) : null;
  const error = searchParams.error ? decodeURIComponent(searchParams.error) : null;

  return (
    <main className="page">
      <div className="card stack">
        <div className="header">
          <div>
            <h1>{t.admin.title}</h1>
            <p className="muted">{t.admin.settings.subtitle}</p>
          </div>
          <div className="inline">
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
          <Link className="tab" href="/admin/org-structure">
            {t.admin.tabs.org}
          </Link>
          <Link className="tab" href="/admin/activity-types">
            {t.admin.tabs.activityTypes}
          </Link>
          <Link className="tab tab-active" href="/admin/settings">
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
          <h2 className="h2">{t.admin.settings.upsert}</h2>
          <form className="grid2" action={upsertSettingAction}>
            <label className="field">
              <span className="label">{t.admin.settings.key}</span>
              <input className="input" name="key" type="text" placeholder="npr. SecondaryColor" required />
            </label>
            <label className="field">
              <span className="label">{t.admin.settings.value}</span>
              <input className="input" name="value" type="text" placeholder="npr. #F05123" required />
            </label>
            <div className="field field-actions">
              <span className="label"> </span>
              <button className="button" type="submit">
                {t.admin.settings.save}
              </button>
            </div>
          </form>
        </section>

        {[...groups.entries()].map(([group, metas]) => (
          <section key={group} className="stack">
            <h2 className="h2">{groupLabel(lang, group)}</h2>
            <div className="list">
              {metas.map((meta) => {
                const value = valueByKey.get(meta.key) ?? "";
                const updatedAt = updatedAtByKey.get(meta.key) ?? null;
                return (
                  <div key={meta.key} className="item stack">
                    <div className="item-top">
                      <div>
                        <div className="item-title">{meta.label[lang]}</div>
                        <div className="muted small">
                          <code>{meta.key}</code>
                          {updatedAt ? ` · ${t.admin.settings.lastUpdate}: ${updatedAt.toISOString()}` : ` · ${t.admin.settings.notSet}`}
                        </div>
                      </div>
                      <div className="inline">
                        <form action={deleteSettingAction}>
                          <input type="hidden" name="key" value={meta.key} />
                          <button className="button button-secondary" type="submit">
                            {t.admin.settings.reset}
                          </button>
                        </form>
                      </div>
                    </div>

                    <div className="muted small">{meta.description[lang]}</div>

                    <div className="inline" style={{ justifyContent: "space-between" }}>
                      <form className="inline" action={upsertSettingAction} style={{ flex: 1 }}>
                        <input type="hidden" name="key" value={meta.key} />
                        <div style={{ flex: 1, minWidth: 260 }}>{renderInput(meta, value, t)}</div>
                        <button className="button button-secondary" type="submit">
                          {t.admin.settings.save}
                        </button>
                      </form>
                    </div>
                  </div>
                );
              })}
              {metas.length === 0 ? <div className="muted">{t.admin.settings.empty}</div> : null}
            </div>
          </section>
        ))}

        <section className="stack">
          <h2 className="h2">{t.admin.settings.advanced}</h2>
          <div className="muted small">{t.admin.settings.advancedHint}</div>
          <div className="list">
            {unknownRows.map((setting) => (
              <div key={setting.key} className="item stack">
                <div className="item-top">
                  <div>
                    <div className="item-title">
                      <code>{setting.key}</code>
                    </div>
                    <div className="muted small">
                      {t.admin.settings.lastUpdate}: {setting.updatedAt.toISOString()}
                    </div>
                  </div>
                  <form action={deleteSettingAction}>
                    <input type="hidden" name="key" value={setting.key} />
                    <button className="button button-secondary" type="submit">
                      {t.admin.settings.delete}
                    </button>
                  </form>
                </div>

                <form className="inline" action={upsertSettingAction}>
                  <input type="hidden" name="key" value={setting.key} />
                  <input className="input" name="value" type="text" defaultValue={setting.value} required />
                  <button className="button button-secondary" type="submit">
                    {t.admin.settings.update}
                  </button>
                </form>
              </div>
            ))}
            {unknownRows.length === 0 ? <div className="muted">{t.admin.settings.noAdvanced}</div> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
