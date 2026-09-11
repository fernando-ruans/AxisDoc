// GERADO pelo backend (testdata/catalog.snapshot.json). NÃO EDITAR.
// Trava anti-drift: o golden por tool valida este snapshot contra o mirror.
// Para regenerar: UPDATE_SNAPSHOT=1 go test . -run TestCatalogContract, depois rode scripts/sync-snapshot.

export const BACKEND_SNAPSHOT = [
 {
  "id": "data.csv2sql",
  "params": [
   {
    "key": "table",
    "label": "param.data.table.label",
    "type": "text",
    "def": "dados",
    "req": true,
    "ph": "param.csv2sql.table.placeholder"
   },
   {
    "key": "dialect",
    "label": "param.data.dialect.label",
    "type": "select",
    "options": [
     "sqlite",
     "postgres",
     "mysql"
    ],
    "def": "sqlite",
    "w": "segmented"
   }
  ]
 },
 {
  "id": "data.json2table",
  "params": [
   {
    "key": "format",
    "label": "param.data.format.label",
    "type": "select",
    "options": [
     "xlsx",
     "csv"
    ],
    "def": "xlsx",
    "req": true,
    "hint": "param.data.format.hint",
    "w": "segmented"
   }
  ]
 },
 {
  "id": "data.jsonformat",
  "params": [
   {
    "key": "mode",
    "label": "param.data.mode.label",
    "type": "select",
    "options": [
     "format",
     "minify"
    ],
    "def": "format",
    "w": "segmented"
   }
  ]
 },
 {
  "id": "data.sql2csv",
  "params": []
 },
 {
  "id": "data.struct",
  "params": [
   {
    "key": "format",
    "label": "param.data.format.label",
    "type": "select",
    "options": [
     "json",
     "yaml",
     "toml"
    ],
    "def": "yaml",
    "req": true,
    "hint": "param.data.format.hint",
    "w": "segmented"
   }
  ]
 },
 {
  "id": "data.tablejson",
  "params": []
 },
 {
  "id": "data.tabular",
  "params": [
   {
    "key": "format",
    "label": "param.data.format.label",
    "type": "select",
    "options": [
     "xlsx",
     "csv"
    ],
    "def": "xlsx",
    "req": true,
    "hint": "param.data.format.hint",
    "w": "segmented"
   }
  ]
 },
 {
  "id": "data.xlsxdiff",
  "params": []
 },
 {
  "id": "img.convert",
  "params": [
   {
    "key": "format",
    "label": "param.img.format.label",
    "type": "select",
    "options": [
     "jpg",
     "png",
     "gif",
     "bmp",
     "tiff"
    ],
    "def": "png",
    "req": true,
    "w": "cards"
   },
   {
    "key": "quality",
    "label": "param.img.quality.label",
    "type": "number",
    "def": 85,
    "min": 1,
    "max": 100,
    "hint": "param.img.quality.hint",
    "vis": {
     "key": "format",
     "equals": "jpg"
    },
    "w": "slider"
   }
  ]
 },
 {
  "id": "img.crop",
  "params": [
   {
    "key": "ratio",
    "label": "param.img.ratio.label",
    "type": "select",
    "options": [
     "free",
     "1:1",
     "4:3",
     "16:9"
    ],
    "def": "free",
    "hint": "param.img.ratio.hint",
    "w": "segmented"
   },
   {
    "key": "x",
    "label": "param.img.x.label",
    "type": "number",
    "def": 0,
    "hint": "param.img.coords.hint"
   },
   {
    "key": "y",
    "label": "param.img.y.label",
    "type": "number",
    "def": 0
   },
   {
    "key": "w",
    "label": "param.img.width.label",
    "type": "number",
    "def": 100,
    "min": 1
   },
   {
    "key": "h",
    "label": "param.img.height.label",
    "type": "number",
    "def": 100,
    "min": 1
   }
  ]
 },
 {
  "id": "img.filters",
  "params": [
   {
    "key": "filter",
    "label": "param.img.filter.label",
    "type": "select",
    "options": [
     "grayscale",
     "invert",
     "blur",
     "sharpen",
     "sepia",
     "contrast",
     "brightness"
    ],
    "def": "grayscale",
    "w": "cards"
   },
   {
    "key": "strength",
    "label": "param.img.strength.label",
    "type": "number",
    "def": 5,
    "max": 10,
    "hint": "param.img.strength.hint",
    "w": "slider"
   }
  ]
 },
 {
  "id": "img.gifbuild",
  "params": [
   {
    "key": "delay",
    "label": "param.gif.delay.label",
    "type": "number",
    "def": 100,
    "min": 20,
    "max": 5000,
    "w": "slider"
   },
   {
    "key": "outputPath",
    "label": "param.outputPath.label",
    "type": "output",
    "def": "animacao.gif"
   }
  ]
 },
 {
  "id": "img.gifextract",
  "params": [
   {
    "key": "outputDir",
    "label": "param.outputDir.label",
    "type": "folder"
   }
  ]
 },
 {
  "id": "img.icon",
  "params": [
   {
    "key": "outputPath",
    "label": "param.outputPath.label",
    "type": "output",
    "def": "icon.ico"
   },
   {
    "key": "sizes",
    "label": "param.img.sizes.label",
    "type": "select",
    "options": [
     "all",
     "16,32,48",
     "16,24,32,48,64",
     "ico16",
     "ico24",
     "ico32",
     "ico48",
     "ico64",
     "ico128",
     "ico256"
    ],
    "def": "all",
    "hint": "param.img.sizes.hint",
    "w": "segmented"
   }
  ]
 },
 {
  "id": "img.palette",
  "params": []
 },
 {
  "id": "img.resize",
  "params": [
   {
    "key": "preset",
    "label": "param.img.preset.label",
    "type": "select",
    "options": [
     "custom",
     "320",
     "800",
     "1920",
     "original"
    ],
    "def": "800",
    "hint": "param.img.preset.hint",
    "w": "segmented"
   },
   {
    "key": "width",
    "label": "param.img.maxwidth.label",
    "type": "number",
    "def": 800,
    "min": 1,
    "max": 20000,
    "vis": {
     "key": "preset",
     "equals": "custom"
    }
   }
  ]
 },
 {
  "id": "img.transform",
  "params": [
   {
    "key": "op",
    "label": "param.img.transform.label",
    "type": "select",
    "options": [
     "rotate90",
     "rotate180",
     "rotate270",
     "flipH",
     "flipV"
    ],
    "def": "rotate90",
    "w": "cards"
   }
  ]
 },
 {
  "id": "img.watermark",
  "params": [
   {
    "key": "kind",
    "label": "param.img.wmkind.label",
    "type": "select",
    "options": [
     "text",
     "image"
    ],
    "def": "text",
    "w": "segmented"
   },
   {
    "key": "text",
    "label": "param.pdf.text.label",
    "type": "text",
    "def": "© AxisDoc",
    "req": true,
    "vis": {
     "key": "kind",
     "equals": "text"
    }
   },
   {
    "key": "opacity",
    "label": "param.img.opacity.label",
    "type": "number",
    "def": 0.3,
    "min": 0.05,
    "max": 1,
    "vis": {
     "key": "kind",
     "equals": "text"
    },
    "w": "slider"
   },
   {
    "key": "image",
    "label": "param.img.wmimage.label",
    "type": "file",
    "vis": {
     "key": "kind",
     "equals": "image"
    },
    "acc": [
     ".png",
     ".jpg",
     ".jpeg"
    ]
   },
   {
    "key": "position",
    "label": "param.img.position.label",
    "type": "select",
    "options": [
     "topLeft",
     "topRight",
     "center",
     "bottomLeft",
     "bottomRight"
    ],
    "def": "bottomRight",
    "vis": {
     "key": "kind",
     "equals": "image"
    },
    "w": "segmented"
   },
   {
    "key": "scale",
    "label": "param.img.wmscale.label",
    "type": "number",
    "def": 20,
    "min": 5,
    "max": 90,
    "vis": {
     "key": "kind",
     "equals": "image"
    },
    "w": "slider"
   }
  ]
 },
 {
  "id": "img.watermarkpos",
  "params": [
   {
    "key": "image",
    "label": "param.img.wmimage.label",
    "type": "file",
    "req": true,
    "acc": [
     ".png",
     ".jpg",
     ".jpeg"
    ]
   },
   {
    "key": "position",
    "label": "param.img.position.label",
    "type": "select",
    "options": [
     "topLeft",
     "topRight",
     "center",
     "bottomLeft",
     "bottomRight"
    ],
    "def": "bottomRight",
    "w": "segmented"
   },
   {
    "key": "scale",
    "label": "param.img.wmscale.label",
    "type": "number",
    "def": 20,
    "min": 5,
    "max": 90,
    "w": "slider"
   }
  ]
 },
 {
  "id": "pdf.addattachments",
  "params": [
   {
    "key": "files",
    "label": "param.pdf.attachfiles.label",
    "type": "file",
    "req": true,
    "hint": "param.pdf.attachfiles.hint",
    "acc": [
     ".pdf",
     ".txt",
     ".png",
     ".jpg",
     ".csv",
     ".xlsx"
    ]
   }
  ]
 },
 {
  "id": "pdf.compress",
  "params": [
   {
    "key": "level",
    "label": "param.pdf.compress.label",
    "type": "select",
    "options": [
     "balanced",
     "max"
    ],
    "def": "balanced",
    "hint": "param.pdf.compress.hint",
    "w": "segmented"
   }
  ]
 },
 {
  "id": "pdf.create",
  "params": [
   {
    "key": "title",
    "label": "param.pdf.doctitle.label",
    "type": "text",
    "def": "",
    "req": true,
    "ph": "param.pdf.doctitle.placeholder"
   },
   {
    "key": "body",
    "label": "param.pdf.docbody.label",
    "type": "textarea",
    "def": "",
    "req": true,
    "ph": "param.pdf.docbody.placeholder"
   },
   {
    "key": "pages",
    "label": "param.pdf.blankpages.label",
    "type": "number",
    "def": 0,
    "max": 50,
    "vis": {
     "key": "title",
     "equals": ""
    },
    "w": "slider"
   },
   {
    "key": "outputPath",
    "label": "param.outputPath.label",
    "type": "output",
    "def": "novo.pdf"
   }
  ]
 },
 {
  "id": "pdf.diff",
  "params": []
 },
 {
  "id": "pdf.extractattachments",
  "params": []
 },
 {
  "id": "pdf.extractfonts",
  "params": [
   {
    "key": "pages",
    "label": "param.pdf.pages.label",
    "type": "text",
    "def": "",
    "ph": "param.pdf.pages.optional",
    "hint": "param.pdf.pages.hint"
   }
  ]
 },
 {
  "id": "pdf.extractimages",
  "params": [
   {
    "key": "pages",
    "label": "param.pdf.pages.label",
    "type": "text",
    "def": "",
    "ph": "param.pdf.pages.optional",
    "hint": "param.pdf.pages.hint"
   }
  ]
 },
 {
  "id": "pdf.extractmetadata",
  "params": []
 },
 {
  "id": "pdf.extracttext",
  "params": []
 },
 {
  "id": "pdf.fromimages",
  "params": [
   {
    "key": "outputPath",
    "label": "param.outputPath.label",
    "type": "output",
    "def": "imagens.pdf",
    "hint": "param.pdffromimages.output.hint"
   },
   {
    "key": "outputDir",
    "label": "param.outputDir.label",
    "type": "folder"
   }
  ]
 },
 {
  "id": "pdf.info",
  "params": []
 },
 {
  "id": "pdf.merge",
  "params": [
   {
    "key": "outputPath",
    "label": "param.outputPath.label",
    "type": "output",
    "def": "merged.pdf",
    "hint": "param.pdfmerge.output.hint"
   }
  ]
 },
 {
  "id": "pdf.nup",
  "params": [
   {
    "key": "n",
    "label": "param.pdf.nup.label",
    "type": "select",
    "options": [
     "2",
     "4",
     "8"
    ],
    "def": "2",
    "w": "cards"
   }
  ]
 },
 {
  "id": "pdf.overlay",
  "params": [
   {
    "key": "overlay",
    "label": "param.pdf.overlay.label",
    "type": "file",
    "req": true,
    "hint": "param.pdf.overlay.hint",
    "acc": [
     ".pdf"
    ]
   },
   {
    "key": "onTop",
    "label": "param.pdf.ontop.label",
    "type": "bool",
    "def": true,
    "w": "switch"
   }
  ]
 },
 {
  "id": "pdf.pagenumbers",
  "params": [
   {
    "key": "start",
    "label": "param.pdf.numstart.label",
    "type": "number",
    "def": 1,
    "min": 1,
    "max": 100000,
    "hint": "param.pdf.numstart.hint"
   },
   {
    "key": "position",
    "label": "param.img.position.label",
    "type": "select",
    "options": [
     "bottomCenter",
     "bottomRight",
     "bottomLeft",
     "topCenter"
    ],
    "def": "bottomCenter",
    "w": "segmented"
   },
   {
    "key": "fontSize",
    "label": "param.pdf.fontsize.label",
    "type": "number",
    "def": 10,
    "min": 6,
    "max": 48,
    "w": "slider"
   }
  ]
 },
 {
  "id": "pdf.permissions",
  "params": []
 },
 {
  "id": "pdf.protect",
  "params": [
   {
    "key": "userPassword",
    "label": "param.pdf.userpw.label",
    "type": "password",
    "def": "",
    "req": true,
    "hint": "param.pdf.userpw.hint"
   },
   {
    "key": "ownerPassword",
    "label": "param.pdf.ownerpw.label",
    "type": "password",
    "def": "",
    "ph": "param.pdf.ownerpw.placeholder"
   },
   {
    "key": "keyLength",
    "label": "param.pdf.keylen.label",
    "type": "select",
    "options": [
     "40",
     "128",
     "256"
    ],
    "def": "256",
    "w": "segmented"
   }
  ]
 },
 {
  "id": "pdf.rearrange",
  "params": [
   {
    "key": "order",
    "label": "param.pdf.order.label",
    "type": "text",
    "def": "",
    "req": true,
    "ph": "param.pdf.order.placeholder",
    "hint": "param.pdf.order.hint"
   }
  ]
 },
 {
  "id": "pdf.removepages",
  "params": [
   {
    "key": "pages",
    "label": "param.pdf.pages.label",
    "type": "text",
    "def": "",
    "req": true,
    "ph": "param.pdf.pages.placeholder",
    "hint": "param.pdf.pages.hint"
   }
  ]
 },
 {
  "id": "pdf.rotate",
  "params": [
   {
    "key": "angle",
    "label": "param.pdf.angle.label",
    "type": "select",
    "options": [
     "90",
     "180",
     "270"
    ],
    "def": "90",
    "w": "segmented"
   }
  ]
 },
 {
  "id": "pdf.split",
  "params": [
   {
    "key": "mode",
    "label": "param.pdf.splitmode.label",
    "type": "select",
    "options": [
     "pages",
     "everyN"
    ],
    "def": "everyN",
    "w": "segmented"
   },
   {
    "key": "n",
    "label": "param.pdf.n.label",
    "type": "number",
    "def": 1,
    "min": 1,
    "max": 1000,
    "vis": {
     "key": "mode",
     "equals": "everyN"
    }
   }
  ]
 },
 {
  "id": "pdf.unlock",
  "params": [
   {
    "key": "password",
    "label": "param.pdf.password.label",
    "type": "password",
    "def": "",
    "req": true
   }
  ]
 },
 {
  "id": "pdf.watermark",
  "params": [
   {
    "key": "kind",
    "label": "param.img.wmkind.label",
    "type": "select",
    "options": [
     "text",
     "image"
    ],
    "def": "text",
    "w": "segmented"
   },
   {
    "key": "text",
    "label": "param.pdf.text.label",
    "type": "text",
    "def": "CONFIDENCIAL",
    "req": true,
    "ph": "param.pdfwm.placeholder",
    "vis": {
     "key": "kind",
     "equals": "text"
    }
   },
   {
    "key": "fontSize",
    "label": "param.pdf.fontsize.label",
    "type": "number",
    "def": 48,
    "min": 6,
    "max": 200,
    "vis": {
     "key": "kind",
     "equals": "text"
    },
    "w": "slider"
   },
   {
    "key": "image",
    "label": "param.img.wmimage.label",
    "type": "file",
    "vis": {
     "key": "kind",
     "equals": "image"
    },
    "acc": [
     ".png",
     ".jpg",
     ".jpeg"
    ]
   },
   {
    "key": "position",
    "label": "param.img.position.label",
    "type": "select",
    "options": [
     "topLeft",
     "topRight",
     "center",
     "bottomLeft",
     "bottomRight"
    ],
    "def": "bottomRight",
    "vis": {
     "key": "kind",
     "equals": "image"
    },
    "w": "segmented"
   },
   {
    "key": "scale",
    "label": "param.img.wmscale.label",
    "type": "number",
    "def": 20,
    "min": 5,
    "max": 90,
    "vis": {
     "key": "kind",
     "equals": "image"
    },
    "w": "slider"
   }
  ]
 },
 {
  "id": "security.hashfile",
  "params": [
   {
    "key": "algorithm",
    "label": "param.algorithm.label",
    "type": "select",
    "options": [
     "sha256",
     "sha512",
     "sha1",
     "md5",
     "crc32"
    ],
    "def": "sha256",
    "req": true,
    "hint": "param.hashfile.algorithm.hint",
    "w": "segmented"
   }
  ]
 },
 {
  "id": "text.barcode",
  "params": [
   {
    "key": "text",
    "label": "param.pdf.text.label",
    "type": "textarea",
    "req": true,
    "ph": "param.barcode.placeholder",
    "hint": "param.barcode.hint"
   },
   {
    "key": "kind",
    "label": "param.text.barkind.label",
    "type": "select",
    "options": [
     "code128",
     "ean13"
    ],
    "def": "code128",
    "w": "segmented"
   },
   {
    "key": "width",
    "label": "param.img.width.label",
    "type": "number",
    "def": 400,
    "min": 50,
    "max": 4000,
    "w": "slider"
   },
   {
    "key": "height",
    "label": "param.img.height.label",
    "type": "number",
    "def": 100,
    "min": 20,
    "max": 1000,
    "w": "slider"
   }
  ]
 },
 {
  "id": "text.baseconvert",
  "params": [
   {
    "key": "value",
    "label": "param.text.value.label",
    "type": "text",
    "def": "",
    "req": true,
    "ph": "param.baseconvert.placeholder"
   },
   {
    "key": "from",
    "label": "param.text.frombase.label",
    "type": "select",
    "options": [
     "10",
     "16",
     "8",
     "2",
     "36"
    ],
    "def": "10",
    "w": "segmented"
   },
   {
    "key": "to",
    "label": "param.text.tobase.label",
    "type": "select",
    "options": [
     "10",
     "16",
     "8",
     "2",
     "36"
    ],
    "def": "16",
    "w": "segmented"
   }
  ]
 },
 {
  "id": "text.columnize",
  "params": [
   {
    "key": "delimiter",
    "label": "param.text.delimiter.label",
    "type": "text",
    "def": "|",
    "ph": "param.columnize.placeholder"
   },
   {
    "key": "padding",
    "label": "param.text.padding.label",
    "type": "number",
    "def": 2,
    "min": 1,
    "max": 20,
    "w": "slider"
   },
   {
    "key": "text",
    "label": "param.columnize.text.label",
    "type": "textarea",
    "def": "",
    "ph": "param.columnize.textplaceholder"
   }
  ]
 },
 {
  "id": "text.diff",
  "params": []
 },
 {
  "id": "text.epoch",
  "params": [
   {
    "key": "mode",
    "label": "param.data.mode.label",
    "type": "select",
    "options": [
     "now",
     "toDate",
     "toEpoch"
    ],
    "def": "now",
    "w": "segmented"
   },
   {
    "key": "value",
    "label": "param.text.value.label",
    "type": "text",
    "def": "",
    "ph": "param.epoch.placeholder",
    "vis": {
     "key": "mode",
     "equals": "toDate"
    }
   },
   {
    "key": "value2",
    "label": "param.text.value.label",
    "type": "text",
    "def": "",
    "ph": "param.epoch.placeholder2",
    "vis": {
     "key": "mode",
     "equals": "toEpoch"
    }
   }
  ]
 },
 {
  "id": "text.escape",
  "params": [
   {
    "key": "kind",
    "label": "param.text.escapekind.label",
    "type": "select",
    "options": [
     "htmlEscape",
     "htmlUnescape",
     "urlEncode",
     "urlDecode",
     "queryEscape"
    ],
    "def": "htmlEscape",
    "w": "segmented"
   },
   {
    "key": "text",
    "label": "param.pdf.text.label",
    "type": "textarea",
    "def": "",
    "ph": "param.escape.placeholder"
   }
  ]
 },
 {
  "id": "text.lorem",
  "params": [
   {
    "key": "paragraphs",
    "label": "param.text.paragraphs.label",
    "type": "number",
    "def": 3,
    "min": 1,
    "max": 100,
    "w": "slider"
   },
   {
    "key": "wordsPerParagraph",
    "label": "param.text.words.label",
    "type": "number",
    "def": 60,
    "min": 5,
    "max": 500,
    "w": "slider"
   }
  ]
 },
 {
  "id": "text.qrcode",
  "params": [
   {
    "key": "text",
    "label": "param.pdf.text.label",
    "type": "textarea",
    "req": true,
    "ph": "param.qrcode.placeholder",
    "hint": "param.qrcode.hint"
   },
   {
    "key": "size",
    "label": "param.img.qrsize.label",
    "type": "number",
    "def": 256,
    "min": 64,
    "max": 2000,
    "w": "slider"
   }
  ]
 },
 {
  "id": "text.rename",
  "params": [
   {
    "key": "pattern",
    "label": "param.text.pattern.label",
    "type": "text",
    "def": "(.*)",
    "req": true,
    "hint": "param.rename.pattern.hint"
   },
   {
    "key": "replacement",
    "label": "param.text.replacement.label",
    "type": "text",
    "def": "$1",
    "req": true,
    "hint": "param.rename.replacement.hint"
   },
   {
    "key": "undo",
    "label": "param.text.undo.label",
    "type": "bool",
    "def": false,
    "w": "switch"
   }
  ]
 },
 {
  "id": "text.slug",
  "params": [
   {
    "key": "text",
    "label": "param.pdf.text.label",
    "type": "textarea",
    "def": "",
    "req": true,
    "ph": "param.slug.placeholder"
   },
   {
    "key": "separator",
    "label": "param.text.separator.label",
    "type": "select",
    "options": [
     "-",
     "_"
    ],
    "def": "-",
    "w": "segmented"
   }
  ]
 },
 {
  "id": "text.stats",
  "params": []
 },
 {
  "id": "text.uuid",
  "params": [
   {
    "key": "count",
    "label": "param.text.count.label",
    "type": "number",
    "def": 1,
    "min": 1,
    "max": 1000,
    "w": "slider"
   },
   {
    "key": "version",
    "label": "param.text.uuidver.label",
    "type": "select",
    "options": [
     "v4",
     "v7"
    ],
    "def": "v4",
    "w": "segmented"
   }
  ]
 }
] as const;
