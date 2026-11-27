// Minimale Node-Typen fuer tools/build-data.ts (kein @types/node im Projekt).
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function writeFileSync(path: string, data: string, encoding?: 'utf8'): void;
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, opts?: { recursive?: boolean }): void;
}
declare const process: { exit(code?: number): never };
