import { useEffect, useRef, useState } from 'react';
import { quoted } from '../../core/round-answers';
import type { SpecView } from '../../core/spec';
import {
  specRemarkKey, specRemarksMessage, withSpecRemark,
  type SpecAnchor, type SpecRemark, type SpecRemarksDraft, type SpecRemarksSection, type SpecRemarksView,
} from '../../core/spec-remarks';
import { RidesError, type SpecRemarksBridge } from '../http-bridge';
import type { Messages } from '../i18n/it';
import { usePreferences } from '../preferences';
import { QueuedNotice, useLatestSaver } from '../round/shared';

/**
 * Remarks on a handed-over spec (#105): one draft per spec, saved on every change, previewed with the function the
 * server sends with, and returned with one Send; what was sent stays below, read-only.
 */
export interface SpecRemarks {
  /** The draft, once read from the server. */
  draft: SpecRemarksDraft | null;
  view: SpecRemarksView | null;
  /**
   * Adds a remark on `anchor` of `version`, or finds the one it has, and opens its field. What a passage selected in
   * the source calls, and what turning a backing flag into a remark (#106) calls with the flagged lines and quote.
   */
  add(version: number, anchor: SpecAnchor, text?: string): void;
  change(next: SpecRemarksDraft): void;
  send(): Promise<void>;
  sending: boolean;
  /** The message as the agent received it, just now; cleared by the next change. */
  justSent: string | null;
  failure: 'save' | 'send' | undefined;
  /** The remark whose field opens focused. */
  focus: string | null;
}

/** The remarks of the spec `id` names (any of its versions), read again whenever `refresh` changes. */
export function useSpecRemarks(id: string, refresh: unknown, bridge: SpecRemarksBridge): SpecRemarks {
  const { language } = usePreferences();
  const [view, setView] = useState<SpecRemarksView | null>(null);
  const [draft, setDraft] = useState<SpecRemarksDraft | null>(null);
  // Changes read the latest draft from here, so two quick edits never build on the same stale copy.
  const latest = useRef<SpecRemarksDraft | null>(null);
  const loadedFor = useRef<string | null>(null);
  const [sending, setSending] = useState(false);
  const [justSent, setJustSent] = useState<string | null>(null);
  const [failure, setFailure] = useState<'save' | 'send'>();
  const [focus, setFocus] = useState<string | null>(null);
  const saver = useLatestSaver((next: SpecRemarksDraft) => bridge.saveSpecRemarks(id, next), false, setFailure);
  const take = (next: SpecRemarksView, withDraft: boolean) => {
    setView(next);
    if (withDraft) { latest.current = next.draft; setDraft(next.draft); }
  };

  useEffect(() => {
    let active = true;
    // The draft is taken once per spec: later reads bring what was sent and where it goes, never over what is typed.
    void bridge.getSpecRemarks(id).then(next => { if (active) { take(next, loadedFor.current !== id); loadedFor.current = id; } }, () => {});
    return () => { active = false; };
  }, [bridge, id, refresh]);

  const change = (next: SpecRemarksDraft) => {
    latest.current = next;
    setDraft(next);
    setJustSent(null);
    saver(next);
  };
  const add = (version: number, anchor: SpecAnchor, text = '') => {
    const before = latest.current ?? { generalNote: '', remarks: [] };
    const next = withSpecRemark(before, version, anchor, text);
    if (next !== before) change(next);
    setFocus(specRemarkKey({ version, ...anchor }));
  };
  const send = async () => {
    if (!latest.current) return;
    setSending(true);
    setFailure(undefined);
    try {
      // A save still on its way would land after the Send and put what it sends back into the draft (#105).
      await saver.settle();
      setJustSent(await bridge.sendSpecRemarks(id, latest.current, language));
      take(await bridge.getSpecRemarks(id), true);
    } catch (error) {
      // A round arrived meanwhile: the remarks ride with it, which the next read says.
      if (error instanceof RidesError) void bridge.getSpecRemarks(id).then(next => take(next, false), () => {});
      else setFailure('send');
    } finally {
      setSending(false);
    }
  };
  return { draft, view, add, change, send, sending, justSent, failure, focus };
}

/** Where a remark stands, as the page and the message word it: its lines, then the quote or "(missing here)". */
const whereOf = (s: Messages['page']['specRemarks'], x: Pick<SpecRemark, 'from' | 'to' | 'passage' | 'missing'>) =>
  `${s.lines(x.from, x.to)} ${x.missing ? s.missing : quoted(x.passage ?? '')}`;

