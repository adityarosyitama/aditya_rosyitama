"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── CSV Parser ───────────────────────────────────────────────────────────────

interface RawNode {
  id: string;
  label: string;
  type: "root" | "branch" | "leaf";
  parentId: string;
  description: string;
  color: string;
}

function parseCSV(csv: string): RawNode[] {
  const lines = csv.trim().split("\n");
  const headers = lines[0].split(",");
  return lines.slice(1).map(line => {
    // Handle commas inside quoted fields
    const cols: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQuotes = !inQuotes; continue; }
      if (line[i] === "," && !inQuotes) { cols.push(cur); cur = ""; continue; }
      cur += line[i];
    }
    cols.push(cur);

    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h.trim()] = (cols[i] ?? "").trim(); });
    return obj as unknown as RawNode;
  });
}

// ─── Cross-links definition ───────────────────────────────────────────────────
// Hubungan antar node yang bukan hubungan parent-child.
// Tambah atau hapus entri di sini untuk mengubah koneksi silang pada mind map.

const CROSS_LINKS: Array<{
  src: string;
  tgt: string;
  label: string;
  color: string;
  dashed?: boolean;
}> = [
  { src: "7",  tgt: "8",  label: "Perang Dagang",   color: "#fb7185", dashed: true },
  { src: "8",  tgt: "28", label: "Investasi BRI",   color: "#a78bfa" },
  { src: "17", tgt: "19", label: "Supply Chain",    color: "#22d3ee" },
  { src: "19", tgt: "18", label: "Chip War",        color: "#fb7185", dashed: true },
  { src: "12", tgt: "7",  label: "Petrodollar",     color: "#fbbf24" },
  { src: "14", tgt: "20", label: "EV Revolution",   color: "#10b981" },
  { src: "23", tgt: "17", label: "Tech Talent",     color: "#f472b6" },
  { src: "11", tgt: "27", label: "ASEAN+India",     color: "#a78bfa" },
  { src: "29", tgt: "30", label: "Counter WTO",     color: "#fb7185", dashed: true },
  { src: "18", tgt: "20", label: "AI Race",         color: "#06b6d4" },
  { src: "15", tgt: "25", label: "Food Security",   color: "#10b981" },
  { src: "21", tgt: "26", label: "Digital Remit",   color: "#ec4899" },
  { src: "7",  tgt: "30", label: "Regulasi",        color: "#8b5cf6" },
  { src: "24", tgt: "20", label: "EU AI Act",       color: "#67e8f9" },
  { src: "8",  tgt: "29", label: "Leadership",      color: "#f59e0b" },
  { src: "13", tgt: "27", label: "Energi Ekspor",   color: "#34d399" },
];

// ─── Layout Builder ───────────────────────────────────────────────────────────

