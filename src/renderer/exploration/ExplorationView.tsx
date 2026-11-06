import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef } from 'react';
import { ArrowLeft, ArrowRight, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { firstLine, type Exploration, type ExplorationCite, type ExplorationLink } from '../../core/exploration';
import { layoutOf, SPACING, type Layout, type Strip } from '../../core/exploration-layout';
import type { LevelLink } from '../../core/exploration-levels';
import { Brand } from '../icons';
import { originText, PreferencesMenu, usePreferences } from '../preferences';
import { Graph, heightOf, type NodeState, type StripState } from './Graph';
import { citing, crossing, guided, modelOf, sectionOf, shown, standIn, type Model, type Shaped } from './model';
import { Card, IndexPanel, SourcePanel, type CardTarget } from './Panels';
import { Report } from './Report';
import { initialState, reduce, type Action, type ViewState } from './state';

/** The motion of the sub-level (X14), as the tokens set it; "reduce motion" stops it. */
const reduced = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const DURATION = 320, EASE = 'cubic-bezier(.2, .8, .2, 1)';

/**
 * The exploration view (plan P-20261105-exploration X12–X17): one shared state read by three roles. The guide moves it,
 * the structure shows it, the source proves it; the index, the card and "how it was read" read the same state.
 */
export function ExplorationView({ x, goHome }: { x: Exploration; goHome: () => void }) {
  const m = useMemo(() => modelOf(x), [x]);
  const [s, dispatch] = useReducer((state: ViewState, action: Action) => reduce(m, state, action), m, initialState);
  return <ExplorationBody m={m} s={s} dispatch={dispatch} goHome={goHome}/>;
}

export function ExplorationBody({ m, s, dispatch, goHome }: { m: Model; s: ViewState; dispatch: (a: Action) => void; goHome: () => void }) {
  const { t } = usePreferences(), xt = t.x, x = m.x;
  const view = useMemo(() => shown(m, s.guide, s.all, new Set(s.visited)), [m, s.guide, s.all, s.visited]);
  const focus = s.explore ?? guided(m, s.guide, view) ?? null;
  // exploring a part the guide has not reached yet shows it, marked as off the guide
  if (focus && m.parts.has(focus) && !view.vis.has(focus) && m.parts.get(focus)!.kind !== 'annotation' && m.shape.nuclei.some(n => n.ids.includes(focus))) view.vis.add(focus);
  const shownId = focus && m.parts.get(focus)?.kind === 'annotation' ? m.parts.get(focus)!.on ?? focus : focus;
  const hot = !s.sub && s.explore && m.parts.has(s.explore) ? s.explore : null;
  const near = new Set(hot ? m.level.links.filter(l => l.class !== 'group' && (l.from === hot || l.to === hot)).flatMap(l => [l.from, l.to]).filter(i => i !== hot) : []);
  const membersOf = (level: Shaped, id: string) => level.parts.get(id)?.members ?? [];
  const sub = s.sub ? m.sub(s.sub) : null;

  // ---------- layout of the whole: positions never change while a sub-level is open
  const step = m.steps[s.guide.kind === 'whole' ? s.guide.at : -1];
  const n0 = m.shape.nuclei[0];
  const ghost = s.guide.kind === 'whole' && !s.all && step && !('premise' in step) && step.layer !== undefined && step.layer + 1 < (n0?.depth ?? 0)
    ? { nucleus: 0, layer: step.layer + 1, count: n0.ids.filter(i => n0.layer.get(i) === step.layer! + 1).length } : null;
  // at the aspect level only an aspect's block opens a sub-level; a prerequisite's components show in place, as on the roles
  const isAspect = (id: string) => m.aspects && m.parts.get(id)?.kind === 'part';
  const topHeight = (id: string) => heightOf(membersOf(m, id).length, !isAspect(id) && s.opened.includes(id));
  const L = layoutOf(m.level, m.shape, {
    bands: true, ghost, premise: m.premise?.id ?? null, spacing: SPACING.whole, heightOf: topHeight, visible: id => view.vis.has(id),
    open: new Set(m.shape.nuclei.map((_, i) => i).filter(i => i === 0 || s.all || m.shape.nuclei[i].ids.some(j => view.vis.has(j)))),
  });
  const stripState = (st: Strip): StripState => {
    if (st.premise) return s.guide.kind === 'whole' && step && 'premise' in step ? 'premise' : 'seen';
    if (s.guide.kind !== 'whole' || s.all || !step || 'premise' in step) return 'seen';
    return st.nucleus === step.nucleus && (step.layer === undefined || st.layer === step.layer) ? 'active' : 'seen';
  };
  const question = s.guide.kind === 'question' ? m.level.traces[s.guide.trace] : null;
  const otherNucleus = !s.all && step && !('premise' in step) && step.nucleus > 0 ? m.shape.nuclei[step.nucleus] : null;
  const topState = (id: string): NodeState => ({
    sel: id === shownId && !s.sub, near: near.has(id), fresh: view.fresh.has(id), premise: id === m.premise?.id, opened: s.sub === id, faded: !!s.sub && s.sub !== id,
    lit: question ? view.lit.has(id) : false, done: view.done.has(id) && !view.lit.has(id),
    quiet: (question && !view.lit.has(id) && !hot) || (!!otherNucleus && !otherNucleus.ids.includes(id) && id !== m.premise?.id),
  });
  const litJoint = question && !hot ? (l: LevelLink) => view.lit.has(l.from) && view.lit.has(l.to) : undefined;

  // ---------- actions
  const openSub = useCallback((aspect: string, role: string | null = null) => {
    const roleHas = role ? (m.sub(aspect).parts.get(role)?.members.length ?? 0) > 0 : false;
    dispatch({ type: 'open', aspect, role, components: roleHas });
  }, [m, dispatch]);
  const panel = useRef<HTMLDivElement>(null), from = useRef<string>('');
  const closeSub = useCallback(() => {
    const el = panel.current;
    if (!el || reduced() || typeof el.animate !== 'function' || !from.current) return dispatch({ type: 'close' });
    // a window in the background pauses its animations: the sub-level closes when the motion ends, or after its
    // duration at the latest, never twice
    let done = false;
    const finish = () => { if (!done) { done = true; dispatch({ type: 'close' }); } };
    el.animate([{ transform: 'none', opacity: 1 }, { transform: from.current, opacity: 0.2 }], { duration: DURATION * 0.8, easing: EASE, fill: 'forwards' }).onfinish = finish;
    setTimeout(finish, DURATION + 80);
  }, [dispatch]);
  const onNode = (id: string) => {
    if (s.sub) { if (membersOf(m, id).length && isAspect(id)) return openSub(id); }
    dispatch({ type: 'choose', id });
  };
  const roles = useMemo(() => x.parts.filter(p => p.kind === 'part'), [x]);
  const pickLine = (line: number) => {
    if (s.report) dispatch({ type: 'report', on: false });
    if (sub) {
      const r = citing(sub.level.parts, line);
      if (r) return dispatch({ type: 'sub-select', id: r.id, components: r.members.length > 0 });
    }
    if (m.aspects) {
      const role = citing(roles, line), other = citing(m.level.parts.filter(p => p.kind !== 'part'), line);
      const span = (cs: ExplorationCite[]) => cs.reduce((a, c) => a + c.to - c.from + 1, 0);
      if (role && (!other || span(role.cites) <= span(other.cites))) return openSub(m.aspectOf(role.id)!, role.id);
      if (other) { if (s.sub) dispatch({ type: 'close' }); return dispatch({ type: 'explore', id: other.id }); }
    } else {
      const p = citing(m.level.parts, line);
      if (p) return dispatch({ type: 'explore', id: p.id });
    }
    const i = sectionOf(m.index, line);
    if (i >= 0) dispatch({ type: 'section', index: i });
  };
  const pickSection = (i: number) => {
    const sec = m.index[i], within = (n: number) => sec.line <= n && n <= sec.end;
    const parts = x.parts.filter(p => p.kind !== 'annotation' && within(firstLine(p))).sort((a, b) => firstLine(a) - firstLine(b));
    if (!parts.length) return dispatch({ type: 'section', index: i });
    const p = parts[0];
    if (m.aspects && p.kind === 'part') return openSub(m.aspectOf(p.id)!, p.id);
    if (s.sub) dispatch({ type: 'close' });
    dispatch({ type: 'explore', id: p.id });
  };
  // a link from "how it was read" opens on the card of the level that shows it: a role's card in its sub-level, or else
  // the whole's card, where a link to a role is the joint to that role's aspect
  const openLink = (l: ExplorationLink) => {
    dispatch({ type: 'report', on: false });
    if (m.aspects && m.aspectOf(l.from)) { openSub(m.aspectOf(l.from)!, l.from); dispatch({ type: 'pick', pick: { link: l } }); return; }
    dispatch({ type: 'explore', id: l.from });
    const to = m.aspects ? m.aspectOf(l.to) ?? l.to : l.to;
    dispatch({ type: 'pick', pick: { link: { from: l.from, to, class: l.class } } });
  };

  // ---------- the card and the lines it shows
  const card: CardTarget | null = s.section !== null ? { kind: 'section', index: s.section }
    : sub ? (s.member && s.subSel === s.member.part ? { kind: 'member', level: sub, part: s.member.part, id: s.member.id }
      : s.subSel ? { kind: 'part', level: sub, id: s.subSel, aspect: s.sub, members: 'components' } : { kind: 'part', level: m, id: s.sub!, members: 'roles' })
    : s.member && s.member.part === focus ? { kind: 'member', level: m, part: s.member.part, id: s.member.id }
    : focus ? { kind: 'part', level: m, id: focus, members: isAspect(focus) ? 'roles' : 'components' } : null;
  const cardPart = card?.kind === 'part' ? card.level.parts.get(card.id) : null;
  const cites: ExplorationCite[] = card?.kind === 'section' ? [{ from: m.index[card.index].line, to: m.index[card.index].end }]
    : card?.kind === 'member' ? card.level.parts.get(card.part)!.members.find(c => c.id === card.id)!.cites
    : s.pick && 'link' in s.pick ? (card?.kind === 'part' ? card.level.level.links : m.level.links).find(l => l.from === (s.pick as { link: ExplorationLink }).link.from && l.to === (s.pick as { link: ExplorationLink }).link.to && l.class === (s.pick as { link: ExplorationLink }).link.class)?.cites ?? cardPart?.cites ?? []
    : s.pick && 'point' in s.pick ? cardPart?.points[s.pick.point]?.cites ?? cardPart?.cites ?? []
    : cardPart?.cites ?? [];
  const cardTone = card?.kind === 'part' ? m.tone(card.id) : card?.kind === 'member' ? m.tone(card.part) : null;
  const selectedPart = card?.kind === 'part' ? m.all.get(card.id) ?? null : card?.kind === 'member' ? m.all.get(card.part) ?? null : null;
  const now = question ? question.steps[s.guide.at].cites.map(c => c.from) : [...view.fresh].map(id => m.all.get(id) ?? m.parts.get(id)).filter(Boolean).map(p => firstLine(p!));

  // ---------- keyboard: arrows step, Escape returns (a focused label keeps the arrows for itself)
  const last = question ? question.steps.length - 1 : m.steps.length - 1;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.defaultPrevented || el?.closest?.('input, textarea, select, .xp-label, dialog')) return;
      if (e.key === 'Escape') { e.preventDefault(); if (s.sub) closeSub(); else dispatch({ type: 'escape' }); return; }
      if (!m.steps.length || s.report) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); dispatch({ type: 'step', by: 1 }); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); dispatch({ type: 'step', by: -1 }); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [m, s.sub, s.report, closeSub, dispatch]);

  const names = (id: string) => m.all.get(id)?.name ?? m.parts.get(id)?.name ?? id;
  const notesOf = (level: Shaped) => (id: string) => [...level.parts.values()].filter(p => p.kind === 'annotation' && p.on === id);

  // ---------- the sub-level, under its block, over the faded whole
  const stage = useRef<HTMLDivElement>(null);
  const subBlock = s.sub ? L.pos[s.sub] : undefined;
  const subLayout: Layout | null = sub ? layoutOf(sub.level, sub.shape, {
    bands: (sub.shape.nuclei[0]?.depth ?? 0) > 1, spacing: SPACING.sub, heightOf: id => heightOf(membersOf(sub, id).length, s.opened.includes(id)),
  }) : null;
  const width = Math.max(360, (stage.current?.clientWidth || L.width) - 28), left = Math.max(8, (stage.current?.scrollLeft ?? 0) + 10);
  const top = subBlock ? subBlock.y + subBlock.h + 40 : 0;
  useLayoutEffect(() => {
    const el = panel.current;
    if (!el || !subBlock) return;
    const h = el.offsetHeight || 1;
    from.current = `translate(${subBlock.x - left}px, ${subBlock.y - top}px) scale(${(subBlock.w / width).toFixed(3)}, ${(subBlock.h / h).toFixed(3)})`;
    if (s.grow) {
      // FLIP: the sub-level starts on its block's rectangle and plays to its own place
      if (!reduced() && typeof el.animate === 'function') el.animate([{ transform: from.current, opacity: 0.35 }, { transform: 'none', opacity: 1 }], { duration: DURATION, easing: EASE });
      // the sub-level opens under its block, often below the stage's edge: bring it into view
      // from layout offsets, which its growing transform does not change
      const box = stage.current, graph = el.offsetParent as HTMLElement | null;
      if (box && graph) box.scrollTo?.({ top: Math.max(0, graph.offsetTop + el.offsetTop - 12), behavior: reduced() ? 'auto' : 'smooth' });
      // a level wider than the panel opens on its first block, centred
      const inner = el.querySelector<HTMLElement>('.xp-sub-body'), first = inner?.querySelector<HTMLElement>('.xp-node');
      if (inner && first) inner.scrollLeft = Math.max(0, first.offsetLeft + first.offsetWidth / 2 - inner.clientWidth / 2);
      dispatch({ type: 'grown' });
    }
  });
  const subPanel = sub && subLayout && subBlock ? <>
    <svg className="xp-beam-svg" width={Math.max(L.width, left + width + 12)} height={top + 4} aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0 }}>
      <polygon className="xp-beam" data-tone={m.tone(sub.aspect) ?? undefined} points={`${subBlock.x},${subBlock.y + subBlock.h} ${subBlock.x + subBlock.w},${subBlock.y + subBlock.h} ${left + width},${top} ${left},${top}`}/>
    </svg>
    <div ref={panel} className="xp-sub" data-tone={m.tone(sub.aspect) ?? undefined} role="region" aria-label={xt.step.inside(sub.name)} style={{ left, top, width }}>
      <div className="xp-sub-head"><span className="xp-sub-k">{xt.structure.sub}</span><b>{sub.name}</b><span className="xp-hint">{xt.structure.roles(sub.level.parts.filter(p => p.kind === 'part').length)} · {xt.structure.subHint}</span>
        <button className="xp-sub-close" title={xt.structure.closeTitle} onClick={closeSub}>{xt.structure.close}</button></div>
      <div className="xp-sub-body">
        <Graph level={sub} layout={subLayout} levelKey={sub.aspect} visible={() => true} tone={m.tone} hot={s.subSel} moved={s.moved}
          onMove={(key, offset) => dispatch({ type: 'move', key, offset })} names={names} notes={notesOf(sub)} stripState={() => 'seen'}
          nodeState={id => ({ sel: id === s.subSel, near: !!s.subSel && sub.level.links.some(l => (l.from === s.subSel && l.to === id) || (l.to === s.subSel && l.from === id)) })}
          members={id => membersOf(sub, id).length ? { list: membersOf(sub, id), open: s.opened.includes(id), sel: s.member?.part === id ? s.member.id : null, noun: 'components' } : null}
          onNode={id => dispatch({ type: 'sub-select', id, components: membersOf(sub, id).length > 0 })} onToggle={id => dispatch({ type: 'components', id })}
          onMember={(id, c) => dispatch({ type: 'member', part: id, id: c })}/>
      </div>
    </div></> : null;
  const graphHeight = sub && subLayout ? top + subLayout.height + 140 : undefined;

  // ---------- the leader line: from the selection to its lines in the source, following both scrolls
  const body = useRef<HTMLDivElement>(null), wire = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const draw = () => {
      const svg = wire.current, root = body.current;
      if (!svg || !root) return;
      svg.replaceChildren();
      const box = root.getBoundingClientRect();
      const anchor = root.querySelector<HTMLElement>('.xp-sub .xp-node.xp-sel, .xp-graph > .xp-node.xp-sel, .xp-card [data-point][aria-pressed="true"], .xp-card h3');
      const target = root.querySelector<HTMLElement>('.xp-source .focus');
      const pane = root.querySelector<HTMLElement>('.xp-source');
      if (!anchor || !target || !pane || !box.width) return;
      const a = anchor.getBoundingClientRect(), b = target.getBoundingClientRect(), p = pane.getBoundingClientRect();
      if (b.bottom < p.top || b.top > p.bottom) return;
      const fx = a.right - box.left, fy = a.top + a.height / 2 - box.top, sx = p.left - box.left, sy = Math.max(p.top, Math.min(p.bottom, (b.top + b.bottom) / 2)) - box.top;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M${fx},${fy} C${(fx + sx) / 2},${fy} ${(fx + sx) / 2},${sy} ${sx},${sy}`); path.setAttribute('class', 'xp-leader');
      svg.setAttribute('width', String(box.width)); svg.setAttribute('height', String(box.height)); svg.append(path);
    };
    const frame = requestAnimationFrame(draw);
    const root = body.current, panes = root ? [...root.querySelectorAll('.xp-source, .xp-stage, .source-document')] : [];
    panes.forEach(el => el.addEventListener('scroll', draw, { passive: true })); window.addEventListener('resize', draw);
    return () => { cancelAnimationFrame(frame); panes.forEach(el => el.removeEventListener('scroll', draw)); window.removeEventListener('resize', draw); };
  });

  // ---------- the step strip
  const guideBar = m.steps.length ? <div className="xp-guide" role="group" aria-label={xt.guide.label}>
    <span className="xp-hint">{xt.guide.label}</span>
    <button aria-pressed={s.guide.kind === 'whole'} onClick={() => dispatch({ type: 'guide', guide: 'whole' })}>{xt.guide.whole}</button>
    {m.level.traces.length > 0 && <button aria-pressed={s.guide.kind === 'question'} onClick={() => dispatch({ type: 'guide', guide: 'question' })}>{xt.guide.question}</button>}
    <button aria-pressed={s.all} onClick={() => dispatch({ type: 'all', on: !s.all })}>{xt.guide.all}</button>
  </div> : null;
  const entering = [...view.fresh].map(id => m.parts.get(id)).filter(Boolean);
  const stripHead = sub ? [xt.step.inside(sub.name), xt.step.insideCount]
    : s.all ? [xt.guide.all, '']
    : question ? [question.question, xt.step.question(s.guide.at + 1, question.steps.length)]
    : step && 'premise' in step ? [xt.step.premise, xt.step.premiseCount]
    : step ? [step.layer !== undefined ? names(n0.root) : names(m.shape.nuclei[step.nucleus].root), step.layer !== undefined ? xt.step.layer(step.layer + 1, n0.depth) : xt.step.nucleus(step.nucleus + 1, m.shape.nuclei.length)] : ['', ''];
  const banner = otherNucleus && step && !('premise' in step) ? xt.step.banner(names(otherNucleus.root), names(n0.root)) + (() => {
    const across = crossing(m, step.nucleus).filter(l => l.class === 'reference');
    return across.length ? xt.step.bannerTouch(across.map(l => `${names(l.from)} → ${l.label} → ${names(l.to)}`).join('; ')) : xt.step.bannerNone;
  })() : null;
  const nextIsOther = s.guide.kind === 'whole' && step && !('premise' in step) && m.steps[s.guide.at + 1] && !('premise' in m.steps[s.guide.at + 1]) && (m.steps[s.guide.at + 1] as { nucleus: number }).nucleus !== step.nucleus;
  const toWhole = () => {
    const walked = question!.steps.flatMap(st => st.parts.map(p => standIn(m, p)));
    const at = Math.max(0, m.steps.findIndex(st => !('premise' in st) && st.nucleus === 0 && st.layer === n0.depth - 1));
    dispatch({ type: 'whole-after-question', at, visited: walked });
  };
  const stepStrip = m.steps.length ? <div className={`xp-step-strip ${s.explore && !s.sub ? 'xp-paused' : ''} ${sub ? 'xp-inside' : ''}`} data-tone={sub ? m.tone(sub.aspect) ?? undefined : undefined} role="region" aria-label={xt.step.label}>
    <div className="xp-step-main">
      <div className="xp-step-head"><span className="xp-q">{stripHead[0]}</span>{stripHead[1] && <span className="xp-count">{stripHead[1]}</span>}</div>
      {sub ? <p className="xp-step-text">{xt.step.insideText}</p>
        : s.all ? <p className="xp-step-text">{xt.step.allText}</p>
        : <>
          {question && <p className="xp-step-text">{question.steps[s.guide.at].text}</p>}
          {!question && step && 'premise' in step && <p className="xp-step-text">{m.premise!.role}</p>}
          {banner && <p className="xp-banner" role="status">{banner}</p>}
          {!question && step && !('premise' in step) && entering.length > 0 && <span className="xp-chips"><span className="xp-hint">{s.guide.at === (m.premise ? 1 : 0) ? xt.step.startFrom : xt.step.entering}</span>
            {entering.map(p => <button key={p!.id} className="xp-chip" aria-pressed={focus === p!.id} onClick={() => dispatch({ type: 'explore', id: p!.id })}>{p!.name}</button>)}</span>}
          {question && m.level.traces.length > 1 && <span className="xp-chips"><span className="xp-hint">{xt.step.otherQuestions}</span>
            {m.level.traces.map((tr, i) => i === (s.guide as { trace: number }).trace ? null : <button key={i} className="xp-chip" onClick={() => dispatch({ type: 'guide', guide: 'question', trace: i })}>{tr.question}</button>)}</span>}
          {s.explore && <div className="xp-away">{xt.step.away(names(s.explore))}<button onClick={() => dispatch({ type: 'back' })}>{xt.step.backToStep}</button></div>}
        </>}
    </div>
    <div className="xp-step-nav">{sub ? <button className="xp-nav xp-wide" onClick={closeSub}>{xt.step.closeSub}</button>
      : s.all ? <button className="xp-nav xp-wide" onClick={() => dispatch({ type: 'all', on: false })}>{xt.guide.allBack}</button>
      : <>
        <button className="xp-nav" aria-label={xt.step.prev} disabled={s.guide.at === 0} onClick={() => dispatch({ type: 'step', by: -1 })}><ArrowLeft size={16}/></button>
        {question && s.guide.at === last ? <button className="xp-nav xp-wide" onClick={toWhole}>{xt.step.toWhole}</button>
          : <button className={`xp-nav ${nextIsOther ? 'xp-wide' : ''}`} aria-label={xt.step.next} disabled={s.guide.at === last} onClick={() => dispatch({ type: 'step', by: 1 })}>{nextIsOther ? xt.step.otherNucleus : <ArrowRight size={16}/>}</button>}
      </>}</div>
  </div> : <p className="xp-step-strip xp-hint">{xt.guide.none}</p>;

  const aside = m.shape.aside.concat(m.shape.loose).filter(p => p.kind !== 'annotation');
  const origin = x.generation ? originText(t, x.generation) : xt.library.prepared;
  const panelHead = (title: string, fold?: 'index' | 'source') => <div className="xp-head"><h2>{title}</h2>
    {fold && <button className="xp-icon" aria-label={s.folded[fold] ? xt.unfold(title) : xt.fold(title)} aria-expanded={!s.folded[fold]} onClick={() => dispatch({ type: 'fold', panel: fold })}>
      {fold === 'index' ? (s.folded.index ? <PanelLeftOpen size={18}/> : <PanelLeftClose size={18}/>) : (s.folded.source ? <PanelRightOpen size={18}/> : <PanelRightClose size={18}/>)}</button>}</div>;

  return <div className="xp" lang={x.language}>
    <header className="xp-bar">
      <button className="brand-button" onClick={goHome} aria-label={xt.back}><Brand/></button>
      <div className="xp-title"><h1>{x.title}</h1><span className="xp-meta">{x.whole}</span></div>
      <span className="xp-tag" title={origin}>{origin}</span>
      <button className={`xp-how ${s.report ? 'xp-on' : ''}`} aria-pressed={s.report} onClick={() => dispatch({ type: 'report', on: !s.report })}>{s.report ? xt.howBack : xt.how}</button>
      <PreferencesMenu/>
    </header>
    <div className="xp-tabs" role="group" aria-label={xt.tabs}>{(['index', 'structure', 'source'] as const).map(k => <button key={k} aria-pressed={s.tab === k} onClick={() => dispatch({ type: 'tab', tab: k })}>{xt.panels[k]}</button>)}</div>
    <main id="main" ref={body} className={`xp-body xp-tab-${s.tab} ${s.folded.index ? 'xp-idx-closed' : ''} ${s.folded.source ? 'xp-src-closed' : ''} ${m.index.length ? 'xp-with-index' : ''}`}>
      {s.report ? <Report m={m} onLine={pickLine} onLink={openLink}/> : <>
        {m.index.length > 0 && <section className="xp-panel xp-index-panel">{panelHead(xt.panels.index, 'index')}
          {!s.folded.index && <><p className="xp-hint">{xt.panels.indexHint}</p><IndexPanel m={m} view={view} selected={selectedPart} section={s.section} now={now} onSection={pickSection}/></>}</section>}
        <section className="xp-panel xp-structure-panel">{panelHead(xt.panels.structure)}{guideBar}
          <div ref={stage} className="xp-stage">
            <Graph level={m} layout={L} levelKey="top" visible={id => view.vis.has(id)} tone={m.tone} hot={hot} litJoint={litJoint} moved={s.moved} className={sub ? 'xp-lifted' : ''}
              onMove={(key, offset) => dispatch({ type: 'move', key, offset })} names={names} notes={notesOf(m)} stripState={stripState} nodeState={topState}
              members={id => membersOf(m, id).length ? { list: membersOf(m, id), open: !isAspect(id) && s.opened.includes(id), sel: s.member?.part === id ? s.member.id : null, noun: isAspect(id) ? 'roles' : 'components', lifted: isAspect(id) && s.sub === id } : null}
              onNode={onNode} onToggle={id => isAspect(id) ? (s.sub === id ? closeSub() : openSub(id)) : dispatch({ type: 'components', id })}
              onMember={(id, c) => isAspect(id) ? openSub(id, c) : dispatch({ type: 'member', part: id, id: c })}
              onIsland={i => { const at = m.steps.findIndex(st => !('premise' in st) && st.nucleus === i); if (at >= 0) dispatch({ type: 'guide', guide: 'whole' }); if (at >= 0) dispatch({ type: 'goto', at }); }}>
              {subPanel}
            </Graph>
            {graphHeight && <div aria-hidden="true" style={{ height: Math.max(0, graphHeight - L.height - 30) }}/>}
            {aside.length > 0 && <div className="xp-tray"><b>{xt.structure.aside}</b>{aside.map(p => <button key={p.id} className="xp-chip" data-role="aside" aria-pressed={focus === p.id} onClick={() => dispatch({ type: 'explore', id: p.id })}>{p.name}</button>)}</div>}
          </div>
          {stepStrip}
          <Card m={m} target={card} tone={cardTone} pick={s.pick} sub={s.sub}
            onPoint={i => dispatch({ type: 'pick', pick: i === null ? null : { point: i } })} onLink={l => dispatch({ type: 'pick', pick: { link: l } })}
            onNote={id => sub ? dispatch({ type: 'sub-select', id }) : dispatch({ type: 'explore', id })}
            onMember={(part, id) => card?.kind === 'part' && card.members === 'roles' ? openSub(part, id) : dispatch({ type: 'member', part, id })}
            onBackToRole={() => dispatch({ type: 'member', part: card?.kind === 'member' ? card.part : '', id: null })}
            onToggleSub={id => s.sub === id ? closeSub() : openSub(id)}/>
        </section>
        <section className="xp-panel xp-source-panel">{panelHead(xt.panels.source, 'source')}
          {!s.folded.source && <SourcePanel m={m} cites={cites} onLine={pickLine}/>}</section>
      </>}
      <svg ref={wire} className="xp-wires" aria-hidden="true"/>
    </main>
  </div>;
}
