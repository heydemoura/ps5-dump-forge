// French. Typed as `Messages` (en.tsx's shape): tsc fails on a missing key.
// French typography: a narrow no-break space (U+202F) before : ; ? ! and %, and inside « ».
// Terms: trace/traces, traçage; empaqueter/dépaqueter; patcher/retirer le patch; runtime.

import { dotted, num, plural } from "../i18n";
import type { Messages } from "./en";

/** A flat image holds the game's files as they are: about as large as the game. */
const FLAT = "Égale à la taille du jeu";
const FILES = { one: "fichier", many: "de fichiers", other: "fichiers" };
const CHECKS = { one: "contrôle", many: "de contrôles", other: "contrôles" };

const fr: Messages = {
  // App.tsx
  app: {
    address: (url) => `Adresse : ${url}. Afficher comment se connecter, avec un code QR`,
    screens: "Écrans",
    convert: "Convertir",
    active: (n) => `, ${num(n)} en cours`,
    inspect: "Inspecter",
    library: "Bibliothèque",
    about: "À propos",
    offline: "Hors ligne, nouvelle tentative…",
    stop: "Arrêter Dump Forge",
    stillRunning: (n) =>
      n === 1
        ? "Une tâche est encore en cours"
        : `${num(n)} ${plural(n, { one: "tâche est encore en cours", many: "de tâches sont encore en cours", other: "tâches sont encore en cours" })}`,
    job: (id) => `Tâche ${id}`,
    quitNote: (web, n) =>
      n === 1
        ? `${web ? "Arrêter Dump Forge" : "Quitter"} interrompt la tâche et supprime sa sortie inachevée.`
        : `${web ? "Arrêter Dump Forge" : "Quitter"} interrompt les tâches et supprime leurs sorties inachevées.`,
    keepRunning: "Continuer",
    stopAndQuit: (n) => (n === 1 ? "Arrêter la tâche et quitter" : "Arrêter les tâches et quitter"),
    stoppingJobs: "Arrêt des tâches et nettoyage…",
    stoppingForge: "Arrêt de Dump Forge…",
    couldntStop: "Impossible d’arrêter Dump Forge",
    close: "Fermer",
    tryAgain: "Réessayer",
    stopped: "Dump Forge est arrêté",
    startAgain: "Pour continuer, relancez cette application.",
    github: (name) => `${name} sur GitHub`,
    queued: "en attente",
    progress: (percent, left) => `${percent} % terminé${left ? `, il reste ${left}` : ""}`,
  },
  // Convert.tsx
  convert: {
    target: "Cible",
    targetFormat: "Format cible",
    alreadyFolder: "la source est déjà un dossier",
    lz4Backport:
      "Les ressources de ce jeu sont empaquetées en LZ4 et son manifeste LZ4 inclut le backport : dépaquetez-le d’abord dans l’onglet « LZ4 », puis retirez le backport ici.",
    lz4Trace:
      "Ce jeu empaqueté contient le runtime de traçage LZ4 : dépaquetez-le ou empaquetez-le de nouveau dans l’onglet « LZ4 » d’abord.",
    unreadable: "Création impossible : cette source n’a pas pu être lue (voir « Source »).",
    blocked: (first, more) =>
      `Création impossible : ${first}${more > 0 ? ` (et ${num(more)} de plus, voir « Source »)` : ""}.`,
    runtime: "Mettre à jour AMPR",
    runtimeHint: "L’ampr_emu de ce jeu n’est pas la dernière version.",
    removeBackport: "Retirer le backport",
    removeHint: (libs, emulators, other) =>
      `Exclut de fakelib/ ${num(libs)} ${plural(libs, { one: "bibliothèque", many: "de bibliothèques", other: "bibliothèques" })} du backport` +
      (emulators.length === 0
        ? other
          ? " ; les autres bibliothèques homebrew sont conservées."
          : "."
        : ` ; ${plural(emulators.length, { one: "l’émulateur", many: "les émulateurs", other: "les émulateurs" })} (${emulators.join(", ")})${other ? " et les autres bibliothèques homebrew" : ""} ${emulators.length === 1 && !other ? "est conservé" : "sont conservés"}.`),
    cantRemove: (why) => `Impossible de retirer le backport : ${why}`,
    compare: "Comparer les formats",
    build: "Créer",
    likelyFail: (fmt) => (
      <>
        Risque d’échec en <b>{fmt}</b> : ce format refuse des noms de fichiers listés dans « Source ».
      </>
    ),
    collides: "Une tâche écrit déjà ce fichier : relancer « Créer » échouerait. Choisissez un autre nom.",
    already: (fmt) => (
      <>
        Ce jeu est déjà en cours de création en <b>{fmt}</b> ; relancer « Créer » en fait une seconde copie.
      </>
    ),
  },
  // Formats.tsx
  formats: {
    rating: { good: "Bon", ok: "Compromis", bad: "Inconvénient" },
    columns: ["Vitesse sur la console", "Taille sur le disque"],
    rows: {
      pkg: {
        tagline: "Le meilleur, si votre firmware le permet",
        cells: ["Native, pleine vitesse", "30–60 % de moins, selon le jeu"],
      },
      lz4: {
        tagline: "Expérimental, pour les jeux qui utilisent AMPR",
        cells: ["Chargement 30–40 % plus rapide, selon les auteurs", "Environ la moitié de la taille du jeu, selon les auteurs"],
      },
      ffpkg: { tagline: "Recommandé pour ShadowMountPlus", cells: ["Lecture de l’image à pleine vitesse", FLAT] },
      exfat: { tagline: "Compatibilité", cells: ["Lecture de l’image à pleine vitesse", FLAT] },
      ffpfs: { tagline: "Expérimental", cells: ["Lecture de l’image à pleine vitesse", FLAT] },
      ffpfsc: {
        tagline: "Le plus compact, expérimental",
        cells: ["150–250 Mo/s, saccades possibles", "Dépend du niveau de compression, en général 30–60 % de moins"],
      },
      folder: { tagline: "Fichiers du jeu tels quels", cells: ["Pleine vitesse du disque", FLAT] },
    },
    features: [
      ["Conversion", "entre un dossier, ffpkg, exfat, ffpfs, ffpfsc et fpkg, dans les deux sens."],
      ["Inspection", "de la jaquette, du firmware, du backport, des DLC et des problèmes de noms de fichiers d’un jeu avant la création."],
      ["Vérification", "de chaque sortie après l’écriture : un échantillon rapide par défaut, chaque octet sur demande."],
      ["Suppression", "d’un jeu du disque, après confirmation."],
      ["LZ4", "traçage d’un jeu AMPR, puis empaquetage de ses ressources (expérimental)."],
      ["Runtime AMPR", "installation ou mise à jour d’ampr_emu dans la copie convertie."],
      ["Payload PS5", "la même application sur la console, ouverte depuis n’importe quel appareil de votre réseau."],
    ],
    howToConnect: "Comment se connecter",
    connectText: (url) => (
      <>Ouvrez {url} dans un navigateur sur n’importe quel appareil de votre réseau local, ou scannez ce code.</>
    ),
    close: "Fermer",
    about: "À propos",
    aboutText: "Cet outil convertit un jeu de n’importe quel format vers n’importe quel autre, sur toutes les plateformes, PS5 comprise.",
    connectAny: "Se connecter depuis n’importe quel appareil",
    useAddress: (url) => <>Utilisez {url} ou scannez ce code.</>,
    compare: "Comparer les formats",
    compareLabel: "Comparaison des formats",
    format: "Format",
    upstream: (app) =>
      `Chiffres des auteurs : ce qu’annoncent les auteurs d’ampr_emu et de Lazy_AMPR, non mesuré par ${app} ; ils varient selon le jeu. ampr_emu 0.4.2.1 est une version de test de l’auteur ; problème connu : certains jeux plantent lors de la sauvegarde.`,
    bundled: "Les dossiers empaquetés en LZ4 fonctionnent avec ampr_emu 0.4.2.1 de drakmor (GPL-3.0), fourni sans modification. Source :",
    lazy: "La méthode « tracer, puis empaqueter » reprend Lazy_AMPR de Nazky :",
    unrar:
      "Les archives .rar sont lues avec la bibliothèque UnRAR fournie, d’Alexander Roshal (extraction seule, sous la licence UnRAR).",
    language: "Langue",
    system: "Système",
  },
  // Inspect.tsx
  inspect: {
    files: "Fichiers",
    details: "Détails",
    deleting: "Suppression de la source…",
    delete: "Supprimer la source",
    deleted: "Supprimé :",
    contents: "Contenu de la source",
    filter: "Filtrer par chemin",
    filterLabel: "Filtrer les fichiers par chemin",
    firstOf: (max, n) => `${num(max)} premiers sur ${num(n)}`,
    fileCount: (n) => `${num(n)} ${plural(n, FILES)}`,
    noMatch: (f) => `Aucun fichier ne correspond à « ${f} ».`,
    noListing: "La liste des fichiers d’une archive n’est pas prise en charge.",
    emptyDirs: (n) => `Dossiers vides (${num(n)})`,
    noParam: "Pas de sce_sys/param.json.",
    reader: "Lecteur",
    leftovers: "Fichiers et dossiers restants",
    found: (n) => `${num(n)} ${plural(n, { one: "trouvé", many: "trouvés", other: "trouvés" })}`,
    leftoversNote: (app) =>
      `Des sorties inachevées et des archives décompressées, généralement laissées par des tâches interrompues. Ne supprimez que celles que vous reconnaissez, et seulement quand aucune tâche n’est en cours ; ${app} ne les supprime jamais lui-même.`,
    checked: (n) => `Dossiers vérifiés (${num(n)})`,
  },
  // JobList.tsx
  jobs: {
    jobs: "Tâches",
    pending: (n) => `${num(n)} en cours ou en attente`,
    allFinished: "toutes terminées",
    stages: {
      scan: "Lecture de la source",
      preflight: "Contrôle",
      check: "Contrôle",
      plan: "Planification",
      compress: "Compression",
      write: "Écriture",
      measure: "Calcul des paquets",
      pack: "Empaquetage",
      verify: "Vérification",
      finalize: "Finalisation",
    },
    packingWriting: "Empaquetage et écriture",
    rate: { read: "lecture", compress: "compression", pack: "empaquetage", write: "écriture" },
    showPath: "Afficher le chemin",
    showFinder: "Afficher dans le Finder",
    showExplorer: "Afficher dans l’Explorateur",
    showFolder: "Afficher dans le dossier",
    lz4: {
      pack: "LZ4 empaquetage",
      unpack: "LZ4 dépaquetage",
      trace: "LZ4 traçage",
      unpatch: "LZ4 retrait du patch",
      runtime: "Runtime AMPR",
    },
    job: (id) => `Tâche ${id}`,
    done: "Terminé",
    cancelled: "Annulé",
    failed: "Échec",
    cancelling: "Annulation…",
    queued: "En attente",
    dismiss: "Masquer",
    stopJob: "Arrêter ?",
    cancel: "Annuler",
    stopHint: "Cliquez de nouveau sur « Arrêter ? » dans les 4 secondes pour arrêter la tâche.",
    from: "depuis ",
    left: (d) => `il reste ${d}`,
    result: (bytes, n) => `${bytes}, ${num(n)} ${plural(n, FILES)} →`,
    outputPath: "Chemin de sortie",
    checks: "Contrôles",
    verifiedPlain: (n) => `Vérifié : ${num(n)} ${plural(n, CHECKS)} ${plural(n, { one: "réussi", many: "réussis", other: "réussis" })}`,
    verifiedFull: (n) => `Vérification complète réussie : ${num(n)} ${plural(n, CHECKS)}`,
    verifiedFast: (n) => `Vérification rapide réussie : ${num(n)} ${plural(n, CHECKS)}`,
    coverage: (checked, total, n) =>
      `Données vérifiées : ${checked} sur ${total}, en ${num(n)} ${plural(n, { one: "échantillon", many: "d’échantillons", other: "échantillons" })}`,
    cantBuild: "Impossible de créer ce jeu :",
    cantBuildAs: (f) => (
      <>
        Impossible de créer ce jeu en <b>{f}</b> :
      </>
    ),
    log: (n) => `Journal (${num(n)})`,
    logLabel: "Journal",
  },
  // Library.tsx
  library: {
    pickTitle: "Choisir un dossier pour la bibliothèque",
    scanningIn: (name) => `Analyse de ${name}`,
    scanning: "Analyse",
    cantScanFolder: "Impossible d’analyser ce dossier",
    chooseAnother: "Choisir un autre dossier…",
    pickPrompt: "Choisissez le dossier de votre bibliothèque à analyser",
    choose: "Choisir un dossier…",
    cantScan: "Impossible d’analyser la bibliothèque :",
    cantDelete: "Impossible de supprimer :",
    deleted: (path) => `Supprimé : ${path}`,
    truncated: "Limite d’analyse atteinte. Cette liste peut être incomplète.",
    limits: "La recherche s’arrête à six niveaux de dossiers et après environ 15 secondes d’analyse.",
    noRoots: "Aucun dossier n’est disponible pour l’analyse.",
    none: "Aucun jeu trouvé. La recherche descend jusqu’à six niveaux et ignore les dossiers système. D’autres sources restent possibles dans « Inspecter » ou « Convertir ».",
    skipped: "Emplacements et fichiers ignorés",
    stays: "Les résultats restent affichés jusqu’à ce que vous cliquiez sur « Actualiser ». Les nouvelles sorties apparaissent après l’actualisation.",
    library: "Bibliothèque",
    storageTip: "Espace libre sur le stockage interne de la console (/data), lors de la dernière analyse",
    free: (free, total) => (
      <>
        Espace libre : <b>{free}</b> sur {total}
      </>
    ),
    refresh: "Actualiser",
    cards: "Vue en cartes",
    list: "Vue en liste",
    games: "Jeux",
    inspect: (n) => `Inspecter ${n}`,
    convert: (n) => `Convertir ${n}`,
    remove: (n) => `Supprimer ${n}`,
    lz4Tip: "Empaqueté en LZ4 : paquets de ressources ampr_emu",
    lz4Packed: " empaqueté",
  },
  // Lz4.tsx
  lz4: {
    title: "Paquets de ressources LZ4",
    help: "Fonctionnement de LZ4",
    scenario: "Scénario LZ4",
    scenarios: { trace: "Traçage", pack: "Empaquetage/Dépaquetage" },
    actions: { patch: "Patcher", unpatch: "Retirer le patch", pack: "Empaqueter", unpack: "Dépaqueter" },
    scenarioInfo: (s, packed) => s === "trace"
      ? "Enregistre les ressources que le jeu lit pendant que vous jouez, pour l’empaquetage."
      : packed
        ? "Réécrit les paquets LZ4 du jeu sous forme de fichiers ordinaires."
        : "Regroupe les ressources du jeu dans des volumes LZ4 qu’ampr_emu lit pendant le jeu.",
    traceInfo: (a, image) => a === "patch"
      ? image
        ? "Recrée cette image avec le runtime de traçage, puis la remplace."
        : "Installe le runtime de traçage dans ce dossier."
      : image
        ? "Recrée cette image avec le runtime de production, puis la remplace."
        : "Remet le runtime de production dans ce dossier.",
    noAmpr: "le jeu n’utilise pas AMPR",
    noRuntime: "le jeu n’a pas d’ampr_emu",
    noRuntimeWarn: "Ce jeu n’a pas d’ampr_emu : LZ4 ne peut pas le convertir.",
    packedFirst: "la source est empaquetée en LZ4 : dépaquetez-la d’abord",
    damaged: "ses paquets LZ4 sont endommagés",
    archive: "une archive ne peut pas être tracée : convertissez-la d’abord",
    chooseFirst: "choisissez d’abord une source",
    notRead: "la source n’est pas encore lue",
    pickProfile: "Profil LZ4",
    profileFilter: "Profil LZ4 (TOML)",
    pickTracesFolder: "Traces LZ4 (un dossier avec ampr_commands.bin et ampr_emu.index)",
    pickTracesEither: "Traces LZ4 : le zip, ou un dossier contenant les deux fichiers",
    pickTracesZip: "Traces LZ4 (zip)",
    unreadable: "Démarrage impossible : cette source n’a pas pu être lue (voir « Source »).",
    pending: (a) => a === "patch"
      ? "Impossible de patcher pendant qu’une tâche est en cours ou en attente."
      : "Impossible de retirer le patch pendant qu’une tâche est en cours ou en attente.",
    replacing: "Une tâche recrée déjà cette image : attendez qu’elle se termine.",
    blocked: (a, first, more) =>
      `${a === "patch" ? "Impossible de patcher" : a === "unpatch" ? "Impossible de retirer le patch" : a === "pack" ? "Impossible d’empaqueter" : "Impossible de dépaqueter"} : ${first}${more > 0 ? ` (et ${num(more)} de plus, voir « Source »)` : ""}.`,
    chooseGame: "Choisissez d’abord un dossier de jeu ou une image.",
    nothing: "Rien à faire : ce jeu n’utilise pas AMPR et n’est pas empaqueté en LZ4.",
    unavailable: (items) => `Indisponible pour cette source : ${items.join(" ; ")}.`,
    readOnly: (kind) => <>
      <b>{kind}</b> est en lecture seule sur la console, il ne peut donc pas être tracé. Convertissez-le d’abord en <b>ffpkg</b> ou <b>exfat</b>.
    </>,
    action: "Action",
    traceAction: "Action de traçage",
    changes: (a, image) => a === "patch"
      ? `Modifie ${image ? "cette image" : "ce dossier"} : le runtime de traçage remplace fakelib/libSceAmpr.sprx, sans copie de sauvegarde.`
      : `Modifie ${image ? "cette image" : "ce dossier"} : le runtime de production revient et les traces sont supprimées, sans copie de sauvegarde.`,
    replay: (web) => `Jouez, puis choisissez de nouveau cette source pour utiliser ses traces.${web ? " « Traçage » les propose aussi en zip." : ""}`,
    room: "Place pour les traces",
    roomHint: "Espace libre pour les traces du jeu. Montez l’image avec image_rw=, sinon rien n’est enregistré.",
    alreadyRelease: "Déjà sur le runtime de production : seul l’index est réécrit.",
    spaceHint: "Nécessite un espace libre d’environ la taille de l’image ; l’image n’est remplacée qu’une fois la copie vérifiée.",
    deletesTraces: (a, bytes, web) =>
      `${a === "patch" ? "Patcher" : "Retirer le patch"} supprime les traces de cette source (${bytes}) : ${web ? "téléchargez-les d’abord." : "copiez-les d’abord."}`,
    useProfile: "Utiliser plutôt un profil de règles",
    profile: "Profil",
    choose: "Choisir…",
    profileHint: "Un fichier TOML de règles d’empaquetage, utilisé à la place des traces.",
    target: "Cible",
    packInto: "Empaqueter vers",
    direct: "Empaquette directement dans l’image ; les fichiers du jeu sont lus deux fois.",
    targetFormat: "Format cible",
    unpackFolder: "Un nouveau dossier de jeu, avec les paquets réécrits sous forme de fichiers ordinaires.",
    unpackHint: (n) =>
      n === null
        ? "Réécrit les fichiers empaquetés sous forme de fichiers ordinaires."
        : `Réécrit ${plural(n, { one: `${num(n)} fichier empaqueté sous forme de fichier ordinaire`, many: `${num(n)} de fichiers empaquetés sous forme de fichiers ordinaires`, other: `${num(n)} fichiers empaquetés sous forme de fichiers ordinaires` })}.`,
    waitJobs: "Attendez la fin des tâches en cours",
    saveHint: "Enregistrer la liste de fichiers de l’empaquetage comme profil de règles modifiable",
    saving: "Enregistrement…",
    saveProfile: "Enregistrer comme profil",
    saved: (name, packed, loose) =>
      `${name} enregistré : ${num(packed)} ${plural(packed, { one: "fichier empaqueté", many: "de fichiers empaquetés", other: "fichiers empaquetés" })}, ${num(loose)} ${plural(loose, { one: "laissé tel quel", many: "laissés tels quels", other: "laissés tels quels" })}.`,
    likelyFail: (fmt) => <>
      Risque d’échec en <b>{fmt}</b> : ce format refuse des noms de fichiers listés dans « Source ».
    </>,
    collides: (a, folder) =>
      `Une tâche écrit déjà ${folder ? "ce dossier" : "ce fichier"} : « ${a === "pack" ? "Empaqueter" : "Dépaqueter"} » a besoin d’un autre nom.`,
    already: (a, fmt) => <>
      Ce jeu est déjà en cours d’écriture en <b>{fmt}</b> ; relancer « {a === "pack" ? "Empaqueter" : "Dépaqueter"} » en fait une seconde copie.
    </>,
    profileRules: "Empaquette ce que disent les règles du profil ; les fichiers que le moteur ouvre directement restent tels quels.",
    chosenRules: "Empaquette les fichiers que le jeu a lus dans ces traces ; les fichiers que le moteur ouvre directement restent tels quels.",
    ownRules: "Empaquette les fichiers que le jeu a lus lors de sa dernière session tracée ; les fichiers que le moteur ouvre directement restent tels quels.",
    guessRules: "Aucune trace : l’empaquetage suit une estimation intégrée, moins fiable. Tracez d’abord, ou choisissez des traces ou un profil.",
    recorded: "Traces enregistrées",
    recordedHint: (bytes) => `ampr_commands.bin (${bytes}) : l’empaquetage utilise ces traces.`,
    downloadHint: "Fermez le jeu et attendez une minute, puis téléchargez depuis le navigateur d’un ordinateur. Choisissez-y le zip dans « Empaquetage/Dépaquetage » → « Traces ».",
    download: (bytes, zip) => `Télécharger les traces (${bytes}) sous le nom ${zip}`,
    missingIndex: "Pas d’ampr_emu.index dans cette source : l’empaquetage en a besoin à côté d’ampr_commands.bin.",
    truncatedJournal: "Un journal coupé à la fin s’empaquette quand même, jusqu’à son dernier enregistrement complet.",
    fakelibWarning: (recorded) => recorded
      ? "Peu ou pas de traces ? Désactivez l’outil de mise à jour de fakelib, patchez de nouveau et rejouez."
      : "Désactivez l’outil de mise à jour de fakelib pendant le traçage, sinon rien n’est enregistré.",
    emptyTitle: "Choisissez un jeu qui utilise AMPR",
    experimental: "Expérimental : gardez une copie du jeu d’origine.",
    chooseSource: "Choisir la source",
    source: "Source",
    traces: "Traces",
    optionalTraces: "Traces (facultatif)",
    unlock: "Déverrouiller pour choisir d’autres traces",
    loaded: "Les traces sont déjà chargées depuis cette source",
    lockedHint: (bytes) => `Les traces propres à cette source (${bytes}). Cliquez sur le cadenas pour en choisir d’autres.`,
    clear: "Effacer",
    zip: "Zip…",
    folder: "Dossier…",
    tracesHint: "Choisissez le zip amprtrace obtenu via « Télécharger les traces », ou un dossier contenant les deux fichiers de traces.",
    useOwn: "Utiliser les traces de la source",
    patchResult: (a, n) =>
      `${a === "patch" ? "Patché : le runtime de traçage est installé" : "Patch retiré : le runtime de production est de retour"} ; l’index liste ${num(n)} ${plural(n, FILES)}.`,
    removed: (files) => `Anciens fichiers de traces supprimés : ${files.join(", ")}.`,
  },
  // Lz4Help.tsx
  lz4Help: {
    title: "Fonctionnement de LZ4",
    close: "Fermer",
    warning: "Expérimental, uniquement pour les jeux AMPR. Gardez une copie du jeu d’origine.",
    body: () => (
      <>
        <h3>1. Empaquetage/Dépaquetage</h3>
        <ol>
          <li>
            Choisissez le jeu d’origine, <b>Empaquetage/Dépaquetage</b> et les traces (ou un profil).
          </li>
          <li>
            Écrivez un dossier empaqueté ou une image simple ; un dossier se convertit dans n’importe quel format via <b>Convertir</b>.
          </li>
          <li>
            Pour une source empaquetée, <b>Dépaqueter</b> s’affiche à la place : les fichiers redeviennent ordinaires.
          </li>
        </ol>

        <h3>2. Traçage</h3>
        <ol>
          <li>
            Choisissez le <b>ffpkg</b> ou l’<b>exfat</b> du jeu, puis <b>Traçage</b> → <b>Patcher</b>.
          </li>
          <li>Désactivez l’outil de mise à jour de fakelib : il écrase le runtime de traçage.</li>
          <li>
            Montez l’image avec <span className="path">image_rw=</span>, jouez une session, fermez le jeu.
          </li>
          <li>
            Cliquez sur <b>Télécharger les traces</b> sur la page de la PS5, ou copiez ampr_commands.bin et ampr_emu.index.
          </li>
        </ol>
      </>
    ),
  },
  // Picker.tsx
  picker: {
    drives: "Lecteurs",
    location: "Emplacement",
    parent: "Dossier parent",
    allDrives: "Tous les lecteurs",
    truncated: (n) => `Seules les ${num(n)} premières entrées sont affichées.`,
    loading: "Chargement",
    noDrives: "Aucun lecteur trouvé.",
    noFolders: "Aucun dossier ici.",
    noImages: "Aucun dossier, image PS5 ni archive ici.",
    noFiles: (ext) => `Aucun dossier ni fichier ${dotted(ext, " ou ")} ici.`,
    cancel: "Annuler",
    chooseFolder: "Choisir ce dossier",
  },
  // common.tsx
  common: {
    folder: "Dossier",
    pickFolder: "Dossier du jeu",
    pickImage: "Image ou archive du jeu",
    pickImageFilter: "Images et archives",
    pickFolderButton: "Dossier",
    pickImageButton: "Image/Archive",
    source: "Source",
    emptyTitle: "Choisissez un dossier de jeu, une image ou une archive",
    emptyText: "Un dossier de jeu PS5 ou une image, un paquet ou une archive de ce jeu.",
    accepted: "Sources acceptées",
    unknownTitle: "Titre inconnu",
    reading: "Lecture de la source",
    unreadable: "Source illisible",
    backport: "Backport",
    emulators: "Émulateurs",
    declares: (fw) => `déclare ${fw}`,
    fwUnknown: "firmware inconnu d’après ses exécutables (aucun SDK lisible)",
    emulatorList: (names) => `émulateurs : ${names}`,
    otherEmulator: "Autre",
    sdk: (v) => `SDK ${v} (déclaré)`,
    titleId: "ID du titre",
    version: "Version",
    firmware: "Firmware",
    fwDeclared: "déclaré",
    fwBackport: "backport",
    fwExecutables: "exécutables",
    size: "Taille",
    files: (n) => `${num(n)} ${plural(n, FILES)}`,
    contentId: "ID du contenu",
    noAmpr: "eboot.bin n’importe pas libSceAmpr",
    runtime: {
      forge_release: "Forge (production)",
      forge_trace: "Forge (traçage)",
      other: "autre",
      none: "aucun",
    },
    packed: "Empaqueté",
    damaged: "Paquets endommagés",
    traced: "Tracé",
    plain: "Non empaqueté",
    packedDetail: (files, volumes, percent) =>
      `${num(files)} ${plural(files, FILES)} dans ${num(volumes)} ${plural(volumes, { one: "volume", many: "de volumes", other: "volumes" })}` +
      (percent === null ? "" : `, ${num(percent)} % de la taille`),
    journal: (size) => `journal ${size}`,
    noJournal: "pas encore de journal",
    runtimeIs: (label) => `runtime ${label}`,
    backportLibs: (exclusive, n) =>
      `${exclusive ? "fakelib2/, monté seul" : "fakelib/"}, ${num(n)} ${plural(n, { one: "bibliothèque", many: "de bibliothèques", other: "bibliothèques" })} de backport`,
    findings: "Résultats du contrôle préalable",
    dlcTitle: (n) => `DLC intégrés (${num(n)})`,
    dlcLabel: "DLC intégrés",
    dlcAll: (note) => `Pour chaque DLC : ${note}.`,
    dlcIn: (folder, size) => `dans ${folder}/, ${size}`,
    dlcNoData: "débloqué par l’émulateur de DLC (dlc_emu.ini) : droit d’accès seul, sans données propres",
    dlcStatus: (status) => `débloqué par l’émulateur de DLC (dlc_emu.ini), statut ${status || "non défini"}`,
    dlcMerged: "intégré aux dossiers du jeu",
    backportFiles: "Fichiers du backport",
    emulatorsIn: "Émulateurs dans fakelib",
    qr: (url) => `Code QR : ${url}`,
    needsPassword: "Cette archive demande un mot de passe.",
    enterPassword: "Saisir le mot de passe",
    inArchive: (ext, size) => `dans une archive ${ext} · ${size}`,
    archive: "Archive",
    parts: (n) => `${num(n)} ${plural(n, { one: "partie", many: "de parties", other: "parties" })}`,
    archiveRoot: (root) => `jeu dans ${root}`,
    archiveAtRoot: "jeu à la racine de l’archive",
    solid: "solide",
    encrypted: "protégée par mot de passe",
  },
  // delete.tsx
  delete: {
    title: (folder) => (folder ? "Supprimer ce dossier ?" : "Supprimer cette image ?"),
    text: (folder) =>
      folder
        ? "Le dossier et tout son contenu seront supprimés définitivement : pas de corbeille, pas d’annulation. Si la suppression s’arrête en cours de route, une partie peut déjà avoir disparu."
        : "Le fichier image sera supprimé définitivement : pas de corbeille, pas d’annulation. Si la suppression s’arrête en cours de route, une partie peut déjà avoir disparu.",
    no: "Non",
    yes: "Oui, supprimer",
    archiveTitle: "Supprimer cette archive ?",
    archiveText:
      "Le fichier d’archive sera supprimé définitivement : pas de corbeille, pas d’annulation. Les autres parties d’une archive en plusieurs parties restent telles quelles.",
  },
  // password.tsx
  password: {
    title: "Cette archive demande un mot de passe",
    text: "Saisissez son mot de passe pour l’ouvrir.",
    wrong: "Le mot de passe est incorrect.",
    label: "Mot de passe",
    cancel: "Annuler",
    unlock: "Déverrouiller",
    checking: "Vérification…",
  },
  // main-http.tsx
  launch: {
    failure: {
      loader:
        "Impossible de joindre le chargeur de payloads sur le port 9021. Lancez d’abord votre autoloader (jailbreak), puis rouvrez Dump Forge.",
      missing:
        "Aucune copie enregistrée de Dump Forge n’a été trouvée (ni dans /data/dumpforge/, ni sur un support USB). Chargez-le une fois depuis un PC : il enregistre une copie pour cette icône.",
      timeout:
        "Dump Forge a été lancé mais ne répond toujours pas après 30 secondes. Il est peut-être encore en cours de démarrage (une console qui sort du mode repos est lente).",
    },
    loadFailed: (e) => `Impossible de charger la page : ${e}`,
    noAnswer: "Dump Forge ne répond pas",
    cantStart: "Impossible de lancer Dump Forge",
    retry: "Réessayer",
    starting: "Lancement de Dump Forge…",
    client: {
      unreachable:
        "Impossible de joindre Dump Forge. Vérifiez que le payload tourne toujours et que cet appareil est sur le même réseau.",
      noPlatform: "Impossible de déterminer si Dump Forge tourne sur une PS5. Actualisez la page pour réessayer.",
      quitUnreachable: "Impossible de joindre Dump Forge pour l’arrêter.",
      stillAnswering: "Dump Forge répond toujours après 2 minutes ; vérifiez la PS5.",
      gone: "Dump Forge ne signale plus cette tâche (retirée de son historique avant que son résultat ait été vu)",
    },
  },
  // target.tsx
  target: {
    format: {
      folder: { text: "Extraire une image ou un paquet vers un dossier de jeu ordinaire." },
      exfat: {
        text: "Pour les jeux qui fonctionnent mal en ffpkg et ne fonctionnent que s’ils sont traités comme du contenu de disque externe. S’ouvre aussi sur Mac ou PC.",
      },
      ffpkg: {
        tone: "good",
        text: "Recommandé. Le système de fichiers natif de la PS5 (UFS2). Montage en écriture possible.",
      },
      ffpfs: {
        tone: "warn",
        text: "Expérimental. Le système de fichiers PFS de la PS5, sans compression. Les noms de fichiers doivent être en ASCII simple.",
      },
      ffpfsc: {
        tone: "warn",
        text: "Expérimental. Le plus compact : un conteneur compressé autour d’une image, toujours monté en lecture seule.",
      },
      pkg: {
        text: "S’installe comme un jeu du Store et tourne à vitesse native. Nécessite kstuff, fpkg-enable et ppr-patch.",
      },
      lz4: {
        tone: "warn",
        text: "Expérimental. Un dossier de jeu dont les ressources sont empaquetées dans des volumes LZ4, que l’émulateur AMPR fourni (ampr_emu) dépaquette pendant le jeu. Uniquement pour les jeux qui utilisent AMPR.",
      },
    },
    innerFfpkg: { tone: "good", text: "Recommandé. Le système de fichiers natif de la PS5 (UFS2)." },
    level0: { text: "Sans compression : chaque bloc est stocké tel quel. Le fichier a la taille de l’image." },
    levelDefault: {
      tone: "good",
      text: "Recommandé. Il s’agit du niveau par défaut de zlib. Le niveau 1 crée environ 3 fois plus vite un fichier environ 3 % plus gros ; le niveau 9 produit un fichier à peine plus petit.",
    },
    levelLow: {
      text: "Création plus rapide qu’au niveau 6 (environ 3 fois au niveau 1) ; le fichier est plus gros (environ 3 % au niveau 1).",
    },
    levelHigh: {
      text: "À peine plus petit qu’au niveau 6 (0,04 % au niveau 9), mais la compression prend plus de temps (environ 25 % au niveau 9), avec tous les cœurs occupés du début à la fin.",
    },
    kraken: {
      fast: { label: "Rapide", note: { tone: "good", text: "Recommandé. La création la plus rapide." } },
      balanced: {
        label: "Équilibré",
        note: {
          text: "Environ 2,6 % plus petit qu’avec « Rapide », mais la compression prend environ 6 fois plus de temps, avec tous les cœurs occupés en permanence.",
        },
      },
      smallest: {
        label: "Le plus petit",
        note: {
          text: "Environ 2,7 % plus petit qu’avec « Rapide », mais la compression prend environ 9 fois plus de temps, avec tous les cœurs occupés en permanence.",
        },
      },
    },
    pkgFirmware: "Fonctionne uniquement avec un firmware 11.60 ou inférieur.",
    imageInside: "Image interne",
    imageInsideLabel: "Image à l’intérieur du ffpfsc",
    compressionLevel: "Niveau de compression",
    compression: "Compression",
    fullVerify: "Vérification complète",
    fullVerifyHint: "Relit chaque octet pour contrôler la sortie. Plus long.",
    separator: "Un nom ne peut pas contenir de séparateur de dossiers ; utilisez « Modifier… » pour le dossier.",
    tooLong: (bytes, max, folder) =>
      folder
        ? `Trop long : ${bytes} octets, ${max} au maximum (UTF-8).`
        : `Trop long : ${bytes} octets avant l’extension, ${max} au maximum (UTF-8).`,
    pkgExt: (ext) => `Se termine par .${ext}, mais un fpkg est enregistré en .pkg : l’extension détermine le pilote.`,
    otherExt: (ext, target) =>
      `Se termine par .${ext}, mais la cible est ${target} : l’extension détermine le pilote.`,
    extractInto: "Extraire dans ce dossier",
    saveInto: "Enregistrer dans ce dossier",
    output: "Sortie",
    change: "Modifier…",
    naming: "Nommage…",
    chooseSourceFirst: "Choisissez d’abord une source",
    fileName: "Nom du fichier",
    savedAs: (name, dir) => `enregistré sous ${name} dans ${dir}`,
    inDir: (dir) => `dans ${dir}`,
    generate: "Générer un nom d’après le contenu",
    generatePattern: "[nom du jeu]-[ID du titre]",
  },
  // transport-tauri.tsx: the native save dialog
  tauri: { saveProfile: "Enregistrer comme profil", profileFilter: "Profil LZ4 (TOML)" },
  // api.ts: prettyDuration's units
  duration: { s: (s) => `${s} s`, ms: (m, s) => `${m} min ${s} s`, hm: (h, m) => `${h} h ${m} min` },
};

export default fr;
