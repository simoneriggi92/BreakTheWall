import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { Cite, Disassembly } from '../../core/disassembly';
import { renderDiagram } from '../diagrams';
import { renderMarkdown } from '../markdown';
import { mountSvg } from '../svg-mount';
import { usePreferences } from '../preferences';

type Source = Disassembly['sources'][number];

/**
 * A prose source read as a document (D18). Citations still work: the innermost blocks whose source lines meet the
 * focused citation are highlighted and scrolled into view inside this pane, and the open part's blocks are shaded.
 */
export function SourceDocument({ source, focus, cited, className = '' }: { source: Source; focus?: Cite; cited: Cite[]; className?: string }) {
  const { t, theme } = usePreferences();
  const rendered = useMemo(() => renderMarkdown(source.text), [source.text]);
  const host = useRef<HTMLDivElement>(null);

  // Diagrams are drawn after the text, each in its own figure; one that does not parse keeps its code, with a note.
  useEffect(() => {
    const el = host.current;
    if (!el || !rendered.diagrams) return;
    let active = true;
    const unmount: (() => void)[] = [];
    el.querySelectorAll<HTMLElement>('.md-diagram').forEach(figure => {
      const code = figure.querySelector('.md-diagram-source')?.textContent ?? '';
      void renderDiagram(code, theme).then(svg => {
        if (!active) return;
        let box = figure.querySelector<HTMLElement>('.md-diagram-svg');
        if (!box) { box = document.createElement('div'); box.className = 'md-diagram-svg'; figure.prepend(box); }
        unmount.push(mountSvg(box, svg));
        figure.classList.add('drawn'); figure.classList.remove('failed');
      }).catch(() => {
        if (!active || figure.classList.contains('failed')) return;
        const note = document.createElement('figcaption'); note.className = 'md-diagram-note micro plain'; note.textContent = t.d.diagramFailed;
        figure.append(note); figure.classList.add('failed');
      });
    });
    return () => { active = false; unmount.forEach(f => f()); };
  }, [rendered, theme, t]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const blocks = [...el.querySelectorAll<HTMLElement>('[data-from]')];
    const meets = (ranges: Cite[]) => (b: HTMLElement) => {
      const from = Number(b.dataset.from); const to = Number(b.dataset.to);
      return ranges.some(c => c.source === source.id && c.from <= to && c.to >= from);
    };
    const innermost = (test: (b: HTMLElement) => boolean) => blocks.filter(b => test(b) && ![...b.querySelectorAll<HTMLElement>('[data-from]')].some(test));
    blocks.forEach(b => b.classList.remove('focus', 'cited'));
    innermost(meets(cited)).forEach(b => b.classList.add('cited'));
    const focused = focus ? innermost(meets([focus])) : [];
    focused.forEach(b => { b.classList.remove('cited'); b.classList.add('focus'); });
    // Rectangles, not offsetTop: a table row's offset is relative to its table.
    if (focused[0]) el.scrollTop += focused[0].getBoundingClientRect().top - el.getBoundingClientRect().top - 24;
  }, [focus, cited, rendered, source.id]);

  return <div ref={host} className={`source-document ${className}`} tabIndex={0} aria-label={t.d.sourceDocument(source.title)} dangerouslySetInnerHTML={{ __html: rendered.html }}/>;
}

/** The document in a full-window reader, with an outline of its headings. Escape closes it. */
export function SourceReader({ source, focus, cited, onClose }: { source: Source; focus?: Cite; cited: Cite[]; onClose: () => void }) {
  const { t } = usePreferences();
  const dialog = useRef<HTMLDialogElement>(null);
  const headings = useMemo(() => renderMarkdown(source.text).headings, [source.text]);
  // The document mounts once the dialog is open, so it can scroll to the focused citation.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
    setOpen(true);
    return () => { if (el?.open) el.close(); };
  }, []);
  const go = (from: number) => {
    const body = dialog.current?.querySelector<HTMLElement>('.source-document');
    const target = body?.querySelector<HTMLElement>(`[data-from="${from}"]`);
    if (body && target) body.scrollTop += target.getBoundingClientRect().top - body.getBoundingClientRect().top - 12;
  };
  return <dialog ref={dialog} className="source-reader" aria-label={t.d.reader(source.title)}
    onCancel={e => { e.preventDefault(); onClose(); }} onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}>
    <div className="dialog-head"><strong>{source.title}</strong><button className="icon-button" aria-label={t.d.closeReader} onClick={onClose}><X size={18}/></button></div>
    <div className="reader-body">
      {headings.length > 0 && <nav className="reader-outline" aria-label={t.d.outline}><ol>{headings.map((h, i) =>
        <li key={i} style={{ paddingLeft: `${(h.level - 1) * 12}px` }}><button className="text-button" onClick={() => go(h.from)}>{h.text}</button></li>)}</ol></nav>}
      {open && <SourceDocument source={source} focus={focus} cited={cited} className="reader-document"/>}
    </div>
  </dialog>;
}
