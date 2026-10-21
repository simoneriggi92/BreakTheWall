import { hashText, type Lesson } from '../src/core/lesson';

export async function sample(): Promise<Lesson> {
  const text = 'Input\nCheck\nOutput';
  return {
    schemaVersion: 1, id: 'sample', revision: 'v1', kind: 'prepared', title: 'Sample', subtitle: 'Sample', category: 'Sample', icon: 'route',
    goal: { outcome: 'Follow a path', priorKnowledge: 'None' },
    sources: [{ id: 'source', revision: 'v1', origin: 'original-prepared', title: 'Original', text, sha256: await hashText(text) }],
    evidence: [{ id: 'all', sourceId: 'source', startLine: 1, endLine: 3, quote: text, highlights: [2] }],
    concepts: [{ id: 'input', title: 'Input', icon: 'inbox', definition: 'Starts here', pageId: 'one', evidenceIds: ['all'] }],
    pages: [{ id: 'one', title: 'One', eyebrow: 'Map', icon: 'route', intro: 'Follow', checkpoint: 'predict', blocks: [
      { type: 'map', id: 'map', title: 'Flow', nodes: ['input', 'output'].map(id => ({ id, title: id, icon: 'inbox', tone: 'green', summary: 'Step', points: [{ icon: 'eye', text: 'See' }], evidenceIds: ['all'] })), edges: [{ from: 'input', to: 'output', label: 'sends to' }] },
      { type: 'activity', id: 'question', activityId: 'predict' },
    ] }, { id: 'two', title: 'Two', eyebrow: 'Sequence', icon: 'loop', intro: 'Inspect', blocks: [
      { type: 'sequence', id: 'sequence', title: 'Frames', mapId: 'map', caveat: 'Illustration', frames: ['before', 'after'].map(id => ({ id, title: id, icon: 'eye', activeNodeId: 'input', before: 'Initial', action: 'Act', after: 'Result', points: [{ icon: 'check', text: 'Result' }], evidenceIds: ['all'] })) },
      { type: 'activity', id: 'sorting', activityId: 'sort' },
    ] }],
    activities: [{ type: 'choice', id: 'predict', title: 'Predict', prompt: 'What next?', options: [{ id: 'yes', label: 'Output', feedback: 'The input reaches the output.' }, { id: 'no', label: 'Nothing', feedback: 'Trace the arrow from input.' }], correctId: 'yes', evidenceIds: ['all'] },
      { type: 'order', id: 'sort', title: 'Sort', prompt: 'Order', items: [{ id: 'c', label: 'Output' }, { id: 'a', label: 'Input' }, { id: 'b', label: 'Check' }], solution: ['a', 'b', 'c'], success: 'Correct order', retry: 'Input comes before checking.', evidenceIds: ['all'] }],
  };
}
