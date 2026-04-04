"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as f3 from "family-chart";
import "family-chart/styles/family-chart.css";

interface CsvRow {
  id: string;
  first_name: string;
  last_name: string;
  birthday: string;
  avatar: string;
  gender: string;
  spouses: string;
  children: string;
  parents: string;
}

interface FamilyNode {
  id: string;
  data: {
    "first name": string;
    "last name": string;
    birthday: string;
    avatar: string;
    gender: "M" | "F" | undefined;
  };
  rels: {
    parents: string[];
    spouses: string[];
    children: string[];
  };
}

interface CardUpdateContext {
  data: {
    main?: boolean;
    data: {
      "first name": string;
      "last name": string;
    };
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type F3ChartInstance = any;

function parseIds(value: string): string[] {
  if (!value || value === "0") return [];
  return value.split("|").filter((id) => id && id !== "0");
}

function parseGender(value: string): "M" | "F" | undefined {
  const trimmed = value.trim();
  if (trimmed === "M") return "M";
  if (trimmed === "F") return "F";
  return undefined;
}

function csvToFamilyData(rows: CsvRow[]): FamilyNode[] {
  return rows.map((row) => ({
    id: row.id,
    data: {
      "first name": row.first_name?.trim() ?? "",
      "last name": row.last_name?.trim() ?? "",
      birthday: row.birthday?.trim() ?? "",
      avatar: row.avatar?.trim() ?? "",
      gender: parseGender(row.gender),
    },
    rels: {
      parents: parseIds(row.parents),
      spouses: parseIds(row.spouses),
      children: parseIds(row.children),
    },
  }));
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",") as (keyof CsvRow)[];

  return lines.slice(1).map((line) => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current);

    const row = {} as CsvRow;
    headers.forEach((header, i) => {
      row[header] = values[i]?.trim() ?? "";
    });
    return row;
  });
}

function makeCardUpdateHandler(
  cardUpdater: (el: Element, d: CardUpdateContext) => void
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (this: any, d: CardUpdateContext) {
    cardUpdater(this as Element, d);
  };
}

function cardUpdaterFn(element: Element, d: CardUpdateContext) {
  const card = element.querySelector(".card-inner");
  if (!card) return;
  card.setAttribute("class", "card-inner");
  card.setAttribute(
    "style",
    "width: 200px; height: 70px; padding: 15px; border-radius: 5px; text-align: center; color: black;"
  );
  card.innerHTML = `<span style="color: black; font-weight: ${d.data.main ? "700" : "500"};">${d.data.data["first name"]} ${d.data.data["last name"]}</span>`;
}

const cardUpdateHandler = makeCardUpdateHandler(cardUpdaterFn);

