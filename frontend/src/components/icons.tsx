import {
  Fingerprint, Wrench,
  FileText, FilePlus2, Scissors, RotateCw, Stamp, Minimize2,
  Repeat, Scaling, Table2, GitCompare, Braces, Code2, FileJson,
  Pencil, List, QrCode, ScanBarcode, Database, ScanText, FileImage,
  DatabaseZap, FileSpreadsheet, Table, AlignLeft, Binary, Clock, Link,
  Columns3, Code, Crop, FlipHorizontal, Wand2, Shapes, Film, Palette,
  ListOrdered, Lock, LockOpen, Layers, PencilRuler,
} from 'lucide-react'

export type IconComponent = typeof Fingerprint

const ICONS: Record<string, IconComponent> = {
  fingerprint: Fingerprint,
  'file-info': FileText,
  'file-plus-2': FilePlus2,
  scissors: Scissors,
  'rotate-cw': RotateCw,
  stamp: Stamp,
  'minimize-2': Minimize2,
  'file-text': FileText,
  repeat: Repeat,
  scaling: Scaling,
  'table-2': Table2,
  'git-compare': GitCompare,
  braces: Braces,
  code: Code2,
  'file-json': FileJson,
  'file-image': FileImage,
  pencil: Pencil,
  list: List,
  'qr-code': QrCode,
  'scan-barcode': ScanBarcode,
  database: Database,
  'scan-text': ScanText,
  'database-zap': DatabaseZap,
  'file-spreadsheet': FileSpreadsheet,
  table: Table,
  'align-left': AlignLeft,
  binary: Binary,
  clock: Clock,
  link: Link,
  'columns-3': Columns3,
  'code-2': Code,
  crop: Crop,
  'flip-horizontal': FlipHorizontal,
  wand: Wand2,
  shapes: Shapes,
  film: Film,
  palette: Palette,
  'list-ordered': ListOrdered,
  lock: Lock,
  'lock-open': LockOpen,
  layers: Layers,
  'pencil-ruler': PencilRuler,
}

// iconFor resolve o nome do ícone declarado no backend para o componente.
// Fonte única usada pela sidebar, dashboard e cabeçalhos.
export function iconFor(name: string): IconComponent {
  return ICONS[name] ?? Wrench
}
