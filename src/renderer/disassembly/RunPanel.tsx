import { useEffect, useRef } from 'react';
import { Check, Play, RotateCcw, TriangleAlert, X } from 'lucide-react';
import type { Cite, Disassembly, Run } from '../../core/disassembly';
import { scenarioView, type DisassemblyState } from '../../core/disassembly-state';
import { usePreferences } from '../preferences';
import { Cites } from './PartCard';

type Scenario = Extract<Run, { type: 'scenario' }>;
type Load = Extract<Run, { type: 'load' }>;
type Case = Extract<Run, { type: 'case' }>;
export interface RunActions {
  choose: (runId: string) => void; predict: (step: number, option: number) => void; execute: () => void; restart: () => void;
  remove: (part: string) => void; answer: (option: number) => void; focus: (c: Cite) => void;
}

/** One run at a time: its controls sit next to the drawing, and feedback stays apart from the controls. */
export function RunPanel({ d, run, state, focus, running = false, actions }: { d: Disassembly; run: Run; state: DisassemblyState; focus?: Cite; running?: boolean; actions: RunActions }) {
  const { t } = usePreferences();
  const host = useRef<HTMLElement>(null);
  const progress = state.runs[run.id];
  // Reset only after an outcome, never while the learner is choosing a prediction.
  const outcome = `${run.id}:${progress?.step}:${progress?.tried.at(-1)}:${run.type === 'case' ? progress?.choices[0] : ''}`;
  useEffect(() => { const reading = host.current?.querySelector<HTMLElement>('.run-reading'); if (reading) reading.scrollTop = 0; }, [outcome]);
  return <section ref={host} className="run-panel" aria-labelledby="run-title">
    {d.runs.length > 1 && <div className="run-tabs" role="group" aria-label={t.d.run.choose}>{d.runs.map(r => <button key={r.id} aria-pressed={r.id === run.id} onClick={() => actions.choose(r.id)}>
      <span className="micro">{t.d.run[r.type]}</span><span lang={d.language}>{r.title}</span></button>)}</div>}
    <span className="eyebrow">{t.d.run[run.type]}</span>
    <h2 id="run-title" lang={d.language}>{run.title}</h2>
    {run.type === 'scenario' && <ScenarioRun d={d} run={run} state={state} focus={focus} running={running} actions={actions}/>}
    {run.type === 'load' && <LoadRun d={d} run={run} state={state} focus={focus} actions={actions}/>}
    {run.type === 'case' && <CaseRun d={d} run={run} state={state} focus={focus} actions={actions}/>}
  </section>;
}

function ScenarioRun({ d, run, state, focus, running, actions }: { d: Disassembly; run: Scenario; state: DisassemblyState; focus?: Cite; running: boolean; actions: RunActions }) {
  const { t } = usePreferences();
  const progress = state.runs[run.id];
  const { vars, changed, last } = scenarioView(run, progress);
  const nextIndex = (progress?.step ?? -1) + 1;
  const next = run.steps[nextIndex];
  const choice = progress?.choices[nextIndex];
  const lastChoice = progress && last ? progress.choices[progress.step] : undefined;
  return <>
    <div className="run-reading">
      <p className="run-setup" lang={d.language}><span className="box-label">{t.d.run.setup}</span>{run.setup}</p>
      {Object.keys(vars).length > 0 && <table className="instruments"><caption className="box-label">{t.d.run.instruments}</caption><tbody>{Object.entries(vars).map(([k, v]) => <tr key={k} className={changed.has(k) ? 'changed' : undefined}>
        <th scope="row">{k}</th><td>{v}{changed.has(k) && <span className="sr-only"> · {t.d.run.changed}</span>}</td></tr>)}</tbody></table>}
      {last && <div className="run-feedback" aria-live="polite">
        <span className="box-label">{t.d.run.stepOf(progress!.step + 1, run.steps.length)}</span>
        <p className="run-action" lang={d.language}>{last.action}</p>
        {last.predict && lastChoice !== undefined && <PredictionResult option={last.predict.options[lastChoice]} language={d.language}/>}
        <p lang={d.language}>{last.explain}</p><Cites d={d} cites={last.cites ?? []} focus={focus} onFocus={actions.focus}/>
      </div>}
      {next ? <div className="run-controls">
        <span className="box-label">{t.d.run.stepOf(nextIndex + 1, run.steps.length)}</span>
        <p className="run-action" lang={d.language}>{next.action}</p>
        {next.predict && <fieldset className="predict"><legend>{t.d.run.predict}</legend><p lang={d.language}>{next.predict.question}</p>
          {next.predict.options.map((o, i) => <label key={i} className={choice === i ? 'selected' : undefined}><input type="radio" name={`${run.id}-${nextIndex}`} checked={choice === i} disabled={choice !== undefined} onChange={() => actions.predict(nextIndex, i)}/><span lang={d.language}>{o.text}</span></label>)}
        </fieldset>}
      </div> : <p className="run-done" role="status"><Check size={16}/>{t.d.run.done}</p>}
    </div>
    <div className="run-footer">
      {progress && <button className="text-button" onClick={actions.restart}><RotateCcw size={14}/>{t.d.run.restart}</button>}
      {next && (running ? <p className="run-running" role="status"><span className="running-dot" aria-hidden="true"/>{t.d.run.running}</p>
        : <button className="primary" disabled={!!next.predict && choice === undefined} onClick={actions.execute}><Play size={15}/>{nextIndex === 0 && !next.predict ? t.d.run.start : t.d.run.execute}</button>)}
    </div>
  </>;
}

