import type { Cite, Disassembly, Part } from '../../core/disassembly';
import type { RepresentationChoice } from '../../core/representation';
import { usePreferences } from '../preferences';

/**
 * Why the app drew this source as it did (P-20261103-lab-mode L11): the metaphor test's verdict, which speaks of the
 * metaphors in the library and never of every possible object; its failures; and each correspondence with where the
 * analogy ends. The texts come from the library, so nothing here says more than the test checked.
 */
export function WhyRepresentation({ d, choice }: { d: Disassembly; choice: RepresentationChoice }) {
  const { t } = usePreferences(), L = t.d.lab, name = (id: string) => d.parts.find(p => p.id === id)!.name;
  const failures = [...choice.parts.flatMap(x => x.as === 'none' ? [`«${name(x.part)}»: ${L.noComponent}`] : []),
    ...choice.joints.flatMap(x => { const j = d.joints[x.joint]; return x.ok ? [] : [`«${name(j.from)}» → «${name(j.to)}»: ${L.noConnection(t.d.verbs[j.type])}`]; })];
  return <details className="guided-block lab-why" open>
    <summary>{L.why}</summary>
    <p>{choice.view === 'object' ? L.verdictObject : L.verdictAtlas(choice.failures)}</p>
    {failures.length > 0 && <ul className="lab-failures" lang={d.language}>{failures.map((f, i) => <li key={i}>⚠ {f}</li>)}</ul>}
    <p className="muted">{L.tried}</p>
    <details className="lab-correspondences"><summary>{L.correspondences}</summary>
      <table className="lab-corr"><tbody>
        {choice.parts.map(x => <tr key={x.part} data-row="part" className={x.as === 'none' ? 'no' : 'ok'}>
          <td aria-hidden="true">{x.as === 'none' ? '✗' : '✓'}</td>
          <td><b lang={d.language}>{name(x.part)}</b><br/><span className="muted">{x.as === 'component' ? `${L.components[x.component]}: ${L.does[x.component]}` : x.as === 'annotation' ? L.annotation : L.noComponent}</span>
            {x.as === 'component' && <><br/><span className="muted">⚠ {L.ends[x.component]}</span></>}</td></tr>)}
        {choice.joints.map(x => { const j = d.joints[x.joint];
          return <tr key={x.joint} data-row="joint" className={x.ok ? 'ok' : 'no'}><td aria-hidden="true">{x.ok ? '✓' : '✗'}</td>
            <td><span lang={d.language}>{name(j.from)} → {name(j.to)} <span className="muted">«{j.label}»</span></span><br/>
              <span className="muted">{x.ok ? `${L.connections[x.connection]}: ${L.says[x.connection]}` : L.noConnection(t.d.verbs[j.type])}</span></td></tr>; })}
      </tbody></table></details>
  </details>;
}

/** A part's card: what it is in the drawing and where that stops being true. */
export function InDrawing({ choice, part, top }: { choice: RepresentationChoice; part: Part; top: boolean }) {
  const { t } = usePreferences(), L = t.d.lab, fit = choice.parts.find(x => x.part === part.id);
  const [look, limit] = choice.view === 'atlas' ? [L.atlasLook, L.atlasLimit]
    : !top ? [L.subLook, L.subLimit]
    : fit?.as === 'component' ? [`${capital(L.components[fit.component])}: ${L.does[fit.component]}.`, `${capital(L.ends[fit.component])}.`]
    : [L.annotationLook, L.annotationLimit];
  return <details className="guided-block lab-in">
    <summary>{choice.view === 'atlas' ? L.inMap : L.inObject}</summary>
    <ul><li>{look}</li><li className="m-caveat">⚠ {limit}</li></ul>
  </details>;
}
const capital = (s: string) => s[0].toUpperCase() + s.slice(1);

/**
 * Context the drawing leaves out, kept as annotations linked to the source: the parts' ⚠ points and limits, and the
 * lines the bill of materials excludes as context. Those come from the margin the reading already has (z).
 */
export function Annotations({ d, choice, context, onCite, onPart }: { d: Disassembly; choice: RepresentationChoice; context: (Cite & { note?: string })[]; onCite: (c: Cite) => void; onPart: (id: string) => void }) {
  const { t } = usePreferences(), L = t.d.lab;
  const caveats = d.parts.map(p => ({ p, n: (p.points ?? []).filter(x => x.mark === 'caveat').length })).filter(x => x.n);
  const limits = choice.parts.flatMap(x => x.as === 'annotation' ? [d.parts.find(p => p.id === x.part)!] : []);
  const n = caveats.length + limits.length + context.length;
  if (!n) return null;
  return <details className="guided-block lab-annotations">
    <summary>{L.annotations(n)}</summary>
    <ul lang={d.language}>
      {caveats.map(({ p, n }) => <li key={p.id} className="m-caveat">⚠ <button className="link" onClick={() => onPart(p.id)}>{p.name}</button>: {L.caveats(n)}</li>)}
      {limits.map(p => <li key={p.id}>· <button className="link" onClick={() => onPart(p.id)}>{p.name}</button>: {L.annotation}</li>)}
      {context.map((c, i) => <li key={i}>· {L.context}{c.note && <>: {c.note}</>} <button className="cite" onClick={() => onCite(c)}>{t.d.lines(c.from, c.to)}</button></li>)}
    </ul>
  </details>;
}
