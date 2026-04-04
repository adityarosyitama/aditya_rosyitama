import type { Metadata } from "next";
import "@xyflow/react/dist/style.css";

export const metadata: Metadata = {
  title: "MindFlow — Peta Pikiran Interaktif",
  description: "Visualisasi ide dan konsep dengan mind map interaktif berbasis React Flow",
};

export default function MindMapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap"
        rel="stylesheet"
      /> */}
      {children}
    </>
  );
}
