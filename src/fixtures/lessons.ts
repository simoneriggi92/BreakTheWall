import { hashText, validateLesson, type Block, type Evidence, type IconName, type Lesson, type Point, type Source } from '../core/lesson';

const p = (icon: IconName, text: string): Point => ({ icon, text });
const lens = (id: string, title: string, what: string, why: string, how: string, risk: string, evidenceIds: string[]): Block => ({ type: 'lens', id, title, what, why, how, risk, evidenceIds });
async function original(id: string, title: string, lines: string[], language?: string): Promise<Source> {
  const text = lines.join('\n');
  return { id, title, text, language, revision: 'v1', origin: 'original-prepared', sha256: await hashText(text) };
}
function span(source: Source, id: string, startLine: number, endLine: number, highlights: number[]): Evidence {
  return { id, sourceId: source.id, startLine, endLine, highlights, quote: source.text.split('\n').slice(startLine - 1, endLine).join('\n') };
}

async function requestLesson(): Promise<Lesson> {
  const source = await original('request-source', 'handle-request.ts · esempio originale', [
    'type Request = { title?: string };',
    'type Store = {',
    '  insert(input: { title: string }): Promise<{ id: string }>;',
    '};',
    '',
    'export async function handleRequest(request: Request, store: Store) {',
    '  const title = request.title?.trim();',
    '  if (!title) {',
    '    return { status: 400, error: "Title required" };',
    '  }',
    '  const note = await store.insert({ title });',
    '  return { status: 201, id: note.id };',
    '}',
  ], 'TypeScript');
  const notes = await original('request-notes', 'Confini del modello · note originali', [
    'Questo esempio didattico rappresenta una singola richiesta di creazione di una nota.',
    'La validazione del titolo precede la scrittura: un titolo assente o composto da spazi produce 400 e nessuna chiamata a insert.',
    'await sospende questa funzione fino al completamento di insert; non blocca di per sé il thread JavaScript.',
    'La risposta 201 viene costruita solo dopo che insert si è risolta con un identificativo.',
    'Se insert rifiuta la Promise, la funzione propaga il rifiuto: il livello HTTP esterno deve gestirlo. Qui non è implementato.',
    'Il contratto Store non garantisce transazioni, idempotenza o durabilità del database. Queste garanzie richiedono un’implementazione concreta.',
  ]);
  const evidence = [span(source, 'request-all', 1, 13, [6, 7]), span(source, 'request-input', 6, 12, [6, 7]), span(source, 'request-validate', 6, 12, [8, 9, 10]), span(source, 'request-store', 6, 12, [11]), span(source, 'request-response', 6, 12, [12]), span(notes, 'request-limits', 1, 6, [3, 5, 6])];
  return validateLesson({
    schemaVersion: 1, id: 'request-journey', revision: 'v1', kind: 'prepared', category: 'Codice e sistemi', icon: 'code',
    title: 'Il viaggio di una richiesta', subtitle: 'Dal titolo ricevuto alla risposta: scopri chi decide, chi scrive e dove il flusso può interrompersi.',
    goal: { outcome: 'Ricostruire il flusso di una richiesta e spiegare perché la risposta di successo arriva dopo la scrittura.', priorKnowledge: 'Variabili, funzioni e un primo incontro con TypeScript.' },
    sources: [source, notes], evidence,
    concepts: [
      { id: 'validation', title: 'Validazione', icon: 'shield', definition: 'Una condizione che decide se il dato può proseguire. Qui un titolo vuoto ferma il flusso prima della scrittura.', pageId: 'request-map', evidenceIds: ['request-validate'] },
      { id: 'await', title: 'await', icon: 'database', definition: 'La funzione riprende quando la Promise si completa. Se fallisce, il controllo non raggiunge la riga successiva in questo esempio.', pageId: 'request-sequence', evidenceIds: ['request-store', 'request-limits'] },
      { id: 'contract', title: 'Contratto e garanzia', icon: 'layers', definition: 'Il tipo Store descrive come chiamare insert. Non dimostra che il database salvi in modo durevole o impedisca i duplicati.', pageId: 'request-compare', evidenceIds: ['request-all', 'request-limits'] },
      { id: 'causal-order', title: 'Ordine causale', icon: 'route', definition: 'La risposta usa note.id: dipende dal risultato della scrittura, quindi non può precederla.', pageId: 'request-order', evidenceIds: ['request-response'] },
    ],
    pages: [
      { id: 'request-map', title: 'Guarda il percorso', eyebrow: '01 · La mappa', icon: 'route', intro: 'Una richiesta non “salva una nota” in un solo gesto. Attraversa quattro responsabilità. Selezionane una per collegarla al codice.', blocks: [
        { type: 'map', id: 'request-flow', title: 'Dal dato al risultato', nodes: [
          { id: 'receive', title: 'Ricevi', icon: 'inbox', tone: 'blue', summary: 'Arriva un titolo', points: [p('inbox', 'request contiene il titolo ricevuto.'), p('code', 'trim rimuove gli spazi iniziali e finali; il risultato può essere vuoto.')], evidenceIds: ['request-input'] },
          { id: 'validate', title: 'Valida', icon: 'shield', tone: 'purple', summary: 'Decidi se proseguire', points: [p('shield', 'Se title è assente o vuoto, il ramo termina con 400.'), p('database', 'Il controllo avviene prima di insert: nessuna scrittura per questo caso.')], evidenceIds: ['request-validate'] },
          { id: 'persist', title: 'Scrivi', icon: 'database', tone: 'amber', summary: 'Attendi un identificativo', points: [p('database', 'store.insert riceve solo il titolo già controllato.'), p('loop', 'await collega il seguito della funzione al completamento della Promise.')], evidenceIds: ['request-store'] },
          { id: 'respond', title: 'Rispondi', icon: 'send', tone: 'green', summary: 'Restituisci il risultato', points: [p('send', 'La risposta 201 contiene l’identificativo restituito dallo store.'), p('warning', 'Questa funzione restituisce un oggetto: il trasporto HTTP è un livello esterno.')], evidenceIds: ['request-response'] },
        ], edges: [{ from: 'receive', to: 'validate', label: 'fornisce il titolo a' }, { from: 'validate', to: 'persist', label: 'se valido, invia a' }, { from: 'persist', to: 'respond', label: 'restituisce l’id a' }] },
        lens('request-lens-validation', 'Una porta prima della scrittura', 'La validazione è un bivio: il dato passa oppure il flusso termina.', 'Scrivere prima di controllare potrebbe creare una nota inutilizzabile.', 'Il return nel ramo !title chiude questa invocazione. insert non viene raggiunta.', 'Un titolo non vuoto non è necessariamente un titolo accettabile per ogni prodotto: qui controlliamo solo la presenza.', ['request-validate']),
      ] },
      { id: 'request-sequence', title: 'Segui una richiesta', eyebrow: '02 · La sequenza', icon: 'layers', intro: 'Fai avanzare una richiesta valida. Ogni fotogramma sposta il punto di attenzione e le righe evidenziate.', checkpoint: 'request-prediction', blocks: [
        { type: 'sequence', id: 'request-frames', mapId: 'request-flow', title: 'Una richiesta, quattro momenti', caveat: 'Modello didattico di una singola invocazione. Non esegue una richiesta HTTP né un database.', frames: [
          { id: 'received', title: 'Il dato entra', icon: 'inbox', activeNodeId: 'receive', before: 'Titolo ricevuto: “  Prima nota  ”', action: 'Leggi request.title e applica trim()', after: 'title vale “Prima nota”', points: [p('eye', 'Il titolo pulito è una nuova variabile usata nei passi successivi.')], evidenceIds: ['request-input'] },
          { id: 'checked', title: 'Il dato passa', icon: 'shield', activeNodeId: 'validate', before: 'title non è vuoto', action: 'Valuta la condizione !title', after: 'Il ramo 400 viene saltato', points: [p('shield', 'Se il titolo fosse solo spazi, la funzione terminerebbe qui.')], evidenceIds: ['request-validate'] },
          { id: 'stored', title: 'La funzione attende', icon: 'database', activeNodeId: 'persist', before: 'La nota non ha ancora un id', action: 'Chiama insert e attende la Promise', after: 'Lo store restituisce note.id', points: [p('loop', 'Il seguito dipende dal completamento, senza implicare un blocco del thread.')], evidenceIds: ['request-store'] },
          { id: 'returned', title: 'Il risultato esce', icon: 'send', activeNodeId: 'respond', before: 'note.id è disponibile', action: 'Costruisci la risposta con status 201', after: 'Il chiamante riceve status e id', points: [p('send', 'La risposta usa il risultato del passo precedente.')], evidenceIds: ['request-response'] },
        ] },
        { type: 'activity', id: 'request-prediction-block', activityId: 'request-prediction' },
      ] },
      { id: 'request-compare', title: 'Trova il punto di rottura', eyebrow: '03 · Il confronto', icon: 'compare', intro: 'Una risposta negativa può nascere in punti diversi. Cambiano gli effetti già avvenuti e chi deve gestire l’errore.', blocks: [
        { type: 'comparison', id: 'request-outcomes', title: 'Titolo vuoto ≠ scrittura fallita', leftTitle: 'Titolo vuoto', rightTitle: 'insert rifiuta la Promise', rows: [
          { label: 'Dove si ferma', left: 'Nel controllo !title, prima di insert.', right: 'Durante l’attesa di insert.' },
          { label: 'Scrittura', left: 'insert non viene chiamata.', right: 'insert è stata chiamata; l’esito va gestito dal sistema concreto.' },
          { label: 'Risultato qui', left: 'Oggetto con status 400.', right: 'Rifiuto propagato. Nessun 201 costruito.' },
        ], evidenceIds: ['request-validate', 'request-store', 'request-limits'] },
        lens('request-lens-await', 'Il contratto non è la garanzia', 'Store è il confine tra questa funzione e chi salva i dati.', 'Separare le responsabilità rende visibile ciò che questo codice può davvero promettere.', 'Il tipo descrive input e risultato. L’implementazione decide transazioni, retry e durabilità.', 'Non dedurre “esattamente una volta” da await: qui non c’è alcuna chiave di idempotenza.', ['request-all', 'request-limits']),
      ] },
      { id: 'request-order', title: 'Ricostruisci il flusso', eyebrow: '04 · Tocca a te', icon: 'puzzle', intro: 'Nascondi mentalmente la mappa. Quale dipendenza obbliga un passaggio a venire prima del successivo?', checkpoint: 'request-sort', blocks: [{ type: 'activity', id: 'request-sort-block', activityId: 'request-sort' }] },
      { id: 'request-reflect', title: 'Portalo a un caso nuovo', eyebrow: '05 · Collega e rielabora', icon: 'lightbulb', intro: 'Hai visto il percorso e provato a ricostruirlo. Ora rendi esplicita la ragione dell’ordine.', blocks: [
        { type: 'reflection', id: 'request-transfer', prompt: 'Vuoi aggiungere l’invio di un’email di conferma. Dove lo metteresti e cosa succede se l’email fallisce dopo la scrittura?', reference: [p('route', 'L’email richiede una nota creata: viene dopo la scrittura riuscita.'), p('warning', 'Se l’email fallisce, la nota può esistere già. Un retry dell’intera richiesta rischia un duplicato.'), p('lightbulb', 'Una gestione separata dell’invio o un meccanismo di idempotenza richiedono nuovo codice: non sono presenti qui.')], evidenceIds: ['request-store', 'request-response', 'request-limits'] },
        { type: 'source', id: 'request-final-source', title: 'Rivedi il codice completo', evidenceIds: ['request-all'] },
      ] },
    ],
    activities: [
      { type: 'choice', id: 'request-prediction', title: 'Fermati e prevedi', prompt: 'Arriva un titolo composto solo da spazi. Quale effetto produce questa funzione?', correctId: 'reject-before-store', evidenceIds: ['request-validate'], options: [
        { id: 'save-empty', label: 'Salva una nota vuota e poi restituisce 400.', feedback: 'La scrittura è alla riga 11. Il return alla riga 9 termina prima la funzione: segui l’ordine delle righe.' },
        { id: 'reject-before-store', label: 'Restituisce 400 senza chiamare insert.', feedback: 'Esatto: trim produce una stringa vuota; !title è vero e il return precede insert. Nessuna scrittura in questo ramo.' },
        { id: 'success-anyway', label: 'Restituisce 201 perché il campo title esiste.', feedback: 'Il controllo usa il valore dopo trim, non la sola presenza del campo. Una stringa vuota attiva il ramo 400.' },
      ] },
      { type: 'order', id: 'request-sort', title: 'Rimetti in ordine', prompt: 'Per una richiesta valida, componi il percorso dall’ingresso al risultato. Usa le frecce per spostare i passaggi.', items: [{ id: 'reply', label: 'Restituisci status 201 e id' }, { id: 'clean', label: 'Leggi e pulisci il titolo' }, { id: 'write', label: 'Attendi il risultato di insert' }, { id: 'check-title', label: 'Controlla che title non sia vuoto' }], solution: ['clean', 'check-title', 'write', 'reply'], success: 'Ordine corretto. Il controllo protegge la scrittura; la risposta dipende dall’id restituito dallo store.', retry: 'Parti dal dato ricevuto. Il controllo precede la scrittura e la risposta richiede il suo risultato.', evidenceIds: ['request-all'] },
    ],
  });
}