function PredictionResult({ option, language }: { option: { correct: boolean; why: string }; language: string }) {
  const { t } = usePreferences();
  return <p className={`prediction ${option.correct ? 'right' : 'wrong'}`}>{option.correct ? <Check size={15}/> : <X size={15}/>}<strong>{option.correct ? t.d.run.right : t.d.run.wrong}</strong> <span lang={language}>{option.why}</span></p>;
}

function LoadRun({ d, run, state, focus, actions }: { d: Disassembly; run: Load; state: DisassemblyState; focus?: Cite; actions: RunActions }) {
  const { t } = usePreferences();
  const tried = state.runs[run.id]?.tried ?? [];
  const current = run.bricks.find(b => b.part === tried.at(-1));
  const name = (id: string) => d.parts.find(p => p.id === id)?.name ?? id;
  return <div className="run-reading">
    <p lang={d.language}>{run.question}</p>
    <p className="micro plain">{t.d.run.target(name(run.target))} · {t.d.run.removeHint}</p>
    {current && <div className={`run-feedback verdict-${current.verdict}`} aria-live="polite">
      <span className="box-label">{t.d.run.verdicts[current.verdict]}</span>
      <p lang={d.language}><strong>{t.d.run.verdictText[current.verdict](name(run.target))}</strong> {current.explain}</p>
      {current.inference && <p className="inference-note"><TriangleAlert size={14}/>{t.d.run.inference}</p>}
      <Cites d={d} cites={current.cites ?? []} focus={focus} onFocus={actions.focus}/>
    </div>}
    <div className="bricks" role="group" aria-label={t.d.run.bricks}>{run.bricks.map(b => <button key={b.part} className="subtle" aria-pressed={current?.part === b.part} onClick={() => actions.remove(b.part)}>
      <span lang={d.language}>{t.d.run.remove(name(b.part))}</span>{tried.includes(b.part) && <span className={`verdict-chip v-${b.verdict}`}>{t.d.run.verdicts[b.verdict]}</span>}</button>)}</div>
    {tried.length === run.bricks.length && <dl className="brick-summary">{(['falls', 'weakens', 'holds'] as const).map(v => {
      const names = run.bricks.filter(b => b.verdict === v).map(b => name(b.part));
      return names.length ? <div key={v}><dt>{t.d.run.summary[v]}</dt><dd lang={d.language}>{names.join(', ')}</dd></div> : null;
    })}</dl>}
  </div>;
}

function CaseRun({ d, run, state, focus, actions }: { d: Disassembly; run: Case; state: DisassemblyState; focus?: Cite; actions: RunActions }) {
  const { t } = usePreferences();
  const choice = state.runs[run.id]?.choices[0];
  return <div className="run-reading">
    <p className="inference-note"><TriangleAlert size={14}/>{t.d.run.constructed}</p>
    <p className="run-setup" lang={d.language}>{run.scenario}</p>
    <fieldset className="predict"><legend lang={d.language}>{run.question}</legend>
      {run.options.map((o, i) => <label key={i} className={choice === i ? 'selected' : undefined}><input type="radio" name={run.id} checked={choice === i} onChange={() => actions.answer(i)}/><span lang={d.language}>{o.text}</span></label>)}
    </fieldset>
    {choice !== undefined && <div className="run-feedback" aria-live="polite"><PredictionResult option={run.options[choice]} language={d.language}/>
      {run.inference && <p className="inference-note"><TriangleAlert size={14}/>{t.d.run.inference}</p>}
      <Cites d={d} cites={run.cites ?? []} focus={focus} onFocus={actions.focus}/></div>}
  </div>;
}
