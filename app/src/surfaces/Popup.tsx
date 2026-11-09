import { useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { useStore } from '../lib/store';
import { useNav } from '../lib/nav';
import { useT } from '../lib/i18n';
import { BrandLogo, Button, Card, Checkbox, Chip, Dialog, EmptyState, I, Icon, IconButton, Input, SectionHeader, StatusDot, Switch, Tabs, fmtTime } from '../components/ui';
import { FORMAT_META, copyText, toJson, toMarkdown, toTxt } from '../lib/export';
import { demoSnapshot } from '../lib/parse';
import { normalizePersian, type NormalizeOps } from '../lib/persian';
import { PLATFORMS, detectPlatform, platformById, type SupportStatus } from '../lib/platforms';
import type { ExportFormat } from '../lib/types';
import { useCapture } from '../lib/capture';
import { exportConversation } from '../lib/engine';
import { ensureContentScript, getActiveTab, sendToTab, storageSet } from '../lib/chrome';
import { draftConversationLabel, draftMatchesScope, scopeFromUrl, type DraftScopeContext } from '../lib/draftScope';

type Tab = 'export' | 'guard' | 'persian' | 'sites';
const MAIN: ExportFormat[] = ['pdf', 'docx', 'md', 'txt'];
const MORE: ExportFormat[] = ['png', 'json', 'html', 'csv'];
const FMT_LABEL: Record<ExportFormat, string> = { pdf: 'PDF', docx: 'DOCX', md: 'Markdown', txt: 'TXT', png: 'PNG', json: 'JSON', html: 'HTML', csv: 'CSV' };

export function Popup({ pageUrl }: { pageUrl: string }) {
  const s = useStore(); const nav = useNav(); const T = useT(s.lang);
  const capture = useCapture();
  const tab = s.settings.lastPopupTab as Tab;
  const setTab = (t: Tab) => s.setSettings({ lastPopupTab: t });
  const det = detectPlatform(pageUrl);
  const cur = s.current;
  const platform = cur ? platformById(cur.platformId) : det.platform;

  const status = cur
    ? (cur.captureStatus === 'complete' ? 'ready' : cur.captureStatus === 'failed' ? 'error' : 'partial')
    : capture.state === 'loading' ? 'loading'
      : capture.state === 'error' ? (capture.error === 'NO_MESSAGES' ? 'notConv' : capture.error === 'UNSUPPORTED_PAGE' ? 'unsupported' : 'error')
        : det.state === 'supported' ? 'loading' : det.state === 'notConversation' ? 'notConv' : 'unsupported';
  const statusMap = { ready: ['success', T('statusReady')], loading: ['warning', T('statusLoading')], partial: ['warning', T('statusPartial')], unsupported: ['muted', T('statusUnsupported')], error: ['error', T('statusError')], notConv: ['muted', T('statusNotConv')] } as const;

  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <BrandLogo size={26} />
        <div className="flex items-center gap-0.5">
          <IconButton icon={s.theme === 'dark' ? I.sun : I.moon} label={T('theme')} onClick={() => s.setSettings({ uiTheme: s.theme === 'dark' ? 'light' : 'dark' })} size={32} />
          <button onClick={() => s.setSettings({ uiLanguage: s.lang === 'fa' ? 'en' : 'fa' })} className="h-8 px-2 rounded-[8px] text-[12px] font-semibold text-muted hover:text-text hover:bg-hover" aria-label={T('language')} title={T('language')}>{s.lang === 'fa' ? 'EN' : 'فا'}</button>
          <IconButton icon={I.refresh} label={T('captureNow')} onClick={() => capture.run()} size={32} />
          <IconButton icon={I.panel} label={T('openSidePanel')} onClick={() => nav.go('sidepanel')} size={32} />
          <IconButton icon={I.settings} label={T('openSettings')} onClick={() => nav.go('settings')} size={32} />
        </div>
      </header>
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 text-[12px] border-b border-border bg-surface">
        <span className="flex items-center gap-2 min-w-0">
          {platform ? <><span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: platform.color }} /><span className="truncate">{platform.name}</span></> : <span className="text-muted">{T('statusUnsupported')}</span>}
          {cur?.demo && <Chip tone="warning">{T('demoBadge')}</Chip>}
        </span>
        <span className="flex items-center gap-1.5 text-muted"><StatusDot tone={statusMap[status][0]} />{statusMap[status][1]}</span>
      </div>
      <div className="px-2"><Tabs<Tab> compact value={tab} onChange={setTab} tabs={[{ id: 'export', label: T('tabExport'), icon: I.download }, { id: 'guard', label: T('tabGuard'), icon: I.shield }, { id: 'persian', label: T('tabPersian'), icon: I.type }, { id: 'sites', label: T('tabSites'), icon: I.globe }]} /></div>
      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'export' && <ExportTab />}
        {tab === 'guard' && <GuardTab />}
        {tab === 'persian' && <PersianTab />}
        {tab === 'sites' && <SitesTab />}
      </div>
    </div>
  );
}

