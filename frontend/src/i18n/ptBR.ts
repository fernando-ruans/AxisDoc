export const ptBR = {
  app: {
    name: 'AxisDoc',
    tagline: 'Kit de ferramentas de escritório — 100% offline',
    search: 'Buscar ferramentas… (Ctrl+K)',
    theme: 'Alternar tema',
    noTools: 'Nenhuma ferramenta encontrada',
  },
  category: {
    security: 'Segurança',
    pdf: 'PDF',
    image: 'Imagens',
    data: 'Dados',
    text: 'Texto',
    search: 'Busca',
    ocr: 'OCR',
  },
  tool: {
    hashfile: {
      title: 'Hash de arquivos',
      desc: 'Calcula MD5, SHA-1, SHA-256, SHA-512 ou CRC-32 de arquivos',
      pick: 'Selecionar arquivos',
      algorithm: 'Algoritmo',
      saveOutput: 'Salvar resultado em arquivo',
      run: 'Calcular hashes',
    },
    pdfinfo: {
      title: 'Informações de PDF',
      desc: 'Mostra páginas, versão e criptografia dos PDFs',
    },
    pdfmerge: {
      title: 'Mesclar PDFs',
      desc: 'Junta vários PDFs em um único arquivo',
    },
    pdfsplit: {
      title: 'Dividir PDF',
      desc: 'Divide um PDF por páginas ou em blocos',
    },
    pdfrotate: {
      title: 'Girar PDF',
      desc: 'Gira todas as páginas em 90°, 180° ou 270°',
    },
    pdfwm: {
      title: 'Marca d\'água em PDF',
      desc: 'Aplica marca d\'água de texto diagonal',
    },
    pdfcompress: {
      title: 'Comprimir PDF',
      desc: 'Otimiza e reduz o tamanho do PDF',
    },
    pdfextract: {
      title: 'Extrair texto de PDF',
      desc: 'Extrai o conteúdo de texto de PDFs',
    },
    imgconvert: {
      title: 'Converter imagens',
      desc: 'Converte entre JPG, PNG, GIF, BMP e TIFF em lote',
    },
    imgresize: {
      title: 'Redimensionar imagens',
      desc: 'Redimensiona imagens em lote mantendo proporção',
    },
    imgwm: {
      title: 'Marca d\'água em imagens',
      desc: 'Aplica marca d\'água de texto sobre imagens',
    },
    tabular: {
      title: 'Converter tabela',
      desc: 'Converte entre CSV e XLSX',
    },
    xlsxdiff: {
      title: 'Comparar planilhas',
      desc: 'Compara duas planilhas célula a célula',
    },
    struct: {
      title: 'Converter estrutura',
      desc: 'Converte entre JSON, YAML e TOML',
    },
    jsonformat: {
      title: 'Formatar JSON',
      desc: 'Formata ou minifica arquivos JSON',
    },
    tablejson: {
      title: 'Tabela para JSON',
      desc: 'Converte CSV/XLSX em JSON',
    },
    diff: {
      title: 'Diff de texto',
      desc: 'Compara dois arquivos de texto',
    },
    rename: {
      title: 'Renomear em lote',
      desc: 'Renomeia arquivos com regex, com desfazer',
    },
    stats: {
      title: 'Estatísticas de texto',
      desc: 'Conta linhas, palavras e caracteres',
    },
    qrcode: {
      title: 'QR Code',
      desc: 'Gera QR code a partir de texto',
    },
    barcode: {
      title: 'Código de barras',
      desc: 'Gera CODE-128 ou EAN-13',
    },
    searchindex: {
      title: 'Indexar para busca',
      desc: 'Indexa arquivos de texto e PDF na busca global',
    },
    ocr: {
      title: 'OCR de imagem',
      desc: 'Extrai texto de imagens com tesseract',
    },
    pdf2img: {
      title: 'PDF para imagem',
      desc: 'Converte páginas do PDF em imagens PNG/JPG',
    },
  },
  step: {
    hashfile: { compute: 'Calculando hashes' },
  },
  param: {
    algorithm: { label: 'Algoritmo' },
    output: { label: 'Arquivo de saída' },
    outputDir: { label: 'Pasta de destino' },
    outputPath: { label: 'Arquivo de destino' },
    pdf: {
      splitmode: { label: 'Modo de divisão' },
      n: { label: 'Páginas por bloco' },
      angle: { label: 'Ângulo' },
      text: { label: 'Texto' },
      fontsize: { label: 'Tamanho da fonte' },
    },
    img: {
      format: { label: 'Formato' },
      quality: { label: 'Qualidade' },
      width: { label: 'Largura' },
      height: { label: 'Altura' },
      keepaspect: { label: 'Manter proporção' },
      opacity: { label: 'Opacidade' },
      qrsize: { label: 'Tamanho (px)' },
    },
    data: {
      format: { label: 'Formato de saída' },
      format2: { label: 'Formato de saída' },
      mode: { label: 'Modo' },
    },
    text: {
      pattern: { label: 'Padrão (regex)' },
      replacement: { label: 'Substituição' },
      undo: { label: 'Desfazer renomeações' },
      barkind: { label: 'Tipo' },
    },
    search: {
      recursive: { label: 'Incluir subpastas' },
    },
    ocr: {
      lang: { label: 'Idioma' },
    },
    pdf2img: {
      format: { label: 'Formato' },
      quality: { label: 'Qualidade JPG' },
      pages: { label: 'Páginas (ex.: 1-3,5)' },
    },
  },
  job: {
    title: 'Jobs',
    queued: 'Na fila',
    running: 'Executando',
    done: 'Concluído',
    failed: 'Falhou',
    canceled: 'Cancelado',
    cancel: 'Cancelar',
    empty: 'Nenhum job ainda',
    result: 'Resultado',
  },
  common: {
    cancel: 'Cancelar',
    close: 'Fechar',
    copy: 'Copiar',
    copied: 'Copiado!',
    loading: 'Carregando…',
    error: 'Erro',
    run: 'Executar',
    folder: 'Pasta',
    pickFiles: 'Selecionar arquivos',
    pickFolder: 'Selecionar pasta',
    open: 'Abrir',
    openFolder: 'Abrir pasta',
    copyPath: 'Copiar caminho',
    outputDir: 'Pasta de destino',
    clear: 'Limpar',
    preview: {
    title: 'Pré-visualização',
    rows: 'linhas',
    cols: 'colunas',
  },
    remove: 'remover',
    pages: 'páginas',
  },
  search: {
    title: 'Busca',
    placeholder: 'Buscar nos documentos indexados…',
    indexFolder: 'Indexar pasta',
    indexed: 'documentos indexados',
    noResults: 'Nenhum resultado',
    hint: 'Indexe uma pasta primeiro com a ferramenta "Indexar para busca".',
  },
  pipelines: {
    title: 'Macros',
    name: 'Nome da macro',
    addStep: 'Adicionar passo',
    save: 'Salvar macro',
    run: 'Executar macro',
    delete: 'Excluir',
    empty: 'Nenhuma macro salva',
    newPipeline: 'Nova macro',
    steps: 'Passos',
  },
  watch: {
    title: 'Pastas vigiadas',
    rules: 'Regras',
    folder: 'Pasta',
    pattern: 'Extensão (ex.: .pdf)',
    pipeline: 'Macro',
    add: 'Adicionar regra',
    remove: 'Remover',
    empty: 'Nenhuma regra ativa',
  },
  update: {
    available: 'Nova versão {tag} disponível',
  },
}

export type Dict = typeof ptBR
