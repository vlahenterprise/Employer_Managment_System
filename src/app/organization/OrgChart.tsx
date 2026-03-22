"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { groupOrgDocuments, groupOrgNodeIdsByLevel, normalizeOrgSearchText } from "@/lib/org-system";
import { LabelWithTooltip } from "@/components/Tooltip";

type OrgDocument = {
  id: string;
  label: string;
  description: string | null;
  url: string;
  type:
    | "JOB_DESCRIPTION"
    | "WORK_INSTRUCTIONS"
    | "POSITION_PROCESS"
    | "POSITION_INSTRUCTION"
    | "GLOBAL_PROCESS"
    | "GLOBAL_INSTRUCTION";
  order: number;
};

type OrgPerson = {
  id: string;
  name: string;
  email: string;
  teamName: string | null;
  position: string | null;
};

type OrgNode = {
  id: string;
  title: string;
  description: string | null;
  parentId: string | null;
  order: number;
  isActive: boolean;
  level: "director" | "manager" | "lead" | "supervisor" | "staff";
  documents: OrgDocument[];
  people: OrgPerson[];
};

type SearchResult = {
  id: string;
  kind: "position" | "person" | "document" | "global";
  title: string;
  subtitle: string | null;
  positionId: string | null;
  documentId?: string | null;
};

type OrgLabels = {
  people: string;
  noAssignees: string;
  select: string;
  edit: string;
  manageHint: string;
  search: string;
  searchHelp: string;
  searchPlaceholder: string;
  searchHint: string;
  clearSearch: string;
  noSearchResults: string;
  director: string;
  manager: string;
  lead: string;
  supervisor: string;
  staff: string;
  jobDescription: string;
  workInstructions: string;
  positionProcesses: string;
  positionInstructions: string;
  globalProcesses: string;
  globalInstructions: string;
  noDocuments: string;
  peopleHelp: string;
  documentsHelp: string;
  openDocument: string;
  globalResources: string;
  matches: string;
  zoomIn: string;
  zoomOut: string;
  zoomReset: string;
  zoomHelp: string;
  levelLegend: string;
  levelOverview: string;
  fitToScreen: string;
  fullscreen: string;
  exitFullscreen: string;
  jumpToLevel: string;
  reportsTo: string;
  directReports: string;
  linkedDocuments: string;
  childPositions: string;
  hierarchyPath: string;
  selectedLevel: string;
  noChildren: string;
  noParent: string;
  quickSummary: string;
  relatedResources: string;
};

function levelLabel(level: OrgNode["level"], labels: OrgLabels) {
  if (level === "director") return labels.director;
  if (level === "manager") return labels.manager;
  if (level === "lead") return labels.lead;
  if (level === "supervisor") return labels.supervisor;
  return labels.staff;
}

function resourceTypeLabel(type: OrgDocument["type"], labels: OrgLabels) {
  if (type === "JOB_DESCRIPTION") return labels.jobDescription;
  if (type === "WORK_INSTRUCTIONS") return labels.workInstructions;
  if (type === "POSITION_PROCESS") return labels.positionProcesses;
  if (type === "POSITION_INSTRUCTION") return labels.positionInstructions;
  if (type === "GLOBAL_PROCESS") return labels.globalProcesses;
  return labels.globalInstructions;
}

