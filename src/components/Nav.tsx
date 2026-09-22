"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconAds, IconClients, IconPipeline, IconToday } from "./icons";

const TABS = [
  { href: "/", label: "Hoy", Icon: IconToday },
  { href: "/pipeline", label: "Pipeline", Icon: IconPipeline },
  { href: "/clientes", label: "Clientes", Icon: IconClients },
  { href: "/anuncios", label: "Anuncios", Icon: IconAds },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Tabs fijas abajo en el celular; en desktop viven en la barra de arriba. */
export function BottomTabs() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-4">
        {TABS.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-[0.68rem] font-semibold ${
                  active ? "text-brand" : "text-muted"
                }`}
              >
                <Icon className="h-[22px] w-[22px]" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function TopTabs() {
  const pathname = usePathname();
  return (
    <nav className="hidden md:flex md:items-center md:gap-1">
      {TABS.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
              active ? "bg-brand text-white" : "text-muted hover:text-ink"
            }`}
          >
            <Icon className="h-[18px] w-[18px]" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
