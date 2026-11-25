import { useEffect, useMemo, useRef, useState } from 'react';
import { validateExploration, type Exploration } from '../../core/exploration';
import type { SpecFailure, SpecView } from '../../core/spec';
import { ExplorationView } from '../exploration/ExplorationView';
import { markLines, SourceLines } from '../exploration/Panels';
import type { SpecBridge } from '../http-bridge';
import type { Messages } from '../i18n/it';
import { usePreferences } from '../preferences';
import { backingExtras, BackingPanel, totals, useSpecBacking } from './Backing';
import { anchorIn, SpecRemarksPanel, takesRemarks, useSpecRemarks } from './SpecRemarks';

/** The newest handover across every spec: the one the page opens. */
export const newestSpec = (specs: SpecView[]) => specs.reduce<SpecView | undefined>((a, b) => !a || b.handedOverAt > a.handedOverAt ? b : a, undefined);

/**
 * A handed-over spec in the page (#104): its version explored with the app's own view, or the structure being written.
 * The person keeps reading the version they opened when a new one arrives; a superseded version says so and opens
 * the new one on request. A passage selected in the source takes a remark, or says something is missing there (#105);
 * the remarks panel beside the exploration returns them with one Send. What each statement rests on is flagged on
 * the source's lines and listed in the backing panel, where a flag turns into a remark (#106). Until the structure
 * is there, and when it could not be written, the spec reads as its numbered lines and takes remarks the same way
 * (#128): a remark anchors to lines of the spec, never to the structure. Only ids cross to the server.
 */
export function SpecPage({ specs, bridge, onClose }: { specs: SpecView[]; bridge: SpecBridge; onClose: () => void }) {
  const { t } = usePreferences(), s = t.page.spec;
  const [openId, setOpenId] = useState(() => newestSpec(specs)?.id);
  const spec = specs.find(x => x.id === openId) ?? newestSpec(specs);
  const [loaded, setLoaded] = useState<{ key: string; x: Exploration | null }>();
  const [refused, setRefused] = useState(false);
  const key = spec?.exploration ? `${spec.exploration.id}/${spec.exploration.revision}` : undefined;
  // One draft per spec, named by its newest version; read again on every poll, which hands over a new list.
  const remarks = useSpecRemarks(spec?.latest ?? '', specs, bridge);
  const [remarksOpen, setRemarksOpen] = useState(false);
  // Checked again on every poll: an answer sent meanwhile shows beside the statement that cites it.
  const backing = useSpecBacking(spec?.id, specs, bridge);
  /** The lines the backing panel last asked the exploration to show. */
  const [reveal, setReveal] = useState<{ from: number; to: number; at: number }>();
  const extras = useMemo(() => ({ ...backingExtras(backing, t.x.report), reveal }), [backing, t, reveal]);
  const [backingOpen, setBackingOpen] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const [offer, setOffer] = useState<{ anchor: { from: number; to: number; passage: string }; top: number; left: number } | null>(null);
  const readSelection = () => {
    const selection = document.getSelection();
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    // A superseded version takes no new remarks: its text is no longer what the agent works on; nor does an approved one.
    const anchor = range && body.current && spec && takesRemarks(spec, remarks.view) ? anchorIn(body.current, range) : null;
    setOffer(anchor && range ? { anchor, ...below(range) } : null);
  };
  useEffect(() => {
    // A click elsewhere empties the selection, and the offer goes with it.
    const cleared = () => { if (document.getSelection()?.isCollapsed !== false) setOffer(null); };
    document.addEventListener('selectionchange', cleared);
    return () => document.removeEventListener('selectionchange', cleared);
  }, []);

  useEffect(() => {
    if (!spec?.exploration || !key) return;
    let active = true;
    const done = (x: Exploration | null) => { if (active) setLoaded({ key, x }); };
    // What the server sends is checked here again before it is shown, as every exploration the app opens.
    void bridge.findExploration(spec.exploration).then(raw => raw === null ? done(null) : validateExploration(raw).then(done), () => done(null));
    return () => { active = false; };
    // The key names the exploration; the view object changes on every poll.
  }, [bridge, key]);

  // The exploration read for this version: undefined until it arrives, null when the server's copy cannot be shown.
  const exploration = loaded?.key === key ? loaded?.x : undefined;
  // The text is needed only while no exploration can be shown: not written yet, being written, failed, or unreadable.
  const textNeeded = !!spec && (!spec.exploration || exploration === null);
  const [specText, setSpecText] = useState<{ id: string; text: string }>();
  useEffect(() => {
    if (!spec || !textNeeded) return;
    let active = true;
    const id = spec.id;
    // Without the text the page still says where the structure stands; nothing else depends on it.
    bridge.getSpecText(id).then(text => { if (active) setSpecText({ id, text }); }, () => undefined);
    return () => { active = false; };
    // The id names the version; the view object changes on every poll.
  }, [bridge, spec?.id, textNeeded]);

  if (!spec) return null;
  const act = (call: (id: string) => Promise<void>) => { setRefused(false); call(spec.id).catch(() => setRefused(true)); };
  const versions = specs.filter(x => x.latest === spec.latest);
  const remark = (missing: boolean) => {
    if (!offer) return;
    const { from, to, passage } = offer.anchor;
    remarks.add(spec.number, missing ? { from, to, missing: true } : { from, to, passage });
    setRemarksOpen(true);
    setOffer(null);
    document.getSelection()?.removeAllRanges();
  };
  const count = remarks.draft?.remarks.length ?? 0;
  /**
   * A statement found in the source from the backing panel: the exploration opens its source if hidden and marks the
   * lines; while there is no exploration, the spec's numbered lines are marked here.
   */
  const locate = (from: number, to: number) => {
    if (exploration) return setReveal(r => ({ from, to, at: (r?.at ?? 0) + 1 }));
    if (body.current) markLines(body.current, from, to);
  };
  const report = backing !== null && backing !== 'failed' && backing.declared ? backing : null;
  const flagged = report && totals(report);
  const offerButtons = offer && <div className="round-selection-offer spec-selection-offer" style={{ top: offer.top, left: offer.left }} onMouseDown={event => event.preventDefault()}>
    <button type="button" className="round-remark-offer" onClick={() => remark(false)}>{t.page.specRemarks.remark}</button>
    <button type="button" className="round-remark-offer" onClick={() => remark(true)}>{t.page.specRemarks.missingHere}</button>
  </div>;

  return <div className="spec-page">
    <div className="spec-bar">
      <span className="spec-version">{s.version(spec.number, spec.location)}</span>
      {spec.superseded && <p className="spec-superseded" role="status">
        {s.superseded} · <button type="button" className="spec-link" onClick={() => setOpenId(spec.latest)}>{s.openNew}</button>
      </p>}
      {flagged && <button type="button" className="subtle spec-backing-toggle" aria-expanded={backingOpen} onClick={() => setBackingOpen(x => !x)}>{t.page.backing.toggle(flagged.unbacked, flagged.broken)}</button>}
      <button type="button" className="subtle spec-remarks-toggle" aria-expanded={remarksOpen} onClick={() => setRemarksOpen(x => !x)}>{t.page.specRemarks.toggle(count)}</button>
    </div>
    <div className="spec-main">
    {exploration
      ? <div ref={body} className="spec-body" onMouseUp={readSelection} onKeyUp={readSelection}>
        <ExplorationView key={key} x={exploration} goHome={onClose} backLabel={s.close} extras={extras}/>
        {offerButtons}
      </div>
      : <main id="main" className="spec-waiting">
        <h1>{spec.title}</h1>
        {spec.exploration
          ? exploration === null && <p role="alert">{s.unreadable}</p>
          : <Writing spec={spec} t={t} onExplore={() => act(id => bridge.exploreSpec(id))} onCancel={() => act(id => bridge.cancelSpec(id))}/>}
        {refused && <p role="alert">{s.actionFailed}</p>}
        {specText?.id === spec.id && <div ref={body} className="spec-body spec-text" onMouseUp={readSelection} onKeyUp={readSelection}>
          <div className="xp-source"><SourceLines text={specText.text} title={spec.title} code={false} cites={NO_CITES}/></div>
          {offerButtons}
        </div>}
      </main>}
    {backingOpen && report && <BackingPanel report={report} onClose={() => setBackingOpen(false)} onLocate={locate}
      // A superseded or approved version takes no new remarks: its flags stay marks.
      onRemark={!takesRemarks(spec, remarks.view) ? undefined : anchor => { remarks.add(spec.number, anchor); setRemarksOpen(true); }}/>}
    {remarksOpen && <SpecRemarksPanel spec={spec} versions={versions} remarks={remarks} onClose={() => setRemarksOpen(false)}/>}
    </div>
  </div>;
}

