"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Connection,
  BackgroundVariant,
  Panel,
  NodeProps,
  Handle,
  Position,
  useReactFlow,
  ReactFlowProvider,
  EdgeProps,
  getBezierPath,
  MarkerType,
  EdgeLabelRenderer,
  BaseEdge,
} from "@xyflow/react";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface RawNode {
  id: string;
  label: string;
  type: "root" | "branch" | "leaf";
  parentId: string;
  description: string;
  color: string;
}

export interface RawCrossLink {
  src: string;
  tgt: string;
  label: string;
  color: string;
  dashed: boolean;
}

export interface MindMapData {
  nodes: RawNode[];
  crossLinks: RawCrossLink[];
}

interface NodeData extends Record<string, unknown> {
  label: string;
  type: "root" | "branch" | "leaf";
  description: string;
  color: string;
  dimmed?: boolean;
  highlighted?: boolean;
}

interface CrossEdgeData extends Record<string, unknown> {
  label?: string;
  color?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CSV SERIALIZER / PARSER
// ═══════════════════════════════════════════════════════════════════════════════

function escapeCSV(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function parseCSVLine(line: string): string[] {
  const cols: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQ = !inQ; }
    } else if (ch === "," && !inQ) {
      cols.push(cur); cur = "";
    } else {
      cur += ch;
    }
  }
  cols.push(cur);
  return cols;
}

export function serializeToCSV(data: MindMapData): string {
  const lines: string[] = [];

  lines.push("## NODES");
  lines.push("id,label,type,parentId,description,color");
  for (const n of data.nodes) {
    lines.push([n.id, n.label, n.type, n.parentId, n.description, n.color].map(escapeCSV).join(","));
  }

  lines.push("");

  lines.push("## CROSS_LINKS");
  lines.push("src,tgt,label,color,dashed");
  for (const c of data.crossLinks) {
    lines.push([c.src, c.tgt, c.label, c.color, c.dashed ? "true" : "false"].map(escapeCSV).join(","));
  }

  return lines.join("\n");
}

export function parseFromCSV(csv: string): MindMapData {
  const lines = csv.split("\n");
  let section: "none" | "nodes" | "cross" = "none";
  let nodeHeaders: string[] = [];
  let crossHeaders: string[] = [];
  const nodes: RawNode[] = [];
  const crossLinks: RawCrossLink[] = [];
  let headerParsed = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { headerParsed = false; continue; }

    if (line === "## NODES") { section = "nodes"; headerParsed = false; continue; }
    if (line === "## CROSS_LINKS") { section = "cross"; headerParsed = false; continue; }

    if (!headerParsed) {
      const cols = parseCSVLine(line);
      if (section === "nodes") nodeHeaders = cols;
      if (section === "cross") crossHeaders = cols;
      headerParsed = true;
      continue;
    }

    const cols = parseCSVLine(line);
    if (section === "nodes" && nodeHeaders.length) {
      const obj: Record<string, string> = {};
      nodeHeaders.forEach((h, i) => { obj[h] = cols[i] ?? ""; });
      nodes.push({
        id: obj.id, label: obj.label,
        type: obj.type as RawNode["type"],
        parentId: obj.parentId ?? "",
        description: obj.description, color: obj.color,
      });
    }
    if (section === "cross" && crossHeaders.length) {
      const obj: Record<string, string> = {};
      crossHeaders.forEach((h, i) => { obj[h] = cols[i] ?? ""; });
      crossLinks.push({
        src: obj.src, tgt: obj.tgt, label: obj.label,
        color: obj.color, dashed: obj.dashed === "true",
      });
    }
  }

  return { nodes, crossLinks };
}

// ═══════════════════════════════════════════════════════════════════════════════
// GRAPH BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

