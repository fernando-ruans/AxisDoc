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
      param('format', 'param.img.format.label', 'select', { options: ['jpg', 'png', 'gif', 'bmp', 'tiff'], default: 'png', required: true }),
      param('quality', 'param.img.quality.label', 'number', { default: 85, min: 1, max: 100 }),
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
      param('text', 'param.pdf.text.label', 'text', { required: true }),
      param('size', 'param.img.qrsize.label', 'number', { default: 256, min: 64, max: 2000 }),
      outputDir(),
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
]
