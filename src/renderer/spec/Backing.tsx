import { useEffect, useMemo, useState } from 'react';
import type { BackingReport, CheckedReference, CheckedStatement, CitedAnswer } from '../../core/backing';
import type { SpecAnchor } from '../../core/spec-remarks';
import type { SpecBridge } from '../http-bridge';
import { renderInlineMarkdown } from '../markdown';
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

/** Which statements the panel lists: those to fix, or every one. */
type Shown = 'flagged' | 'all';

/**
 * The panel beside the exploration: each section's statements, with their state, what backs them and the action on a
 * flag. A statement reads as a card: where it stands (a button that finds it in the source), its words, then what it
 * rests on, one reference a row. A cited answer folds to one line (the question and what the person chose), since one
 * answer often backs many statements; unfolded it keeps the agent's words and the person's note apart.
 */
export function BackingPanel({ report, onRemark, onLocate, onClose }: {
  report: BackingReport;
  onRemark?: (anchor: SpecAnchor) => void;
  /** Brings the statement's lines into view in the source. */
  onLocate?: (from: number, to: number) => void;
  onClose: () => void;
}) {
  const { t } = usePreferences(), b = t.page.backing, lines = t.page.specRemarks.lines;
  const flaggedCount = report.statements.filter(s => s.state !== 'backed').length;
  const [shown, setShown] = useState<Shown>(flaggedCount > 0 ? 'flagged' : 'all');
  const listed = (s: CheckedStatement) => shown === 'all' || s.state !== 'backed';
  const sections = report.sections.filter(section => report.statements.some(s => s.section === section.line && listed(s)));
  return <aside className="spec-remarks spec-backing" aria-label={b.title}>
    <div className="spec-remarks-head"><h2>{b.title}</h2><button type="button" className="subtle" onClick={onClose}>{b.close}</button></div>
    <div className="spec-backing-filter" role="group" aria-label={b.show}>
      <button type="button" aria-pressed={shown === 'flagged'} onClick={() => setShown('flagged')}>{b.flaggedOnly(flaggedCount)}</button>
      <button type="button" aria-pressed={shown === 'all'} onClick={() => setShown('all')}>{b.all(report.statements.length)}</button>
    </div>
    {sections.length === 0 && <p className="spec-backing-empty">{b.nothingFlagged}</p>}
    {sections.map(section => {
      const id = `spec-backing-${section.line}`;
      const statements = report.statements.filter(s => s.section === section.line && listed(s));
      return <section key={section.line} aria-labelledby={id} className="spec-remarks-group spec-backing-section">
        <h3 id={id}>{b.section(section.title || b.opening, section.unbacked, section.broken)}</h3>
        <ul>{statements.map(s => {
          const where = lines(s.from, s.to);
          return <li key={`${s.from}-${s.to}`} className="spec-backing-statement" data-state={s.state}>
            <div className="spec-backing-top">
              <span className="spec-backing-state">{b.states[s.state]}</span>
              {onLocate
                ? <button type="button" className="spec-backing-where" aria-label={b.locate(where)} onClick={() => onLocate(s.from, s.to)}>{where}</button>
                : <span className="spec-backing-where">{where}</span>}
            </div>
            {s.quote && <Inline className="spec-backing-quote" text={s.quote}/>}
            <div className="spec-backing-rests">
              <span className="spec-backing-label">{b.restsOn}</span>
              {s.references.length === 0
                ? <p className="spec-backing-nothing">{b.restsOnNothing}</p>
                : <ul className="spec-backing-references">{s.references.map((r, i) => <li key={i} data-found={r.found}><Reference reference={r} b={b}/></li>)}</ul>}
            </div>
            {s.state !== 'backed' && onRemark && <button type="button" className="subtle" aria-label={b.remarkOn(where)} onClick={() => onRemark(anchorOf(s))}>{b.remark}</button>}
          </li>;
        })}</ul>
      </section>;
    })}
  </aside>;
}

function Reference({ reference: r, b }: { reference: CheckedReference; b: Messages['page']['backing'] }) {
  const written = <code className="spec-backing-ref">{r.written}</code>;
  const kind = <span className="spec-backing-kind">{b.kinds[r.kind]}</span>;
  if (!r.found) return <p className="spec-backing-row">{written}{kind}<span className="spec-backing-missing">{b.notFound}: {b.notFoundWhy[r.kind]}</span></p>;
  if (r.kind === 'answer' && r.answer) return <CitedAnswerRow written={r.written} answer={r.answer} b={b}/>;
  return <p className="spec-backing-row">{written}{kind}{r.kind === 'link' && r.title && <span className="spec-backing-title">{r.title}</span>}</p>;
}

/** A cited answer: one line folded (the question, and what the person chose); unfolded, the agent's words and the note. */
function CitedAnswerRow({ written, answer, b }: { written: string; answer: CitedAnswer; b: Messages['page']['backing'] }) {
  const { choice, option, note } = answer;
  const letter = choice !== null && choice !== 'recommendation' && choice !== 'none' ? choice : null;
  const answered = !answer.sent ? b.answered.notSent
    : choice === 'recommendation' ? b.answered.recommendation
    : letter ? b.answered.option(letter)
    : choice === 'none' ? b.answered.none
    : b.answered.noteOnly;
  const agent = answer.sent && option && (choice === 'recommendation' || letter) ? option : null;
  const said = note.trim();
  const head = <>
    <code className="spec-backing-ref">{written}</code>
    <span className="spec-backing-question">{answer.title}</span>
    <span className="spec-backing-choice">{answered}</span>
  </>;
  if (!agent && !said) return <p className="spec-backing-row spec-backing-answer" role="note" aria-label={b.cited(written)}>{head}</p>;
  return <details className="spec-backing-answer" aria-label={b.cited(written)}>
    <summary className="spec-backing-row">{head}</summary>
    <dl>
      {agent && <div className="spec-backing-said" data-who="agent"><dt>{b.agentWrote(letter)}</dt><dd><Inline text={agent}/></dd></div>}
      {said && <div className="spec-backing-said" data-who="person"><dt>{b.yourNote}</dt><dd>{said}</dd></div>}
    </dl>
  </details>;
}

/** The agent's words and a statement's: inline Markdown, rendered safely (no HTML, links as text), as an option's label is. */
function Inline({ text, className }: { text: string; className?: string }) {
  const html = useMemo(() => renderInlineMarkdown(text), [text]);
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }}/>;
}
