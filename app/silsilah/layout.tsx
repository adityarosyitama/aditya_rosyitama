import type { Metadata } from "next";
import { Playfair_Display, Lato } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const lato = Lato({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  variable: "--font-lato",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Silsilah Keluarga",
  description:
    "Jelajahi silsilah dan hubungan antar anggota keluarga dalam visualisasi pohon keluarga yang interaktif.",
  keywords: ["silsilah", "pohon keluarga", "family tree", "keluarga"],
  authors: [{ name: "Keluarga Besar" }],

  openGraph: {
    title: "🌳 Silsilah Keluarga",
    description:
      "Jelajahi silsilah dan hubungan antar anggota keluarga dalam visualisasi pohon keluarga yang interaktif.",
    type: "website",
    locale: "id_ID",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Silsilah Keluarga - Pohon Keluarga Interaktif",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "🌳 Silsilah Keluarga",
    description:
      "Jelajahi silsilah dan hubungan antar anggota keluarga dalam visualisasi pohon keluarga yang interaktif.",
    images: ["/og-image.png"],
  },

  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },

  themeColor: "#1a1a2e",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${playfair.variable} ${lato.variable}`}>
      <body>
        <div className="app-shell">
          {/* Header */}
          <header className="site-header">
            <div className="header-inner">
              <div className="header-brand">
                <span className="brand-icon">🌳</span>
                <div className="brand-text">
                  <h1 className="brand-title">Silsilah Keluarga</h1>
                  <p className="brand-subtitle">Pohon Keluarga Interaktif</p>
                </div>
              </div>
              <div className="header-ornament">
                <span className="ornament-line" />
                <span className="ornament-diamond">◆</span>
                <span className="ornament-line" />
              </div>
            </div>
          </header>

          {/* Main */}
          <main className="site-main">{children}</main>

          {/* Footer */}
          <footer className="site-footer">
            <p className="footer-text">
              Dibuat dengan <span className="footer-heart">♥</span> untuk
              mengenang dan merayakan ikatan keluarga
            </p>
          </footer>
        </div>

        <style>{`
          :root {
            --font-playfair: 'Playfair Display', serif;
            --font-lato: 'Lato', sans-serif;

            --color-bg:        #0f0f1a;
            --color-surface:   #1a1a2e;
            --color-border:    #2e2e4a;
            --color-gold:      #c9a84c;
            --color-gold-soft: #e8c97a;
            --color-text:      #e8e4d8;
            --color-muted:     #8a8070;
            --color-accent:    #7b5ea7;
          }

          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

          html, body {
            height: 100%;
            background: var(--color-bg);
            color: var(--color-text);
            font-family: var(--font-lato), sans-serif;
            -webkit-font-smoothing: antialiased;
          }

          .app-shell {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            background:
              radial-gradient(ellipse 80% 40% at 50% 0%, rgba(123,94,167,0.12) 0%, transparent 70%),
              radial-gradient(ellipse 60% 30% at 80% 100%, rgba(201,168,76,0.08) 0%, transparent 60%),
              var(--color-bg);
          }

          /* ── Header ── */
          .site-header {
            position: relative;
            z-index: 10;
            border-bottom: 1px solid var(--color-border);
            background: rgba(26,26,46,0.85);
            backdrop-filter: blur(12px);
          }

          .header-inner {
            max-width: 1400px;
            margin: 0 auto;
            padding: 18px 32px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
          }

          .header-brand {
            display: flex;
            align-items: center;
            gap: 14px;
          }

          .brand-icon {
            font-size: 2.4rem;
            filter: drop-shadow(0 0 12px rgba(201,168,76,0.5));
            animation: float 4s ease-in-out infinite;
          }

          @keyframes float {
            0%, 100% { transform: translateY(0); }
            50%       { transform: translateY(-5px); }
          }

          .brand-text {
            display: flex;
            flex-direction: column;
          }

          .brand-title {
            font-family: var(--font-playfair), serif;
            font-size: clamp(1.4rem, 3vw, 2rem);
            font-weight: 700;
            color: var(--color-gold-soft);
            letter-spacing: 0.04em;
            line-height: 1.1;
            text-shadow: 0 0 30px rgba(201,168,76,0.3);
          }

          .brand-subtitle {
            font-family: var(--font-lato), sans-serif;
            font-size: 0.72rem;
            font-weight: 300;
            color: var(--color-muted);
            letter-spacing: 0.2em;
            text-transform: uppercase;
          }

          /* Ornament baris emas */
          .header-ornament {
            display: flex;
            align-items: center;
            gap: 10px;
            opacity: 0.5;
          }

          .ornament-line {
            display: block;
            width: 60px;
            height: 1px;
            background: linear-gradient(90deg, transparent, var(--color-gold));
          }

          .ornament-line:last-child {
            background: linear-gradient(90deg, var(--color-gold), transparent);
          }

          .ornament-diamond {
            font-size: 0.55rem;
            color: var(--color-gold);
          }

          /* ── Main ── */
          .site-main {
            flex: 1;
            display: flex;
            flex-direction: column;
          }

          /* ── Footer ── */
          .site-footer {
            border-top: 1px solid var(--color-border);
            padding: 14px 32px;
            text-align: center;
            background: rgba(26,26,46,0.6);
          }

          .footer-text {
            font-size: 0.78rem;
            color: var(--color-muted);
            font-weight: 300;
            letter-spacing: 0.05em;
          }

          .footer-heart {
            color: #c0567a;
            font-size: 0.9rem;
          }

          /* ── Responsif ── */
          @media (max-width: 600px) {
            .header-inner { padding: 14px 18px; }
            .ornament-line { width: 32px; }
          }
        `}</style>
      </body>
    </html>
  );
}
