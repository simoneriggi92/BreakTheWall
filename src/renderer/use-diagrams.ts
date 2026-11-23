import { useEffect, type RefObject } from 'react';
import { renderDiagram } from './diagrams';
import type { Theme } from './preferences';
import { mountSvg } from './svg-mount';

/**
 * Draws the Mermaid placeholders `renderMarkdown` left in `host`, each in its own figure, after the text is in the
 * page; a diagram that does not parse keeps its code, with `failedNote` under it. Shared by a source read as a
 * document and a round's question, so both draw under the same content policy. `rendered` is the Markdown output the
 * host shows: a new one draws again.
 */
export function useDiagrams(host: RefObject<HTMLElement | null>, rendered: { diagrams: number }, theme: Theme, failedNote: string, active = true) {
  useEffect(() => {
    const el = host.current;
    if (!el || !rendered.diagrams || !active) return;
    let live = true;
    const unmount: (() => void)[] = [];
    el.querySelectorAll<HTMLElement>('.md-diagram').forEach(figure => {
      const code = figure.querySelector('.md-diagram-source')?.textContent ?? '';
      void renderDiagram(code, theme).then(svg => {
        if (!live) return;
        let box = figure.querySelector<HTMLElement>('.md-diagram-svg');
        if (!box) { box = document.createElement('div'); box.className = 'md-diagram-svg'; figure.prepend(box); }
        unmount.push(mountSvg(box, svg));
        figure.classList.add('drawn'); figure.classList.remove('failed');
      }).catch(() => {
        if (!active || figure.classList.contains('failed')) return;
        const note = document.createElement('figcaption'); note.className = 'md-diagram-note micro plain'; note.textContent = failedNote;
        figure.append(note); figure.classList.add('failed');
      });
    });
    return () => { live = false; unmount.forEach(f => f()); };
  }, [host, rendered, theme, failedNote, active]);
}
