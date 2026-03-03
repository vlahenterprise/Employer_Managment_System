import Link from "next/link";
import { prisma } from "@/server/db";
import { requireAdminUser } from "@/server/current-user";
import { getRequestLang } from "@/i18n/server";
import { getI18n } from "@/i18n";
import {
  createPerformanceQuestionAction,
  deletePerformanceQuestionAction,
  setPerformanceQuestionActiveAction,
  updatePerformanceQuestionAction
} from "../actions";
import { IconArrowLeft } from "@/components/icons";

export default async function AdminPerformanceQuestionsPage({
  searchParams
}: {
  searchParams: { success?: string; error?: string };
}) {
  await requireAdminUser();
  const lang = getRequestLang();
  const t = getI18n(lang);

  const questions = await prisma.performanceQuestion.findMany({
    orderBy: [{ qNo: "asc" }],
    select: { id: true, qNo: true, area: true, description: true, scale: true, isActive: true, updatedAt: true }
  });

  const success = searchParams.success ? decodeURIComponent(searchParams.success) : null;
  const error = searchParams.error ? decodeURIComponent(searchParams.error) : null;

  return (
    <main className="page">
      <div className="card stack">
        <div className="header">
          <div>
            <h1>{t.admin.title}</h1>
            <p className="muted">{t.admin.performanceQuestions.subtitle}</p>
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
          <Link className="tab tab-active" href="/admin/performance-questions">
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
          <h2 className="h2">{t.admin.performanceQuestions.newQuestion}</h2>
          <div className="muted small">{t.admin.performanceQuestions.langHint}</div>
          <form className="stack" action={createPerformanceQuestionAction}>
            <div className="grid2">
              <label className="field">
                <span className="label">{t.admin.performanceQuestions.qNo}</span>
                <input className="input" name="qNo" type="number" min={1} step={1} required />
              </label>

              <label className="field">
                <span className="label">{t.admin.performanceQuestions.area}</span>
                <input className="input" name="area" type="text" required />
              </label>

              <label className="field" style={{ gridColumn: "1 / -1" }}>
                <span className="label">{t.admin.performanceQuestions.description}</span>
                <textarea className="input" name="description" rows={3} style={{ resize: "vertical" }} required />
              </label>

              <label className="field" style={{ gridColumn: "1 / -1" }}>
                <span className="label">{t.admin.performanceQuestions.scale}</span>
                <input className="input" name="scale" type="text" required />
              </label>

              <label className="field">
                <span className="label">{t.admin.performanceQuestions.active}</span>
                <select className="input" name="isActive" defaultValue="1">
                  <option value="1">{t.common.yes}</option>
                  <option value="0">{t.common.no}</option>
                </select>
              </label>
            </div>

            <button className="button" type="submit">
              {t.admin.performanceQuestions.create}
            </button>
          </form>
        </section>

        <section className="stack">
          <h2 className="h2">{t.admin.performanceQuestions.list}</h2>
          <div className="list">
            {questions.map((q) => (
              <div key={q.id} className="item stack">
                <div className="item-top">
                  <div>
                    <div className="item-title">
                      #{q.qNo} · {q.area}
                    </div>
                    <div className="muted small">
                      {t.admin.settings.lastUpdate}: {q.updatedAt.toISOString()} ·{" "}
                      {q.isActive ? t.common.active : t.common.inactive}
                    </div>
                  </div>
                  <div className="inline">
                    <form action={setPerformanceQuestionActiveAction}>
                      <input type="hidden" name="id" value={q.id} />
                      <input type="hidden" name="isActive" value={q.isActive ? "0" : "1"} />
                      <button className="button button-secondary" type="submit">
                        {q.isActive ? t.admin.performanceQuestions.deactivate : t.admin.performanceQuestions.activate}
                      </button>
                    </form>
                    <form action={deletePerformanceQuestionAction}>
                      <input type="hidden" name="id" value={q.id} />
                      <button className="button button-danger" type="submit">
                        {t.admin.performanceQuestions.delete}
                      </button>
                    </form>
                  </div>
                </div>

                <div className="muted small">{q.description}</div>
                <div className="muted small">
                  <b>{t.admin.performanceQuestions.scale}:</b> {q.scale}
                </div>

                <details>
                  <summary style={{ cursor: "pointer" }}>{t.admin.performanceQuestions.edit}</summary>
                  <form className="stack" action={updatePerformanceQuestionAction} style={{ marginTop: 10 }}>
                    <input type="hidden" name="id" value={q.id} />
                    <div className="grid2">
                      <label className="field">
                        <span className="label">{t.admin.performanceQuestions.qNo}</span>
                        <input className="input" name="qNo" type="number" min={1} step={1} defaultValue={q.qNo} required />
                      </label>

                      <label className="field">
                        <span className="label">{t.admin.performanceQuestions.area}</span>
                        <input className="input" name="area" type="text" defaultValue={q.area} required />
                      </label>

                      <label className="field" style={{ gridColumn: "1 / -1" }}>
                        <span className="label">{t.admin.performanceQuestions.description}</span>
                        <textarea
                          className="input"
                          name="description"
                          rows={3}
                          style={{ resize: "vertical" }}
                          defaultValue={q.description}
                          required
                        />
                      </label>

                      <label className="field" style={{ gridColumn: "1 / -1" }}>
                        <span className="label">{t.admin.performanceQuestions.scale}</span>
                        <input className="input" name="scale" type="text" defaultValue={q.scale} required />
                      </label>
                    </div>

                    <button className="button button-secondary" type="submit">
                      {t.admin.performanceQuestions.update}
                    </button>
                  </form>
                </details>
              </div>
            ))}

            {questions.length === 0 ? <div className="muted">{t.admin.performanceQuestions.empty}</div> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
