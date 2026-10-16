// Italian. Typed as `Messages` (en.tsx's shape): tsc fails on a missing key.
// Terms: traccia/tracce (the recorded traces), tracciamento (tracing), runtime (m.),
// impacchettare/spacchettare, applicare/rimuovere la patch, operazione (job), sorgente (source).

import { dotted, num, plural } from "../i18n";
import type { Messages } from "./en";

/** A flat image holds the game's files as they are: about as large as the game. */
const FLAT = "Pari alla dimensione del gioco";
const FILES = { one: "file", many: "file", other: "file" };
const CHECKS = { one: "controllo", many: "controlli", other: "controlli" };

const it: Messages = {
  // App.tsx
  app: {
    address: (url) => `Indirizzo: ${url}. Mostra come connettersi, con un codice QR`,
    screens: "Schermate",
    convert: "Converti",
    active: (n) => `, ${num(n)} ${plural(n, { one: "attiva", many: "attive", other: "attive" })}`,
    inspect: "Ispeziona",
    library: "Libreria",
    about: "Informazioni",
    offline: "Non in linea, nuovo tentativo…",
    stop: "Arresta Dump Forge",
    stillRunning: (n) =>
      n === 1
        ? "Un'operazione è ancora in corso"
        : `${num(n)} ${plural(n, { one: "operazione è ancora in corso", many: "operazioni sono ancora in corso", other: "operazioni sono ancora in corso" })}`,
    job: (id) => `Operazione ${id}`,
    quitNote: (web, n) =>
      web
        ? n === 1
          ? "Arrestando Dump Forge, l'operazione viene interrotta e l'output incompleto viene eliminato."
          : "Arrestando Dump Forge, le operazioni vengono interrotte e l'output incompleto viene eliminato."
        : n === 1
          ? "Uscendo, l'operazione viene interrotta e l'output incompleto viene eliminato."
          : "Uscendo, le operazioni vengono interrotte e l'output incompleto viene eliminato.",
    keepRunning: "Continua",
    stopAndQuit: (n) => (n === 1 ? "Interrompi ed esci" : "Interrompi tutto ed esci"),
    stoppingJobs: "Interruzione delle operazioni e pulizia…",
    stoppingForge: "Arresto di Dump Forge…",
    couldntStop: "Impossibile arrestare Dump Forge",
    close: "Chiudi",
    tryAgain: "Riprova",
    stopped: "Dump Forge è stato arrestato",
    startAgain: (ps5) => (ps5 ? "Per continuare, riapri il riquadro Dump Forge sulla PS5." : "Per continuare, esegui di nuovo lo stesso comando ps5-dump-forge serve."),
    confirmStop: (web: boolean) => (web ? "Arrestare Dump Forge?" : "Uscire da PS5 Dump Forge?"),
    stopNote: (web, ps5) => (!web ? "Nessuna attività in corso." : ps5 ? "Per riavviarlo, apri il riquadro Dump Forge sulla PS5." : "Per riavviarlo, esegui ancora lo stesso comando ps5-dump-forge serve."),
    quit: "Esci",
    github: (name) => `${name} su GitHub`,
    queued: "in coda",
    progress: (percent, left) => `${percent}% completato${left ? `, ${left} al termine` : ""}`,
  },
  // Convert.tsx
  convert: {
    target: "Destinazione",
    targetFormat: "Formato di destinazione",
    alreadyFolder: "la sorgente è già una cartella",
    lz4Backport:
      "Gli asset di questo gioco sono impacchettati con LZ4 e il suo manifest LZ4 elenca il backport: prima spacchettalo nella scheda LZ4, poi rimuovi qui il backport.",
    unreadable: "Impossibile creare: non è stato possibile leggere questa sorgente (vedi “Sorgente”).",
    noContentId: "Impossibile creare come fpkg: il param.json di questo gioco non ha un Content ID, che un pacchetto richiede.",
    blocked: (first, more) =>
      `Impossibile creare: ${first}${more > 0 ? ` (e ${num(more)} ${plural(more, { one: "altro", many: "altri", other: "altri" })}, vedi “Sorgente”)` : ""}.`,
    amprRuntime: (a, own, version) => {
      if (a === "install") return `Questo gioco usa AMPR ma non ha ampr_emu: la conversione installa l'ampr_emu ${version} incluso.`;
      if (a === "trace") return `La conversione sostituisce il runtime di tracciamento LZ4 con l'ampr_emu ${version} di rilascio incluso.`;
      if (a === "replace")
        return own
          ? `La conversione sostituisce l'ampr_emu ${own} di questo gioco con l'ampr_emu ${version} incluso.`
          : `La conversione sostituisce l'ampr_emu di questo gioco, che non indica alcuna versione, con l'ampr_emu ${version} incluso.`;
      return own
        ? `L'ampr_emu ${own} di questo gioco è uguale o più recente dell'ampr_emu ${version} incluso: la conversione lo mantiene.`
        : `Questo gioco ha già l'ampr_emu ${version} incluso: la conversione lo mantiene.`;
    },
    amprIndex: (state, traces) =>
      `${state === "stale" ? "ampr_emu.index non elenca i file di questo gioco" : state === "damaged" ? "ampr_emu.index non è leggibile" : "Questo gioco non ha ampr_emu.index"}: la conversione ne scrive uno nuovo${traces ? " e lascia fuori le vecchie tracce" : ""}.`,
    amprPkgIndex: (traces) =>
      `Il pacchetto riceve un nuovo ampr_emu.index creato dai suoi file${traces ? ", senza le vecchie tracce" : ""}.`,
    removeBackport: "Rimuovi backport",
    removeHint: (libs, emulators, other) =>
      `Esclude ${num(libs)} ${plural(libs, { one: "libreria", many: "librerie", other: "librerie" })} di backport da fakelib/` +
      (emulators.length === 0
        ? other
          ? "; le altre librerie homebrew restano."
          : "."
        : other
          ? `; ${plural(emulators.length, { one: "l'emulatore", many: "gli emulatori", other: "gli emulatori" })} (${emulators.join(", ")}) e le altre librerie homebrew restano.`
          : `; ${plural(emulators.length, { one: "l'emulatore", many: "gli emulatori", other: "gli emulatori" })} (${emulators.join(", ")}) ${plural(emulators.length, { one: "resta", many: "restano", other: "restano" })}.`),
    cantRemove: (why) => `Impossibile rimuovere il backport: ${why}`,
    compare: "Confronta formati",
    build: "Crea",
    likelyFail: (fmt) => (
      <>
        Probabilmente non riuscirà come <b>{fmt}</b>: non accetta i nomi di file elencati in “Sorgente”.
      </>
    ),
    collides: "Un'operazione sta già scrivendo questo file: una nuova creazione non riuscirebbe. Scegli un altro nome.",
    already: (fmt) => (
      <>
        Questo gioco è già in creazione come <b>{fmt}</b>; creandolo di nuovo ottieni una seconda copia.
      </>
    ),
  },
  // Formats.tsx
  formats: {
    rating: { good: "Buono", ok: "Compromesso", bad: "Svantaggio" },
    columns: ["Velocità su console", "Spazio su disco"],
    rows: {
      pkg: {
        tagline: "Il migliore, se il firmware lo consente",
        cells: ["Nativa, piena velocità", "Dal 30 al 60% in meno, a seconda del gioco"],
      },
      lz4: {
        tagline: "Sperimentale, per giochi che usano AMPR",
        cells: ["Caricamenti più rapidi del 30–40%, secondo gli autori", "Circa metà del gioco, secondo gli autori"],
      },
      ffpkg: { tagline: "Consigliato per ShadowMountPlus", cells: ["Piena velocità dell'immagine", FLAT] },
      exfat: { tagline: "Compatibilità", cells: ["Piena velocità dell'immagine", FLAT] },
      ffpfs: { tagline: "Sperimentale", cells: ["Piena velocità dell'immagine", FLAT] },
      ffpfsc: {
        tagline: "Il più piccolo, sperimentale",
        cells: ["150–250 MB/s, possibili scatti", "Dipende dal livello di compressione, di solito dal 30 al 60% in meno"],
      },
      folder: { tagline: "File del gioco così come sono", cells: ["Piena velocità dell'unità", FLAT] },
    },
    features: [
      ["Converti", "tra cartella, ffpkg, exfat, ffpfs, ffpfsc e fpkg, in entrambe le direzioni."],
      ["Ispeziona", "copertina, firmware, backport, DLC e problemi nei nomi di file di un gioco prima di crearlo."],
      ["Verifica", "ogni output dopo la scrittura: un campione rapido per impostazione predefinita, ogni byte su richiesta."],
      ["Elimina", "un gioco dal disco, dopo la tua conferma."],
      ["LZ4", "traccia un gioco AMPR, poi impacchettane gli asset (sperimentale)."],
      ["Runtime AMPR", "ogni conversione installa o aggiorna l'ampr_emu del gioco (uno uguale o più recente resta) e rinnova un ampr_emu.index non aggiornato."],
      ["Payload PS5", "la stessa app sulla console, da aprire con qualsiasi dispositivo della tua rete."],
    ],
    howToConnect: "Come connettersi",
    connectText: (url) => (
      <>Apri {url} in un browser su qualsiasi dispositivo della tua rete locale, oppure scansiona questo codice.</>
    ),
    close: "Chiudi",
    about: "Informazioni",
    aboutText: "Questo strumento converte un gioco da qualsiasi formato a qualsiasi altro, su qualsiasi piattaforma, PS5 inclusa.",
    connectAny: "Come connettersi da qualsiasi dispositivo",
    useAddress: (url) => <>Usa {url} oppure scansiona questo codice.</>,
    compare: "Confronta formati",
    compareLabel: "Confronto tra formati",
    format: "Formato",
    upstream: (app) =>
      `Dati degli autori: quanto riportano gli autori di ampr_emu e Lazy_AMPR, non misurato da ${app}; variano da gioco a gioco. ampr_emu 0.4.2.1 è una build di prova dei suoi autori; problema noto: alcuni giochi vanno in crash durante il salvataggio.`,
    bundled: "Le cartelle impacchettate con LZ4 funzionano con ampr_emu 0.4.2.1 di drakmor (GPL-3.0), incluso senza modifiche. Codice sorgente:",
    lazy: "Il flusso “prima traccia, poi impacchetta” segue Lazy_AMPR di Nazky:",
    unrar:
      "Gli archivi .rar vengono letti con la libreria UnRAR inclusa, di Alexander Roshal (solo estrazione, con la licenza UnRAR).",
    language: "Lingua",
    system: "Sistema",
  },
  // Inspect.tsx
  inspect: {
    files: "File",
    details: "Dettagli",
    deleting: "Eliminazione della sorgente…",
    delete: "Elimina la sorgente",
    deleted: "Eliminato",
    contents: "Contenuto della sorgente",
    filter: "Filtra per percorso",
    filterLabel: "Filtra i file per percorso",
    firstOf: (max, n) => plural(max, { one: `primo di ${num(n)}`, many: `primi ${num(max)} di ${num(n)}`, other: `primi ${num(max)} di ${num(n)}` }),
    fileCount: (n) => `${num(n)} ${plural(n, FILES)}`,
    noMatch: (f) => `Nessun file corrisponde a “${f}”.`,
    noListing: "L'elenco dei file dell'archivio non è supportato.",
    emptyDirs: (n) => `Cartelle vuote (${num(n)})`,
    noParam: "Nessun sce_sys/param.json.",
    reader: "Lettore",
    leftovers: "File e cartelle rimasti",
    found: (n) => `${num(n)} ${plural(n, { one: "trovato", many: "trovati", other: "trovati" })}`,
    leftoversNote: (app) =>
      `Output incompleti, di solito lasciati da operazioni interrotte. Rimuovi solo quelli che riconosci, e solo quando non ci sono operazioni in corso; ${app} non li elimina mai da solo.`,
    checked: (n) => `Cartelle controllate (${num(n)})`,
  },
  // JobList.tsx
  jobs: {
    jobs: "Operazioni",
    pending: (n) => `${num(n)} in corso o in coda`,
    allFinished: "tutte completate",
    stages: {
      scan: "Lettura della sorgente",
      preflight: "Controllo",
      check: "Controllo",
      plan: "Pianificazione",
      compress: "Compressione",
      write: "Scrittura",
      measure: "Misurazione dei pacchetti",
      pack: "Impacchettamento",
      verify: "Verifica",
      finalize: "Completamento",
    },
    steps: {
      scan: "Lettura",
      preflight: "Controllo",
      check: "Controllo",
      plan: "Pianificazione",
      compress: "Compressione",
      write: "Scrittura",
      measure: "Misurazione",
      pack: "Impacchettamento",
      verify: "Verifica",
      finalize: "Completamento",
    },
    stepsLabel: "Passaggi",
    stepDone: (s) => `Completato: ${s}`,
    stepLater: (s) => `Da fare: ${s}`,
    packingWriting: "Impacchettamento e scrittura",
    rate: { read: "lettura", compress: "compressione", pack: "impacchettamento", write: "scrittura" },
    showPath: "Mostra percorso",
    showFinder: "Mostra nel Finder",
    showExplorer: "Mostra in Esplora file",
    showFolder: "Mostra nella cartella",
    lz4: {
      pack: "LZ4: impacchetta",
      unpack: "LZ4: spacchetta",
      trace: "LZ4: tracciamento",
      unpatch: "LZ4: rimuovi patch",
      runtime: "Runtime AMPR",
    },
    job: (id) => `Operazione ${id}`,
    done: "Completata",
    cancelled: "Annullata",
    failed: "Non riuscita",
    cancelling: "Annullamento…",
    queued: "In coda",
    dismiss: "Ignora",
    stopJob: "Interrompere?",
    cancel: "Annulla",
    stopHint: "Fai di nuovo clic su “Interrompere?” entro 4 secondi per interromperla.",
    from: "da ",
    left: (d) => `${d} al termine`,
    inStep: (time) => `${time} in questo passaggio`,
    result: (bytes, n) => `${bytes}, ${num(n)} ${plural(n, FILES)} →`,
    outputPath: "Percorso di output",
    checks: "Controlli",
    verifiedPlain: (n) => `Verificato: ${num(n)} ${plural(n, { one: "controllo superato", many: "controlli superati", other: "controlli superati" })}`,
    verifiedFull: (n) => `Verifica completa superata: ${num(n)} ${plural(n, CHECKS)}`,
    verifiedFast: (n) => `Verifica rapida superata: ${num(n)} ${plural(n, CHECKS)}`,
    coverage: (checked, total, n) =>
      `Dati controllati: ${checked} su ${total} in ${num(n)} ${plural(n, { one: "campione", many: "campioni", other: "campioni" })}`,
    cantBuild: "Impossibile creare questo gioco:",
    cantBuildAs: (f) => (
      <>
        Impossibile creare questo gioco come <b>{f}</b>:
      </>
    ),
    log: (n) => `Log (${num(n)})`,
    logLabel: "Log",
  },
  // Library.tsx
  library: {
    pickTitle: "Scegli una cartella per la Libreria",
    scanningIn: (name) => `Scansione di ${name}`,
    scanning: "Scansione",
    cantScanFolder: "Impossibile scansionare questa cartella",
    chooseAnother: "Scegli un'altra cartella",
    pickPrompt: "Scegli la cartella della tua libreria da scansionare",
    choose: "Scegli cartella",
    cantScan: "Impossibile scansionare la Libreria:",
    cantDelete: "Impossibile eliminare:",
    deleted: (path) => `Eliminato ${path}`,
    truncated: "Limite di scansione raggiunto. L'elenco potrebbe essere incompleto.",
    limits: "La ricerca si ferma a sei livelli di cartelle e dopo circa 15 secondi di scansione.",
    noRoots: "Nessuna cartella disponibile da scansionare.",
    none: "Nessun gioco trovato. La ricerca scende fino a sei livelli di profondità e salta le cartelle di sistema. Puoi comunque scegliere altre sorgenti in “Ispeziona” o “Converti”.",
    skipped: "Posizioni e file saltati",
    stays: "I risultati restano qui finché non premi “Aggiorna”. I nuovi output compaiono dopo l'aggiornamento.",
    library: "Libreria",
    storageTip: "Spazio libero nella memoria interna della console (/data), all'ultima scansione",
    free: (free, total) => (
      <>
        Spazio libero: <b>{free}</b> su {total}
      </>
    ),
    refresh: "Aggiorna",
    cards: "Vista a schede",
    list: "Vista a elenco",
    games: "Giochi",
    inspect: (n) => `Ispeziona ${n}`,
    convert: (n) => `Converti ${n}`,
    remove: (n) => `Elimina ${n}`,
    lz4Tip: "Impacchettato con LZ4: pacchetti di asset ampr_emu",
    lz4Packed: " impacchettato",
  },
  // Lz4.tsx
  lz4: {
    title: "Pacchetti di asset LZ4",
    help: "Come funziona LZ4",
    scenario: "Scenario LZ4",
    scenarios: { trace: "Tracciamento", pack: "Impacchetta/Spacchetta" },
    actions: { patch: "Applica patch", unpatch: "Rimuovi patch", pack: "Impacchetta", unpack: "Spacchetta" },
    scenarioInfo: (s, packed) => s === "trace"
      ? "Registra quali asset legge il gioco mentre giochi, da usare con “Impacchetta”."
      : packed
        ? "Riscrive i pacchetti LZ4 del gioco come file normali."
        : "Raccoglie gli asset del gioco in volumi LZ4 che ampr_emu legge mentre il gioco è in esecuzione.",
    traceInfo: (a, image) => a === "patch"
      ? image
        ? "Ricrea questa immagine con il runtime di tracciamento, poi la sostituisce."
        : "Installa il runtime di tracciamento in questa cartella."
      : image
        ? "Ricrea questa immagine con il runtime di rilascio, poi la sostituisce."
        : "Rimette il runtime di rilascio in questa cartella.",
    noAmpr: "il gioco non usa AMPR",
    packedFirst: "la sorgente è impacchettata con LZ4: prima spacchettala",
    damaged: "i suoi pacchetti LZ4 sono danneggiati",
    archive: "un archivio non supporta il tracciamento: prima convertilo",
    chooseFirst: "scegli prima una sorgente",
    notRead: "la sorgente non è ancora stata letta",
    pickProfile: "Profilo LZ4",
    profileFilter: "Profilo LZ4 (TOML)",
    pickTracesFolder: "Tracce LZ4 (una cartella con ampr_commands.bin e ampr_emu.index)",
    pickTracesEither: "Tracce LZ4: lo zip, oppure una cartella con entrambi i file",
    pickTracesZip: "Tracce LZ4 (zip)",
    unreadable: "Impossibile avviare: non è stato possibile leggere questa sorgente (vedi “Sorgente”).",
    pending: (a) => a === "patch"
      ? "Impossibile applicare la patch con operazioni in corso o in coda."
      : "Impossibile rimuovere la patch con operazioni in corso o in coda.",
    replacing: "Un'operazione sta già ricreando questa immagine: attendi che termini.",
    blocked: (a, first, more) => {
      const rest = `${first}${more > 0 ? ` (e ${num(more)} ${plural(more, { one: "altro", many: "altri", other: "altri" })}, vedi “Sorgente”)` : ""}.`;
      if (a === "patch") return `Impossibile applicare la patch: ${rest}`;
      if (a === "unpatch") return `Impossibile rimuovere la patch: ${rest}`;
      if (a === "pack") return `Impossibile impacchettare: ${rest}`;
      return `Impossibile spacchettare: ${rest}`;
    },
    chooseGame: "Scegli prima una cartella o un'immagine di gioco.",
    noAmprGame: "Questo gioco non usa AMPR, quindi LZ4 non si può usare qui.",
    installsRuntime: (a, version) =>
      a === "pack"
        ? `Questo gioco non ha ampr_emu: Impacchetta installa l'ampr_emu ${version} incluso.`
        : a === "patch"
          ? `Questo gioco non ha ampr_emu: Applica patch installa il runtime di tracciamento incluso (ampr_emu ${version}).`
          : `Questo gioco non ha ampr_emu: Rimuovi patch installa il runtime di rilascio incluso (ampr_emu ${version}).`,
    freshIndex: (state, a) =>
      `${state === "stale" ? "ampr_emu.index non elenca i file di questo gioco" : state === "damaged" ? "ampr_emu.index non è leggibile" : "Questo gioco non ha ampr_emu.index"}: ${a === "pack" ? "Impacchetta" : a === "patch" ? "Applica patch" : "Rimuovi patch"} ne scrive uno nuovo.`,
    unavailable: (items) => `Non disponibile per questa sorgente: ${items.join("; ")}.`,
    readOnly: (kind) => <>
      <b>{kind}</b> è di sola lettura sulla console, quindi non supporta il tracciamento. Prima convertilo in <b>ffpkg</b> o <b>exfat</b>.
    </>,
    action: "Azione",
    traceAction: "Azione di tracciamento",
    changes: (a, image) => a === "patch"
      ? image
        ? "Modifica questa immagine: il runtime di tracciamento sostituisce fakelib/libSceAmpr.sprx, senza copia di backup."
        : "Modifica questa cartella: il runtime di tracciamento sostituisce fakelib/libSceAmpr.sprx, senza copia di backup."
      : image
        ? "Modifica questa immagine: torna il runtime di rilascio e le tracce vengono eliminate, senza copia di backup."
        : "Modifica questa cartella: torna il runtime di rilascio e le tracce vengono eliminate, senza copia di backup.",
    replay: (web) => web
      ? "Gioca, poi scegli di nuovo questa sorgente per usarne le tracce. “Tracciamento” le offre anche come zip."
      : "Gioca, poi scegli di nuovo questa sorgente per usarne le tracce.",
    room: "Spazio per la traccia",
    roomHint: "Spazio libero per la traccia del gioco. Monta l'immagine con image_rw=, altrimenti non viene registrato nulla.",
    alreadyRelease: "Ha già il runtime di rilascio: viene riscritto solo l'indice.",
    spaceHint: "Serve uno spazio libero pari circa alla dimensione dell'immagine; viene sostituita solo dopo che la copia ha superato la verifica.",
    deletesTraces: (a, bytes, web) => a === "patch"
      ? web
        ? `Applicare la patch elimina le tracce di questa sorgente (${bytes}): prima scaricale.`
        : `Applicare la patch elimina le tracce di questa sorgente (${bytes}): prima copiale.`
      : web
        ? `Rimuovere la patch elimina le tracce di questa sorgente (${bytes}): prima scaricale.`
        : `Rimuovere la patch elimina le tracce di questa sorgente (${bytes}): prima copiale.`,
    useProfile: "Usa invece un profilo di regole",
    profile: "Profilo",
    choose: "Scegli",
    profileHint: "Un file TOML di regole di impacchettamento, usato al posto delle tracce.",
    target: "Destinazione",
    packInto: "Impacchetta in",
    direct: "Impacchetta direttamente nell'immagine; i file del gioco vengono letti due volte.",
    targetFormat: "Formato di destinazione",
    unpackFolder: "Una nuova cartella di gioco con i pacchetti riscritti come file normali.",
    unpackHint: (n) =>
      n === null
        ? "Riscrive i file impacchettati come file normali."
        : `${plural(n, { one: `Riscrive ${num(n)} file impacchettato come file normale`, many: `Riscrive ${num(n)} file impacchettati come file normali`, other: `Riscrive ${num(n)} file impacchettati come file normali` })}.`,
    likelyFail: (fmt) => <>
      Probabilmente non riuscirà come <b>{fmt}</b>: non accetta i nomi di file elencati in “Sorgente”.
    </>,
    collides: (a, folder) => {
      const what = folder ? "questa cartella" : "questo file";
      return a === "pack"
        ? `Un'operazione sta già scrivendo ${what}: per impacchettare serve un altro nome.`
        : `Un'operazione sta già scrivendo ${what}: per spacchettare serve un altro nome.`;
    },
    already: (a, fmt) => a === "pack"
      ? <>Questo gioco è già in scrittura come <b>{fmt}</b>; impacchettandolo di nuovo ottieni una seconda copia.</>
      : <>Questo gioco è già in scrittura come <b>{fmt}</b>; spacchettandolo di nuovo ottieni una seconda copia.</>,
    profileRules: "Impacchetta ciò che indicano le regole del profilo; i file che il motore apre direttamente restano sciolti.",
    chosenRules: "Impacchetta i file che il gioco ha letto in queste tracce; i file che il motore apre direttamente restano sciolti.",
    ownRules: "Impacchetta i file che il gioco ha letto nell'ultima sessione tracciata; i file che il motore apre direttamente restano sciolti.",
    guessRules: "Nessuna traccia: impacchetta secondo una stima integrata, meno affidabile. Prima esegui il tracciamento, oppure scegli tracce o un profilo.",
    recorded: "Tracce registrate",
    recordedHint: (bytes) => `ampr_commands.bin (${bytes}): “Impacchetta” usa queste tracce.`,
    downloadHint: "Chiudi il gioco, attendi un minuto, poi scarica dal browser di un computer. Lì scegli lo zip in “Impacchetta/Spacchetta” → “Tracce”.",
    download: (bytes, zip) => `Scarica le tracce (${bytes}) come ${zip}`,
    missingIndex: "Nessun ampr_emu.index in questa sorgente: “Impacchetta” ne ha bisogno accanto ad ampr_commands.bin.",
    truncatedJournal: "Un registro troncato alla fine si impacchetta comunque, fino all'ultimo record completo.",
    fakelibWarning: (recorded) => recorded
      ? "Poche tracce o nessuna? Disattiva il programma di aggiornamento di fakelib, applica di nuovo la patch e rigioca."
      : "Disattiva il programma di aggiornamento di fakelib durante il tracciamento, altrimenti non viene registrato nulla.",
    emptyTitle: "Scegli un gioco che usa AMPR",
    experimental: "Sperimentale: conserva una copia del gioco originale.",
    chooseSource: "Scegli sorgente",
    source: "Sorgente",
    traces: "Tracce",
    optionalTraces: "Tracce (facoltative)",
    unlock: "Sblocca per scegliere altre tracce",
    loaded: "Tracce già caricate da questa sorgente",
    lockedHint: (bytes) => `Le tracce di questa sorgente (${bytes}). Fai clic sul lucchetto per sceglierne altre.`,
    clear: "Rimuovi",
    zip: "Zip",
    folder: "Cartella",
    tracesHint: "Scegli lo zip amprtrace di “Scarica le tracce”, oppure una cartella con entrambi i file di traccia.",
    useOwn: "Usa le tracce della sorgente",
    patchResult: (a, n) => a === "patch"
      ? `Patch applicata: il runtime di tracciamento è installato; l'indice elenca ${num(n)} ${plural(n, FILES)}.`
      : `Patch rimossa: il runtime di rilascio è tornato; l'indice elenca ${num(n)} ${plural(n, FILES)}.`,
    removed: (files) => `${plural(files.length, { one: "Rimosso il vecchio file di traccia", many: "Rimossi i vecchi file di traccia", other: "Rimossi i vecchi file di traccia" })}: ${files.join(", ")}.`,
  },
  // Lz4Help.tsx
  lz4Help: {
    title: "Come funziona LZ4",
    close: "Chiudi",
    warning: "Sperimentale, solo per giochi AMPR. Conserva una copia del gioco originale.",
    body: () => (
      <>
        <h3>1. Impacchetta/Spacchetta</h3>
        <ol>
          <li>
            Scegli il gioco originale, <b>Impacchetta/Spacchetta</b> e le tracce (o un profilo).
          </li>
          <li>
            Scrivi una cartella impacchettata o un'immagine semplice; una cartella si converte in qualsiasi formato in{" "}
            <b>Converti</b>.
          </li>
          <li>
            Una sorgente impacchettata mostra invece <b>Spacchetta</b>: i file sciolti tornano al loro posto.
          </li>
          <li>Impacchetta mantiene l'ampr_emu del gioco se è la versione inclusa o più recente e legge i pacchetti LZ4; altrimenti installa quello di rilascio incluso, anche al posto del runtime di tracciamento LZ4 e in un gioco che non ce l'ha.</li>
        </ol>

        <h3>2. Tracciamento</h3>
        <ol>
          <li>
            Scegli l'<b>ffpkg</b> o l'<b>exfat</b> del gioco, poi <b>Tracciamento</b> → <b>Applica patch</b>.
          </li>
          <li>Disattiva il programma di aggiornamento di fakelib: sovrascrive il runtime di tracciamento.</li>
          <li>
            Montalo con <span className="path">image_rw=</span>, gioca una sessione e chiudi il gioco.
          </li>
          <li>
            Usa <b>Scarica le tracce</b> nella pagina della PS5, oppure copia ampr_commands.bin e ampr_emu.index.
          </li>
        </ol>
      </>
    ),
  },
  // Picker.tsx
  picker: {
    drives: "Unità",
    location: "Posizione",
    parent: "Cartella superiore",
    allDrives: "Tutte le unità",
    truncated: (n) => plural(n, { one: "Viene mostrata solo la prima voce.", many: `Vengono mostrate solo le prime ${num(n)} voci.`, other: `Vengono mostrate solo le prime ${num(n)} voci.` }),
    loading: "Caricamento",
    noDrives: "Nessuna unità trovata.",
    noFolders: "Nessuna cartella qui.",
    noImages: "Nessuna cartella, immagine PS5 o archivio qui.",
    noFiles: (ext) => `Qui non ci sono cartelle né file ${dotted(ext, " o ")}.`,
    cancel: "Annulla",
    chooseFolder: "Scegli questa cartella",
  },
  // common.tsx
  common: {
    folder: "Cartella",
    pickFolder: "Cartella del gioco",
    pickImage: "Immagine o archivio del gioco",
    pickImageFilter: "Immagini e archivi",
    pickFolderButton: "Cartella",
    pickImageButton: "Immagine/Archivio",
    source: "Sorgente",
    emptyTitle: "Scegli una cartella, un'immagine o un archivio di gioco",
    emptyText:
      "Una cartella di gioco PS5 oppure un'immagine, un pacchetto o un archivio che la contiene.",
    accepted: "Sorgenti accettate",
    unknownTitle: "Titolo sconosciuto",
    reading: "Lettura della sorgente",
    unreadable: "Sorgente illeggibile",
    backport: "Backport",
    emulators: "Emulatori",
    declares: (fw) => `dichiara ${fw}`,
    fwUnknown: "firmware non ricavabile dagli eseguibili (nessun SDK leggibile)",
    emulatorList: (names) => `emulatori: ${names}`,
    otherEmulator: "Altro",
    sdk: (v) => `SDK ${v} (dichiarato)`,
    titleId: "ID titolo",
    version: "Versione",
    firmware: "Firmware",
    fwDeclared: "dichiarato",
    fwBackport: "backport",
    fwExecutables: "eseguibili",
    size: "Dimensione",
    files: (n) => `${num(n)} ${plural(n, FILES)}`,
    contentId: "ID contenuto",
    noAmpr: "eboot.bin non importa libSceAmpr",
    runtime: {
      forge_release: "Forge (versione di rilascio)",
      forge_trace: "Forge (versione di tracciamento)",
      other: "altro",
      none: "nessuno",
    },
    packed: "Impacchettato",
    damaged: "Pacchetti danneggiati",
    traced: "Tracciato",
    plain: "Non impacchettato",
    packedDetail: (files, volumes, percent) =>
      `${num(files)} ${plural(files, FILES)} in ${num(volumes)} ${plural(volumes, { one: "volume", many: "volumi", other: "volumi" })}` +
      (percent === null ? "" : `, ${num(percent)}% della dimensione`),
    journal: (size) => `registro di ${size}`,
    noJournal: "ancora nessun registro",
    runtimeIs: (label) => `runtime: ${label}`,
    index: {
      stale: "ampr_emu.index non aggiornato: una conversione lo rinnova",
      damaged: "ampr_emu.index danneggiato: una conversione lo riscrive",
      missing: "nessun ampr_emu.index: una conversione lo scrive",
    },
    runtimeAction: (a, version) =>
      a === "install"
        ? `una conversione installa l'ampr_emu ${version} incluso`
        : a === "replace"
          ? `una conversione sostituisce il runtime con l'ampr_emu ${version} incluso`
          : `ampr_emu ${version}: una conversione lo mantiene`,
    backportLibs: (exclusive, n) =>
      `${exclusive ? "fakelib2/, montata da sola" : "fakelib/"}, ${num(n)} ${plural(n, { one: "libreria", many: "librerie", other: "librerie" })} di backport`,
    findings: "Risultati del controllo preliminare",
    dlcTitle: (n) => `DLC incorporati (${num(n)})`,
    dlcLabel: "DLC incorporati",
    dlcAll: (note) => `Per ciascun DLC: ${note}.`,
    dlcIn: (folder, size) => `in ${folder}/, ${size}`,
    dlcNoData: "sbloccato dall'emulatore DLC (dlc_emu.ini): solo la licenza, nessun dato proprio",
    dlcStatus: (status) => `sbloccato dall'emulatore DLC (dlc_emu.ini), stato ${status || "non impostato"}`,
    dlcMerged: "integrato nelle cartelle del gioco",
    backportFiles: "File del backport",
    emulatorsIn: "Emulatori in fakelib",
    qr: (url) => `Codice QR: ${url}`,
    needsPassword: "Questo archivio richiede una password.",
    enterPassword: "Inserisci password",
    inArchive: (ext, size) => `in un archivio ${ext} · ${size}`,
    archive: "Archivio",
    parts: (n) => `${num(n)} ${plural(n, { one: "parte", many: "parti", other: "parti" })}`,
    archiveRoot: (root) => `gioco in ${root}`,
    archiveAtRoot: "gioco nella radice dell'archivio",
    solid: "solido",
    encrypted: "protetto da password",
  },
  // delete.tsx
  delete: {
    title: (folder) => (folder ? "Eliminare questa cartella?" : "Eliminare questa immagine?"),
    text: (folder) =>
      folder
        ? "La cartella e tutto il suo contenuto verranno eliminati definitivamente: niente Cestino, nessun annullamento. Se l'eliminazione si interrompe a metà, una parte potrebbe essere già stata rimossa."
        : "Il file immagine verrà eliminato definitivamente: niente Cestino, nessun annullamento. Se l'eliminazione si interrompe a metà, una parte potrebbe essere già stata rimossa.",
    no: "No",
    yes: "Sì, elimina",
    archiveTitle: "Eliminare questo archivio?",
    archiveText:
      "Il file dell'archivio verrà eliminato definitivamente: niente Cestino, nessun annullamento. Le altre parti di un archivio in più parti restano come sono.",
  },
  // password.tsx
  password: {
    title: "Questo archivio richiede una password",
    text: "Inserisci la sua password per aprirlo.",
    wrong: "La password non è corretta.",
    label: "Password",
    cancel: "Annulla",
    unlock: "Sblocca",
    checking: "Verifica…",
  },
  // main-http.tsx
  launch: {
    failure: {
      loader:
        "Impossibile raggiungere il caricatore di payload sulla porta 9021. Esegui prima il tuo autoloader (jailbreak), poi apri di nuovo Dump Forge.",
      missing:
        "Nessuna copia salvata di Dump Forge trovata (né in /data/dumpforge/ né su un'unità USB). Caricalo una volta da un PC: salverà una copia per questa icona.",
      timeout:
        "Dump Forge è stato avviato ma non ha risposto entro 30 secondi. Potrebbe essere ancora in fase di avvio (una console che esce dalla modalità di riposo è lenta).",
      stopping: "Il Dump Forge precedente si sta ancora arrestando (annulla le operazioni e fa pulizia). Attendi un momento, poi riprova.",
    },
    loadFailed: (e) => `Impossibile caricare la pagina: ${e}`,
    noAnswer: "Dump Forge non ha risposto",
    cantStart: "Impossibile avviare Dump Forge",
    retry: "Riprova",
    starting: "Avvio di Dump Forge…",
    client: {
      unreachable:
        "Impossibile raggiungere Dump Forge. Verifica che il payload sia ancora in esecuzione e che questo dispositivo sia sulla stessa rete.",
      noPlatform: "Impossibile stabilire se Dump Forge è in esecuzione su una PS5. Ricarica la pagina per riprovare.",
      quitUnreachable: "Impossibile raggiungere Dump Forge per arrestarlo.",
      stillAnswering: "Dump Forge risponde ancora dopo 2 minuti; controlla la PS5.",
      gone: "Dump Forge non la segnala più (è uscita dalla cronologia delle operazioni prima che se ne vedesse il risultato)",
    },
  },
  // target.tsx
  target: {
    format: {
      folder: { text: "Riporta un'immagine o un pacchetto a una normale cartella di gioco." },
      exfat: {
        text: "Per i giochi che non funzionano bene come ffpkg e girano solo come contenuto di un'unità esterna. Si apre anche su Mac o PC.",
      },
      ffpkg: {
        tone: "good",
        text: "Consigliato. Il file system della PS5 (UFS2). Supporta il montaggio in scrittura.",
      },
      ffpfs: {
        tone: "warn",
        text: "Sperimentale. Il file system PFS della PS5, non compresso. I nomi di file devono essere in ASCII semplice.",
      },
      ffpfsc: {
        tone: "warn",
        text: "Sperimentale. Il più piccolo: un contenitore compresso attorno a un'immagine, sempre montato in sola lettura.",
      },
      pkg: {
        text: "Si installa come un gioco dello store e gira a velocità nativa. Richiede kstuff, fpkg-enable e ppr-patch.",
      },
      lz4: {
        tone: "warn",
        text: "Sperimentale. Una cartella di gioco con gli asset impacchettati in volumi LZ4, che l'emulatore AMPR incluso (ampr_emu) spacchetta mentre il gioco è in esecuzione. Solo per giochi che usano AMPR.",
      },
    },
    innerFfpkg: { tone: "good", text: "Consigliato. Il file system della PS5 (UFS2)." },
    level0: { text: "Nessuna compressione: ogni blocco viene salvato così com'è. Il file è grande quanto l'immagine." },
    levelDefault: {
      tone: "good",
      text: "Consigliato: il valore predefinito di zlib. Con il livello 1 la creazione è circa 3 volte più rapida e il file è circa il 3% più grande; con il livello 9 il file è solo leggermente più piccolo.",
    },
    levelLow: {
      text: "La creazione è più rapida rispetto al livello 6 (circa 3 volte con il livello 1); il file risulta più grande (di circa il 3% con il livello 1).",
    },
    levelHigh: {
      text: "Il file è appena più piccolo rispetto al livello 6 (dello 0,04% con il livello 9), ma la compressione richiede più tempo (circa il 25% in più con il livello 9), con tutti i core occupati per tutta la durata.",
    },
    kraken: {
      fast: { label: "Veloce", note: { tone: "good", text: "Consigliato. La creazione più rapida." } },
      balanced: {
        label: "Bilanciato",
        note: {
          text: "Circa il 2,6% più piccolo di “Veloce”, ma la compressione richiede circa 6 volte il tempo, con tutti i core occupati per tutto il tempo.",
        },
      },
      smallest: {
        label: "Minimo",
        note: {
          text: "Circa il 2,7% più piccolo di “Veloce”, ma la compressione richiede circa 9 volte il tempo, con tutti i core occupati per tutto il tempo.",
        },
      },
      stored: {
        label: "Senza compressione",
        note: {
          text: "Il pacchetto è grande più o meno quanto il gioco. Provalo se un pacchetto compresso si installa ma non si avvia (segnalato con firmware 8.60 e 10.40).",
        },
      },
    },
    pkgFirmware: "Funziona solo con firmware 11.60 o inferiore.",
    imageInside: "Immagine interna",
    imageInsideLabel: "Immagine all'interno del ffpfsc",
    compressionLevel: "Livello di compressione",
    compression: "Compressione",
    fullVerify: "Verifica completa",
    fullVerifyHint: "Rilegge ogni byte per controllare l'output. Richiede più tempo.",
    separator: "Un nome non può contenere un separatore di cartella; usa “Cambia” per la cartella.",
    badName: "Un nome non può essere vuoto, iniziare con un punto, finire con un punto o uno spazio, né contenere caratteri di controllo.",
    tooLong: (bytes, max, folder) =>
      folder
        ? `Troppo lungo: ${bytes} byte, al massimo ${max} (UTF-8).`
        : `Troppo lungo: ${bytes} byte prima dell'estensione, al massimo ${max} (UTF-8).`,
    pkgExt: (ext) => `Termina con .${ext}, ma fpkg viene salvato come .pkg: l'estensione determina il driver.`,
    otherExt: (ext, target) =>
      `Termina con .${ext}, ma la destinazione è ${target}: l'estensione determina il driver.`,
    extractInto: "Estrai in questa cartella",
    saveInto: "Salva in questa cartella",
    output: "Output",
    change: "Cambia",
    naming: "Generazione del nome…",
    chooseSourceFirst: "Scegli prima una sorgente",
    fileName: "Nome del file",
    savedAs: (name, dir) => `salvato come ${name} in ${dir}`,
    inDir: (dir) => `in ${dir}`,
    generate: "Genera il nome in base al contenuto",
    generatePattern: "[nome del gioco]-[ID titolo]",
  },
  // UpdateToast.tsx
  update: {
    available: (v) => `v${v} è disponibile`,
    update: "Aggiorna",
    later: "Più tardi",
    updating: "Aggiornamento…",
    updatingNote: "La nuova versione è in download, l’app si riavvierà da sola.",
    downloading: "Download nel browser: estrai l'archivio e sostituisci questa copia con il suo contenuto.",
    failed: (v) => `Impossibile aggiornare alla v${v}`,
    timeout: (v) => `La v${v} non si è avviata entro un minuto. Se è stata scaricata, ferma Dump Forge e riaprilo per completare l’aggiornamento.`,
    retry: "Riprova",
    close: "Chiudi",
  },
  duration: { s: (s) => `${s} s`, ms: (m, s) => `${m} min ${s} s`, hm: (h, m) => `${h} h ${m} min` },
};

export default it;
