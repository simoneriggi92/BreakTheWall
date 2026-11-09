import { useEffect, useMemo, useRef } from 'react';
import type { Cite } from '../../core/disassembly';
import { firstLine, type ExplorationCite, type ExplorationPart } from '../../core/exploration';
import type { Section } from '../../core/source-index';
import { SourceDocument } from '../disassembly/SourceDocument';
import { isProse } from '../markdown';
import { usePreferences } from '../preferences';
import { citing, type Model, type Shaped, type Shown, type Tone } from './model';
import type { Link } from './state';

const MARK = { step: '→', keeps: '=', caveat: '⚠' } as const;
const sameLink = (a: Link | undefined, b: Link) => !!a && a.from === b.from && a.to === b.to && a.class === b.class;

/** A few cited lines, as the source writes them, for a folded "cited lines". */
function Excerpt({ text, cites, max = 30 }: { text: string; cites: ExplorationCite[]; max?: number }) {
  const lines = text.split('\n'), out: { n: number; text: string }[] = [];
  for (const c of cites) for (let i = c.from; i <= c.to && out.length < max; i++) if (lines[i - 1]?.trim()) out.push({ n: i, text: lines[i - 1] });
  return <div className="xp-excerpt">{out.map(l => <div key={l.n} className="xp-ln"><em>{l.n}</em>{l.text}</div>)}</div>;
}

export type CardTarget =
  | { kind: 'part'; level: Shaped; id: string; aspect?: string | null; members: 'roles' | 'components' | null }
  | { kind: 'member'; level: Shaped; part: string; id: string }
  | { kind: 'section'; index: number };

/** The cited lines, kept on the card only for when the source column is hidden (X21); CSS shows them then. */
function Lines({ text, cites, title }: { text: string; cites: ExplorationCite[]; title: string }) {
  return <div className="xp-card-lines"><h4>{title}</h4><Excerpt text={text} cites={cites}/></div>;
}

/**
 * The card (X16, X21) explains only what is selected, and repeats nothing already on screen: the structure draws the
 * roles, the components and the joints, and the source column shows the lines.
 * - an aspect: its roles as a list, "name — what it does", since the drawing shows them only once it opens (X24);
 * - a role or another part: what it does for the whole, its points, its annotations;
 * - a link, chosen on its label: its ends, its basis and its bonds as who → what → whom;
 * - a component: what it does, and its role as the way back.
 * Name, kind and position stay, because they orient.
 */