function buildGraph(data: MindMapData): { nodes: Node<NodeData>[]; edges: Edge[] } {
  const flowNodes: Node<NodeData>[] = [];
  const flowEdges: Edge[] = [];
  const { nodes: raw, crossLinks } = data;

  const root = raw.find(r => r.type === "root");
  if (!root) return { nodes: [], edges: [] };

  const branches = raw.filter(r => r.type === "branch");
  const leaves = raw.filter(r => r.type === "leaf");
  const cx = 0, cy = 0;

  flowNodes.push({
    id: root.id, type: "mindNode",
    position: { x: cx - 90, y: cy - 45 },
    data: { label: root.label, type: root.type, description: root.description, color: root.color },
  });

  branches.forEach((branch, i) => {
    const angle = (i * 2 * Math.PI) / branches.length - Math.PI / 2;
    const bx = cx + 420 * Math.cos(angle);
    const by = cy + 420 * Math.sin(angle);

    flowNodes.push({
      id: branch.id, type: "mindNode",
      position: { x: bx - 80, y: by - 32 },
      data: { label: branch.label, type: branch.type, description: branch.description, color: branch.color },
    });

    flowEdges.push({
      id: `e${root.id}-${branch.id}`, source: root.id, target: branch.id, type: "smoothstep",
      style: { stroke: branch.color, strokeWidth: 2.5, opacity: 0.65 },
      markerEnd: { type: MarkerType.ArrowClosed, color: branch.color, width: 14, height: 14 },
    });

    const branchLeaves = leaves.filter(l => l.parentId === branch.id);
    const leafSpread = Math.PI * 0.65;
    const leafStep = branchLeaves.length > 1 ? leafSpread / (branchLeaves.length - 1) : 0;
    const leafStartAngle = angle - leafSpread / 2;

    branchLeaves.forEach((leaf, j) => {
      const la = branchLeaves.length === 1 ? angle : leafStartAngle + j * leafStep;
      const lx = bx + 240 * Math.cos(la);
      const ly = by + 240 * Math.sin(la);

      flowNodes.push({
        id: leaf.id, type: "mindNode",
        position: { x: lx - 60, y: ly - 22 },
        data: { label: leaf.label, type: leaf.type, description: leaf.description, color: leaf.color },
      });

      flowEdges.push({
        id: `e${branch.id}-${leaf.id}`, source: branch.id, target: leaf.id, type: "smoothstep",
        style: { stroke: leaf.color, strokeWidth: 1.5, opacity: 0.5, strokeDasharray: "5 4" },
        markerEnd: { type: MarkerType.ArrowClosed, color: leaf.color, width: 10, height: 10 },
      });
    });
  });

  crossLinks.forEach(({ src, tgt, label, color, dashed }) => {
    flowEdges.push({
      id: `cross-${src}-${tgt}`, source: src, target: tgt, type: "crossEdge",
      data: { label, color } as CrossEdgeData,
      style: { stroke: color, strokeWidth: 1.5, opacity: 0.55, strokeDasharray: dashed ? "6 4" : undefined },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 12, height: 12 },
    });
  });

  return { nodes: flowNodes, edges: flowEdges };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PALETTE
// ═══════════════════════════════════════════════════════════════════════════════

const PALETTE = [
  "#6366f1","#f59e0b","#10b981","#06b6d4","#ec4899","#8b5cf6",
  "#fb7185","#22d3ee","#34d399","#fbbf24","#f472b6","#a78bfa",
  "#fcd34d","#6ee7b7","#67e8f9","#f9a8d4","#c4b5fd","#4ade80",
];

