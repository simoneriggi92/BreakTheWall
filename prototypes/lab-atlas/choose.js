// Which representation fits a disassembly: an object (a mechanism you can take apart) or an atlas (nested regions
// joined by relations). The choice reads only the disassembly: joint types, part kinds, and the structure of the cited
// lines. It is explained, and the learner can always switch: names, parts and citations stay the same in both views.
(function (root) {
  const FAMILY = { 'sends-to': 'mechanism', causes: 'mechanism', 'depends-on': 'mechanism', supports: 'argument', attacks: 'argument', limits: 'argument', 'leads-to': 'story', because: 'story' };
  const MECH_KINDS = new Set(['step', 'component', 'artifact']);
  function structured(D, p) {
    // a part is "technical" when its own lines hold a table or code: things a machine reads, not prose
    for (const c of p.cites || []) {
      const L = (D.sources.find(s => s.id === c.source)?.text || '').split('\n');
      for (let n = c.from; n <= c.to; n++) if (/^\s*(```|\|)/.test(L[n - 1] || '')) return true;
    }
    return false;
  }
  function choose(D) {
    const J = D.joints || [], P = D.parts || [];
    const fam = { mechanism: 0, argument: 0, story: 0 }; J.forEach(j => fam[FAMILY[j.type]]++);
    const nJ = Math.max(1, J.length), nP = Math.max(1, P.length), name = id => P.find(p => p.id === id)?.name || id;
    const kindMech = P.filter(p => MECH_KINDS.has(p.kind)).length / nP, tech = P.filter(p => structured(D, p)).length / nP;
    // the working core: parts that something flows into or out of (sends-to, causes). The rest only depend or are depended on.
    const core = P.filter(p => J.some(j => (j.type === 'sends-to' || j.type === 'causes') && (j.from === p.id || j.to === p.id))).map(p => p.id);
    const rest = P.map(p => p.id).filter(id => !core.includes(id));
    const logical = (fam.argument + fam.story) / nJ, flow = core.length / nP;
    // thresholds are a first guess, to be measured; they are not derived from data
    const view = logical >= 0.5 ? 'atlas' : flow >= 0.75 ? 'object' : flow >= 0.3 ? 'hybrid' : 'atlas';
    const pct = x => Math.round(x * 100) + '%';
    const why = [
      `${fam.mechanism} legami su ${J.length} sono di un meccanismo${fam.argument ? `, ${fam.argument} di un argomento (sostiene, attacca, limita)` : ''}${fam.story ? `, ${fam.story} di una storia` : ''}.`,
      core.length ? `${core.length} pezzi su ${P.length} stanno in un flusso (invia a, causa).` : 'Nessun pezzo sta in un flusso: niente invia a niente, niente ne causa un altro.',
      `${pct(kindMech)} dei pezzi sono passi, componenti o documenti; ${pct(tech)} citano tabelle o codice.`,
    ];
    const because = {
      object: 'Quasi ogni pezzo partecipa a un flusso: un oggetto smontabile lo rende visibile senza inventare legami.',
      atlas: logical >= 0.5 ? 'Le relazioni sono logiche o narrative: un oggetto fisico le renderebbe meccaniche, e una trave che cade direbbe più del testo. L’atlante mostra perimetri e relazioni senza dar loro una fisica.' : 'Nessun flusso da far vedere: un oggetto sarebbe una metafora senza meccanismo.',
      hybrid: `Un nucleo funziona (${core.map(name).join(', ')}); il resto lo inquadra (${rest.map(name).join(', ')}). L’oggetto per il nucleo, l’atlante intorno.`,
    }[view];
    return { view, signals: { fam, logical, flow, kindMech, tech }, core, rest, why, because };
  }
  root.chooseView = choose;
  if (typeof module !== 'undefined') module.exports = choose;
})(typeof window !== 'undefined' ? window : globalThis);
