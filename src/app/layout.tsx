import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { BottomTabs, TopTabs } from "@/components/Nav";
import { SearchBox } from "@/components/SearchBox";
import { isDemoMode } from "@/lib/data";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM",
  description: "Pipeline de prospectos y cobros mensuales",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1f6feb",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-UY">
      <body className="min-h-dvh">
        <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-2.5 md:px-6">
            <Link href="/" className="shrink-0 text-base font-extrabold tracking-tight">
              CRM
            </Link>
            <TopTabs />
            <div className="flex flex-1 justify-end">
              <SearchBox />
            </div>
          </div>
        </header>

        {isDemoMode() && <DemoBanner />}

        <main className="mx-auto max-w-6xl px-3 py-4 md:px-6 md:py-6">{children}</main>

        <BottomTabs />
      </body>
    </html>
  );
}

function DemoBanner() {
  return (
    <div className="border-b border-warn/30 bg-warn-bg px-3 py-2 text-center text-xs font-semibold text-warn md:px-6">
      Modo demo con datos de ejemplo — los cambios no se guardan. Cargá las claves de
      Supabase en <code className="font-mono">.env.local</code> para usarlo en serio.
    </div>
  );
}
