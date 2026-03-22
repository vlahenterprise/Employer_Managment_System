import { prisma } from "@/server/db";
import { inferOrgPositionTier } from "@/lib/org-system";

type OrgTemplateNode = {
  key: string;
  title: string;
  description: string;
  order: number;
  children?: OrgTemplateNode[];
};

type OrgTemplateAssignment = {
  key: string;
  emails: string[];
};

type ImportOrgTemplateResult = {
  skippedExisting: boolean;
  positionsCreated: number;
  assignmentsCreated: number;
  missingUsers: string[];
};

const VLAH_ORG_TEMPLATE: OrgTemplateNode[] = [
  {
    key: "ceo",
    title: "Generalni direktor",
    description: "Najviši nivo organizacije i krajnji vlasnik strateškog pravca kompanije.",
    order: 0,
    children: [
      {
        key: "customer-care-sales-lead",
        title: "Rukovodilac korisničke podrške i prodaje",
        description: "Vodi prodajne tokove i korisničku podršku za operativne projekte i klijente.",
        order: 10,
        children: [
          {
            key: "customer-care-admin-specialist",
            title: "Specijalista za korisničku podršku i administraciju",
            description: "Operativna podrška korisnicima, administraciji i komunikaciji sa klijentima.",
            order: 10
          }
        ]
      },
      {
        key: "mastermind-programs-sales-lead",
        title: "Rukovodilac MasterMind programa i prodaje",
        description: "Vodi MasterMind programe, prodajni tok i razvoj odnosa sa članovima programa.",
        order: 20,
        children: [
          {
            key: "sales-mastermind-specialist",
            title: "Specijalista za prodaju i MasterMind programe",
            description: "Radi na prodaji programa, komunikaciji sa leadovima i podršci članovima.",
            order: 10
          }
        ]
      },
      {
        key: "operations-director",
        title: "Direktor operacija",
        description: "Koordinira operativne procese, internu podršku i infrastrukturu kompanije.",
        order: 30,
        children: [
          {
            key: "business-operations-specialist",
            title: "Specijalista za poslovne operacije",
            description: "Podržava operativne tokove i svakodnevnu organizaciju poslovanja.",
            order: 10
          },
          {
            key: "office-assistant",
            title: "Office Assistant",
            description: "Administrativna i logistička podrška kancelariji i internim tokovima.",
            order: 20
          },
          {
            key: "software-developer-specialist",
            title: "Specijalista za razvoj softvera",
            description: "Razvoj i održavanje internih softverskih sistema i automatizacija.",
            order: 30
          },
          {
            key: "office-operations-specialist",
            title: "Specijalista za kancelarijske operacije",
            description: "Organizuje kancelarijske operacije, interne servise i svakodnevnu logistiku.",
            order: 40
          },
          {
            key: "office-facilities-supervisor",
            title: "Supervizor kancelarije i objekta",
            description: "Odgovoran za fizički prostor, opremu i radne uslove u kancelariji.",
            order: 50,
            children: [
              {
                key: "office-kitchen-assistant",
                title: "Asistent za kancelariju i kuhinju",
                description: "Podrška svakodnevnom funkcionisanju kancelarije i zajedničkih prostora.",
                order: 10
              },
              {
                key: "facility-vehicle-technician",
                title: "Tehničar za održavanje objekta i vozila",
                description: "Održavanje objekta, tehničkih resursa i službenih vozila.",
                order: 20
              }
            ]
          }
        ]
      },
      {
        key: "organization-systems-manager",
        title: "Menadžer organizacije i sistema",
        description: "Vodi organizacione standarde, interne sisteme i sistemsku podršku poslovanju.",
        order: 40,
        children: [
          {
            key: "organization-systems-specialist",
            title: "Specijalista za organizaciju i sisteme",
            description: "Sprovodi organizacione standarde, unapređuje sisteme i pruža internu podršku timovima.",
            order: 10
          },
          {
            key: "organization-systems-assistant",
            title: "Asistent za organizaciju i sisteme",
            description: "Operativna podrška vođenju sistema, procedura i timskih procesa.",
            order: 20
          },
          {
            key: "strategic-hr-leader",
            title: "Rukovodilac strateškog HR-a",
            description: "Postavlja smer HR razvoja, kadrovskog planiranja i organizacionog razvoja.",
            order: 30,
            children: [
              {
                key: "strategic-hr-specialist",
                title: "Specijalista za strateški HR",
                description: "Radi na strateškom HR razvoju, kadrovskim inicijativama i sistemima za ljude.",
                order: 10
              },
              {
                key: "hr-specialist",
                title: "HR specijalista",
                description: "Operativni HR rad, podrška zaposlenima, koordinacija procesa i dokumentacije.",
                order: 20
              }
            ]
          }
        ]
      },
      {
        key: "profitability-manager",
        title: "Menadžer profitabilnosti poslovanja",
        description: "Vodi inicijative usmerene na profitabilnost, poslovne analize i finansijsku optimizaciju.",
        order: 50,
        children: [
          {
            key: "profitability-specialist",
            title: "Specijalista za profitabilnost",
            description: "Analizira rezultate, prati profitabilnost i predlaže operativna poboljšanja.",
            order: 10
          },
          {
            key: "profitability-assistant",
            title: "Asistent za profitabilnost",
            description: "Podržava analitiku profitabilnosti i administrativne tokove tog domena.",
            order: 20
          },
          {
            key: "strategic-finance-leader",
            title: "Rukovodilac strateških finansija",
            description: "Vodi strateško finansijsko planiranje, kontrolu i finansijski razvoj kompanije.",
            order: 30,
            children: [
              {
                key: "strategic-finance-specialist",
                title: "Specijalista za strateške finansije",
                description: "Radi na finansijskim projekcijama, analizama i podršci strateškim odlukama.",
                order: 10
              }
            ]
          }
        ]
      },
      {
        key: "sales-security-manager",
        title: "Menadžer prodajnih operacija i bezbednosti",
        description: "Vodi prodajne operacije, sigurnosne procedure i operativne prodajne projekte.",
        order: 60
      },
      {
        key: "marketing-leader",
        title: "Rukovodilac marketinga",
        description: "Odgovoran za marketing strategiju, sadržaj, brend i performance oglašavanje.",
        order: 70,
        children: [
          {
            key: "brand-specialist",
            title: "Specijalista za brend",
            description: "Održava brend standarde, identitet i doslednost komunikacije kompanije.",
            order: 10
          },
          {
            key: "content-supervisor",
            title: "Supervizor sadržaja",
            description: "Koordinira produkciju sadržaja i osigurava kvalitet isporuke sadržajnog tima.",
            order: 20,
            children: [
              {
                key: "content-creator",
                title: "Kreator sadržaja",
                description: "Kreira sadržaj za interne i eksterne kanale komunikacije.",
                order: 10
              },
              {
                key: "marketing-copywriter",
                title: "Specijalista za marketinški tekst",
                description: "Piše marketinške tekstove, prodajne poruke i copy za kampanje i sadržaj.",
                order: 20
              }
            ]
          },
          {
            key: "designer",
            title: "Dizajner",
            description: "Vizuelni dizajn materijala, kampanja i podrška vizuelnom identitetu kompanije.",
            order: 30
          },
          {
            key: "performance-ads-specialist",
            title: "Specijalista za performance oglašavanje",
            description: "Vodi performance kampanje, optimizaciju oglasa i merenje rezultata.",
            order: 40
          }
        ]
      },
      {
        key: "finance-admin-leader",
        title: "Rukovodilac finansija i administracije",
        description: "Vodi finansijske tokove, administraciju i operativnu podršku finansijskog sektora.",
        order: 80,
        children: [
          {
            key: "financial-specialist",
            title: "Finansijski specijalista",
            description: "Finansijsko planiranje, analiza i operativna finansijska podrška.",
            order: 10
          },
          {
            key: "accountant",
            title: "Računovođa",
            description: "Računovodstveni tokovi, evidencije i usklađenost finansijske dokumentacije.",
            order: 20
          },
          {
            key: "financial-assistant",
            title: "Finansijski asistent",
            description: "Administrativna i operativna podrška finansijskim aktivnostima.",
            order: 30
          }
        ]
      },
      {
        key: "legal-leader",
        title: "Rukovodilac pravnog sektora",
        description: "Vodi pravne procese, pravnu podršku i usklađenost poslovanja.",
        order: 90,
        children: [
          {
            key: "legal-specialist",
            title: "Pravni specijalista",
            description: "Pravna analiza, podrška ugovornim i internim pravnim procesima.",
            order: 10
          },
          {
            key: "legal-assistant",
            title: "Pravni asistent",
            description: "Administrativna i dokumentaciona podrška pravnom sektoru.",
            order: 20
          }
        ]
      }
    ]
  }
];

