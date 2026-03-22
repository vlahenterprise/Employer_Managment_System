"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { groupOrgDocuments, normalizeOrgSearchText } from "@/lib/org-system";
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
  level: "executive" | "manager" | "lead" | "employee";
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
  executive: string;
  manager: string;
  lead: string;
  employee: string;
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
};

function levelLabel(level: OrgNode["level"], labels: OrgLabels) {
  if (level === "executive") return labels.executive;
  if (level === "manager") return labels.manager;
  if (level === "lead") return labels.lead;
  return labels.employee;
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

export default function OrgChart(props: {
  nodes: OrgNode[];
  globalLinks: OrgDocument[];
  canEdit: boolean;
  labels: OrgLabels;
}) {
  const scaleSteps = [0.75, 0.85, 1, 1.15, 1.3];
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

  const [selectedId, setSelectedId] = useState<string | null>(roots[0]?.id ?? null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [scaleIndex, setScaleIndex] = useState(2);

  useEffect(() => {
    if (!selectedId && roots[0]?.id) setSelectedId(roots[0].id);
    if (selectedId && !nodesById.has(selectedId)) setSelectedId(roots[0]?.id ?? null);
  }, [nodesById, roots, selectedId]);

  const selected = selectedId ? nodesById.get(selectedId) ?? null : null;

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
  const scale = scaleSteps[scaleIndex] ?? 1;
  const scalePercent = Math.round(scale * 100);

  function openPosition(positionId: string, documentId?: string | null) {
    setSelectedId(positionId);
    setSelectedDocumentId(documentId ?? null);
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
        <button
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
          <div className="org-children">
            <div className="org-children-grid">{children.map((child) => renderBranch(child))}</div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="org-system stack">
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
            <span className="org-level-pill org-level-pill-executive">{props.labels.executive}</span>
            <span className="org-level-pill org-level-pill-manager">{props.labels.manager}</span>
            <span className="org-level-pill org-level-pill-lead">{props.labels.lead}</span>
            <span className="org-level-pill org-level-pill-employee">{props.labels.employee}</span>
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
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setScaleIndex((value) => Math.min(scaleSteps.length - 1, value + 1))}
              disabled={scaleIndex === scaleSteps.length - 1}
            >
              + {props.labels.zoomIn}
            </button>
            {query ? (
              <button type="button" className="button button-secondary" onClick={() => setQuery("")}>
                {props.labels.clearSearch}
              </button>
            ) : null}
          </div>
        </div>
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

          <div className="org-tree-viewport">
            <div className="org-tree">{roots.map((node) => renderBranch(node))}</div>
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
                  <a className="button button-secondary" href="/admin/org-structure">
                    {props.labels.edit}
                  </a>
                ) : null}
              </div>
              {selected.description ? <div className="muted">{selected.description}</div> : null}

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
              {renderDocumentSection(props.labels.globalProcesses, globalGroups.globalProcesses)}
              {renderDocumentSection(props.labels.globalInstructions, globalGroups.globalInstructions)}

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
