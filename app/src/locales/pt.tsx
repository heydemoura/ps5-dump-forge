// Brazilian Portuguese. Typed as `Messages` (en.tsx's shape): tsc fails on a missing key.
// Terms: rastrear / rastreamento / rastreamentos (trace), empacotar / desempacotar (pack),
// aplicar patch / remover patch (patch), runtime (o runtime).

import { dotted, num, plural } from "../i18n";
import type { Messages } from "./en";

/** A flat image holds the game's files as they are: about as large as the game. */
const FLAT = "Igual ao tamanho do jogo";
const FILES = { one: "arquivo", many: "arquivos", other: "arquivos" };
const CHECKS = { one: "verificação", many: "verificações", other: "verificações" };

const pt: Messages = {
  // App.tsx
  app: {
    address: (url) => `Endereço: ${url}. Mostrar como conectar, com um QR code`,
    screens: "Telas",
    convert: "Converter",
    active: (n) => `, ${num(n)} ${plural(n, { one: "ativa", many: "ativas", other: "ativas" })}`,
    inspect: "Inspecionar",
    library: "Biblioteca",
    about: "Sobre",
    offline: "Sem conexão, tentando de novo…",
    stop: "Parar o Dump Forge",
    stillRunning: (n) =>
      n === 1 ? "Uma tarefa ainda está em execução" : `${num(n)} tarefas ainda estão em execução`,
    job: (id) => `Tarefa ${id}`,
    quitNote: (web, n) =>
      web
        ? n === 1
          ? "Parar o Dump Forge interrompe a tarefa e exclui a saída incompleta."
          : "Parar o Dump Forge interrompe as tarefas e exclui a saída incompleta."
        : n === 1
          ? "Sair interrompe a tarefa e exclui a saída incompleta."
          : "Sair interrompe as tarefas e exclui a saída incompleta.",
    keepRunning: "Continuar",
    stopAndQuit: (n) => (n === 1 ? "Parar a tarefa e sair" : "Parar as tarefas e sair"),
    stoppingJobs: "Parando as tarefas e limpando…",
    stoppingForge: "Parando o Dump Forge…",
    couldntStop: "Não foi possível parar o Dump Forge",
    close: "Fechar",
    tryAgain: "Tentar de novo",
    stopped: "O Dump Forge foi parado",
    startAgain: "Para continuar, inicie este app novamente.",
    github: (name) => `${name} no GitHub`,
    queued: "na fila",
    progress: (percent, left) => `${percent}% concluído${left ? `, tempo restante: ${left}` : ""}`,
  },
  // Convert.tsx
  convert: {
    target: "Destino",
    targetFormat: "Formato de destino",
    alreadyFolder: "a origem já é uma pasta",
    lz4Backport:
      "Os assets deste jogo estão empacotados com LZ4 e o manifesto LZ4 inclui o backport: desempacote o jogo na aba “LZ4” primeiro e depois remova o backport aqui.",
    lz4Trace:
      "Este jogo empacotado traz o runtime de rastreamento do LZ4: desempacote-o ou empacote-o de novo na aba “LZ4” primeiro.",
    unreadable: "Não é possível criar: esta origem não pôde ser lida (veja “Origem”).",
    blocked: (first, more) =>
      `Não é possível criar: ${first}${more > 0 ? ` (e mais ${num(more)}, veja “Origem”)` : ""}.`,
    runtime: "Atualizar AMPR",
    runtimeHint: "O ampr_emu deste jogo não é a versão mais recente.",
    removeBackport: "Remover backport",
    removeHint: (libs, emulators, other) =>
      `Omite de fakelib/ ${num(libs)} ${plural(libs, { one: "biblioteca", many: "bibliotecas", other: "bibliotecas" })} de backport` +
      (emulators.length === 0
        ? other
          ? "; as outras bibliotecas homebrew permanecem."
          : "."
        : `; ${emulators.length === 1 ? "o emulador" : "os emuladores"} (${emulators.join(", ")})${other ? " e as outras bibliotecas homebrew" : ""} ${emulators.length === 1 && !other ? "permanece" : "permanecem"}.`),
    cantRemove: (why) => `Não é possível remover o backport: ${why}`,
    compare: "Comparar formatos",
    build: "Criar",
    likelyFail: (fmt) => (
      <>
        Provavelmente vai falhar como <b>{fmt}</b>: esse formato recusa os nomes de arquivo listados em “Origem”.
      </>
    ),
    collides: "Uma tarefa já está gravando este arquivo: clicar em “Criar” de novo vai falhar. Escolha outro nome.",
    already: (fmt) => (
      <>
        Este jogo já está sendo criado como <b>{fmt}</b>; clicar em “Criar” de novo gera uma segunda cópia.
      </>
    ),
  },
  // Formats.tsx
  formats: {
    rating: { good: "Bom", ok: "Meio-termo", bad: "Desvantagem" },
    columns: ["Velocidade no console", "Tamanho em disco"],
    rows: {
      pkg: {
        tagline: "O melhor, se o firmware permitir",
        cells: ["Nativa, velocidade total", "30–60% menor, dependendo do jogo"],
      },
      lz4: {
        tagline: "Experimental, para jogos que usam AMPR",
        cells: ["Carregamento 30–40% mais rápido, segundo os autores", "Cerca de metade do tamanho do jogo, segundo os autores"],
      },
      ffpkg: { tagline: "Recomendado para o ShadowMountPlus", cells: ["Velocidade total de imagem", FLAT] },
      exfat: { tagline: "Compatibilidade", cells: ["Velocidade total de imagem", FLAT] },
      ffpfs: { tagline: "Experimental", cells: ["Velocidade total de imagem", FLAT] },
      ffpfsc: {
        tagline: "O menor, experimental",
        cells: ["150–250 MB/s, pode engasgar", "Depende do nível de compressão, geralmente 30–60% menor"],
      },
      folder: { tagline: "Arquivos comuns do jogo", cells: ["Velocidade total da unidade", FLAT] },
    },
    features: [
      ["Converter", "entre pasta, ffpkg, exfat, ffpfs, ffpfsc e fpkg, nos dois sentidos."],
      ["Inspecionar", "a capa, o firmware, o backport, os DLCs e os problemas de nomes de arquivo de um jogo antes de criar."],
      ["Verificar", "cada saída depois da gravação: uma amostra rápida por padrão, cada byte se você pedir."],
      ["Excluir", "um jogo do disco, depois da sua confirmação."],
      ["LZ4", "rastrear um jogo AMPR e depois empacotar os assets dele (experimental)."],
      ["Runtime AMPR", "instalar ou atualizar o ampr_emu na cópia convertida."],
      ["Payload para PS5", "o mesmo app no console, aberto de qualquer dispositivo da sua rede."],
    ],
    howToConnect: "Como conectar",
    connectText: (url) => (
      <>Abra {url} em um navegador de qualquer dispositivo da sua rede local ou escaneie este código.</>
    ),
    close: "Fechar",
    about: "Sobre",
    aboutText: "Esta ferramenta converte um jogo de qualquer formato para qualquer outro, em qualquer plataforma, inclusive no PS5.",
    connectAny: "Como conectar de qualquer dispositivo",
    useAddress: (url) => <>Use {url} ou escaneie este código.</>,
    compare: "Comparar formatos",
    compareLabel: "Comparação de formatos",
    format: "Formato",
    upstream: (app) =>
      `Números dos autores: o que os autores do ampr_emu e do Lazy_AMPR relatam, sem medição do ${app}; variam de jogo para jogo. O ampr_emu 0.4.2.1 é uma versão de teste dos autores; problema conhecido: alguns jogos travam ao salvar.`,
    bundled: "Pastas empacotadas com LZ4 rodam no ampr_emu 0.4.2.1 de drakmor (GPL-3.0), incluído sem modificações. Código-fonte:",
    lazy: "O fluxo “rastrear e depois empacotar” segue o Lazy_AMPR de Nazky:",
    unrar:
      "Arquivos .rar são lidos com a biblioteca UnRAR incluída, de Alexander Roshal (só extração, sob a licença do UnRAR).",
    language: "Idioma",
    system: "Sistema",
  },
  // Inspect.tsx
  inspect: {
    files: "Arquivos",
    details: "Detalhes",
    deleting: "Excluindo a origem…",
    delete: "Excluir a origem",
    deleted: "Excluído:",
    contents: "Conteúdo da origem",
    filter: "Filtrar por caminho",
    filterLabel: "Filtrar arquivos por caminho",
    firstOf: (max, n) => `exibindo ${num(max)} de ${num(n)}, a partir do início`,
    fileCount: (n) => `${num(n)} ${plural(n, FILES)}`,
    noMatch: (f) => `Nenhum arquivo corresponde a “${f}”.`,
    noListing: "A lista de arquivos do arquivo compactado não é suportada.",
    emptyDirs: (n) => `Pastas vazias (${num(n)})`,
    noParam: "Sem sce_sys/param.json.",
    reader: "Leitor",
    leftovers: "Arquivos e pastas restantes",
    found: (n) => `${num(n)} ${plural(n, { one: "encontrado", many: "encontrados", other: "encontrados" })}`,
    leftoversNote: (app) =>
      `Saídas incompletas e arquivos compactados extraídos, geralmente de tarefas interrompidas. Remova só as que você reconhecer, e só quando nenhuma tarefa estiver em execução; o ${app} nunca as exclui sozinho.`,
    checked: (n) => `Pastas verificadas (${num(n)})`,
  },
  // JobList.tsx
  jobs: {
    jobs: "Tarefas",
    pending: (n) => `${num(n)} em execução ou na fila`,
    allFinished: "todas concluídas",
    stages: {
      scan: "Lendo a origem",
      preflight: "Conferindo",
      check: "Conferindo",
      plan: "Planejando",
      compress: "Comprimindo",
      write: "Gravando",
      measure: "Medindo os pacotes",
      pack: "Empacotando",
      verify: "Verificando",
      finalize: "Finalizando",
    },
    steps: {
      scan: "Leitura",
      preflight: "Conferência",
      check: "Conferência",
      plan: "Planejamento",
      compress: "Compressão",
      write: "Gravação",
      measure: "Medição",
      pack: "Empacotamento",
      verify: "Verificação",
      finalize: "Finalização",
    },
    stepsLabel: "Etapas",
    stepDone: (s) => `Concluído: ${s}`,
    stepLater: (s) => `Ainda não iniciado: ${s}`,
    packingWriting: "Empacotando e gravando",
    rate: { read: "leitura", compress: "compressão", pack: "empacotamento", write: "gravação" },
    showPath: "Mostrar caminho",
    showFinder: "Mostrar no Finder",
    showExplorer: "Mostrar no Explorer",
    showFolder: "Mostrar na pasta",
    lz4: {
      pack: "LZ4: empacotar",
      unpack: "LZ4: desempacotar",
      trace: "LZ4: rastrear",
      unpatch: "LZ4: remover patch",
      runtime: "Runtime AMPR",
    },
    job: (id) => `Tarefa ${id}`,
    done: "Concluída",
    cancelled: "Cancelada",
    failed: "Falhou",
    cancelling: "Cancelando…",
    queued: "Na fila",
    dismiss: "Ocultar",
    stopJob: "Parar tarefa?",
    cancel: "Cancelar",
    stopHint: "Clique em “Parar tarefa?” de novo em até 4 segundos para pará-la.",
    from: "de ",
    left: (d) => `tempo restante: ${d}`,
    inStep: (time) => `${time} nesta etapa`,
    result: (bytes, n) => `${bytes}, ${num(n)} ${plural(n, FILES)} →`,
    outputPath: "Caminho da saída",
    checks: "Verificações",
    verifiedPlain: (n) =>
      `Verificado: ${num(n)} ${plural(n, { one: "verificação aprovada", many: "verificações aprovadas", other: "verificações aprovadas" })}`,
    verifiedFull: (n) => `Verificação completa aprovada: ${num(n)} ${plural(n, CHECKS)}`,
    verifiedFast: (n) => `Verificação rápida aprovada: ${num(n)} ${plural(n, CHECKS)}`,
    coverage: (checked, total, n) =>
      `Dados verificados: ${checked} de ${total} em ${num(n)} ${plural(n, { one: "amostra", many: "amostras", other: "amostras" })}`,
    cantBuild: "Não é possível criar este jogo:",
    cantBuildAs: (f) => (
      <>
        Não é possível criar este jogo como <b>{f}</b>:
      </>
    ),
    log: (n) => `Log (${num(n)})`,
    logLabel: "Log",
  },
  // Library.tsx
  library: {
    pickTitle: "Escolha uma pasta para a Biblioteca",
    scanningIn: (name) => `Escaneando ${name}`,
    scanning: "Escaneando",
    cantScanFolder: "Não é possível escanear esta pasta",
    chooseAnother: "Escolher outra pasta…",
    pickPrompt: "Escolha uma pasta com a sua biblioteca para escanear",
    choose: "Escolher pasta…",
    cantScan: "Não é possível escanear a Biblioteca:",
    cantDelete: "Não é possível excluir:",
    deleted: (path) => `Excluído: ${path}`,
    truncated: "Limite de escaneamento atingido. Esta lista pode estar incompleta.",
    limits: "A busca para em seis níveis de pastas e depois de cerca de 15 segundos de escaneamento.",
    noRoots: "Não há pastas disponíveis para escanear.",
    none: "Nenhum jogo encontrado. A busca vai até seis níveis de profundidade e ignora pastas do sistema. Outras origens ainda podem ser escolhidas em “Inspecionar” ou “Converter”.",
    skipped: "Locais e arquivos ignorados",
    stays: "Os resultados ficam aqui até você clicar em “Atualizar”. Novas saídas aparecem depois de atualizar.",
    library: "Biblioteca",
    storageTip: "Espaço livre no armazenamento interno do console (/data), no último escaneamento",
    free: (free, total) => (
      <>
        Espaço livre: <b>{free}</b> de {total}
      </>
    ),
    refresh: "Atualizar",
    cards: "Exibição em cartões",
    list: "Exibição em lista",
    games: "Jogos",
    inspect: (n) => `Inspecionar ${n}`,
    convert: (n) => `Converter ${n}`,
    remove: (n) => `Excluir ${n}`,
    lz4Tip: "Empacotado com LZ4: pacotes de assets do ampr_emu",
    lz4Packed: " empacotado",
  },
  // Lz4.tsx
  lz4: {
    title: "Pacotes de assets LZ4",
    help: "Como o LZ4 funciona",
    scenario: "Cenário LZ4",
    scenarios: { trace: "Rastrear", pack: "Empacotar/Desempacotar" },
    actions: { patch: "Aplicar patch", unpatch: "Remover patch", pack: "Empacotar", unpack: "Desempacotar" },
    scenarioInfo: (s, packed) => s === "trace"
      ? "Registra quais assets o jogo lê enquanto você joga, para uso em “Empacotar”."
      : packed
        ? "Grava os pacotes LZ4 do jogo de volta como arquivos comuns."
        : "Empacota os assets do jogo em volumes LZ4 que o ampr_emu lê enquanto o jogo roda.",
    traceInfo: (a, image) => a === "patch"
      ? image
        ? "Recria esta imagem com o runtime de rastreamento e depois a substitui."
        : "Instala o runtime de rastreamento nesta pasta."
      : image
        ? "Recria esta imagem com o runtime de release e depois a substitui."
        : "Devolve o runtime de release a esta pasta.",
    noAmpr: "o jogo não usa AMPR",
    noRuntime: "o jogo não tem ampr_emu",
    noRuntimeWarn: "Este jogo não tem ampr_emu, então o LZ4 não pode convertê-lo.",
    packedFirst: "a origem está empacotada com LZ4: desempacote-a primeiro",
    damaged: "os pacotes LZ4 dela estão danificados",
    archive: "não é possível rastrear um arquivo compactado: converta-o primeiro",
    chooseFirst: "escolha uma origem primeiro",
    notRead: "a origem ainda não foi lida",
    pickProfile: "Perfil LZ4",
    profileFilter: "Perfil LZ4 (TOML)",
    pickTracesFolder: "Rastreamentos LZ4 (uma pasta com ampr_commands.bin e ampr_emu.index)",
    pickTracesEither: "Rastreamentos LZ4: o zip ou uma pasta com os dois arquivos",
    pickTracesZip: "Rastreamentos LZ4 (zip)",
    unreadable: "Não é possível iniciar: esta origem não pôde ser lida (veja “Origem”).",
    pending: (a) => a === "patch"
      ? "Não é possível aplicar o patch com tarefas em execução ou na fila."
      : "Não é possível remover o patch com tarefas em execução ou na fila.",
    replacing: "Uma tarefa já está recriando esta imagem: aguarde até ela terminar.",
    blocked: (a, first, more) =>
      `Não é possível ${a === "patch" ? "aplicar o patch" : a === "unpatch" ? "remover o patch" : a === "pack" ? "empacotar" : "desempacotar"}: ${first}${more > 0 ? ` (e mais ${num(more)}, veja “Origem”)` : ""}.`,
    chooseGame: "Escolha primeiro uma pasta de jogo ou uma imagem.",
    nothing: "Nada a fazer: este jogo não usa AMPR e não está empacotado com LZ4.",
    unavailable: (items) => `Indisponível para esta origem: ${items.join("; ")}.`,
    readOnly: (kind) => <>
      <b>{kind}</b> é somente leitura no console, então não pode ser rastreado. Converta-o primeiro para <b>ffpkg</b> ou <b>exfat</b>.
    </>,
    action: "Ação",
    traceAction: "Ação de rastreamento",
    changes: (a, image) => a === "patch"
      ? `Altera ${image ? "esta imagem" : "esta pasta"}: o runtime de rastreamento substitui fakelib/libSceAmpr.sprx, sem backup.`
      : `Altera ${image ? "esta imagem" : "esta pasta"}: o runtime de release volta e os rastreamentos são excluídos, sem backup.`,
    replay: (web) => `Jogue e depois escolha esta origem de novo para usar os rastreamentos dela.${web ? " “Rastrear” também os oferece como zip." : ""}`,
    room: "Espaço para o rastreamento",
    roomHint: "Espaço livre para o rastreamento do jogo. Monte a imagem com image_rw=, ou nada será gravado.",
    alreadyRelease: "Já está no runtime de release: só o índice é gravado de novo.",
    spaceHint: "Precisa de espaço livre do tamanho da imagem; ela só é substituída depois que a cópia é verificada.",
    deletesTraces: (a, bytes, web) =>
      `${a === "patch" ? "“Aplicar patch”" : "“Remover patch”"} exclui os rastreamentos desta origem (${bytes}): ${web ? "baixe-os antes." : "copie-os antes."}`,
    useProfile: "Usar um perfil de regras em vez disso",
    profile: "Perfil",
    choose: "Escolher…",
    profileHint: "Um arquivo TOML com regras de empacotamento, usado no lugar dos rastreamentos.",
    target: "Destino",
    packInto: "Empacotar em",
    direct: "Empacota direto na imagem; os arquivos do jogo são lidos duas vezes.",
    targetFormat: "Formato de destino",
    unpackFolder: "Uma nova pasta do jogo com os pacotes gravados de volta como arquivos comuns.",
    unpackHint: (n) =>
      n === null
        ? "Grava os arquivos empacotados de volta como arquivos comuns."
        : `Grava de volta ${num(n)} ${plural(n, { one: "arquivo empacotado como arquivo comum", many: "arquivos empacotados como arquivos comuns", other: "arquivos empacotados como arquivos comuns" })}.`,
    waitJobs: "Aguarde as tarefas em execução terminarem",
    saveHint: "Salvar a lista de arquivos de “Empacotar” como um perfil de regras editável",
    saving: "Salvando…",
    saveProfile: "Salvar como perfil",
    saved: (name, packed, loose) =>
      `${name} salvo: ${num(packed)} ${plural(packed, { one: "arquivo empacotado", many: "arquivos empacotados", other: "arquivos empacotados" })}, ${num(loose)} ${plural(loose, { one: "solto", many: "soltos", other: "soltos" })}.`,
    likelyFail: (fmt) => <>
      Provavelmente vai falhar como <b>{fmt}</b>: esse formato recusa os nomes de arquivo listados em “Origem”.
    </>,
    collides: (a, folder) =>
      `Uma tarefa já está gravando ${folder ? "esta pasta" : "este arquivo"}: ${a === "pack" ? "“Empacotar”" : "“Desempacotar”"} precisa de outro nome.`,
    already: (a, fmt) => <>
      Este jogo já está sendo gravado como <b>{fmt}</b>; clicar em {a === "pack" ? "“Empacotar”" : "“Desempacotar”"} de novo gera uma segunda cópia.
    </>,
    profileRules: "Empacota o que as regras do perfil indicam; os arquivos que a engine abre diretamente ficam soltos.",
    chosenRules: "Empacota os arquivos que o jogo leu nestes rastreamentos; os arquivos que a engine abre diretamente ficam soltos.",
    ownRules: "Empacota os arquivos que o jogo leu na última sessão rastreada; os arquivos que a engine abre diretamente ficam soltos.",
    guessRules: "Sem rastreamentos: empacota por uma estimativa embutida, menos confiável. Rastreie primeiro ou escolha rastreamentos ou um perfil.",
    recorded: "Rastreamentos gravados",
    recordedHint: (bytes) => `ampr_commands.bin (${bytes}): “Empacotar” usa esses rastreamentos.`,
    downloadHint: "Feche o jogo, espere um minuto e baixe pelo navegador de um computador. Lá, escolha o zip em “Empacotar/Desempacotar” → “Rastreamentos”.",
    download: (bytes, zip) => `Baixar rastreamentos (${bytes}) como ${zip}`,
    missingIndex: "Não há ampr_emu.index nesta origem: “Empacotar” precisa dele ao lado de ampr_commands.bin.",
    truncatedJournal: "Um diário cortado no final ainda pode ser empacotado, até o último registro completo.",
    fakelibWarning: (recorded) => recorded
      ? "Poucos rastreamentos ou nenhum? Desative o atualizador da fakelib, aplique o patch de novo e jogue outra vez."
      : "Desative o atualizador da fakelib durante o rastreamento, ou nada será gravado.",
    emptyTitle: "Escolha um jogo que use AMPR",
    experimental: "Experimental: guarde uma cópia do jogo original.",
    chooseSource: "Escolher origem",
    source: "Origem",
    traces: "Rastreamentos",
    optionalTraces: "Rastreamentos (opcional)",
    unlock: "Desbloquear para escolher outros rastreamentos",
    loaded: "Os rastreamentos já foram carregados desta origem",
    lockedHint: (bytes) => `Os rastreamentos desta origem (${bytes}). Clique no cadeado para escolher outros.`,
    clear: "Limpar",
    zip: "Zip…",
    folder: "Pasta…",
    tracesHint: "Escolha o zip amprtrace de “Baixar rastreamentos” ou uma pasta com os dois arquivos de rastreamento.",
    useOwn: "Usar os rastreamentos da origem",
    patchResult: (a, n) =>
      a === "patch"
        ? `Patch aplicado: o runtime de rastreamento está instalado; o índice lista ${num(n)} ${plural(n, FILES)}.`
        : `Patch removido: o runtime de release voltou; o índice lista ${num(n)} ${plural(n, FILES)}.`,
    removed: (files) => `Arquivos de rastreamento antigos removidos: ${files.join(", ")}.`,
  },
  // Lz4Help.tsx
  lz4Help: {
    title: "Como o LZ4 funciona",
    close: "Fechar",
    warning: "Experimental, só para jogos AMPR. Guarde uma cópia do jogo original.",
    body: () => (
      <>
        <h3>1. Empacotar/Desempacotar</h3>
        <ol>
          <li>
            Escolha o jogo original, <b>Empacotar/Desempacotar</b> e os rastreamentos (ou um perfil).
          </li>
          <li>
            Grave uma pasta empacotada ou uma imagem comum; uma pasta pode ser convertida para qualquer formato em{" "}
            <b>Converter</b>.
          </li>
          <li>
            Uma origem empacotada mostra <b>Desempacotar</b> no lugar: os arquivos soltos voltam.
          </li>
        </ol>

        <h3>2. Rastrear</h3>
        <ol>
          <li>
            Escolha o <b>ffpkg</b> ou o <b>exfat</b> do jogo e depois <b>Rastrear</b> → <b>Aplicar patch</b>.
          </li>
          <li>Desative o atualizador da fakelib: ele sobrescreve o runtime de rastreamento.</li>
          <li>
            Monte com <span className="path">image_rw=</span>, jogue uma sessão e feche o jogo.
          </li>
          <li>
            Use <b>Baixar rastreamentos</b> na página do PS5 ou copie ampr_commands.bin e ampr_emu.index.
          </li>
        </ol>
      </>
    ),
  },
  // Picker.tsx
  picker: {
    drives: "Unidades",
    location: "Local",
    parent: "Pasta acima",
    allDrives: "Todas as unidades",
    truncated: (n) => `Exibição limitada a ${num(n)} ${plural(n, { one: "entrada", many: "entradas", other: "entradas" })} do início da lista.`,
    loading: "Carregando",
    noDrives: "Nenhuma unidade encontrada.",
    noFolders: "Nenhuma pasta aqui.",
    noImages: "Nenhuma pasta, imagem de PS5 ou arquivo compactado aqui.",
    noFiles: (ext) => `Nenhuma pasta ou arquivo ${dotted(ext, " ou ")} aqui.`,
    cancel: "Cancelar",
    chooseFolder: "Escolher esta pasta",
  },
  // common.tsx
  common: {
    folder: "Pasta",
    pickFolder: "Pasta do jogo",
    pickImage: "Imagem ou arquivo compactado do jogo",
    pickImageFilter: "Imagens e arquivos compactados",
    pickFolderButton: "Pasta",
    pickImageButton: "Imagem/Arquivo compactado",
    source: "Origem",
    emptyTitle: "Escolha uma pasta, imagem ou arquivo compactado de jogo",
    emptyText: "Uma pasta de jogo de PS5 ou uma imagem, pacote ou arquivo compactado dela.",
    accepted: "Origens aceitas",
    unknownTitle: "Título desconhecido",
    reading: "Lendo a origem",
    unreadable: "Origem ilegível",
    backport: "Backport",
    emulators: "Emuladores",
    declares: (fw) => `declara ${fw}`,
    fwUnknown: "não foi possível determinar o firmware a partir dos executáveis (nenhum SDK legível)",
    emulatorList: (names) => `emuladores: ${names}`,
    otherEmulator: "Outro",
    sdk: (v) => `SDK ${v} (declarado)`,
    titleId: "ID do título",
    version: "Versão",
    firmware: "Firmware",
    fwDeclared: "declarado",
    fwBackport: "backport",
    fwExecutables: "executáveis",
    size: "Tamanho",
    files: (n) => `${num(n)} ${plural(n, FILES)}`,
    contentId: "ID do conteúdo",
    noAmpr: "eboot.bin não importa libSceAmpr",
    runtime: {
      forge_release: "de release do Forge",
      forge_trace: "de rastreamento do Forge",
      other: "outro",
      none: "nenhum",
    },
    packed: "Empacotado",
    damaged: "Pacotes danificados",
    traced: "Rastreado",
    plain: "Não empacotado",
    packedDetail: (files, volumes, percent) =>
      `${num(files)} ${plural(files, FILES)} em ${num(volumes)} ${plural(volumes, { one: "volume", many: "volumes", other: "volumes" })}` +
      (percent === null ? "" : `, ${num(percent)}% do tamanho`),
    journal: (size) => `diário de ${size}`,
    noJournal: "ainda sem diário",
    runtimeIs: (label) => `runtime ${label}`,
    backportLibs: (exclusive, n) =>
      `${exclusive ? "fakelib2/, montado sozinho" : "fakelib/"}, ${num(n)} ${plural(n, { one: "biblioteca", many: "bibliotecas", other: "bibliotecas" })} de backport`,
    findings: "Avisos da pré-verificação",
    dlcTitle: (n) => `DLCs embutidos (${num(n)})`,
    dlcLabel: "DLCs embutidos",
    dlcAll: (note) => `Todos os DLCs: ${note}.`,
    dlcIn: (folder, size) => `em ${folder}/, ${size}`,
    dlcNoData: "acesso liberado pelo emulador de DLC (dlc_emu.ini): só a licença, sem dados próprios",
    dlcStatus: (status) => `acesso liberado pelo emulador de DLC (dlc_emu.ini), status ${status || "não definido"}`,
    dlcMerged: "conteúdo mesclado às pastas do jogo",
    backportFiles: "Arquivos do backport",
    emulatorsIn: "Emuladores na fakelib",
    qr: (url) => `QR code: ${url}`,
    needsPassword: "Este arquivo compactado precisa de uma senha.",
    enterPassword: "Digitar senha",
    inArchive: (ext, size) => `em um arquivo ${ext} · ${size}`,
    archive: "Arquivo compactado",
    parts: (n) => `${num(n)} ${plural(n, { one: "parte", many: "partes", other: "partes" })}`,
    archiveRoot: (root) => `jogo em ${root}`,
    archiveAtRoot: "jogo na raiz do arquivo",
    solid: "sólido",
    encrypted: "protegido por senha",
  },
  // delete.tsx
  delete: {
    title: (folder) => (folder ? "Excluir esta pasta?" : "Excluir esta imagem?"),
    text: (folder) =>
      folder
        ? "A pasta e tudo o que há nela serão excluídos para sempre: sem Lixeira, sem desfazer. Se a exclusão parar no meio, parte do conteúdo pode já ter sido apagada."
        : "O arquivo de imagem será excluído para sempre: sem Lixeira, sem desfazer. Se a exclusão parar no meio, parte dele pode já ter sido apagada.",
    no: "Não",
    yes: "Sim, excluir",
    archiveTitle: "Excluir este arquivo compactado?",
    archiveText:
      "O arquivo compactado será excluído para sempre: sem Lixeira, sem desfazer. As outras partes de um arquivo em várias partes ficam como estão.",
  },
  // password.tsx
  password: {
    title: "Este arquivo compactado precisa de uma senha",
    text: "Digite a senha para abri-lo.",
    wrong: "A senha não está correta.",
    label: "Senha",
    cancel: "Cancelar",
    unlock: "Desbloquear",
    checking: "Verificando…",
  },
  // main-http.tsx
  launch: {
    failure: {
      loader:
        "Não foi possível acessar o carregador de payloads na porta 9021. Execute seu autoloader (jailbreak) primeiro e depois abra o Dump Forge de novo.",
      missing:
        "Nenhuma cópia salva do Dump Forge foi encontrada (em /data/dumpforge/ ou em uma unidade USB). Carregue-o uma vez a partir de um PC; ele salva uma cópia para este ícone.",
      timeout:
        "O Dump Forge foi iniciado, mas não respondeu depois de 30 segundos. Ele ainda pode estar iniciando (um console saindo do modo de repouso é lento).",
    },
    loadFailed: (e) => `Não foi possível carregar a página: ${e}`,
    noAnswer: "O Dump Forge não respondeu",
    cantStart: "Não foi possível iniciar o Dump Forge",
    retry: "Tentar de novo",
    starting: "Iniciando o Dump Forge…",
    client: {
      unreachable:
        "Não foi possível acessar o Dump Forge. Verifique se o payload ainda está em execução e se este dispositivo está na mesma rede.",
      noPlatform: "Não foi possível determinar se o Dump Forge está rodando em um PS5. Atualize a página para tentar de novo.",
      quitUnreachable: "Não foi possível acessar o Dump Forge para pará-lo.",
      stillAnswering: "O Dump Forge ainda está respondendo depois de 2 minutos; verifique o PS5.",
      gone: "o Dump Forge não informa mais esta tarefa (ela saiu do histórico de tarefas antes de o resultado ser visto)",
    },
  },
  // target.tsx
  target: {
    format: {
      folder: { text: "Desempacota uma imagem ou um pacote de volta em uma pasta comum de jogo." },
      exfat: {
        text: "Para jogos que dão problema como ffpkg e só rodam como conteúdo de unidade externa. Também abre em um Mac ou PC.",
      },
      ffpkg: {
        tone: "good",
        text: "Recomendado. O sistema de arquivos próprio do PS5 (UFS2). Permite montagem com gravação.",
      },
      ffpfs: {
        tone: "warn",
        text: "Experimental. O sistema de arquivos PFS do PS5, sem compressão. Os nomes de arquivo precisam ser ASCII simples.",
      },
      ffpfsc: {
        tone: "warn",
        text: "Experimental. O menor: um contêiner comprimido em torno de uma imagem, sempre montado como somente leitura.",
      },
      pkg: {
        text: "Instala como um jogo da loja e roda na velocidade nativa. Requer kstuff, fpkg-enable e ppr-patch.",
      },
      lz4: {
        tone: "warn",
        text: "Experimental. Uma pasta de jogo com os assets empacotados em volumes LZ4, que o emulador AMPR incluído (ampr_emu) desempacota enquanto o jogo roda. Só para jogos que usam AMPR.",
      },
    },
    innerFfpkg: { tone: "good", text: "Recomendado. O sistema de arquivos próprio do PS5 (UFS2)." },
    level0: { text: "Sem compressão: cada bloco é armazenado como está. O arquivo fica do tamanho da imagem." },
    levelDefault: {
      tone: "good",
      text: "Recomendado: é o padrão do zlib. O nível 1 cria cerca de 3× mais rápido, com um arquivo cerca de 3% maior; o nível 9 gera um arquivo só um pouco menor.",
    },
    levelLow: {
      text: "Cria mais rápido que o 6 (nível 1: cerca de 3×); o arquivo sai maior (nível 1: cerca de 3%).",
    },
    levelHigh: {
      text: "Quase do mesmo tamanho que o 6 (nível 9: 0,04% menor), mas a compressão demora mais (nível 9: cerca de 25%), com todos os núcleos ocupados o tempo todo.",
    },
    kraken: {
      fast: { label: "Rápido", note: { tone: "good", text: "Recomendado. A criação mais rápida." } },
      balanced: {
        label: "Equilibrado",
        note: {
          text: "Cerca de 2,6% menor que “Rápido”, mas a compressão leva cerca de 6× mais tempo, com todos os núcleos ocupados o tempo todo.",
        },
      },
      smallest: {
        label: "Menor",
        note: {
          text: "Cerca de 2,7% menor que “Rápido”, mas a compressão leva cerca de 9× mais tempo, com todos os núcleos ocupados o tempo todo.",
        },
      },
      stored: {
        label: "Sem compressão",
        note: {
          text: "O pacote fica mais ou menos do tamanho do jogo. Tente se um pacote comprimido instala mas não inicia (relatado nos firmwares 8.60 e 10.40).",
        },
      },
    },
    pkgFirmware: "Funciona só no firmware 11.60 ou anterior.",
    imageInside: "Imagem interna",
    imageInsideLabel: "Imagem dentro do ffpfsc",
    compressionLevel: "Nível de compressão",
    compression: "Compressão",
    fullVerify: "Verificação completa",
    fullVerifyHint: "Relê cada byte para verificar a saída. Demora mais.",
    separator: "Um nome não pode conter separador de pastas; use “Alterar…” para a pasta.",
    tooLong: (bytes, max, folder) =>
      folder
        ? `Longo demais: ${num(bytes)} ${plural(bytes, { one: "byte", many: "bytes", other: "bytes" })}, no máximo ${num(max)} (UTF-8).`
        : `Longo demais: ${num(bytes)} ${plural(bytes, { one: "byte", many: "bytes", other: "bytes" })} antes da extensão, no máximo ${num(max)} (UTF-8).`,
    pkgExt: (ext) => `Termina em .${ext}, mas fpkg é salvo como .pkg: a extensão escolhe o driver.`,
    otherExt: (ext, target) => `Termina em .${ext}, mas o destino é ${target}: a extensão escolhe o driver.`,
    extractInto: "Extrair nesta pasta",
    saveInto: "Salvar nesta pasta",
    output: "Saída",
    change: "Alterar…",
    naming: "Gerando o nome…",
    chooseSourceFirst: "Escolha uma origem primeiro",
    fileName: "Nome do arquivo",
    savedAs: (name, dir) => `salvo como ${name} em ${dir}`,
    inDir: (dir) => `em ${dir}`,
    generate: "Gerar o nome pelo conteúdo",
    generatePattern: "[nome do jogo]-[ID do título]",
  },
  // transport-tauri.tsx: the native save dialog
  tauri: { saveProfile: "Salvar como perfil", profileFilter: "Perfil LZ4 (TOML)" },
  // api.ts: prettyDuration's units
  duration: { s: (s) => `${s} s`, ms: (m, s) => `${m} min ${s} s`, hm: (h, m) => `${h} h ${m} min` },
};

export default pt;