export function Card({ m, target, tone, pick, onPoint, onUnpick, onNote, onBackToRole, onRole, sub, onToggleSub }: {
  m: Model; target: CardTarget | null; tone: Tone | null; pick: { point: number } | { link: Link } | null;
  onPoint: (i: number | null) => void; onUnpick: () => void; onNote: (id: string) => void; onBackToRole: () => void;
  /** A role chosen in an aspect's card: it opens in the aspect's sub-level. */
  onRole: (aspect: string, role: string) => void;
  sub: string | null; onToggleSub: (id: string) => void;
}) {
  const { t } = usePreferences(), x = t.x;
  const text = m.x.source.text;
  const name = (level: Shaped, id: string) => level.parts.get(id)?.name ?? m.all.get(id)?.name ?? id;
  if (!target) return <section className="xp-card" aria-label={x.card.label}/>;
  if (target.kind === 'section') {
    const s = m.index[target.index];
    return <section className="xp-card" aria-label={x.card.label}>
      <div className="xp-card-head"><h3>{s.title || x.index.opening}</h3><span className="xp-tag">{x.kinds.section}</span><span className="xp-tag">{x.card.lines_(s.line, s.end)}</span></div>
      <p className="xp-lead">{x.card.notExtracted}</p><p className="xp-hint">{x.card.notExtractedHint}</p>
      <details open><summary>{x.card.sectionLines}</summary><Excerpt text={text} cites={[{ from: s.line, to: s.end }]}/></details>
    </section>;
  }
  if (target.kind === 'member') {
    const role = target.level.parts.get(target.part)!, c = role.members.find(y => y.id === target.id)!;
    return <section className="xp-card" data-tone={tone ?? undefined} aria-label={x.card.label}>
      <div className="xp-card-head"><h3>{c.name}</h3><span className="xp-tag">{x.kinds.component}</span>
        <button className="xp-tag xp-tag-back" title={x.card.backToRole(role.name)} aria-label={x.card.backToRole(role.name)} onClick={onBackToRole}>{x.card.of(role.name)}</button></div>
      <p className="xp-lead">{c.does}</p>
      <Lines text={text} cites={c.cites} title={x.card.lines}/>
    </section>;
  }
  const { level, id } = target, p = level.parts.get(id);
  if (!p) return <section className="xp-card" aria-label={x.card.label}/>;
  const chosen = pick && 'link' in pick ? level.level.links.find(l => sameLink(pick.link, l)) : undefined;
  if (chosen) {
    // a joint that stands for several links marks those the extractor interpreted: the joint is declared if any one is
    const bonds = chosen.bonds?.length ? chosen.bonds : [{ from: chosen.from, label: chosen.label, to: chosen.to, basis: chosen.basis }];
    const mixed = new Set(bonds.map(b => b.basis)).size > 1;
    // one bond between the joint's own ends: the head already names them, so only the relation is left to say
    const single = bonds.length === 1 && bonds[0].from === chosen.from && bonds[0].to === chosen.to;
    return <section className="xp-card xp-link-card" data-tone={tone ?? undefined} aria-label={x.card.label}>
      <div className="xp-card-head"><h3>{name(level, chosen.from)} → {name(level, chosen.to)}</h3><span className="xp-tag">{x.kinds.link}</span>
        <span className="xp-basis" data-basis={chosen.basis}>{chosen.basis === 'declared' ? x.card.declared : x.card.interpreted}</span></div>
      {single ? <p className="xp-lead">{bonds[0].label}</p> : <ul className="xp-bonds">{bonds.map((b, i) => <li key={i}><b>{name(level, b.from)}</b> → {b.label} → <b>{name(level, b.to)}</b>{mixed && b.basis === 'interpreted' && <> <span className="xp-basis" data-basis="interpreted">{x.card.interpreted}</span></>}</li>)}</ul>}
      <button className="xp-rel xp-back" onClick={onUnpick}>{x.card.backTo(name(level, chosen.from))}</button>
      <Lines text={text} cites={chosen.cites} title={x.card.lines}/>
    </section>;
  }
  const notes = [...level.parts.values()].filter(q => q.kind === 'annotation' && q.on === id);
  const aspect = target.members === 'roles';
  const kind = p.kind === 'part' ? (aspect ? x.kinds.aspect : x.kinds.role) : x.kinds[p.kind];
  const point = pick && 'point' in pick ? pick.point : null;
  return <section className="xp-card" data-tone={tone ?? undefined} aria-label={x.card.label}>
    <div className="xp-card-head"><h3>{p.name}</h3><span className="xp-tag">{kind}</span>
      {target.aspect && <span className="xp-tag">{x.card.in(name(m, target.aspect))}</span>}
      {p.on && <span className="xp-tag">{x.card.on(name(level, p.on))}</span>}</div>
    {!aspect && <p className="xp-lead">{p.role}</p>}
    {aspect && p.members.length > 0 && <ul className="xp-roles" aria-label={x.card.rolesOf(p.name)}>{[...p.members].sort((a, b) => (a.cites[0]?.from ?? 0) - (b.cites[0]?.from ?? 0)).map(r =>
      <li key={r.id}><button onClick={() => onRole(id, r.id)}><span><b>{r.name}</b> — {r.does}</span></button></li>)}</ul>}
    {aspect && p.members.length > 0 && <button className="xp-open-level" onClick={() => onToggleSub(id)}>{sub === id ? x.card.close(p.name) : x.card.open(p.name, p.members.length)}</button>}
    {p.points.length > 0 && <ul className="xp-points">{p.points.map((q, i) => <li key={i}><button aria-pressed={point === i} data-point={i} aria-label={`${x.card.point}: ${q.text}`} onClick={() => onPoint(point === i ? null : i)}>
      <i data-mark={q.mark ?? ''}>{q.mark ? MARK[q.mark] : '·'}</i>{q.text}</button></li>)}</ul>}
    {notes.length > 0 && <div className="xp-notes-list">{notes.map(n => <button key={n.id} className="xp-note" onClick={() => onNote(n.id)}>⚠ {n.name}</button>)}</div>}
    <Lines text={text} cites={p.cites} title={x.card.lines}/>
  </section>;
}

