"use client";

import { useEffect, useRef } from "react";
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
  return rows.map((row) => {
    return {
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
    };
  });
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

// Dibuat di luar komponen agar React Compiler tidak menganalisisnya
// dan tidak ada `this` di dalam scope React
function makeCardUpdateHandler(cardUpdater: (el: Element, d: CardUpdateContext) => void) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (this: any, d: CardUpdateContext) {
    cardUpdater(this as Element, d);
  };
}

function cardUpdaterFn(element: Element, d: CardUpdateContext) {
  if (d.data.main) {
    const card = element.querySelector(".card-inner");
    if (!card) return;
    card.setAttribute("class", "card-inner");
    card.setAttribute(
      "style",
      "width: 200px; height: 70px; padding: 15px; border-radius: 5px; text-align: center;"
    );
    card.innerHTML = `${d.data.data["first name"]} ${d.data.data["last name"]}`;
  }
}

// Dibuat sekali di module level — di luar komponen, aman dari React Compiler
const cardUpdateHandler = makeCardUpdateHandler(cardUpdaterFn);

export default function FamilyTree() {
  const contRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contRef.current) return;

    
    fetch("/database.csv")
    .then((res) => res.text())
    .then((text) => {
      const rows = parseCsv(text);
      const data = csvToFamilyData(rows);

      // Tambahkan ini sebelum memanggil create(data), cek error
      const ids = new Set(data.map(n => n.id));
      data.forEach(node => {
        [...node.rels.children, ...node.rels.spouses, ...node.rels.parents].forEach(ref => {
          if (!ids.has(ref)) {
            console.warn(`⚠️ ID "${ref}" di node "${node.id}" tidak ditemukan di data!`);
          }
        });
      });

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

      f3Chart
        .setCardHtml()
        .setOnCardUpdate(cardUpdateHandler);

      f3Chart.updateTree({ initial: true });
    }

    return () => {
      const chart = document.getElementById("FamilyChart");
      if (chart) chart.innerHTML = "";
    };
  }, []);

  return (
    <div
      className="f3"
      id="FamilyChart"
      ref={contRef}
      style={{
        width: "100%",
        height: "900px",
        margin: "auto",
        backgroundColor: "rgb(33,33,33)",
        color: "#fff",
      }}
    />
  );
}
