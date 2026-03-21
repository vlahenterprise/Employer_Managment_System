import AdminShell from "@/components/AdminShell";
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

export default async function AdminPerformanceQuestionsPage({
  searchParams
}: {
  searchParams: { success?: string; error?: string };
}) {
  const user = await requireAdminUser();
  const lang = getRequestLang();
  const t = getI18n(lang);

  const questions = await prisma.performanceQuestion.findMany({
    orderBy: [{ qNo: "asc" }],
    select: { id: true, qNo: true, area: true, description: true, scale: true, isActive: true, updatedAt: true }
  });

  const success = searchParams.success ? decodeURIComponent(searchParams.success) : null;
  const error = searchParams.error ? decodeURIComponent(searchParams.error) : null;

  return (
    <AdminShell
      user={user}
      lang={lang}
      title={t.admin.tabs.performanceQuestions}
      subtitle={t.admin.performanceQuestions.subtitle}
      activeTab="performanceQuestions"
      success={success}
      error={error}
      note={
        lang === "sr"
          ? "Ovo su sekcije za personal evaluation. Tekstovi mogu biti dvojezični, ali scoring logika ostaje ista kroz ceo sistem."
          : "These define the personal evaluation sections. Text can be bilingual, while the scoring logic stays identical across the system."
      }
    >

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
    </AdminShell>
  );
}
