import type { Dict } from './ptBR'

export const es: Dict = {
  app: {
    name: 'AxisDoc',
    tagline: 'Kit de herramientas de oficina — 100% offline',
    search: 'Buscar herramientas… (Ctrl+K)',
    theme: 'Cambiar tema',
    noTools: 'No se encontraron herramientas',
  },
  category: {
    security: 'Seguridad',
    pdf: 'PDF',
    image: 'Imágenes',
    data: 'Datos',
    text: 'Texto',
    search: 'Búsqueda',
    ocr: 'OCR',
  },
  tool: {
    hashfile: {
      title: 'Hash de archivos',
      desc: 'Calcula MD5, SHA-1, SHA-256, SHA-512 o CRC-32 de archivos',
      pick: 'Seleccionar archivos',
      algorithm: 'Algoritmo',
      saveOutput: 'Guardar resultado en archivo',
      run: 'Calcular hashes',
    },
    pdfinfo: {
      title: 'Información de PDF',
      desc: 'Muestra páginas, versión y cifrado de los PDF',
    },
    pdfmerge: {
      title: 'Fusionar PDF',
      desc: 'Une varios PDF en un solo archivo',
    },
    pdfsplit: {
      title: 'Dividir PDF',
      desc: 'Divide un PDF por páginas o en bloques',
    },
    pdfrotate: {
      title: 'Rotar PDF',
      desc: 'Rota todas las páginas 90°, 180° o 270°',
    },
    pdfwm: {
      title: 'Marca de agua en PDF',
      desc: 'Aplica marca de agua de texto diagonal',
    },
    pdfcompress: {
      title: 'Comprimir PDF',
      desc: 'Optimiza y reduce el tamaño del PDF',
    },
    pdfextract: {
      title: 'Extraer texto de PDF',
      desc: 'Extrae el contenido de texto de PDF',
    },
    imgconvert: {
      title: 'Convertir imágenes',
      desc: 'Convierte entre JPG, PNG, GIF, BMP y TIFF en lote',
    },
    imgresize: {
      title: 'Redimensionar imágenes',
      desc: 'Redimensiona imágenes en lote manteniendo proporción',
    },
    imgwm: {
      title: 'Marca de agua en imágenes',
      desc: 'Aplica marca de agua de texto sobre imágenes',
    },
    tabular: {
      title: 'Convertir tabla',
      desc: 'Convierte entre CSV y XLSX',
    },
    xlsxdiff: {
      title: 'Comparar hojas',
      desc: 'Compara dos hojas celda por celda',
    },
    struct: {
      title: 'Convertir estructura',
      desc: 'Convierte entre JSON, YAML y TOML',
    },
    jsonformat: {
      title: 'Formatear JSON',
      desc: 'Formatea o minimiza archivos JSON',
    },
    tablejson: {
      title: 'Tabla a JSON',
      desc: 'Convierte CSV/XLSX a JSON',
    },
    diff: {
      title: 'Diff de texto',
      desc: 'Compara dos archivos de texto',
    },
    rename: {
      title: 'Renombrar en lote',
      desc: 'Renombra archivos con regex, con deshacer',
    },
    stats: {
      title: 'Estadísticas de texto',
      desc: 'Cuenta líneas, palabras y caracteres',
    },
    qrcode: {
      title: 'Código QR',
      desc: 'Genera código QR desde texto',
    },
    barcode: {
      title: 'Código de barras',
      desc: 'Genera CODE-128 o EAN-13',
    },
    searchindex: {
      title: 'Indexar para búsqueda',
      desc: 'Indexa archivos de texto y PDF en la búsqueda global',
    },
    ocr: {
      title: 'OCR de imagen',
      desc: 'Extrae texto de imágenes con tesseract',
    },
    pdf2img: {
      title: 'PDF a imagen',
      desc: 'Convierte páginas del PDF en imágenes PNG/JPG',
    },
  },
  step: {
    hashfile: { compute: 'Calculando hashes' },
  },
  param: {
    algorithm: { label: 'Algoritmo' },
    output: { label: 'Archivo de salida' },
    outputDir: { label: 'Carpeta de destino' },
    outputPath: { label: 'Archivo de destino' },
    pdf: {
      splitmode: { label: 'Modo de división' },
      n: { label: 'Páginas por bloque' },
      angle: { label: 'Ángulo' },
      text: { label: 'Texto' },
      fontsize: { label: 'Tamaño de fuente' },
    },
    img: {
      format: { label: 'Formato' },
      quality: { label: 'Calidad' },
      width: { label: 'Ancho' },
      height: { label: 'Alto' },
      keepaspect: { label: 'Mantener proporción' },
      opacity: { label: 'Opacidad' },
      qrsize: { label: 'Tamaño (px)' },
    },
    data: {
      format: { label: 'Formato de salida' },
      format2: { label: 'Formato de salida' },
      mode: { label: 'Modo' },
    },
    text: {
      pattern: { label: 'Patrón (regex)' },
      replacement: { label: 'Reemplazo' },
      undo: { label: 'Deshacer renombres' },
      barkind: { label: 'Tipo' },
    },
    search: {
      recursive: { label: 'Incluir subcarpetas' },
    },
    ocr: {
      lang: { label: 'Idioma' },
    },
    pdf2img: {
      format: { label: 'Formato' },
      quality: { label: 'Calidad JPG' },
      pages: { label: 'Páginas (ej.: 1-3,5)' },
    },
  },
  job: {
    title: 'Tareas',
    queued: 'En cola',
    running: 'Ejecutando',
    done: 'Completado',
    failed: 'Falló',
    canceled: 'Cancelado',
    cancel: 'Cancelar',
    empty: 'Aún no hay tareas',
    result: 'Resultado',
  },
  common: {
    cancel: 'Cancelar',
    close: 'Cerrar',
    copy: 'Copiar',
    copied: '¡Copiado!',
    loading: 'Cargando…',
    error: 'Error',
    run: 'Ejecutar',
    folder: 'Carpeta',
    pickFiles: 'Seleccionar archivos',
    pickFolder: 'Seleccionar carpeta',
    open: 'Abrir',
    openFolder: 'Abrir carpeta',
    copyPath: 'Copiar ruta',
    outputDir: 'Carpeta de destino',
    clear: 'Limpiar',
    preview: {
      title: 'Vista previa',
      rows: 'filas',
      cols: 'columnas',
    },
    remove: 'quitar',
    pages: 'páginas',
  },
  search: {
    title: 'Búsqueda',
    placeholder: 'Buscar en documentos indexados…',
    indexFolder: 'Indexar carpeta',
    indexed: 'documentos indexados',
    noResults: 'Sin resultados',
    hint: 'Indexe una carpeta primero con la herramienta "Indexar para búsqueda".',
  },
  pipelines: {
    title: 'Macros',
    name: 'Nombre de la macro',
    addStep: 'Añadir paso',
    save: 'Guardar macro',
    run: 'Ejecutar macro',
    delete: 'Eliminar',
    empty: 'Sin macros guardadas',
    newPipeline: 'Nueva macro',
    steps: 'Pasos',
  },
  watch: {
    title: 'Carpetas vigiladas',
    rules: 'Reglas',
    folder: 'Carpeta',
    pattern: 'Extensión (ej.: .pdf)',
    pipeline: 'Macro',
    add: 'Añadir regla',
    remove: 'Quitar',
    empty: 'Sin reglas activas',
  },
  update: {
    available: 'Nueva versión {tag} disponible',
  },
}
