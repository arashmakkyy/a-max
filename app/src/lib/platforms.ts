import type { PlatformId } from './types';

export type SupportStatus = 'tested' | 'experimental' | 'loginRequired' | 'unavailable';
export type PageState = 'supported' | 'unsupported' | 'notConversation';

export interface PlatformDef {
  id: PlatformId;
  name: string;
  domains: string[];
  officialUrl: string;
  status: SupportStatus;
  group: 'chat' | 'research' | 'other';
  /** Strict matcher on host + path + query. Never a plain substring match. */
  matches: (u: URL) => PageState;
  capabilities: string[];
  lastVerifiedAt: string | null;
  color: string;
}

const host = (u: URL, ...hosts: string[]) => hosts.some(h => u.hostname === h || u.hostname.endsWith('.' + h));

const def = (p: Omit<PlatformDef, 'capabilities' | 'lastVerifiedAt' | 'color'> & Partial<PlatformDef>): PlatformDef => ({
  capabilities: ['capture', 'promptGuard', 'rtlRepair', 'singleMessageExport'],
  lastVerifiedAt: null,
  color: '#14B8A6',
  ...p,
});

export const PLATFORMS: PlatformDef[] = [
  def({ id: 'chatgpt', name: 'ChatGPT', domains: ['chatgpt.com', 'chat.openai.com'], officialUrl: 'https://chatgpt.com', status: 'experimental', group: 'chat', color: '#10A37F',
    matches: u => host(u, 'chatgpt.com', 'chat.openai.com') ? (u.pathname === '/' || u.pathname.startsWith('/c/') || u.pathname.startsWith('/g/') ? 'supported' : 'notConversation') : 'unsupported' }),
  def({ id: 'claude', name: 'Claude', domains: ['claude.ai'], officialUrl: 'https://claude.ai', status: 'experimental', group: 'chat', color: '#D97757',
    matches: u => host(u, 'claude.ai') ? (u.pathname.startsWith('/chat') || u.pathname.startsWith('/new') || u.pathname === '/' ? 'supported' : 'notConversation') : 'unsupported' }),
  def({ id: 'gemini', name: 'Google Gemini', domains: ['gemini.google.com'], officialUrl: 'https://gemini.google.com', status: 'experimental', group: 'chat', color: '#4E8CF5',
    matches: u => host(u, 'gemini.google.com') ? (u.pathname.startsWith('/app') ? 'supported' : 'notConversation') : 'unsupported' }),
  def({ id: 'grok', name: 'Grok', domains: ['grok.com'], officialUrl: 'https://grok.com', status: 'experimental', group: 'chat', color: '#E2E8F0',
    matches: u => host(u, 'grok.com') ? 'supported' : 'unsupported' }),
  def({ id: 'deepseek', name: 'DeepSeek', domains: ['chat.deepseek.com'], officialUrl: 'https://chat.deepseek.com', status: 'experimental', group: 'chat', color: '#4D6BFE',
    capabilities: ['capture', 'promptGuard', 'rtlRepair', 'singleMessageExport', 'thinking'],
    matches: u => host(u, 'chat.deepseek.com') ? 'supported' : 'unsupported' }),
  def({ id: 'perplexity', name: 'Perplexity', domains: ['perplexity.ai'], officialUrl: 'https://www.perplexity.ai', status: 'experimental', group: 'research', color: '#20B8CD',
    matches: u => host(u, 'perplexity.ai') ? (u.pathname === '/' || u.pathname.startsWith('/search') ? 'supported' : 'notConversation') : 'unsupported' }),
  def({ id: 'qwen', name: 'Qwen', domains: ['chat.qwen.ai', 'qianwen.com', 'tongyi.aliyun.com'], officialUrl: 'https://chat.qwen.ai', status: 'experimental', group: 'chat', color: '#615CED',
    matches: u => host(u, 'chat.qwen.ai', 'qianwen.com', 'tongyi.aliyun.com') ? 'supported' : 'unsupported' }),
  def({ id: 'kimi', name: 'Kimi', domains: ['kimi.com', 'kimi.ai', 'kimi.moonshot.cn'], officialUrl: 'https://kimi.com', status: 'experimental', group: 'chat', color: '#2F7CF6',
    matches: u => host(u, 'kimi.com', 'kimi.ai', 'kimi.moonshot.cn') ? 'supported' : 'unsupported' }),
  def({ id: 'copilot', name: 'Microsoft Copilot', domains: ['copilot.microsoft.com', 'copilot.com'], officialUrl: 'https://copilot.microsoft.com', status: 'experimental', group: 'chat', color: '#7A5AF8',
    matches: u => host(u, 'copilot.microsoft.com', 'copilot.com') ? 'supported' : 'unsupported' }),
  def({ id: 'm365copilot', name: 'Microsoft 365 Copilot', domains: ['m365.cloud.microsoft'], officialUrl: 'https://m365.cloud.microsoft/chat', status: 'loginRequired', group: 'other', color: '#0F6CBD',
    matches: u => host(u, 'm365.cloud.microsoft') ? (u.pathname.startsWith('/chat') ? 'supported' : 'notConversation') : 'unsupported' }),
  def({ id: 'githubcopilot', name: 'GitHub Copilot', domains: ['github.com/copilot'], officialUrl: 'https://github.com/copilot', status: 'loginRequired', group: 'other', color: '#8B949E',
    matches: u => u.hostname === 'github.com' ? (u.pathname === '/copilot' || u.pathname.startsWith('/copilot/') ? 'supported' : 'unsupported') : 'unsupported' }),
  def({ id: 'poe', name: 'Poe', domains: ['poe.com'], officialUrl: 'https://poe.com', status: 'experimental', group: 'chat', color: '#A78BFA',
    matches: u => host(u, 'poe.com') ? (u.pathname.startsWith('/chat') || u.pathname === '/' ? 'supported' : 'notConversation') : 'unsupported' }),
  def({ id: 'googleaistudio', name: 'Google AI Studio', domains: ['aistudio.google.com'], officialUrl: 'https://aistudio.google.com', status: 'experimental', group: 'other', color: '#3B82F6',
    matches: u => host(u, 'aistudio.google.com') ? (u.pathname.startsWith('/prompts') || u.pathname.startsWith('/app') ? 'supported' : 'notConversation') : 'unsupported' }),
  def({ id: 'notebooklm', name: 'NotebookLM', domains: ['notebooklm.google.com', 'notebook.google.com'], officialUrl: 'https://notebooklm.google.com', status: 'experimental', group: 'research', color: '#F59E0B',
    matches: u => host(u, 'notebooklm.google.com', 'notebook.google.com') ? (u.pathname.startsWith('/notebook/') ? 'supported' : 'notConversation') : 'unsupported' }),
  def({ id: 'xgrok', name: 'Grok on X', domains: ['x.com/i/grok'], officialUrl: 'https://x.com/i/grok', status: 'loginRequired', group: 'chat', color: '#E2E8F0',
    matches: u => (u.hostname === 'x.com' || u.hostname === 'twitter.com') ? (u.pathname === '/i/grok' || u.pathname.startsWith('/i/grok/') ? 'supported' : 'unsupported') : 'unsupported' }),
  def({ id: 'mistral', name: 'Mistral Le Chat', domains: ['chat.mistral.ai'], officialUrl: 'https://chat.mistral.ai', status: 'experimental', group: 'chat', color: '#F97316',
    matches: u => host(u, 'chat.mistral.ai') ? 'supported' : 'unsupported' }),
  def({ id: 'huggingchat', name: 'HuggingChat', domains: ['huggingface.co/chat'], officialUrl: 'https://huggingface.co/chat', status: 'experimental', group: 'chat', color: '#FFD21E',
    matches: u => u.hostname === 'huggingface.co' ? (u.pathname === '/chat' || u.pathname.startsWith('/chat/') ? 'supported' : 'unsupported') : 'unsupported' }),
  def({ id: 'doubao', name: 'Doubao', domains: ['doubao.com'], officialUrl: 'https://www.doubao.com', status: 'experimental', group: 'chat', color: '#3B82F6',
    matches: u => host(u, 'doubao.com') ? (u.pathname.startsWith('/chat') ? 'supported' : 'notConversation') : 'unsupported' }),
  def({ id: 'yuanbao', name: 'Tencent Yuanbao', domains: ['yuanbao.tencent.com'], officialUrl: 'https://yuanbao.tencent.com', status: 'experimental', group: 'chat', color: '#22D3EE',
    matches: u => host(u, 'yuanbao.tencent.com') ? (u.pathname.startsWith('/chat') ? 'supported' : 'notConversation') : 'unsupported' }),
  def({ id: 'googlesearch', name: 'Google Search AI Mode', domains: ['google.com/search?udm=50'], officialUrl: 'https://www.google.com/search?udm=50', status: 'experimental', group: 'research', color: '#34A853',
    matches: u => (/^(www\.)?google\.[a-z.]+$/.test(u.hostname) && u.pathname === '/search' && u.searchParams.get('udm') === '50') ? 'supported' : 'unsupported' }),
];

export const platformById = (id: PlatformId) => PLATFORMS.find(p => p.id === id);
export const platformName = (id: PlatformId) => id === 'import' ? 'Imported' : (platformById(id)?.name ?? id);

export interface DetectResult { platform: PlatformDef | null; state: PageState | 'invalid'; }
export function detectPlatform(url: string): DetectResult {
  let u: URL;
  try { u = new URL(url); } catch { return { platform: null, state: 'invalid' }; }
  for (const p of PLATFORMS) {
    const r = p.matches(u);
    if (r !== 'unsupported') return { platform: p, state: r };
  }
  return { platform: null, state: 'unsupported' };
}

/** Negative self-test used by the Sites tab to demonstrate strict matching. */
export const NEGATIVE_URLS = [
  'https://github.com/arash/repo', 'https://x.com/home', 'https://huggingface.co/models', 'https://www.google.com/search?q=test',
];
