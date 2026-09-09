import type { ToolInfo, ToolParam } from '../bindings/backend'

// Catálogo canônico das ferramentas — espelho exato do que o backend declara
// (internal/tool/* + app.go). Esta é a FONTE ÚNICA para os testes de contrato;
// ao adicionar uma tool no Go, adicione aqui com os MESMOS params.
// O teste catalog.test.ts valida que este espelho cobre todo o catálogo real.
export interface CatalogTool extends ToolInfo {
  iconValid: true
}

function param(
  key: string,
  label: string,
  type: ToolParam['type'],
  extra: Partial<ToolParam> = {},
): ToolParam {
  return { key, label, type, ...extra }
}

const outputDir = (): ToolParam => param('outputDir', 'param.outputDir.label', 'folder')

export const CANONICAL_CATALOG: ToolInfo[] = [
  {
    id: 'security.hashfile', category: 'security', titleKey: 'tool.hashfile.title',
    descKey: 'tool.hashfile.desc', icon: 'fingerprint', stepNames: ['step.hashfile.compute'],
    params: [
      param('algorithm', 'param.algorithm.label', 'select', { options: ['sha256', 'sha512', 'sha1', 'md5', 'crc32'], default: 'sha256', required: true }),
      param('outputPath', 'param.outputPath.label', 'output'),
    ],
  },
  {
    id: 'pdf.info', category: 'pdf', titleKey: 'tool.pdfinfo.title',
    descKey: 'tool.pdfinfo.desc', icon: 'file-info', stepNames: ['step.pdf.info'],
  },
  {
    id: 'pdf.merge', category: 'pdf', titleKey: 'tool.pdfmerge.title',
    descKey: 'tool.pdfmerge.desc', icon: 'file-plus-2', stepNames: ['step.pdf.merge'],
    params: [
      param('outputPath', 'param.outputPath.label', 'output', { default: 'merged.pdf' }),
      outputDir(),
    ],
  },
  {
    id: 'pdf.split', category: 'pdf', titleKey: 'tool.pdfsplit.title',
    descKey: 'tool.pdfsplit.desc', icon: 'scissors', stepNames: ['step.pdf.split'],
    params: [
      param('mode', 'param.pdf.splitmode.label', 'select', { options: ['pages', 'everyN'], default: 'everyN' }),
      param('n', 'param.pdf.n.label', 'number', { default: 1, min: 1, max: 1000 }),
      outputDir(),
    ],
  },
  {
    id: 'pdf.rotate', category: 'pdf', titleKey: 'tool.pdfrotate.title',
    descKey: 'tool.pdfrotate.desc', icon: 'rotate-cw', stepNames: ['step.pdf.rotate'],
    params: [
      param('angle', 'param.pdf.angle.label', 'select', { options: ['90', '180', '270'], default: '90' }),
      outputDir(),
    ],
  },
  {
    id: 'pdf.watermark', category: 'pdf', titleKey: 'tool.pdfwm.title',
    descKey: 'tool.pdfwm.desc', icon: 'stamp', stepNames: ['step.pdf.watermark'],
    params: [
      param('text', 'param.pdf.text.label', 'text', { required: true, default: 'CONFIDENCIAL' }),
      param('fontSize', 'param.pdf.fontsize.label', 'number', { default: 48, min: 6, max: 200 }),
      outputDir(),
    ],
  },
  {
    id: 'pdf.compress', category: 'pdf', titleKey: 'tool.pdfcompress.title',
    descKey: 'tool.pdfcompress.desc', icon: 'minimize-2', stepNames: ['step.pdf.compress'],
    params: [outputDir()],
  },
  {
    id: 'pdf.extracttext', category: 'pdf', titleKey: 'tool.pdfextract.title',
    descKey: 'tool.pdfextract.desc', icon: 'file-text', stepNames: ['step.pdf.extracttext'],
  },
  {
    id: 'pdf.extractimages', category: 'pdf', titleKey: 'tool.pdfextractimages.title',
    descKey: 'tool.pdfextractimages.desc', icon: 'image', stepNames: ['step.pdf.extractimages'],
    params: [
      param('pages', 'param.pdf.pages.label', 'text', { default: '' }),
      outputDir(),
    ],
  },
  {
    id: 'pdf.extractpages', category: 'pdf', titleKey: 'tool.pdfextractpages.title',
    descKey: 'tool.pdfextractpages.desc', icon: 'file-output', stepNames: ['step.pdf.extractpages'],
    params: [
      param('pages', 'param.pdf.pages.label', 'text', { required: true, default: '' }),
      outputDir(),
    ],
  },
  {
    id: 'pdf.removepages', category: 'pdf', titleKey: 'tool.pdfremovepages.title',
    descKey: 'tool.pdfremovepages.desc', icon: 'file-x', stepNames: ['step.pdf.removepages'],
    params: [
      param('pages', 'param.pdf.pages.label', 'text', { required: true, default: '' }),
      outputDir(),
    ],
  },
  {
    id: 'pdf.extractfonts', category: 'pdf', titleKey: 'tool.pdfextractfonts.title',
    descKey: 'tool.pdfextractfonts.desc', icon: 'type', stepNames: ['step.pdf.extractfonts'],
    params: [
      param('pages', 'param.pdf.pages.label', 'text', { default: '' }),
      outputDir(),
    ],
  },
  {
    id: 'pdf.extractattachments', category: 'pdf', titleKey: 'tool.pdfextractattachments.title',
    descKey: 'tool.pdfextractattachments.desc', icon: 'paperclip', stepNames: ['step.pdf.extractattachments'],
    params: [outputDir()],
  },
  {
    id: 'pdf.extractmetadata', category: 'pdf', titleKey: 'tool.pdfextractmetadata.title',
    descKey: 'tool.pdfextractmetadata.desc', icon: 'info', stepNames: ['step.pdf.extractmetadata'],
  },
  {
    id: 'pdf.permissions', category: 'pdf', titleKey: 'tool.pdfpermissions.title',
    descKey: 'tool.pdfpermissions.desc', icon: 'lock', stepNames: ['step.pdf.permissions'],
  },
  {
    id: 'pdf.diff', category: 'pdf', titleKey: 'tool.pdfdiff.title',
    descKey: 'tool.pdfdiff.desc', icon: 'git-compare', stepNames: ['step.pdf.diff'],
  },
  {
    id: 'pdf.addattachments', category: 'pdf', titleKey: 'tool.pdfaddattachments.title',
    descKey: 'tool.pdfaddattachments.desc', icon: 'paperclip', stepNames: ['step.pdf.addattachments'],
    params: [
      param('files', 'param.pdf.attachfiles.label', 'text', { required: true, default: '' }),
      outputDir(),
    ],
  },
  {
    id: 'pdf.fromimages', category: 'pdf', titleKey: 'tool.pdffromimages.title',
    descKey: 'tool.pdffromimages.desc', icon: 'images', stepNames: ['step.pdf.fromimages'],
    params: [
      param('outputPath', 'param.outputPath.label', 'output', { default: 'imagens.pdf' }),
      outputDir(),
    ],
  },
  {
    id: 'pdf.create', category: 'pdf', titleKey: 'tool.pdfcreate.title',
    descKey: 'tool.pdfcreate.desc', icon: 'file-plus', stepNames: ['step.pdf.create'],
    params: [
      param('title', 'param.pdf.doctitle.label', 'text', { required: true, default: '' }),
      param('body', 'param.pdf.docbody.label', 'text', { required: true, default: '' }),
      param('pages', 'param.pdf.blankpages.label', 'number', { default: 0, min: 0, max: 50 }),
      param('outputPath', 'param.outputPath.label', 'output', { default: 'novo.pdf' }),
    ],
  },
  {
    id: 'pdf.nup', category: 'pdf', titleKey: 'tool.pdfnup.title',
    descKey: 'tool.pdfnup.desc', icon: 'layout-grid', stepNames: ['step.pdf.nup'],
    params: [
      param('n', 'param.pdf.nup.label', 'select', { options: ['2', '4', '8'], default: '2' }),
      outputDir(),
    ],
  },
  {
    id: 'pdf.rearrange', category: 'pdf', titleKey: 'tool.pdfrearrange.title',
    descKey: 'tool.pdfrearrange.desc', icon: 'list-ordered', stepNames: ['step.pdf.rearrange'],
    params: [
      param('order', 'param.pdf.order.label', 'text', { required: true, default: '' }),
      outputDir(),
    ],
  },
  {
    id: 'pdf.protect', category: 'pdf', titleKey: 'tool.pdfprotect.title',
    descKey: 'tool.pdfprotect.desc', icon: 'lock', stepNames: ['step.pdf.protect'],
    params: [
      param('userPassword', 'param.pdf.userpw.label', 'password', { required: true, default: '' }),
      param('ownerPassword', 'param.pdf.ownerpw.label', 'password', { default: '' }),
      param('keyLength', 'param.pdf.keylen.label', 'select', { options: ['40', '128', '256'], default: '256' }),
      outputDir(),
    ],
  },
  {
    id: 'pdf.unlock', category: 'pdf', titleKey: 'tool.pdfunlock.title',
    descKey: 'tool.pdfunlock.desc', icon: 'lock-open', stepNames: ['step.pdf.unlock'],
    params: [
      param('password', 'param.pdf.password.label', 'password', { required: true, default: '' }),
      outputDir(),
    ],
  },
  {
    id: 'pdf.overlay', category: 'pdf', titleKey: 'tool.pdfoverlay.title',
    descKey: 'tool.pdfoverlay.desc', icon: 'layers', stepNames: ['step.pdf.overlay'],
    params: [
      param('overlay', 'param.pdf.overlay.label', 'text', { required: true, default: '' }),
      param('onTop', 'param.pdf.ontop.label', 'bool', { default: true }),
      outputDir(),
    ],
  },
  {
    id: 'pdf.pagenumbers', category: 'pdf', titleKey: 'tool.pdfpagenumbers.title',
    descKey: 'tool.pdfpagenumbers.desc', icon: 'list-ordered', stepNames: ['step.pdf.pagenumbers'],
    params: [
      param('format', 'param.pdf.numformat.label', 'text', { required: true, default: 'Página %p de %P' }),
      param('position', 'param.img.position.label', 'select', { options: ['bottomCenter', 'topCenter', 'bottomRight', 'bottomLeft'], default: 'bottomCenter' }),
      param('fontSize', 'param.pdf.fontsize.label', 'number', { default: 10, min: 6, max: 48 }),
      outputDir(),
    ],
  },
  {
    id: 'pdf.toimage', category: 'pdf', titleKey: 'tool.pdf2img.title',
    descKey: 'tool.pdf2img.desc', icon: 'file-image', stepNames: [], frontendDriven: true,
    params: [
      param('format', 'param.pdf2img.format.label', 'select', { options: ['png', 'jpg'], default: 'png' }),
      param('quality', 'param.pdf2img.quality.label', 'number', { default: 85, min: 1, max: 100 }),
      param('pages', 'param.pdf2img.pages.label', 'text', { default: '' }),
      outputDir(),
    ],
  },
  {
    id: 'img.convert', category: 'image', titleKey: 'tool.imgconvert.title',
    descKey: 'tool.imgconvert.desc', icon: 'repeat', stepNames: ['step.img.convert'],
    params: [
      param('format', 'param.img.format.label', 'select', { options: ['jpg', 'png', 'gif', 'bmp', 'tiff'], default: 'png', required: true, widget: 'cards' }),
      param('quality', 'param.img.quality.label', 'number', {
        default: 85, min: 1, max: 100, widget: 'slider',
        hint: 'param.img.quality.hint', visibleIf: { key: 'format', equals: 'jpg' },
      }),
      outputDir(),
    ],
  },
  {
    id: 'img.resize', category: 'image', titleKey: 'tool.imgresize.title',
    descKey: 'tool.imgresize.desc', icon: 'scaling', stepNames: ['step.img.resize'],
    params: [
      param('width', 'param.img.width.label', 'number', { default: 800, min: 1, max: 20000 }),
      param('height', 'param.img.height.label', 'number', { default: 0, min: 0, max: 20000 }),
      param('keepAspect', 'param.img.keepaspect.label', 'bool', { default: true }),
      outputDir(),
    ],
  },
  {
    id: 'img.watermark', category: 'image', titleKey: 'tool.imgwm.title',
    descKey: 'tool.imgwm.desc', icon: 'stamp', stepNames: ['step.img.watermark'],
    params: [
      param('text', 'param.pdf.text.label', 'text', { required: true, default: '© AxisDoc' }),
      param('opacity', 'param.img.opacity.label', 'number', { default: 0.3, min: 0.05, max: 1 }),
      outputDir(),
    ],
  },
  {
    id: 'img.crop', category: 'image', titleKey: 'tool.imgcrop.title',
    descKey: 'tool.imgcrop.desc', icon: 'crop', stepNames: ['step.img2.crop'],
    params: [
      param('x', 'param.img.x.label', 'number', { default: 0, min: 0 }),
      param('y', 'param.img.y.label', 'number', { default: 0, min: 0 }),
      param('width', 'param.img.width.label', 'number', { default: 100, min: 1 }),
      param('height', 'param.img.height.label', 'number', { default: 100, min: 1 }),
      param('anchor', 'param.img.anchor.label', 'select', { options: ['topLeft', 'center', 'topRight', 'bottomLeft', 'bottomRight'], default: 'topLeft' }),
      outputDir(),
    ],
  },
  {
    id: 'img.transform', category: 'image', titleKey: 'tool.imgtransform.title',
    descKey: 'tool.imgtransform.desc', icon: 'flip-horizontal', stepNames: ['step.img2.transform'],
    params: [
      param('op', 'param.img.transform.label', 'select', { options: ['rotate90', 'rotate180', 'rotate270', 'flipH', 'flipV'], default: 'rotate90' }),
      outputDir(),
    ],
  },
  {
    id: 'img.filters', category: 'image', titleKey: 'tool.imgfilters.title',
    descKey: 'tool.imgfilters.desc', icon: 'wand', stepNames: ['step.img2.filters'],
    params: [
      param('filter', 'param.img.filter.label', 'select', { options: ['grayscale', 'invert', 'blur', 'sharpen', 'sepia', 'contrast', 'brightness'], default: 'grayscale' }),
      param('strength', 'param.img.opacity.label', 'number', { default: 5, min: 0, max: 10 }),
      outputDir(),
    ],
  },
  {
    id: 'img.icon', category: 'image', titleKey: 'tool.imgicon.title',
    descKey: 'tool.imgicon.desc', icon: 'shapes', stepNames: ['step.img2.icon'],
    params: [
      param('outputPath', 'param.outputPath.label', 'output', { default: 'icon.ico' }),
    ],
  },
  {
    id: 'img.gifextract', category: 'image', titleKey: 'tool.gifextract.title',
    descKey: 'tool.gifextract.desc', icon: 'film', stepNames: ['step.img2.gifextract'],
    params: [outputDir()],
  },
  {
    id: 'img.gifbuild', category: 'image', titleKey: 'tool.gifbuild.title',
    descKey: 'tool.gifbuild.desc', icon: 'film', stepNames: ['step.img2.gifbuild'],
    params: [
      param('delay', 'param.gif.delay.label', 'number', { default: 100, min: 20, max: 5000 }),
      param('outputPath', 'param.outputPath.label', 'output', { default: 'animacao.gif' }),
    ],
  },
  {
    id: 'img.watermarkpos', category: 'image', titleKey: 'tool.imgwmpos.title',
    descKey: 'tool.imgwmpos.desc', icon: 'stamp', stepNames: ['step.img2.watermarkpos'],
    params: [
      param('image', 'param.img.wmimage.label', 'text', { required: true, default: '' }),
      param('position', 'param.img.position.label', 'select', { options: ['topLeft', 'topRight', 'center', 'bottomLeft', 'bottomRight'], default: 'bottomRight' }),
      param('scale', 'param.img.wmscale.label', 'number', { default: 20, min: 5, max: 90 }),
      param('margin', 'param.img.margin.label', 'number', { default: 20, min: 0, max: 500 }),
      outputDir(),
    ],
  },
  {
    id: 'img.palette', category: 'image', titleKey: 'tool.imgpalette.title',
    descKey: 'tool.imgpalette.desc', icon: 'palette', stepNames: ['step.img2.palette'],
  },
  {
    id: 'data.tabular', category: 'data', titleKey: 'tool.tabular.title',
    descKey: 'tool.tabular.desc', icon: 'table-2', stepNames: ['step.data.tabular'],
    params: [
      param('format', 'param.data.format.label', 'select', { options: ['xlsx', 'csv'], default: 'xlsx', required: true }),
      outputDir(),
    ],
  },
  {
    id: 'data.xlsxdiff', category: 'data', titleKey: 'tool.xlsxdiff.title',
    descKey: 'tool.xlsxdiff.desc', icon: 'git-compare', stepNames: ['step.data.xlsxdiff'],
  },
  {
    id: 'data.struct', category: 'data', titleKey: 'tool.struct.title',
    descKey: 'tool.struct.desc', icon: 'braces', stepNames: ['step.data.struct'],
    params: [
      param('format', 'param.data.format2.label', 'select', { options: ['json', 'yaml', 'toml'], default: 'yaml', required: true }),
      outputDir(),
    ],
  },
  {
    id: 'data.jsonformat', category: 'data', titleKey: 'tool.jsonformat.title',
    descKey: 'tool.jsonformat.desc', icon: 'code', stepNames: ['step.data.jsonformat'],
    params: [
      param('mode', 'param.data.mode.label', 'select', { options: ['format', 'minify'], default: 'format' }),
    ],
  },
  {
    id: 'data.tablejson', category: 'data', titleKey: 'tool.tablejson.title',
    descKey: 'tool.tablejson.desc', icon: 'file-json', stepNames: ['step.data.tablejson'],
    params: [outputDir()],
  },
  {
    id: 'text.diff', category: 'text', titleKey: 'tool.diff.title',
    descKey: 'tool.diff.desc', icon: 'git-compare', stepNames: ['step.text.diff'],
  },
  {
    id: 'text.rename', category: 'text', titleKey: 'tool.rename.title',
    descKey: 'tool.rename.desc', icon: 'pencil', stepNames: ['step.text.rename'],
    params: [
      param('pattern', 'param.text.pattern.label', 'text', { required: true, default: '(.*)' }),
      param('replacement', 'param.text.replacement.label', 'text', { required: true, default: '$1' }),
      param('undo', 'param.text.undo.label', 'bool', { default: false }),
    ],
  },
  {
    id: 'text.stats', category: 'text', titleKey: 'tool.stats.title',
    descKey: 'tool.stats.desc', icon: 'list', stepNames: ['step.text.stats'],
  },
  {
    id: 'text.qrcode', category: 'text', titleKey: 'tool.qrcode.title',
    descKey: 'tool.qrcode.desc', icon: 'qr-code', stepNames: ['step.text.qrcode'],
    params: [
      param('text', 'param.pdf.text.label', 'textarea', {
        required: true, placeholder: 'param.qrcode.placeholder', hint: 'param.qrcode.hint',
      }),
      param('size', 'param.img.qrsize.label', 'number', { default: 256, min: 64, max: 2000, widget: 'slider' }),
    ],
  },
  {
    id: 'text.barcode', category: 'text', titleKey: 'tool.barcode.title',
    descKey: 'tool.barcode.desc', icon: 'scan-barcode', stepNames: ['step.text.barcode'],
    params: [
      param('text', 'param.pdf.text.label', 'text', { required: true }),
      param('kind', 'param.text.barkind.label', 'select', { options: ['code128', 'ean13'], default: 'code128' }),
      param('width', 'param.img.width.label', 'number', { default: 400, min: 50, max: 4000 }),
      param('height', 'param.img.height.label', 'number', { default: 100, min: 20, max: 1000 }),
      outputDir(),
    ],
  },
  {
    id: 'search.index', category: 'search', titleKey: 'tool.searchindex.title',
    descKey: 'tool.searchindex.desc', icon: 'database', stepNames: ['step.search.index'],
    params: [
      param('recursive', 'param.search.recursive.label', 'bool', { default: false }),
    ],
  },
  {
    id: 'pdf.editor', category: 'pdf', titleKey: 'tool.pdfeditor.title',
    descKey: 'tool.pdfeditor.desc', icon: 'pencil-ruler', stepNames: ['step.pdf.editor'],
    params: [outputDir()],
    frontendDriven: true,
  },
  {
    id: 'data.csv2sql', category: 'data', titleKey: 'tool.csv2sql.title',
    descKey: 'tool.csv2sql.desc', icon: 'database-zap', stepNames: ['step.data.csv2sql'],
    params: [
      param('table', 'param.data.table.label', 'text', { required: true, default: 'dados' }),
      param('dialect', 'param.data.dialect.label', 'select', { options: ['sqlite', 'postgres', 'mysql'], default: 'sqlite' }),
      param('batch', 'param.data.batch.label', 'number', { default: 100, min: 1, max: 10000 }),
    ],
  },
  {
    id: 'data.sql2csv', category: 'data', titleKey: 'tool.sql2csv.title',
    descKey: 'tool.sql2csv.desc', icon: 'file-spreadsheet', stepNames: ['step.data.sql2csv'],
  },
  {
    id: 'data.json2table', category: 'data', titleKey: 'tool.json2table.title',
    descKey: 'tool.json2table.desc', icon: 'table', stepNames: ['step.data.json2table'],
    params: [
      param('format', 'param.data.format.label', 'select', { options: ['xlsx', 'csv'], default: 'xlsx', required: true }),
    ],
  },
  {
    id: 'text.lorem', category: 'text', titleKey: 'tool.lorem.title',
    descKey: 'tool.lorem.desc', icon: 'align-left', stepNames: ['step.text.lorem'],
    params: [
      param('paragraphs', 'param.text.paragraphs.label', 'number', { default: 3, min: 1, max: 100 }),
      param('wordsPerParagraph', 'param.text.words.label', 'number', { default: 60, min: 5, max: 500 }),
      outputDir(),
    ],
  },
  {
    id: 'text.baseconvert', category: 'text', titleKey: 'tool.baseconvert.title',
    descKey: 'tool.baseconvert.desc', icon: 'binary', stepNames: ['step.text.baseconvert'],
    params: [
      param('value', 'param.text.value.label', 'text', { required: true, default: '' }),
      param('from', 'param.text.frombase.label', 'select', { options: ['10', '16', '8', '2', '36'], default: '10' }),
      param('to', 'param.text.tobase.label', 'select', { options: ['10', '16', '8', '2', '36'], default: '16' }),
    ],
  },
  {
    id: 'text.epoch', category: 'text', titleKey: 'tool.epoch.title',
    descKey: 'tool.epoch.desc', icon: 'clock', stepNames: ['step.text.epoch'],
    params: [
      param('mode', 'param.data.mode.label', 'select', { options: ['now', 'toDate', 'toEpoch'], default: 'now' }),
      param('value', 'param.text.value.label', 'text', { default: '' }),
    ],
  },
  {
    id: 'text.uuid', category: 'text', titleKey: 'tool.uuid.title',
    descKey: 'tool.uuid.desc', icon: 'fingerprint', stepNames: ['step.text.uuid'],
    params: [
      param('count', 'param.text.count.label', 'number', { default: 1, min: 1, max: 1000 }),
      param('version', 'param.text.uuidver.label', 'select', { options: ['v4', 'v7'], default: 'v4' }),
    ],
  },
  {
    id: 'text.slug', category: 'text', titleKey: 'tool.slug.title',
    descKey: 'tool.slug.desc', icon: 'link', stepNames: ['step.text.slug'],
    params: [
      param('text', 'param.pdf.text.label', 'text', { required: true, default: '' }),
      param('separator', 'param.text.separator.label', 'select', { options: ['-', '_'], default: '-' }),
    ],
  },
  {
    id: 'text.columnize', category: 'text', titleKey: 'tool.columnize.title',
    descKey: 'tool.columnize.desc', icon: 'columns-3', stepNames: ['step.text.columnize'],
    params: [
      param('delimiter', 'param.text.delimiter.label', 'text', { default: '|' }),
      param('padding', 'param.text.padding.label', 'number', { default: 2, min: 1, max: 20 }),
    ],
  },
  {
    id: 'text.escape', category: 'text', titleKey: 'tool.escape.title',
    descKey: 'tool.escape.desc', icon: 'code-2', stepNames: ['step.text.escape'],
    params: [
      param('kind', 'param.text.escapekind.label', 'select', { options: ['htmlEscape', 'htmlUnescape', 'urlEncode', 'urlDecode', 'queryEscape'], default: 'htmlEscape' }),
      param('text', 'param.pdf.text.label', 'text', { default: '' }),
    ],
  },
  {
    id: 'ocr.image', category: 'ocr', titleKey: 'tool.ocr.title',
    descKey: 'tool.ocr.desc', icon: 'scan-text', stepNames: ['step.ocr'],
    params: [
      param('lang', 'param.ocr.lang.label', 'select', { options: ['por+eng', 'por', 'eng'], default: 'por+eng' }),
    ],
    // condicional: só aparece quando tesseract está instalado
  },
]

// Ícones válidos — espelho do mapa ICONS em AppShell.tsx.
export const VALID_ICONS = [
  'fingerprint', 'file-info', 'file-plus-2', 'scissors', 'rotate-cw', 'stamp',
  'minimize-2', 'file-text', 'file-image', 'repeat', 'scaling', 'table-2',
  'git-compare', 'braces', 'code', 'file-json', 'pencil', 'list', 'qr-code',
  'scan-barcode', 'database', 'scan-text', 'image', 'file-output', 'file-x',
  'type', 'paperclip', 'info', 'lock', 'images', 'file-plus', 'layout-grid',
  'database-zap', 'file-spreadsheet', 'table', 'align-left', 'binary', 'clock',
  'link', 'columns-3', 'code-2', 'crop', 'flip-horizontal', 'wand', 'shapes',
  'film', 'palette', 'list-ordered', 'lock-open', 'layers', 'pencil-ruler',
]
