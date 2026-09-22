import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // El badge flotante de dev tapa la primera tab en pantalla de celular.
  devIndicators: false,
  // Sin esto, Turbopack sube buscando un lockfile y termina tomando
  // /Users/alfo como raíz del proyecto. fileURLToPath y no URL.pathname:
  // el espacio de "MY CRM" viene percent-encoded.
  turbopack: { root: path.dirname(fileURLToPath(import.meta.url)) },
};

export default nextConfig;
