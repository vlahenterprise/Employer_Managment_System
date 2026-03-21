import AdminShell from "@/components/AdminShell";
import { requireAdminUser } from "@/server/current-user";
import { importLegacyTsvAction, importSettingsSheetAction } from "../actions";
import { getRequestLang } from "@/i18n/server";
import { getI18n } from "@/i18n";

export default async function AdminImportPage({
  searchParams
}: {
  searchParams: { success?: string; error?: string };
}) {
  const user = await requireAdminUser();
  const lang = getRequestLang();
  const t = getI18n(lang);

  const success = searchParams.success ? decodeURIComponent(searchParams.success) : null;
  const error = searchParams.error ? decodeURIComponent(searchParams.error) : null;

  return (
    <AdminShell
      user={user}
      lang={lang}
      title={t.admin.tabs.import}
      subtitle={t.admin.import.subtitle}
      activeTab="import"
      success={success}
      error={error}
      note={
        lang === "sr"
          ? "Import je namenjen migracijama i korekcijama podataka. Koristi ga pažljivo i uvek proveri dataset pre unosa."
          : "Import is meant for migrations and structured corrections. Use it carefully and always confirm the dataset before submitting."
      }
    >

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
    </AdminShell>
  );
}