/**
 * The source's own index (X16): sections in order, one dot per part (filled once on screen), the sections the guide
 * touches now, subsections open under the selected one, "not extracted", and the question of a trace where it walks.
 */
export function IndexPanel({ m, view, selected, section, now, onSection }: {
  m: Model; view: Shown; selected: ExplorationPart | null; section: number | null; now: number[]; onSection: (i: number) => void;
}) {
  const { t } = usePreferences(), x = t.x, secs = m.index;
  const within = (line: number, s: Section) => s.line <= line && line <= s.end;
  const all = [...m.x.parts.flatMap(p => p.cites), ...m.x.links.flatMap(l => l.cites), ...m.x.traces.flatMap(tr => tr.steps.flatMap(s => s.cites))];
  const cited = (s: Section) => all.some(c => c.from <= s.end && c.to >= s.line);
  const trace = m.x.traces[m.shape.trace ?? 0];
  const walks = (s: Section) => !!trace && trace.steps.some(st => st.cites.some(c => within(c.from, s)));
  const inView = (p: ExplorationPart) => view.vis.has(p.id) || (m.aspects && !!m.aspectOf(p.id) && view.vis.has(m.aspectOf(p.id)!));
  const open = new Set(secs.filter(s => !s.sub && ((selected && within(firstLine(selected), s)) || (section !== null && within(secs[section].line, s)))).map(s => s.line));
  const parent = (s: Section) => secs.filter(u => !u.sub && u.line <= s.line).pop();
  return <><nav className="xp-index" aria-label={x.panels.index}><ol>{secs.map((s, i) => {
    if (s.sub && !open.has(parent(s)?.line ?? -1)) return null;
    const parts = m.x.parts.filter(p => p.kind !== 'annotation' && within(firstLine(p), s));
    const on = section === i || (!!selected && secs.findLastIndex(u => within(firstLine(selected), u)) === i);
    return <li key={i}><button className={['xp-sec', s.sub && 'xp-subsec', on && 'xp-on', now.some(n => within(n, s)) && 'xp-now', !cited(s) && 'xp-empty'].filter(Boolean).join(' ')}
      aria-current={on ? 'true' : undefined} data-sec={i} title={x.index.lines(s.line, s.end)} onClick={() => onSection(i)}>
      <span className="xp-sec-title">{s.title || x.index.opening}</span><em>{s.line}</em>
      <span className="xp-dots">{walks(s) && <small className="xp-asks">{x.index.walks(trace.question)}</small>}
        {cited(s) ? parts.map(p => <i key={p.id} className={`xp-dot ${inView(p) ? 'xp-in' : ''} ${p.id === selected?.id ? 'xp-sel' : ''}`} data-role={p.kind === 'part' ? 'main' : p.kind === 'prerequisite' ? 'prerequisite' : 'aside'} data-tone={m.tone(p.id) ?? undefined} title={p.name}/>)
          : <small>{x.index.notExtracted}</small>}</span>
    </button></li>;
  })}</ol></nav>
  <IndexLegend m={m} walked={!!trace && secs.some(walks)} unextracted={secs.some(s => !cited(s))}/></>;
}

/**
 * The index's legend (X26), built from the open exploration: it shows only the signs that occur in it, drawn with the
 * same marks as the index, so a dot's colour, fill and ring can be read without knowing the design.
 */
