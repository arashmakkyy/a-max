import { useRef, useState } from 'react';
import { clsx } from 'clsx';
import { useStore } from '../lib/store';
import { useNav } from '../lib/nav';
import { useT } from '../lib/i18n';
import { BrandLogo, Button, Card, Chip, Dialog, I, Icon, IconButton, Input, SectionHeader, Select, StatusDot, Switch, fmtBytes } from '../components/ui';
import { downloadBlob } from '../lib/export';
import { PLATFORMS } from '../lib/platforms';
import type { DocTheme, ExportFormat, ExportOptions } from '../lib/types';
import { APP_AUTHOR, APP_VERSION } from '../lib/version';

type Group = 'general' | 'export' | 'advanced' | 'about';

export function Settings() {
  const s = useStore(); const nav = useNav(); const T = useT(s.lang);
  const [group, setGroup] = useState<Group>('general');
  const groups: { id: Group; label: string; icon: string }[] = [{ id: 'general', label: T('sGeneral'), icon: I.settings }, { id: 'export', label: T('sExport'), icon: I.download }, { id: 'advanced', label: T('sAdvanced'), icon: I.shield }, { id: 'about', label: T('sAbout'), icon: I.info }];
  const saveState = s.settingsSave;
  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2.5">
        <IconButton icon={I.back} label={T('back')} onClick={() => nav.go('popup')} />
        <BrandLogo size={24} /><span className="text-muted">/</span><h1 className="text-[15px] font-semibold">{T('settings')}</h1>
        <span className="ms-auto flex items-center gap-1.5 text-[12px] text-muted" aria-live="polite">
          {saveState === 'saving' && <><StatusDot tone="warning" />{T('saving')}</>}{saveState === 'saved' && <><StatusDot tone="success" />{T('saved')}</>}{saveState === 'failed' && <><StatusDot tone="error" />{T('saveFailed')}</>}
        </span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav className="flex md:flex-col gap-1 border-b md:border-b-0 md:border-e border-border bg-surface p-2 md:w-56 overflow-x-auto">
          {groups.map(g => <button key={g.id} onClick={() => setGroup(g.id)} className={clsx('flex items-center gap-2 rounded-[8px] px-3 py-2 text-[13px] whitespace-nowrap', group === g.id ? 'bg-selected text-primary font-medium' : 'text-muted hover:text-text hover:bg-hover')}><Icon d={g.icon} size={16} />{g.label}</button>)}
        </nav>
        <main className="flex-1 overflow-y-auto p-4 md:p-6"><div className="mx-auto max-w-2xl flex flex-col gap-5">
          {group === 'general' && <General />}{group === 'export' && <ExportSettings />}{group === 'advanced' && <Advanced />}{group === 'about' && <About />}
        </div></main>
      </div>
    </div>
  );
}

const Row = ({ label, children, desc }: { label: string; children: React.ReactNode; desc?: string }) => (
  <div className="flex items-center justify-between gap-4 py-2.5"><span><span className="block text-[14px]">{label}</span>{desc && <span className="block text-[12px] text-muted">{desc}</span>}</span>{children}</div>);

function General() {
  const s = useStore(); const T = useT(s.lang); const st = s.settings;
  return (<>
    <Card className="px-4 divide-y divide-border">
      <Row label={T('language')}><Select value={st.uiLanguage} onChange={e => s.setSettings({ uiLanguage: e.target.value as never })} options={[{ value: 'fa', label: 'فارسی' }, { value: 'en', label: 'English' }]} /></Row>
      <Row label={T('uiTheme')}><Select value={st.uiTheme} onChange={e => s.setSettings({ uiTheme: e.target.value as never })} options={[{ value: 'dark', label: T('dark') }, { value: 'light', label: T('light') }, { value: 'system', label: T('system') }]} /></Row>
      <Switch checked={st.dockEnabled} onChange={v => s.setSettings({ dockEnabled: v })} label={T('dock')} />
      <Switch checked={st.singleMessageMenuEnabled} onChange={v => s.setSettings({ singleMessageMenuEnabled: v })} label={T('msgMenu')} />
      <Switch checked={st.autoCacheEnabled} onChange={v => s.setSettings({ autoCacheEnabled: v })} label={T('autoCache')} desc={T('autoCacheDesc')} />
    </Card>
    <div><SectionHeader title={T('platformsEnabled')} />
      <Card className="px-4 divide-y divide-border max-h-80 overflow-y-auto">{PLATFORMS.map(p => <Switch key={p.id} checked={st.platformOverrides[p.id]?.enabled ?? true} onChange={v => s.setSettings({ platformOverrides: { ...st.platformOverrides, [p.id]: { enabled: v } } })} label={p.name} desc={p.domains[0]} />)}</Card></div>
  </>);
}

