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
    startAgain: "Per continuare, riavvia questa app.",
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
    lz4Trace:
      "Questo gioco impacchettato contiene il runtime di tracciamento LZ4: prima spacchettalo o impacchettalo di nuovo nella scheda LZ4.",
    unreadable: "Impossibile creare: non è stato possibile leggere questa sorgente (vedi “Sorgente”).",
    blocked: (first, more) =>
      `Impossibile creare: ${first}${more > 0 ? ` (e ${num(more)} ${plural(more, { one: "altro", many: "altri", other: "altri" })}, vedi “Sorgente”)` : ""}.`,
    runtime: (install, version) =>
      install
        ? `Installa il runtime AMPR (ampr_emu ${version})`
        : `Sostituisci il runtime AMPR (ampr_emu ${version})`,
    runtimeNone:
      "Questo gioco usa AMPR ma non ha fakelib/libSceAmpr.sprx: l'output riceve quello incluso.",
    runtimeOther:
      "fakelib/libSceAmpr.sprx non è un runtime fornito da Forge (può essere più recente o più vecchio): l'output riceve invece quello incluso.",
    runtimeRest:
      "Il registro delle tracce e i log vengono esclusi e viene scritto un nuovo ampr_emu.index. Cambia solo l'output, mai la sorgente. Disattivato: copiato così com'è.",
    runtimeWarn: (version) =>
      `ampr_emu ${version} è una build di prova dei suoi autori; problema noto: alcuni giochi vanno in crash durante il salvataggio.`,
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
      ["Runtime AMPR", "installa o aggiorna ampr_emu nella copia convertita."],
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
    emptyDirs: (n) => `Cartelle vuote (${num(n)})`,
    noParam: "Nessun sce_sys/param.json.",
    reader: "Lettore",
    leftovers: "File .part rimasti",
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
    scanningIn: (name) => `Scansione di ${name}…`,
    scanning: "Scansione…",
    cantScanFolder: "Impossibile scansionare questa cartella",
    chooseAnother: "Scegli un'altra cartella…",
    pickPrompt: "Scegli la cartella della tua libreria da scansionare",
    choose: "Scegli cartella…",
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
      ? "Fa sì che questo gioco registri quali asset legge mentre giochi (ampr_commands.bin), da usare con “Impacchetta”. “Rimuovi patch” rimette il runtime di rilascio."
      : packed
        ? "Spacchetta: riscrive i pacchetti LZ4 del gioco come file normali, in una cartella o in un'immagine semplice."
        : "Impacchetta: raccoglie gli asset del gioco in volumi LZ4 che l'emulatore AMPR incluso (ampr_emu) legge mentre il gioco è in esecuzione, in una cartella o in un'immagine semplice. Una sorgente già impacchettata viene invece spacchettata.",
    traceInfo: (a, image) => a === "patch"
      ? image
        ? "Ricrea questa immagine con il runtime di tracciamento e lo spazio per la traccia, poi la sostituisce."
        : "Installa il runtime di tracciamento direttamente in questa cartella: non viene scritta nessuna copia."
      : image
        ? "Ricrea questa immagine con il runtime di rilascio di Forge (0.4.2.1), senza le tracce registrate, poi la sostituisce."
        : "Rimette il runtime di rilascio di Forge (0.4.2.1) direttamente in questa cartella: non viene scritta nessuna copia.",
    noAmpr: "il gioco non usa AMPR",
    packedFirst: "la sorgente è impacchettata con LZ4: prima spacchettala",
    damaged: "i suoi pacchetti LZ4 sono danneggiati",
    chooseFirst: "scegli prima una sorgente",
    notRead: "la sorgente non è ancora stata letta",
    anyFormat: "Ti serve ffpfsc o fpkg? Scrivi qui una cartella, poi convertila in qualsiasi formato nella scheda “Converti”.",
    pickProfile: "Profilo LZ4",
    profileFilter: "Profilo LZ4 (TOML)",
    pickTracesFolder: "Tracce LZ4 (una cartella con ampr_commands.bin e ampr_emu.index)",
    pickTracesEither: "Tracce LZ4: lo zip, oppure una cartella con entrambi i file",
    pickTracesZip: "Tracce LZ4 (zip)",
    unreadable: "Impossibile avviare: non è stato possibile leggere questa sorgente (vedi “Sorgente”).",
    pending: (a) => a === "patch"
      ? "Impossibile applicare la patch mentre ci sono operazioni in corso o in coda: applicala quando saranno terminate."
      : "Impossibile rimuovere la patch mentre ci sono operazioni in corso o in coda: rimuovila quando saranno terminate.",
    replacing: "Un'operazione sta già ricreando questa immagine: attendi che termini.",
    blocked: (a, first, more) => {
      const rest = `${first}${more > 0 ? ` (e ${num(more)} ${plural(more, { one: "altro", many: "altri", other: "altri" })}, vedi “Sorgente”)` : ""}.`;
      if (a === "patch") return `Impossibile applicare la patch: ${rest}`;
      if (a === "unpatch") return `Impossibile rimuovere la patch: ${rest}`;
      if (a === "pack") return `Impossibile impacchettare: ${rest}`;
      return `Impossibile spacchettare: ${rest}`;
    },
    chooseGame: "Scegli prima una cartella o un'immagine di gioco.",
    nothing: "Niente da fare qui: questo gioco non usa AMPR (il suo eboot.bin non importa libSceAmpr) e non è impacchettato con LZ4.",
    unavailable: (items) => `Non disponibile per questa sorgente: ${items.join("; ")}.`,
    readOnly: (kind) => <>
      Impossibile applicare o rimuovere la patch su <b>{kind}</b>: sulla console è di sola lettura, quindi il gioco non può scriverci la sua traccia. Convertilo in <b>ffpkg</b> (o <b>exfat</b>) nella scheda “Converti”, poi applica la patch a quello.
    </>,
    action: "Azione",
    traceAction: "Azione di tracciamento",
    changes: (a, image) => a === "patch"
      ? image
        ? "Modifica questa immagine: il runtime di tracciamento sostituisce fakelib/libSceAmpr.sprx (senza copia di backup) e un nuovo ampr_emu.index ne elenca i file."
        : "Modifica questa cartella: il runtime di tracciamento sostituisce fakelib/libSceAmpr.sprx (senza copia di backup) e un nuovo ampr_emu.index ne elenca i file."
      : image
        ? "Modifica questa immagine: il runtime di rilascio di Forge (0.4.2.1) sostituisce fakelib/libSceAmpr.sprx (senza copia di backup), ampr_commands.bin e i log delle tracce vengono eliminati e un nuovo ampr_emu.index ne elenca i file."
        : "Modifica questa cartella: il runtime di rilascio di Forge (0.4.2.1) sostituisce fakelib/libSceAmpr.sprx (senza copia di backup), ampr_commands.bin e i log delle tracce vengono eliminati e un nuovo ampr_emu.index ne elenca i file.",
    replay: (web) => web
      ? "Gioca, poi scegli di nuovo questa sorgente: “Impacchetta/Spacchetta” usa le tracce registrate e “Tracciamento” le offre come zip per un computer. Ogni avvio sovrascrive la traccia della sessione precedente."
      : "Gioca, poi scegli di nuovo questa sorgente: “Impacchetta/Spacchetta” usa le tracce registrate. Ogni avvio sovrascrive la traccia della sessione precedente.",
    room: "Spazio per la traccia",
    roomHint: "Spazio libero aggiunto all'immagine, in cui il gioco scrive la sua traccia. Monta l'immagine in scrittura con image_rw= di ShadowMountPlus, altrimenti non viene registrato nulla: lo spazio riservato da solo non la rende scrivibile.",
    alreadyRelease: "Questa sorgente ha già il runtime di rilascio: viene riscritto solo l'indice.",
    spaceHint: "Serve accanto all'immagine uno spazio libero pari circa alla sua dimensione; l'immagine viene sostituita solo dopo che la copia ha superato la verifica.",
    deletesTraces: (a, bytes, web) => a === "patch"
      ? web
        ? `Applicare la patch elimina le tracce registrate da questa sorgente (ampr_commands.bin, ${bytes}): prima scaricale qui sopra o impacchetta usandole.`
        : `Applicare la patch elimina le tracce registrate da questa sorgente (ampr_commands.bin, ${bytes}): prima impacchetta usandole o copiale.`
      : web
        ? `Rimuovere la patch elimina le tracce registrate da questa sorgente (ampr_commands.bin, ${bytes}): prima scaricale qui sopra o impacchetta usandole.`
        : `Rimuovere la patch elimina le tracce registrate da questa sorgente (ampr_commands.bin, ${bytes}): prima impacchetta usandole o copiale.`,
    useProfile: "Usa invece un profilo di regole",
    profile: "Profilo",
    choose: "Scegli…",
    profileHint: "Un file TOML di regole di impacchettamento. Il profilo sostituisce le tracce: selezionare un profilo rimuove le tracce selezionate e viceversa.",
    target: "Destinazione",
    packInto: "Impacchetta in",
    direct: "Impacchetta direttamente nell'immagine: nessuna cartella temporanea; i file impacchettati vengono letti due volte.",
    targetFormat: "Formato di destinazione",
    unpackFolder: "Una nuova cartella di gioco con i pacchetti LZ4 riscritti come file normali.",
    unpackHint: (n) =>
      `${n === null ? "Riscrive i file impacchettati come file normali" : plural(n, { one: `Riscrive ${num(n)} file impacchettato come file normale`, many: `Riscrive ${num(n)} file impacchettati come file normali`, other: `Riscrive ${num(n)} file impacchettati come file normali` })}; mantiene il runtime AMPR e il suo indice.`,
    waitJobs: "Attendi che le operazioni in corso terminino",
    saveHint: "Salva i file che “Impacchetta” impacchetterebbe come profilo di regole modificabile",
    saving: "Salvataggio…",
    saveProfile: "Salva come profilo",
    saved: (name, packed, loose) => `Salvato ${name}: ${num(packed)} ${plural(packed, { one: "file impacchettato", many: "file impacchettati", other: "file impacchettati" })}, ${num(loose)} ${plural(loose, { one: "sciolto", many: "sciolti", other: "sciolti" })}. Modificalo e caricalo con “Usa invece un profilo di regole”.`,
    likelyFail: (fmt) => <>
      Probabilmente non riuscirà come <b>{fmt}</b>: non accetta i nomi di file elencati in “Sorgente”.
    </>,
    collides: (a, folder) => {
      const what = folder ? "questa cartella" : "questo file";
      return a === "pack"
        ? `Un'operazione sta già scrivendo ${what}: un nuovo impacchettamento non riuscirebbe. Scegli un altro nome.`
        : `Un'operazione sta già scrivendo ${what}: un nuovo spacchettamento non riuscirebbe. Scegli un altro nome.`;
    },
    already: (a, fmt) => a === "pack"
      ? <>Questo gioco è già in scrittura come <b>{fmt}</b>; impacchettandolo di nuovo ottieni una seconda copia.</>
      : <>Questo gioco è già in scrittura come <b>{fmt}</b>; spacchettandolo di nuovo ottieni una seconda copia.</>,
    profileRules: "Impacchetta ciò che indicano le regole del profilo, tranne i file che il motore apre direttamente (indici dei contenitori, configurazioni, contenuti multimediali): quelli restano sciolti.",
    chosenRules: "Impacchetta i file che il gioco ha letto secondo le tracce scelte, tranne quelli che il motore apre direttamente (indici dei contenitori, configurazioni, contenuti multimediali): quelli restano sciolti.",
    ownRules: "Impacchetta i file che il gioco ha letto nell'ultima sessione tracciata (le tracce di questa sorgente), tranne quelli che il motore apre direttamente (indici dei contenitori, configurazioni, contenuti multimediali): quelli restano sciolti.",
    guessRules: "Nessuna traccia in questa sorgente: impacchetta secondo una stima integrata, meno affidabile. Registra prima le tracce (“Tracciamento” → “Applica patch”), oppure scegli tracce copiate dalla console o un profilo.",
    recorded: "Tracce registrate",
    recordedHint: (bytes) => `ampr_commands.bin (${bytes}): “Impacchetta/Spacchetta” carica queste tracce da solo.`,
    downloadHint: "Prima chiudi il gioco e attendi circa un minuto: mentre l'immagine è montata, il suo file su disco può non riflettere ancora ciò che il gioco ha scritto. Apri l'indirizzo di Forge di questa console nel browser di un computer, poi scegli lo zip in “LZ4” → “Impacchetta/Spacchetta” → “Tracce” sul computer. Il download non riesce se nel frattempo il gioco o una sincronizzazione modificano la sorgente: chiudi il gioco e scarica di nuovo.",
    download: (bytes, zip) => `Scarica le tracce (${bytes}) come ${zip}`,
    missingIndex: "Nessun ampr_emu.index in questa sorgente: “Impacchetta” ne ha bisogno accanto ad ampr_commands.bin per tradurre in nomi gli ID di file che contiene.",
    truncatedJournal: "Il gioco si può impacchettare anche se il registro è troncato alla fine: “Impacchetta” si ferma all'ultimo record completo.",
    fakelibWarning: (recorded) => recorded
      ? "Poche tracce o nessuna? Disattiva qualsiasi programma di aggiornamento di fakelib durante il tracciamento: sovrascrive fakelib/libSceAmpr.sprx e così non viene registrato nulla. Disattivalo, applica di nuovo la patch e rigioca."
      : "Disattiva qualsiasi programma di aggiornamento di fakelib durante il tracciamento: sovrascrive fakelib/libSceAmpr.sprx e così non viene registrato nulla.",
    emptyTitle: "Scegli un gioco che usa AMPR",
    experimental: "Sperimentale: tracce e pacchetti LZ4 per ampr_emu. Nessuna garanzia che il gioco funzioni dopo; conserva una copia del gioco originale.",
    chooseSource: "Scegli sorgente…",
    source: "Sorgente",
    gameFolder: "Cartella del gioco…",
    image: "Immagine…",
    traces: "Tracce",
    optionalTraces: "Tracce (facoltative)",
    unlock: "Sblocca per scegliere altre tracce",
    loaded: "Tracce già caricate da questa sorgente",
    lockedHint: (bytes) => `I suoi ampr_commands.bin (${bytes}) e ampr_emu.index. Fai clic sul lucchetto per scegliere invece altre tracce.`,
    clear: "Rimuovi",
    zip: "Zip…",
    folder: "Cartella…",
    tracesHint: "Scegli il file [nome del gioco]-[ID titolo]-amprtrace.zip da “Tracciamento” → “Scarica le tracce”, oppure una cartella con ampr_commands.bin e ampr_emu.index.",
    useOwn: "Usa le tracce della sorgente",
    patchResult: (a, n) => a === "patch"
      ? `Patch applicata: il runtime di tracciamento è in fakelib/libSceAmpr.sprx e ampr_emu.index elenca ${num(n)} ${plural(n, FILES)}.`
      : `Patch rimossa: il runtime di rilascio di Forge (0.4.2.1) è in fakelib/libSceAmpr.sprx e ampr_emu.index elenca ${num(n)} ${plural(n, FILES)}.`,
    removed: (files) => `${plural(files.length, { one: "Rimosso il vecchio file di traccia", many: "Rimossi i vecchi file di traccia", other: "Rimossi i vecchi file di traccia" })}: ${files.join(", ")}.`,
  },
  // Lz4Help.tsx
  lz4Help: {
    title: "Come funziona LZ4",
    close: "Chiudi",
    warning:
      "Sperimentale, solo per giochi AMPR. ampr_emu 0.4.2.1 è una build di prova: alcuni giochi vanno in crash durante il salvataggio. Conserva una copia del gioco originale.",
    body: () => (
      <>
        <h3>1. Tracciamento</h3>
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

        <h3>2. Impacchetta/Spacchetta</h3>
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
    loading: "Caricamento…",
    noDrives: "Nessuna unità trovata.",
    noFolders: "Nessuna cartella qui.",
    noImages: "Nessuna cartella o immagine PS5 qui.",
    noFiles: (ext) => `Qui non ci sono cartelle né file ${dotted(ext, " o ")}.`,
    cancel: "Annulla",
    chooseFolder: "Scegli questa cartella",
  },
  // common.tsx
  common: {
    folder: "Cartella",
    pickFolder: "Cartella del gioco",
    pickImage: "Immagine del gioco",
    pickImageFilter: "Immagine o pacchetto PS5",
    chooseFolder: "Scegli cartella…",
    chooseImage: "Scegli immagine…",
    source: "Sorgente",
    emptyTitle: "Scegli una cartella o un'immagine di gioco",
    emptyText:
      "Una cartella di gioco PS5 (con sce_sys/param.json ed eboot.bin nella radice), oppure un'immagine o un pacchetto che la contiene.",
    accepted: "Sorgenti accettate",
    unknownTitle: "Titolo sconosciuto",
    reading: "Lettura della sorgente…",
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
    backportLibs: (exclusive, n) =>
      `${exclusive ? "fakelib2/, montata da sola" : "fakelib/"}, ${num(n)} ${plural(n, { one: "libreria", many: "librerie", other: "librerie" })} di backport`,
    noFindings: "Nessun problema dal controllo preliminare",
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
    },
    pkgFirmware: "Funziona solo con firmware 11.60 o inferiore.",
    imageInside: "Immagine interna",
    imageInsideLabel: "Immagine all'interno del ffpfsc",
    compressionLevel: "Livello di compressione",
    compression: "Compressione",
    fullVerify: "Verifica completa",
    fullVerifyHint: "Rilegge ogni byte per controllare l'output. Richiede più tempo.",
    separator: "Un nome non può contenere un separatore di cartella; usa “Cambia…” per la cartella.",
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
    change: "Cambia…",
    naming: "Generazione del nome…",
    chooseSourceFirst: "Scegli prima una sorgente",
    fileName: "Nome del file",
    savedAs: (name, dir) => `salvato come ${name} in ${dir}`,
    inDir: (dir) => `in ${dir}`,
    generate: "Genera il nome in base al contenuto",
    generatePattern: "[nome del gioco]-[ID titolo]",
  },
  tauri: { saveProfile: "Salva come profilo", profileFilter: "Profilo LZ4 (TOML)" },
  duration: { s: (s) => `${s} s`, ms: (m, s) => `${m} min ${s} s`, hm: (h, m) => `${h} h ${m} min` },
};

export default it;
