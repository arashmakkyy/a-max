/**
 * The Studio preview renders inside a sandboxed iframe, so it cannot reach the
 * extension's font files by URL and must never fall back to Google Fonts (the
 * build has to work offline). The self-hosted Vazirmatn subsets are inlined
 * once per page instead.
 */
import { extensionUrl, isExtension } from './chrome';

let cached: Promise<string> | null = null;

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function build(): Promise<string> {
  const base = isExtension() ? extensionUrl('dist/fonts/') : './fonts/';
  const response = await fetch(`${base}fonts.css`);
  if (!response.ok) return '';
  const css = await response.text();
  const files = [...new Set([...css.matchAll(/url\(['"]?\.\/([^'")]+)['"]?\)/g)].map(match => match[1]))];
  const inlined = new Map<string, string>();
  await Promise.all(files.map(async file => {
    try {
      const font = await fetch(`${base}${file}`);
      if (!font.ok) return;
      inlined.set(file, `data:font/woff2;base64,${toBase64(await font.arrayBuffer())}`);
    } catch {
      /* one missing subset must not break the preview */
    }
  }));
  return css.replace(/url\(['"]?\.\/([^'")]+)['"]?\)/g, (whole, file: string) => (
    inlined.has(file) ? `url(${inlined.get(file)})` : whole
  ));
}

/** Returns the self-hosted @font-face block with data: URLs (empty on failure). */
export function previewFontCss(): Promise<string> {
  if (!cached) cached = build().catch(() => '');
  return cached;
}
