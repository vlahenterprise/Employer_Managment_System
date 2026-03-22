export type OrgNodeLevel = "executive" | "manager" | "lead" | "employee";

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
  if (depth <= 0) return "executive";
  if (depth === 1) return "manager";
  if (depth === 2) return "lead";
  return "employee";
}

export function groupOrgNodeIdsByLevel<T extends { id: string; level: OrgNodeLevel }>(nodes: T[]) {
  return nodes.reduce(
    (acc, node) => {
      acc[node.level].push(node.id);
      return acc;
    },
    {
      executive: [] as string[],
      manager: [] as string[],
      lead: [] as string[],
      employee: [] as string[]
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