export default function FamilyTree() {
  const contRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<F3ChartInstance>(null);
  const allDataRef = useRef<FamilyNode[]>([]);
  const rootIdRef = useRef<string>("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FamilyNode[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  // Navigate tree to a specific node by id
  const navigateTo = useCallback((id: string) => {
    if (!chartRef.current) return;
    // API yang benar: updateMainId(id) lalu updateTree()
    chartRef.current.updateMainId(id);
    chartRef.current.updateTree({ initial: false });
    setSearchQuery("");
    setShowDropdown(false);
  }, []);

  // Go back to root/initial node
  const handleBackToRoot = useCallback(() => {
    if (rootIdRef.current) navigateTo(rootIdRef.current);
  }, [navigateTo]);

  // Filter nodes by name as user types
  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const query = e.target.value;
      setSearchQuery(query);

      if (!query.trim()) {
        setSearchResults([]);
        setShowDropdown(false);
        return;
      }

      const lower = query.toLowerCase();
      const results = allDataRef.current
        .filter((node) => {
          const fullName =
            `${node.data["first name"]} ${node.data["last name"]}`.toLowerCase();
          return fullName.includes(lower);
        })
        .slice(0, 8); // max 8 suggestions

      setSearchResults(results);
      setShowDropdown(results.length > 0);
    },
    []
  );

  // Inject global CSS override untuk paksa warna teks hitam di semua kartu
  useEffect(() => {
    const style = document.createElement("style");
    style.id = "family-chart-text-override";
    style.textContent = `
      #FamilyChart .card-inner,
      #FamilyChart .card-inner *,
      #FamilyChart .card span,
      #FamilyChart text,
      #FamilyChart .card-body,
      #FamilyChart .card-body * {
        color: black !important;
        fill: black !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.getElementById("family-chart-text-override")?.remove();
    };
  }, []);

  useEffect(() => {
    if (!contRef.current) return;

    fetch("/database.csv")
      .then((res) => res.text())
      .then((text) => {
        const rows = parseCsv(text);
        const data = csvToFamilyData(rows);
        allDataRef.current = data;

        // Warn on broken refs
        const ids = new Set(data.map((n) => n.id));
        data.forEach((node) => {
          [...node.rels.children, ...node.rels.spouses, ...node.rels.parents].forEach(
            (ref) => {
              if (!ids.has(ref)) {
                console.warn(
                  `⚠️ ID "${ref}" di node "${node.id}" tidak ditemukan di data!`
                );
              }
            }
          );
        });

        // Store root id (first node)
        if (data.length > 0) rootIdRef.current = data[0].id;

        create(data);
      })
      .catch((err: unknown) => console.error(err));

    function create(data: FamilyNode[]) {
      const f3Chart = f3
        .createChart(
          "#FamilyChart",
          data as unknown as Parameters<typeof f3.createChart>[1]
        )
        .setTransitionTime(1000)
        .setCardXSpacing(250)
        .setCardYSpacing(150);

      f3Chart.setCardHtml().setOnCardUpdate(cardUpdateHandler);

      f3Chart.updateTree({ initial: true });

      // Store chart instance for external control
      chartRef.current = f3Chart;
    }

    return () => {
      const chart = document.getElementById("FamilyChart");
      if (chart) chart.innerHTML = "";
      chartRef.current = null;
    };
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* ── Header ── */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "10px 16px",
          backgroundColor: "rgb(24, 24, 24)",
          borderBottom: "1px solid rgb(55, 55, 55)",
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        {/* Back to root button */}
        <button
          onClick={handleBackToRoot}
          title="Kembali ke tampilan awal"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "7px 14px",
            backgroundColor: "rgb(55, 55, 55)",
            color: "#fff",
            border: "1px solid rgb(80, 80, 80)",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "13px",
            whiteSpace: "nowrap",
            transition: "background-color 0.2s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "rgb(75, 75, 75)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "rgb(55, 55, 55)")
          }
        >
          {/* Arrow icon */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Tampilan Awal
        </button>

        {/* Search box */}
        <div style={{ position: "relative", flex: 1, maxWidth: "360px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: "rgb(45, 45, 45)",
              border: "1px solid rgb(80, 80, 80)",
              borderRadius: "6px",
              padding: "0 10px",
            }}
          >
            {/* Search icon */}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#aaa"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0 }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Cari nama anggota keluarga..."
              value={searchQuery}
              onChange={handleSearch}
              onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
              onFocus={() =>
                searchResults.length > 0 && setShowDropdown(true)
              }
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#fff",
                fontSize: "13px",
                padding: "8px 8px",
              }}
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                  setShowDropdown(false);
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#aaa",
                  cursor: "pointer",
                  padding: "0",
                  lineHeight: 1,
                  fontSize: "16px",
                }}
                title="Hapus pencarian"
              >
                ×
              </button>
            )}
          </div>

          {/* Dropdown results */}
          {showDropdown && (
            <ul
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                right: 0,
                backgroundColor: "rgb(40, 40, 40)",
                border: "1px solid rgb(80, 80, 80)",
                borderRadius: "6px",
                listStyle: "none",
                margin: 0,
                padding: "4px 0",
                zIndex: 100,
                boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
                maxHeight: "280px",
                overflowY: "auto",
              }}
            >
              {searchResults.map((node) => (
                <li
                  key={node.id}
                  onMouseDown={() => navigateTo(node.id)}
                  style={{
                    padding: "9px 14px",
                    cursor: "pointer",
                    color: "#fff",
                    fontSize: "13px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "rgb(60, 60, 60)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  <span>
                    {node.data["first name"]} {node.data["last name"]}
                  </span>
                  <span style={{ color: "#888", fontSize: "11px" }}>
                    {node.data.gender === "M"
                      ? "♂"
                      : node.data.gender === "F"
                      ? "♀"
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Title */}
        <span
          style={{
            color: "#ccc",
            fontSize: "14px",
            fontWeight: 600,
            marginLeft: "auto",
            whiteSpace: "nowrap",
          }}
        >
          🌳 Silsilah Keluarga
        </span>
      </header>

      {/* ── Chart ── */}
      <div
        className="f3"
        id="FamilyChart"
        ref={contRef}
        style={{
          flex: 1,
          width: "100%",
          backgroundColor: "rgb(33,33,33)",
          color: "#fff",
        }}
      />
    </div>
  );
}
