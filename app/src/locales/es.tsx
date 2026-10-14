// Spanish (neutral). Typed as `Messages` (en.tsx's shape): tsc fails on a missing key.
// Terms: traza/trazas (the recorded traces), trazado (tracing), runtime, empaquetar/desempaquetar,
// parchear/quitar parche.

import { dotted, num, plural } from "../i18n";
import type { Messages } from "./en";

/** A flat image holds the game's files as they are: about as large as the game. */
const FLAT = "Igual al tamaño del juego";
const FILES = { one: "archivo", many: "archivos", other: "archivos" };
const CHECKS = { one: "comprobación", many: "comprobaciones", other: "comprobaciones" };

const es: Messages = {
  // App.tsx
  app: {
    address: (url) => `Dirección: ${url}. Mostrar cómo conectarse, con un código QR`,
    screens: "Pantallas",
    convert: "Convertir",
    active: (n) => `, ${num(n)} ${plural(n, { one: "activa", many: "activas", other: "activas" })}`,
    inspect: "Inspeccionar",
    library: "Biblioteca",
    about: "Acerca de",
    offline: "Sin conexión, reintentando…",
    stop: "Detener Dump Forge",
    stillRunning: (n) =>
      n === 1
        ? "Una tarea sigue en curso"
        : `${num(n)} ${plural(n, { one: "tarea sigue en curso", many: "tareas siguen en curso", other: "tareas siguen en curso" })}`,
    job: (id) => `Tarea ${id}`,
    quitNote: (web, n) =>
      web
        ? n === 1
          ? "Al detener Dump Forge, la tarea se detiene y se elimina la salida sin terminar."
          : "Al detener Dump Forge, las tareas se detienen y se elimina la salida sin terminar."
        : n === 1
          ? "Al salir, la tarea se detiene y se elimina la salida sin terminar."
          : "Al salir, las tareas se detienen y se elimina la salida sin terminar.",
    keepRunning: "Seguir",
    stopAndQuit: (n) => (n === 1 ? "Detener tarea y salir" : "Detener tareas y salir"),
    stoppingJobs: "Deteniendo tareas y limpiando…",
    stoppingForge: "Deteniendo Dump Forge…",
    couldntStop: "No se pudo detener Dump Forge",
    close: "Cerrar",
    tryAgain: "Reintentar",
    stopped: "Dump Forge se ha detenido",
    startAgain: (ps5) => (ps5 ? "Para continuar, vuelve a abrir el icono de Dump Forge en la PS5." : "Para continuar, vuelve a ejecutar el mismo comando ps5-dump-forge serve."),
    confirmStop: (web: boolean) => (web ? "¿Detener Dump Forge?" : "¿Salir de PS5 Dump Forge?"),
    stopNote: (web, ps5) => (!web ? "No hay ningún trabajo en curso." : ps5 ? "Para volver a iniciarlo, abre el icono de Dump Forge en la PS5." : "Para volver a iniciarlo, ejecuta de nuevo el mismo comando ps5-dump-forge serve."),
    quit: "Salir",
    github: (name) => `${name} en GitHub`,
    queued: "en cola",
    progress: (percent, left) => `${percent}% completado${left ? `, tiempo restante: ${left}` : ""}`,
  },
  // Convert.tsx
  convert: {
    target: "Destino",
    targetFormat: "Formato de destino",
    alreadyFolder: "el origen ya es una carpeta",
    lz4Backport:
      "Los recursos de este juego están empaquetados con LZ4 y su manifiesto LZ4 incluye el backport: primero desempaquétalo en la pestaña LZ4 y luego quita el backport aquí.",
    lz4Trace:
      "Este juego empaquetado lleva el runtime de trazado de LZ4: primero desempaquétalo o vuelve a empaquetarlo en la pestaña LZ4.",
    unreadable: "No se puede crear: no se pudo leer este origen (consulta “Origen”).",
    noContentId: "No se puede crear como fpkg: el param.json de este juego no tiene Content ID, y un paquete lo necesita.",
    blocked: (first, more) =>
      `No se puede crear: ${first}${more > 0 ? ` (y ${num(more)} más, consulta “Origen”)` : ""}.`,
    runtime: "Actualizar AMPR",
    runtimeHint: "El ampr_emu de este juego no es la última versión.",
    removeBackport: "Quitar backport",
    removeHint: (libs, emulators, other) =>
      `Omite ${num(libs)} ${plural(libs, { one: "biblioteca", many: "bibliotecas", other: "bibliotecas" })} de backport de fakelib/` +
      (emulators.length === 0
        ? other
          ? "; las demás bibliotecas homebrew se conservan."
          : "."
        : other
          ? emulators.length === 1
            ? `; el emulador (${emulators.join(", ")}) y las demás bibliotecas homebrew se conservan.`
            : `; los emuladores (${emulators.join(", ")}) y las demás bibliotecas homebrew se conservan.`
          : emulators.length === 1
            ? `; el emulador (${emulators.join(", ")}) se conserva.`
            : `; los emuladores (${emulators.join(", ")}) se conservan.`),
    cantRemove: (why) => `No se puede quitar el backport: ${why}`,
    compare: "Comparar formatos",
    build: "Crear",
    likelyFail: (fmt) => (
      <>
        Probablemente fallará como <b>{fmt}</b>: no admite los nombres de archivo indicados en Origen.
      </>
    ),
    collides: "Una tarea ya está escribiendo este archivo: volver a crear fallaría. Elige otro nombre.",
    already: (fmt) => (
      <>
        Este juego ya se está creando como <b>{fmt}</b>; volver a crear hace una segunda copia.
      </>
    ),
  },
  // Formats.tsx
  formats: {
    rating: { good: "Bueno", ok: "Compromiso", bad: "Desventaja" },
    columns: ["Velocidad en consola", "Tamaño en disco"],
    rows: {
      pkg: {
        tagline: "El mejor, si tu firmware lo permite",
        cells: ["Nativa, velocidad completa", "Entre 30 y 60% menos, según el juego"],
      },
      lz4: {
        tagline: "Experimental, para juegos que usan AMPR",
        cells: ["Carga entre 30 y 40% más rápida, según sus autores", "Más o menos la mitad del juego, según sus autores"],
      },
      ffpkg: { tagline: "Recomendado para ShadowMountPlus", cells: ["Velocidad completa de imagen", FLAT] },
      exfat: { tagline: "Compatibilidad", cells: ["Velocidad completa de imagen", FLAT] },
      ffpfs: { tagline: "Experimental", cells: ["Velocidad completa de imagen", FLAT] },
      ffpfsc: {
        tagline: "El más pequeño, experimental",
        cells: ["150–250 MB/s, puede dar tirones", "Depende del nivel de compresión, normalmente entre 30 y 60% menos"],
      },
      folder: { tagline: "Archivos del juego sin más", cells: ["Velocidad completa de la unidad", FLAT] },
    },
    features: [
      ["Convertir", "entre carpeta, ffpkg, exfat, ffpfs, ffpfsc y fpkg, en ambos sentidos."],
      ["Inspeccionar", "la portada, el firmware, el backport, los DLC y los problemas de nombres de archivo de un juego antes de crear."],
      ["Verificar", "cada salida tras escribirla: una muestra rápida por defecto, cada byte si lo pides."],
      ["Eliminar", "un juego del disco, tras confirmarlo."],
      ["LZ4", "trazar un juego con AMPR y luego empaquetar sus recursos (experimental)."],
      ["Runtime AMPR", "instalar o actualizar ampr_emu en la copia convertida."],
      ["Payload para PS5", "la misma app en la consola, abierta desde cualquier dispositivo de tu red."],
    ],
    howToConnect: "Cómo conectarse",
    connectText: (url) => (
      <>Abre {url} en un navegador de cualquier dispositivo de tu red local, o escanea este código.</>
    ),
    close: "Cerrar",
    about: "Acerca de",
    aboutText: "Esta herramienta convierte un juego de cualquier formato a cualquier otro, en cualquier plataforma, incluida la PS5.",
    connectAny: "Cómo conectarse desde cualquier dispositivo",
    useAddress: (url) => <>Usa {url} o escanea este código.</>,
    compare: "Comparar formatos",
    compareLabel: "Comparación de formatos",
    format: "Formato",
    upstream: (app) =>
      `Cifras de sus autores: lo que indican los autores de ampr_emu y Lazy_AMPR, no medido por ${app}; varían según el juego. ampr_emu 0.4.2.1 es una versión de prueba de sus autores; problema conocido: algunos juegos se cierran al guardar.`,
    bundled: "Las carpetas empaquetadas con LZ4 funcionan con ampr_emu 0.4.2.1 de drakmor (GPL-3.0), incluido sin modificar. Código fuente:",
    lazy: "El flujo de trazar y luego empaquetar sigue Lazy_AMPR de Nazky:",
    unrar:
      "Los archivos .rar se leen con la biblioteca UnRAR incluida, de Alexander Roshal (solo extracción, bajo la licencia de UnRAR).",
    language: "Idioma",
    system: "Sistema",
  },
  // Inspect.tsx
  inspect: {
    files: "Archivos",
    details: "Detalles",
    deleting: "Eliminando el origen…",
    delete: "Eliminar el origen",
    deleted: "Eliminado:",
    contents: "Contenido del origen",
    filter: "Filtrar por ruta",
    filterLabel: "Filtrar archivos por ruta",
    firstOf: (max, n) => plural(max, {
  one: `primero de ${num(n)}`,
  many: `primeros ${num(max)} de ${num(n)}`,
  other: `primeros ${num(max)} de ${num(n)}`,
}),
    fileCount: (n) => `${num(n)} ${plural(n, FILES)}`,
    noMatch: (f) => `Ningún archivo coincide con “${f}”.`,
    noListing: "La lista de archivos del archivo comprimido no es compatible.",
    emptyDirs: (n) => `Carpetas vacías (${num(n)})`,
    noParam: "No hay sce_sys/param.json.",
    reader: "Lector",
    leftovers: "Archivos y carpetas sobrantes",
    found: (n) => `${num(n)} ${plural(n, { one: "encontrado", many: "encontrados", other: "encontrados" })}`,
    leftoversNote: (app) =>
      `Salidas sin terminar, normalmente de tareas interrumpidas. Elimina solo las que reconozcas, y solo cuando no haya ninguna tarea en curso; ${app} nunca las elimina por su cuenta.`,
    checked: (n) => `Carpetas revisadas (${num(n)})`,
  },
  // JobList.tsx
  jobs: {
    jobs: "Tareas",
    pending: (n) => `${num(n)} en curso o en cola`,
    allFinished: "todas terminadas",
    stages: {
      scan: "Leyendo el origen",
      preflight: "Comprobando",
      check: "Comprobando",
      plan: "Planificando",
      compress: "Comprimiendo",
      write: "Escribiendo",
      measure: "Midiendo paquetes",
      pack: "Empaquetando",
      verify: "Verificando",
      finalize: "Finalizando",
    },
    steps: {
      scan: "Lectura",
      preflight: "Comprobación",
      check: "Comprobación",
      plan: "Planificación",
      compress: "Compresión",
      write: "Escritura",
      measure: "Medición",
      pack: "Empaquetado",
      verify: "Verificación",
      finalize: "Finalización",
    },
    stepsLabel: "Pasos",
    stepDone: (s) => `Hecho: ${s}`,
    stepLater: (s) => `Pendiente: ${s}`,
    packingWriting: "Empaquetando y escribiendo",
    rate: { read: "lectura", compress: "compresión", pack: "empaquetado", write: "escritura" },
    showPath: "Mostrar ruta",
    showFinder: "Mostrar en Finder",
    showExplorer: "Mostrar en el Explorador",
    showFolder: "Mostrar en la carpeta",
    lz4: {
      pack: "LZ4: empaquetar",
      unpack: "LZ4: desempaquetar",
      trace: "LZ4: trazado",
      unpatch: "LZ4: quitar parche",
      runtime: "Runtime AMPR",
    },
    job: (id) => `Tarea ${id}`,
    done: "Hecho",
    cancelled: "Cancelada",
    failed: "Error",
    cancelling: "Cancelando…",
    queued: "En cola",
    dismiss: "Descartar",
    stopJob: "¿Detener tarea?",
    cancel: "Cancelar",
    stopHint: "Vuelve a pulsar “¿Detener tarea?” en menos de 4 segundos para detenerla.",
    from: "de ",
    left: (d) => `tiempo restante: ${d}`,
    inStep: (time) => `${time} en este paso`,
    result: (bytes, n) => `${bytes}, ${num(n)} ${plural(n, FILES)} →`,
    outputPath: "Ruta de salida",
    checks: "Comprobaciones",
    verifiedPlain: (n) => `Verificado: ${num(n)} ${plural(n, CHECKS)} sin errores`,
    verifiedFull: (n) => `Verificación completa superada: ${num(n)} ${plural(n, CHECKS)}`,
    verifiedFast: (n) => `Verificación rápida superada: ${num(n)} ${plural(n, CHECKS)}`,
    coverage: (checked, total, n) =>
      `Cantidad revisada: ${checked} de ${total} en ${num(n)} ${plural(n, { one: "muestra", many: "muestras", other: "muestras" })}`,
    cantBuild: "No se puede crear este juego:",
    cantBuildAs: (f) => (
      <>
        No se puede crear este juego como <b>{f}</b>:
      </>
    ),
    log: (n) => `Registro (${num(n)})`,
    logLabel: "Registro",
  },
  // Library.tsx
  library: {
    pickTitle: "Elige una carpeta para la Biblioteca",
    scanningIn: (name) => `Escaneando ${name}`,
    scanning: "Escaneando",
    cantScanFolder: "No se puede escanear esta carpeta",
    chooseAnother: "Elegir otra carpeta",
    pickPrompt: "Elige la carpeta de tu biblioteca para escanearla",
    choose: "Elegir carpeta",
    cantScan: "No se puede escanear la Biblioteca:",
    cantDelete: "No se puede eliminar:",
    deleted: (path) => `Eliminado ${path}`,
    truncated: "Se alcanzó el límite de escaneo. Puede que la lista esté incompleta.",
    limits: "La búsqueda llega hasta seis niveles de carpetas y se detiene tras unos 15 segundos de escaneo.",
    noRoots: "No hay carpetas disponibles para escanear.",
    none: "No se encontraron juegos. La búsqueda llega hasta seis niveles de profundidad y omite las carpetas del sistema. Puedes elegir otros orígenes en “Inspeccionar” o “Convertir”.",
    skipped: "Ubicaciones y archivos omitidos",
    stays: "Los resultados se quedan aquí hasta que pulses “Actualizar”. Las salidas nuevas aparecen al actualizar.",
    library: "Biblioteca",
    storageTip: "Espacio libre en el almacenamiento interno de la consola (/data), según el último escaneo",
    free: (free, total) => (
      <>
        Libre: <b>{free}</b> de {total}
      </>
    ),
    refresh: "Actualizar",
    cards: "Vista de tarjetas",
    list: "Vista de lista",
    games: "Juegos",
    inspect: (n) => `Inspeccionar ${n}`,
    convert: (n) => `Convertir ${n}`,
    remove: (n) => `Eliminar ${n}`,
    lz4Tip: "Empaquetado con LZ4: paquetes de recursos de ampr_emu",
    lz4Packed: " empaquetado",
  },
  // Lz4.tsx
  lz4: {
    title: "Paquetes de recursos LZ4",
    help: "Cómo funciona LZ4",
    scenario: "Escenario LZ4",
    scenarios: { trace: "Trazado", pack: "Empaquetar/Desempaquetar" },
    actions: { patch: "Parchear", unpatch: "Quitar parche", pack: "Empaquetar", unpack: "Desempaquetar" },
    scenarioInfo: (s, packed) => s === "trace"
      ? "Registra qué recursos lee el juego mientras juegas, para que Empaquetar los use."
      : packed
        ? "Vuelve a escribir los paquetes LZ4 del juego como archivos normales."
        : "Empaqueta los recursos del juego en volúmenes LZ4 que ampr_emu lee mientras el juego se ejecuta.",
    traceInfo: (a, image) => a === "patch"
      ? image
        ? "Vuelve a crear esta imagen con el runtime de trazado y luego la reemplaza."
        : "Instala el runtime de trazado en esta carpeta."
      : image
        ? "Vuelve a crear esta imagen con el runtime de lanzamiento y luego la reemplaza."
        : "Vuelve a poner el runtime de lanzamiento en esta carpeta.",
    noAmpr: "el juego no usa AMPR",
    noRuntime: "el juego no tiene ampr_emu",
    noRuntimeWarn: "Este juego no tiene ampr_emu, así que LZ4 no puede convertirlo.",
    packedFirst: "el origen está empaquetado con LZ4: desempaquétalo primero",
    damaged: "sus paquetes LZ4 están dañados",
    archive: "un archivo comprimido no se puede trazar: conviértelo primero",
    chooseFirst: "elige primero un origen",
    notRead: "el origen aún no se ha leído",
    pickProfile: "Perfil LZ4",
    profileFilter: "Perfil LZ4 (TOML)",
    pickTracesFolder: "Trazas LZ4 (una carpeta con ampr_commands.bin y ampr_emu.index)",
    pickTracesEither: "Trazas LZ4: el zip, o una carpeta con ambos archivos",
    pickTracesZip: "Trazas LZ4 (zip)",
    unreadable: "No se puede iniciar: no se pudo leer este origen (consulta “Origen”).",
    pending: (a) => a === "patch"
      ? "No se puede parchear mientras haya tareas en curso o en cola."
      : "No se puede quitar el parche mientras haya tareas en curso o en cola.",
    replacing: "Una tarea ya está volviendo a crear esta imagen: espera a que termine.",
    blocked: (a, first, more) => {
      const rest = `${first}${more > 0 ? ` (y ${num(more)} más, consulta “Origen”)` : ""}.`;
      if (a === "patch") return `No se puede parchear: ${rest}`;
      if (a === "unpatch") return `No se puede quitar el parche: ${rest}`;
      if (a === "pack") return `No se puede empaquetar: ${rest}`;
      return `No se puede desempaquetar: ${rest}`;
    },
    chooseGame: "Elige primero una carpeta o imagen de juego.",
    nothing: "Nada que hacer: este juego no usa AMPR y no está empaquetado con LZ4.",
    unavailable: (items) => `No disponible para este origen: ${items.join("; ")}.`,
    readOnly: (kind) => <>
      <b>{kind}</b> es de solo lectura en la consola, así que no se puede trazar. Conviértelo primero a <b>ffpkg</b> o <b>exfat</b>.
    </>,
    action: "Acción",
    traceAction: "Acción de trazado",
    changes: (a, image) => a === "patch"
      ? `Modifica ${image ? "esta imagen" : "esta carpeta"}: el runtime de trazado reemplaza fakelib/libSceAmpr.sprx, sin copia de seguridad.`
      : `Modifica ${image ? "esta imagen" : "esta carpeta"}: vuelve el runtime de lanzamiento y se eliminan las trazas, sin copia de seguridad.`,
    replay: (web) => `Juega y luego vuelve a elegir este origen para usar sus trazas.${web ? " “Trazado” también las ofrece como zip." : ""}`,
    room: "Espacio para la traza",
    roomHint: "Espacio libre para la traza del juego. Monta la imagen con image_rw= o no se registrará nada.",
    alreadyRelease: "Ya tiene el runtime de lanzamiento: solo se vuelve a escribir el índice.",
    spaceHint: "Necesita un espacio libre parecido al tamaño de la imagen; la imagen solo se reemplaza cuando la copia se verifica.",
    deletesTraces: (a, bytes, web) => a === "patch"
      ? `Parchear elimina las trazas de este origen (${bytes}): ${web ? "descárgalas antes." : "cópialas antes."}`
      : `Quitar el parche elimina las trazas de este origen (${bytes}): ${web ? "descárgalas antes." : "cópialas antes."}`,
    useProfile: "Usar un perfil de reglas en su lugar",
    profile: "Perfil",
    choose: "Elegir",
    profileHint: "Un archivo TOML con reglas de empaquetado, que se usa en lugar de las trazas.",
    target: "Destino",
    packInto: "Empaquetar en",
    direct: "Empaqueta directamente en la imagen; los archivos del juego se leen dos veces.",
    targetFormat: "Formato de destino",
    unpackFolder: "Una carpeta de juego nueva con los paquetes escritos de nuevo como archivos normales.",
    unpackHint: (n) =>
      n === null
        ? "Vuelve a escribir los archivos empaquetados como archivos normales."
        : `Vuelve a escribir ${plural(n, { one: `${num(n)} archivo empaquetado como archivo normal`, many: `${num(n)} archivos empaquetados como archivos normales`, other: `${num(n)} archivos empaquetados como archivos normales` })}.`,
    waitJobs: "Espera a que terminen las tareas en curso",
    saveHint: "Guardar la lista de archivos de Empaquetar como un perfil de reglas editable",
    saving: "Guardando…",
    saveProfile: "Guardar como perfil",
    saved: (name, packed, loose) => `Guardado ${name}: ${num(packed)} ${plural(packed, { one: "archivo empaquetado", many: "archivos empaquetados", other: "archivos empaquetados" })}, ${num(loose)} ${plural(loose, { one: "suelto", many: "sueltos", other: "sueltos" })}.`,
    likelyFail: (fmt) => <>
      Probablemente fallará como <b>{fmt}</b>: no admite los nombres de archivo indicados en Origen.
    </>,
    collides: (a, folder) => {
      const what = folder ? "esta carpeta" : "este archivo";
      return a === "pack"
        ? `Una tarea ya está escribiendo ${what}: Empaquetar necesita otro nombre.`
        : `Una tarea ya está escribiendo ${what}: Desempaquetar necesita otro nombre.`;
    },
    already: (a, fmt) => a === "pack"
      ? <>Este juego ya se está escribiendo como <b>{fmt}</b>; volver a empaquetar hace una segunda copia.</>
      : <>Este juego ya se está escribiendo como <b>{fmt}</b>; volver a desempaquetar hace una segunda copia.</>,
    profileRules: "Empaqueta lo que indican las reglas del perfil; los archivos que el motor abre directamente quedan sueltos.",
    chosenRules: "Empaqueta los archivos que el juego leyó en estas trazas; los archivos que el motor abre directamente quedan sueltos.",
    ownRules: "Empaqueta los archivos que el juego leyó en su última sesión trazada; los archivos que el motor abre directamente quedan sueltos.",
    guessRules: "Sin trazas: empaqueta según una estimación integrada menos fiable. Traza primero, o elige trazas o un perfil.",
    recorded: "Trazas registradas",
    recordedHint: (bytes) => `ampr_commands.bin (${bytes}): Empaquetar usa estas trazas.`,
    downloadHint: "Cierra el juego, espera un minuto y descarga desde el navegador de una computadora. Allí elige el zip en “Empaquetar/Desempaquetar” → “Trazas”.",
    download: (bytes, zip) => `Descargar trazas (${bytes}) como ${zip}`,
    missingIndex: "Este origen no tiene ampr_emu.index: Empaquetar lo necesita junto a ampr_commands.bin.",
    truncatedJournal: "Un registro truncado al final también se empaqueta, hasta su última entrada completa.",
    fakelibWarning: (recorded) => recorded
      ? "¿Pocas trazas o ninguna? Desactiva el actualizador de fakelib, vuelve a parchear y juega de nuevo."
      : "Desactiva el actualizador de fakelib durante el trazado o no se registrará nada.",
    emptyTitle: "Elige un juego que use AMPR",
    experimental: "Experimental: guarda una copia del juego original.",
    chooseSource: "Elegir origen",
    source: "Origen",
    traces: "Trazas",
    optionalTraces: "Trazas (opcional)",
    unlock: "Desbloquear para elegir otras trazas",
    loaded: "Las trazas ya se cargaron de este origen",
    lockedHint: (bytes) => `Las propias trazas de este origen (${bytes}). Haz clic en el candado para elegir otras.`,
    clear: "Quitar",
    zip: "Zip",
    folder: "Carpeta",
    tracesHint: "Elige el zip amprtrace de “Descargar trazas”, o una carpeta con ambos archivos de traza.",
    useOwn: "Usar las trazas del origen",
    patchResult: (a, n) => a === "patch"
      ? `Parcheado: el runtime de trazado está instalado; el índice enumera ${num(n)} ${plural(n, FILES)}.`
      : `Parche quitado: vuelve el runtime de lanzamiento; el índice enumera ${num(n)} ${plural(n, FILES)}.`,
    removed: (files) => `${plural(files.length, {
  one: "Se eliminó el archivo de traza antiguo",
  many: "Se eliminaron los archivos de traza antiguos",
  other: "Se eliminaron los archivos de traza antiguos",
})}: ${files.join(", ")}.`,
  },
  // Lz4Help.tsx
  lz4Help: {
    title: "Cómo funciona LZ4",
    close: "Cerrar",
    warning: "Experimental, solo para juegos con AMPR. Guarda una copia del juego original.",
    body: () => (
      <>
        <h3>1. Empaquetar/Desempaquetar</h3>
        <ol>
          <li>
            Elige el juego original, <b>Empaquetar/Desempaquetar</b> y las trazas (o un perfil).
          </li>
          <li>
            Crea una carpeta empaquetada o una imagen normal; una carpeta se convierte a cualquier formato en{" "}
            <b>Convertir</b>.
          </li>
          <li>
            Un origen empaquetado muestra <b>Desempaquetar</b> en su lugar: los archivos sueltos vuelven.
          </li>
        </ol>

        <h3>2. Trazado</h3>
        <ol>
          <li>
            Elige el <b>ffpkg</b> o el <b>exfat</b> del juego y luego <b>Trazado</b> → <b>Parchear</b>.
          </li>
          <li>Desactiva el actualizador de fakelib: sobrescribe el runtime de trazado.</li>
          <li>
            Móntalo con <span className="path">image_rw=</span>, juega una sesión y cierra el juego.
          </li>
          <li>
            Pulsa <b>Descargar trazas</b> en la página de la PS5, o copia ampr_commands.bin y ampr_emu.index.
          </li>
        </ol>
      </>
    ),
  },
  // Picker.tsx
  picker: {
    drives: "Unidades",
    location: "Ubicación",
    parent: "Carpeta superior",
    allDrives: "Todas las unidades",
    truncated: (n) => plural(n, {
  one: "Solo se muestra la primera entrada.",
  many: `Solo se muestran las primeras ${num(n)} entradas.`,
  other: `Solo se muestran las primeras ${num(n)} entradas.`,
}),
    loading: "Cargando",
    noDrives: "No se encontraron unidades.",
    noFolders: "No hay carpetas aquí.",
    noImages: "No hay carpetas, imágenes de PS5 ni archivos comprimidos aquí.",
    noFiles: (ext) => `No hay carpetas ni archivos ${dotted(ext, " o ")} aquí.`,
    cancel: "Cancelar",
    chooseFolder: "Elegir esta carpeta",
  },
  // common.tsx
  common: {
    folder: "Carpeta",
    pickFolder: "Carpeta del juego",
    pickImage: "Imagen o archivo comprimido del juego",
    pickImageFilter: "Imágenes y archivos comprimidos",
    pickFolderButton: "Carpeta",
    pickImageButton: "Imagen/Archivo comprimido",
    source: "Origen",
    emptyTitle: "Elige una carpeta, imagen o archivo comprimido de juego",
    emptyText: "Una carpeta de juego de PS5 o una imagen, paquete o archivo comprimido de ella.",
    accepted: "Orígenes admitidos",
    unknownTitle: "Título desconocido",
    reading: "Leyendo el origen",
    unreadable: "Origen ilegible",
    backport: "Backport",
    emulators: "Emuladores",
    declares: (fw) => `declara ${fw}`,
    fwUnknown: "firmware desconocido según sus ejecutables (no hay SDK legible)",
    emulatorList: (names) => `emuladores: ${names}`,
    otherEmulator: "Otro",
    sdk: (v) => `SDK ${v} (declarado)`,
    titleId: "ID del título",
    version: "Versión",
    firmware: "Firmware",
    fwDeclared: "declarado",
    fwBackport: "backport",
    fwExecutables: "ejecutables",
    size: "Tamaño",
    files: (n) => `${num(n)} ${plural(n, FILES)}`,
    contentId: "ID de contenido",
    noAmpr: "eboot.bin no importa libSceAmpr",
    runtime: {
      forge_release: "Forge de lanzamiento",
      forge_trace: "Forge de trazado",
      other: "otro",
      none: "ninguno",
    },
    packed: "Empaquetado",
    damaged: "Paquetes dañados",
    traced: "Trazado",
    plain: "Normal",
    packedDetail: (files, volumes, percent) =>
      `${num(files)} ${plural(files, FILES)} en ${num(volumes)} ${plural(volumes, { one: "volumen", many: "volúmenes", other: "volúmenes" })}` +
      (percent === null ? "" : `, ${num(percent)}% del tamaño`),
    journal: (size) => `registro de ${size}`,
    noJournal: "aún sin registro",
    runtimeIs: (label) => `runtime: ${label}`,
    backportLibs: (exclusive, n) =>
      `${exclusive ? "fakelib2/, montado por separado" : "fakelib/"}, ${num(n)} ${plural(n, { one: "biblioteca", many: "bibliotecas", other: "bibliotecas" })} de backport`,
    findings: "Avisos de la comprobación previa",
    dlcTitle: (n) => `DLC incluidos (${num(n)})`,
    dlcLabel: "DLC incluidos",
    dlcAll: (note) => `Cada DLC: ${note}.`,
    dlcIn: (folder, size) => `en ${folder}/, ${size}`,
    dlcNoData: "desbloqueado por el emulador de DLC (dlc_emu.ini): solo la licencia, sin datos propios",
    dlcStatus: (status) => `desbloqueado por el emulador de DLC (dlc_emu.ini), estado ${status || "sin definir"}`,
    dlcMerged: "integrado en las carpetas del juego",
    backportFiles: "Archivos del backport",
    emulatorsIn: "Emuladores en fakelib",
    qr: (url) => `Código QR: ${url}`,
    needsPassword: "Este archivo comprimido necesita una contraseña.",
    enterPassword: "Introducir contraseña",
    inArchive: (ext, size) => `en un archivo ${ext} · ${size}`,
    archive: "Archivo comprimido",
    parts: (n) => `${num(n)} ${plural(n, { one: "parte", many: "partes", other: "partes" })}`,
    archiveRoot: (root) => `juego en ${root}`,
    archiveAtRoot: "juego en la raíz del archivo",
    solid: "sólido",
    encrypted: "protegido con contraseña",
  },
  // delete.tsx
  delete: {
    title: (folder) => (folder ? "¿Eliminar esta carpeta?" : "¿Eliminar esta imagen?"),
    text: (folder) =>
      folder
        ? "La carpeta y todo su contenido se eliminarán para siempre: sin papelera ni forma de deshacerlo. Si la eliminación se detiene a medias, una parte puede haber desaparecido ya."
        : "El archivo de imagen se eliminará para siempre: sin papelera ni forma de deshacerlo. Si la eliminación se detiene a medias, una parte puede haber desaparecido ya.",
    no: "No",
    yes: "Sí, eliminar",
    archiveTitle: "¿Eliminar este archivo comprimido?",
    archiveText:
      "El archivo comprimido se eliminará para siempre: sin papelera ni forma de deshacerlo. Las demás partes de un archivo en varias partes se quedan como están.",
  },
  // password.tsx
  password: {
    title: "Este archivo comprimido necesita una contraseña",
    text: "Introduce su contraseña para abrirlo.",
    wrong: "La contraseña no es correcta.",
    label: "Contraseña",
    cancel: "Cancelar",
    unlock: "Desbloquear",
    checking: "Comprobando…",
  },
  // main-http.tsx
  launch: {
    failure: {
      loader:
        "No se puede contactar con el cargador de payloads en el puerto 9021. Ejecuta primero tu autoloader (jailbreak) y luego vuelve a abrir Dump Forge.",
      missing:
        "No se encontró ninguna copia guardada de Dump Forge (ni en /data/dumpforge/ ni en una unidad USB). Cárgalo una vez desde un PC; guardará una copia para este icono.",
      timeout:
        "Dump Forge se inició pero no ha respondido tras 30 segundos. Puede que aún se esté iniciando (una consola que sale del modo de reposo tarda más).",
      stopping: "El Dump Forge anterior todavía se está deteniendo (cancela sus trabajos y limpia). Espera un momento y vuelve a intentarlo.",
    },
    loadFailed: (e) => `No se pudo cargar la página: ${e}`,
    noAnswer: "Dump Forge no respondió",
    cantStart: "No se puede iniciar Dump Forge",
    retry: "Reintentar",
    starting: "Iniciando Dump Forge…",
    client: {
      unreachable:
        "No se puede contactar con Dump Forge. Comprueba que el payload sigue en ejecución y que este dispositivo está en la misma red.",
      noPlatform: "No se puede saber si Dump Forge se ejecuta en una PS5. Actualiza la página para volver a intentarlo.",
      quitUnreachable: "No se puede contactar con Dump Forge para detenerlo.",
      stillAnswering: "Dump Forge sigue respondiendo tras 2 minutos; revisa la PS5.",
      gone: "Dump Forge ya no informa de ella (salió de su historial de tareas antes de que se viera su resultado)",
    },
  },
  // target.tsx
  target: {
    format: {
      folder: { text: "Desempaqueta una imagen o un paquete de vuelta a una carpeta de juego normal." },
      exfat: {
        text: "Para juegos que fallan como ffpkg y solo funcionan como contenido de una unidad externa. También se abre en un Mac o PC.",
      },
      ffpkg: {
        tone: "good",
        text: "Recomendado. El sistema de archivos propio de la PS5 (UFS2). Admite montajes con escritura.",
      },
      ffpfs: {
        tone: "warn",
        text: "Experimental. El sistema de archivos PFS de la PS5, sin comprimir. Los nombres de archivo deben ser ASCII simple.",
      },
      ffpfsc: {
        tone: "warn",
        text: "Experimental. El más pequeño: un contenedor comprimido alrededor de una imagen, siempre montado en solo lectura.",
      },
      pkg: {
        text: "Se instala como un juego de la tienda y funciona a velocidad nativa. Necesita kstuff, fpkg-enable y ppr-patch.",
      },
      lz4: {
        tone: "warn",
        text: "Experimental. Una carpeta de juego con sus recursos empaquetados en volúmenes LZ4, que el emulador AMPR incluido (ampr_emu) desempaqueta mientras el juego se ejecuta. Solo para juegos que usan AMPR.",
      },
    },
    innerFfpkg: { tone: "good", text: "Recomendado. El sistema de archivos propio de la PS5 (UFS2)." },
    level0: { text: "Sin compresión: cada bloque se guarda tal cual. El archivo ocupa lo mismo que la imagen." },
    levelDefault: {
      tone: "good",
      text: "Recomendado: el valor por defecto de zlib. El nivel 1 crea unas 3 veces más rápido con un archivo un 3% más grande; el 9 apenas reduce el tamaño.",
    },
    levelLow: {
      text: "Crea más rápido que el 6 (el nivel 1, unas 3 veces); el archivo sale más grande (el nivel 1, un 3%).",
    },
    levelHigh: {
      text: "Apenas más pequeño que el 6 (el nivel 9, un 0,04%), pero comprimir tarda más (el nivel 9, un 25%), con todos los núcleos ocupados todo el tiempo.",
    },
    kraken: {
      fast: { label: "Rápido", note: { tone: "good", text: "Recomendado. La creación más rápida." } },
      balanced: {
        label: "Equilibrado",
        note: {
          text: "Un 2,6% más pequeño que “Rápido”, pero comprimir tarda unas 6 veces más, con todos los núcleos ocupados todo el tiempo.",
        },
      },
      smallest: {
        label: "Mínimo",
        note: {
          text: "Un 2,7% más pequeño que “Rápido”, pero comprimir tarda unas 9 veces más, con todos los núcleos ocupados todo el tiempo.",
        },
      },
      stored: {
        label: "Sin compresión",
        note: {
          text: "El paquete ocupa más o menos lo mismo que el juego. Pruébalo si un paquete comprimido se instala pero no arranca (se ha visto con firmware 8.60 y 10.40).",
        },
      },
    },
    pkgFirmware: "Solo funciona con firmware 11.60 o inferior.",
    imageInside: "Imagen interior",
    imageInsideLabel: "Imagen dentro del ffpfsc",
    compressionLevel: "Nivel de compresión",
    compression: "Compresión",
    fullVerify: "Verificación completa",
    fullVerifyHint: "Vuelve a leer cada byte para comprobar la salida. Tarda más.",
    separator: "Un nombre no puede contener un separador de carpetas; usa “Cambiar” para la carpeta.",
    badName: "Un nombre no puede estar vacío, empezar por un punto, terminar en punto o espacio, ni contener caracteres de control.",
    tooLong: (bytes, max, folder) =>
      folder
        ? `Demasiado largo: ${num(bytes)} B, como máximo ${num(max)} B (UTF-8).`
        : `Demasiado largo: ${num(bytes)} B antes de la extensión, como máximo ${num(max)} B (UTF-8).`,
    pkgExt: (ext) => `Termina en .${ext}, pero fpkg se guarda como .pkg: la extensión determina el controlador.`,
    otherExt: (ext, target) =>
      `Termina en .${ext}, pero el destino es ${target}: la extensión determina el controlador.`,
    extractInto: "Extraer en esta carpeta",
    saveInto: "Guardar en esta carpeta",
    output: "Salida",
    change: "Cambiar",
    naming: "Generando nombre…",
    chooseSourceFirst: "Elige primero un origen",
    fileName: "Nombre de archivo",
    savedAs: (name, dir) => `se guarda como ${name} en ${dir}`,
    inDir: (dir) => `en ${dir}`,
    generate: "Generar nombre según el contenido",
    generatePattern: "[nombre del juego]-[ID del título]",
  },
  tauri: { saveProfile: "Guardar como perfil", profileFilter: "Perfil LZ4 (TOML)" },
  duration: { s: (s) => `${s} s`, ms: (m, s) => `${m} min ${s} s`, hm: (h, m) => `${h} h ${m} min` },
};

export default es;