/** The remarks panel beside the exploration: the draft by version, the general note, the message, Send, and what was sent. */
export function SpecRemarksPanel({ spec, versions, remarks, onClose }: { spec: SpecView; versions: SpecView[]; remarks: SpecRemarks; onClose: () => void }) {
  const { t, language } = usePreferences();
  const s = t.page.specRemarks;
  const { draft, view } = remarks;
  if (!draft || !view) return <aside className="spec-remarks" aria-label={s.title}/>;
  const newest = versions.find(x => x.id === spec.latest) ?? spec;
  const section: SpecRemarksSection = {
    title: newest.title, location: newest.location, draft,
    versions: versions.map(x => ({ number: x.number, location: x.location, handedOverAt: x.handedOverAt })),
  };
  const message = specRemarksMessage(section, language);
  const numbers = [...new Set(draft.remarks.map(x => x.version))].sort((a, b) => a - b);
  const edit = (target: SpecRemark, patch: Partial<SpecRemark> | null) => remarks.change({
    ...draft, remarks: draft.remarks.flatMap(x => specRemarkKey(x) !== specRemarkKey(target) ? [x] : patch ? [{ ...x, ...patch }] : []),
  });
  const versionOf = (n: number) => versions.find(x => x.number === n);

  return <aside className="spec-remarks" aria-label={s.title}>
    <div className="spec-remarks-head"><h2>{s.title}</h2><button type="button" className="subtle" onClick={onClose}>{s.close}</button></div>
    {spec.superseded ? <p role="note">{s.noNew}</p> : draft.remarks.length === 0 && <p className="xp-hint">{s.empty}</p>}
    {numbers.map(n => {
      const label = versionOf(n);
      return <div key={n} role="group" aria-labelledby={`spec-remarks-v${n}`} className="spec-remarks-group">
        <h3 id={`spec-remarks-v${n}`}>{label ? t.page.spec.version(n, label.location) : t.page.spec.version(n, '')}</h3>
        <ul>{draft.remarks.filter(x => x.version === n).map(remark => {
          const where = whereOf(s, remark);
          return <li key={specRemarkKey(remark)}>
            <span className="spec-remark-anchor">{where}</span>
            <textarea aria-label={s.remarkOn(where)} autoFocus={remarks.focus === specRemarkKey(remark)} value={remark.text} rows={2}
              onChange={event => edit(remark, { text: event.target.value })}/>
            <button type="button" className="subtle" aria-label={s.removeOn(where)} onClick={() => edit(remark, null)}>{s.remove}</button>
          </li>;
        })}</ul>
      </div>;
    })}
    <div className="round-field">
      <label htmlFor="spec-general-note">{s.generalNote}</label>
      <textarea id="spec-general-note" aria-describedby="spec-general-hint" value={draft.generalNote} rows={2} onChange={event => remarks.change({ ...draft, generalNote: event.target.value })}/>
      <small id="spec-general-hint">{s.generalNoteHint}</small>
    </div>
    {message !== '' && <>
      <h3>{s.receives}</h3>
      <pre className="round-message" data-testid="spec-remarks-message">{message}</pre>
    </>}
    {view.transcriptGone
      ? <p role="note">{t.page.session.transcriptGone}</p>
      : view.rides !== null
        ? <p role="note">{s.rides(view.rides)}</p>
        : message !== '' && <button type="button" className="primary" disabled={remarks.sending} onClick={() => void remarks.send()}>{remarks.sending ? s.sending : s.send}</button>}
    {remarks.justSent !== null && <p role="status">{s.sent}</p>}
    {remarks.failure && <p role="alert">{remarks.failure === 'send' ? s.sendFailed : s.saveFailed}</p>}
    {view.sent.length > 0 && <section className="spec-remarks-sent" aria-label={s.sentTitle}>
      <h3>{s.sentTitle}</h3>
      {/* Newest first: what was just sent stands under the Send that sent it. */}
      {[...view.sent].reverse().map(batch => <div key={batch.at} className="spec-remarks-batch">
        <p>{batch.round === null ? s.sentAlone : s.sentWith(batch.round)}</p>
        {batch.queued && <QueuedNotice session={batch.session}/>}
        {batch.generalNote && <p className="round-remark-text">{batch.generalNote}</p>}
        <ul>{batch.remarks.map(remark => <li key={specRemarkKey(remark)}>
          <span className="spec-remark-anchor">{whereOf(s, remark)}</span>
          <p className="round-remark-text">{remark.text}</p>
        </li>)}</ul>
      </div>)}
    </section>}
  </aside>;
}

/**
 * The anchor a selection makes in the exploration's source, or null when it is empty or leaves the source: the lines
 * of the blocks it starts and ends in, read from their `data-from` and `data-to`, and its words on one line.
 */
export function anchorIn(root: HTMLElement, range: Range): { from: number; to: number; passage: string } | null {
  const source = root.querySelector<HTMLElement>('.xp-source');
  if (range.collapsed || !source || !source.contains(range.startContainer) || !source.contains(range.endContainer)) return null;
  const block = (node: Node) => {
    const found = (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>('[data-from]');
    return found && source.contains(found) ? found : null;
  };
  const first = block(range.startContainer), last = block(range.endContainer);
  if (!first || !last) return null;
  const lines = [first, last].flatMap(x => [Number(x.dataset.from), Number(x.dataset.to ?? x.dataset.from)]);
  if (lines.some(x => !Number.isInteger(x) || x < 1)) return null;
  const passage = range.toString().replace(/\s+/g, ' ').trim().slice(0, 5_000);
  return passage === '' ? null : { from: Math.min(...lines), to: Math.max(...lines), passage };
}
