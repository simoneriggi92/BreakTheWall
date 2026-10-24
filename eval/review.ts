import { sourceExcerpt, type Lesson } from '../src/core/lesson';

const RUBRIC = 'Valutazione: ✅ corretto · ⚠️ impreciso · ❌ sbagliato · — non verificabile. Confronta ogni affermazione con le righe citate, non con quello che sai.';

/**
 * A claim-review sheet for one lesson: every statement the learner will read, next to the lines it cites,
 * with an empty verdict to fill in. The totals at the end are what the evaluation records.
 */
export function reviewTemplate(lesson: Lesson, meta: { case: string; model: string; run: string }): string {
  const cited = (ids: string[]) => ids.map(id => { const { source, ref } = sourceExcerpt(lesson, id); return `${source.title} L${ref.startLine}–${ref.endLine}`; }).join('; ');
  const rows: string[] = [];
  const claim = (where: string, text: string, ids: string[]) => rows.push(`| ${where} | ${text.replace(/\|/g, '\\|').replace(/\n/g, ' ')} | ${cited(ids)} |  |`);
  lesson.pages.forEach((page, pi) => {
    const at = `T${pi + 1}`;
    for (const block of page.blocks) {
      if (block.type === 'map') {
        block.nodes.forEach(n => claim(`${at} mappa · ${n.title}`, [n.summary, ...n.points.map(p => p.text)].join(' / '), n.evidenceIds));
        block.edges.forEach(e => claim(`${at} mappa · relazione`, `${block.nodes.find(n => n.id === e.from)?.title} → ${e.label} → ${block.nodes.find(n => n.id === e.to)?.title}`, block.nodes.find(n => n.id === e.from)?.evidenceIds ?? []));
      } else if (block.type === 'sequence') block.frames.forEach((f, fi) => claim(`${at} sequenza · ${fi + 1}`, `${f.before} → ${f.action} → ${f.after}. ${f.points.map(p => p.text).join(' / ')}`, f.evidenceIds));
      else if (block.type === 'comparison') block.rows.forEach(r => claim(`${at} confronto · ${r.label}`, `${block.leftTitle}: ${r.left} · ${block.rightTitle}: ${r.right}`, block.evidenceIds));
      else if (block.type === 'lens') claim(`${at} lente · ${block.title}`, `${block.what} / ${block.why} / ${block.how} / ⚠ ${block.risk}`, block.evidenceIds);
      else if (block.type === 'reflection') claim(`${at} riflessione`, block.reference.map(p => p.text).join(' / '), block.evidenceIds);
      else if (block.type === 'activity') {
        const activity = lesson.activities.find(a => a.id === block.activityId)!;
        if (activity.type === 'choice') activity.options.forEach(o => claim(`${at} scelta · ${o.id === activity.correctId ? 'giusta' : 'sbagliata'}`, `${o.label} — feedback: ${o.feedback}`, activity.evidenceIds));
        else claim(`${at} ordine`, activity.solution.map(id => activity.items.find(i => i.id === id)!.label).join(' → '), activity.evidenceIds);
      }
    }
  });
  return [`# Revisione delle affermazioni: ${lesson.title}`, '',
    `Caso \`${meta.case}\` · modello \`${meta.model}\` · run \`${meta.run}\``, '', `Revisore: ___ · data: ___`, '', RUBRIC, '',
    '| Dove | Affermazione | Righe citate | Esito |', '|---|---|---|---|', ...rows, '',
    `Totale: ${rows.length} affermazioni · ✅ ___ · ⚠️ ___ · ❌ ___ · — ___`, '',
    'Errori principali (uno per riga, con la riga della fonte che li smentisce):', '', '- ', ''].join('\n');
}
