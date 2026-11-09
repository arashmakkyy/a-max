/**
 * Real export pipeline.
 *
 * - md / txt / json / csv / html → the PRD generators (exactly what the preview shows)
 * - pdf                          → print host → Chrome "Save as PDF" (searchable text)
 * - docx                         → the shared OOXML engine (real Word document)
 * - png                          → the shared long-image engine (canvas render)
 */
import { buildFileName, downloadBlob, generate, selectedMessages, toHtml, type ExportInput } from './export';
import { chromeApi, extensionUrl, isExtension, openPrintTab } from './chrome';
import type { CapturedMessage, DocTheme, ExportFormat, ExportOptions, ConversationSnapshot } from './types';

type EngineBridge = {
  exportAs: (format: string, chat: unknown, settings: unknown) => Promise<{ ok?: boolean; filename?: string }>;
};

const ENGINE_FILES = [
  'util.js', 'extract.js', 'sites.js', 'format.js', 'zip.js', 'docx.js', 'image.js', 'bundle.js', 'engine-bridge.js',
];

let enginePromise: Promise<EngineBridge> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-am-engine="${src}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('ENGINE_LOAD_FAILED')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.dataset.amEngine = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('ENGINE_LOAD_FAILED'));
    document.head.appendChild(script);
  });
}

/** Lazily loads the classic engine scripts (MV3 forbids inline scripts, so they are injected). */
export function ensureEngine(): Promise<EngineBridge> {
  const ready = (globalThis as any).AMTool?.engine as EngineBridge | undefined;
  if (ready) return Promise.resolve(ready);
  if (!enginePromise) {
    enginePromise = (async () => {
      const base = isExtension() ? extensionUrl('dist/engine/') : './engine/';
      for (const file of ENGINE_FILES) {
        await loadScript(`${base}${file}`);
      }
      const bridge = (globalThis as any).AMTool?.engine as EngineBridge | undefined;
      if (!bridge) throw new Error('ENGINE_UNAVAILABLE');
      return bridge;
    })();
    enginePromise.catch(() => {
      enginePromise = null;
    });
  }
  return enginePromise;
}

const ENGINE_THEME: Record<DocTheme, string> = {
  light: 'light',
  dark: 'dark',
  note: 'note',
  oldpaper: 'old_paper',
  sakura: 'sakura',
  bluemist: 'blue_mist',
  freshgreen: 'fresh_green',
  lavender: 'lavender',
};

/** Re-assembles the markdown of one message so the engine receives true source text. */
function messageMarkdown(message: CapturedMessage, includeThinking: boolean): string {
  return message.blocks
    .filter(block => block.type !== 'thinking' || includeThinking)
    .map(block => {
      if (block.type === 'code') return `\`\`\`${block.language || ''}\n${block.text}\n\`\`\``;
      if (block.type === 'thinking') return `> ${block.text.split('\n').join('\n> ')}`;
      return block.text;
    })
    .join('\n\n')
    .trim();
}

function chatDocument(input: ExportInput, options: ExportOptions) {
  const messages: Array<{ role: string; markdown: string; content: string; sentAt: string | null }> = [];
  input.snapshots.forEach(snapshot => {
    selectedMessages(snapshot, input.selection?.get(snapshot.id) ?? null).forEach(message => {
      messages.push({
        // Only the four evidenced roles are forwarded; anything else stays
        // `unknown` so the exported file never invents an author.
        role: message.role === 'user' || message.role === 'system' || message.role === 'tool' ? message.role : message.role === 'assistant' ? 'assistant' : 'unknown',
        markdown: messageMarkdown(message, options.includeThinking),
        content: message.plainText,
        sentAt: message.sentAt,
      });
    });
  });
  const first: ConversationSnapshot | undefined = input.snapshots[0];
  return {
    title: input.collectionTitle || first?.title || 'A.max export',
    url: first?.canonicalURL || '',
    platformName: first?.platformId || 'AI',
    platformId: first?.platformId || 'ai',
    createdAt: first?.capturedAt || '',
    messages,
  };
}

