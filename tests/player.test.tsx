import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { DesktopBridge, ProgressKey } from '../src/core/bridge';
import type { Activity, Block, Lesson } from '../src/core/lesson';
import type { LearnerState } from '../src/core/state';
import { loadPreparedLessons } from '../src/fixtures/lessons';
import { App } from '../src/renderer/App';

/** An in-memory desktop bridge: the same contract the Electron preload exposes. */
function memoryBridge() {
  const saved = new Map<string, LearnerState>();
  const key = (k: ProgressKey) => `${k.lessonId}:${k.revision}`;
  const bridge: DesktopBridge = {
    getRuntime: async () => ({ platform: 'test', mode: 'browser' }),
    loadProgress: async k => ({ state: saved.get(key(k)) ?? null }),
    saveProgress: async s => { saved.set(key(s), structuredClone(s)); },
  };
  return { bridge, saved, key };
}

const lessons = await loadPreparedLessons();
const blocksOf = (lesson: Lesson) => lesson.pages.flatMap(p => p.blocks);
const pageWith = (lesson: Lesson, type: Activity['type']) => lesson.pages.find(p => p.checkpoint && lesson.activities.find(a => a.id === p.checkpoint)?.type === type)!;
const activityOf = (lesson: Lesson, type: Activity['type']) => lesson.activities.find(a => a.id === pageWith(lesson, type).checkpoint)!;
const main = () => within(screen.getByRole('main'));
const literal = (text: string) => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const radio = (label: string) => main().getByRole('radio', { name: literal(label) });

async function open(lesson: Lesson, bridge = memoryBridge().bridge) {
  const user = userEvent.setup();
  render(<App bridge={bridge} prepared={lessons}/>);
  await user.click(screen.getByRole('button', { name: new RegExp(lesson.title) }));
  await screen.findByRole('heading', { level: 1, name: lesson.pages[0].title });
  return user;
}
async function goTo(user: ReturnType<typeof userEvent.setup>, lesson: Lesson, pageId: string) {
  const page = lesson.pages.find(p => p.id === pageId)!;
  await user.click(within(screen.getByRole('navigation', { name: 'Tappe della lezione' })).getByRole('button', { name: new RegExp(page.title) }));
  await screen.findByRole('heading', { level: 1, name: page.title });
}
const highlighted = (scope: HTMLElement) => Array.from(scope.querySelectorAll('.source-line.highlight .line-number'), x => Number(x.textContent));

