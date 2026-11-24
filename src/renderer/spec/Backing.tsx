import { useEffect, useState } from 'react';
import type { BackingReport, CheckedReference, CheckedStatement, CitedAnswer } from '../../core/backing';
import { quoted } from '../../core/round-answers';
import type { SpecAnchor } from '../../core/spec-remarks';
import type { SpecBridge } from '../http-bridge';
import type { Messages } from '../i18n/it';
import type { SourceExtras } from '../exploration/ExplorationView';
import { usePreferences } from '../preferences';

/**
 * The backing of a handed-over spec in the page (#106): the server's check of what each statement rests on, read
 * again whenever `refresh` changes; flags on the source's lines, a line in "how it was read", and the panel that lists
 * each section's statements with what backs them and turns a flag into a remark.
 */
export type SpecBacking = BackingReport | 'failed' | null;

export function useSpecBacking(id: string | undefined, refresh: unknown, bridge: Pick<SpecBridge, 'getSpecBacking'>): SpecBacking {
  const [read, setRead] = useState<{ id: string; report: BackingReport | 'failed' }>();
  useEffect(() => {
    if (!id) return;
    let active = true;
    void bridge.getSpecBacking(id).then(report => { if (active) setRead({ id, report }); }, () => { if (active) setRead({ id, report: 'failed' }); });
    return () => { active = false; };
  }, [bridge, id, refresh]);
  return read && read.id === id ? read.report : null;
}

/** The flags on the source and the reading in "how it was read", as the exploration view takes them. */
export function backingExtras(backing: SpecBacking, x: Messages['x']['report']): SourceExtras {
  if (backing === null) return {};
  if (backing === 'failed') return { readings: [{ title: x.backing, head: x.backingFailed, body: '' }] };
  // A spec with no reference at all is not covered in marks: it says so once, here.
  if (!backing.declared) return { readings: [{ title: x.backing, head: x.backingNone, body: x.backingNoneBody }] };
  const { unbacked, broken } = totals(backing);
  return {
    flagOf: (from, to) => {
      const flagged = backing.statements.filter(s => s.state !== 'backed' && s.from <= to && from <= s.to);
      return flagged.some(s => s.state === 'broken') ? 'broken' : flagged.length > 0 ? 'unbacked' : undefined;
    },
    readings: [{ title: x.backing, head: x.backingHead(backing.statements.length, unbacked, broken), body: x.backingBody }],
  };
}

export const totals = (report: BackingReport) => ({
  unbacked: report.sections.reduce((n, x) => n + x.unbacked, 0),
  broken: report.sections.reduce((n, x) => n + x.broken, 0),
});

/** The anchor a flag's remark takes: the statement's lines, quoting its words. */
export const anchorOf = (statement: CheckedStatement): SpecAnchor => ({
  from: statement.from, to: statement.to,
  passage: (statement.quote || statement.references.map(x => x.written).join(' ')).slice(0, 5_000),
});

/** The panel beside the exploration: each section's statements, with their state, what backs them and the action on a flag. */
export function BackingPanel({ report, onRemark, onClose }: { report: BackingReport; onRemark?: (anchor: SpecAnchor) => void; onClose: () => void }) {
  const { t } = usePreferences(), b = t.page.backing, lines = t.page.specRemarks.lines;
  return <aside className="spec-remarks spec-backing" aria-label={b.title}>
    <div className="spec-remarks-head"><h2>{b.title}</h2><button type="button" className="subtle" onClick={onClose}>{b.close}</button></div>
    {report.sections.map(section => {
      const id = `spec-backing-${section.line}`;
      const statements = report.statements.filter(s => s.section === section.line);
      return <div key={section.line} role="group" aria-labelledby={id} className="spec-remarks-group">
        <h3 id={id}>{b.section(section.title || b.opening, section.unbacked, section.broken)}</h3>
        <ul>{statements.map(s => {
          const where = lines(s.from, s.to);
          return <li key={`${s.from}-${s.to}`} className="spec-backing-statement" data-state={s.state}>
            <span className="spec-backing-state">{b.states[s.state]}</span>
            <span className="spec-remark-anchor">{`${where} ${quoted(s.quote)}`}</span>
            {s.references.length > 0 && <ul className="spec-backing-references">{s.references.map((r, i) => <li key={i}><Reference reference={r} b={b}/></li>)}</ul>}
            {s.state !== 'backed' && onRemark && <button type="button" className="subtle" aria-label={b.remarkOn(where)} onClick={() => onRemark(anchorOf(s))}>{b.remark}</button>}
          </li>;
        })}</ul>
      </div>;
    })}
  </aside>;
}

function Reference({ reference: r, b }: { reference: CheckedReference; b: Messages['page']['backing'] }) {
  if (!r.found) return <><code>{r.written}</code> {b.notFound}</>;
  if (r.kind === 'answer' && r.answer) {
    return <p className="spec-backing-answer" role="note" aria-label={b.cited(r.written)}>
      <span className="spec-backing-question">{b.question(r.answer.round, r.answer.question)}</span> <b>{r.answer.title}</b> — {answerWords(r.answer, b)}
    </p>;
  }
  return <><code>{r.written}</code>{r.kind === 'link' && r.title ? ` ${r.title}` : ''}</>;
}

/** The answer as the person gave it: their choice in the page's words, then their note. */
function answerWords(answer: CitedAnswer, b: Messages['page']['backing']): string {
  if (!answer.sent) return b.notSent;
  const { choice, option, note } = answer;
  const chosen = choice === 'recommendation' ? b.choice.recommendation(option ?? '')
    : choice === 'none' ? b.choice.none
    : choice !== null ? b.choice.option(choice, option ?? '')
    : '';
  return [chosen, note.trim()].filter(Boolean).join(' · ') || b.choice.none;
}