function IndexLegend({ m, walked, unextracted }: { m: Model; walked: boolean; unextracted: boolean }) {
  const { t } = usePreferences(), x = t.x, l = x.index;
  const kinds = new Set(m.x.parts.map(p => p.kind));
  const aside = m.x.parts.some(p => p.kind === 'reference' || p.kind === 'procedure');
  const dot = (role: string, tone?: string | null, cls = 'xp-in') => <i className={`xp-dot ${cls}`} data-role={role} data-tone={tone ?? undefined} aria-hidden="true"/>;
  const hues = m.aspects ? m.x.aspects.map(a => ({ key: a.id, mark: dot('main', m.tone(a.id)), text: a.name })) : [{ key: '~main', mark: dot('main'), text: l.mechanism }];
  const rows = [
    ...hues,
    ...(kinds.has('prerequisite') ? [{ key: '~pre', mark: dot('prerequisite'), text: l.prerequisite }] : []),
    ...(aside ? [{ key: '~aside', mark: dot('aside', null, ''), text: l.aside }] : []),
    { key: '~in', mark: dot('main'), text: l.shown },
    { key: '~out', mark: dot('main', null, ''), text: l.notShown },
    { key: '~sel', mark: dot('main', null, 'xp-in xp-sel'), text: l.selected },
    ...(walked ? [{ key: '~q', mark: <small aria-hidden="true">?</small>, text: l.question }] : []),
    { key: '~now', mark: <span className="xp-legend-now" aria-hidden="true"/>, text: l.now },
    ...(unextracted ? [{ key: '~none', mark: <small aria-hidden="true">{l.notExtracted}</small>, text: l.notExtracted_ }] : []),
  ];
  return <details className="xp-legend" open><summary>{l.legend}</summary>
    <p className="xp-hint">{l.dot}</p>
    <ul>{rows.map(r => <li key={r.key}><span className="xp-legend-mark">{r.mark}</span>{r.text}</li>)}</ul></details>;
}

/**
 * The source (X12, X22): rendered as `SourceDocument` reads it, or its raw lines numbered, as the disassembly player's
 * "Righe" shows them. Either way each block or line carries `data-from` and `data-to`, so the same code marks the
 * selection's lines, colours each gutter with the part that cites it, and answers a click with its first line.
 */
export function SourcePanel({ m, cites, view, onLine }: { m: Model; cites: ExplorationCite[]; view: 'document' | 'lines'; onLine: (line: number) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const source = m.x.source;
  const lines = view === 'lines' || !isProse(source);
  const cited: Cite[] = useMemo(() => cites.map(c => ({ source: source.id, from: c.from, to: c.to })), [cites, source.id]);
  const roles = useMemo(() => m.x.parts, [m]);
  useEffect(() => {
    host.current?.querySelectorAll<HTMLElement>('[data-from]').forEach(b => {
      const p = citing(roles, Number(b.dataset.from));
      b.dataset.role = !p ? 'none' : p.kind === 'part' ? 'main' : p.kind === 'prerequisite' ? 'prerequisite' : p.kind === 'annotation' ? 'annotation' : 'aside';
      const tone = p && m.tone(p.id); if (tone) b.dataset.tone = tone; else delete b.dataset.tone;
    });
  });
  return <div ref={host} className="xp-source" onClick={e => {
    const block = (e.target as HTMLElement).closest<HTMLElement>('[data-from]');
    if (block) onLine(Number(block.dataset.from));
  }}>{lines ? <SourceLines text={source.text} title={source.title} code={!isProse(source)} cites={cites}/> : <SourceDocument source={source as never} focus={cited[0]} cited={cited}/>}</div>;
}

/** The raw lines, numbered: the first cite's lines are the focus, the others cited; the focus scrolls into view here. */
function SourceLines({ text, title, code, cites }: { text: string; title: string; code: boolean; cites: ExplorationCite[] }) {
  const { t } = usePreferences();
  const list = useRef<HTMLOListElement>(null);
  const within = (cs: ExplorationCite[], n: number) => cs.some(c => c.from <= n && n <= c.to);
  useEffect(() => {
    const host = list.current, first = cites[0] && host?.querySelector<HTMLElement>(`[data-from="${cites[0].from}"]`);
    if (host && first) host.scrollTop += first.getBoundingClientRect().top - host.getBoundingClientRect().top - 24;
  }, [cites]);
  return <ol ref={list} className={`source-text xp-lines ${code ? 'code' : ''}`} tabIndex={0} aria-label={t.d.sourceLines(title)}>
    {text.split('\n').map((line, i) => {
      const n = i + 1, focus = !!cites[0] && within([cites[0]], n);
      return <li key={n} data-from={n} data-to={n} className={focus ? 'focus' : within(cites, n) ? 'cited' : undefined}>
        <span className="line-no" aria-hidden="true">{n}</span><span className="line-text">{line || ' '}</span></li>;
    })}
  </ol>;
}
