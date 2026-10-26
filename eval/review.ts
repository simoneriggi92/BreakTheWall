import type { Cite, Disassembly, Part } from '../src/core/disassembly';

const RUBRIC = 'Valutazione: ✅ corretto · ⚠️ impreciso · ❌ sbagliato · — non verificabile. Confronta ogni affermazione con le righe citate, non con quello che sai.';

/**
 * A blind claim-review sheet for one disassembly: every point of every top-level part, every sub-part sentence and every
 * run explanation, next to the lines it cites, with an empty verdict. The setup is named by its letter only, so the
 * reviewer does not know which model wrote it. The totals and ratings at the end are what the evaluation records.
 */
export function reviewTemplate(d: Disassembly, meta: { case: string; setup: string; run: string }): string {
  const title = (id: string) => d.sources.find(s => s.id === id)?.title ?? id;
  const cited = (cites: Cite[] = []) => cites.map(c => `${title(c.source)} L${c.from}–${c.to}`).join('; ') || '—';
  const rows: string[] = [];
  const claim = (where: string, text: string, cites?: Cite[]) => rows.push(`| ${where} | ${text.replace(/\|/g, '\\|').replace(/\n/g, ' ')} | ${cited(cites)} |  |`);
  const name = (id: string) => d.parts.find(p => p.id === id)?.name ?? id;
  d.parts.forEach((part, i) => {
    const at = `${i + 1}. ${part.name}`;
    part.points?.forEach(p => claim(`${at} · punto`, p.text, part.cites));
    if (part.metaphor) claim(`${at} · metafora`, `${part.metaphor.text} ⚠ ${part.metaphor.limit}`, part.cites);
    if (part.lens) claim(`${at} · lente`, `${part.lens.what} / ${part.lens.why} / ${part.lens.how} / ⚠ ${part.lens.critical}`, part.cites);
    if (part.critique) claim(`${at} · critica`, part.critique, part.cites);
    // Every deeper level too, so a part taken apart is reviewed like the rest.
    const deeper = (parts: Part[] | undefined, trail: string) => parts?.forEach(sub => {
      claim(`${trail} · ${sub.name}`, [sub.explain, sub.critique].filter(Boolean).join(' / '), sub.cites);
      deeper(sub.parts, `${trail} › ${sub.name}`);
    });
    deeper(part.parts, at);
  });
  d.joints.forEach(j => claim('giunto', `${name(j.from)} → ${j.label} (${j.type}) → ${name(j.to)}`, j.cites ?? d.parts.find(p => p.id === j.from)?.cites));
  d.runs.forEach((run, r) => {
    const at = `prova ${r + 1} · ${run.title}${run.inference ? ' · inferenza' : ''}`;
    if (run.type === 'scenario') run.steps.forEach((s, k) => {
      claim(`${at} · passo ${k + 1}`, `${s.action}: ${s.explain}`, s.cites);
      s.predict?.options.forEach(o => claim(`${at} · passo ${k + 1} · ${o.correct ? 'giusta' : 'sbagliata'}`, `${o.text} — perché: ${o.why}`, s.cites));
    });
    if (run.type === 'load') run.bricks.forEach(b => claim(`${at} · togli ${name(b.part)}${b.inference ? ' · inferenza' : ''}`, `${b.verdict}: ${b.explain}`, b.cites));
    if (run.type === 'case') run.options.forEach(o => claim(`${at} · ${o.correct ? 'giusta' : 'sbagliata'}`, `${o.text} — perché: ${o.why}`, run.cites));
  });
  return [`# Revisione alla cieca: ${d.title}`, '',
    `Caso \`${meta.case}\` · configurazione **${meta.setup}** · run \`${meta.run}\``, '', 'Revisore: ___ · data: ___', '', RUBRIC, '',
    '| Dove | Affermazione | Righe citate | Esito |', '|---|---|---|---|', ...rows, '',
    `Totale: ${rows.length} affermazioni · ✅ ___ · ⚠️ ___ · ❌ ___ · — ___`, '',
    'Lo useresti? (1 = no, 5 = sì, così com’è)', '', '- Esploso (pezzi e giunti): ___ / 5', '- Prove: ___ / 5', '',
    'Errori principali (uno per riga, con la riga della fonte che li smentisce):', '', '- ', ''].join('\n');
}
