import Link from "next/link";
import { requireActiveUser } from "@/server/current-user";
import { getCandidateDetail } from "@/server/candidates";
import { getBrandingSettings } from "@/server/settings";
import { getRequestLang } from "@/i18n/server";
import UserMenu from "../../dashboard/UserMenu";
import { IconArrowLeft, IconArrowRight, IconPdf } from "@/components/icons";

function copy(lang: "sr" | "en") {
  if (lang === "sr") {
    return {
      back: "Candidates",
      noAccess: "Detalj kandidata nije dostupan.",
      openCv: "Open CV link",
      history: "Application History",
      comments: "Comments & recommendations",
      noData: "Nema podataka."
    };
  }
  return {
    back: "Candidates",
    noAccess: "Candidate detail is not available.",
    openCv: "Open CV link",
    history: "Application History",
    comments: "Comments & recommendations",
    noData: "No data."
  };
}

function formatDate(value: Date | null | undefined, locale: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(value);
}

export default async function CandidateDetailPage({
  params
}: {
  params: { candidateId: string };
}) {
  const user = await requireActiveUser();
  const branding = await getBrandingSettings();
  const lang = getRequestLang();
  const c = copy(lang);
  const locale = lang === "sr" ? "sr-RS" : "en-GB";
  const data = await getCandidateDetail({ id: user.id, role: user.role, hrAddon: user.hrAddon }, params.candidateId);

  if (!data.ok) {
    return (
      <main className="page">
        <div className="card stack">
          <div className="error">{c.noAccess}</div>
        </div>
      </main>
    );
  }

  const candidate = data.candidate;
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
                  <h1 className="brand-title">{candidate.fullName}</h1>
                  <p className="muted">{candidate.email || candidate.phone || "—"}</p>
                </div>
              </div>
              <div className="inline">
                <Link className="button button-secondary" href="/candidates">
                  <IconArrowLeft size={18} /> {c.back}
                </Link>
                {candidate.cvDriveUrl ? (
                  <a className="button" href={candidate.cvDriveUrl} target="_blank" rel="noreferrer">
                    <IconPdf size={18} /> {c.openCv}
                  </a>
                ) : null}
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

        <div className="grid3 profile-summary-grid">
          <section className="panel stack">
            <h2 className="h2">Candidate</h2>
            <div className="detail-list">
              <div><strong>Email:</strong> {candidate.email || "—"}</div>
              <div><strong>Phone:</strong> {candidate.phone || "—"}</div>
              <div><strong>Source:</strong> {candidate.source || "—"}</div>
              <div><strong>Talent pool tag:</strong> {candidate.talentPoolTag || "—"}</div>
              <div><strong>Last contact:</strong> {formatDate(candidate.lastContactAt, locale)}</div>
            </div>
          </section>

          <section className="panel stack profile-wide">
            <h2 className="h2">{c.history}</h2>
            <div className="list">
              {candidate.applications.map((application) => (
                <div key={application.id} className="item stack">
                  <div className="item-top">
                    <div>
                      <div className="item-title">{application.process.positionTitle}</div>
                      <div className="muted small">
                        {application.process.team?.name || "—"} · {application.status} · {formatDate(application.appliedAt, locale)}
                      </div>
                    </div>
                    <Link className="button button-secondary" href={`/hr/${application.process.id}`}>
                      Open process <IconArrowRight size={18} />
                    </Link>
                  </div>
                  <div className="detail-list">
                    <div><strong>Next action:</strong> {application.nextAction || "—"}</div>
                    <div><strong>HR:</strong> {application.hrComment || "—"}</div>
                    <div><strong>Round 1:</strong> {application.firstRoundComment || "—"}</div>
                    <div><strong>Round 2:</strong> {application.managerComment || "—"}</div>
                    <div><strong>Final:</strong> {application.finalComment || "—"}</div>
                  </div>
                  <div className="list hr-mini-list">
                    {application.comments.map((comment) => (
                      <div key={comment.id} className="item stack">
                        <div className="muted small">
                          {comment.stage} · {comment.actor?.name || "—"} · {formatDate(comment.createdAt, locale)}
                        </div>
                        <div>{comment.body}</div>
                      </div>
                    ))}
                    {application.comments.length === 0 ? <div className="muted small">{c.noData}</div> : null}
                  </div>
                </div>
              ))}
              {candidate.applications.length === 0 ? <div className="muted small">{c.noData}</div> : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
