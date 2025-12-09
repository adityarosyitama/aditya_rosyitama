import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aditya Rosyitama - Frontend, Backend & Mobile App Developer',
  description: 'Expert in React Native, Next.js, Express.js, Python | Building scalable web & mobile apps',
  openGraph: {
    title: 'Aditya Rosyitama Portfolio',
    description: 'Full-Stack Developer Portfolio',
    images: '/og-image.jpg', // Tambah image kalau mau
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}