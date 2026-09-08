import type { Dict } from './ptBR'

export const en: Dict = {
  app: {
    name: 'AxisDoc',
    tagline: 'Office toolkit — 100% offline',
    search: 'Search tools… (Ctrl+K)',
    theme: 'Toggle theme',
    noTools: 'No tools found',
  },
  category: {
    security: 'Security',
    pdf: 'PDF',
    image: 'Images',
    data: 'Data',
    text: 'Text',
    search: 'Search',
    ocr: 'OCR',
  },
  tool: {
    hashfile: {
      title: 'File hash',
      desc: 'Compute MD5, SHA-1, SHA-256, SHA-512 or CRC-32 of files',
      pick: 'Select files',
      algorithm: 'Algorithm',
      saveOutput: 'Save result to file',
      run: 'Compute hashes',
    },
    pdfinfo: {
      title: 'PDF info',
      desc: 'Show page count, version and encryption of PDFs',
    },
    pdfmerge: {
      title: 'Merge PDFs',
      desc: 'Combine multiple PDFs into one file',
    },
    pdfsplit: {
      title: 'Split PDF',
      desc: 'Split a PDF by pages or into chunks',
    },
    pdfrotate: {
      title: 'Rotate PDF',
      desc: 'Rotate all pages by 90°, 180° or 270°',
    },
    pdfwm: {
      title: 'PDF watermark',
      desc: 'Apply diagonal text watermark',
    },
    pdfcompress: {
      title: 'Compress PDF',
      desc: 'Optimize and reduce PDF file size',
    },
    pdfextract: {
      title: 'Extract PDF text',
      desc: 'Extract text content from PDFs',
    },
    imgconvert: {
      title: 'Convert images',
      desc: 'Convert between JPG, PNG, GIF, BMP and TIFF in batch',
    },
    imgresize: {
      title: 'Resize images',
      desc: 'Batch resize images keeping aspect ratio',
    },
    imgwm: {
      title: 'Image watermark',
      desc: 'Apply text watermark over images',
    },
    imgcrop: {
      title: 'Crop image',
      desc: 'Crop area by coordinates or anchor',
    },
    imgtransform: {
      title: 'Rotate/flip image',
      desc: 'Rotate 90/180/270° or mirror horizontal/vertical',
    },
    imgfilters: {
      title: 'Image filters',
      desc: 'Grayscale, invert, blur, sharpen, sepia, contrast, brightness',
    },
    imgicon: {
      title: 'Favicon icon',
      desc: 'Generate multi-resolution .ico from image',
    },
    gifextract: {
      title: 'Extract GIF frames',
      desc: 'Save each GIF frame as PNG',
    },
    gifbuild: {
      title: 'Build GIF',
      desc: 'Build animated GIF from PNGs',
    },
    imgwmpos: {
      title: 'Image watermark',
      desc: 'Overlay logo in 5 positions with scale',
    },
    imgpalette: {
      title: 'Color palette',
      desc: 'List dominant colors in hexadecimal',
    },
    tabular: {
      title: 'Table convert',
      desc: 'Convert between CSV and XLSX',
    },
    xlsxdiff: {
      title: 'Compare spreadsheets',
      desc: 'Compare two spreadsheets cell by cell',
    },
    struct: {
      title: 'Struct convert',
      desc: 'Convert between JSON, YAML and TOML',
    },
    jsonformat: {
      title: 'Format JSON',
      desc: 'Format or minify JSON files',
    },
    tablejson: {
      title: 'Table to JSON',
      desc: 'Convert CSV/XLSX to JSON',
    },
    diff: {
      title: 'Text diff',
      desc: 'Compare two text files',
    },
    rename: {
      title: 'Batch rename',
      desc: 'Rename files with regex, with undo',
    },
    stats: {
      title: 'Text stats',
      desc: 'Count lines, words and characters',
    },
    qrcode: {
      title: 'QR Code',
      desc: 'Generate QR code from text',
    },
    barcode: {
      title: 'Barcode',
      desc: 'Generate CODE-128 or EAN-13',
    },
    searchindex: {
      title: 'Index for search',
      desc: 'Index text and PDF files into global search',
    },
    ocr: {
      title: 'Image OCR',
      desc: 'Extract text from images with tesseract',
    },
    pdf2img: {
      title: 'PDF to image',
      desc: 'Convert PDF pages to PNG/JPG images',
    },
    pdfextractimages: {
      title: 'Extract PDF images',
      desc: 'Extract all embedded images from the PDF',
    },
    pdfextractpages: {
      title: 'Extract PDF pages',
      desc: 'Save selected pages to a new PDF',
    },
    pdfremovepages: {
      title: 'Remove PDF pages',
      desc: 'Remove selected pages from the PDF',
    },
    pdfextractfonts: {
      title: 'Extract PDF fonts',
      desc: 'Extract embedded fonts from the PDF',
    },
    pdfextractattachments: {
      title: 'Extract PDF attachments',
      desc: 'Extract files attached to the PDF',
    },
    pdfextractmetadata: {
      title: 'PDF metadata',
      desc: 'Show the PDF XMP metadata',
    },
    pdfpermissions: {
      title: 'PDF permissions',
      desc: 'List the PDF usage permissions',
    },
    pdfdiff: {
      title: 'Compare PDFs',
      desc: 'Compare the text of two PDFs',
    },
    pdfaddattachments: {
      title: 'Attach files to PDF',
      desc: 'Attach files inside the PDF',
    },
    pdffromimages: {
      title: 'Images to PDF',
      desc: 'Join images into a single PDF',
    },
    pdfcreate: {
      title: 'Create PDF',
      desc: 'Create a new PDF with title and text',
    },
    pdfnup: {
      title: 'PDF N-up',
      desc: 'Put 2, 4 or 8 pages per sheet',
    },
    pdfrearrange: {
      title: 'Reorder pages',
      desc: 'Reorder pages in any order (e.g. 3,1,2)',
    },
    pdfprotect: {
      title: 'Protect PDF',
      desc: 'Encrypt the PDF with password (AES)',
    },
    pdfunlock: {
      title: 'Unlock PDF',
      desc: 'Remove the password from a PDF',
    },
    pdfoverlay: {
      title: 'Overlay PDF',
      desc: 'Stamp one PDF over another',
    },
    pdfpagenumbers: {
      title: 'Number pages',
      desc: 'Add page numbers to each page',
    },
    pdfeditor: {
      title: 'PDF editor',
      desc: 'Edit pages: remove, reorder, rotate and insert blanks',
    },
    csv2sql: {
      title: 'Table to SQL',
      desc: 'Generate INSERTs from CSV/XLSX',
    },
    sql2csv: {
      title: 'SQL to table',
      desc: 'Extract CSV from INSERT dumps',
    },
    json2table: {
      title: 'JSON to table',
      desc: 'Convert object array to XLSX/CSV',
    },
    lorem: {
      title: 'Lorem ipsum',
      desc: 'Generate placeholder text',
    },
    baseconvert: {
      title: 'Number base',
      desc: 'Convert between bases 2, 8, 10, 16 and 36',
    },
    epoch: {
      title: 'Timestamp',
      desc: 'Convert epoch ↔ date, show now',
    },
    uuid: {
      title: 'UUID',
      desc: 'Generate v4 or v7 UUIDs',
    },
    slug: {
      title: 'Slug',
      desc: 'Convert text to URL slug',
    },
    columnize: {
      title: 'Text columns',
      desc: 'Align delimited text into columns',
    },
    escape: {
      title: 'Escape HTML/URL',
      desc: 'Escape or decode HTML and URLs',
    },
  },
  step: {
    hashfile: { compute: 'Computing hashes' },
  },
  param: {
    algorithm: { label: 'Algorithm' },
    output: { label: 'Output file' },
    outputDir: { label: 'Output folder' },
    outputPath: { label: 'Output file' },
    pdf: {
      splitmode: { label: 'Split mode' },
      n: { label: 'Pages per chunk' },
      angle: { label: 'Angle' },
      text: { label: 'Text' },
      fontsize: { label: 'Font size' },
      pages: { label: 'Pages (e.g. 1-3,5)' },
      attachfiles: { label: 'Files (one per line)' },
      doctitle: { label: 'Title' },
      docbody: { label: 'Text' },
      blankpages: { label: 'Extra blank pages' },
      nup: { label: 'Pages per sheet' },
      order: { label: 'New order (e.g. 3,1,2)' },
      userpw: { label: 'User password' },
      ownerpw: { label: 'Owner password' },
      keylen: { label: 'Key (bits)' },
      password: { label: 'Password' },
      overlay: { label: 'Overlay PDF' },
      ontop: { label: 'Over content' },
      numformat: { label: 'Format (use %p and %P)' },
    },
    img: {
      format: { label: 'Format' },
      quality: { label: 'Quality' },
      width: { label: 'Width' },
      height: { label: 'Height' },
      keepaspect: { label: 'Keep aspect ratio' },
      opacity: { label: 'Opacity' },
      qrsize: { label: 'Size (px)' },
      x: { label: 'Start X' },
      y: { label: 'Start Y' },
      anchor: { label: 'Anchor' },
      transform: { label: 'Operation' },
      filter: { label: 'Filter' },
      wmimage: { label: 'Watermark image' },
      position: { label: 'Position' },
      wmscale: { label: 'Scale %' },
      margin: { label: 'Margin (px)' },
    },
    data: {
      format: { label: 'Output format' },
      format2: { label: 'Output format' },
      mode: { label: 'Mode' },
      table: { label: 'Table name' },
      dialect: { label: 'SQL dialect' },
      batch: { label: 'Rows per INSERT' },
    },
    text: {
      pattern: { label: 'Pattern (regex)' },
      replacement: { label: 'Replacement' },
      undo: { label: 'Undo renames' },
      barkind: { label: 'Type' },
      paragraphs: { label: 'Paragraphs' },
      words: { label: 'Words per paragraph' },
      value: { label: 'Value' },
      frombase: { label: 'Source base' },
      tobase: { label: 'Target base' },
      count: { label: 'Quantity' },
      uuidver: { label: 'Version' },
      separator: { label: 'Separator' },
      delimiter: { label: 'Delimiter' },
      padding: { label: 'Spacing' },
      escapekind: { label: 'Operation' },
    },
    search: {
      recursive: { label: 'Include subfolders' },
    },
    ocr: {
      lang: { label: 'Language' },
    },
    pdf2img: {
      format: { label: 'Format' },
      quality: { label: 'JPG quality' },
      pages: { label: 'Pages (e.g. 1-3,5)' },
    },
    gif: {
      delay: { label: 'Delay (ms)' },
    },
  },
  job: {
    title: 'Jobs',
    queued: 'Queued',
    running: 'Running',
    done: 'Done',
    failed: 'Failed',
    canceled: 'Canceled',
    cancel: 'Cancel',
    empty: 'No jobs yet',
    result: 'Result',
  },
  common: {
    cancel: 'Cancel',
    close: 'Close',
    copy: 'Copy',
    copied: 'Copied!',
    loading: 'Loading…',
    error: 'Error',
    run: 'Run',
    folder: 'Folder',
    pickFiles: 'Select files',
    pickFolder: 'Select folder',
    open: 'Open',
    openFolder: 'Open folder',
    copyPath: 'Copy path',
    outputDir: 'Output folder',
    clear: 'Clear',
    remove: 'remove',
    pages: 'pages',
  },
  preview: {
    title: 'Preview',
    rows: 'rows',
    cols: 'columns',
  },
  pdfeditor: {
    apply: 'Apply edits',
    rotate: 'Rotate 90°',
    remove: 'Remove',
    insertBlank: 'Insert blank page after',
    blank: 'Blank',
    noChanges: 'No changes to apply',
  },
  search: {
    title: 'Search',
    placeholder: 'Search indexed documents…',
    indexFolder: 'Index folder',
    indexed: 'documents indexed',
    noResults: 'No results',
    hint: 'Index a folder first with the "Index for search" tool.',
  },
  pipelines: {
    title: 'Macros',
    name: 'Macro name',
    addStep: 'Add step',
    save: 'Save macro',
    run: 'Run macro',
    delete: 'Delete',
    empty: 'No saved macros',
    newPipeline: 'New macro',
    steps: 'Steps',
  },
  watch: {
    title: 'Watched folders',
    rules: 'Rules',
    folder: 'Folder',
    pattern: 'Extension (e.g. .pdf)',
    pipeline: 'Macro',
    add: 'Add rule',
    remove: 'Remove',
    empty: 'No active rules',
  },
  update: {
    available: 'New version {tag} available',
  },
}
