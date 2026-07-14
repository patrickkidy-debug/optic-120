/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Identifiant de build injecté par Vite (voir `define` dans vite.config.ts). */
declare const __SW_VERSION__: string;
