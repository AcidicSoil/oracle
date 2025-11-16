import { Marked } from 'marked';
import TerminalRenderer from 'marked-terminal';

const terminalRenderer = new TerminalRenderer({
  reflowText: false,
  width: process.stdout.columns ? Math.max(20, process.stdout.columns - 2) : undefined,
  tab: 2,
});

// Marked v15 validates renderer keys; supply only the supported render functions.
const allowedKeys = [
  'code',
  'blockquote',
  'html',
  'heading',
  'hr',
  'list',
  'listitem',
  'checkbox',
  'paragraph',
  'table',
  'tablerow',
  'tablecell',
  'strong',
  'em',
  'codespan',
  'br',
  'del',
  'link',
  'image',
  'text',
];

const filteredRenderer: Record<string, unknown> = {};
for (const key of allowedKeys) {
  const fn = (terminalRenderer as unknown as Record<string, unknown>)[key];
  if (typeof fn === 'function') {
    filteredRenderer[key] = (fn as (...args: unknown[]) => unknown).bind(terminalRenderer);
  }
}

const markedWithTerminal = new Marked({ renderer: filteredRenderer });
// Ensure the bound renderer has access to the parser instance Marked creates.
(terminalRenderer as unknown as { parser?: unknown }).parser = (markedWithTerminal as unknown as { parser?: unknown }).parser;

/**
 * Render markdown to ANSI-colored text suitable for a TTY.
 */
export function renderMarkdownAnsi(markdown: string): string {
  return markedWithTerminal.parse(markdown) as string;
}
