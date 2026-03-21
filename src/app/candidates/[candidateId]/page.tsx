import Link from "next/link";
import { LabelWithTooltip } from "@/components/Tooltip";
import { requireActiveUser } from "@/server/current-user";
import { getCandidateDetail } from "@/server/candidates";
import { getBrandingSettings } from "@/server/settings";
import { getRequestLang } from "@/i18n/server";
import UserMenu from "../../dashboard/UserMenu";
import { IconArrowLeft, IconArrowRight, IconCalendar, IconPdf, IconUsers } from "@/components/icons";
import { getCandidateStageMeta } from "@/server/recruiting-presentation";

function copy(lang: "sr" | "en") {
  if (lang === "sr") {
    return {
      back: "Candidates",
      noAccess: "Detalj kandidata nije dostupan.",
      openCv: "Otvori CV link",
      profileTitle: "Profil kandidata",
      profileHint: "Osnovni kontakt podaci, izvor kandidata i poslednji signal da li vredi čuvati kandidata za buduće procese.",
      history: "Istorija prijava",
      historyHint: "Svaka prijava pokazuje tok kroz HR proces, preporuke iz rundi i sledeći korak.",
      comments: "Komentari i preporuke",
      noData: "Nema podataka.",
      email: "Email",
      phone: "Telefon",
      source: "Izvor",
      talentTag: "Talent pool tag",
      lastContact: "Poslednji kontakt",
      position: "Pozicija",
      team: "Tim",
      nextAction: "Sledeći korak",
      hr: "HR komentar",
      round1: "Prvi krug",
      round2: "Drugi krug",
      final: "Finalni komentar",
      stage: "Faza",
      updated: "Poslednja izmena",
      openProcess: "Otvori proces",
      summaryTitle: "Trenutni fokus",
      summaryHint: "Na vrhu vidiš gde je kandidat sada i koja je najvažnija naredna odluka.",
      noValue: "—"
    };
  }
  return {
    back: "Candidates",
    noAccess: "Candidate detail is not available.",
    openCv: "Open CV link",
    profileTitle: "Candidate profile",
    profileHint: "Basic contact details, source, and the latest signal on whether this candidate should stay reusable later.",
    history: "Application history",
    historyHint: "Each application shows the HR flow, round feedback, and the next practical action.",
    comments: "Comments and recommendations",
    noData: "No data.",
    email: "Email",
    phone: "Phone",
    source: "Source",
    talentTag: "Talent pool tag",
    lastContact: "Last contact",
    position: "Position",
    team: "Team",
    nextAction: "Next action",
    hr: "HR comment",
    round1: "Round 1",
    round2: "Round 2",
    final: "Final comment",
    stage: "Stage",
    updated: "Last update",
    openProcess: "Open process",
    summaryTitle: "Current focus",
    summaryHint: "See where the candidate is now and what the next important decision should be.",
    noValue: "—"
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
  const latestApplication = candidate.applications[0] || null;
  const latestStage = getCandidateStageMeta(latestApplication?.status, lang);

  return (
    <main className="page">
      <div className="card stack">
        <div className="page-topbar">
          <div className="page-topbar-main stack">
            <div className="header">
              <div className="brand">
                {branding.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="brand-logo" src={branding.logoUrl} alt={branding.title} />
                ) : null}
                <div>
                  <h1 className="brand-title">{candidate.fullName}</h1>
                  <p className="muted">{candidate.email || candidate.phone || c.noValue}</p>
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

            <div className="notice notice-info">
              <div className="notice-icon">
                <IconUsers size={18} />
              </div>
              <div className="stack">
                <div className="notice-title">{c.summaryTitle}</div>
                <div className="muted small">{c.summaryHint}</div>
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

        <div className="grid3 profile-metrics">
          <div className="item item-compact kpi-card">
            <div className="kpi-icon">
              <IconUsers size={18} />
            </div>
            <div>
              <div className="kpi-value">{candidate.applications.length}</div>
              <div className="kpi-label">{c.history}</div>
            </div>
          </div>
          <div className="item item-compact kpi-card">
            <div className="kpi-icon">
              <IconCalendar size={18} />
            </div>
            <div>
              <div className="kpi-value">{latestStage.label}</div>
              <div className="kpi-label">{c.stage}</div>
            </div>
          </div>
          <div className="item item-compact kpi-card">
            <div className="kpi-icon">
              <IconArrowRight size={18} />
            </div>
            <div>
              <div className="kpi-value">{latestApplication?.nextAction || c.noValue}</div>
              <div className="kpi-label">{c.nextAction}</div>
            </div>
          </div>
        </div>

        <div className="grid3 profile-summary-grid">
          <section className="panel stack">
            <div className="section-head">
              <div className="section-copy">
                <h2 className="h2">
                  <LabelWithTooltip label={c.profileTitle} tooltip={c.profileHint} />
                </h2>
              </div>
              <span className={`pill pill-status pill-status-${latestStage.tone}`}>{latestStage.label}</span>
            </div>
            <div className="detail-list detail-list-compact">
              <div><strong>{c.email}:</strong> {candidate.email || c.noValue}</div>
              <div><strong>{c.phone}:</strong> {candidate.phone || c.noValue}</div>
              <div><strong>{c.source}:</strong> {candidate.source || c.noValue}</div>
              <div><strong>{c.talentTag}:</strong> {candidate.talentPoolTag || c.noValue}</div>
              <div><strong>{c.lastContact}:</strong> {formatDate(candidate.lastContactAt, locale)}</div>
              <div><strong>{c.updated}:</strong> {formatDate(candidate.updatedAt, locale)}</div>
            </div>
          </section>

          <section className="panel stack profile-wide">
            <div className="section-head">
              <div className="section-copy">
                <h2 className="h2">
                  <LabelWithTooltip label={c.history} tooltip={c.historyHint} />
                </h2>
              </div>
            </div>
            <div className="list">
              {candidate.applications.map((application) => {
                const stage = getCandidateStageMeta(application.status, lang);
                return (
                  <div key={application.id} className="item stack entity-card">
                    <div className="item-top">
                      <div className="stack">
                        <div className="item-title">{application.process.positionTitle}</div>
                        <div className="muted small">
                          {application.process.team?.name || c.noValue} · {formatDate(application.appliedAt, locale)}
                        </div>
                      </div>
                      <div className="inline">
                        <span className={`pill pill-status pill-status-${stage.tone}`}>{stage.label}</span>
                        <Link className="button button-secondary" href={`/hr/${application.process.id}`}>
                          {c.openProcess} <IconArrowRight size={18} />
                        </Link>
                      </div>
                    </div>

                    <div className="detail-list detail-list-compact">
                      <div><strong>{c.position}:</strong> {application.process.positionTitle}</div>
                      <div><strong>{c.team}:</strong> {application.process.team?.name || c.noValue}</div>
                      <div><strong>{c.nextAction}:</strong> {application.nextAction || c.noValue}</div>
                      <div><strong>{c.hr}:</strong> {application.hrComment || c.noValue}</div>
                      <div><strong>{c.round1}:</strong> {application.firstRoundComment || c.noValue}</div>
                      <div><strong>{c.round2}:</strong> {application.managerComment || c.noValue}</div>
                      <div><strong>{c.final}:</strong> {application.finalComment || c.noValue}</div>
                    </div>

                    <div className="list hr-mini-list timeline-list">
                      {application.comments.map((comment) => (
                        <div key={comment.id} className="item stack timeline-item">
                          <div className="muted small">
                            {comment.stage} · {comment.actor?.name || c.noValue} · {formatDate(comment.createdAt, locale)}
                          </div>
                          <div>{comment.body}</div>
                        </div>
                      ))}
                      {application.comments.length === 0 ? <div className="muted small">{c.noData}</div> : null}
                    </div>
                  </div>
                );
              })}
              {candidate.applications.length === 0 ? <div className="muted small">{c.noData}</div> : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
