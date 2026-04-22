import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "Vitalis API",
  description: "Vitalis Backend API — powered by Next.js & Turso",
};

// Root layout wajib ada di App Router meski tidak ada halaman frontend.
// Seluruh endpoint berada di /api/* sehingga layout ini tidak pernah dirender.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
