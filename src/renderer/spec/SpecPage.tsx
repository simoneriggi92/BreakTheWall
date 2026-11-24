import { useEffect, useState } from 'react';
import { validateExploration, type Exploration } from '../../core/exploration';
import type { SpecFailure, SpecView } from '../../core/spec';
import { ExplorationView } from '../exploration/ExplorationView';
import type { SpecBridge } from '../http-bridge';
import type { Messages } from '../i18n/it';
import { usePreferences } from '../preferences';

/** The newest handover across every spec: the one the page opens. */
export const newestSpec = (specs: SpecView[]) => specs.reduce<SpecView | undefined>((a, b) => !a || b.handedOverAt > a.handedOverAt ? b : a, undefined);

/**
 * A handed-over spec in the page (#104): its version explored with the app's own view, or the structure being written.
 * The person keeps reading the version they opened when a new one arrives; a superseded version says so and opens
 * the new one on request. Only ids cross to the server.
 */
export function SpecPage({ specs, bridge, onClose }: { specs: SpecView[]; bridge: SpecBridge; onClose: () => void }) {
  const { t } = usePreferences(), s = t.page.spec;
  const [openId, setOpenId] = useState(() => newestSpec(specs)?.id);
  const spec = specs.find(x => x.id === openId) ?? newestSpec(specs);
  const [loaded, setLoaded] = useState<{ key: string; x: Exploration | null }>();
  const [refused, setRefused] = useState(false);
  const key = spec?.exploration ? `${spec.exploration.id}/${spec.exploration.revision}` : undefined;

  useEffect(() => {
    if (!spec?.exploration || !key) return;
    let active = true;
    const done = (x: Exploration | null) => { if (active) setLoaded({ key, x }); };
    // What the server sends is checked here again before it is shown, as every exploration the app opens.
    void bridge.findExploration(spec.exploration).then(raw => raw === null ? done(null) : validateExploration(raw).then(done), () => done(null));
    return () => { active = false; };
    // The key names the exploration; the view object changes on every poll.
  }, [bridge, key]);

  if (!spec) return null;
  const act = (call: (id: string) => Promise<void>) => { setRefused(false); call(spec.id).catch(() => setRefused(true)); };
  const exploration = loaded?.key === key ? loaded?.x : undefined;

  return <div className="spec-page">
    <div className="spec-bar">
      <span className="spec-version">{s.version(spec.number, spec.location)}</span>
      {spec.superseded && <p className="spec-superseded" role="status">
        {s.superseded} · <button type="button" className="spec-link" onClick={() => setOpenId(spec.latest)}>{s.openNew}</button>
      </p>}
    </div>
    {exploration
      ? <ExplorationView key={key} x={exploration} goHome={onClose}/>
      : <main id="main" className="spec-waiting">
        <h1>{spec.title}</h1>
        {spec.exploration
          ? loaded?.key === key && <p role="alert">{s.unreadable}</p>
          : <Writing spec={spec} t={t} onExplore={() => act(id => bridge.exploreSpec(id))} onCancel={() => act(id => bridge.cancelSpec(id))}/>}
        {refused && <p role="alert">{s.actionFailed}</p>}
      </main>}
  </div>;
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
