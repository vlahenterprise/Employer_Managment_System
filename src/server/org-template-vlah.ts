import { prisma } from "@/server/db";
import { normalizeOrgSearchText } from "@/lib/org-system";
import type { OrgNodeKind, OrgPositionTier, Prisma } from "@prisma/client";

type OrgTemplateNode = {
  key: string;
  title: string;
  description: string;
  order: number;
  tier: OrgPositionTier;
  kind?: OrgNodeKind;
  teamName?: string;
  teamAliases?: string[];
  aliases?: string[];
  children?: OrgTemplateNode[];
};

type ImportOrgTemplateResult = {
  skippedExisting: boolean;
  positionsCreated: number;
  positionsUpdated: number;
  positionsDeactivated: number;
  teamsCreated: number;
  teamsUpdated: number;
  assignmentsCreated: number;
  missingUsers: string[];
};

const VLAH_ORG_TEMPLATE: OrgTemplateNode[] = [
  {
    key: "ceo",
    title: "CEO",
    aliases: ["Generalni direktor"],
    description: "Najviši izvršni nivo kompanije i krajnji vlasnik strateškog pravca, prioriteta i ključnih odluka.",
    tier: "DIRECTOR",
    teamName: "Executive",
    order: 0,
    children: [
      {
        key: "co-ceo",
        title: "CO-CEO",
        description: "Izvršni partner CEO funkcije za strateško usklađivanje i podršku ključnim odlukama kompanije.",
        tier: "DIRECTOR",
        teamName: "Executive",
        order: 5
      },
      {
        key: "office-operations-team",
        title: "Office Operations",
        description: "Tim za kancelarijske operacije, objekat, vozila, kuhinju i internu logistiku.",
        tier: "STAFF",
        kind: "TEAM",
        teamName: "Office Operations",
        order: 10,
        children: [
          {
            key: "office-operational-specialist",
            title: "Office Operational Specialist",
            aliases: ["Specijalista za kancelarijske operacije"],
            description: "Koordinira kancelarijske operacije, logistiku i svakodnevnu operativnu podršku office funkciji.",
            tier: "STAFF",
            teamName: "Office Operations",
            order: 10,
            children: [
              {
                key: "office-facility-supervisor",
                title: "Office & Facility Supervisor",
                aliases: ["Supervizor kancelarije i objekta"],
                description: "Nadzire kancelariju, objekat, osnovnu logistiku i radne uslove u office/facility delu.",
                tier: "SUPERVISOR",
                teamName: "Office Operations",
                order: 10,
                children: [
                  {
                    key: "facility-vehicle-operational-technician",
                    title: "Facility & Vehicle Operational Technician",
                    aliases: ["Tehničar za održavanje objekta i vozila"],
                    description: "Operativno održava objekat, vozila i tehničke resurse koji podržavaju svakodnevni rad.",
                    tier: "STAFF",
                    teamName: "Office Operations",
                    order: 10
                  },
                  {
                    key: "office-kitchen-assistant",
                    title: "Office & Kitchen Assistant",
                    aliases: ["Asistent za kancelariju i kuhinju"],
                    description: "Pruža podršku kancelariji, kuhinji i zajedničkim prostorima kroz svakodnevne operativne zadatke.",
                    tier: "STAFF",
                    teamName: "Office Operations",
                    order: 20
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        key: "operational-manager",
        title: "Operational Manager",
        aliases: ["Direktor operacija", "Menadžer operacija", "Operations Director"],
        description: "Operativni direktor po funkciji, ali hijerarhijski menadžer ispod CEO; vodi operativne timove i svakodnevno izvršenje poslovanja.",
        tier: "MANAGER",
        teamName: "Operations",
        teamAliases: ["Operations Team"],
        order: 20,
        children: [
          {
            key: "business-operations-team",
            title: "Business Operations",
            description: "Tim za operativnu podršku poslovanju i koordinaciju svakodnevnih tokova.",
            tier: "STAFF",
            kind: "TEAM",
            teamName: "Business Operations",
            order: 10,
            children: [
              {
                key: "business-operational-specialist",
                title: "Business Operational Specialist",
                aliases: ["Specijalista za poslovne operacije"],
                description: "Podržava operativne tokove, koordinaciju posla i svakodnevnu organizaciju poslovanja.",
                tier: "STAFF",
                teamName: "Business Operations",
                order: 10,
                children: [
                  {
                    key: "office-assistant",
                    title: "Office Assistant",
                    description: "Administrativna i logistička podrška kancelariji, operacijama i internim tokovima.",
                    tier: "STAFF",
                    teamName: "Business Operations",
                    order: 10
                  }
                ]
              }
            ]
          },
          {
            key: "finance-administration-team",
            title: "Finance & Administration",
            description: "Tim za finansije, administraciju i prateće finansijsko-operativne procese.",
            tier: "STAFF",
            kind: "TEAM",
            teamName: "Finance & Administration",
            order: 20,
            children: [
              {
                key: "finance-administration-leader",
                title: "Finance & Administration Leader",
                aliases: ["Rukovodilac finansija i administracije"],
                description: "Vodi finansijske tokove, administraciju i operativnu podršku finansijskog sektora.",
                tier: "LEAD",
                teamName: "Finance & Administration",
                order: 10,
                children: [
                  {
                    key: "financial-specialist",
                    title: "Financial Specialist",
                    aliases: ["Finansijski specijalista"],
                    description: "Radi na finansijskim evidencijama, analizama i operativnoj finansijskoj podršci.",
                    tier: "STAFF",
                    teamName: "Finance & Administration",
                    order: 10,
                    children: [
                      {
                        key: "accountant",
                        title: "Accountant",
                        aliases: ["Računovođa"],
                        description: "Vodi računovodstvene tokove, evidencije i usklađenost finansijske dokumentacije.",
                        tier: "STAFF",
                        teamName: "Finance & Administration",
                        order: 10,
                        children: [
                          {
                            key: "financial-assistant",
                            title: "Financial Assistant",
                            aliases: ["Finansijski asistent"],
                            description: "Pruža administrativnu i operativnu podršku finansijskim aktivnostima.",
                            tier: "STAFF",
                            teamName: "Finance & Administration",
                            order: 10
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          },
          {
            key: "customer-care-sales-team",
            title: "Customer Care Projects & Sales",
            description: "Tim za korisničku podršku, projekte i prodajne aktivnosti prema klijentima.",
            tier: "STAFF",
            kind: "TEAM",
            teamName: "Customer Care Projects & Sales",
            order: 30,
            children: [
              {
                key: "customer-care-projects-sales-lead",
                title: "Customer Care Projects & Sales Lead",
                aliases: ["Rukovodilac korisničke podrške i prodaje"],
                description: "Vodi prodajne tokove, klijentske projekte i korisničku podršku.",
                tier: "LEAD",
                teamName: "Customer Care Projects & Sales",
                order: 10,
                children: [
                  {
                    key: "customer-care-specialist",
                    title: "Customer Care Specialist",
                    aliases: ["Specijalista za korisničku podršku i administraciju"],
                    description: "Operativna podrška korisnicima, administraciji i komunikaciji sa klijentima.",
                    tier: "STAFF",
                    teamName: "Customer Care Projects & Sales",
                    order: 10
                  }
                ]
              }
            ]
          },
          {
            key: "master-mind-sales-team",
            title: "Master Mind & Sales",
            description: "Tim za Master Mind programe, članove programa i prodajne aktivnosti.",
            tier: "STAFF",
            kind: "TEAM",
            teamName: "Master Mind & Sales",
            order: 40,
            children: [
              {
                key: "master-mind-sales-lead",
                title: "Master Mind & Sales Lead",
                aliases: ["Rukovodilac MasterMind programa i prodaje"],
                description: "Vodi Master Mind programe, prodajni tok i razvoj odnosa sa članovima programa.",
                tier: "LEAD",
                teamName: "Master Mind & Sales",
                order: 10,
                children: [
                  {
                    key: "master-mind-specialist",
                    title: "Master Mind Specialist",
                    aliases: ["Specijalista za prodaju i MasterMind programe"],
                    description: "Radi na prodaji programa, komunikaciji sa leadovima i podršci članovima.",
                    tier: "STAFF",
                    teamName: "Master Mind & Sales",
                    order: 10
                  }
                ]
              }
            ]
          },
          {
            key: "marketing-team",
            title: "Marketing",
            description: "Tim za marketing, brend, sadržaj, dizajn i performance oglašavanje.",
            tier: "STAFF",
            kind: "TEAM",
            teamName: "Marketing",
            order: 50,
            children: [
              {
                key: "marketing-leader",
                title: "Marketing Leader",
                aliases: ["Rukovodilac marketinga"],
                description: "Odgovoran za marketing strategiju, sadržaj, brend i performance oglašavanje.",
                tier: "LEAD",
                teamName: "Marketing",
                order: 10,
                children: [
                  {
                    key: "designer",
                    title: "Designer",
                    aliases: ["Dizajner"],
                    description: "Kreira vizuelni dizajn materijala, kampanja i podržava vizuelni identitet kompanije.",
                    tier: "STAFF",
                    teamName: "Marketing",
                    order: 10,
                    children: [
                      {
                        key: "performance-ads-specialist",
                        title: "Performance ADS Specialist",
                        aliases: ["Specijalista za performance oglašavanje"],
                        description: "Vodi performance kampanje, optimizaciju oglasa i merenje rezultata.",
                        tier: "STAFF",
                        teamName: "Marketing",
                        order: 10
                      }
                    ]
                  },
                  {
                    key: "brand-specialist",
                    title: "Brand Specialist",
                    aliases: ["Specijalista za brend"],
                    description: "Održava brend standarde, identitet i doslednost komunikacije kompanije.",
                    tier: "STAFF",
                    teamName: "Marketing",
                    order: 20,
                    children: [
                      {
                        key: "copy-content-writer",
                        title: "Copy Content Writer",
                        aliases: ["Specijalista za marketinški tekst"],
                        description: "Piše marketinške tekstove, prodajne poruke i copy za kampanje i sadržaj.",
                        tier: "STAFF",
                        teamName: "Marketing",
                        order: 10
                      }
                    ]
                  },
                  {
                    key: "content-supervisor",
                    title: "Content Supervisor",
                    aliases: ["Supervizor sadržaja"],
                    description: "Koordinira produkciju sadržaja i osigurava kvalitet isporuke sadržajnog tima.",
                    tier: "SUPERVISOR",
                    teamName: "Marketing",
                    order: 30,
                    children: [
                      {
                        key: "content-creator",
                        title: "Content Creator",
                        aliases: ["Kreator sadržaja"],
                        description: "Kreira sadržaj za interne i eksterne kanale komunikacije.",
                        tier: "STAFF",
                        teamName: "Marketing",
                        order: 10
                      }
                    ]
                  }
                ]
              }
            ]
          },
          {
            key: "legal-team",
            title: "Legal",
            description: "Tim za pravnu podršku, ugovore, dokumentaciju i usklađenost poslovanja.",
            tier: "STAFF",
            kind: "TEAM",
            teamName: "Legal",
            order: 60,
            children: [
              {
                key: "legal-leader",
                title: "Legal Leader",
                aliases: ["Rukovodilac pravnog sektora"],
                description: "Vodi pravne procese, pravnu podršku i usklađenost poslovanja.",
                tier: "LEAD",
                teamName: "Legal",
                order: 10,
                children: [
                  {
                    key: "legal-specialist",
                    title: "Legal Specialist",
                    aliases: ["Pravni specijalista"],
                    description: "Radi pravnu analizu i pruža podršku ugovornim i internim pravnim procesima.",
                    tier: "STAFF",
                    teamName: "Legal",
                    order: 10,
                    children: [
                      {
                        key: "legal-assistant",
                        title: "Legal Assistant",
                        aliases: ["Pravni asistent"],
                        description: "Administrativna i dokumentaciona podrška pravnom sektoru.",
                        tier: "STAFF",
                        teamName: "Legal",
                        order: 10
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        key: "security-sales-project-manager",
        title: "Security and Sales Project Manager",
        aliases: ["Menadžer prodajnih operacija i bezbednosti"],
        description: "Vodi security/sales projekte, prodajne operativne aktivnosti i koordinaciju projekata u tom domenu.",
        tier: "MANAGER",
        teamName: "Security & Sales Projects",
        order: 30
      },
      {
        key: "profitability-manager",
        title: "Profitability Manager",
        aliases: ["Menadžer profitabilnosti poslovanja"],
        description: "Vodi profitabilnost, analitiku poslovanja, finansijsku optimizaciju i podršku strateškim odlukama.",
        tier: "MANAGER",
        teamName: "Profitability",
        order: 40,
        children: [
          {
            key: "profitability-team",
            title: "Profitability",
            description: "Tim za profitabilnost, analize i operativno-finansijsku optimizaciju.",
            tier: "STAFF",
            kind: "TEAM",
            teamName: "Profitability",
            order: 10,
            children: [
              {
                key: "profitability-specialist",
                title: "Profitability Specialist",
                aliases: ["Specijalista za profitabilnost"],
                description: "Analizira rezultate, prati profitabilnost i predlaže operativna poboljšanja.",
                tier: "STAFF",
                teamName: "Profitability",
                order: 10,
                children: [
                  {
                    key: "profitability-assistant",
                    title: "Profitability Assistant",
                    aliases: ["Asistent za profitabilnost"],
                    description: "Podržava analitiku profitabilnosti i administrativne tokove tog domena.",
                    tier: "STAFF",
                    teamName: "Profitability",
                    order: 10
                  }
                ]
              }
            ]
          },
          {
            key: "strategic-finance-team",
            title: "Strategic Finance",
            description: "Tim za strateške finansije, planiranje, projekcije i finansijsko praćenje.",
            tier: "STAFF",
            kind: "TEAM",
            teamName: "Strategic Finance",
            order: 20,
            children: [
              {
                key: "strategic-finance-leader",
                title: "Strategic Finance Leader",
                aliases: ["Rukovodilac strateških finansija"],
                description: "Vodi strateško finansijsko planiranje, kontrolu i finansijski razvoj kompanije.",
                tier: "LEAD",
                teamName: "Strategic Finance",
                order: 10,
                children: [
                  {
                    key: "strategic-finance-specialist",
                    title: "Strategic Finance Specialist",
                    aliases: ["Specijalista za strateške finansije"],
                    description: "Radi na finansijskim projekcijama, analizama i podršci strateškim odlukama.",
                    tier: "STAFF",
                    teamName: "Strategic Finance",
                    order: 10
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        key: "organization-system-manager",
        title: "Organization & System Manager",
        aliases: ["Menadžer organizacije i sistema"],
        description: "Vodi organizacione standarde, interne sisteme, procese i sistemsku podršku poslovanju.",
        tier: "MANAGER",
        teamName: "Organization & System",
        teamAliases: ["Organization & System Team"],
        order: 50,
        children: [
          {
            key: "organization-system-team",
            title: "Organization & System",
            description: "Tim za organizaciju, sisteme, procese, dokumentaciju i internu operativnu jasnoću.",
            tier: "STAFF",
            kind: "TEAM",
            teamName: "Organization & System",
            teamAliases: ["Organization & System Team"],
            order: 10,
            children: [
              {
                key: "organization-system-leader",
                title: "Organization & System Leader",
                aliases: ["Rukovodilac organizacije i sistema"],
                description: "Vodi operativno unapređenje organizacije, sistema, procesa i dokumentacije.",
                tier: "LEAD",
                teamName: "Organization & System",
                teamAliases: ["Organization & System Team"],
                order: 10,
                children: [
                  {
                    key: "process-specialist",
                    title: "Process Specialist",
                    description: "Mapira, održava i unapređuje interne procese i proceduralnu dokumentaciju.",
                    tier: "STAFF",
                    teamName: "Organization & System",
                    teamAliases: ["Organization & System Team"],
                    order: 10,
                    children: [
                      {
                        key: "organization-specialist",
                        title: "Organization Specialist",
                        aliases: ["Specijalista za organizaciju i sisteme"],
                        description: "Sprovodi organizacione standarde, unapređuje sisteme i pruža internu podršku timovima.",
                        tier: "STAFF",
                        teamName: "Organization & System",
                        teamAliases: ["Organization & System Team"],
                        order: 10,
                        children: [
                          {
                            key: "organization-system-assistant",
                            title: "Organization & System Assistant",
                            aliases: ["Asistent za organizaciju i sisteme"],
                            description: "Operativna podrška vođenju sistema, procedura, dokumentacije i timskih procesa.",
                            tier: "STAFF",
                            teamName: "Organization & System",
                            teamAliases: ["Organization & System Team"],
                            order: 10
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          },
          {
            key: "strategic-hr-team",
            title: "Strategic HR",
            description: "Tim za strateški HR, kadrovsko planiranje i razvoj ljudi u kompaniji.",
            tier: "STAFF",
            kind: "TEAM",
            teamName: "Strategic HR",
            order: 20,
            children: [
              {
                key: "strategic-hr-leader",
                title: "Strategic HR Leader",
                aliases: ["Rukovodilac strateškog HR-a"],
                description: "Postavlja smer HR razvoja, kadrovskog planiranja i organizacionog razvoja.",
                tier: "LEAD",
                teamName: "Strategic HR",
                order: 10,
                children: [
                  {
                    key: "strategic-hr-specialist",
                    title: "Strategic HR Specialist",
                    aliases: ["Specijalista za strateški HR"],
                    description: "Radi na strateškom HR razvoju, kadrovskim inicijativama i sistemima za ljude.",
                    tier: "STAFF",
                    teamName: "Strategic HR",
                    order: 10,
                    children: [
                      {
                        key: "hr-specialist",
                        title: "HR Specialist",
                        aliases: ["HR specijalista"],
                        description: "Operativni HR rad, podrška zaposlenima, koordinacija procesa i dokumentacije.",
                        tier: "STAFF",
                        teamName: "Strategic HR",
                        order: 10
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
];

export function getVlahOrgTemplate() {
  return VLAH_ORG_TEMPLATE;
}

function normalizeKey(value: string | null | undefined) {
  return normalizeOrgSearchText(value);
}

function isSameOrAlias(teamName: string, candidate: string, aliases: string[]) {
  const values = [teamName, ...aliases].map(normalizeKey).filter(Boolean);
  return values.includes(normalizeKey(candidate));
}

async function findOrCreateTeam(
  tx: Prisma.TransactionClient,
  params: { name: string; aliases?: string[]; stats: { teamsCreated: number; teamsUpdated: number } }
) {
  const name = params.name.trim();
  if (!name) return null;

  const teams = await tx.team.findMany({ select: { id: true, name: true } });
  const existing = teams.find((team) => isSameOrAlias(name, team.name, params.aliases ?? []));
  if (existing) {
    if (existing.name === name) return existing.id;
    const duplicateTarget = teams.find((team) => normalizeKey(team.name) === normalizeKey(name));
    if (duplicateTarget) return duplicateTarget.id;
    await tx.team.update({ where: { id: existing.id }, data: { name } });
    params.stats.teamsUpdated += 1;
    return existing.id;
  }

  const created = await tx.team.create({ data: { name } });
  params.stats.teamsCreated += 1;
  return created.id;
}

async function syncTemplateNodes(
  tx: Prisma.TransactionClient,
  params: {
    nodes: OrgTemplateNode[];
    parentId: string | null;
    existingByTitle: Map<string, { id: string }>;
    activeIds: Set<string>;
    stats: {
      positionsCreated: number;
      positionsUpdated: number;
      teamsCreated: number;
      teamsUpdated: number;
    };
  }
) {
  for (const node of params.nodes) {
    const teamId = node.teamName
      ? await findOrCreateTeam(tx, { name: node.teamName, aliases: node.teamAliases, stats: params.stats })
      : null;

    const aliases = [node.title, ...(node.aliases ?? [])].map(normalizeKey).filter(Boolean);
    const existing = aliases.map((alias) => params.existingByTitle.get(alias)).find(Boolean);
    const kind: OrgNodeKind = node.kind ?? "POSITION";
    const data = {
      title: node.title,
      description: node.description,
      parentId: params.parentId,
      kind,
      teamId,
      tier: node.tier,
      order: node.order,
      isActive: true
    };

    const row = existing
      ? await tx.orgPosition.update({ where: { id: existing.id }, data })
      : await tx.orgPosition.create({ data });

    if (existing) params.stats.positionsUpdated += 1;
    else params.stats.positionsCreated += 1;

    params.activeIds.add(row.id);
    for (const alias of aliases) params.existingByTitle.set(alias, row);

    if (node.children?.length) {
      await syncTemplateNodes(tx, {
        nodes: node.children,
        parentId: row.id,
        existingByTitle: params.existingByTitle,
        activeIds: params.activeIds,
        stats: params.stats
      });
    }
  }
}

export async function syncVlahOrgTemplate(): Promise<ImportOrgTemplateResult> {
  return prisma.$transaction(async (tx) => {
    const existingPositions = await tx.orgPosition.findMany({ select: { id: true, title: true } });
    const existingByTitle = new Map(existingPositions.map((position) => [normalizeKey(position.title), { id: position.id }] as const));
    const stats = { positionsCreated: 0, positionsUpdated: 0, positionsDeactivated: 0, teamsCreated: 0, teamsUpdated: 0 };
    const activeIds = new Set<string>();

    await syncTemplateNodes(tx, {
      nodes: VLAH_ORG_TEMPLATE,
      parentId: null,
      existingByTitle,
      activeIds,
      stats
    });

    const deactivated = await tx.orgPosition.updateMany({
      where: { id: { notIn: [...activeIds] }, isActive: true },
      data: { isActive: false }
    });
    stats.positionsDeactivated = deactivated.count;

    return {
      skippedExisting: false,
      positionsCreated: stats.positionsCreated,
      positionsUpdated: stats.positionsUpdated,
      positionsDeactivated: stats.positionsDeactivated,
      teamsCreated: stats.teamsCreated,
      teamsUpdated: stats.teamsUpdated,
      assignmentsCreated: 0,
      missingUsers: []
    };
  });
}

export async function importVlahOrgTemplate(options?: {
  replaceExisting?: boolean;
}): Promise<ImportOrgTemplateResult> {
  const replaceExisting = options?.replaceExisting ?? false;

  const existingCount = await prisma.orgPosition.count();
  if (existingCount > 0 && !replaceExisting) {
    return {
      skippedExisting: true,
      positionsCreated: 0,
      positionsUpdated: 0,
      positionsDeactivated: 0,
      teamsCreated: 0,
      teamsUpdated: 0,
      assignmentsCreated: 0,
      missingUsers: []
    };
  }

  if (replaceExisting) {
    await prisma.$transaction(async (tx) => {
      await tx.orgPositionAssignment.deleteMany({});
      await tx.orgPositionLink.deleteMany({});
      await tx.orgGlobalLink.deleteMany({});
      await tx.orgPosition.deleteMany({});
    });
  }

  return syncVlahOrgTemplate();
}
