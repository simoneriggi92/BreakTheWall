import { resolve, sep } from 'node:path';

/**
 * The file `btw://app<pathname>` serves from the renderer root, or null when the path leaves it. The root may sit
 * inside the packaged `app.asar`; Electron's file loading reads it there as from a folder.
 */
export function appFilePath(root: string, pathname: string): string | null {
  let decoded: string;
  try { decoded = decodeURIComponent(pathname === '/' ? '/index.html' : pathname); } catch { return null; }
  const path = resolve(root, '.' + decoded);
  return path.startsWith(root + sep) ? path : null;
}

/** Run in the window by the start check (`BTW_SMOKE_TEST=1`): true once the library home and its examples are drawn. */
export const LIBRARY_DRAWN = `Boolean(document.querySelector('main.library-home #disassemblies-heading'))`;
