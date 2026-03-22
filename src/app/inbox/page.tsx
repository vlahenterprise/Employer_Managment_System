import Link from "next/link";
import { LabelWithTooltip } from "@/components/Tooltip";
import { requireActiveUser } from "@/server/current-user";
import { getInboxData } from "@/server/inbox";
import { getRequestLang } from "@/i18n/server";
import UserMenu from "../dashboard/UserMenu";
import { IconArrowLeft, IconArrowRight, IconBolt, IconCheckCircle, IconClock } from "@/components/icons";

function copy(lang: "sr" | "en") {
  if (lang === "sr") {
    return {
      title: "Inbox",
      subtitle: "Sve što traži tvoju pažnju, dodeljene obaveze i poslednje promene.",
      back: "Dashboard",
      needsAction: "Needs My Action",
      assigned: "Assigned To Me",
      updates: "Recent Updates",
      empty: "Trenutno nema stavki.",
      open: "Otvori",
      needsActionHint: "Stavke koje traže tvoju odluku, odgovor ili sledeći korak.",
      assignedHint: "Stavke koje su ti trenutno dodeljene za rad ili praćenje.",
      updatesHint: "Nove informacije koje je dobro da vidiš, iako možda ne traže hitnu akciju."
    };
  }

  return {
    title: "Inbox",
    subtitle: "Everything that needs your attention, assignments, and recent updates.",
    back: "Dashboard",
    needsAction: "Needs My Action",
    assigned: "Assigned To Me",
    updates: "Recent Updates",
    empty: "Nothing to show right now.",
    open: "Open",
    needsActionHint: "Items that need your decision, response, or next step.",
    assignedHint: "Items currently assigned to you for follow-up or work.",
    updatesHint: "Recent changes that are useful to see even when they do not need immediate action."
  };
}

function toneIcon(tone: string) {
  if (tone === "warning") return <IconClock size={18} />;
  if (tone === "success") return <IconCheckCircle size={18} />;
  return <IconBolt size={18} />;
}

export default async function InboxPage() {
  const user = await requireActiveUser();
  const lang = getRequestLang();
  const c = copy(lang);
  const inbox = await getInboxData({
    id: user.id,
    email: user.email,
    role: user.role,
    hrAddon: user.hrAddon,
    adminAddon: user.adminAddon
  });

  const sections = [
    { title: c.needsAction, hint: c.needsActionHint, items: inbox.needsMyAction },
    { title: c.assigned, hint: c.assignedHint, items: inbox.assignedToMe },
    { title: c.updates, hint: c.updatesHint, items: inbox.recentUpdates }
  ];

  return (
    <main className="page">
      <div className="card stack">
        <div className="page-topbar">
          <div className="page-topbar-main">
            <div className="header">
              <div>
                <h1 className="brand-title">{c.title}</h1>
                <p className="muted">{c.subtitle}</p>
              </div>
              <Link className="button button-secondary" href="/dashboard">
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

        <div className="grid3 inbox-grid">
          {sections.map((section) => (
            <section key={section.title} className="panel stack">
              <div className="item-top">
                <h2 className="h2">
                  <LabelWithTooltip label={section.title} tooltip={section.hint} />
                </h2>
                <span className="pill">{section.items.length}</span>
              </div>
              <div className="list">
                {section.items.map((item) => (
                  <div key={item.id} className="item stack">
                    <div className="item-top">
                      <div className="inline">
                        <span className={`kpi-icon kpi-icon-${item.tone}`}>{toneIcon(item.tone)}</span>
                        <div>
                          <div className="item-title">{item.title}</div>
                          <div className="muted small">{item.description}</div>
                        </div>
                      </div>
                      {item.meta ? <span className="pill pill-status pill-status-muted">{item.meta}</span> : null}
                    </div>
                    <div className="inline">
                      <Link className="button button-secondary" href={item.href}>
                        {c.open} <IconArrowRight size={18} />
                      </Link>
                    </div>
                  </div>
                ))}
                {section.items.length === 0 ? <div className="muted small">{c.empty}</div> : null}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
