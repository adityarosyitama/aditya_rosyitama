'use client';

import React, { useEffect, useRef } from 'react';
import 'family-chart/styles/family-chart.css';
import styles from './page.module.css';

interface FamilyMember {
  id: string;
  data: {
    'first name': string;
    'last name': string;
    birthday: string;
    avatar: string;
    gender: 'M' | 'F';
  };
  rels: {
    spouses?: string[];
    children?: string[];
    parents?: string[];
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onCardUpdate(this: HTMLElement, d: any) {
  if (d.data.main) {
    const card = this.querySelector('.card-inner') as HTMLElement | null;
    if (!card) return;
    card.style.cssText =
      'width:200px;height:70px;padding:15px;border-radius:5px;text-align:center;';
    card.innerHTML = `${d.data.data['first name']} ${d.data.data['last name']}`;
  }
}

function parseCsvToFamilyData(csvText: string): FamilyMember[] {
  const lines = csvText.trim().split('\n');
  const rows = lines.slice(1);

  return rows
    .map((row): FamilyMember | null => {
      const cols: string[] = [];
      let current = '';
      let inQuote = false;

      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '"') {
          inQuote = !inQuote;
        } else if (ch === ',' && !inQuote) {
          cols.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      cols.push(current.trim());

      const clean = (val?: string) =>
        (val ?? '').replace(/^"|"$/g, '').trim();

      const splitIds = (val?: string): string[] =>
        clean(val)
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean);

      const id        = clean(cols[0]);
      const firstName = clean(cols[1]);
      const lastName  = clean(cols[2]);
      const birthday  = clean(cols[3]);
      const avatar    = clean(cols[4]);
      const genderRaw = clean(cols[5]);
      const gender: 'M' | 'F' = genderRaw === 'F' ? 'F' : 'M';

      const spouses  = splitIds(cols[6]);
      const children = splitIds(cols[7]);
      const parents  = splitIds(cols[8]);

      if (!id) return null;

      const rels: FamilyMember['rels'] = {};
      if (spouses.length)  rels.spouses  = spouses;
      if (children.length) rels.children = children;
      if (parents.length)  rels.parents  = parents;

      return {
        id,
        data: {
          'first name': firstName,
          'last name':  lastName,
          birthday,
          avatar,
          gender,
        },
        rels,
      };
    })
    .filter((item): item is FamilyMember => item !== null);
}

export default function SilsilahPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;

    const resizeChart = () => {
      if (!containerRef.current) return;
      const svg = containerRef.current.querySelector('svg');
      if (svg) {
        svg.setAttribute('width', String(window.innerWidth));
        svg.setAttribute('height', String(window.innerHeight));
      }
    };

    const initChart = async () => {
      try {
        const res = await fetch('/database.csv');
        if (!res.ok) throw new Error('Gagal mengambil /database.csv');
        const csvText = await res.text();

        if (cancelled || !containerRef.current) return;

        const familyData = parseCsvToFamilyData(csvText);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const f3 = await import('family-chart') as any;

        if (cancelled || !containerRef.current) return;

        const f3Chart = f3
          .createChart('#FamilyChart', familyData)
          .setTransitionTime(1000)
          .setCardXSpacing(250)
          .setCardYSpacing(150);

        f3Chart
          .setCardHtml()
          .setOnCardUpdate(onCardUpdate);

        f3Chart.updateTree({ initial: true });

        requestAnimationFrame(() => {
          resizeChart();
        });
      } catch (err) {
        console.error('FamilyTree error:', err);
      }
    };

    initChart();

    window.addEventListener('resize', resizeChart);

    return () => {
      cancelled = true;
      window.removeEventListener('resize', resizeChart);
      container.innerHTML = '';
    };
  }, []);

  return (
    <div
      id="FamilyChart"
      ref={containerRef}
      className={styles.chartContainer}
    />
  );
}
