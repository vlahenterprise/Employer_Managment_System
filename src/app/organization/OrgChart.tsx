"use client";

import { useMemo, useState } from "react";

type OrgNode = {
  id: string;
  title: string;
  subtitle?: string | null;
  description: string | null;
  parentId: string | null;
  order: number;
  isActive: boolean;
  links: Array<{ id: string; label: string; url: string; order: number }>;
  users: Array<{ id: string; name: string; email: string }>;
};

export default function OrgChart(props: {
  nodes: OrgNode[];
  palette?: string[];
  canEdit: boolean;
  labels: {
    people: string;
    links: string;
    noAssignees: string;
    noLinks: string;
    select: string;
    edit: string;
    manageHint: string;
  };
}) {
  const nodesById = useMemo(() => {
    const map = new Map<string, OrgNode>();
    for (const n of props.nodes) map.set(n.id, n);
    return map;
  }, [props.nodes]);

  const [selectedId, setSelectedId] = useState<string | null>(props.nodes[0]?.id ?? null);

  const selected = selectedId ? nodesById.get(selectedId) ?? null : null;

  const palette = useMemo(() => {
    const base = props.palette && props.palette.length ? props.palette : ["#F05123", "#C6CCCD", "#111111"];
    return base.filter(Boolean);
  }, [props.palette]);

  const levels = useMemo(() => {
    const depthById = new Map<string, number>();
    const visiting = new Set<string>();

    function getDepth(id: string): number {
      if (depthById.has(id)) return depthById.get(id) || 0;
      if (visiting.has(id)) return 0;
      visiting.add(id);
      const node = nodesById.get(id);
      let depth = 0;
      if (node?.parentId && nodesById.has(node.parentId) && node.parentId !== id) {
        depth = getDepth(node.parentId) + 1;
      }
      visiting.delete(id);
      depthById.set(id, depth);
      return depth;
    }

    const levelMap = new Map<number, OrgNode[]>();
    for (const node of props.nodes) {
      const depth = getDepth(node.id);
      const list = levelMap.get(depth) ?? [];
      list.push(node);
      levelMap.set(depth, list);
    }

    return Array.from(levelMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([depth, nodes]) => ({
        depth,
        nodes: nodes.sort((a, b) => a.title.localeCompare(b.title))
      }));
  }, [nodesById, props.nodes]);

  function renderNode(id: string) {
    const node = nodesById.get(id);
    if (!node) return null;
    return (
      <div key={id} className="org-node-wrap">
        <button
          type="button"
          className={`org-node${selectedId === id ? " is-active" : ""}`}
          onClick={() => setSelectedId(id)}
          style={{ ["--org-accent" as any]: palette[(levels.find((l) => l.nodes.some((n) => n.id === id))?.depth ?? 0) % palette.length] }}
        >
          <div className="org-node-head">
            <div className="org-title">{node.title}</div>
          </div>
          <div className="org-node-body">
            {node.subtitle ? <div className="org-subtitle">{node.subtitle}</div> : <div className="org-subtitle muted">—</div>}
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="org-layout">
      <div className="org-tree">
        {levels.map((level) => (
          <div key={level.depth} className="org-level">
            <div className="org-level-nodes">{level.nodes.map((n) => renderNode(n.id))}</div>
          </div>
        ))}
      </div>
      <aside className="org-detail">
        {selected ? (
          <>
            <div className="org-detail-title">{selected.title}</div>
            {selected.subtitle ? <div className="muted small">{selected.subtitle}</div> : null}
            {selected.description ? <div className="muted">{selected.description}</div> : null}
            <div className="org-section">
              <div className="org-section-title">{props.labels.people}</div>
              <div className="org-people">
                {selected.users.length === 0 ? (
                  <div className="muted">{props.labels.noAssignees}</div>
                ) : (
                  selected.users.map((u) => (
                    <div key={u.id} className="org-person">
                      <div className="org-person-name">{u.name}</div>
                      <div className="muted small">{u.email}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="org-section">
              <div className="org-section-title">{props.labels.links}</div>
              <div className="org-links">
                {selected.links.length === 0 ? (
                  <div className="muted">
                    {props.labels.noLinks}
                    {props.canEdit ? <div className="org-hint">{props.labels.manageHint}</div> : null}
                  </div>
                ) : (
                  selected.links.map((l) => (
                    <a key={l.id} className="org-link" href={l.url} target="_blank" rel="noreferrer">
                      {l.label}
                    </a>
                  ))
                )}
              </div>
            </div>
            {props.canEdit ? (
              <div className="org-actions">
                <a className="button button-secondary" href="/admin/org-structure">
                  {props.labels.edit}
                </a>
              </div>
            ) : null}
          </>
        ) : (
          <div className="muted">{props.labels.select}</div>
        )}
      </aside>
    </div>
  );
}
