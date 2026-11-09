export interface NormalizeOps {
  arabicLetters: boolean;   // ي→ی , ك→ک
  halfSpace: boolean;       // می / نمی prefixes + common suffixes
  faToEnDigits: boolean;
  enToFaDigits: boolean;
}

export const DEFAULT_OPS: NormalizeOps = { arabicLetters: true, halfSpace: true, faToEnDigits: false, enToFaDigits: false };

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const ZWNJ = '\u200C';

/** Segments that must never be rewritten: code fences, inline code, URLs, emails, LaTeX. */
const PROTECTED = /(```[\s\S]*?```|`[^`\n]*`|https?:\/\/[^\s)]+|www\.[^\s)]+|[\w.+-]+@[\w-]+\.[\w.-]+|\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g;

export interface NormalizeResult { text: string; changed: number; protectedSegments: number; warnings: string[]; }

function normalizeSegment(seg: string, ops: NormalizeOps): string {
  let s = seg;
  if (ops.arabicLetters) s = s.replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/ۀ/g, 'هٔ');
  if (ops.halfSpace) {
    // می / نمی prefix followed by a space and a Persian word
    s = s.replace(/\b(ن?می)\s+(?=[\u0600-\u06FF])/g, `$1${ZWNJ}`);
    // common plural / suffixes: ها، های، تر، ترین
    s = s.replace(/([\u0600-\u06FF])\s+(ها|های|هایی|تر|ترین)\b/g, `$1${ZWNJ}$2`);
  }
  if (ops.faToEnDigits) {
    s = s.replace(/[۰-۹]/g, d => String(FA_DIGITS.indexOf(d))).replace(/[٠-٩]/g, d => String(AR_DIGITS.indexOf(d)));
  } else if (ops.enToFaDigits) {
    s = s.replace(/[0-9]/g, d => FA_DIGITS[Number(d)]);
  }
  // collapse runs of 3+ spaces; paragraph structure and segment boundaries are preserved
  s = s.replace(/ {3,}/g, '  ');
  return s;
}

export function normalizePersian(input: string, ops: NormalizeOps = DEFAULT_OPS): NormalizeResult {
  const warnings: string[] = [];
  let protectedSegments = 0;
  const parts = input.split(PROTECTED);
  const out = parts.map((part, i) => {
    if (i % 2 === 1) { protectedSegments++; return part; } // protected capture groups land on odd indices
    return normalizeSegment(part, ops);
  }).join('');
  let changed = 0;
  const len = Math.max(input.length, out.length);
  for (let i = 0; i < len; i++) if (input[i] !== out[i]) changed++;
  if (protectedSegments) warnings.push('protected');
  if ((ops.faToEnDigits || ops.enToFaDigits) && /\d{6,}|[۰-۹]{6,}/.test(input)) warnings.push('longNumbers');
  return { text: out, changed, protectedSegments, warnings };
}

/** Pure presentation helper: decides direction for a text without altering it. */
export function detectDirection(text: string): 'rtl' | 'ltr' {
  const first = text.match(/[\u0600-\u06FF\u0750-\u077FA-Za-z]/);
  if (!first) return 'ltr';
  return /[\u0600-\u06FF\u0750-\u077F]/.test(first[0]) ? 'rtl' : 'ltr';
}

/** Search normalization: used only for matching, never mutates source text. */
export const searchKey = (t: string) => t.replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/\u200C/g, ' ').replace(/\s+/g, ' ').toLowerCase();
