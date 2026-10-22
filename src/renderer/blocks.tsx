import { useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronDown, Link2, Pin, Search, TriangleAlert } from 'lucide-react';
import type { Activity, Block, Lesson, Point } from '../core/lesson';
import { sourceExcerpt } from '../core/lesson';
import { evaluate, solved, type LearnerState } from '../core/state';
import { Icon } from './icons';

export type ChangeState = (update: (state: LearnerState) => LearnerState) => void;
export function Points({ points }: { points: Point[] }) {
  return <ul className="points">{points.map((point, i) => <li key={i}><Icon name={point.icon} size={18}/><span>{point.text}</span></li>)}</ul>;
}
export function EvidenceView({ lesson, ids, compact = false }: { lesson: Lesson; ids: string[]; compact?: boolean }) {
  const [selected, setSelected] = useState(ids[0]);
  const active = ids.includes(selected) ? selected : ids[0];
  const { source, ref, lines } = sourceExcerpt(lesson, active);
  return <section className={`evidence ${compact ? 'compact' : ''}`} aria-label="Collega alla fonte">
    <div className="evidence-head"><span className="section-label"><Link2 size={16} aria-hidden="true"/> Collega alla fonte</span><span className="micro">{lesson.kind === 'generated' ? 'LA TUA FONTE' : 'TESTO ORIGINALE'}</span></div>
    {ids.length > 1 && <div className="evidence-tabs" aria-label="Estratti disponibili">{ids.map((id, i) => <button key={id} aria-pressed={id === active} onClick={() => setSelected(id)}>Estratto {i + 1}</button>)}</div>}
    <div className="source-caption"><Icon name={source.language ? 'code' : 'book'} size={15}/><span>{source.title}</span><span>L{ref.startLine}–{ref.endLine}</span></div>
    <div className={`source-lines ${source.language ? 'code-lines' : ''}`} tabIndex={0} aria-label="Estratto della fonte; righe evidenziate collegate al passo attivo">
      {lines.map((line, i) => <div key={i} className={`source-line ${ref.highlights.includes(ref.startLine + i) ? 'highlight' : ''}`}><span className="line-number" aria-hidden="true">{ref.startLine + i}</span><span>{line || ' '}</span>{ref.highlights.includes(ref.startLine + i) && <span className="sr-only"> · riga evidenziata</span>}</div>)}
    </div>
    <p className="evidence-note">{lesson.kind === 'generated' ? 'Righe citate dal modello, copiate esattamente dalla tua fonte' : 'Fonte didattica originale'} · rev. {source.revision} · le righe colorate sostengono il punto attivo.</p>
  </section>;
}

interface SourceOptions { sourcePinned: boolean; setSourcePinned: (value: boolean) => void }
function WithSource({ lesson, ids, sourcePinned, setSourcePinned, children, className }: SourceOptions & { lesson: Lesson; ids: string[]; children: React.ReactNode; className: string }) {
  const [open, setOpen] = useState(false);
  const expanded = open || sourcePinned;
  const hasCode = ids.some(id => sourceExcerpt(lesson, id).source.language);
  return <div className={`${className} ${expanded ? 'with-source' : ''}`}><div className="explanation-copy">{children}<div className="source-actions"><button className="text-button" aria-expanded={expanded} onClick={() => { setOpen(!expanded); if (expanded) setSourcePinned(false); }}><Link2 size={16}/>{expanded ? 'Chiudi la fonte' : hasCode ? 'Collega al codice' : 'Collega alla fonte'}</button>{expanded && <button className="pin-source" aria-pressed={sourcePinned} onClick={() => { setOpen(true); setSourcePinned(!sourcePinned); }}><Pin size={14}/>{sourcePinned ? 'Fonte fissata' : 'Tieni affiancata'}</button>}</div></div>{expanded && <EvidenceView lesson={lesson} ids={ids} compact/>}</div>;
}

function MapBlock({ block, lesson, state, change, sourcePinned, setSourcePinned }: SourceOptions & { block: Extract<Block, { type: 'map' }>; lesson: Lesson; state: LearnerState; change: ChangeState }) {
  const selected = block.nodes.find(n => n.id === state.nodes[block.id]) ?? block.nodes[0];
  return <section className="block map-block"><div className="block-heading"><span className="section-label"><Icon name="route" size={17}/> MAPPA DEL CONCETTO</span><span className="micro">SELEZIONA UN BLOCCO</span></div><h2>{block.title}</h2>
    <ol className="map-path">{block.nodes.map((node, i) => <li key={node.id}><button className={`map-node tone-${node.tone}`} aria-pressed={selected.id === node.id} onClick={() => change(s => ({ ...s, nodes: { ...s.nodes, [block.id]: node.id } }))}><span className="node-top"><span className="node-icon"><Icon name={node.icon} size={23}/></span><span className="node-number">0{i + 1}</span></span><strong>{node.title}</strong><small>{node.summary}</small></button>{block.edges.filter(e => e.from === node.id).map(e => <div className="map-relation" key={e.to}><ArrowRight size={14} aria-hidden="true"/><span>{e.label}{i === block.nodes.length - 1 ? ` ${block.nodes.find(n => n.id === e.to)?.title.toLocaleLowerCase()}` : ''}</span></div>)}</li>)}</ol>
    <WithSource lesson={lesson} ids={selected.evidenceIds} className="map-detail" sourcePinned={sourcePinned} setSourcePinned={setSourcePinned}><div className="concept-copy"><h3><Icon name={selected.icon} size={23}/>{selected.title}</h3><Points points={selected.points}/></div></WithSource>
  </section>;
}

