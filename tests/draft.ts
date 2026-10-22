import type { LessonDraft } from '../src/core/generation';
import { importSource, type UserSource } from '../src/core/source';

export const SOURCE_TEXT = [
  '# Ciclo dell’acqua',
  'Il sole scalda la superficie del mare.',
  'L’acqua evapora e sale come vapore.',
  'In quota il vapore si raffredda e condensa in nuvole.',
  'Quando le gocce sono abbastanza pesanti cadono come pioggia.',
  'La pioggia scorre nei fiumi e torna al mare.',
  'Senza calore l’evaporazione rallenta e il ciclo si indebolisce.',
].join('\n');

export const userSource = (): Promise<UserSource> => importSource({ kind: 'paste', title: 'Appunti sul ciclo dell’acqua', text: SOURCE_TEXT });

/** A small but complete draft as a model would return it: citations inline as line ranges, no quotes, no ids. */
export function draftFor(sourceId: string): LessonDraft {
  const cite = (from: number, to: number, highlights: number[]) => [{ source: sourceId, from, to, highlights }];
  const pts = [{ icon: 'eye' as const, text: 'Segui il passaggio sulla fonte.' }];
  return {
    title: 'Il ciclo dell’acqua', subtitle: 'Dal mare alla pioggia e ritorno.', category: 'Scienze', icon: 'loop',
    opening: {
      title: 'Gli attori del ciclo', eyebrow: 'Mappa', icon: 'route', intro: 'Quattro stati collegati.',
      map: { title: 'Il ciclo', nodes: [
        { key: 'sea', title: 'Mare', icon: 'database', tone: 'blue', summary: 'Riserva d’acqua', points: pts, cites: cite(2, 3, [2]) },
        { key: 'vapor', title: 'Vapore', icon: 'flame', tone: 'amber', summary: 'Sale', points: pts, cites: cite(2, 3, [2]) },
        { key: 'cloud', title: 'Nuvole', icon: 'layers', tone: 'purple', summary: 'Condensa', points: pts, cites: cite(4, 6, [5]) },
      ], edges: [{ from: 'sea', to: 'vapor', label: 'evapora in' }, { from: 'vapor', to: 'cloud', label: 'condensa in' }, { from: 'cloud', to: 'sea', label: 'torna come pioggia' }] },
      prediction: { title: 'Previsione', prompt: 'Che cosa succede al vapore in quota?', options: [
        { label: 'Condensa in nuvole', feedback: 'Sì: si raffredda e condensa (riga 4).', correct: true },
        { label: 'Si scalda ancora', feedback: 'In quota si raffredda: rileggi la riga 4.', correct: false },
      ], cites: cite(4, 6, [5]) },
    },
    pages: [
      { title: 'Passo dopo passo', eyebrow: 'Sequenza', icon: 'layers', intro: 'Segui una goccia.',
        main: { type: 'sequence', title: 'Una goccia', caveat: 'Modello semplificato.', frames: [
          { title: 'Calore', icon: 'flame', node: 'sea', before: 'Acqua liquida', action: 'Il sole scalda', after: 'Vapore', points: pts, cites: cite(2, 3, [2]) },
          { title: 'Pioggia', icon: 'send', node: 'cloud', before: 'Nuvole', action: 'Le gocce cadono', after: 'Fiumi', points: pts, cites: cite(4, 6, [5]) },
        ] }, excerpt: null, activity: null, reflection: null },
      { title: 'Dove si rompe', eyebrow: 'Lente', icon: 'warning', intro: 'Che cosa serve al ciclo.',
        main: { type: 'lens', title: 'Il motore', what: 'Il calore del sole.', why: 'Fa evaporare l’acqua.', how: 'Scalda la superficie.', risk: 'Senza calore il ciclo rallenta.', cites: cite(7, 7, [7]) },
        excerpt: { title: 'La fonte completa', cites: cite(1, 7, [2, 3]) }, activity: null, reflection: null },
    ],
    reconstruction: { title: 'Ricostruisci', prompt: 'Metti in ordine.', steps: [{ label: 'Evaporazione' }, { label: 'Condensazione' }, { label: 'Pioggia' }], success: 'Ordine corretto.', retry: 'Parti dal calore.', cites: cite(1, 7, [2, 3]) },
    concepts: [
      { title: 'Evaporazione', icon: 'flame', definition: 'Il calore trasforma l’acqua in vapore.', page: 1, cites: cite(2, 3, [2]) },
      { title: 'Condensazione', icon: 'layers', definition: 'Il vapore raffreddato forma nuvole.', page: 2, cites: cite(4, 6, [5]) },
      { title: 'Energia del sole', icon: 'gauge', definition: 'Senza calore il ciclo rallenta.', page: 3, cites: cite(7, 7, [7]) },
    ],
  };
}
