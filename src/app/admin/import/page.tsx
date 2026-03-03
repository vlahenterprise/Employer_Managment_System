import Link from "next/link";
import { requireAdminUser } from "@/server/current-user";
import { importLegacyTsvAction, importSettingsSheetAction } from "../actions";
import { getRequestLang } from "@/i18n/server";
import { getI18n } from "@/i18n";
import { IconArrowLeft } from "@/components/icons";

export default async function AdminImportPage({
  searchParams
}: {
  searchParams: { success?: string; error?: string };
}) {
  await requireAdminUser();
  const lang = getRequestLang();
  const t = getI18n(lang);

  const success = searchParams.success ? decodeURIComponent(searchParams.success) : null;
  const error = searchParams.error ? decodeURIComponent(searchParams.error) : null;

  return (
    <main className="page">
      <div className="card stack">
        <div className="header">
          <div>
            <h1>{t.admin.title}</h1>
            <p className="muted">{t.admin.import.subtitle}</p>
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
          <Link className="tab" href="/admin/settings">
            {t.admin.tabs.settings}
          </Link>
          <Link className="tab" href="/admin/performance-questions">
            {t.admin.tabs.performanceQuestions}
          </Link>
          <Link className="tab tab-active" href="/admin/import">
            {t.admin.tabs.import}
          </Link>
          <Link className="tab" href="/admin/backup">
            {t.admin.tabs.backup}
          </Link>
        </div>

        {success ? <div className="success">{success}</div> : null}
        {error ? <div className="error">{error}</div> : null}

        <section className="panel stack">
          <h2 className="h2">{t.admin.import.how}</h2>
          <div className="muted small stack">
            <div>{t.admin.import.step1}</div>
            <div>{t.admin.import.step2}</div>
            <div>{t.admin.import.step3}</div>
            <div className="muted">
              {t.admin.import.settingsOnly}
            </div>
          </div>
        </section>

        <section className="panel stack">
          <h2 className="h2">{t.admin.import.pasteTitle}</h2>
          <form className="stack" action={importSettingsSheetAction}>
            <label className="field">
              <span className="label">{t.admin.import.tsv}</span>
              <textarea
                className="input textarea"
                name="tsv"
                placeholder={t.admin.import.placeholder}
                rows={14}
                required
              />
            </label>

            <label className="inline small muted">
              <input type="checkbox" name="overwritePasswords" />
              {t.admin.import.overwritePasswords}
            </label>

            <button className="button" type="submit">
              {t.admin.import.importBtn}
            </button>
          </form>
        </section>

        <section className="panel stack">
          <h2 className="h2">{t.admin.import.legacyTitle}</h2>
          <div className="muted small">{t.admin.import.legacyHint}</div>

          <form className="stack" action={importLegacyTsvAction}>
            <label className="field">
              <span className="label">{t.admin.import.dataset}</span>
              <select className="input" name="dataset" defaultValue="REPORTS" required>
                <option value="REPORTS">{t.admin.import.datasets.reports}</option>
                <option value="REQUESTS">{t.admin.import.datasets.requests}</option>
                <option value="TASKS">{t.admin.import.datasets.tasks}</option>
                <option value="TASK_EVENTS">{t.admin.import.datasets.taskEvents}</option>
                <option value="REQUEST_EVENTS">{t.admin.import.datasets.requestEvents}</option>
                <option value="PERF_QUESTIONS">{t.admin.import.datasets.perfQuestions}</option>
                <option value="PERF_EVALUATIONS">{t.admin.import.datasets.perfEvaluations}</option>
                <option value="PERF_GOALS">{t.admin.import.datasets.perfGoals}</option>
                <option value="PERF_SELF">{t.admin.import.datasets.perfSelf}</option>
                <option value="PERF_MANAGER">{t.admin.import.datasets.perfManager}</option>
                <option value="PERF_PERSONAL">{t.admin.import.datasets.perfPersonal}</option>
                <option value="PERF_SUMMARY">{t.admin.import.datasets.perfSummary}</option>
                <option value="PERF_LOG">{t.admin.import.datasets.perfLog}</option>
              </select>
            </label>

            <label className="field">
              <span className="label">{t.admin.import.tsv}</span>
              <textarea
                className="input textarea"
                name="tsv"
                placeholder={t.admin.import.placeholder}
                rows={14}
                required
              />
            </label>

            <label className="inline small muted">
              <input type="checkbox" name="overwriteExisting" />
              {t.admin.import.overwriteExisting}
            </label>

            <button className="button" type="submit">
              {t.admin.import.importLegacyBtn}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