function ExportTab() {
  const s = useStore(); const nav = useNav(); const T = useT(s.lang);
  const capture = useCapture();
  const cur = s.current; const [more, setMore] = useState(false); const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [dup, setDup] = useState(false);
  const [failed, setFailed] = useState<ExportFormat | null>(null);
  const busyRef = useRef(false);

  const run = async (format: ExportFormat) => {
    if (!cur || busyRef.current) return;
    busyRef.current = true;
    setBusy(format);
    setFailed(null);
    const opts = { ...s.settings.defaultExportOptions, format };
    try {
      const r = await exportConversation({ snapshots: [cur], selection: null, lang: s.lang }, opts, s.lang);
      if (!r.ok) {
        setFailed(format);
        s.toast('error', T(`err${r.code}` as never));
      } else if (r.printTab) s.toast('info', T('printOpened'));
      else s.toast('success', `${T('fileReady')} · ${r.filename ?? ''}`.trim());
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  };
  const copy = async (kind: 'txt' | 'md' | 'json') => {
    if (!cur) return;
    const o = s.settings.defaultExportOptions; const inp = { snapshots: [cur], selection: null, lang: s.lang };
    const ok = await copyText(kind === 'txt' ? toTxt(inp, o) : kind === 'md' ? toMarkdown(inp, o) : toJson(inp, o));
    s.toast(ok ? 'success' : 'error', ok ? T('copied') : T('copyFailed'));
  };
  const add = (mode: 'ask' | 'replace' | 'version') => {
    if (!cur) return; const r = s.addToCollection(cur, mode);
    if (r === 'duplicate') setDup(true); else { setDup(false); s.toast('success', T('addedToCollection')); }
  };
  /** BUG-16: a dock closed inside the page can be brought back from the popup. */
  const showDock = async () => {
    const tab = await getActiveTab();
    if (!tab) { s.toast('warning', T('noTabRemembered')); return; }
    // The dismissal is shared storage, not a per-tab flag: clearing it here
    // re-enables the dock in every open tab and in tabs opened later.
    await storageSet({ am_tool_dock_dismissed_v1: false });
    const alive = await ensureContentScript(tab.id);
    if (!alive) { s.toast('error', T('errNO_CONTENT_SCRIPT')); return; }
    const result = await sendToTab<{ ok?: boolean; error?: string }>(tab.id, { type: 'AM_SHOW_DOCK' });
    if (result?.ok) s.toast('success', T('dockShown'));
    else s.toast('warning', result?.error === 'DOCK_DISABLED' ? T('dockDisabled') : T('errNO_CONTENT_SCRIPT'));
  };

  if (!cur) {
    const reason = capture.state === 'error' && capture.error ? T(`err${capture.error}` as never) : T('noConversationDesc');
    return (
      <EmptyState icon={I.file} title={T('noConversation')} desc={reason} action={
        <div className="flex flex-col gap-2">
          <Button variant="primary" icon={I.refresh} loading={capture.state === 'loading'} onClick={() => capture.run()}>{T('captureNow')}</Button>
          <Button onClick={() => s.setCurrent(demoSnapshot(s.lang))}>{T('loadSample')}</Button>
        </div>} />
    );
  }

  const FmtCard = ({ f }: { f: ExportFormat }) => {
    const avail = FORMAT_META[f].available;
    return (
      <button onClick={() => run(f)} disabled={busy !== null} title={avail ? '' : T('notAvailableWeb')}
        className={clsx('flex flex-col items-start gap-0.5 rounded-[10px] border px-3 py-2 text-start transition-colors', avail ? 'border-border bg-raised hover:border-primary/60' : 'border-dashed border-border bg-transparent opacity-60')}>
        <span className="flex items-center gap-1.5 text-[13px] font-semibold ltr">{busy === f ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <Icon d={I.file} size={14} className="text-primary" />}{FMT_LABEL[f]}</span>
        <span className="text-[11px] text-muted" dir="auto">.{FORMAT_META[f].ext}{f === 'pdf' && ` · ${T('print')}`}{!avail && ' · ext'}</span>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <Card className="p-3 relative overflow-hidden">
        <div className="absolute -top-10 -end-10 h-28 w-28 rounded-full bg-primary/15 blur-2xl" aria-hidden="true" />
        <p className="text-[14px] font-semibold">{T('heroTitle')}</p>
        <p className="mt-0.5 text-[12px] text-muted leading-snug">{T('heroDesc')}</p>
        <Button variant="primary" className="mt-3 w-full" icon={I.fwd} onClick={() => nav.openStudio({ snapshots: [cur] })}>{T('openStudio')}</Button>
      </Card>
      <div className="rounded-[10px] border border-border bg-surface px-3 py-2">
        <p className="truncate text-[13px] font-medium" dir="auto">{cur.title}</p>
        <p className="text-[11.5px] text-muted tabular flex items-center gap-2 mt-0.5">
          <span>{cur.messages.length} {T('messagesFound')}</span>·<span>{cur.captureStatus === 'complete' ? T('statusComplete') : cur.captureStatus === 'partial' ? T('statusPartial') : T('statusUnknown')}</span>
          {cur.titleSource === 'generated' && <Chip tone="warning">{T('generatedTitleShort')}</Chip>}
        </p>
      </div>
      <div>
        <SectionHeader title={T('quickExport')} action={<button className="text-[12px] text-primary hover:underline" onClick={() => setMore(m => !m)}>{more ? T('lessFormats') : T('moreFormats')}</button>} />
        <div className="grid grid-cols-2 gap-2">{MAIN.map(f => <FmtCard key={f} f={f} />)}{more && MORE.map(f => <FmtCard key={f} f={f} />)}</div>
        {failed && <div className="mt-2 flex items-center gap-2 rounded-[8px] border border-error/40 bg-error/5 px-2.5 py-1.5 text-[12px] text-error"><Icon d={I.alert} size={14} /><span className="flex-1">{T('exportFailedHint')}</span><Button size="sm" variant="ghost" icon={I.refresh} disabled={busy !== null} onClick={() => run(failed)}>{T('retry')}</Button></div>}
      </div>
      <div>
        <SectionHeader title={T('quickCopy')} />
        <div className="flex gap-2">
          <Button size="sm" icon={I.copy} onClick={() => copy('txt')} className="flex-1">{T('copyText')}</Button>
          <Button size="sm" onClick={() => copy('md')} className="flex-1">MD</Button>
          <Button size="sm" onClick={() => copy('json')} className="flex-1">JSON</Button>
        </div>
      </div>
      <Button icon={I.layers} onClick={() => add('ask')}>{T('addToCollection')} <Chip tone="primary">{s.activeCollection.items.length}</Chip></Button>
      <Button size="sm" variant="ghost" icon={I.eye} onClick={showDock}>{T('showDock')}</Button>
      <Dialog open={dup} onClose={() => setDup(false)} title={T('duplicateTitle')} actions={<>
        <Button variant="ghost" onClick={() => setDup(false)}>{T('cancel')}</Button>
        <Button onClick={() => add('version')}>{T('keepBoth')}</Button>
        <Button variant="primary" onClick={() => add('replace')}>{T('replace')}</Button></>}>{T('duplicateDesc')}</Dialog>
    </div>
  );
}

function GuardTab() {
  const s = useStore(); const nav = useNav(); const T = useT(s.lang);
  const [consent, setConsent] = useState(false); const [disable, setDisable] = useState(false); const [show, setShow] = useState(false);
  const [ctx, setCtx] = useState<DraftScopeContext | null>(null);
  const on = s.settings.promptGuardEnabled && s.settings.promptGuardConsentVersion != null;
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const tab = await getActiveTab();
      if (!tab) { if (!cancelled) setCtx(null); return; }
      // The content script is the only place that knows a new-chat tab's
      // per-tab scope, so ask it first and only fall back to the URL.
      const res = typeof tab.id === 'number'
        ? await sendToTab<DraftScopeContext>(tab.id, { type: 'AM_DRAFT_CONTEXT' }, 2500)
        : null;
      if (cancelled) return;
      if (res && res.ok && res.scope) setCtx(res);
      else setCtx(tab.url ? { ok: true, platformId: null, scope: scopeFromUrl(tab.url), url: tab.url } : null);
    })();
    return () => { cancelled = true; };
  }, []);
  const openDrafts = s.drafts.filter(d => d.state !== 'submitted');
  const draft = ctx ? openDrafts.find(d => draftMatchesScope(d, ctx)) : undefined;
  const otherDrafts = ctx ? openDrafts.filter(d => !draftMatchesScope(d, ctx)).length : 0;
  const convLabel = draft ? draftConversationLabel(draft) : null;
  const stateLabel = !on ? ['muted', T('guardStateDisabled')] : s.draftSave === 'saving' ? ['warning', T('guardStateSaving')] : s.draftSave === 'failed' ? ['error', T('guardStateFailed')] : s.draftSave === 'saved' ? ['success', `${T('guardStateSaved')} · ${fmtTime(s.lastDraftSavedAt, s.lang)}`] : ['primary', T('guardStateReady')];
  const toggle = (v: boolean) => { if (v) { s.settings.promptGuardConsentVersion != null ? s.setSettings({ promptGuardEnabled: true }) : setConsent(true); } else setDisable(true); };
  return (
    <div className="flex flex-col gap-3">
      <Card className="px-3 py-1"><Switch checked={on} onChange={toggle} label={T('guardToggle')} desc={T('guardExplain')} /></Card>
      <div className="flex items-center gap-2 text-[12.5px] text-muted"><StatusDot tone={stateLabel[0] as never} />{stateLabel[1]}</div>
      <Card className="p-3">
        <SectionHeader title={T('lastDraft')} />
        {draft ? (<>
          <p className="text-[13px] whitespace-pre-wrap break-words" dir="auto">{show ? draft.text : draft.text.slice(0, 140) + (draft.text.length > 140 ? '…' : '')}</p>
          <p className="mt-1 text-[11.5px] text-muted">{fmtTime(draft.persistedAt, s.lang)} · rev {draft.revision}{convLabel ? ` · ${T('groupChat')} ${convLabel}` : ''}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Button size="sm" variant="primary" icon={I.refresh} onClick={() => { nav.setComposerText(draft.text); nav.go('inpage'); }}>{T('restore')}</Button>
            <Button size="sm" icon={I.copy} onClick={async () => s.toast((await copyText(draft.text)) ? 'success' : 'error', T('copied'))}>{T('copy')}</Button>
            <Button size="sm" variant="ghost" icon={I.eye} onClick={() => setShow(v => !v)}>{T('view')}</Button>
            <Button size="sm" variant="danger" icon={I.trash} onClick={() => s.deleteDraft(draft.id)}>{T('delete')}</Button>
          </div></>) : <p className="text-[12.5px] text-muted">{T('noDrafts')}</p>}
        {otherDrafts > 0 && (
          <button type="button" onClick={() => { nav.setPanelTab('vault'); nav.go('sidepanel'); }} className="mt-2 block text-[11.5px] text-primary hover:underline">
            {otherDrafts} {T('otherDrafts')}
          </button>
        )}
        <p className="mt-2 text-[11px] text-muted leading-snug">{T('restoreHint')}</p>
      </Card>
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" onClick={() => { nav.setPanelTab('vault'); nav.go('sidepanel'); }}>{T('promptHistory')}</Button>
        <Button size="sm" onClick={() => { nav.setPanelTab('vault'); nav.go('sidepanel'); }}>{T('templates')}</Button>
      </div>
      <Dialog open={consent} onClose={() => setConsent(false)} title={T('consentTitle')} actions={<><Button variant="ghost" onClick={() => setConsent(false)}>{T('cancel')}</Button><Button variant="primary" onClick={() => { s.setSettings({ promptGuardEnabled: true, promptGuardConsentVersion: 1 }); setConsent(false); }}>{T('agree')}</Button></>}>{T('consentBody')}</Dialog>
      <Dialog open={disable} onClose={() => setDisable(false)} title={T('disableKeepTitle')} actions={<><Button variant="ghost" onClick={() => setDisable(false)}>{T('cancel')}</Button><Button variant="danger" onClick={() => { s.drafts.forEach(d => s.deleteDraft(d.id)); s.setSettings({ promptGuardEnabled: false }); setDisable(false); }}>{T('deleteData')}</Button><Button variant="primary" onClick={() => { s.setSettings({ promptGuardEnabled: false }); setDisable(false); }}>{T('keepData')}</Button></>}>{T('disableKeepDesc')}</Dialog>
    </div>
  );
}

