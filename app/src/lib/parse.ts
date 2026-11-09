import { uid, nowISO, type ConversationSnapshot, type CapturedMessage, type ContentBlock, type MessageRole, type PlatformId } from './types';

const ROLE_MARKERS: Array<[RegExp, MessageRole]> = [
  [/^(user|you|me|human|شما|کاربر|من)\s*[:：]/i, 'user'],
  [/^(assistant|ai|bot|chatgpt|claude|gemini|grok|deepseek|copilot|دستیار|هوش مصنوعی|پاسخ)\s*[:：]/i, 'assistant'],
  [/^(system|سیستم)\s*[:：]/i, 'system'],
  [/^(tool|ابزار)\s*[:：]/i, 'tool'],
];

function splitBlocks(text: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const re = /```(\w+)?\n([\s\S]*?)```/g;
  let last = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const before = text.slice(last, m.index).trim();
    if (before) blocks.push({ id: uid(), type: 'paragraph', text: before });
    blocks.push({ id: uid(), type: 'code', text: m[2].replace(/\n$/, ''), language: m[1] || null });
    last = m.index + m[0].length;
  }
  const tail = text.slice(last).trim();
  if (tail) blocks.push({ id: uid(), type: 'paragraph', text: tail });
  return blocks.length ? blocks : [{ id: uid(), type: 'paragraph', text: text.trim() }];
}

/**
 * Parses a pasted transcript. Role is only assigned from explicit markers
 * ("User:", "Assistant:", "شما:", "دستیار:"…) — never from odd/even position.
 * Messages are separated by role markers, or by blank-line groups when no markers exist (role=unknown).
 */
export function parseTranscript(raw: string, title: string, platformId: PlatformId = 'import', sourceURL: string | null = null): ConversationSnapshot {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const chunks: { role: MessageRole; lines: string[] }[] = [];
  let hasMarkers = false;
  for (const l of lines) {
    const hit = ROLE_MARKERS.find(([re]) => re.test(l.trim()));
    if (hit) { hasMarkers = true; chunks.push({ role: hit[1], lines: [l.trim().replace(hit[0], '').trim()] }); }
    else if (chunks.length) chunks[chunks.length - 1].lines.push(l);
    else if (l.trim()) chunks.push({ role: 'unknown', lines: [l] });
  }
  let final = chunks;
  if (!hasMarkers) {
    final = raw.split(/\n\s*\n\s*\n+/).map(p => p.trim()).filter(Boolean).map(p => ({ role: 'unknown' as MessageRole, lines: p.split('\n') }));
  }
  const messages: CapturedMessage[] = final.map((c, i) => {
    const text = c.lines.join('\n').trim();
    const blocks = splitBlocks(text);
    return { id: uid(), index: i, role: c.role, sentAt: null, blocks, plainText: blocks.map(b => b.text).join('\n\n'),
      captureWarnings: c.role === 'unknown' ? ['role_unknown'] : [] };
  }).filter(m => m.plainText.length > 0);
  const warnings: string[] = [];
  if (!hasMarkers) warnings.push('no_role_markers');
  if (messages.length === 0) warnings.push('empty');
  return {
    schemaVersion: 1, id: uid(), platformId, externalConversationId: null, canonicalURL: sourceURL,
    title: title.trim() || (messages[0]?.plainText.slice(0, 40) ?? 'Untitled'), capturedAt: nowISO(),
    captureStatus: messages.length ? 'unknown' : 'failed', completenessReason: 'imported_transcript',
    messages, warnings, adapterVersion: 'import-1.0',
  };
}

/** Clearly-labelled demo snapshot. Never persisted unless the user saves it explicitly. */
export function demoSnapshot(lang: 'fa' | 'en'): ConversationSnapshot {
  const fa = `شما: یک تابع React برای debounce کردن ورودی با useEffect بنویس.
دستیار: حتماً. این یک پیاده‌سازی ساده است:

\`\`\`tsx
function useDebounce<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
\`\`\`

نکات مهم:
- مقدار \`delay\` را بر اساس نوع ورودی تنظیم کنید.
- برای جستجوی API معمولاً **۳۰۰ms** مناسب است.

| گزینه | مقدار پیش‌فرض |
|---|---|
| delay | 300 |
| leading | false |

شما: می‌شود جدول را با نیم‌فاصله درست کنی و منبع هم بدهی؟
دستیار: بله. مستندات رسمی: [React useEffect](https://react.dev/reference/react/useEffect)

> توجه: این نمونه فقط برای نمایش قابلیت‌های A.max است.`;
  const en = `User: Write a React hook that debounces an input with useEffect.
Assistant: Sure — a minimal implementation:

\`\`\`tsx
function useDebounce<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
\`\`\`

Notes:
- Tune \`delay\` to the input type.
- **300ms** is typical for search boxes.

| Option | Default |
|---|---|
| delay | 300 |
| leading | false |

User: Can you link the docs?
Assistant: Yes: [React useEffect](https://react.dev/reference/react/useEffect)

> This sample exists only to demonstrate A.max.`;
  const s = parseTranscript(lang === 'fa' ? fa : en, lang === 'fa' ? 'نمونه: هوک debounce در React' : 'Sample: React debounce hook', 'chatgpt', 'https://chatgpt.com/c/demo-sample');
  s.demo = true; s.captureStatus = 'complete'; s.completenessReason = 'demo_sample';
  return s;
}