function ExportSettings() {
  const s = useStore(); const T = useT(s.lang); const o = s.settings.defaultExportOptions;
  const set = <K extends keyof ExportOptions>(k: K, v: ExportOptions[K]) => s.setSettings({ defaultExportOptions: { ...o, [k]: v } });
  const themes: DocTheme[] = ['light', 'dark', 'note', 'oldpaper', 'sakura', 'bluemist', 'freshgreen', 'lavender'];
  return (<>
    <Card className="px-4 divide-y divide-border">
      <Row label={T('fileName')}><Select value={o.fileNamePattern} onChange={e => set('fileNamePattern', e.target.value as never)} options={[{ value: 'ai_title_date', label: 'AI + Title + Date' }, { value: 'title_date', label: 'Title + Date' }, { value: 'ai_title', label: 'AI + Title' }, { value: 'date_title', label: 'Date + Title' }]} /></Row>
      <Row label={T('defaultFormat')}><Select value={o.format} onChange={e => set('format', e.target.value as ExportFormat)} options={['pdf', 'docx', 'md', 'txt', 'png', 'json', 'html', 'csv'].map(v => ({ value: v, label: v.toUpperCase() }))} /></Row>
      <Row label={T('docTheme')}><Select value={o.theme} onChange={e => set('theme', e.target.value as DocTheme)} options={themes.map(v => ({ value: v, label: v }))} /></Row>
      <Row label={T('font')}><Select value={o.fontSize} onChange={e => set('fontSize', e.target.value as never)} options={[{ value: 'small', label: T('small') }, { value: 'medium', label: T('medium') }, { value: 'large', label: T('large') }]} /></Row>
      <Row label={T('table')}><Select value={o.tableStyle} onChange={e => set('tableStyle', e.target.value as never)} options={[{ value: 'solid', label: T('solid') }, { value: 'dashed', label: T('dashed') }, { value: 'borderless', label: T('borderless') }]} /></Row>
    </Card>
    <Card className="px-4 divide-y divide-border">
      <Switch checked={o.includeRoles} onChange={v => set('includeRoles', v)} label={T('incRoles')} />
      <Switch checked={o.includeSource} onChange={v => set('includeSource', v)} label={T('incSource')} />
      <Switch checked={o.includeTimestamps} onChange={v => set('includeTimestamps', v)} label={T('incTime')} />
      <Switch checked={o.includeThinking} onChange={v => set('includeThinking', v)} label={T('incThinking')} />
      <Switch checked={o.brandingEnabled} onChange={v => set('brandingEnabled', v)} label={T('branding')} />
      {o.brandingEnabled && <div className="py-2"><Input value={o.brandingText} onChange={e => set('brandingText', e.target.value)} dir="auto" /></div>}
    </Card>
    <Card className="px-4 divide-y divide-border">
      <Row label={T('pdfOpts')}><div className="flex gap-2"><Select value={o.paperSize} onChange={e => set('paperSize', e.target.value as never)} options={['A4', 'A3', 'A5', 'Letter', 'Legal'].map(v => ({ value: v, label: v }))} /><Select value={o.orientation} onChange={e => set('orientation', e.target.value as never)} options={[{ value: 'portrait', label: T('portrait') }, { value: 'landscape', label: T('landscape') }]} /></div></Row>
      <Row label={T('margins')}><Select value={o.margins} onChange={e => set('margins', e.target.value as never)} options={[{ value: 'small', label: T('small') }, { value: 'medium', label: T('medium') }, { value: 'large', label: T('large') }]} /></Row>
      <Switch checked={o.pageNumbers} onChange={v => set('pageNumbers', v)} label={T('pageNumbers')} />
      <Row label="PNG"><Select value={o.pngMode} onChange={e => set('pngMode', e.target.value as never)} options={[{ value: 'split', label: 'Split / ZIP' }, { value: 'single', label: 'Single' }]} /></Row>
    </Card>
    <Button variant="ghost" size="sm" icon={I.refresh} onClick={s.resetExportDefaults} className="self-start">{T('resetCategory')}</Button>
  </>);
}

