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

/** A small but complete draft as a model would return it: line citations only, no quotes. */
export function draftFor(sourceId: string): LessonDraft {
  const ev = (id: string, startLine: number, endLine: number, highlights: number[]) => ({ id, sourceId, startLine, endLine, highlights });
  const pts = [{ icon: 'eye' as const, text: 'Segui il passaggio sulla fonte.' }];
  return {
    title: 'Il ciclo dell’acqua', subtitle: 'Dal mare alla pioggia e ritorno.', category: 'Scienze', icon: 'loop',
    evidence: [ev('all', 1, 7, [2, 3]), ev('heat', 2, 3, [2]), ev('rain', 4, 6, [5]), ev('limit', 7, 7, [7])],
    concepts: [
      { id: 'evaporation', title: 'Evaporazione', icon: 'flame', definition: 'Il calore trasforma l’acqua in vapore.', pageId: 'map-page', evidenceIds: ['heat'] },
      { id: 'condensation', title: 'Condensazione', icon: 'layers', definition: 'Il vapore raffreddato forma nuvole.', pageId: 'flow-page', evidenceIds: ['rain'] },
      { id: 'energy', title: 'Energia del sole', icon: 'gauge', definition: 'Senza calore il ciclo rallenta.', pageId: 'limits-page', evidenceIds: ['limit'] },
    ],
    pages: [
      { id: 'map-page', title: 'Gli attori del ciclo', eyebrow: 'Mappa', icon: 'route', intro: 'Quattro stati collegati.', checkpoint: 'predict', blocks: [
        { type: 'map', id: 'cycle-map', title: 'Il ciclo', nodes: [
          { id: 'sea', title: 'Mare', icon: 'database', tone: 'blue', summary: 'Riserva d’acqua', points: pts, evidenceIds: ['heat'] },
          { id: 'vapor', title: 'Vapore', icon: 'flame', tone: 'amber', summary: 'Sale', points: pts, evidenceIds: ['heat'] },
          { id: 'cloud', title: 'Nuvole', icon: 'layers', tone: 'purple', summary: 'Condensa', points: pts, evidenceIds: ['rain'] },
        ], edges: [{ from: 'sea', to: 'vapor', label: 'evapora in' }, { from: 'vapor', to: 'cloud', label: 'condensa in' }, { from: 'cloud', to: 'sea', label: 'torna come pioggia' }] },
        { type: 'activity', id: 'predict-block', activityId: 'predict' },
      ] },
      { id: 'flow-page', title: 'Passo dopo passo', eyebrow: 'Sequenza', icon: 'layers', intro: 'Segui una goccia.', checkpoint: null, blocks: [
        { type: 'sequence', id: 'cycle-steps', title: 'Una goccia', mapId: 'cycle-map', caveat: 'Modello semplificato.', frames: [
          { id: 'f1', title: 'Calore', icon: 'flame', activeNodeId: 'sea', before: 'Acqua liquida', action: 'Il sole scalda', after: 'Vapore', points: pts, evidenceIds: ['heat'] },
          { id: 'f2', title: 'Pioggia', icon: 'send', activeNodeId: 'cloud', before: 'Nuvole', action: 'Le gocce cadono', after: 'Fiumi', points: pts, evidenceIds: ['rain'] },
        ] },
        { type: 'activity', id: 'order-block', activityId: 'order-steps' },
      ] },
      { id: 'limits-page', title: 'Dove si rompe', eyebrow: 'Lente', icon: 'warning', intro: 'Che cosa serve al ciclo.', checkpoint: null, blocks: [
        { type: 'lens', id: 'energy-lens', title: 'Il motore', what: 'Il calore del sole.', why: 'Fa evaporare l’acqua.', how: 'Scalda la superficie.', risk: 'Senza calore il ciclo rallenta.', evidenceIds: ['limit'] },
        { type: 'source', id: 'whole-source', title: 'La fonte completa', evidenceIds: ['all'] },
      ] },
    ],
    activities: [
      { type: 'choice', id: 'predict', title: 'Previsione', prompt: 'Che cosa succede al vapore in quota?', options: [
        { id: 'condenses', label: 'Condensa in nuvole', feedback: 'Sì: si raffredda e condensa (riga 4).', correct: true },
        { id: 'heats', label: 'Si scalda ancora', feedback: 'In quota si raffredda: rileggi la riga 4.', correct: false },
      ], evidenceIds: ['rain'] },
      { type: 'order', id: 'order-steps', title: 'Ricostruisci', prompt: 'Metti in ordine.', steps: [{ id: 'evap', label: 'Evaporazione' }, { id: 'cond', label: 'Condensazione' }, { id: 'rain', label: 'Pioggia' }],
        success: 'Ordine corretto.', retry: 'Parti dal calore.', evidenceIds: ['all'] },
    ],
  };
}
