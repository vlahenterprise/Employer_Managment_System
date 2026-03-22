export type OrgNodeLevel = "director" | "manager" | "lead" | "supervisor" | "staff";
export type OrgPositionTierValue = "DIRECTOR" | "MANAGER" | "LEAD" | "SUPERVISOR" | "STAFF";

export const ORG_TIER_ORDER: OrgPositionTierValue[] = ["DIRECTOR", "MANAGER", "LEAD", "SUPERVISOR", "STAFF"];

export type OrgDocumentLike = {
  type:
    | "JOB_DESCRIPTION"
    | "WORK_INSTRUCTIONS"
    | "POSITION_PROCESS"
    | "POSITION_INSTRUCTION"
    | "GLOBAL_PROCESS"
    | "GLOBAL_INSTRUCTION";
};

export function normalizeOrgSearchText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function buildOrgDepthMap(rows: Array<{ id: string; parentId: string | null }>) {
  const rowMap = new Map(rows.map((row) => [row.id, row] as const));
  const levelMap = new Map<string, number>();
  const visiting = new Set<string>();

  function getDepth(id: string): number {
    if (levelMap.has(id)) return levelMap.get(id) ?? 0;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const row = rowMap.get(id);
    let depth = 0;
    if (row?.parentId && row.parentId !== id && rowMap.has(row.parentId)) {
      depth = getDepth(row.parentId) + 1;
    }
    visiting.delete(id);
    levelMap.set(id, depth);
    return depth;
  }

  for (const row of rows) getDepth(row.id);
  return levelMap;
}

export function getOrgNodeLevel(depth: number): OrgNodeLevel {
  if (depth <= 0) return "director";
  if (depth === 1) return "manager";
  if (depth === 2) return "lead";
  if (depth === 3) return "supervisor";
  return "staff";
}

export function mapOrgTierToNodeLevel(tier: OrgPositionTierValue | null | undefined): OrgNodeLevel {
  if (tier === "DIRECTOR") return "director";
  if (tier === "MANAGER") return "manager";
  if (tier === "LEAD") return "lead";
  if (tier === "SUPERVISOR") return "supervisor";
  return "staff";
}

export function inferOrgPositionTier(title: string | null | undefined): OrgPositionTierValue {
  const value = normalizeOrgSearchText(title);
  if (!value) return "STAFF";
  if (value.includes("generalni direktor") || value.includes("ceo")) return "DIRECTOR";
  if (
    value.includes("menadžer") ||
    value.includes("menadzer") ||
    value.includes("manager") ||
    value.includes("direktor") ||
    value.includes("director") ||
    value === "coo"
  ) {
    return "MANAGER";
  }
  if (value.includes("supervizor") || value.includes("supervisor")) return "SUPERVISOR";
  if (value.includes("rukovodilac") || value.includes("lider") || value.includes("leader") || value.includes("team lead")) {
    return "LEAD";
  }
  return "STAFF";
}

export function groupOrgNodeIdsByLevel<T extends { id: string; level: OrgNodeLevel }>(nodes: T[]) {
  return nodes.reduce(
    (acc, node) => {
      acc[node.level].push(node.id);
      return acc;
    },
    {
      director: [] as string[],
      manager: [] as string[],
      lead: [] as string[],
      supervisor: [] as string[],
      staff: [] as string[]
    }
  );
}

export function groupOrgDocuments<T extends OrgDocumentLike>(documents: T[]) {
  return {
    jobDescriptions: documents.filter((document) => document.type === "JOB_DESCRIPTION"),
    workInstructions: documents.filter((document) => document.type === "WORK_INSTRUCTIONS"),
    positionProcesses: documents.filter((document) => document.type === "POSITION_PROCESS"),
    positionInstructions: documents.filter((document) => document.type === "POSITION_INSTRUCTION"),
    globalProcesses: documents.filter((document) => document.type === "GLOBAL_PROCESS"),
    globalInstructions: documents.filter((document) => document.type === "GLOBAL_INSTRUCTION")
  };
}

export function buildOrgPathMap<T extends { id: string; title: string; parentId: string | null }>(rows: T[]) {
  const byId = new Map(rows.map((row) => [row.id, row] as const));
  const cache = new Map<string, string[]>();

  function resolvePath(id: string, seen = new Set<string>()): string[] {
    if (cache.has(id)) return cache.get(id) ?? [];
    const row = byId.get(id);
    if (!row) return [];
    if (seen.has(id)) return [row.title];

    const nextSeen = new Set(seen);
    nextSeen.add(id);
    const parentPath = row.parentId ? resolvePath(row.parentId, nextSeen) : [];
    const path = [...parentPath, row.title];
    cache.set(id, path);
    return path;
  }

  for (const row of rows) resolvePath(row.id);
  return cache;
}