const VLAH_ORG_ASSIGNMENTS: OrgTemplateAssignment[] = [
  {
    key: "operations-director",
    emails: ["stefan.vacic@draganvlah.com"]
  },
  {
    key: "organization-systems-manager",
    emails: ["milos.dimitrijevic@draganvlah.com"]
  },
  {
    key: "organization-systems-specialist",
    emails: [
      "bojana.nedeljkovic@draganvlah.com",
      "borislav.stojanovic@draganvlah.com",
      "mihailo.gajic@draganvlah.com",
      "milosdimitrijevic991@gmail.com"
    ]
  },
  {
    key: "strategic-hr-specialist",
    emails: [
      "aleksandar.ljubic@draganvlah.com",
      "mirjana.biljic@draganvlah.com"
    ]
  },
  {
    key: "profitability-manager",
    emails: ["ilija.zivkovic@draganvlah.com"]
  },
  {
    key: "profitability-specialist",
    emails: [
      "jovana.stojanovic@draganvlah.com",
      "sanja.simovic@draganvlah.com"
    ]
  }
];

export function getVlahOrgTemplate() {
  return VLAH_ORG_TEMPLATE;
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
      assignmentsCreated: 0,
      missingUsers: []
    };
  }

  return prisma.$transaction(async (tx) => {
    if (replaceExisting) {
      await tx.orgPositionAssignment.deleteMany({});
      await tx.orgPositionLink.deleteMany({});
      await tx.orgGlobalLink.deleteMany({});
      await tx.orgPosition.deleteMany({});
    }

    const positionsCreated = { count: 0 };
    const positionIds = new Map<string, string>();

    async function createNodes(nodes: OrgTemplateNode[], parentId: string | null) {
      for (const node of nodes) {
        const created = await tx.orgPosition.create({
          data: {
            title: node.title,
            description: node.description,
            parentId,
            tier: inferOrgPositionTier(node.title),
            order: node.order,
            isActive: true
          }
        });

        positionIds.set(node.key, created.id);
        positionsCreated.count += 1;

        if (node.children?.length) {
          await createNodes(node.children, created.id);
        }
      }
    }

    await createNodes(VLAH_ORG_TEMPLATE, null);

    const users = await tx.user.findMany({
      select: { id: true, email: true }
    });
    const usersByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user.id] as const));

    const missingUsers = new Set<string>();
    let assignmentsCreated = 0;

    for (const assignment of VLAH_ORG_ASSIGNMENTS) {
      const positionId = positionIds.get(assignment.key);
      if (!positionId) continue;

      for (const email of assignment.emails) {
        const userId = usersByEmail.get(email.toLowerCase());
        if (!userId) {
          missingUsers.add(email);
          continue;
        }

        await tx.orgPositionAssignment.create({
          data: {
            positionId,
            userId
          }
        });
        assignmentsCreated += 1;
      }
    }

    return {
      skippedExisting: false,
      positionsCreated: positionsCreated.count,
      assignmentsCreated,
      missingUsers: [...missingUsers]
    };
  });
}