/** The plain text cites nothing: no part has read it yet. */
const NO_CITES: [] = [];

/** Where the offer goes: under the selection's end, in the window, so it covers neither the passage nor its line. */
function below(range: Range): { top: number; left: number } {
  // jsdom lays nothing out and has no rectangle for a range.
  if (typeof range.getBoundingClientRect !== 'function') return { top: 0, left: 0 };
  const rect = range.getBoundingClientRect();
  return { top: rect.bottom + 4, left: Math.max(0, rect.right - 40) };
}

function Writing({ spec, t, onExplore, onCancel }: { spec: SpecView; t: Messages; onExplore: () => void; onCancel: () => void }) {
  const s = t.page.spec, run = spec.run;
  if (run?.state === 'running') return <p className="spec-run">{run.repairing ? s.repairing : s.writing} <button type="button" onClick={onCancel}>{s.cancel}</button></p>;
  if (run?.state === 'failed') {
    const why = run.failure.code === 'cancelled' ? s.cancelled : `${s.failed} ${failureWords(t, run.failure)}`.trim();
    return <><p role="alert">{why}</p>
      {run.failure.issues && <ul className="issue-list">{run.failure.issues.map((x, i) => <li key={i}>{x}</li>)}</ul>}
      <button type="button" className="primary" onClick={onExplore}>{s.retry}</button></>;
  }
  return <><p>{s.notWritten}</p><button type="button" className="primary" onClick={onExplore}>{s.write}</button></>;
}

/** The failure in the interface's words: its reason when the catalog has one, else its code. */
function failureWords(t: Messages, failure: SpecFailure): string {
  const { reason, code } = failure;
  if (reason !== undefined && Object.hasOwn(t.reasons, reason)) return t.reasons[reason as keyof Messages['reasons']];
  if (Object.hasOwn(t.failures, code)) return t.failures[code as keyof Messages['failures']];
  return '';
}