// ═══════════════════════════════════════════════════════════════════════════════
// COLOR PICKER
// ═══════════════════════════════════════════════════════════════════════════════

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
      {PALETTE.map(c => (
        <div key={c} onClick={() => onChange(c)} style={{
          width: 22, height: 22, borderRadius: "50%", background: c, cursor: "pointer",
          border: value === c ? "2.5px solid #fff" : "2px solid transparent",
          transform: value === c ? "scale(1.25)" : "scale(1)", transition: "all 0.15s",
        }} />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM EDGE
// ═══════════════════════════════════════════════════════════════════════════════

function CrossEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, style, markerEnd }: EdgeProps) {
  const d = data as CrossEdgeData;
  const [path, lx, ly] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, curvature: 0.5 });
  return (
    <>
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd as string} />
      {d?.label && (
        <EdgeLabelRenderer>
          <div style={{
            position: "absolute",
            transform: `translate(-50%,-50%) translate(${lx}px,${ly}px)`,
            pointerEvents: "none",
            background: "rgba(8,12,24,0.82)",
            border: `1px solid ${d.color ?? "#6366f1"}44`,
            borderRadius: 6, padding: "2px 7px",
            fontSize: 9, color: d.color ?? "#94a3b8",
            fontFamily: "'DM Sans',sans-serif", fontWeight: 500,
            letterSpacing: "0.04em", backdropFilter: "blur(6px)", whiteSpace: "nowrap",
          }}>{d.label}</div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM NODE
// ═══════════════════════════════════════════════════════════════════════════════

function MindNode({ data, id }: NodeProps) {
  const nd = data as NodeData;
  const isRoot = nd.type === "root";
  const isBranch = nd.type === "branch";
  const isDimmed = nd.dimmed === true;
  const isHL = nd.highlighted === true;

  const hs: React.CSSProperties = {
    background: nd.color, border: "2px solid rgba(255,255,255,0.3)",
    width: 10, height: 10, opacity: isDimmed ? 0 : 0.8,
    transition: "opacity 0.2s,transform 0.2s",
  };

  return (
    <div title={nd.description} style={{
      fontFamily: "'Syne',sans-serif",
      borderRadius: isRoot ? "50%" : isBranch ? "16px" : "10px",
      border: isHL ? `2.5px solid ${nd.color}` : `2px solid ${nd.color}${isDimmed ? "22" : "bb"}`,
      background: isRoot
        ? `radial-gradient(135deg,${nd.color}33,${nd.color}55)`
        : isBranch ? `linear-gradient(135deg,${nd.color}20,${nd.color}38)` : `${nd.color}12`,
      backdropFilter: "blur(10px)", color: isDimmed ? "#334155" : "#f1f5f9",
      padding: isRoot ? "26px 22px" : isBranch ? "13px 20px" : "9px 14px",
      minWidth: isRoot ? "170px" : isBranch ? "150px" : "120px",
      maxWidth: isRoot ? "170px" : isBranch ? "170px" : "145px",
      textAlign: "center", cursor: "crosshair",
      transition: "all 0.35s cubic-bezier(0.4,0,0.2,1)",
      opacity: isDimmed ? 0.15 : 1,
      filter: isHL ? `brightness(1.45) drop-shadow(0 0 20px ${nd.color}bb)` : isDimmed ? "brightness(0.35) saturate(0.2)" : "brightness(1)",
      boxShadow: isHL
        ? `0 0 0 2.5px ${nd.color},0 0 36px ${nd.color}88,0 0 72px ${nd.color}33`
        : isRoot ? `0 0 50px ${nd.color}55,0 0 100px ${nd.color}22` : isBranch ? `0 0 24px ${nd.color}33` : "0 2px 14px rgba(0,0,0,0.35)",
      transform: isHL ? "scale(1.08)" : isDimmed ? "scale(0.96)" : "scale(1)",
      position: "relative",
    }}>
      {(["Left","Right","Top","Bottom"] as const).flatMap(pos => (
        (["source","target"] as const).map(t => (
          <Handle key={`${t}-${pos}`} type={t} position={Position[pos]}
            id={`${id}-${t[0]}${pos[0].toLowerCase()}`}
            style={{ ...hs, [pos.toLowerCase()]: -5 }}
          />
        ))
      ))}
      {isRoot && (
        <div style={{
          position: "absolute", top: 10, right: 10, width: 8, height: 8, borderRadius: "50%",
          background: nd.color, boxShadow: `0 0 10px ${nd.color}`, animation: "pulse 2s infinite",
        }} />
      )}
      <div style={{
        fontSize: isRoot ? "14px" : isBranch ? "12px" : "11px",
        fontWeight: isRoot ? 800 : isBranch ? 700 : 500,
        letterSpacing: isRoot ? "0.05em" : "0.02em", lineHeight: 1.3,
        textShadow: isHL ? `0 0 24px ${nd.color},0 0 8px #fff6` : `0 0 20px ${nd.color}66`,
      }}>{nd.label}</div>
      {(isBranch || isRoot) && (
        <div style={{
          marginTop: 5, fontSize: "9px",
          opacity: isDimmed ? 0.1 : isBranch ? 0.55 : 0.4,
          fontFamily: "'DM Sans',sans-serif", fontWeight: 300,
          letterSpacing: "0.03em", lineHeight: 1.4,
        }}>{nd.description.slice(0, 55)}{nd.description.length > 55 ? "…" : ""}</div>
      )}
    </div>
  );
}

const nodeTypes = { mindNode: MindNode };
const edgeTypes = { crossEdge: CrossEdge };

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getRelated(id: string, edges: Edge[]): Set<string> {
  const s = new Set([id]);
  edges.filter(e => e.source === id || e.target === id).forEach(e => { s.add(e.source); s.add(e.target); });
  return s;
}

function nextId(nodes: RawNode[]): string {
  const ids = nodes.map(n => parseInt(n.id)).filter(n => !isNaN(n));
  return String(ids.length ? Math.max(...ids) + 1 : 1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// INFO PANEL
// ═══════════════════════════════════════════════════════════════════════════════

function InfoPanel({ node }: { node: Node<NodeData> | null }) {
  if (!node) return null;
  const d = node.data as NodeData;
  return (
    <div style={{
      position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)",
      background: "rgba(10,14,28,0.94)", border: `1px solid ${d.color}55`,
      borderRadius: 16, padding: "16px 26px", color: "#e2e8f0",
      fontFamily: "'DM Sans',sans-serif", fontSize: 13,
      minWidth: 300, maxWidth: 420, backdropFilter: "blur(20px)",
      boxShadow: `0 12px 40px rgba(0,0,0,0.6),0 0 32px ${d.color}22`,
      zIndex: 10, pointerEvents: "none", animation: "fadeUp 0.25s ease",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ width: 12, height: 12, borderRadius: "50%", background: d.color, boxShadow: `0 0 10px ${d.color}`, flexShrink: 0 }} />
        <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16, color: "#f8fafc" }}>{d.label}</span>
        <span style={{ marginLeft: "auto", fontSize: 9, opacity: 0.35, textTransform: "uppercase", letterSpacing: "0.12em" }}>{d.type}</span>
      </div>
      <p style={{ margin: 0, opacity: 0.75, lineHeight: 1.7, fontSize: 12 }}>{d.description}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EDITOR PANEL
// ═══════════════════════════════════════════════════════════════════════════════

type EditorTab = "nodes" | "crosslinks";

interface EditorPanelProps {
  data: MindMapData;
  onSave: (data: MindMapData) => void;
  onClose: () => void;
  onExportCSV: () => void;
  onImportCSV: () => void;
}

function EditorPanel({ data, onSave, onClose, onExportCSV, onImportCSV }: EditorPanelProps) {
  const [tab, setTab] = useState<EditorTab>("nodes");
  const [nodes, setNodes] = useState<RawNode[]>(JSON.parse(JSON.stringify(data.nodes)));
  const [crossLinks, setCrossLinks] = useState<RawCrossLink[]>(JSON.parse(JSON.stringify(data.crossLinks)));
  const [editingNode, setEditingNode] = useState<RawNode | null>(null);
  const [editingLink, setEditingLink] = useState<(RawCrossLink & { _idx: number }) | null>(null);
  const [dirty, setDirty] = useState(false);

  const [nLabel, setNLabel] = useState("");
  const [nType, setNType] = useState<RawNode["type"]>("leaf");
  const [nParent, setNParent] = useState("");
  const [nDesc, setNDesc] = useState("");
  const [nColor, setNColor] = useState(PALETTE[0]);

  const [cSrc, setCSrc] = useState("");
  const [cTgt, setCTgt] = useState("");
  const [cLabel, setCLabel] = useState("");
  const [cColor, setCColor] = useState(PALETTE[6]);
  const [cDashed, setCDashed] = useState(false);

  function resetNodeForm() { setNLabel(""); setNType("leaf"); setNParent(""); setNDesc(""); setNColor(PALETTE[0]); setEditingNode(null); }
  function resetLinkForm() { setCSrc(""); setCTgt(""); setCLabel(""); setCColor(PALETTE[6]); setCDashed(false); setEditingLink(null); }

  function loadNodeEdit(n: RawNode) {
    setEditingNode(n); setNLabel(n.label); setNType(n.type);
    setNParent(n.parentId); setNDesc(n.description); setNColor(n.color); setTab("nodes");
  }

  function loadLinkEdit(c: RawCrossLink, idx: number) {
    setEditingLink({ ...c, _idx: idx }); setCSrc(c.src); setCTgt(c.tgt);
    setCLabel(c.label); setCColor(c.color); setCDashed(c.dashed); setTab("crosslinks");
  }

  function submitNode() {
    if (!nLabel.trim()) return;
    const updated = [...nodes];
    if (editingNode) {
      const i = updated.findIndex(n => n.id === editingNode.id);
      if (i >= 0) updated[i] = { ...editingNode, label: nLabel, type: nType, parentId: nParent, description: nDesc, color: nColor };
    } else {
      updated.push({ id: nextId(updated), label: nLabel, type: nType, parentId: nParent, description: nDesc, color: nColor });
    }
    setNodes(updated); setDirty(true); resetNodeForm();
  }

  function deleteNode(id: string) {
    setNodes(ns => ns.filter(n => n.id !== id));
    setCrossLinks(cs => cs.filter(c => c.src !== id && c.tgt !== id));
    setDirty(true);
  }

  function submitLink() {
    if (!cSrc || !cTgt) return;
    const updated = [...crossLinks];
    if (editingLink) {
      updated[editingLink._idx] = { src: cSrc, tgt: cTgt, label: cLabel, color: cColor, dashed: cDashed };
    } else {
      updated.push({ src: cSrc, tgt: cTgt, label: cLabel, color: cColor, dashed: cDashed });
    }
    setCrossLinks(updated); setDirty(true); resetLinkForm();
  }

  function deleteLink(idx: number) { setCrossLinks(cs => cs.filter((_, i) => i !== idx)); setDirty(true); }
  function handleSave() { onSave({ nodes, crossLinks }); setDirty(false); }

  const nodeMap = useMemo(() => Object.fromEntries(nodes.map(n => [n.id, n.label])), [nodes]);

  const inp: React.CSSProperties = {
    width: "100%", padding: "8px 11px", borderRadius: 8,
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    color: "#f1f5f9", fontSize: 12, outline: "none",
    fontFamily: "'DM Sans',sans-serif", marginBottom: 8, boxSizing: "border-box",
  };
  const sel: React.CSSProperties = { ...inp, cursor: "pointer" };
  const btnP = (c = "#6366f1"): React.CSSProperties => ({
    padding: "8px 16px", borderRadius: 8, border: "none", background: c, color: "#fff",
    fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", letterSpacing: "0.04em",
  });
  const btnG: React.CSSProperties = {
    padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
    background: "transparent", color: "#64748b", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(4,6,16,0.8)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        width: "min(920px, 96vw)", maxHeight: "90vh",
        background: "#0a0e1c", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20, display: "flex", flexDirection: "column",
        boxShadow: "0 32px 80px rgba(0,0,0,0.85)", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "18px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", rowGap: 8,
        }}>
          <span style={{ fontSize: 20 }}>🗄️</span>
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 17, color: "#f8fafc" }}>Database Editor</div>
            <div style={{ fontSize: 10, color: "#334155", fontFamily: "'DM Sans',sans-serif", marginTop: 1 }}>Kelola node & koneksi — semua tersimpan lokal</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={btnG} onClick={onImportCSV}>📂 Load CSV</button>
            <button style={btnG} onClick={onExportCSV}>💾 Simpan CSV</button>
            {dirty && <button style={btnP()} onClick={handleSave}>✓ Apply</button>}
            <button style={{ ...btnG, color: "#fb7185", borderColor: "#fb718533" }} onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          {(["nodes","crosslinks"] as EditorTab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "12px 22px", border: "none", cursor: "pointer", background: "transparent",
              fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: tab === t ? 700 : 400,
              color: tab === t ? "#a5b4fc" : "#334155",
              borderBottom: tab === t ? "2px solid #6366f1" : "2px solid transparent",
              letterSpacing: "0.04em",
            }}>
              {t === "nodes" ? `🔵 Nodes (${nodes.length})` : `🔗 Cross-Links (${crossLinks.length})`}
            </button>
          ))}
          {dirty && (
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", padding: "0 16px", fontSize: 11, color: "#f59e0b", fontFamily: "'DM Sans',sans-serif" }}>
              ● unsaved changes
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* List */}
          <div style={{ width: "52%", overflowY: "auto", borderRight: "1px solid rgba(255,255,255,0.05)", padding: "12px" }}>
            {tab === "nodes" && (
              nodes.length === 0
                ? <div style={{ textAlign: "center", padding: "40px 0", color: "#1e293b", fontFamily: "'DM Sans',sans-serif", fontSize: 12 }}>Belum ada node →</div>
                : nodes.map(n => (
                  <div key={n.id} onClick={() => loadNodeEdit(n)} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 12px", borderRadius: 9, marginBottom: 5,
                    background: editingNode?.id === n.id ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${editingNode?.id === n.id ? "#6366f144" : "rgba(255,255,255,0.04)"}`,
                    cursor: "pointer",
                  }}>
                    <div style={{ width: 9, height: 9, borderRadius: "50%", background: n.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 12, fontWeight: 700, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.label}</div>
                      <div style={{ fontSize: 10, color: "#334155", fontFamily: "'DM Sans',sans-serif", marginTop: 1 }}>
                        [{n.type}]{n.parentId ? ` · ${nodeMap[n.parentId] ?? n.parentId}` : ""}
                      </div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); deleteNode(n.id); }} style={{ background: "none", border: "none", color: "#fb718588", cursor: "pointer", fontSize: 14, padding: "2px 6px" }}>✕</button>
                  </div>
                ))
            )}
            {tab === "crosslinks" && (
              crossLinks.length === 0
                ? <div style={{ textAlign: "center", padding: "40px 0", color: "#1e293b", fontFamily: "'DM Sans',sans-serif", fontSize: 12 }}>Belum ada cross-link →</div>
                : crossLinks.map((c, i) => (
                  <div key={i} onClick={() => loadLinkEdit(c, i)} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 12px", borderRadius: 9, marginBottom: 5,
                    background: editingLink?._idx === i ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${editingLink?._idx === i ? "#6366f144" : "rgba(255,255,255,0.04)"}`,
                    cursor: "pointer",
                  }}>
                    <div style={{ width: 24, height: 3, borderRadius: 2, background: c.color, flexShrink: 0, opacity: c.dashed ? 0.6 : 1 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#e2e8f0" }}>
                        {nodeMap[c.src] ?? c.src} → {nodeMap[c.tgt] ?? c.tgt}
                      </div>
                      <div style={{ fontSize: 10, color: "#334155", marginTop: 1 }}>{c.label || "(no label)"}{c.dashed ? " · dashed" : ""}</div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); deleteLink(i); }} style={{ background: "none", border: "none", color: "#fb718588", cursor: "pointer", fontSize: 14, padding: "2px 6px" }}>✕</button>
                  </div>
                ))
            )}
          </div>

          {/* Form */}
          <div style={{ flex: 1, padding: "18px 22px", overflowY: "auto" }}>
            {tab === "nodes" && (
              <>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13, color: "#475569", marginBottom: 14, letterSpacing: "0.06em" }}>
                  {editingNode ? "✏️ EDIT NODE" : "➕ NODE BARU"}
                </div>
                <label style={{ fontSize: 10, color: "#334155", fontFamily: "'DM Sans',sans-serif", display: "block", marginBottom: 3, letterSpacing: "0.08em" }}>LABEL *</label>
                <input value={nLabel} onChange={e => setNLabel(e.target.value)} placeholder="Nama node" style={inp} />
                <label style={{ fontSize: 10, color: "#334155", fontFamily: "'DM Sans',sans-serif", display: "block", marginBottom: 3, letterSpacing: "0.08em" }}>TIPE *</label>
                <select value={nType} onChange={e => setNType(e.target.value as RawNode["type"])} style={{ ...sel, background: "#0d1220" }}>
                  <option value="root">root — pusat mind map</option>
                  <option value="branch">branch — cabang utama</option>
                  <option value="leaf">leaf — node daun</option>
                </select>
                <label style={{ fontSize: 10, color: "#334155", fontFamily: "'DM Sans',sans-serif", display: "block", marginBottom: 3, letterSpacing: "0.08em" }}>PARENT NODE</label>
                <select value={nParent} onChange={e => setNParent(e.target.value)} style={{ ...sel, background: "#0d1220" }}>
                  <option value="">— tidak ada —</option>
                  {nodes.filter(n => !editingNode || n.id !== editingNode.id).map(n => (
                    <option key={n.id} value={n.id}>{n.label} ({n.type})</option>
                  ))}
                </select>
                <label style={{ fontSize: 10, color: "#334155", fontFamily: "'DM Sans',sans-serif", display: "block", marginBottom: 3, letterSpacing: "0.08em" }}>DESKRIPSI</label>
                <textarea value={nDesc} onChange={e => setNDesc(e.target.value)} placeholder="Deskripsi singkat..." rows={3} style={{ ...inp, resize: "vertical" as const }} />
                <label style={{ fontSize: 10, color: "#334155", fontFamily: "'DM Sans',sans-serif", display: "block", marginBottom: 6, letterSpacing: "0.08em" }}>WARNA</label>
                <ColorPicker value={nColor} onChange={setNColor} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={btnP(nColor)} onClick={submitNode}>{editingNode ? "Update" : "Tambah Node"}</button>
                  {editingNode && <button style={btnG} onClick={resetNodeForm}>Batal</button>}
                </div>
              </>
            )}

            {tab === "crosslinks" && (
              <>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13, color: "#475569", marginBottom: 14, letterSpacing: "0.06em" }}>
                  {editingLink ? "✏️ EDIT CROSS-LINK" : "➕ CROSS-LINK BARU"}
                </div>
                <label style={{ fontSize: 10, color: "#334155", fontFamily: "'DM Sans',sans-serif", display: "block", marginBottom: 3, letterSpacing: "0.08em" }}>DARI NODE *</label>
                <select value={cSrc} onChange={e => setCSrc(e.target.value)} style={{ ...sel, background: "#0d1220" }}>
                  <option value="">— pilih source —</option>
                  {nodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
                </select>
                <label style={{ fontSize: 10, color: "#334155", fontFamily: "'DM Sans',sans-serif", display: "block", marginBottom: 3, letterSpacing: "0.08em" }}>KE NODE *</label>
                <select value={cTgt} onChange={e => setCTgt(e.target.value)} style={{ ...sel, background: "#0d1220" }}>
                  <option value="">— pilih target —</option>
                  {nodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
                </select>
                <label style={{ fontSize: 10, color: "#334155", fontFamily: "'DM Sans',sans-serif", display: "block", marginBottom: 3, letterSpacing: "0.08em" }}>LABEL KONEKSI</label>
                <input value={cLabel} onChange={e => setCLabel(e.target.value)} placeholder="misal: Perang Dagang" style={inp} />
                <label style={{ fontSize: 10, color: "#334155", fontFamily: "'DM Sans',sans-serif", display: "block", marginBottom: 6, letterSpacing: "0.08em" }}>WARNA</label>
                <ColorPicker value={cColor} onChange={setCColor} />
                <label style={{
                  display: "flex", alignItems: "center", gap: 10, marginBottom: 16,
                  cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#64748b",
                }}>
                  <input type="checkbox" checked={cDashed} onChange={e => setCDashed(e.target.checked)} style={{ width: 14, height: 14, accentColor: "#6366f1" }} />
                  Garis putus-putus (dashed)
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={btnP(cColor)} onClick={submitLink}>{editingLink ? "Update" : "Tambah Link"}</button>
                  {editingLink && <button style={btnG} onClick={resetLinkForm}>Batal</button>}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 24px", borderTop: "1px solid rgba(255,255,255,0.04)",
          display: "flex", alignItems: "center", gap: 12, background: "rgba(4,6,16,0.5)",
        }}>
          <span style={{ fontSize: 11, color: "#1e293b", fontFamily: "'DM Sans',sans-serif" }}>
            {nodes.length} node · {crossLinks.length} cross-link
          </span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {dirty && <button style={btnP()} onClick={handleSave}>✓ Apply ke Mind Map</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WELCOME SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

function WelcomeScreen({ onNew, onImport }: { onNew: () => void; onImport: () => void }) {
  return (
    <div style={{
      height: "100vh", width: "100vw", background: "#070b18",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", fontFamily: "'DM Sans',sans-serif",
    }}>
      <div style={{ fontSize: 64, marginBottom: 24, filter: "drop-shadow(0 0 40px #6366f155)" }}>🌐</div>
      <h1 style={{
        fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 36,
        color: "#f8fafc", letterSpacing: "0.02em", marginBottom: 8, textAlign: "center",
      }}>MindFlow</h1>
      <p style={{ color: "#334155", fontSize: 14, marginBottom: 48, textAlign: "center" }}>
        Mind map interaktif — mulai dari nol atau muat file CSV
      </p>
      <div style={{ display: "flex", gap: 16 }}>
        <button onClick={onNew} style={{
          padding: "14px 32px", borderRadius: 12,
          background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
          border: "none", color: "#fff", fontFamily: "'Syne',sans-serif",
          fontWeight: 700, fontSize: 14, cursor: "pointer",
          boxShadow: "0 0 32px #6366f155", letterSpacing: "0.04em",
        }}>✦ Buat Baru</button>
        <button onClick={onImport} style={{
          padding: "14px 32px", borderRadius: 12,
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)",
          color: "#94a3b8", fontFamily: "'Syne',sans-serif",
          fontWeight: 700, fontSize: 14, cursor: "pointer", letterSpacing: "0.04em",
        }}>📂 Muat CSV</button>
      </div>
      <p style={{ marginTop: 32, fontSize: 11, color: "#1e293b", textAlign: "center", lineHeight: 1.8 }}>
        Data tersimpan di file CSV lokal.<br />Tidak ada server. Tidak ada cloud.
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN INNER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function MindMapInner() {
  const [mapData, setMapData] = useState<MindMapData | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node<NodeData> | null>(null);
  const [connectMode, setConnectMode] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  const originalEdges = useRef<Edge[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { fitView, setCenter } = useReactFlow();

  const applyData = useCallback((d: MindMapData) => {
    const graph = buildGraph(d);
    setNodes(graph.nodes);
    setEdges(graph.edges);
    originalEdges.current = graph.edges;
    setMapData(d);
    setTimeout(() => fitView({ padding: 0.12, duration: 500 }), 100);
  }, [setNodes, setEdges, fitView]);

  // Export CSV → download file lokal
  const handleExportCSV = useCallback(() => {
    if (!mapData) return;
    const csv = serializeToCSV(mapData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "database_ekonomi.csv"; a.click();
    URL.revokeObjectURL(url);
  }, [mapData]);

  // Import CSV ← buka file picker
  const handleImportCSV = useCallback(() => fileInputRef.current?.click(), []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => applyData(parseFromCSV(ev.target?.result as string));
    reader.readAsText(file);
    e.target.value = "";
  }, [applyData]);

  const onConnect = useCallback((params: Connection) => {
    const newEdge: Edge = {
      id: `cross-${params.source}-${params.target}-${Date.now()}`,
      source: params.source!, target: params.target!, type: "crossEdge",
      data: { label: "", color: "#a78bfa" } as CrossEdgeData,
      style: { stroke: "#a78bfa", strokeWidth: 1.5, opacity: 0.6 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#a78bfa", width: 12, height: 12 },
    };
    setEdges(eds => [...eds, newEdge]);
    originalEdges.current = [...originalEdges.current, newEdge];
    setMapData(prev => prev ? {
      ...prev,
      crossLinks: [...prev.crossLinks, { src: params.source!, tgt: params.target!, label: "", color: "#a78bfa", dashed: false }],
    } : prev);
  }, [setEdges]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const clicked = node as Node<NodeData>;
    setSelectedNode(clicked);
    setNodes(cur => {
      const rel = getRelated(clicked.id, originalEdges.current);
      return cur.map(n => ({ ...n, data: { ...n.data, dimmed: !rel.has(n.id), highlighted: rel.has(n.id) } }));
    });
    setEdges(cur => {
      const rel = getRelated(clicked.id, cur);
      return cur.map(e => {
        const linked = rel.has(e.source) && rel.has(e.target);
        const orig = originalEdges.current.find(o => o.id === e.id)?.style ?? {};
        const oc = (orig as { stroke?: string }).stroke ?? "#6366f1";
        return {
          ...e, animated: linked,
          style: linked
            ? { ...orig, opacity: 1, strokeWidth: ((orig as { strokeWidth?: number }).strokeWidth ?? 2) * 1.6, filter: `drop-shadow(0 0 8px ${oc})` }
            : { ...orig, opacity: 0.05, strokeWidth: 1, filter: "none" },
        };
      });
    });
    setTimeout(() => setCenter(node.position.x + 80, node.position.y + 40, { zoom: 1.1, duration: 650 }), 30);
  }, [setNodes, setEdges, setCenter]);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setNodes(ns => ns.map(n => ({ ...n, data: { ...n.data, dimmed: false, highlighted: false } })));
    setEdges(() => originalEdges.current.map(e => ({ ...e })));
    setTimeout(() => fitView({ padding: 0.12, duration: 500 }), 30);
  }, [setNodes, setEdges, fitView]);

  if (!mapData) {
    return (
      <>
        <input ref={fileInputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleFileChange} />
        <WelcomeScreen onNew={() => { setShowEditor(true); setMapData({ nodes: [], crossLinks: [] }); }} onImport={handleImportCSV} />
        {showEditor && mapData === null && (
          <EditorPanel
            data={{ nodes: [], crossLinks: [] }}
            onSave={d => { applyData(d); setShowEditor(false); }}
            onClose={() => setShowEditor(false)}
            onExportCSV={() => {}}
            onImportCSV={handleImportCSV}
          />
        )}
      </>
    );
  }

  return (
    <div style={{ height: "100vh", width: "100vw", background: "#070b18", position: "relative" }}>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#070b18;overflow:hidden}
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.8)}}
        @keyframes fadeUp{from{opacity:0;transform:translateX(-50%) translateY(12px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        .react-flow__node{transition:opacity .35s,filter .35s,transform .35s}
        .react-flow__edge{transition:opacity .35s}
        .react-flow__handle{transition:opacity .2s,transform .2s}
        .react-flow__controls{background:rgba(10,14,28,.88)!important;border:1px solid rgba(255,255,255,.08)!important;border-radius:12px!important;backdrop-filter:blur(14px)!important;overflow:hidden}
        .react-flow__controls-button{background:transparent!important;border:none!important;border-bottom:1px solid rgba(255,255,255,.05)!important;color:#94a3b8!important;fill:#94a3b8!important}
        .react-flow__controls-button:hover{background:rgba(99,102,241,.18)!important;color:#6366f1!important;fill:#6366f1!important}
        .react-flow__minimap{background:rgba(10,14,28,.88)!important;border:1px solid rgba(255,255,255,.08)!important;border-radius:12px!important;backdrop-filter:blur(14px)!important}
        .react-flow__attribution{display:none}
        select option{background:#0d1220;color:#f1f5f9}
      `}</style>

      <input ref={fileInputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleFileChange} />

      {/* Header */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 20,
        padding: "14px 22px", display: "flex", alignItems: "center", gap: 12,
        background: "linear-gradient(to bottom,rgba(7,11,24,.97) 60%,transparent)",
        pointerEvents: "none",
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: "50%",
          background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 17, boxShadow: "0 0 24px #6366f155",
        }}>🌐</div>
        <div>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 17, color: "#f8fafc", letterSpacing: "0.02em", lineHeight: 1 }}>MindFlow</h1>
          <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 9, color: "#334155", marginTop: 2 }}>
            {mapData.nodes.length} node · {mapData.crossLinks.length} cross-link
          </p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 7, pointerEvents: "auto" }}>
          <button onClick={() => setShowEditor(true)} style={{
            padding: "7px 14px", borderRadius: 8,
            background: "rgba(99,102,241,0.16)", border: "1px solid rgba(99,102,241,0.3)",
            color: "#a5b4fc", fontFamily: "'DM Sans',sans-serif", fontSize: 11, cursor: "pointer", fontWeight: 600,
          }}>✏️ Edit Database</button>
          <button onClick={handleImportCSV} style={{
            padding: "7px 12px", borderRadius: 8,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            color: "#475569", fontFamily: "'DM Sans',sans-serif", fontSize: 11, cursor: "pointer",
          }}>📂 Load</button>
          <button onClick={handleExportCSV} style={{
            padding: "7px 12px", borderRadius: 8,
            background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.28)",
            color: "#34d399", fontFamily: "'DM Sans',sans-serif", fontSize: 11, cursor: "pointer", fontWeight: 600,
          }}>💾 Simpan</button>
        </div>
      </div>

      {/* Connect toggle */}
      <div onClick={() => setConnectMode(m => !m)} style={{
        position: "absolute", top: 66, right: 14, zIndex: 20,
        background: connectMode ? "rgba(99,102,241,0.22)" : "rgba(10,14,28,0.85)",
        border: `1px solid ${connectMode ? "#6366f1" : "rgba(255,255,255,0.07)"}`,
        borderRadius: 8, padding: "6px 12px",
        fontFamily: "'DM Sans',sans-serif", fontSize: 10,
        color: connectMode ? "#a5b4fc" : "#334155",
        cursor: "pointer", backdropFilter: "blur(12px)", userSelect: "none",
      }}>
        {connectMode ? "🔗 Koneksi: ON" : "🔗 Koneksi: OFF"}
      </div>

      <ReactFlow
        nodes={nodes} edges={edges}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        onConnect={onConnect} onNodeClick={onNodeClick} onPaneClick={onPaneClick}
        nodeTypes={nodeTypes} edgeTypes={edgeTypes}
        fitView fitViewOptions={{ padding: 0.12 }}
        minZoom={0.2} maxZoom={2.5}
        nodesDraggable={!connectMode} connectOnClick={connectMode}
        defaultEdgeOptions={{ type: "crossEdge", markerEnd: { type: MarkerType.ArrowClosed } }}
      >
        <Background variant={BackgroundVariant.Dots} gap={30} size={1} color="rgba(99,102,241,0.12)" />
        <Controls position="bottom-right" />
        <MiniMap position="top-right" style={{ marginTop: 62 }}
          nodeColor={n => (n.data as NodeData)?.color ?? "#6366f1"}
          maskColor="rgba(7,11,24,0.75)"
        />
        <Panel position="bottom-left">
          <div style={{
            background: "rgba(10,14,28,0.75)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 10, padding: "9px 14px",
            fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: "#334155",
            backdropFilter: "blur(8px)", lineHeight: 2,
          }}>
            <div>🖱️ Scroll — zoom</div>
            <div>✋ Drag — pan</div>
            <div>🔵 Klik node — fokus</div>
            <div>🌑 Klik canvas — reset</div>
          </div>
        </Panel>
      </ReactFlow>

      <InfoPanel node={selectedNode} />

      {showEditor && (
        <EditorPanel
          data={mapData}
          onSave={d => { applyData(d); }}
          onClose={() => setShowEditor(false)}
          onExportCSV={handleExportCSV}
          onImportCSV={handleImportCSV}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export default function EkonomiGlobalPage() {
  return (
    <ReactFlowProvider>
      <MindMapInner />
    </ReactFlowProvider>
  );
}