async function thermostatLesson(): Promise<Lesson> {
  const source = await original('thermo-source', 'Un termostato ideale · modello originale', [
    'Un sistema a retroazione negativa misura un risultato e usa l’azione di controllo per ridurre lo scostamento da un obiettivo.',
    'Nel nostro termostato ideale l’obiettivo è una temperatura desiderata; il sensore misura la temperatura della stanza.',
    'Il regolatore confronta misura e obiettivo: se la stanza è più fredda dell’obiettivo, richiede riscaldamento.',
    'Il riscaldatore acceso trasferisce calore alla stanza. La temperatura non cambia istantaneamente.',
    'Il sensore misura di nuovo la stanza: questa nuova misura torna al regolatore e chiude il circuito.',
    'Quando la misura raggiunge l’obiettivo, il regolatore ideale spegne il riscaldamento.',
    'Negativa indica che la risposta tende a contrastare lo scostamento. Non significa che il risultato sia cattivo.',
    'Un timer esegue un programma in base al tempo: senza un sensore non può correggere direttamente uno scostamento di temperatura.',
    'Una finestra aperta disperde calore: è un disturbo che può aumentare lo scostamento nonostante il riscaldatore acceso.',
    'Il modello omette inerzia e isteresi. I sistemi reali usano soglie e ritardi per evitare commutazioni troppo frequenti; la potenza può non bastare a raggiungere l’obiettivo.',
  ]);
  return validateLesson({
    schemaVersion: 1, id: 'thermostat-loop', revision: 'v1', kind: 'prepared', category: 'Scienza e sistemi', icon: 'thermometer',
    title: 'Come un termostato corregge il freddo', subtitle: 'Misurare, confrontare, agire, misurare ancora: una piccola macchina per capire la retroazione negativa.',
    goal: { outcome: 'Spiegare come una misura chiude un circuito di controllo e prevedere l’effetto di un disturbo.', priorKnowledge: 'Nessuna formula richiesta.' },
    sources: [source], evidence: [span(source, 'thermo-all', 1, 10, [1, 5, 10]), span(source, 'thermo-sense', 1, 5, [2, 5]), span(source, 'thermo-compare', 2, 7, [3, 6]), span(source, 'thermo-heat', 2, 6, [4]), span(source, 'thermo-return', 2, 7, [5, 6]), span(source, 'thermo-limit', 7, 10, [8, 9, 10])],
    concepts: [
      { id: 'feedback', title: 'Retroazione negativa', icon: 'loop', definition: 'Il risultato torna al regolatore attraverso una misura. L’azione tende a ridurre lo scostamento dall’obiettivo.', pageId: 'thermo-map', evidenceIds: ['thermo-all'] },
      { id: 'error', title: 'Scostamento', icon: 'target', definition: 'La differenza fra la temperatura desiderata e quella misurata. È ciò a cui il regolatore reagisce.', pageId: 'thermo-sequence', evidenceIds: ['thermo-compare'] },
      { id: 'disturbance', title: 'Disturbo', icon: 'warning', definition: 'Un’influenza esterna, come una finestra aperta, che modifica la stanza anche mentre il controllo agisce.', pageId: 'thermo-compare-page', evidenceIds: ['thermo-limit'] },
      { id: 'hysteresis', title: 'Isteresi', icon: 'gauge', definition: 'Soglie diverse per accendere e spegnere evitano di commutare continuamente vicino all’obiettivo. Il modello qui la omette.', pageId: 'thermo-reflect', evidenceIds: ['thermo-limit'] },
    ],
    pages: [
      { id: 'thermo-map', title: 'Scopri il circuito', eyebrow: '01 · La mappa', icon: 'loop', intro: 'Il termostato non sa che “senti freddo”. Usa una misura e un obiettivo. La freccia di ritorno è ciò che trasforma una catena in un circuito.', blocks: [
        { type: 'map', id: 'thermo-flow', title: 'La misura torna al punto di partenza', nodes: [
          { id: 'sensor', title: 'Misura', icon: 'thermometer', tone: 'blue', summary: 'Osserva la stanza', points: [p('eye', 'Il sensore rileva la temperatura della stanza.'), p('loop', 'La misura torna al regolatore dopo ogni cambiamento.')], evidenceIds: ['thermo-sense'] },
          { id: 'controller', title: 'Confronta', icon: 'target', tone: 'purple', summary: 'Cerca lo scostamento', points: [p('target', 'Confronta la misura con la temperatura desiderata.'), p('gauge', 'Se la stanza è più fredda, richiede calore.')], evidenceIds: ['thermo-compare'] },
          { id: 'heater', title: 'Agisci', icon: 'flame', tone: 'amber', summary: 'Trasferisci calore', points: [p('flame', 'Il riscaldatore modifica la stanza, non la misura direttamente.'), p('warning', 'L’effetto richiede tempo; potenza e dispersioni contano.')], evidenceIds: ['thermo-heat', 'thermo-limit'] },
          { id: 'room', title: 'Osserva l’effetto', icon: 'gauge', tone: 'green', summary: 'La stanza cambia', points: [p('gauge', 'La nuova temperatura diventa la prossima misura.'), p('loop', 'Questo ritorno chiude il circuito di controllo.')], evidenceIds: ['thermo-return'] },
        ], edges: [{ from: 'sensor', to: 'controller', label: 'invia la misura a' }, { from: 'controller', to: 'heater', label: 'comanda' }, { from: 'heater', to: 'room', label: 'riscalda' }, { from: 'room', to: 'sensor', label: 'viene misurata da' }] },
        lens('thermo-feedback-lens', '“Negativa” descrive la direzione', 'La retroazione negativa usa il risultato per contrastare lo scostamento.', 'Senza misurare di nuovo, il regolatore non vede se la sua azione ha funzionato.', 'Più freddo dell’obiettivo → calore richiesto → scostamento che tende a ridursi.', 'Non significa stabilità garantita: ritardi, potenza e disturbi possono impedire la correzione.', ['thermo-all']),
      ] },
      { id: 'thermo-sequence', title: 'Fai un giro nel circuito', eyebrow: '02 · Prima, azione, dopo', icon: 'layers', intro: 'Fai avanzare il modello un momento alla volta. Osserva quando cambia la stanza e quando il regolatore se ne accorge.', checkpoint: 'thermo-prediction', blocks: [
        { type: 'sequence', id: 'thermo-frames', mapId: 'thermo-flow', title: 'Dal freddo alla nuova misura', caveat: 'Sequenza qualitativa illustrativa: non è una simulazione fisica. Omette tempi, inerzia e isteresi.', frames: [
          { id: 'sense-cold', title: 'La misura segnala freddo', icon: 'thermometer', activeNodeId: 'sensor', before: 'Stanza più fredda dell’obiettivo', action: 'Il sensore misura la stanza', after: 'Il regolatore riceve una misura bassa', points: [p('eye', 'Misurare non riscalda: fornisce l’informazione per decidere.')], evidenceIds: ['thermo-sense'] },
          { id: 'decide-heat', title: 'Il confronto produce un comando', icon: 'target', activeNodeId: 'controller', before: 'Misura inferiore all’obiettivo', action: 'Il regolatore confronta i due valori', after: 'Riscaldamento richiesto', points: [p('target', 'L’obiettivo resta uguale; è la misura a essere diversa.')], evidenceIds: ['thermo-compare'] },
          { id: 'add-heat', title: 'L’azione modifica la stanza', icon: 'flame', activeNodeId: 'heater', before: 'Riscaldatore acceso', action: 'Il calore viene trasferito alla stanza', after: 'La temperatura può aumentare nel tempo', points: [p('flame', 'La velocità dipende dal sistema reale, non da questo fotogramma.')], evidenceIds: ['thermo-heat'] },
          { id: 'sense-again', title: 'L’effetto ritorna', icon: 'loop', activeNodeId: 'room', before: 'La temperatura è cambiata', action: 'Il sensore invia una nuova misura', after: 'All’obiettivo, il modello spegne il calore', points: [p('loop', 'La nuova misura permette una nuova decisione: il circuito continua.')], evidenceIds: ['thermo-return'] },
        ] },
        { type: 'activity', id: 'thermo-prediction-block', activityId: 'thermo-prediction' },
      ] },
      { id: 'thermo-compare-page', title: 'Controllo o programma?', eyebrow: '03 · Cambia una condizione', icon: 'compare', intro: 'Apri una finestra mentre il riscaldamento è acceso. Il disturbo rende visibile la differenza tra un circuito e un programma a tempo.', blocks: [
        { type: 'comparison', id: 'thermo-comparison', title: 'Stesso riscaldatore, informazioni diverse', leftTitle: 'Termostato con sensore', rightTitle: 'Timer senza sensore', rows: [
          { label: 'Informazione', left: 'Riceve la temperatura misurata.', right: 'Conosce il tempo o il programma.' },
          { label: 'Finestra aperta', left: 'Può rilevare un nuovo scostamento.', right: 'Non rileva direttamente il raffreddamento.' },
          { label: 'Decisione', left: 'Dipende dal confronto con l’obiettivo.', right: 'Dipende dall’orario impostato.' },
          { label: 'Limite', left: 'Non può creare più calore della potenza disponibile.', right: 'Può scaldare anche quando non serve.' },
        ], evidenceIds: ['thermo-limit', 'thermo-compare'] },
        lens('thermo-disturbance-lens', 'Il comando non è il risultato', 'Un disturbo modifica il sistema indipendentemente dal comando.', '“Acceso” non significa “obiettivo raggiunto”: il calore può disperdersi.', 'La finestra disperde calore; il sensore vede l’effetto e il regolatore confronta di nuovo.', 'Se le dispersioni superano la potenza disponibile, il termostato non può colmare lo scostamento.', ['thermo-limit']),
      ] },
      { id: 'thermo-order', title: 'Chiudi tu il circuito', eyebrow: '04 · Tocca a te', icon: 'puzzle', intro: 'Parti dalla misura iniziale. Ricostruisci un giro e controlla che l’effetto torni a influenzare la decisione.', checkpoint: 'thermo-sort', blocks: [{ type: 'activity', id: 'thermo-sort-block', activityId: 'thermo-sort' }] },
      { id: 'thermo-reflect', title: 'Riconosci lo stesso principio', eyebrow: '05 · Collega e rielabora', icon: 'lightbulb', intro: 'Il circuito non appartiene soltanto ai termostati. Prova a riconoscere misura, obiettivo, azione e ritorno in un altro sistema.', blocks: [
        { type: 'reflection', id: 'thermo-transfer', prompt: 'Un serbatoio usa un sensore di livello per comandare una pompa. Quali elementi corrispondono al sensore, all’obiettivo e al riscaldatore? Cosa cambia se c’è una perdita?', reference: [p('eye', 'Il sensore misura il livello; l’obiettivo è il livello desiderato; la pompa modifica il livello.'), p('loop', 'Il nuovo livello torna al regolatore attraverso la misura.'), p('warning', 'La perdita è un disturbo: se supera la portata della pompa, l’obiettivo resta irraggiungibile.')], evidenceIds: ['thermo-all'] },
        { type: 'source', id: 'thermo-final-source', title: 'Rivedi il modello e i suoi limiti', evidenceIds: ['thermo-all'] },
      ] },
    ],
    activities: [
      { type: 'choice', id: 'thermo-prediction', title: 'Fermati e prevedi', prompt: 'La finestra resta aperta e la stanza non raggiunge l’obiettivo. Il riscaldatore è acceso. Quale conclusione è giustificata?', correctId: 'losses', evidenceIds: ['thermo-limit'], options: [
        { id: 'broken-sensor', label: 'Il sensore è sicuramente guasto.', feedback: 'Non basta questa osservazione per diagnosticare un guasto. La dispersione può compensare o superare il calore fornito.' },
        { id: 'losses', label: 'Le dispersioni possono impedire di raggiungere l’obiettivo.', feedback: 'Esatto: il controllo decide un’azione, ma non elimina i limiti fisici. Un disturbo può superare la potenza disponibile.' },
        { id: 'negative-bad', label: 'La retroazione è negativa, quindi raffredda la stanza.', feedback: 'Negativa descrive la tendenza a contrastare lo scostamento. Se la stanza è fredda, l’azione prevista è richiedere calore.' },
      ] },
      { type: 'order', id: 'thermo-sort', title: 'Rimetti in ordine', prompt: 'Ordina un giro a partire dal sensore. L’ultimo passaggio deve riportare informazione al regolatore.', items: [{ id: 'act', label: 'Trasferisci calore alla stanza' }, { id: 'return-measure', label: 'Misura di nuovo l’effetto' }, { id: 'measure', label: 'Misura la temperatura iniziale' }, { id: 'compare', label: 'Confronta e richiedi calore' }], solution: ['measure', 'compare', 'act', 'return-measure'], success: 'Circuito ricostruito. La seconda misura chiude l’anello: la decisione successiva usa l’effetto dell’azione precedente.', retry: 'Il regolatore decide usando una misura. Dopo l’azione serve una nuova misura per chiudere il circuito.', evidenceIds: ['thermo-sense', 'thermo-return'] },
    ],
  });
}

let cache: Promise<Lesson[]> | undefined;
export function loadPreparedLessons(): Promise<Lesson[]> {
  return cache ??= Promise.all([requestLesson(), thermostatLesson()]);
}