function engineSettings(lang: 'fa' | 'en', options: ExportOptions) {
  return {
    language: lang,
    exportTheme: ENGINE_THEME[options.theme] || 'light',
    includeThinkingContent: options.includeThinking,
    showMessageTimestamp: options.includeTimestamps,
    pdfFormat: options.paperSize,
    pdfOrientation: options.orientation,
    pdfShowPageNumbers: options.pageNumbers,
  };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error || new Error('READ_FAILED'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Confirms with the downloads API that the item really started (or finished),
 * instead of assuming the callback alone means success. Large files are allowed
 * to keep running in the background once the start is confirmed.
 */
function confirmDownload(id: number): Promise<boolean> {
  const api = chromeApi();
  if (!api?.downloads?.search) return Promise.resolve(true);
  return new Promise(resolve => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      try { api.downloads.onChanged?.removeListener(onChange); } catch { /* ignore */ }
      resolve(ok);
    };
    const onChange = (delta: { id?: number; state?: { current?: string }; error?: { current?: string } }) => {
      if (delta?.id !== id) return;
      if (delta.state?.current === 'interrupted' || delta.error?.current) finish(false);
      else if (delta.state?.current === 'complete') finish(true);
    };
    try { api.downloads.onChanged?.addListener(onChange); } catch { /* listen is optional */ }
    try {
      api.downloads.search({ id }, (items: Array<{ state?: string; error?: string }> | undefined) => {
        const failure = api.runtime?.lastError;
        const item = items?.[0];
        if (failure || !item) return finish(false);
        if (item.state === 'interrupted' || item.error) return finish(false);
        if (item.state === 'in_progress' || item.state === 'complete') return finish(true);
        finish(false);
      });
    } catch {
      finish(false);
    }
    // Never keep the UI locked if the API never answers.
    window.setTimeout(() => finish(false), 8000);
  });
}

/** Downloads through chrome.downloads so the file survives the popup closing. */
export async function downloadText(content: string, mime: string, filename: string): Promise<boolean> {
  const api = chromeApi();
  if (api?.downloads?.download) {
    try {
      const blob = new Blob([content], { type: mime });
      const base64 = await blobToBase64(blob);
      const id = await new Promise<number>((resolve, reject) => {
        api.downloads.download({ url: `data:${mime};base64,${base64}`, filename, saveAs: false }, (downloadId: number) => {
          const error = api.runtime?.lastError;
          if (error) reject(new Error(error.message));
          else resolve(downloadId);
        });
      });
      return Number.isFinite(id) ? confirmDownload(id) : false;
    } catch {
      /* fall back to the anchor download below */
    }
  }
  const result = await downloadBlob(content, mime, filename);
  return result.ok;
}

export interface ExportResult {
  ok: boolean;
  code?: string;
  filename?: string;
  printTab?: boolean;
}

export async function exportConversation(
  input: ExportInput,
  options: ExportOptions,
  lang: 'fa' | 'en',
): Promise<ExportResult> {
  const total = input.snapshots.reduce(
    (count, snapshot) => count + selectedMessages(snapshot, input.selection?.get(snapshot.id) ?? null).length,
    0,
  );
  if (!total) return { ok: false, code: 'NO_MESSAGES' };

  const filename = buildFileName(input.snapshots, options, input.collectionTitle);

  try {
    if (options.format === 'pdf') {
      const html = toHtml(input, options, false);
      const opened = await openPrintTab(html, filename.replace(/\.[a-z0-9]+$/i, '.pdf'));
      return opened ? { ok: true, filename, printTab: true } : { ok: false, code: 'DOWNLOAD_FAILED' };
    }

    if (options.format === 'docx' || options.format === 'png') {
      const bridge = await ensureEngine();
      const result = await bridge.exportAs(options.format, chatDocument(input, options), engineSettings(lang, options));
      if (!result || result.ok === false) return { ok: false, code: 'DOWNLOAD_FAILED' };
      return { ok: true, filename: result.filename || filename };
    }

    const generated = generate(input, options);
    if (!generated.ok) return { ok: false, code: generated.code };
    const saved = await downloadText(generated.content, generated.mime, filename);
    return saved ? { ok: true, filename } : { ok: false, code: 'DOWNLOAD_FAILED' };
  } catch (error) {
    const code = error instanceof Error && error.message === 'ENGINE_UNAVAILABLE' ? 'RENDER_FAILURE' : 'DOWNLOAD_FAILED';
    return { ok: false, code };
  }
}

export const ENGINE_FORMATS: ExportFormat[] = ['pdf', 'docx', 'png'];
