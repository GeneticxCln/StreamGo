declare module '@fluent/bundle' {
  export class FluentBundle {
    constructor(locale: string);
    getMessage(key: string): any;
    formatPattern(pattern: any, args?: any): string;
    addResource(res: any): any[];
  }
  export class FluentResource {
    constructor(src: string);
  }
}

declare interface ImportMeta {
  glob: any;
}
