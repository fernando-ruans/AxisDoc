export namespace main {
	
	export class PageRotation {
	    page: number;
	    angle: number;
	
	    static createFrom(source: any = {}) {
	        return new PageRotation(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.page = source["page"];
	        this.angle = source["angle"];
	    }
	}
	export class PreviewRef {
	    token: string;
	    name: string;
	    path: string;
	
	    static createFrom(source: any = {}) {
	        return new PreviewRef(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.token = source["token"];
	        this.name = source["name"];
	        this.path = source["path"];
	    }
	}
	export class PreviewSummary {
	    kind: string;
	    rows: number;
	    cols: number;
	    sample: string[][];
	    pages: number;
	    title: string;
	
	    static createFrom(source: any = {}) {
	        return new PreviewSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.kind = source["kind"];
	        this.rows = source["rows"];
	        this.cols = source["cols"];
	        this.sample = source["sample"];
	        this.pages = source["pages"];
	        this.title = source["title"];
	    }
	}
	export class ToolInfo {
	    id: string;
	    category: string;
	    titleKey: string;
	    descKey: string;
	    icon: string;
	    stepNames: string[];
	    params: tool.Param[];
	
	    static createFrom(source: any = {}) {
	        return new ToolInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.category = source["category"];
	        this.titleKey = source["titleKey"];
	        this.descKey = source["descKey"];
	        this.icon = source["icon"];
	        this.stepNames = source["stepNames"];
	        this.params = this.convertValues(source["params"], tool.Param);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class watchRuleOut {
	    id: string;
	    folder: string;
	    pattern: string;
	    pipeline: pipeline.Pipeline;
	
	    static createFrom(source: any = {}) {
	        return new watchRuleOut(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.folder = source["folder"];
	        this.pattern = source["pattern"];
	        this.pipeline = this.convertValues(source["pipeline"], pipeline.Pipeline);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace pipeline {
	
	export class PipelineStep {
	    toolId: string;
	    params: Record<string, any>;
	
	    static createFrom(source: any = {}) {
	        return new PipelineStep(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.toolId = source["toolId"];
	        this.params = source["params"];
	    }
	}
	export class Pipeline {
	    id: string;
	    name: string;
	    steps: PipelineStep[];
	
	    static createFrom(source: any = {}) {
	        return new Pipeline(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.steps = this.convertValues(source["steps"], PipelineStep);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class RunResult {
	    paths: string[];
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new RunResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.paths = source["paths"];
	        this.message = source["message"];
	    }
	}

}

export namespace store {
	
	export class Job {
	    id: string;
	    toolId: string;
	    status: string;
	    input: Record<string, any>;
	    output?: Record<string, any>;
	    error?: string;
	    progress: number;
	    // Go type: time
	    createdAt: any;
	    // Go type: time
	    updatedAt: any;
	
	    static createFrom(source: any = {}) {
	        return new Job(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.toolId = source["toolId"];
	        this.status = source["status"];
	        this.input = source["input"];
	        this.output = source["output"];
	        this.error = source["error"];
	        this.progress = source["progress"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	        this.updatedAt = this.convertValues(source["updatedAt"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace tool {
	
	export class VisibleIf {
	    key: string;
	    equals: any;
	
	    static createFrom(source: any = {}) {
	        return new VisibleIf(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.equals = source["equals"];
	    }
	}
	export class Param {
	    key: string;
	    label: string;
	    type: string;
	    options?: string[];
	    default?: any;
	    required?: boolean;
	    min?: number;
	    max?: number;
	    placeholder?: string;
	    hint?: string;
	    visibleIf?: VisibleIf;
	    accept?: string[];
	    widget?: string;
	
	    static createFrom(source: any = {}) {
	        return new Param(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.label = source["label"];
	        this.type = source["type"];
	        this.options = source["options"];
	        this.default = source["default"];
	        this.required = source["required"];
	        this.min = source["min"];
	        this.max = source["max"];
	        this.placeholder = source["placeholder"];
	        this.hint = source["hint"];
	        this.visibleIf = this.convertValues(source["visibleIf"], VisibleIf);
	        this.accept = source["accept"];
	        this.widget = source["widget"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