function sortNodes(nodes: OrgNode[]) {
  return [...nodes].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

const ORG_SCALE_STEPS = [0.75, 0.85, 1, 1.15, 1.3] as const;

export default function OrgChart(props: {
  nodes: OrgNode[];
  globalLinks: OrgDocument[];
  canEdit: boolean;
  labels: OrgLabels;
  initialSelectedId?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const treeRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const nodesById = useMemo(() => new Map(props.nodes.map((node) => [node.id, node] as const)), [props.nodes]);

  const childMap = useMemo(() => {
    const map = new Map<string | null, OrgNode[]>();
    for (const node of props.nodes) {
      const key = node.parentId ?? null;
      const list = map.get(key) ?? [];
      list.push(node);
      map.set(key, list);
    }
    for (const [key, list] of map.entries()) map.set(key, sortNodes(list));
    return map;
  }, [props.nodes]);

  const roots = useMemo(() => {
    const rootCandidates = childMap.get(null) ?? [];
    return rootCandidates.length ? rootCandidates : sortNodes(props.nodes);
  }, [childMap, props.nodes]);

  const [selectedId, setSelectedId] = useState<string | null>(props.initialSelectedId ?? roots[0]?.id ?? null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [scaleIndex, setScaleIndex] = useState(2);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const nodeIdsByLevel = useMemo(() => groupOrgNodeIdsByLevel(props.nodes), [props.nodes]);

  useEffect(() => {
    if (!selectedId && roots[0]?.id) setSelectedId(roots[0].id);
    if (selectedId && !nodesById.has(selectedId)) setSelectedId(roots[0]?.id ?? null);
  }, [nodesById, roots, selectedId]);

  useEffect(() => {
    if (props.initialSelectedId && nodesById.has(props.initialSelectedId)) {
      setSelectedId(props.initialSelectedId);
    }
  }, [nodesById, props.initialSelectedId]);

  useEffect(() => {
    function syncFullscreenState() {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    }

    syncFullscreenState();
    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  const selected = selectedId ? nodesById.get(selectedId) ?? null : null;
  const selectedParent = selected?.parentId ? nodesById.get(selected.parentId) ?? null : null;
  const selectedChildren = useMemo(() => {
    return selected ? childMap.get(selected.id) ?? [] : [];
  }, [childMap, selected]);
  const selectedDocumentTotal = (selected?.documents.length ?? 0) + props.globalLinks.length;
  const selectedPath = useMemo(() => {
    if (!selected) return [];
    const path: OrgNode[] = [];
    const seen = new Set<string>();
    let current: OrgNode | undefined | null = selected;
    while (current && !seen.has(current.id)) {
      path.unshift(current);
      seen.add(current.id);
      current = current.parentId ? nodesById.get(current.parentId) ?? null : null;
    }
    return path;
  }, [nodesById, selected]);
  const selectedChildrenByLevel = useMemo(() => {
    return selectedChildren.reduce(
      (acc, child) => {
        acc[child.level].push(child);
        return acc;
      },
      {
        director: [] as OrgNode[],
        manager: [] as OrgNode[],
        lead: [] as OrgNode[],
        supervisor: [] as OrgNode[],
        staff: [] as OrgNode[]
      }
    );
  }, [selectedChildren]);

  const searchResults = useMemo<SearchResult[]>(() => {
    const needle = normalizeOrgSearchText(query);
    if (!needle) return [];

    const results: SearchResult[] = [];
    for (const node of props.nodes) {
      if (normalizeOrgSearchText(node.title).includes(needle) || normalizeOrgSearchText(node.description).includes(needle)) {
        results.push({
          id: `position-${node.id}`,
          kind: "position",
          title: node.title,
          subtitle: node.description,
          positionId: node.id
        });
      }

      for (const person of node.people) {
        const matches =
          normalizeOrgSearchText(person.name).includes(needle) ||
          normalizeOrgSearchText(person.email).includes(needle) ||
          normalizeOrgSearchText(person.teamName).includes(needle);
        if (!matches) continue;
        results.push({
          id: `person-${person.id}`,
          kind: "person",
          title: person.name,
          subtitle: `${node.title}${person.teamName ? ` · ${person.teamName}` : ""}`,
          positionId: node.id
        });
      }

      for (const document of node.documents) {
        const matches =
          normalizeOrgSearchText(document.label).includes(needle) ||
          normalizeOrgSearchText(document.description).includes(needle) ||
          normalizeOrgSearchText(node.title).includes(needle);
        if (!matches) continue;
        results.push({
          id: `document-${document.id}`,
          kind: "document",
          title: document.label,
          subtitle: `${resourceTypeLabel(document.type, props.labels)} · ${node.title}`,
          positionId: node.id,
          documentId: document.id
        });
      }
    }

    for (const document of props.globalLinks) {
      const matches =
        normalizeOrgSearchText(document.label).includes(needle) ||
        normalizeOrgSearchText(document.description).includes(needle) ||
        normalizeOrgSearchText(resourceTypeLabel(document.type, props.labels)).includes(needle);
      if (!matches) continue;
      results.push({
        id: `global-${document.id}`,
        kind: "global",
        title: document.label,
        subtitle: `${resourceTypeLabel(document.type, props.labels)} · ${props.labels.globalResources}`,
        positionId: null,
        documentId: document.id
      });
    }

    return results.slice(0, 24);
  }, [props.globalLinks, props.labels, props.nodes, query]);

  const selectedGroups = useMemo(() => groupOrgDocuments(selected?.documents ?? []), [selected]);
  const globalGroups = useMemo(() => groupOrgDocuments(props.globalLinks), [props.globalLinks]);
  const scale = ORG_SCALE_STEPS[scaleIndex] ?? 1;
  const scalePercent = Math.round(scale * 100);
  const levelOverview = useMemo(
    () => [
      { level: "director" as const, label: props.labels.director, count: nodeIdsByLevel.director.length },
      { level: "manager" as const, label: props.labels.manager, count: nodeIdsByLevel.manager.length },
      { level: "lead" as const, label: props.labels.lead, count: nodeIdsByLevel.lead.length },
      { level: "supervisor" as const, label: props.labels.supervisor, count: nodeIdsByLevel.supervisor.length },
      { level: "staff" as const, label: props.labels.staff, count: nodeIdsByLevel.staff.length }
    ],
    [nodeIdsByLevel, props.labels.director, props.labels.lead, props.labels.manager, props.labels.staff, props.labels.supervisor]
  );

  useEffect(() => {
    if (!selectedId) return;
    const node = nodeRefs.current[selectedId];
    if (!node) return;

    const frame = window.requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [selectedId, scaleIndex]);

  const openPosition = useCallback((positionId: string, documentId?: string | null) => {
    setSelectedId(positionId);
    setSelectedDocumentId(documentId ?? null);
  }, []);

  const fitToScreen = useCallback(() => {
    const viewport = viewportRef.current;
    const tree = treeRef.current;
    if (!viewport || !tree) {
      setScaleIndex(2);
      return;
    }

    const availableWidth = Math.max(viewport.clientWidth - 32, 0);
    const baseWidth = tree.scrollWidth / scale;
    const fittingIndex = ORG_SCALE_STEPS.reduce<number>((best, candidate, index) => {
      return candidate * baseWidth <= availableWidth ? index : best;
    }, -1);

    setScaleIndex(fittingIndex >= 0 ? fittingIndex : 0);
  }, [scale]);

  useEffect(() => {
    if (!isFullscreen) return;
    const timer = window.setTimeout(() => {
      fitToScreen();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [fitToScreen, isFullscreen]);

  async function toggleFullscreen() {
    const container = containerRef.current;
    if (!container || typeof document === "undefined") return;

    if (document.fullscreenElement === container) {
      await document.exitFullscreen();
      return;
    }

    if (container.requestFullscreen) {
      await container.requestFullscreen();
    }
  }

  function jumpToLevel(level: OrgNode["level"]) {
    const firstId = nodeIdsByLevel[level][0];
    if (!firstId) return;
    openPosition(firstId);
  }

  function renderDocumentSection(title: string, documents: OrgDocument[]) {
    if (documents.length === 0) return null;
    return (
      <div className="org-section">
        <div className="org-section-title">{title}</div>
        <div className="org-links">
          {documents.map((document) => (
            <a
              key={document.id}
              className={`org-link${selectedDocumentId === document.id ? " org-link-active" : ""}`}
              href={document.url}
              target="_blank"
              rel="noreferrer"
            >
              <span className="org-link-title">{document.label}</span>
              {document.description ? <span className="org-link-copy">{document.description}</span> : null}
              <span className="org-link-meta">{props.labels.openDocument}</span>
            </a>
          ))}
        </div>
      </div>
    );
  }

  function renderBranch(node: OrgNode) {
    const children = childMap.get(node.id) ?? [];
    return (
      <div key={node.id} className={`org-branch org-branch-${node.level}`}>
        {node.parentId ? (
          <div className="org-branch-connector" aria-hidden="true">
            <span className="org-branch-connector-dot" />
            <span className="org-branch-connector-line" />
            <span className="org-branch-connector-arrow" />
          </div>
        ) : null}
        <button
          ref={(element) => {
            nodeRefs.current[node.id] = element;
          }}
          type="button"
          className={`org-node org-node-${node.level}${selectedId === node.id ? " is-active" : ""}`}
          onClick={() => openPosition(node.id)}
        >
          <div className="org-node-head">
            <div className="org-title">{node.title}</div>
          </div>
          <div className="org-node-body">
            <div className="org-node-level">{levelLabel(node.level, props.labels)}</div>
            {node.people.length > 0 ? (
              <div className="org-people-preview">
                {node.people.map((person) => (
                  <span key={person.id} className="org-people-preview-name">
                    {person.name}
                  </span>
                ))}
              </div>
            ) : (
              <div className="org-empty">{props.labels.noAssignees}</div>
            )}
          </div>
        </button>

        {children.length > 0 ? (
          <div className={`org-children${children.length === 1 ? " is-single" : ""}`}>
            <div className="org-children-stem" aria-hidden="true">
              <span className="org-children-stem-dot" />
              <span className="org-children-stem-arrow" />
            </div>
            <div className="org-children-grid">{children.map((child) => renderBranch(child))}</div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`org-system stack${isFullscreen ? " is-fullscreen" : ""}`}>
      <section className="org-toolbar">
        <div className="field">
          <span className="label">
            <LabelWithTooltip label={props.labels.search} tooltip={props.labels.searchHelp} />
          </span>
          <input
            className="input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={props.labels.searchPlaceholder}
          />
          <div className="muted small">{props.labels.searchHint}</div>
        </div>
        <div className="org-toolbar-controls">
          <div className="org-level-legend">
            <span className="org-level-legend-title">
              <LabelWithTooltip label={props.labels.levelLegend} tooltip={props.labels.zoomHelp} />
            </span>
            <span className="org-level-pill org-level-pill-director">{props.labels.director}</span>
            <span className="org-level-pill org-level-pill-manager">{props.labels.manager}</span>
            <span className="org-level-pill org-level-pill-lead">{props.labels.lead}</span>
            <span className="org-level-pill org-level-pill-supervisor">{props.labels.supervisor}</span>
            <span className="org-level-pill org-level-pill-staff">{props.labels.staff}</span>
          </div>

          <div className="org-level-jumps">
            <span className="org-level-jumps-title">{props.labels.jumpToLevel}</span>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => jumpToLevel("director")}
              disabled={nodeIdsByLevel.director.length === 0}
            >
              {props.labels.director}
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => jumpToLevel("manager")}
              disabled={nodeIdsByLevel.manager.length === 0}
            >
              {props.labels.manager}
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => jumpToLevel("lead")}
              disabled={nodeIdsByLevel.lead.length === 0}
            >
              {props.labels.lead}
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => jumpToLevel("supervisor")}
              disabled={nodeIdsByLevel.supervisor.length === 0}
            >
              {props.labels.supervisor}
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => jumpToLevel("staff")}
              disabled={nodeIdsByLevel.staff.length === 0}
            >
              {props.labels.staff}
            </button>
          </div>

          <div className="org-zoom-controls">
            <span className="org-zoom-value">{scalePercent}%</span>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setScaleIndex((value) => Math.max(0, value - 1))}
              disabled={scaleIndex === 0}
            >
              − {props.labels.zoomOut}
            </button>
            <button type="button" className="button button-secondary" onClick={() => setScaleIndex(2)}>
              {props.labels.zoomReset}
            </button>
            <button type="button" className="button button-secondary" onClick={fitToScreen}>
              {props.labels.fitToScreen}
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setScaleIndex((value) => Math.min(ORG_SCALE_STEPS.length - 1, value + 1))}
              disabled={scaleIndex === ORG_SCALE_STEPS.length - 1}
            >
              + {props.labels.zoomIn}
            </button>
            <button type="button" className="button button-secondary" onClick={toggleFullscreen}>
              {isFullscreen ? props.labels.exitFullscreen : props.labels.fullscreen}
            </button>
            {query ? (
              <button type="button" className="button button-secondary" onClick={() => setQuery("")}>
                {props.labels.clearSearch}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="org-overview-grid">
        {levelOverview.map((item) => (
          <button
            key={item.level}
            type="button"
            className={`org-overview-card org-overview-card-${item.level}`}
            onClick={() => jumpToLevel(item.level)}
            disabled={item.count === 0}
          >
            <span className="org-overview-label">{item.label}</span>
            <strong>{item.count}</strong>
            <span className="org-overview-meta">{props.labels.levelOverview}</span>
          </button>
        ))}
      </section>

      <div className="org-layout">
        <div className="org-tree-shell" style={{ "--org-scale": String(scale) } as CSSProperties}>
          {query ? (
            <section className="org-search-results">
              <div className="org-section-title">{props.labels.matches}</div>
              <div className="org-search-list">
                {searchResults.length > 0 ? (
                  searchResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      className="org-search-item"
                      onClick={() => {
                        if (result.positionId) openPosition(result.positionId, result.documentId);
                        else setSelectedDocumentId(result.documentId ?? null);
                      }}
                    >
                      <span className="org-search-title">{result.title}</span>
                      {result.subtitle ? <span className="org-search-copy">{result.subtitle}</span> : null}
                    </button>
                  ))
                ) : (
                  <div className="muted small">{props.labels.noSearchResults}</div>
                )}
              </div>
            </section>
          ) : null}

          <div ref={viewportRef} className="org-tree-viewport">
            <div ref={treeRef} className="org-tree">
              {roots.map((node) => renderBranch(node))}
            </div>
          </div>
        </div>

        <aside className="org-detail">
          {selected ? (
            <>
              <div className="org-detail-head">
                <div>
                  <div className="org-detail-title">{selected.title}</div>
                  <div className="org-detail-subtitle">{levelLabel(selected.level, props.labels)}</div>
                </div>
                {props.canEdit ? (
                  <a className="button button-secondary" href={`/admin/org-structure?query=${encodeURIComponent(selected.title)}`}>
                    {props.labels.edit}
                  </a>
                ) : null}
              </div>
              {selected.description ? <div className="muted">{selected.description}</div> : null}

              <div className="org-section">
                <div className="org-section-title">{props.labels.quickSummary}</div>
                <div className="org-detail-metrics">
                  <div className="org-detail-metric">
                    <span className="org-detail-metric-label">{props.labels.selectedLevel}</span>
                    <strong>{levelLabel(selected.level, props.labels)}</strong>
                  </div>
                  <div className="org-detail-metric">
                    <span className="org-detail-metric-label">{props.labels.people}</span>
                    <strong>{selected.people.length}</strong>
                  </div>
                  <div className="org-detail-metric">
                    <span className="org-detail-metric-label">{props.labels.directReports}</span>
                    <strong>{selectedChildren.length}</strong>
                  </div>
                  <div className="org-detail-metric">
                    <span className="org-detail-metric-label">{props.labels.linkedDocuments}</span>
                    <strong>{selectedDocumentTotal}</strong>
                  </div>
                </div>
              </div>

              <div className="org-detail-meta-grid">
                <div className="org-detail-meta-card">
                  <div className="org-section-title">{props.labels.hierarchyPath}</div>
                  {selectedPath.length > 0 ? (
                    <div className="org-detail-breadcrumb">
                      {selectedPath.map((node, index) => (
                        <button
                          key={node.id}
                          type="button"
                          className={`org-detail-breadcrumb-item${node.id === selected.id ? " is-active" : ""}`}
                          onClick={() => openPosition(node.id)}
                        >
                          <span>{node.title}</span>
                          {index < selectedPath.length - 1 ? <span className="org-detail-breadcrumb-sep">→</span> : null}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="org-detail-meta-empty">—</div>
                  )}
                </div>
                <div className="org-detail-meta-card">
                  <div className="org-section-title">{props.labels.reportsTo}</div>
                  <div className="org-detail-meta-value">{selectedParent?.title ?? props.labels.noParent}</div>
                </div>
                <div className="org-detail-meta-card">
                  <div className="org-section-title">{props.labels.childPositions}</div>
                  {selectedChildren.length > 0 ? (
                    <div className="org-detail-group-list">
                      {levelOverview.map((group) =>
                        selectedChildrenByLevel[group.level].length > 0 ? (
                          <div key={group.level} className="org-detail-group">
                            <div className="org-detail-group-head">
                              <span className={`org-level-pill org-level-pill-${group.level}`}>{group.label}</span>
                              <strong>{selectedChildrenByLevel[group.level].length}</strong>
                            </div>
                            <div className="org-detail-chip-list">
                              {selectedChildrenByLevel[group.level].map((child) => (
                                <button
                                  key={child.id}
                                  type="button"
                                  className="org-detail-chip"
                                  onClick={() => openPosition(child.id)}
                                >
                                  {child.title}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null
                      )}
                    </div>
                  ) : (
                    <div className="org-detail-meta-empty">{props.labels.noChildren}</div>
                  )}
                </div>
              </div>

              <div className="org-section">
                <div className="org-section-title">
                  <LabelWithTooltip label={props.labels.people} tooltip={props.labels.peopleHelp} />
                </div>
                <div className="org-people">
                  {selected.people.length > 0 ? (
                    selected.people.map((person) => (
                      <div key={person.id} className="org-person">
                        <div className="org-person-name">{person.name}</div>
                        <div className="muted small">
                          {person.teamName ? `${person.teamName} · ` : ""}
                          {person.email}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="muted">{props.labels.noAssignees}</div>
                  )}
                </div>
              </div>

              {renderDocumentSection(props.labels.jobDescription, selectedGroups.jobDescriptions)}
              {renderDocumentSection(props.labels.workInstructions, selectedGroups.workInstructions)}
              {renderDocumentSection(props.labels.positionProcesses, selectedGroups.positionProcesses)}
              {renderDocumentSection(props.labels.positionInstructions, selectedGroups.positionInstructions)}
              {globalGroups.globalProcesses.length > 0 || globalGroups.globalInstructions.length > 0 ? (
                <div className="org-section">
                  <div className="org-section-title">{props.labels.relatedResources}</div>
                  {renderDocumentSection(props.labels.globalProcesses, globalGroups.globalProcesses)}
                  {renderDocumentSection(props.labels.globalInstructions, globalGroups.globalInstructions)}
                </div>
              ) : null}

              {selected.documents.length > 0 || props.globalLinks.length > 0 ? (
                <div className="org-hint">
                  <LabelWithTooltip label={props.labels.openDocument} tooltip={props.labels.documentsHelp} />
                </div>
              ) : null}

              {selected.documents.length === 0 && props.globalLinks.length === 0 ? (
                <div className="muted">
                  {props.labels.noDocuments}
                  {props.canEdit ? <div className="org-hint">{props.labels.manageHint}</div> : null}
                </div>
              ) : null}
            </>
          ) : (
            <div className="muted">{props.labels.select}</div>
          )}
        </aside>
      </div>
    </div>
  );
}