function buildGraph(raw: RawNode[]): { nodes: Node<NodeData>[]; edges: Edge[] } {
  const nodes: Node<NodeData>[] = [];
  const edges: Edge[] = [];

  const cx = 0, cy = 0;
  const root = raw.find(r => r.type === "root")!;
  const branches = raw.filter(r => r.type === "branch");
  const leaves = raw.filter(r => r.type === "leaf");

  // Root node
  nodes.push({
    id: root.id, type: "mindNode",
    position: { x: cx - 90, y: cy - 45 },
    data: { label: root.label, type: root.type, description: root.description, color: root.color },
  });

  const branchRadius = 420;
  const branchCount = branches.length;

  branches.forEach((branch, i) => {
    const angle = (i * 2 * Math.PI) / branchCount - Math.PI / 2;
    const bx = cx + branchRadius * Math.cos(angle);
    const by = cy + branchRadius * Math.sin(angle);

    nodes.push({
      id: branch.id, type: "mindNode",
      position: { x: bx - 80, y: by - 32 },
      data: { label: branch.label, type: branch.type, description: branch.description, color: branch.color },
    });

    edges.push({
      id: `e${root.id}-${branch.id}`,
      source: root.id, target: branch.id,
      type: "smoothstep", animated: false,
      style: { stroke: branch.color, strokeWidth: 2.5, opacity: 0.65 },
      markerEnd: { type: MarkerType.ArrowClosed, color: branch.color, width: 14, height: 14 },
    });

    // Leaves of this branch
    const branchLeaves = leaves.filter(l => l.parentId === branch.id);
    const leafSpread = Math.PI * 0.65;
    const leafStep = branchLeaves.length > 1 ? leafSpread / (branchLeaves.length - 1) : 0;
    const leafRadius = 240;
    const leafStartAngle = angle - leafSpread / 2;

    branchLeaves.forEach((leaf, j) => {
      const leafAngle = branchLeaves.length === 1 ? angle : leafStartAngle + j * leafStep;
      const lx = bx + leafRadius * Math.cos(leafAngle);
      const ly = by + leafRadius * Math.sin(leafAngle);

      nodes.push({
        id: leaf.id, type: "mindNode",
        position: { x: lx - 60, y: ly - 22 },
        data: { label: leaf.label, type: leaf.type, description: leaf.description, color: leaf.color },
      });

      edges.push({
        id: `e${branch.id}-${leaf.id}`,
        source: branch.id, target: leaf.id,
        type: "smoothstep",
        style: { stroke: leaf.color, strokeWidth: 1.5, opacity: 0.5, strokeDasharray: "5 4" },
        markerEnd: { type: MarkerType.ArrowClosed, color: leaf.color, width: 10, height: 10 },
      });
    });
  });

  // Cross-connections
  CROSS_LINKS.forEach(({ src, tgt, label, color, dashed }) => {
    edges.push({
      id: `cross-${src}-${tgt}`,
      source: src, target: tgt,
      type: "crossEdge",
      data: { label, color } as CrossEdgeData,
      style: {
        stroke: color,
        strokeWidth: 1.5,
        opacity: 0.55,
        strokeDasharray: dashed ? "6 4" : undefined,
      },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 12, height: 12 },
    });
  });

  return { nodes, edges };
}

// ─── Custom Cross Edge ────────────────────────────────────────────────────────

function CrossEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data, style, markerEnd,
}: EdgeProps) {
  const edgeData = data as CrossEdgeData;
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
    curvature: 0.5,
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd as string} />
      {edgeData?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "none",
              background: "rgba(8,12,24,0.82)",
              border: `1px solid ${edgeData.color ?? "#6366f1"}44`,
              borderRadius: 6,
              padding: "2px 7px",
              fontSize: 9,
              color: edgeData.color ?? "#94a3b8",
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 500,
              letterSpacing: "0.04em",
              backdropFilter: "blur(6px)",
              whiteSpace: "nowrap",
            }}
          >
            {edgeData.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

// ─── Custom Node ──────────────────────────────────────────────────────────────

function MindNode({ data, id }: NodeProps) {
  const nodeData = data as NodeData;
  const isRoot = nodeData.type === "root";
  const isBranch = nodeData.type === "branch";
  const isDimmed = nodeData.dimmed === true;
  const isHighlighted = nodeData.highlighted === true;

  const handleStyle: React.CSSProperties = {
    background: nodeData.color,
    border: `2px solid rgba(255,255,255,0.3)`,
    width: 10,
    height: 10,
    opacity: isDimmed ? 0 : 0.8,
    transition: "opacity 0.2s, transform 0.2s",
  };

  return (
    <div
      title={nodeData.description}
      style={{
        fontFamily: "'Syne', sans-serif",
        borderRadius: isRoot ? "50%" : isBranch ? "16px" : "10px",
        border: isHighlighted
          ? `2.5px solid ${nodeData.color}`
          : `2px solid ${nodeData.color}${isDimmed ? "22" : "bb"}`,
        background: isRoot
          ? `radial-gradient(135deg, ${nodeData.color}33 0%, ${nodeData.color}55 100%)`
          : isBranch
          ? `linear-gradient(135deg, ${nodeData.color}20 0%, ${nodeData.color}38 100%)`
          : `${nodeData.color}12`,
        backdropFilter: "blur(10px)",
        color: isDimmed ? "#334155" : "#f1f5f9",
        padding: isRoot ? "26px 22px" : isBranch ? "13px 20px" : "9px 14px",
        minWidth: isRoot ? "170px" : isBranch ? "150px" : "120px",
        maxWidth: isRoot ? "170px" : isBranch ? "170px" : "145px",
        textAlign: "center",
        cursor: "crosshair",
        transition: "all 0.35s cubic-bezier(0.4,0,0.2,1)",
        opacity: isDimmed ? 0.15 : 1,
        filter: isHighlighted
          ? `brightness(1.45) drop-shadow(0 0 20px ${nodeData.color}bb)`
          : isDimmed
          ? "brightness(0.35) saturate(0.2)"
          : "brightness(1)",
        boxShadow: isHighlighted
          ? `0 0 0 2.5px ${nodeData.color}, 0 0 36px ${nodeData.color}88, 0 0 72px ${nodeData.color}33`
          : isRoot
          ? `0 0 50px ${nodeData.color}55, 0 0 100px ${nodeData.color}22`
          : isBranch
          ? `0 0 24px ${nodeData.color}33`
          : `0 2px 14px rgba(0,0,0,0.35)`,
        transform: isHighlighted ? "scale(1.08)" : isDimmed ? "scale(0.96)" : "scale(1)",
        position: "relative",
      }}
    >
      <Handle type="source" position={Position.Left}   id={`${id}-sl`} style={{ ...handleStyle, left: -5 }} />
      <Handle type="source" position={Position.Right}  id={`${id}-sr`} style={{ ...handleStyle, right: -5 }} />
      <Handle type="source" position={Position.Top}    id={`${id}-st`} style={{ ...handleStyle, top: -5 }} />
      <Handle type="source" position={Position.Bottom} id={`${id}-sb`} style={{ ...handleStyle, bottom: -5 }} />
      <Handle type="target" position={Position.Left}   id={`${id}-tl`} style={{ ...handleStyle, left: -5 }} />
      <Handle type="target" position={Position.Right}  id={`${id}-tr`} style={{ ...handleStyle, right: -5 }} />
      <Handle type="target" position={Position.Top}    id={`${id}-tt`} style={{ ...handleStyle, top: -5 }} />
      <Handle type="target" position={Position.Bottom} id={`${id}-tb`} style={{ ...handleStyle, bottom: -5 }} />

      {isRoot && (
        <div style={{
          position: "absolute", top: 10, right: 10,
          width: 8, height: 8, borderRadius: "50%",
          background: nodeData.color, boxShadow: `0 0 10px ${nodeData.color}`,
          animation: "pulse 2s infinite",
        }} />
      )}

      <div style={{
        fontSize: isRoot ? "14px" : isBranch ? "12px" : "11px",
        fontWeight: isRoot ? 800 : isBranch ? 700 : 500,
        letterSpacing: isRoot ? "0.05em" : "0.02em",
        lineHeight: 1.3,
        textShadow: isHighlighted
          ? `0 0 24px ${nodeData.color}, 0 0 8px #fff6`
          : `0 0 20px ${nodeData.color}66`,
      }}>
        {nodeData.label}
      </div>

      {(isBranch || isRoot) && (
        <div style={{
          marginTop: 5, fontSize: "9px",
          opacity: isDimmed ? 0.1 : isBranch ? 0.55 : 0.4,
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 300, letterSpacing: "0.03em",
          lineHeight: 1.4,
        }}>
          {nodeData.description.slice(0, 55)}{nodeData.description.length > 55 ? "…" : ""}
        </div>
      )}
    </div>
  );
}

const nodeTypes = { mindNode: MindNode };
const edgeTypes = { crossEdge: CrossEdge };

// ─── Relationship helpers ─────────────────────────────────────────────────────

function getRelatedNodeIds(clickedId: string, allNodes: Node<NodeData>[], allEdges: Edge[]): Set<string> {
  const related = new Set<string>([clickedId]);
  allEdges
    .filter(e => e.source === clickedId || e.target === clickedId)
    .forEach(e => {
      related.add(e.source);
      related.add(e.target);
    });
  return related;
}

// ─── Info Panel ───────────────────────────────────────────────────────────────

function InfoPanel({ node }: { node: Node<NodeData> | null }) {
  if (!node) return null;
  const d = node.data as NodeData;
  return (
    <div style={{
      position: "absolute", bottom: 32, left: "50%",
      transform: "translateX(-50%)",
      background: "rgba(10,14,28,0.94)",
      border: `1px solid ${d.color}55`,
      borderRadius: 16, padding: "16px 26px",
      color: "#e2e8f0", fontFamily: "'DM Sans', sans-serif",
      fontSize: 13, minWidth: 300, maxWidth: 420,
      backdropFilter: "blur(20px)",
      boxShadow: `0 12px 40px rgba(0,0,0,0.6), 0 0 32px ${d.color}22`,
      zIndex: 10, pointerEvents: "none",
      animation: "fadeUp 0.25s ease",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ width: 12, height: 12, borderRadius: "50%", background: d.color, boxShadow: `0 0 10px ${d.color}`, flexShrink: 0 }} />
        <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 16, color: "#f8fafc" }}>
          {d.label}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 9, opacity: 0.35, textTransform: "uppercase", letterSpacing: "0.12em", flexShrink: 0 }}>
          {d.type}
        </span>
      </div>
      <p style={{ margin: 0, opacity: 0.75, lineHeight: 1.7, fontSize: 12 }}>{d.description}</p>
    </div>
  );
}