function PersianTab() {
  const s = useStore(); const nav = useNav(); const T = useT(s.lang);
  const [src, setSrc] = useState(''); const [out, setOut] = useState<ReturnType<typeof normalizePersian> | null>(null); const [prev, setPrev] = useState<string | null>(null);
  const [ops, setOps] = useState<NormalizeOps>({ arabicLetters: true, halfSpace: true, faToEnDigits: false, enToFaDigits: false });
  const [confirmPaste, setConfirmPaste] = useState(false);
  const setOp = (k: keyof NormalizeOps) => (v: boolean) => setOps(o => ({ ...o, [k]: v, ...(k === 'faToEnDigits' && v ? { enToFaDigits: false } : {}), ...(k === 'enToFaDigits' && v ? { faToEnDigits: false } : {}) }));
  const fix = () => { setPrev(src); setOut(normalizePersian(src, ops)); };
  const paste = () => { if (nav.composerText.trim()) setConfirmPaste(true); else doPaste(); };
  const doPaste = () => { nav.setComposerText(out!.text); setConfirmPaste(false); nav.go('inpage'); };
  return (
    <div className="flex flex-col gap-3">
      <Card className="px-3 divide-y divide-border">
        <Switch checked={s.settings.autoBidi} onChange={v => s.setSettings({ autoBidi: v })} label={T('rtlFix')} />
        <Switch checked={s.settings.autoInputDirection} onChange={v => s.setSettings({ autoInputDirection: v })} label={T('autoDir')} />
        <Switch checked={s.settings.persianFontEnabled} onChange={v => s.setSettings({ persianFontEnabled: v })} label={T('faFont')} />
      </Card>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        <Checkbox checked={ops.arabicLetters} onChange={setOp('arabicLetters')} label={T('opArabic')} />
        <Checkbox checked={ops.halfSpace} onChange={setOp('halfSpace')} label={T('opHalf')} />
        <Checkbox checked={ops.faToEnDigits} onChange={setOp('faToEnDigits')} label={T('opFaEn')} />
        <Checkbox checked={ops.enToFaDigits} onChange={setOp('enToFaDigits')} label={T('opEnFa')} />
      </div>
      <label className="text-[12px] text-muted">{T('srcText')}<textarea value={src} onChange={e => setSrc(e.target.value)} dir="auto" rows={4} className="mt-1 w-full rounded-[8px] border border-border bg-raised p-2 text-[13px] text-text focus:border-primary" /></label>
      <div className="flex gap-2"><Button variant="primary" size="sm" className="flex-1" onClick={fix} disabled={!src.trim()}>{T('fix')}</Button><Button size="sm" onClick={() => { setSrc(''); setOut(null); setPrev(null); }}>{T('reset')}</Button></div>
      {out && (<>
        <label className="text-[12px] text-muted">{T('fixedText')} <Chip tone="primary">{out.changed} {T('changes')}</Chip><textarea readOnly value={out.text} dir="auto" rows={4} className="mt-1 w-full rounded-[8px] border border-border bg-raised p-2 text-[13px] text-text" /></label>
        {out.protectedSegments > 0 && <p className="text-[11.5px] text-muted flex gap-1"><Icon d={I.info} size={14} />{T('protectedNote')}</p>}
        {out.warnings.includes('longNumbers') && <p className="text-[11.5px] text-warning flex gap-1"><Icon d={I.alert} size={14} />{T('longNumWarn')}</p>}
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" icon={I.copy} onClick={async () => s.toast((await copyText(out.text)) ? 'success' : 'error', T('copied'))}>{T('copy')}</Button>
          <Button size="sm" icon={I.send} onClick={paste}>{T('pasteToComposer')}</Button>
          <Button size="sm" variant="ghost" onClick={() => { if (prev != null) { setSrc(prev); setOut(null); } }}>{T('undo')}</Button>
        </div></>)}
      <Dialog open={confirmPaste} onClose={() => setConfirmPaste(false)} title={T('pasteToComposer')} actions={<><Button variant="ghost" onClick={() => setConfirmPaste(false)}>{T('cancel')}</Button><Button variant="primary" onClick={doPaste}>{T('replace')}</Button></>}>{T('composerOverwrite')}</Dialog>
    </div>
  );
}

