import Link from "next/link";
import { requireActiveUser } from "@/server/current-user";
import { getUserOrgStructure } from "@/server/org-structure";
import UserMenu from "../dashboard/UserMenu";
import OrgChart from "./OrgChart";
import { getRequestLang } from "@/i18n/server";
import { getI18n } from "@/i18n";
import { IconArrowLeft } from "@/components/icons";
import { hasAccessAdmin } from "@/server/rbac";
import { GuidancePanel } from "@/components/GuidancePanel";

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

        <GuidancePanel
          title={lang === "sr" ? "Kako da koristiš ORG System" : "How to use ORG System"}
          description={
            lang === "sr"
              ? "ORG System je mapa kompanije i centar za opise poslova, instrukcije i procese vezane za pozicije."
              : "ORG System is the company map and the hub for job descriptions, instructions, and position-related processes."
          }
          items={
            lang === "sr"
              ? [
                  "Koristi pretragu za ljude, pozicije, dokumenta i instrukcije.",
                  "Klik na poziciju otvara desni panel sa ljudima, hijerarhijom i Drive linkovima.",
                  "Zoom i full screen su tu kada želiš da pregledaš celu strukturu bez gužve."
                ]
              : [
                  "Use search for people, positions, documents, and instructions.",
                  "Click a position to open the side panel with people, hierarchy, and Drive links.",
                  "Use zoom and full screen when you want to inspect the full structure without clutter."
                ]
          }
          tone="neutral"
        />

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
              director: t.org.director,
              manager: t.org.manager,
              lead: t.org.lead,
              supervisor: t.org.supervisor,
              staff: t.org.staff,
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
              levelOverview: t.org.levelOverview,
              fitToScreen: t.org.fitToScreen,
              fullscreen: t.org.fullscreen,
              exitFullscreen: t.org.exitFullscreen,
              jumpToLevel: t.org.jumpToLevel,
              reportsTo: t.org.reportsTo,
              directReports: t.org.directReports,
              linkedDocuments: t.org.linkedDocuments,
              childPositions: t.org.childPositions,
              hierarchyPath: t.org.hierarchyPath,
              selectedLevel: t.org.selectedLevel,
              noChildren: t.org.noChildren,
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