function SequenceBlock({ block, lesson, state, change, sourcePinned, setSourcePinned }: SourceOptions & { block: Extract<Block, { type: 'sequence' }>; lesson: Lesson; state: LearnerState; change: ChangeState }) {
  const index = Math.max(0, block.frames.findIndex(f => f.id === state.frames[block.id]));
  const frame = block.frames[index];
  const setFrame = (i: number) => change(s => ({ ...s, frames: { ...s.frames, [block.id]: block.frames[i].id } }));
  return <section className="block sequence-block"><div className="block-heading"><span className="section-label"><Icon name="layers" size={17}/> SEQUENZA CONTROLLABILE</span><span className="micro">MODELLO ILLUSTRATIVO</span></div><h2>{block.title}</h2>
    <div className="frame-tabs" aria-label="Fotogrammi">{block.frames.map((f, i) => <button key={f.id} aria-pressed={i === index} onClick={() => setFrame(i)}><span>{i + 1}</span><Icon name={f.icon} size={17}/><small>{f.title}</small></button>)}</div>
    <WithSource lesson={lesson} ids={frame.evidenceIds} className="frame-layout" sourcePinned={sourcePinned} setSourcePinned={setSourcePinned}><div className="frame-copy" key={frame.id} aria-live="polite"><span className="frame-counter">FOTOGRAMMA {index + 1} DI {block.frames.length}</span><h3><Icon name={frame.icon} size={25}/>{frame.title}</h3><dl className="state-flow"><div><dt>PRIMA</dt><dd>{frame.before}</dd></div><div className="state-action"><dt>AZIONE</dt><dd>{frame.action}</dd></div><div><dt>DOPO</dt><dd>{frame.after}</dd></div></dl><Points points={frame.points}/></div></WithSource>
    <div className="frame-controls"><button className="subtle" disabled={!index} onClick={() => setFrame(index - 1)}><ArrowLeft size={16}/>Fotogramma precedente</button><span className="micro">AVANZI TU</span><button className="subtle" disabled={index === block.frames.length - 1} onClick={() => setFrame(index + 1)}>Fotogramma successivo<ArrowRight size={16}/></button></div>
    <p className="caveat"><TriangleAlert size={16} aria-hidden="true"/>{block.caveat}</p>
  </section>;
}

function ActivityView({ activity, lesson, state, onAttempt }: { activity: Activity; lesson: Lesson; state: LearnerState; onAttempt: (id: string, answer: string[]) => void }) {
  const attempts = state.attempts.filter(x => x.activityId === activity.id);
  const previous = attempts.at(-1);
  const [answer, setAnswer] = useState<string[]>(previous?.answer ?? (activity.type === 'order' ? activity.items.map(x => x.id) : []));
  const [submitted, setSubmitted] = useState(!!previous);
  const result = submitted && previous ? evaluate(activity, previous.answer) : undefined;
  const isSolved = solved(lesson, state, activity.id);
  const move = (index: number, delta: number) => {
    const copy = [...answer]; [copy[index], copy[index + delta]] = [copy[index + delta], copy[index]]; setAnswer(copy); setSubmitted(false);
  };
  return <section className="block activity-block" aria-label={activity.title}><div className="block-heading"><span className="section-label"><Icon name={activity.type === 'order' ? 'puzzle' : 'lightbulb'} size={18}/>{activity.type === 'order' ? 'RICOSTRUZIONE' : 'PREVISIONE'}</span><span className="micro">{isSolved ? 'RISOLTA' : 'TOCCA A TE'}</span></div><h2>{activity.title}</h2><p className="activity-prompt">{activity.prompt}</p>
    {activity.type === 'choice' ? <fieldset className="choices"><legend className="sr-only">Scegli una risposta</legend>{activity.options.map((option, i) => <label key={option.id} className={answer[0] === option.id ? 'selected' : ''}><input type="radio" name={activity.id} value={option.id} checked={answer[0] === option.id} onChange={() => { setAnswer([option.id]); setSubmitted(false); }}/><span className="option-letter">{String.fromCharCode(65 + i)}</span><span>{option.label}</span></label>)}</fieldset> : <ol className="order-list" aria-label="Ordine dei passaggi">{answer.map((id, i) => <li key={id}><span className="order-position">{i + 1}</span><span>{activity.items.find(x => x.id === id)!.label}</span><div className="order-buttons"><button className="icon-button" aria-label={`Sposta su: ${activity.items.find(x => x.id === id)!.label}`} disabled={!i} onClick={() => move(i, -1)}><ArrowUp size={16}/></button><button className="icon-button" aria-label={`Sposta giù: ${activity.items.find(x => x.id === id)!.label}`} disabled={i === answer.length - 1} onClick={() => move(i, 1)}><ArrowDown size={16}/></button></div></li>)}</ol>}
    <div className="activity-actions"><button className="primary" disabled={!answer.length} onClick={() => { onAttempt(activity.id, answer); setSubmitted(true); }}><Check size={16}/>Verifica il ragionamento</button><span className="micro">{attempts.length ? `${attempts.length} tentativ${attempts.length === 1 ? 'o' : 'i'} registrat${attempts.length === 1 ? 'o' : 'i'}` : 'PUOI RIPROVARE'}</span></div>
    {result && <div className={`feedback ${result.correct ? 'correct' : 'retry'}`} role="status"><Icon name={result.correct ? 'check' : 'lightbulb'} size={21}/><div><strong>{result.correct ? 'Il collegamento funziona.' : 'Rivedi questo passaggio.'}</strong><p>{result.feedback}</p></div></div>}
    {isSolved && !result && <p className="micro">Attività già risolta in un tentativo precedente.</p>}
    {attempts.length > 0 && <details className="source-disclosure"><summary><Link2 size={15}/>Controlla la fonte del feedback<ChevronDown size={15}/></summary><EvidenceView lesson={lesson} ids={activity.evidenceIds}/></details>}
  </section>;
}

