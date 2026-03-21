import Link from "next/link";
import { requireActiveUser } from "@/server/current-user";
import { getTalentPool } from "@/server/candidates";
import { getBrandingSettings } from "@/server/settings";
import { getRequestLang } from "@/i18n/server";
import UserMenu from "../dashboard/UserMenu";
import { IconArrowLeft, IconArrowRight } from "@/components/icons";

function copy(lang: "sr" | "en") {
  if (lang === "sr") {
    return {
      title: "Talent Pool",
      subtitle: "Sačuvani kandidati koje možemo brzo vratiti u aktivan hiring proces.",
      back: "HR System",
      empty: "Još nema kandidata u talent pool-u."
    };
  }
  return {
    title: "Talent Pool",
    subtitle: "Saved candidates that can be reused in a future hiring process.",
    back: "HR System",
    empty: "No candidates in the talent pool yet."
  };
}

export default async function TalentPoolPage({
  searchParams
}: {
  searchParams: { tag?: string };
}) {
  const user = await requireActiveUser();
  const branding = await getBrandingSettings();
  const lang = getRequestLang();
  const c = copy(lang);
  const pool = await getTalentPool({ id: user.id, role: user.role, hrAddon: user.hrAddon }, searchParams.tag);

  if (!pool.ok) {
    return (
      <main className="page">
        <div className="card stack">
          <div className="error">No access.</div>
        </div>
      </main>
    );
  }

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
                  <h1 className="brand-title">{c.title}</h1>
                  <p className="muted">{c.subtitle}</p>
                </div>
              </div>
              <Link className="button button-secondary" href="/hr">
                <IconArrowLeft size={18} /> {c.back}
              </Link>
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

        <section className="panel stack">
          <div className="list">
            {pool.items.map((candidate) => {
              const latest = candidate.applications[0] || null;
              return (
                <div key={candidate.id} className="item item-compact">
                  <div>
                    <div className="item-title">{candidate.fullName}</div>
                    <div className="muted small">
                      {candidate.talentPoolTag || "—"} · {candidate.source || "—"} · {latest?.process.positionTitle || "—"}
                    </div>
                    <div className="muted small">{latest?.closedReason || "Reusable from candidate base."}</div>
                  </div>
                  <div className="inline">
                    <Link className="button button-secondary" href={`/candidates/${candidate.id}`}>
                      Open <IconArrowRight size={18} />
                    </Link>
                  </div>
                </div>
              );
            })}
            {pool.items.length === 0 ? <div className="muted small">{c.empty}</div> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
