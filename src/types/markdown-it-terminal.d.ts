declare module 'markdown-it-terminal' {
  import type MarkdownIt from 'markdown-it';
  interface Options {
    width?: number;
    reflowText?: boolean;
    forceHyperlinks?: boolean;
  }
  const plugin: (md: MarkdownIt, opts?: Options) => void;
  export = plugin;
}
