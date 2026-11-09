import { createContext, useContext } from 'react';
import type { ConversationSnapshot } from './types';

export type Surface = 'popup' | 'studio' | 'sidepanel' | 'settings' | 'inpage';
export interface StudioInput { snapshots: ConversationSnapshot[]; collectionTitle?: string; preselect?: Map<string, Set<string>>; tabId?: number | null; }
export interface StudioHandoff {
  snapshots: ConversationSnapshot[];
  collectionTitle?: string;
  tabId?: number | null;
  pageUrl?: string;
  at?: number;
}
export interface Nav {
  surface: Surface; go: (s: Surface) => void;
  openStudio: (input: StudioInput) => void; studioInput: StudioInput | null;
  panelTab: 'collections' | 'vault' | 'cache'; setPanelTab: (t: 'collections' | 'vault' | 'cache') => void;
  composerText: string; setComposerText: (t: string) => void;
}
export const NavCtx = createContext<Nav | null>(null);
export const useNav = () => { const n = useContext(NavCtx); if (!n) throw new Error('nav'); return n; };
