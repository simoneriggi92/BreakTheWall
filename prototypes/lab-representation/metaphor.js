// The metaphor test: is there an object that represents a source's parts and documented joints without inventing a
// link, a cause or a dependency? For each metaphor in the library, every part needs a component that does what the
// part does, and every joint a physical connection that says no more than the source. Context, limits and
// clarifications need no component: they become annotations linked to the source. One failure, and the source is
// drawn as an atlas instead.
(function (root) {
  const C = (name, does, ends) => ({ name, does, ends });
  // ---- the bench: a mechanism's library. A part maps by its icon, which says what it does.
  const BENCH_PARTS = {
    repeat: C('giostra a stazioni', 'ripete un giro, una stazione per passo', 'una giostra gira senza fermarsi; un giro può bloccarsi a una stazione'),
    'rotate-ccw': C('relè con quadrante', 'legge un valore e oltre una soglia scatta', 'un relè scatta da solo; nel testo è una regola che qualcuno ha scritto'),
    play: C('pulsante di avvio', 'fa partire ciò che segue', 'un pulsante si preme una volta; qui l’avvio può ripetersi'),
    timer: C('registro con orologio', 'conserva un istante e ne mostra l’età', 'l’orologio non dice perché si è fermato'),
    flag: C('registro con orologio', 'conserva un istante e ne mostra l’età', 'l’orologio non dice perché si è fermato'),
    database: C('archivio a cassetti', 'conserva uno stato da consultare', 'un cassetto non si aggiorna da solo'),
    fingerprint: C('registro', 'conserva un segno che identifica', 'un registro non verifica ciò che conserva'), 'key-round': C('registro', 'conserva una chiave', 'un registro non verifica ciò che conserva'),
    lock: C('serratura', 'lascia passare uno solo alla volta', 'una serratura non sa chi aspetta'), 'clipboard-check': C('lista di controllo', 'segna ciò che è stato verificato', 'una lista non fa i controlli'),
    'file-text': C('stampante a nastro', 'scrive una riga per ogni evento', 'il nastro conserva tutto; nel testo le righe possono essere sostituite'),
    'list-checks': C('stampante a nastro', 'scrive una riga per ogni evento', 'il nastro conserva tutto; nel testo le righe possono essere sostituite'),
    'book-open': C('raccoglitore', 'conserva fogli da consultare', 'un raccoglitore non sceglie quale foglio vale'),
    settings: C('interruttore a chiave', 'apre o chiude un passaggio', 'un interruttore non dice chi l’ha girato'), plug: C('presa', 'collega un modulo a ciò che lo alimenta', 'una presa porta corrente; qui porta configurazione'),
    gauge: C('pannello di controllo', 'mostra lo stato con una luce per ogni segnale che riceve', 'una luce dice uno stato, non la sua causa'),
    send: C('nastro trasportatore', 'porta qualcosa da un punto a un altro', 'il nastro scorre sempre; un invio avviene in un momento'), download: C('nastro trasportatore', 'porta qualcosa da un punto a un altro', 'il nastro scorre sempre; un invio avviene in un momento'),
    rocket: C('rampa di lancio', 'mette in servizio ciò che riceve', 'un lancio non si annulla; un rilascio sì'), 'git-branch': C('scambio', 'smista su strade diverse', 'uno scambio sceglie una strada; nel testo possono valere entrambe'),
    filter: C('setaccio', 'lascia passare soltanto una parte', 'un setaccio non sa perché scarta'), search: C('lente', 'osserva senza toccare', 'una lente non registra ciò che vede'),
    scale: C('bilancia', 'confronta due pesi', 'una bilancia pesa; qui si confrontano criteri'), 'shield-check': C('comparatore', 'confronta e lascia passare o no', 'un comparatore non spiega il rifiuto'),
    cpu: C('macchina', 'trasforma ciò che riceve', 'una macchina è chiusa; qui le sue parti si possono aprire'), hammer: C('macchina', 'trasforma ciò che riceve', 'una macchina è chiusa; qui le sue parti si possono aprire'),
    code: C('macchina', 'trasforma ciò che riceve', 'una macchina è chiusa; qui le sue parti si possono aprire'), package: C('cassa', 'impacchetta ciò che riceve', 'una cassa si chiude una volta; un pacchetto si ricostruisce'),
    layers: C('pressa a strati', 'compone strati in un pezzo solo', 'gli strati non si separano più; nel testo sì'),
  };
  const BENCH_JOINTS = {
    'sends-to': { link: 'cavo', says: 'porta qualcosa da un modulo all’altro' },
    causes: { link: 'comando', says: 'mette in moto il modulo che raggiunge' },
    'depends-on': { link: 'cavo di lettura', says: 'il modulo legge l’altro prima di agire' },
  };
  // ---- the frame: an argument's library. A part maps by its kind.
  const FRAME_PARTS = {
    conclusion: C('trave', 'è retta da ciò che le sta sotto', 'una trave cade per gravità; una tesi perde le ragioni per accettarla'),
    premise: C('colonna', 'regge la trave da sola', 'una colonna regge da sola; una premessa solo se la si accetta'),
    ground: C('fondazione', 'regge tutto attraverso un perno', 'una fondazione non si discute; un fondamento sì'),
    consequence: C('piano sulla trave', 'poggia su ciò che lo regge', 'un piano poggia; una conseguenza può valere anche per altre vie'),
    objection: C('cuneo', 'preme sul bordo di ciò che attacca', 'il cuneo dice dove spinge, non se vince'),
    rejected: C('vassoio a lato', 'tiene un pezzo non montato', 'un vassoio mostra un’assenza voluta'),
  };
  const FRAME_JOINTS = {
    supports: { link: 'perno portante', says: 'regge il peso: senza il perno, ciò che sta sopra cade' },
    attacks: { link: 'cuneo che preme', says: 'spinge sul bordo' },
    limits: { link: 'morsetto', says: 'stringe ciò che limita' },
  };
  // context, limits and clarifications are annotations, not components
  const ANNOTATION_KINDS = new Set(['limit']);
  function test(D, which) {
    const bench = which === 'banco', P = D.parts || [], J = D.joints || [];
    const name = id => P.find(p => p.id === id)?.name || id, load = (D.runs || []).find(r => r.type === 'load');
    const parts = P.map(p => {
      if (ANNOTATION_KINDS.has(p.kind)) return { id: p.id, part: p.name, as: 'annotazione', ok: true, note: 'un limite o una precisazione: annotazione collegata alla fonte, non un componente' };
      const c = bench ? BENCH_PARTS[p.icon] : FRAME_PARTS[p.kind];
      return c ? { id: p.id, part: p.name, as: c.name, does: c.does, ends: c.ends, ok: true } : { id: p.id, part: p.name, ok: false, note: bench ? 'nessun componente del banco fa ciò che fa questo pezzo' : 'nessun elemento del telaio ha questo ruolo' };
    });
    const annotated = new Set(P.filter(p => ANNOTATION_KINDS.has(p.kind)).map(p => p.id));
    const joints = J.filter(j => !annotated.has(j.from) && !annotated.has(j.to)).map(j => {
      const row = { from: name(j.from), to: name(j.to), type: j.type, label: j.label };
      const k = (bench ? BENCH_JOINTS : FRAME_JOINTS)[j.type];
      if (!k) return { ...row, ok: false, note: `il ${bench ? 'banco' : 'telaio'} non ha una connessione per «${j.type}»` };
      // what the connection asserts beyond the joint, checked against the source's own load test
      if (!bench && j.type === 'supports') {
        const b = load?.target === j.to && load.bricks.find(x => x.part === j.from);
        if (!b) return { ...row, as: k.link, ok: false, invents: true, note: `il perno dice che senza «${name(j.from)}» «${name(j.to)}» cadrebbe; la fonte non lo dice` };
        if (b.verdict !== 'falls') return { ...row, as: k.link, ok: false, invents: true, note: `il perno dice che cadrebbe; la prova della fonte dice «${b.verdict === 'holds' ? 'regge' : 'si indebolisce'}»` };
        if (b.inference) return { ...row, as: k.link, ok: false, invents: true, note: 'il perno fa crollare la tesi; nella fonte il crollo è un’interpretazione, non un’affermazione' };
      }
      if (!bench && j.type === 'limits' && /estend|allarg|ampli/i.test(j.label)) return { ...row, as: k.link, ok: false, invents: true, note: `un morsetto può solo stringere; il legame dice «${j.label}»` };
      return { ...row, as: k.link, says: k.says, ok: true };
    });
    const fails = [...parts.filter(x => !x.ok), ...joints.filter(x => !x.ok)];
    return { metaphor: which, parts, joints, fails, fits: !fails.length };
  }
  function choose(D) {
    const tries = ['banco', 'telaio'].map(w => test(D, w));
    const best = tries.find(t => t.fits) || [...tries].sort((a, b) => a.fails.length - b.fails.length)[0];
    const view = best.fits ? 'object' : 'atlas';
    const because = best.fits
      ? `Il ${best.metaphor} regge: ogni pezzo ha un componente che fa ciò che il pezzo fa, e ogni legame una connessione che non dice più del testo.`
      // the test compares the metaphors in its library; it cannot rule out every possible object, and says so
      : `Tra le metafore disponibili, nessuna rappresenta questa fonte senza forzature. La più vicina, il ${best.metaphor}, ${best.fails.length === 1 ? 'si rompe in un punto' : `si rompe in ${best.fails.length} punti`}: per questo la fonte diventa un atlante, che mostra perimetri e relazioni senza attribuire loro una fisica.`;
    return { view, best, tries, because };
  }
  root.metaphorTest = choose;
})(typeof window !== 'undefined' ? window : globalThis);