function SitesTab() {
  const s = useStore(); const T = useT(s.lang);
  const [q, setQ] = useState(''); const [url, setUrl] = useState('');
  const list = useMemo(() => PLATFORMS.filter(p => (p.name + ' ' + p.domains.join(' ')).toLowerCase().includes(q.toLowerCase())), [q]);
  const tone: Record<SupportStatus, 'success' | 'warning' | 'neutral' | 'error'> = { tested: 'success', experimental: 'warning', loginRequired: 'neutral', unavailable: 'error' };
  const det = url ? detectPlatform(url) : null;
  return (
    <div className="flex flex-col gap-3">
      <div className="relative"><Icon d={I.search} size={15} className="absolute top-2.5 start-2.5 text-muted" /><Input value={q} onChange={e => setQ(e.target.value)} placeholder={T('searchSites')} className="ps-8" /></div>
      <ul className="flex flex-col gap-1">
        {list.map(p => (
          <li key={p.id} className="flex items-center gap-2.5 rounded-[10px] border border-border bg-surface px-2.5 py-2">
            <span className="grid h-7 w-7 place-items-center rounded-[7px] text-[11px] font-bold" style={{ background: p.color + '22', color: p.color }}>{p.name.slice(0, 1)}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{p.name}</span><span className="block truncate text-[11px] text-muted ltr text-start">{p.domains[0]}</span></span>
            <Chip tone={tone[p.status]}>{T(p.status as never)}</Chip>
            <a href={p.officialUrl} target="_blank" rel="noopener noreferrer" className="grid h-8 w-8 place-items-center rounded-[8px] text-muted hover:text-primary" aria-label={p.name}><Icon d={I.ext} size={15} /></a>
          </li>))}
      </ul>
      <Card className="p-3">
        <SectionHeader title={T('urlTester')} />
        <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" dir="ltr" />
        <p className="mt-1.5 text-[12px] text-muted">{det ? (det.platform ? `${det.platform.name} → ${det.state}` : det.state) : T('urlTesterHint')}</p>
      </Card>
    </div>
  );
}