function Advanced() {
  const s = useStore(); const T = useT(s.lang); const st = s.settings;
  const [consent, setConsent] = useState(false); const [confirm, setConfirm] = useState<null | { kind: string; n: number }>(null); const [imp, setImp] = useState<{ text: string; mode: 'merge' | 'replace' } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const guardOn = st.promptGuardEnabled && st.promptGuardConsentVersion != null;
  const num = (v: string, min: number, max: number, fallback: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback; };
  const backup = () => downloadBlob(s.exportBackup(), 'application/json', 'amtool-backup.json').then(r => s.toast(r.ok ? 'success' : 'error', r.ok ? T('fileReady') : T('errDOWNLOAD_FAILED')));
  const doClear = () => { if (!confirm) return; const k = confirm.kind; if (k === 'history') s.clearHistory(); if (k === 'drafts') s.drafts.forEach(d => s.deleteDraft(d.id)); if (k === 'templates') s.templates.forEach(t => s.deleteTemplate(t.id)); if (k === 'cache') s.deleteSnapshots(s.snapshots.map(x => x.id)); if (k === 'collections') s.clearCollection(); if (k === 'all') s.clearAll(); setConfirm(null); s.toast('success', T('saved')); };
  return (<>
    <div><SectionHeader title={T('guardSection')} /><Card className="px-4 divide-y divide-border">
      <Switch checked={guardOn} onChange={v => v ? (st.promptGuardConsentVersion != null ? s.setSettings({ promptGuardEnabled: true }) : setConsent(true)) : s.setSettings({ promptGuardEnabled: false })} label={T('guardToggle')} desc={T('guardExplain')} />
      <Switch checked={st.recoveryBannerEnabled} onChange={v => s.setSettings({ recoveryBannerEnabled: v })} label={T('recoveryBanner')} disabled={!guardOn} />
      <Switch checked={st.autoRestoreEnabled} onChange={v => s.setSettings({ autoRestoreEnabled: v })} label={T('autoRestore')} disabled={!guardOn} />
      <Row label={T('maxHistory')} desc="50–2000"><Input type="number" min={50} max={2000} value={st.maxPromptHistory} onChange={e => s.setSettings({ maxPromptHistory: num(e.target.value, 50, 2000, 300) })} className="w-24 ltr" /></Row>
      <Row label={T('draftTTL')} desc="1–365"><Input type="number" min={1} max={365} value={st.draftTTLDays} onChange={e => s.setSettings({ draftTTLDays: num(e.target.value, 1, 365, 30) })} className="w-24 ltr" /></Row>
    </Card></div>
    <div><SectionHeader title={T('persianSection')} /><Card className="px-4 divide-y divide-border">
      <Switch checked={st.autoBidi} onChange={v => s.setSettings({ autoBidi: v })} label={T('rtlFix')} />
      <Switch checked={st.autoInputDirection} onChange={v => s.setSettings({ autoInputDirection: v })} label={T('autoDir')} />
      <Switch checked={st.persianFontEnabled} onChange={v => s.setSettings({ persianFontEnabled: v })} label={T('faFont')} />
    </Card></div>
    <div><SectionHeader title={T('dataSection')} /><Card className="px-4 divide-y divide-border">
      <Row label={T('cacheTTL')} desc="1–365"><Input type="number" min={1} max={365} value={st.cacheTTLDays} onChange={e => s.setSettings({ cacheTTLDays: num(e.target.value, 1, 365, 30) })} className="w-24 ltr" /></Row>
      <Row label={T('storageUsed')}><Chip>{fmtBytes(s.storageBytes)}</Chip></Row>
      {([['cache', s.snapshots.length], ['collections', s.activeCollection.items.length], ['history', s.history.length], ['drafts', s.drafts.length], ['templates', s.templates.length]] as [string, number][]).map(([k, n]) => (
        <Row key={k} label={T(k === 'cache' ? 'cacheTab' : k === 'collections' ? 'collectionsTab' : k === 'history' ? 'sentHistory' : k === 'drafts' ? 'drafts' : 'templates')}><div className="flex items-center gap-2"><Chip>{n} {T('items')}</Chip><Button size="sm" variant="ghost" className="text-error" disabled={!n} onClick={() => setConfirm({ kind: k, n })}>{T('clearCategory')}</Button></div></Row>))}
      <Row label={T('backupAll')}><Button size="sm" icon={I.download} onClick={backup}>{T('exportJson')}</Button></Row>
      <Row label={T('restoreBackup')}><Button size="sm" onClick={() => fileRef.current?.click()}>{T('importJson')}</Button><input ref={fileRef} type="file" accept="application/json" hidden onChange={async e => { const f = e.target.files?.[0]; if (f) setImp({ text: await f.text(), mode: 'merge' }); e.target.value = ''; }} /></Row>
    </Card></div>
    <div><SectionHeader title={T('privacySection')} /><Card className="p-4 text-[13px] text-muted leading-relaxed">{T('privacyText')}</Card></div>
    <div><SectionHeader title={T('diagSection')} /><Card className="p-4 text-[13px] text-muted leading-relaxed"><p className="ltr text-start">{T('permissionsList')}</p></Card></div>
    <Button variant="danger" icon={I.trash} onClick={() => setConfirm({ kind: 'all', n: s.snapshots.length + s.history.length + s.drafts.length + s.templates.length })} className="self-start">{T('clearAll')}</Button>

    <Dialog open={consent} onClose={() => setConsent(false)} title={T('consentTitle')} actions={<><Button variant="ghost" onClick={() => setConsent(false)}>{T('cancel')}</Button><Button variant="primary" onClick={() => { s.setSettings({ promptGuardEnabled: true, promptGuardConsentVersion: 1 }); setConsent(false); }}>{T('agree')}</Button></>}>{T('consentBody')}</Dialog>
    <Dialog open={!!confirm} danger onClose={() => setConfirm(null)} title={T('confirmDeleteTitle')} actions={<><Button variant="ghost" onClick={() => setConfirm(null)}>{T('cancel')}</Button>{confirm?.kind === 'all' && <Button onClick={backup}>{T('backupAll')}</Button>}<Button variant="danger" onClick={doClear}>{T('delete')} {confirm?.n} {T('items')}</Button></>}>{T('confirmDeleteDesc')}</Dialog>
    <Dialog open={!!imp} onClose={() => setImp(null)} title={T('restoreBackup')} actions={<><Button variant="ghost" onClick={() => setImp(null)}>{T('cancel')}</Button><Button variant="primary" onClick={() => { const r = s.importBackup(imp!.text, imp!.mode); s.toast(r.ok ? 'success' : 'error', r.ok ? `${T('saved')} (${r.report})` : r.report); setImp(null); }}>{T('apply')}</Button></>}>
      {imp && <div className="flex flex-col gap-2"><pre className="max-h-40 overflow-auto rounded-[8px] bg-raised p-2 text-[11px]">{imp.text.slice(0, 1200)}</pre><Select value={imp.mode} onChange={e => setImp({ ...imp, mode: e.target.value as never })} options={[{ value: 'merge', label: T('merge') }, { value: 'replace', label: T('replaceAll') }]} /></div>}
    </Dialog>
  </>);
}

function About() {
  const s = useStore(); const T = useT(s.lang);
  return (<>
    <Card className="p-5 flex flex-col gap-3">
      <BrandLogo size={40} /><p className="text-muted text-[13px]">{T('tagline')}</p>
      <div className="grid grid-cols-2 gap-y-2 text-[13px]"><span className="text-muted">{T('version')}</span><span className="ltr">{APP_VERSION} (MV3)</span><span className="text-muted">{T('author')}</span><span>{APP_AUTHOR}</span><span className="text-muted">{T('license')}</span><span>MIT</span></div>
      <p className="text-[12.5px] text-muted leading-relaxed border-t border-border pt-3">{T('webBuildNotice')}</p>
    </Card>
    <div><SectionHeader title={T('tabSites')} /><Card className="divide-y divide-border">{PLATFORMS.map(p => <div key={p.id} className="flex items-center justify-between px-4 py-2 text-[13px]"><span>{p.name}</span><Chip tone={p.status === 'tested' ? 'success' : p.status === 'experimental' ? 'warning' : 'neutral'}>{T(p.status as never)}</Chip></div>)}</Card></div>
  </>);
}
