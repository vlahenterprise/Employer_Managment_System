import Link from "next/link";
import { requireActiveUser } from "@/server/current-user";
import { getUserOrgStructure } from "@/server/org-structure";
import UserMenu from "../dashboard/UserMenu";
import OrgChart from "./OrgChart";
import { getRequestLang } from "@/i18n/server";
import { getI18n } from "@/i18n";
import { IconArrowLeft } from "@/components/icons";
import { hasAccessAdmin } from "@/server/rbac";

export default async function OrganizationPage() {
  const user = await requireActiveUser();
  const lang = getRequestLang();
  const t = getI18n(lang);

  const { nodes, globalLinks } = await getUserOrgStructure();

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
              matches: t.org.matches
            }}
          />
        </section>

      </div>
    </main>
  );
}
