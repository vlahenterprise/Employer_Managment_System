import Link from "next/link";
import { requireActiveUser } from "@/server/current-user";
import { getUserOrgStructure } from "@/server/org-structure";
import UserMenu from "../dashboard/UserMenu";
import OrgChart from "./OrgChart";
import { getRequestLang } from "@/i18n/server";
import { getI18n } from "@/i18n";
import { IconArrowLeft } from "@/components/icons";
import { hasAccessAdmin } from "@/server/rbac";

export default async function OrganizationPage({
  searchParams
}: {
  searchParams?: { focus?: string };
}) {
  const user = await requireActiveUser();
  const lang = getRequestLang();
  const t = getI18n(lang);

  const { nodes, globalLinks } = await getUserOrgStructure();
  const initialSelectedId = searchParams?.focus && nodes.some((node) => node.id === searchParams.focus) ? searchParams.focus : null;

  return (
    <main className="page">
      <div className="card stack">
        <div className="page-topbar">
          <div className="page-topbar-main">
            <div className="header">
              <div>
                <h1 className="brand-title">{t.org.title}</h1>
                <p className="muted">{t.org.subtitle}</p>
              </div>
              <div className="inline">
                <Link className="button button-secondary" href="/dashboard">
                  <IconArrowLeft size={18} /> {t.common.backToDashboard}
                </Link>
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

        <section className="panel stack">
          <OrgChart
            nodes={nodes}
            globalLinks={globalLinks}
            canEdit={hasAccessAdmin(user)}
            initialSelectedId={initialSelectedId}
            labels={{
              people: t.org.people,
              noAssignees: t.org.noAssignees,
              select: t.org.select,
              edit: t.org.edit,
              manageHint: t.org.manageHint,
              search: t.org.search,
              searchHelp: t.org.searchHelp,
              searchPlaceholder: t.org.searchPlaceholder,
              searchHint: t.org.searchHint,
              clearSearch: t.org.clearSearch,
              noSearchResults: t.org.noSearchResults,
              executive: t.org.executive,
              manager: t.org.manager,
              lead: t.org.lead,
              employee: t.org.employee,
              jobDescription: t.org.jobDescription,
              workInstructions: t.org.workInstructions,
              positionProcesses: t.org.positionProcesses,
              positionInstructions: t.org.positionInstructions,
              globalProcesses: t.org.globalProcesses,
              globalInstructions: t.org.globalInstructions,
              noDocuments: t.org.noDocuments,
              peopleHelp: t.org.peopleHelp,
              documentsHelp: t.org.documentsHelp,
              openDocument: t.org.openDocument,
              globalResources: t.org.globalResources,
              matches: t.org.matches,
              zoomIn: t.org.zoomIn,
              zoomOut: t.org.zoomOut,
              zoomReset: t.org.zoomReset,
              zoomHelp: t.org.zoomHelp,
              levelLegend: t.org.levelLegend,
              fitToScreen: t.org.fitToScreen,
              fullscreen: t.org.fullscreen,
              exitFullscreen: t.org.exitFullscreen,
              jumpToLevel: t.org.jumpToLevel,
              reportsTo: t.org.reportsTo,
              directReports: t.org.directReports,
              linkedDocuments: t.org.linkedDocuments,
              childPositions: t.org.childPositions,
              noParent: t.org.noParent,
              quickSummary: t.org.quickSummary,
              relatedResources: t.org.relatedResources
            }}
          />
        </section>

      </div>
    </main>
  );
}
