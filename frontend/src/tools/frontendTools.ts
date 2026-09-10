import type { ToolInfo } from '../bindings/backend'

// Tools frontend-driven: a UI roda 100% no frontend (PDF.js + bindings de
// preview/salvamento) e o backend NÃO as registra no registry — por isso
// precisam ser mescladas ao catálogo no store (useCatalog).
export const FRONTEND_TOOLS: ToolInfo[] = [
  {
    id: 'pdf.toimage', category: 'pdf', titleKey: 'tool.pdf2img.title',
    descKey: 'tool.pdf2img.desc', icon: 'file-image', stepNames: [],
    params: [
      { key: 'format', label: 'param.pdf2img.format.label', type: 'select', options: ['png', 'jpg'], default: 'png', widget: 'segmented' },
      { key: 'quality', label: 'param.pdf2img.quality.label', type: 'number', default: 85, min: 1, max: 100, widget: 'slider', visibleIf: { key: 'format', equals: 'jpg' } },
      { key: 'pages', label: 'param.pdf2img.pages.label', type: 'select', options: ['first', 'last', 'middle', 'all', 'custom'], default: 'all', widget: 'segmented' },
      { key: 'customPages', label: 'param.pdf2img.customPages.label', type: 'text', default: '', placeholder: 'param.pdf2img.customPages.placeholder', visibleIf: { key: 'pages', equals: 'custom' } },
    ],
  },
  {
    id: 'pdf.editor', category: 'pdf', titleKey: 'tool.pdfeditor.title',
    descKey: 'tool.pdfeditor.desc', icon: 'pencil-ruler', stepNames: [],
    params: [
      { key: 'outputDir', label: 'param.outputDir.label', type: 'folder' },
    ],
  },
  {
    id: 'pdf.extractpages', category: 'pdf', titleKey: 'tool.pdfextractpages.title',
    descKey: 'tool.pdfextractpages.desc', icon: 'file-image', stepNames: [],
    // formato/qualidade ficam no runner visual (não são params de job)
    params: [
      { key: 'outputDir', label: 'param.outputDir.label', type: 'folder' },
    ],
  },
]