export function LessonBlock({ block, lesson, state, change, onAttempt, sourcePinned, setSourcePinned }: SourceOptions & { block: Block; lesson: Lesson; state: LearnerState; change: ChangeState; onAttempt: (id: string, answer: string[]) => void }) {
  const [showReference, setShowReference] = useState(false);
  switch (block.type) {
    case 'map': return <MapBlock block={block} lesson={lesson} state={state} change={change} sourcePinned={sourcePinned} setSourcePinned={setSourcePinned}/>;
    case 'sequence': return <SequenceBlock block={block} lesson={lesson} state={state} change={change} sourcePinned={sourcePinned} setSourcePinned={setSourcePinned}/>;
    case 'lens': return <details className="lens"><summary><Search size={21} aria-hidden="true"/><span>Lente sul concetto<strong>{block.title}</strong></span><ChevronDown size={18} aria-hidden="true"/></summary><Points points={[
      { icon: 'lightbulb', text: `Cos’è → ${block.what}` }, { icon: 'target', text: `Perché qui → ${block.why}` }, { icon: 'route', text: `Come funziona → ${block.how}` }, { icon: 'warning', text: `Punto critico → ${block.risk}` },
    ]}/><details className="source-disclosure"><summary><Link2 size={15}/>Riferimenti della lente</summary><EvidenceView lesson={lesson} ids={block.evidenceIds}/></details></details>;
    case 'comparison': return <section className="block"><div className="block-heading"><span className="section-label"><Icon name="compare" size={18}/> CONFRONTA</span></div><h2>{block.title}</h2><div className="comparison-wrap"><table className="comparison"><thead><tr><th scope="col">Osserva</th><th scope="col">{block.leftTitle}</th><th scope="col">{block.rightTitle}</th></tr></thead><tbody>{block.rows.map(row => <tr key={row.label}><th scope="row">{row.label}</th><td>{row.left}</td><td>{row.right}</td></tr>)}</tbody></table></div><details className="source-disclosure"><summary><Link2 size={15}/>Collega il confronto alle fonti</summary><EvidenceView lesson={lesson} ids={block.evidenceIds}/></details></section>;
    case 'source': return <details className="block source-disclosure"><summary><Icon name="book"/><strong>{block.title}</strong><ChevronDown size={18}/></summary><EvidenceView lesson={lesson} ids={block.evidenceIds}/></details>;
    case 'activity': return <ActivityView activity={lesson.activities.find(x => x.id === block.activityId)!} lesson={lesson} state={state} onAttempt={onAttempt}/>;
    case 'reflection': return <section className="block reflection"><span className="section-label"><Icon name="lightbulb" size={18}/> TRASFERISCI L’IDEA</span><h2>Spiegalo con parole tue</h2><label htmlFor={block.id}>{block.prompt}</label><textarea id={block.id} maxLength={4000} rows={5} placeholder="Scrivi il collegamento che hai ricostruito…" value={state.reflections[block.id] ?? ''} onChange={e => change(s => ({ ...s, reflections: { ...s.reflections, [block.id]: e.target.value } }))}/><div className="reflection-actions"><button className="primary" onClick={() => setShowReference(!showReference)}><EyeIcon/>{showReference ? 'Nascondi il confronto' : 'Confronta con una traccia'}</button><span className="micro">RIFLESSIONE SALVATA · NON VALUTATA DALL’AI</span></div>{showReference && <div className="reference"><strong>Una traccia per confrontarti</strong><Points points={block.reference}/><p className="micro">Non è un voto. Confronta le relazioni che hai spiegato e quelle che mancano.</p><details className="source-disclosure"><summary><Link2 size={15}/>Ritorna al principio nella fonte</summary><EvidenceView lesson={lesson} ids={block.evidenceIds}/></details></div>}</section>;
  }
}
function EyeIcon() { return <Icon name="eye" size={17}/>; }
