import { useCallback, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { StoreProvider, useStore } from './lib/store';
import { NavCtx, type Nav, type StudioInput, type Surface } from './lib/nav';
import { useT } from './lib/i18n';
import { I, Icon } from './components/ui';
import { Popup } from './surfaces/Popup';
import { Studio } from './surfaces/Studio';
import { SidePanel } from './surfaces/SidePanel';
import { Settings } from './surfaces/Settings';
import { CaptureProvider, useCapture } from './lib/capture';
import { copyText } from './lib/export';
import {
  ensureContentScript, getActiveTab, openSettingsPage, openSidePanel, openStudioTab,
  sendToTab, sessionSet,
} from './lib/chrome';

export type BootSurface = Exclude<Surface, 'inpage'>;

/** Reads `#popup` / `?surface=popup` so one built page can serve every entry point. */
export function readSurface(): BootSurface {
  const fromHash = location.hash.replace(/^#\/?/, '').split('?')[0].trim();
  const fromQuery = new URLSearchParams(location.search).get('surface') || '';
  const raw = (fromHash || fromQuery).toLowerCase();
  if (raw === 'studio' || raw === 'sidepanel' || raw === 'settings') return raw;
  return 'popup';
}

function Shell({ boot }: { boot: BootSurface }) {
  const s = useStore();
  const T = useT(s.lang);
  const capture = useCapture();
  const [surface, setSurface] = useState<Surface>(boot);
  const [studioInput, setStudioInput] = useState<StudioInput | null>(null);
  const [panelTab, setPanelTab] = useState<'collections' | 'vault' | 'cache'>('collections');
  const [composerText, setComposerTextState] = useState('');
  const composerRef = useRef('');

  const setComposerText = useCallback((text: string) => {
    composerRef.current = text;
    setComposerTextState(text);
  }, []);

  /** Drops the prepared text into the live composer of the active chat page. */
  const pushComposerText = useCallback(async () => {
    const text = composerRef.current;
    if (!text.trim()) return;
    const tab = await getActiveTab();
    if (tab) {
      const alive = await ensureContentScript(tab.id);
      if (alive) {
        const result = await sendToTab<{ ok?: boolean }>(tab.id, { type: 'RESTORE_PROMPT_TO_INPUT', content: text });
        if (result?.ok) {
          s.toast('success', T('composerFilled'));
          if (boot === 'popup') window.close();
          return;
        }
      }
    }
    const copied = await copyText(text);
    s.toast(copied ? 'success' : 'error', copied ? T('composerCopied') : T('copyFailed'));
    if (copied && boot === 'popup') window.close();
  }, [boot, s, T]);

  const go = useCallback((next: Surface) => {
    if (next === 'inpage') {
      void pushComposerText();
      return;
    }
    if (next === 'sidepanel' && boot === 'popup') {
      void openSidePanel().then(opened => {
        if (opened) window.close();
        else setSurface('sidepanel');
      });
      return;
    }
    if (next === 'settings' && boot === 'popup') {
      void openSettingsPage().then(() => window.close());
      return;
    }
    if (next === 'popup' && boot === 'sidepanel') {
      window.close();
      return;
    }
    setSurface(next);
  }, [boot, pushComposerText]);

  const openStudio = useCallback((input: StudioInput) => {
    void (async () => {
      const snapshots = input.snapshots.length ? input.snapshots : (s.current ? [s.current] : []);
      if (!snapshots.length) {
        s.toast('warning', T('noConversation'));
        return;
      }
      // Each Studio tab gets its own hand-off record so opening two of them
      // cannot make one tab show the other tab's conversation.
      const handoffId = `h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      await sessionSet(`amtool:studio:handoff:${handoffId}`, {
        snapshots,
        collectionTitle: input.collectionTitle,
        tabId: capture.tabId,
        pageUrl: capture.pageUrl,
        at: Date.now(),
      });
      setStudioInput({ ...input, snapshots });
      await openStudioTab(handoffId, capture.tabId);
      if (boot === 'popup') window.close();
    })();
  }, [boot, capture.pageUrl, capture.tabId, s, T]);

  const nav = useMemo<Nav>(() => ({
    surface, go, openStudio, studioInput, panelTab, setPanelTab, composerText, setComposerText,
  }), [surface, go, openStudio, studioInput, panelTab, composerText, setComposerText]);

  return (
    <NavCtx.Provider value={nav}>
      <div className="flex h-full flex-col bg-bg">
        <div className="min-h-0 flex-1 overflow-hidden">
          {surface === 'popup' && <Popup pageUrl={capture.pageUrl} />}
          {surface === 'sidepanel' && <SidePanel />}
          {surface === 'settings' && <Settings />}
          {surface === 'studio' && <Studio />}
        </div>

        <div className="pointer-events-none fixed bottom-4 start-1/2 z-[60] flex -translate-x-1/2 flex-col gap-2" aria-live="polite" role="status">
          {s.toasts.map(t => (
            <div key={t.id} className={clsx('pointer-events-auto flex items-center gap-2 rounded-[10px] border px-3.5 py-2 text-[13px] shadow-xl bg-raised',
              t.kind === 'success' && 'border-success/40 text-success',
              t.kind === 'error' && 'border-error/40 text-error',
              t.kind === 'warning' && 'border-warning/40 text-warning',
              t.kind === 'info' && 'border-border text-text')}>
              <Icon d={t.kind === 'success' ? I.check : t.kind === 'error' ? I.x : I.info} size={15} />
              <span className="text-text">{t.text}</span>
              <button onClick={() => s.dismissToast(t.id)} className="ms-1 text-muted hover:text-text" aria-label="close"><Icon d={I.x} size={13} /></button>
            </div>
          ))}
        </div>
      </div>
    </NavCtx.Provider>
  );
}

export default function App() {
  const boot = useMemo(readSurface, []);
  const autoCapture = boot === 'popup' || boot === 'sidepanel';
  return (
    <StoreProvider>
      <CaptureProvider auto={autoCapture}>
        <Shell boot={boot} />
      </CaptureProvider>
    </StoreProvider>
  );
}