describe.each(lessons.map(lesson => [lesson.title, lesson] as const))('player · %s', (_title, lesson) => {
  it('opens as a labelled prepared example and selects map nodes with their evidence', async () => {
    const user = await open(lesson);
    expect(screen.getAllByText('Esempio preparato').length).toBeGreaterThan(0);
    const map = blocksOf(lesson).find((b): b is Extract<Block, { type: 'map' }> => b.type === 'map')!;
    const last = map.nodes.at(-1)!;
    await user.click(main().getByRole('button', { name: new RegExp(last.title) }));
    expect(main().getByRole('button', { name: new RegExp(last.title) })).toHaveAttribute('aria-pressed', 'true');
    const ref = lesson.evidence.find(e => e.id === last.evidenceIds[0])!;
    expect(highlighted(document.querySelector('.map-detail')!)).toEqual(ref.highlights);
  });

  it('moves the highlighted evidence with every sequence frame', async () => {
    const user = await open(lesson);
    const sequence = blocksOf(lesson).find((b): b is Extract<Block, { type: 'sequence' }> => b.type === 'sequence')!;
    const page = lesson.pages.find(p => p.blocks.includes(sequence))!;
    await goTo(user, lesson, page.id);
    const tabs = within(main().getByLabelText('Fotogrammi')).getAllByRole('button');
    for (const [i, frame] of sequence.frames.entries()) {
      await user.click(tabs[i]);
      expect(tabs[i]).toHaveAttribute('aria-pressed', 'true');
      expect(main().getByRole('heading', { level: 3, name: frame.title })).toBeInTheDocument();
      const ref = lesson.evidence.find(e => e.id === frame.evidenceIds[0])!;
      expect(highlighted(document.querySelector('.frame-layout')!)).toEqual(ref.highlights);
    }
  });

  it('gives option-specific feedback and opens the guided gate only after a correct prediction', async () => {
    const user = await open(lesson);
    const page = pageWith(lesson, 'choice');
    const activity = activityOf(lesson, 'choice') as Extract<Activity, { type: 'choice' }>;
    await goTo(user, lesson, page.id);
    const next = () => main().getByRole('button', { name: /Prossima tappa/ });
    expect(next()).toBeDisabled();
    const wrong = activity.options.find(o => o.id !== activity.correctId)!;
    const right = activity.options.find(o => o.id === activity.correctId)!;
    await user.click(radio(wrong.label));
    await user.click(main().getByRole('button', { name: /Verifica il ragionamento/ }));
    expect(main().getByText(wrong.feedback)).toBeInTheDocument();
    expect(next()).toBeDisabled();
    expect(screen.getByRole('navigation', { name: 'Tappe della lezione' }).querySelectorAll('button:disabled').length).toBeGreaterThan(0);
    await user.click(radio(right.label));
    await user.click(main().getByRole('button', { name: /Verifica il ragionamento/ }));
    expect(main().getByText(right.feedback)).toBeInTheDocument();
    expect(next()).toBeEnabled();
  });

  it('is operable from the keyboard: select an answer with Space and verify with Enter', async () => {
    const user = await open(lesson);
    const page = pageWith(lesson, 'choice');
    const activity = activityOf(lesson, 'choice') as Extract<Activity, { type: 'choice' }>;
    await goTo(user, lesson, page.id);
    const right = activity.options.find(o => o.id === activity.correctId)!;
    radio(right.label).focus();
    await user.keyboard(' ');
    expect(radio(right.label)).toBeChecked();
    main().getByRole('button', { name: /Verifica il ragionamento/ }).focus();
    await user.keyboard('{Enter}');
    expect(main().getByText(right.feedback)).toBeInTheDocument();
  });

  it('reconstructs the order with the move buttons after naming the first wrong step', async () => {
    const user = await open(lesson);
    await user.click(screen.getByRole('button', { name: 'Esplora' }));
    const page = pageWith(lesson, 'order');
    const activity = activityOf(lesson, 'order') as Extract<Activity, { type: 'order' }>;
    await goTo(user, lesson, page.id);
    await user.click(main().getByRole('button', { name: /Verifica il ragionamento/ }));
    expect(main().getByText(literal(activity.retry))).toBeInTheDocument();
    for (const [target, id] of activity.solution.entries()) {
      const label = activity.items.find(x => x.id === id)!.label;
      const current = () => Array.from(document.querySelectorAll('.order-list li > span:nth-child(2)'), x => x.textContent).indexOf(label);
      while (current() > target) await user.click(main().getByRole('button', { name: `Sposta su: ${label}` }));
    }
    await user.click(main().getByRole('button', { name: /Verifica il ragionamento/ }));
    expect(main().getByText(activity.success)).toBeInTheDocument();
  });

  it('lets exploration mode reach every page and keeps guided mode locked', async () => {
    const user = await open(lesson);
    const nav = () => within(screen.getByRole('navigation', { name: 'Tappe della lezione' }));
    const lastPage = lesson.pages.at(-1)!;
    expect(nav().getByRole('button', { name: new RegExp(lastPage.title) })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Esplora' }));
    expect(nav().getByRole('button', { name: new RegExp(lastPage.title) })).toBeEnabled();
    await goTo(user, lesson, lastPage.id);
  });

  it('resumes page, attempts and notes from the bridge after closing the lesson', async () => {
    const memory = memoryBridge();
    const user = await open(lesson, memory.bridge);
    const page = pageWith(lesson, 'choice');
    const activity = activityOf(lesson, 'choice') as Extract<Activity, { type: 'choice' }>;
    await goTo(user, lesson, page.id);
    await user.click(radio(activity.options[0].label));
    await user.click(main().getByRole('button', { name: /Verifica il ragionamento/ }));
    await user.type(main().getByLabelText('Cosa vuoi ricordare di questa tappa?'), 'Rifare su carta');
    await waitFor(() => expect(memory.saved.get(memory.key({ lessonId: lesson.id, revision: lesson.revision }))?.notes[page.id]).toBe('Rifare su carta'));
    const stored = memory.saved.get(memory.key({ lessonId: lesson.id, revision: lesson.revision }))!;
    expect(stored.pageId).toBe(page.id);
    expect(stored.attempts).toHaveLength(1);
    document.body.innerHTML = '';
    render(<App bridge={memory.bridge} prepared={lessons}/>);
    await user.click(screen.getByRole('button', { name: new RegExp(lesson.title) }));
    await screen.findByRole('heading', { level: 1, name: page.title });
    expect(main().getByLabelText('Cosa vuoi ricordare di questa tappa?')).toHaveValue('Rifare su carta');
    expect(main().getByText(/1 tentativo registrato/)).toBeInTheDocument();
  });
});

describe('library', () => {
  it('lists both prepared lessons through the same renderer, with no account required', async () => {
    render(<App bridge={memoryBridge().bridge} prepared={lessons}/>);
    for (const lesson of lessons) expect(screen.getByRole('button', { name: new RegExp(lesson.title) })).toBeInTheDocument();
    expect(screen.getByText(/Non sono lezioni generate dall’AI/)).toBeInTheDocument();
    expect(screen.getByText(/funzionano senza account/)).toBeInTheDocument();
  });
});
