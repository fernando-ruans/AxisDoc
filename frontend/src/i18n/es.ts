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
    imgcrop: {
      title: 'Recortar imagen',
      desc: 'Recorta área por coordenadas o ancla',
    },
    imgtransform: {
      title: 'Rotar/voltear imagen',
      desc: 'Rota 90/180/270° o espeja horizontal/vertical',
    },
    imgfilters: {
      title: 'Filtros de imagen',
      desc: 'B/N, invertir, blur, nitidez, sepia, contraste, brillo',
    },
    imgicon: {
      title: 'Icono favicon',
      desc: 'Genera .ico multi-resolución desde imagen',
    },
    gifextract: {
      title: 'Extraer cuadros de GIF',
      desc: 'Guarda cada cuadro del GIF como PNG',
    },
    gifbuild: {
      title: 'Crear GIF',
      desc: 'Crea GIF animado desde PNGs',
    },
    imgwmpos: {
      title: 'Marca de agua con imagen',
      desc: 'Superpone logo en 5 posiciones con escala',
    },
    imgpalette: {
      title: 'Paleta de colores',
      desc: 'Lista los colores dominantes en hexadecimal',
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
    pdfextractimages: {
      title: 'Extraer imágenes de PDF',
      desc: 'Extrae todas las imágenes incrustadas del PDF',
    },
    pdfextractpages: {
      title: 'Extraer páginas de PDF',
      desc: 'Guarda páginas seleccionadas en un nuevo PDF',
    },
    pdfremovepages: {
      title: 'Eliminar páginas de PDF',
      desc: 'Elimina páginas seleccionadas del PDF',
    },
    pdfextractfonts: {
      title: 'Extraer fuentes de PDF',
      desc: 'Extrae las fuentes incrustadas en el PDF',
    },
    pdfextractattachments: {
      title: 'Extraer adjuntos de PDF',
      desc: 'Extrae archivos adjuntos al PDF',
    },
    pdfextractmetadata: {
      title: 'Metadatos de PDF',
      desc: 'Muestra los metadatos XMP del PDF',
    },
    pdfpermissions: {
      title: 'Permisos de PDF',
      desc: 'Lista los permisos de uso del PDF',
    },
    pdfdiff: {
      title: 'Comparar PDF',
      desc: 'Compara el texto de dos PDF',
    },
    pdfaddattachments: {
      title: 'Adjuntar archivos a PDF',
      desc: 'Adjunta archivos dentro del PDF',
    },
    pdffromimages: {
      title: 'Imágenes a PDF',
      desc: 'Une imágenes en un solo PDF',
    },
    pdfcreate: {
      title: 'Crear PDF',
      desc: 'Crea un PDF nuevo con título y texto',
    },
    pdfnup: {
      title: 'N-up de PDF',
      desc: 'Pone 2, 4 u 8 páginas por hoja',
    },
    pdfrearrange: {
      title: 'Reordenar páginas',
      desc: 'Reordena páginas en cualquier orden (ej.: 3,1,2)',
    },
    pdfprotect: {
      title: 'Proteger PDF',
      desc: 'Cifra el PDF con contraseña (AES)',
    },
    pdfunlock: {
      title: 'Desbloquear PDF',
      desc: 'Elimina la contraseña de un PDF',
    },
    pdfoverlay: {
      title: 'Superponer PDF',
      desc: 'Aplica un PDF sobre otro como sello',
    },
    pdfpagenumbers: {
      title: 'Numerar páginas',
      desc: 'Añade numeración a cada página',
    },
    pdfeditor: {
      title: 'Editor de PDF',
      desc: 'Edite páginas: elimine, reordene, rote e inserte blancas',
    },
    csv2sql: {
      title: 'Tabla a SQL',
      desc: 'Genera INSERTs desde CSV/XLSX',
    },
    sql2csv: {
      title: 'SQL a tabla',
      desc: 'Extrae CSV de dumps INSERT',
    },
    json2table: {
      title: 'JSON a tabla',
      desc: 'Convierte array de objetos a XLSX/CSV',
    },
    lorem: {
      title: 'Lorem ipsum',
      desc: 'Genera texto de relleno',
    },
    baseconvert: {
      title: 'Base numérica',
      desc: 'Convierte entre bases 2, 8, 10, 16 y 36',
    },
    epoch: {
      title: 'Timestamp',
      desc: 'Convierte epoch ↔ fecha, muestra ahora',
    },
    uuid: {
      title: 'UUID',
      desc: 'Genera UUIDs v4 o v7',
    },
    slug: {
      title: 'Slug',
      desc: 'Convierte texto en slug de URL',
    },
    columnize: {
      title: 'Columnas de texto',
      desc: 'Alinea texto delimitado en columnas',
    },
    escape: {
      title: 'Escape HTML/URL',
      desc: 'Escapa o decodifica HTML y URLs',
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
    qrcode: {
      placeholder: 'Pegue el enlace o texto aquí…',
      hint: 'El QR se actualiza solo mientras escribe',
    },
    pdf: {
      splitmode: { label: 'Modo de división' },
      n: { label: 'Páginas por bloque' },
      angle: { label: 'Ángulo' },
      text: { label: 'Texto' },
      fontsize: { label: 'Tamaño de fuente' },
      pages: { label: 'Páginas (ej.: 1-3,5)' },
      attachfiles: { label: 'Archivos (uno por línea)' },
      doctitle: { label: 'Título' },
      docbody: { label: 'Texto' },
      blankpages: { label: 'Páginas en blanco extra' },
      nup: { label: 'Páginas por hoja' },
      order: { label: 'Nuevo orden (ej.: 3,1,2)' },
      userpw: { label: 'Contraseña de usuario' },
      ownerpw: { label: 'Contraseña de propietario' },
      keylen: { label: 'Clave (bits)' },
      password: { label: 'Contraseña' },
      overlay: { label: 'PDF de superposición' },
      ontop: { label: 'Sobre el contenido' },
      numformat: { label: 'Formato (use %p y %P)' },
    },
    img: {
      format: { label: 'Formato' },
      quality: { label: 'Calidad', hint: 'Solo vale para JPG' },
      width: { label: 'Ancho' },
      height: { label: 'Alto' },
      keepaspect: { label: 'Mantener proporción' },
      opacity: { label: 'Opacidad' },
      qrsize: { label: 'Tamaño (px)' },
      x: { label: 'X inicial' },
      y: { label: 'Y inicial' },
      anchor: { label: 'Ancla' },
      transform: { label: 'Operación' },
      filter: { label: 'Filtro' },
      wmimage: { label: 'Imagen de marca' },
      position: { label: 'Posición' },
      wmscale: { label: 'Escala %' },
      margin: { label: 'Margen (px)' },
    },
    data: {
      format: { label: 'Formato de salida' },
      format2: { label: 'Formato de salida' },
      mode: { label: 'Modo' },
      table: { label: 'Nombre de la tabla' },
      dialect: { label: 'Dialecto SQL' },
      batch: { label: 'Filas por INSERT' },
    },
    text: {
      pattern: { label: 'Patrón (regex)' },
      replacement: { label: 'Reemplazo' },
      undo: { label: 'Deshacer renombres' },
      barkind: { label: 'Tipo' },
      paragraphs: { label: 'Párrafos' },
      words: { label: 'Palabras por párrafo' },
      value: { label: 'Valor' },
      frombase: { label: 'Base de origen' },
      tobase: { label: 'Base de destino' },
      count: { label: 'Cantidad' },
      uuidver: { label: 'Versión' },
      separator: { label: 'Separador' },
      delimiter: { label: 'Delimitador' },
      padding: { label: 'Espaciado' },
      escapekind: { label: 'Operación' },
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
    gif: {
      delay: { label: 'Intervalo (ms)' },
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
    outputDirHint: 'Vacío = misma carpeta del archivo',
    clear: 'Limpiar',
    remove: 'quitar',
    pages: 'páginas',
  },
  preview: {
    title: 'Vista previa',
    rows: 'filas',
    cols: 'columnas',
  },
  pdfeditor: {
    apply: 'Aplicar ediciones',
    rotate: 'Rotar 90°',
    remove: 'Eliminar',
    insertBlank: 'Insertar página en blanco después',
    blank: 'En blanco',
    noChanges: 'Sin cambios para aplicar',
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