// ─── New Cross Edge Dialog ────────────────────────────────────────────────────

interface NewEdgeDialog {
  connection: Connection;
  x: number;
  y: number;
}

function EdgeDialog({
  dialog, onConfirm, onCancel,
}: {
  dialog: NewEdgeDialog;
  onConfirm: (label: string, color: string) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("#a78bfa");
  const colors = ["#f59e0b","#10b981","#06b6d4","#ec4899","#8b5cf6","#fb7185","#22d3ee","#34d399","#fbbf24","#f472b6"];

  return (
    <div style={{
      position: "fixed", top: dialog.y, left: dialog.x,
      zIndex: 1000, background: "rgba(10,14,28,0.97)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 14, padding: "16px 20px",
      fontFamily: "'DM Sans', sans-serif",
      color: "#e2e8f0", boxShadow: "0 16px 48px rgba(0,0,0,0.7)",
      backdropFilter: "blur(20px)", minWidth: 260,
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, color: "#94a3b8", letterSpacing: "0.05em" }}>
        TAMBAH KONEKSI
      </div>
      <input
        value={label}
        onChange={e => setLabel(e.target.value)}
        placeholder="Label hubungan (opsional)"
        autoFocus
        style={{
          width: "100%", padding: "8px 12px", borderRadius: 8,
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
          color: "#f1f5f9", fontSize: 12, outline: "none", marginBottom: 12,
          fontFamily: "'DM Sans', sans-serif",
        }}
        onKeyDown={e => { if (e.key === "Enter") onConfirm(label, color); if (e.key === "Escape") onCancel(); }}
      />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {colors.map(c => (
          <div key={c} onClick={() => setColor(c)} style={{
            width: 20, height: 20, borderRadius: "50%", background: c,
            cursor: "pointer", border: color === c ? "2px solid #fff" : "2px solid transparent",
            transform: color === c ? "scale(1.2)" : "scale(1)",
            transition: "all 0.15s",
          }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => onConfirm(label, color)} style={{
          flex: 1, padding: "8px", borderRadius: 8,
          background: `${color}cc`, border: "none", color: "#fff",
          fontSize: 12, fontWeight: 600, cursor: "pointer",
          fontFamily: "'DM Sans', sans-serif",
        }}>
          Tambahkan →
        </button>
        <button onClick={onCancel} style={{
          padding: "8px 12px", borderRadius: 8,
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
          color: "#64748b", fontSize: 12, cursor: "pointer",
          fontFamily: "'DM Sans', sans-serif",
        }}>
          Batal
        </button>
      </div>
    </div>
  );
}

// ─── Inner Component ──────────────────────────────────────────────────────────

function MindMapInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node<NodeData> | null>(null);
  const [edgeDialog, setEdgeDialog] = useState<NewEdgeDialog | null>(null);
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);
  const [connectMode, setConnectMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const originalEdges = useRef<Edge[]>([]);
  const { fitView, setCenter } = useReactFlow();

  // ── Load data from CSV ──────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/database_mindmap.csv")
      .then(res => {
        if (!res.ok) throw new Error(`Gagal memuat CSV: ${res.status}`);
        return res.text();
      })
      .then(text => {
        const raw = parseCSV(text);
        const graph = buildGraph(raw);
        setNodes(graph.nodes);
        setEdges(graph.edges);
        originalEdges.current = graph.edges;
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, [setNodes, setEdges]);

  const onConnect = useCallback((params: Connection) => {
    setPendingConnection(params);
    setEdgeDialog({ connection: params, x: window.innerWidth / 2 - 130, y: window.innerHeight / 2 - 120 });
  }, []);

  const confirmEdge = useCallback((label: string, color: string) => {
    if (!pendingConnection) return;
    const newEdge: Edge = {
      id: `cross-${pendingConnection.source}-${pendingConnection.target}-${Date.now()}`,
      source: pendingConnection.source!,
      target: pendingConnection.target!,
      type: "crossEdge",
      data: { label, color } as CrossEdgeData,
      style: { stroke: color, strokeWidth: 1.5, opacity: 0.6 },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 12, height: 12 },
    };
    setEdges(eds => [...eds, newEdge]);
    originalEdges.current = [...originalEdges.current, newEdge];
    setEdgeDialog(null);
    setPendingConnection(null);
  }, [pendingConnection, setEdges]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const clicked = node as Node<NodeData>;
    setSelectedNode(clicked);

    setNodes(currentNodes => {
      const relatedIds = getRelatedNodeIds(clicked.id, currentNodes, originalEdges.current);
      return currentNodes.map(n => ({
        ...n,
        data: {
          ...n.data,
          dimmed: !relatedIds.has(n.id),
          highlighted: relatedIds.has(n.id),
        },
      }));
    });

    setEdges(currentEdges => {
      const relatedIds = getRelatedNodeIds(clicked.id, [], currentEdges);
      return currentEdges.map(e => {
        const linked = relatedIds.has(e.source) && relatedIds.has(e.target);
        const origStyle = originalEdges.current.find(oe => oe.id === e.id)?.style ?? {};
        const origColor = (origStyle as { stroke?: string }).stroke ?? "#6366f1";
        return {
          ...e,
          animated: linked,
          style: linked
            ? { ...origStyle, opacity: 1, strokeWidth: ((origStyle as { strokeWidth?: number }).strokeWidth ?? 2) * 1.6, filter: `drop-shadow(0 0 8px ${origColor})` }
            : { ...origStyle, opacity: 0.05, strokeWidth: 1, filter: "none" },
        };
      });
    });

    setTimeout(() => {
      setCenter(node.position.x + 80, node.position.y + 40, { zoom: 1.1, duration: 650 });
    }, 30);
  }, [setNodes, setEdges, setCenter]);

  const onPaneClick = useCallback(() => {
    if (edgeDialog) return;
    setSelectedNode(null);
    setNodes(ns => ns.map(n => ({ ...n, data: { ...n.data, dimmed: false, highlighted: false } })));
    setEdges(() => originalEdges.current.map(e => ({ ...e })));
    setTimeout(() => fitView({ padding: 0.12, duration: 500 }), 30);
  }, [setNodes, setEdges, fitView, edgeDialog]);

  // ── Loading / Error states ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        height: "100vh", width: "100vw", background: "#070b18",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: 16, fontFamily: "'DM Sans', sans-serif",
      }}>
        <div style={{
          width: 36, height: 36, border: "3px solid #6366f144",
          borderTop: "3px solid #6366f1", borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ color: "#475569", fontSize: 13 }}>Memuat database_mindmap.csv…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        height: "100vh", width: "100vw", background: "#070b18",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: 12, fontFamily: "'DM Sans', sans-serif",
      }}>
        <span style={{ fontSize: 32 }}>⚠️</span>
        <span style={{ color: "#fb7185", fontSize: 14 }}>{error}</span>
        <span style={{ color: "#334155", fontSize: 12 }}>
          Pastikan file <code style={{ color: "#6366f1" }}>database_mindmap.csv</code> ada di folder <code style={{ color: "#6366f1" }}>public/</code>
        </span>
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", width: "100vw", background: "#070b18", position: "relative" }}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #070b18; overflow: hidden; }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(0.8); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateX(-50%) translateY(12px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .react-flow__node { transition: opacity 0.35s, filter 0.35s, transform 0.35s; }
        .react-flow__node:hover .react-flow__handle { opacity: 1 !important; transform: scale(1.4) !important; }
        .react-flow__edge { transition: opacity 0.35s; }
        .react-flow__handle { transition: opacity 0.2s, transform 0.2s; }

        .react-flow__controls {
          background: rgba(10,14,28,0.88) !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
          border-radius: 12px !important;
          backdrop-filter: blur(14px) !important;
          overflow: hidden;
        }
        .react-flow__controls-button {
          background: transparent !important; border: none !important;
          border-bottom: 1px solid rgba(255,255,255,0.05) !important;
          color: #94a3b8 !important; fill: #94a3b8 !important;
        }
        .react-flow__controls-button:hover {
          background: rgba(99,102,241,0.18) !important;
          color: #6366f1 !important; fill: #6366f1 !important;
        }
        .react-flow__minimap {
          background: rgba(10,14,28,0.88) !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
          border-radius: 12px !important; backdrop-filter: blur(14px) !important;
        }
        .react-flow__attribution { display: none; }
      `}</style>

      {/* Header */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        padding: "18px 28px", display: "flex", alignItems: "center", gap: 14,
        zIndex: 20,
        background: "linear-gradient(to bottom, rgba(7,11,24,0.97) 55%, transparent)",
        pointerEvents: "none",
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: "50%",
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, boxShadow: "0 0 24px #6366f155",
        }}>🌐</div>
        <div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 20, color: "#f8fafc", letterSpacing: "0.02em", lineHeight: 1 }}>
            Ekonomi Global
          </h1>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#475569", marginTop: 3, letterSpacing: "0.05em" }}>
            Peta Interkoneksi Kekuatan Ekonomi Dunia
          </p>
        </div>

        {/* Branch legend */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 16, pointerEvents: "auto", flexWrap: "wrap" }}>
          {[
            { label: "Ekonomi", color: "#f59e0b" },
            { label: "Komoditas", color: "#10b981" },
            { label: "Teknologi", color: "#06b6d4" },
            { label: "SDM", color: "#ec4899" },
            { label: "Perdagangan", color: "#8b5cf6" },
            { label: "Cross-link ···", color: "#fb7185" },
          ].map(item => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: "#64748b" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.color }} />
              {item.label}
            </div>
          ))}
        </div>
      </div>

      {/* Connect mode toggle */}
      <div style={{
        position: "absolute", top: 72, right: 16, zIndex: 20,
        background: connectMode ? "rgba(99,102,241,0.25)" : "rgba(10,14,28,0.85)",
        border: `1px solid ${connectMode ? "#6366f1" : "rgba(255,255,255,0.08)"}`,
        borderRadius: 10, padding: "8px 14px",
        fontFamily: "'DM Sans', sans-serif", fontSize: 11,
        color: connectMode ? "#a5b4fc" : "#475569",
        cursor: "pointer", backdropFilter: "blur(12px)",
        transition: "all 0.2s",
        userSelect: "none",
      }} onClick={() => setConnectMode(m => !m)}>
        {connectMode ? "🔗 Mode Koneksi: ON" : "🔗 Mode Koneksi: OFF"}
      </div>

      {/* React Flow */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.1 }}
        minZoom={0.2}
        maxZoom={2.5}
        nodesDraggable={!connectMode}
        connectOnClick={connectMode}
        defaultEdgeOptions={{
          type: "crossEdge",
          markerEnd: { type: MarkerType.ArrowClosed },
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={30} size={1} color="rgba(99,102,241,0.12)" />
        <Controls position="bottom-right" />
        <MiniMap
          position="top-right"
          style={{ marginTop: 68 }}
          nodeColor={(n) => (n.data as NodeData)?.color ?? "#6366f1"}
          maskColor="rgba(7,11,24,0.75)"
        />

        <Panel position="bottom-left">
          <div style={{
            background: "rgba(10,14,28,0.75)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 10, padding: "10px 16px",
            fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#334155",
            backdropFilter: "blur(8px)", lineHeight: 2,
          }}>
            <div>🖱️ Scroll — zoom in/out</div>
            <div>✋ Drag canvas — pan</div>
            <div>🔵 Klik node — fokus koneksi</div>
            <div>🌑 Klik canvas — reset view</div>
            <div>🔗 Mode Koneksi — tarik node ke node</div>
          </div>
        </Panel>
      </ReactFlow>

      <InfoPanel node={selectedNode} />

      {edgeDialog && (
        <EdgeDialog
          dialog={edgeDialog}
          onConfirm={confirmEdge}
          onCancel={() => { setEdgeDialog(null); setPendingConnection(null); }}
        />
      )}
    </div>
  );
}

// ─── Page Export ──────────────────────────────────────────────────────────────

export default function EkonomiGlobalPage() {
  return (
    <ReactFlowProvider>
      <MindMapInner />
    </ReactFlowProvider>
  );
}
