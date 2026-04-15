import Link from "next/link";
import { requireAdminUser } from "@/server/current-user";
import { prisma } from "@/server/db";
import { getRequestLang } from "@/i18n/server";
import { IconArrowLeft } from "@/components/icons";

function copy(lang: "sr" | "en") {
  if (lang === "sr") {
    return {
      title: "Audit Log",
      subtitle: "Pregled svih akcija u sistemu — promene taskova, odsustva i korisnika.",
      back: "Admin",
      filterAll: "Sve",
      filterTask: "Taskovi",
      filterAbsence: "Odsustva",
      filterUser: "Korisnici",
      noData: "Nema zabeleženih akcija.",
      colDate: "Datum",
      colActor: "Korisnik",
      colAction: "Akcija",
      colEntity: "Entitet",
      colDetail: "Detalj"
    };
  }
  return {
    title: "Audit Log",
    subtitle: "All system actions — task changes, absences, and user management.",
    back: "Admin",
    filterAll: "All",
    filterTask: "Tasks",
    filterAbsence: "Absence",
    filterUser: "Users",
    noData: "No actions recorded.",
    colDate: "Date",
    colActor: "User",
    colAction: "Action",
    colEntity: "Entity",
    colDetail: "Detail"
  };
}

type FilterType = "all" | "task" | "absence" | "performance";

async function getAuditEntries(type: FilterType, page: number) {
  const take = 50;
  const skip = (page - 1) * take;

  if (type === "task" || type === "all") {
    const taskEvents = await prisma.taskEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: type === "task" ? take : 25,
      skip: type === "task" ? skip : 0,
      select: {
        id: true,
        action: true,
        actorEmail: true,
        actorName: true,
        comment: true,
        createdAt: true,
        task: { select: { id: true, title: true } }
      }
    });

    if (type === "task") {
      return taskEvents.map((e) => ({
        id: e.id,
        type: "TASK" as const,
        action: e.action,
        actorEmail: e.actorEmail,
        actorName: e.actorName,
        entityLabel: e.task?.title ?? "—",
        detail: e.comment ?? "—",
        createdAt: e.createdAt
      }));
    }
  }

  if (type === "absence" || type === "all") {
    const absenceEvents = await prisma.absenceEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: type === "absence" ? take : 25,
      skip: type === "absence" ? skip : 0,
      select: {
        id: true,
        action: true,
        actorEmail: true,
        actorName: true,
        comment: true,
        createdAt: true,
        absence: { select: { id: true, type: true } }
      }
    });

    if (type === "absence") {
      return absenceEvents.map((e) => ({
        id: e.id,
        type: "ABSENCE" as const,
        action: e.action,
        actorEmail: e.actorEmail,
        actorName: e.actorName,
        entityLabel: e.absence?.type ?? "—",
        detail: e.comment ?? "—",
        createdAt: e.createdAt
      }));
    }
  }

  // type === "all" - combine both
  const [taskEvents, absenceEvents] = await Promise.all([
    prisma.taskEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      skip: 0,
      select: {
        id: true,
        action: true,
        actorEmail: true,
        actorName: true,
        comment: true,
        createdAt: true,
        task: { select: { id: true, title: true } }
      }
    }),
    prisma.absenceEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      skip: 0,
      select: {
        id: true,
        action: true,
        actorEmail: true,
        actorName: true,
        comment: true,
        createdAt: true,
        absence: { select: { id: true, type: true } }
      }
    })
  ]);

  const allEntries = [
    ...taskEvents.map((e) => ({
      id: e.id,
      type: "TASK" as const,
      action: e.action,
      actorEmail: e.actorEmail,
      actorName: e.actorName,
      entityLabel: e.task?.title ?? "—",
      detail: e.comment ?? "—",
      createdAt: e.createdAt
    })),
    ...absenceEvents.map((e) => ({
      id: e.id,
      type: "ABSENCE" as const,
      action: e.action,
      actorEmail: e.actorEmail,
      actorName: e.actorName,
      entityLabel: e.absence?.type ?? "—",
      detail: e.comment ?? "—",
      createdAt: e.createdAt
    }))
  ];

  return allEntries
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(skip, skip + take);
}

export default async function AuditLogPage({
  searchParams
}: {
  searchParams: { type?: string; page?: string };
}) {
  await requireAdminUser();
  const lang = getRequestLang();
  const c = copy(lang);

  const type = (["task", "absence", "performance"].includes(searchParams.type ?? "")
    ? searchParams.type
    : "all") as FilterType;
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10));

  const entries = await getAuditEntries(type, page);

  function buildUrl(params: Record<string, string>) {
    const base = new URLSearchParams({ type, page: String(page) });
    Object.entries(params).forEach(([k, v]) => base.set(k, v));
    return `/admin/audit-log?${base.toString()}`;
  }

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
              <Link className="button button-secondary" href="/admin/users">
                <IconArrowLeft size={18} /> {c.back}
              </Link>
            </div>
          </div>
        </div>

        {/* Filter */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {(["all", "task", "absence"] as const).map((t) => (
            <Link
              key={t}
              href={buildUrl({ type: t, page: "1" })}
              className={`button ${type === t ? "button-primary" : "button-secondary"}`}
            >
              {t === "all" ? c.filterAll : t === "task" ? c.filterTask : c.filterAbsence}
            </Link>
          ))}
        </div>

        {/* Table */}
        <div className="table-scroll">
          <table className="data-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>{c.colDate}</th>
                <th>{c.colActor}</th>
                <th>{c.colAction}</th>
                <th>{c.colEntity}</th>
                <th className="hide-mobile">{c.colDetail}</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "24px" }} className="muted">
                    {c.noData}
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id}>
                    <td style={{ whiteSpace: "nowrap", fontSize: "13px" }} className="muted">
                      {entry.createdAt.toISOString().replace("T", " ").slice(0, 16)}
                    </td>
                    <td>
                      <div style={{ fontSize: "14px" }}>{entry.actorName}</div>
                      <div style={{ fontSize: "12px" }} className="muted">{entry.actorEmail}</div>
                    </td>
                    <td>
                      <span className="pill pill-status" style={{ fontSize: "12px" }}>
                        {entry.type}
                      </span>
                      <span style={{ marginLeft: "6px", fontSize: "13px" }}>{entry.action}</span>
                    </td>
                    <td style={{ fontSize: "13px", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {entry.entityLabel}
                    </td>
                    <td className="hide-mobile muted" style={{ fontSize: "12px", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {entry.detail}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", flexWrap: "wrap" }}>
          {page > 1 && (
            <Link href={buildUrl({ page: String(page - 1) })} className="button button-secondary">
              ← Prethodna
            </Link>
          )}
          {entries.length === 50 && (
            <Link href={buildUrl({ page: String(page + 1) })} className="button button-secondary">
              Sledeća →
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
