import { useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { useStore } from '../lib/store';
import { useNav, type StudioHandoff, type StudioInput } from '../lib/nav';
import { useT } from '../lib/i18n';
import { Button, Checkbox, Chip, I, Icon, IconButton, Input, SectionHeader, Select, Switch } from '../components/ui';
import { FORMAT_META, toHtml, type ExportInput } from '../lib/export';
import { exportConversation } from '../lib/engine';
import { captureTabById, toSnapshot, type RawChat } from '../lib/capture';
import { sessionGet } from '../lib/chrome';
import { searchKey } from '../lib/persian';
import { PLATFORMS, platformName, type SupportStatus } from '../lib/platforms';
import { previewFontCss } from '../lib/preview-fonts';
import type { ConversationSnapshot, DocTheme, ExportFormat, ExportOptions, MessageRole } from '../lib/types';

const FORMATS: ExportFormat[] = ['pdf', 'docx', 'md', 'txt', 'png', 'json', 'html', 'csv'];
const THEMES: DocTheme[] = ['light', 'dark', 'note', 'oldpaper', 'sakura', 'bluemist', 'freshgreen', 'lavender'];
const THEME_LABEL: Record<DocTheme, [string, string]> = { light: ['روشن', 'Light'], dark: ['تیره', 'Dark'], note: ['یادداشت', 'Note'], oldpaper: ['کاغذ کاهی', 'Old paper'], sakura: ['ساکورا', 'Sakura'], bluemist: ['مه آبی', 'Blue mist'], freshgreen: ['سبز تازه', 'Fresh green'], lavender: ['اسطوخودوس', 'Lavender'] };

/** `#studio?id=…&tab=…` picks the hand-off record that belongs to this tab. */
function readStudioParams(): { id: string; tab: number | null } {
  const hash = location.hash.replace(/^#\/?/, '');
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  const params = new URLSearchParams(query || location.search);
  const id = params.get('id') || '';
  const tab = Number(params.get('tab'));
  return {
    id: /^[a-zA-Z0-9_-]{1,64}$/.test(id) ? id : '',
    tab: Number.isInteger(tab) && tab >= 0 ? tab : null,
  };
}

export function Studio() {
  const s = useStore(); const nav = useNav(); const T = useT(s.lang);
  const navInput = nav.studioInput;
  const langRef = useRef(s.lang);
  langRef.current = s.lang;
  const [source, setSource] = useState<StudioInput | null | undefined>(navInput ?? undefined);
  useEffect(() => {
    if (navInput) { setSource(navInput); return; }
    let alive = true;
    (async () => {
      const { id: handoffId, tab: urlTab } = readStudioParams();
      // A scoped id only ever reads its own record. The global keys are read
      // solely for older callers that did not send an id at all.
      const handoffKey = handoffId ? `amtool:studio:handoff:${handoffId}` : 'amtool:studio:handoff';
      const rawKey = handoffId ? `amtool:studio:handoff:raw:${handoffId}` : 'amtool:studio:handoff:raw';
      const [handoff, raw] = await Promise.all([
        sessionGet<StudioHandoff>(handoffKey),
        sessionGet<{ chatData: RawChat; pageUrl: string; at?: number }>(rawKey),
      ]);
      if (!alive) return;
      // The dock writes a raw capture to chrome.storage.local while the popup
      // writes ready snapshots to chrome.storage.session — use whichever is newer.
      const rawSnap = raw?.chatData ? toSnapshot(raw.chatData, raw.pageUrl || '', langRef.current) : null;
      const handoffSnaps = handoff && Array.isArray(handoff.snapshots) ? handoff.snapshots : [];
      const rawNewer = (raw?.at ?? 0) > (handoff?.at ?? 0);
      const snapshots = rawNewer && rawSnap ? [rawSnap] : (handoffSnaps.length ? handoffSnaps : (rawSnap ? [rawSnap] : []));
      const tabId = rawNewer ? urlTab : (handoff?.tabId ?? urlTab ?? null);
      setSource(snapshots.length ? { snapshots, collectionTitle: handoff?.collectionTitle, tabId } : null);
    })();
    return () => { alive = false; };
  }, [navInput]);
  const input: StudioInput | null = source === undefined ? null : source;
  const [snaps, setSnaps] = useState<ConversationSnapshot[]>(input?.snapshots ?? []);
  const [sel, setSel] = useState<Map<string, Set<string>>>(() => new Map((input?.snapshots ?? []).map(sn => [sn.id, input?.preselect?.get(sn.id) ?? new Set(sn.messages.map(m => m.id))])));
  const [opts, setOpts] = useState<ExportOptions>({ ...s.settings.defaultExportOptions });
  const [q, setQ] = useState(''); const [range, setRange] = useState({ a: '', b: '' }); const [rangeErr, setRangeErr] = useState(false);
  const [busy, setBusy] = useState(false); const [printMode, setPrintMode] = useState(false); const [mobilePane, setMobilePane] = useState<'list' | 'preview'>('list');
  const [editingTitle, setEditingTitle] = useState(false);
  const [sitesOpen, setSitesOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const busyRef = useRef(false);
  const [fontCss, setFontCss] = useState('');
  // Self-hosted fonts only: the sandboxed preview cannot load a remote stylesheet
  // and the extension must keep working without a network connection.
  useEffect(() => {
    let alive = true;
    void previewFontCss().then(css => { if (alive) setFontCss(css); });
    return () => { alive = false; };
  }, []);
  useEffect(() => { setSnaps(input?.snapshots ?? []); setSel(new Map((input?.snapshots ?? []).map(sn => [sn.id, input?.preselect?.get(sn.id) ?? new Set(sn.messages.map(m => m.id))]))); }, [input]);

  // Message ids are only unique inside their conversation, so every lookup in
  // this surface uses an `snapshot::message` key instead of the bare id.
  const all = useMemo(() => snaps.flatMap(sn => sn.messages.map(m => ({ sn, m, key: `${sn.id}::${m.id}` }))), [snaps]);
  const total = all.length;
  const selectedCount = all.filter(({ sn, m }) => sel.get(sn.id)?.has(m.id)).length;
  const key = searchKey(q);
  const visible = useMemo(() => key ? all.filter(({ m }) => searchKey(m.plainText).includes(key)) : all, [all, key]);
  const visibleKeys = useMemo(() => new Set(visible.map(item => item.key)), [visible]);
  const outsideSearch = key ? all.filter(item => sel.get(item.sn.id)?.has(item.m.id) && !visibleKeys.has(item.key)).length : 0;

  const setMany = (pred: (sn: ConversationSnapshot, i: number, role: MessageRole) => boolean) => setSel(new Map(snaps.map(sn => [sn.id, new Set(sn.messages.filter((m, i) => pred(sn, i, m.role)).map(m => m.id))])));
  const toggle = (snId: string, mId: string, v: boolean) => setSel(prev => { const n = new Map(prev); const set = new Set(n.get(snId)); v ? set.add(mId) : set.delete(mId); n.set(snId, set); return n; });
  const applyRange = () => {
    const a = Number(range.a), b = Number(range.b);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b > total || a > b) { setRangeErr(true); return; }
    setRangeErr(false); const ids = new Set(all.slice(a - 1, b).map(x => x.key)); setSel(new Map(snaps.map(sn => [sn.id, new Set(sn.messages.filter(m => ids.has(`${sn.id}::${m.id}`)).map(m => m.id))])));
  };
  const selectSearch = () => { const ids = new Set(visible.map(x => x.key)); setSel(new Map(snaps.map(sn => [sn.id, new Set(sn.messages.filter(m => ids.has(`${sn.id}::${m.id}`)).map(m => m.id))]))); };

  const exportInput: ExportInput = { snapshots: snaps, selection: sel, collectionTitle: input?.collectionTitle, lang: s.lang };
  const previewHtml = useMemo(() => selectedCount ? toHtml(exportInput, opts, true) : '', [snaps, sel, opts, s.lang, selectedCount]); // eslint-disable-line react-hooks/exhaustive-deps
  const available = FORMAT_META[opts.format].available;

  const doExport = async () => {
    // A ref lock stops a double click from starting two downloads before the
    // disabled state has rendered.
    if (!selectedCount || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setFailed(false);
    try {
      const r = await exportConversation(exportInput, opts, s.lang);
      if (!r.ok) {
        setFailed(true);
        s.toast('error', T(`err${r.code}` as never));
      } else if (r.printTab) s.toast('info', T('printOpened'));
      else s.toast('success', `${T('fileReady')} · ${r.filename ?? ''}`.trim());
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const recapture = async () => {
    if (!input?.tabId) { s.toast('warning', T('noTabRemembered')); return; }
    setBusy(true);
    const outcome = await captureTabById(input.tabId);
    setBusy(false);
    if (!outcome.ok || !outcome.snapshot) {
      s.toast('error', T(`err${outcome.error}` as never));
      return;
    }
    const snap = outcome.snapshot;
    setSnaps([snap]);
    setSel(new Map([[snap.id, new Set(snap.messages.map(m => m.id))]]));
    s.toast('success', T('captured'));
  };
  const O = <K extends keyof ExportOptions>(k: K, v: ExportOptions[K]) => setOpts(o => ({ ...o, [k]: v }));
  const roleTone = (r: MessageRole) => r === 'user' ? 'primary' : r === 'assistant' ? 'neutral' : r === 'unknown' ? 'warning' : 'neutral';
  const anyPartial = snaps.some(sn => sn.captureStatus !== 'complete');

  if (source === undefined) {
    return (
      <div className="grid h-full place-items-center bg-bg text-muted">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!snaps.length) return <div className="p-8 text-center text-muted">{T('noConversation')}<p className="mx-auto mt-1 max-w-sm text-[12.5px]">{T('studioEmptyHint')}</p><div className="mt-3"><Button onClick={() => nav.go('popup')} icon={I.back}>{T('back')}</Button></div></div>;

  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex items-center gap-3 border-b border-border px-4 py-2.5 bg-surface">
        <IconButton icon={I.back} label={T('back')} onClick={() => nav.go('popup')} />
        {input?.tabId != null && <IconButton icon={I.refresh} label={T('captureNow')} onClick={recapture} />}
        <div className="min-w-0 flex-1">
          {editingTitle && snaps.length === 1 ? <Input autoFocus aria-label={T('editTitle')} defaultValue={snaps[0].title} onBlur={e => { setSnaps([{ ...snaps[0], title: e.target.value || snaps[0].title }]); setEditingTitle(false); }} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} className="max-w-md" /> :
            <button className="flex items-center gap-2 group min-w-0" onClick={() => snaps.length === 1 && setEditingTitle(true)} title={T('editTitle')}><h1 className="truncate text-[16px] font-semibold" dir="auto">{input?.collectionTitle || snaps[0].title}</h1>{snaps.length === 1 && <Icon d={I.edit} size={14} className="text-muted opacity-0 group-hover:opacity-100" />}</button>}
          <p className="text-[12px] text-muted flex gap-2 items-center flex-wrap">{snaps.length === 1 ? platformName(snaps[0].platformId) : `${snaps.length} conversations`} · <span className="tabular">{total}</span> {T('snapshotMsg')}{snaps.length === 1 && snaps[0].titleSource === 'generated' && <Chip tone="warning">{T('generatedTitleShort')}</Chip>}{snaps.some(x => x.demo) && <Chip tone="warning">{T('demoBadge')}</Chip>}</p>
        </div>
        <div className="md:hidden flex rounded-[8px] border border-border overflow-hidden text-[12px]">
          <button className={clsx('px-3 py-1.5', mobilePane === 'list' && 'bg-selected text-primary')} onClick={() => setMobilePane('list')}>{T('content')}</button>
          <button className={clsx('px-3 py-1.5', mobilePane === 'preview' && 'bg-selected text-primary')} onClick={() => setMobilePane('preview')}>{T('preview')}</button>
        </div>
        <IconButton icon={I.globe} label={T('tabSites')} onClick={() => setSitesOpen(true)} />
      </header>
      {anyPartial && <div className="flex items-center gap-2 bg-warning/10 px-4 py-1.5 text-[12.5px] text-warning"><Icon d={I.alert} size={15} />{T('partialNotice')}</div>}

      <div className="flex min-h-0 flex-1">
        {/* Selection + options pane */}
        <aside className={clsx('w-full md:w-[380px] lg:w-[420px] shrink-0 border-e border-border overflow-y-auto bg-surface', mobilePane !== 'list' && 'hidden md:block')}>
          <div className="p-3 flex flex-col gap-3">
            <div className="relative"><Icon d={I.search} size={15} className="absolute top-2.5 start-2.5 text-muted" /><Input value={q} onChange={e => setQ(e.target.value)} placeholder={T('searchMessages')} className="ps-8" /></div>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" onClick={() => setMany(() => true)}>{T('selectAll')}</Button>
              <Button size="sm" onClick={() => setMany(() => false)}>{T('selectNone')}</Button>
              <Button size="sm" onClick={() => setMany((_, __, r) => r === 'user')}>{T('onlyUser')}</Button>
              <Button size="sm" onClick={() => setMany((_, __, r) => r === 'assistant')}>{T('onlyAssistant')}</Button>
              {key && <Button size="sm" variant="primary" onClick={selectSearch}>{T('selectSearchResults')} ({visible.length})</Button>}
            </div>
            <div className="flex items-center gap-1.5 text-[12.5px]">
              <span className="text-muted">{T('range')}</span>
              <Input value={range.a} onChange={e => setRange(r => ({ ...r, a: e.target.value }))} className="w-16 text-center ltr" inputMode="numeric" placeholder="1" aria-label="from" />
              <span>–</span>
              <Input value={range.b} onChange={e => setRange(r => ({ ...r, b: e.target.value }))} className="w-16 text-center ltr" inputMode="numeric" placeholder={String(total)} aria-label="to" />
              <Button size="sm" onClick={applyRange}>{T('apply')}</Button>
            </div>
            {rangeErr && <p className="text-[12px] text-error -mt-1">{T('rangeError')}</p>}
            <div className="flex items-center justify-between text-[12.5px]"><span className="tabular"><b className="text-primary">{selectedCount}</b> {T('selectedOf')} {total}</span>{outsideSearch > 0 && <Chip tone="warning">{outsideSearch} {T('selectedOutsideSearch')}</Chip>}</div>

            <ul className="flex flex-col gap-1" role="list">
              {visible.map(({ sn, m, key: rowKey }) => {
                const idx = all.findIndex(x => x.key === rowKey) + 1; const checked = !!sel.get(sn.id)?.has(m.id);
                return (
                  <li key={rowKey} className={clsx('flex items-start gap-2 rounded-[10px] border px-2.5 py-2 transition-colors', checked ? 'border-primary/40 bg-selected' : 'border-border bg-raised')}>
                    <Checkbox checked={checked} ariaLabel={`${T('messageLabel')} ${idx} · ${T(`role_${m.role}` as never)}`} onChange={v => toggle(sn.id, m.id, v)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[11.5px]"><span className="tabular text-muted">#{idx}</span><Chip tone={roleTone(m.role)}>{T(`role_${m.role}` as never)}</Chip>
                        {m.blocks.some(b => b.type === 'code') && <Chip>code</Chip>}{m.blocks.some(b => b.type === 'thinking') && <Chip>thinking</Chip>}{snaps.length > 1 && <span className="truncate text-muted">{sn.title}</span>}</div>
                      <p className="mt-0.5 line-clamp-2 text-[12.5px] text-text/90" dir="auto">{m.plainText}</p>
                    </div>
                  </li>);
              })}
            </ul>

            <div className="border-t border-border pt-3 flex flex-col gap-3">
              <div><SectionHeader title={T('format')} />
                <div className="grid grid-cols-4 gap-1.5">{FORMATS.map(f => <button key={f} onClick={() => O('format', f)} title={FORMAT_META[f].available ? '' : T('notAvailableWeb')} className={clsx('h-9 rounded-[8px] border text-[12px] font-semibold ltr', opts.format === f ? 'border-primary bg-selected text-primary' : 'border-border bg-raised text-muted hover:text-text', !FORMAT_META[f].available && 'border-dashed opacity-60')}>{f.toUpperCase()}</button>)}</div>
                {opts.format === 'pdf' && <p className="mt-1.5 text-[11.5px] text-muted flex gap-1 leading-snug"><Icon d={I.info} size={14} />{T('pdfPrintHint')}</p>}
                {!available && <p className="mt-1.5 text-[11.5px] text-warning flex gap-1"><Icon d={I.info} size={14} />{T('notAvailableWeb')}</p>}
              </div>
              <div><SectionHeader title={T('content')} />
                <div className="divide-y divide-border">
                  <Switch checked={opts.includeTitle} onChange={v => O('includeTitle', v)} label={T('incTitle')} />
                  <Switch checked={opts.includeRoles} onChange={v => O('includeRoles', v)} label={T('incRoles')} />
                  <Switch checked={opts.includeSource} onChange={v => O('includeSource', v)} label={T('incSource')} />
                  <Switch checked={opts.includeTimestamps} onChange={v => O('includeTimestamps', v)} label={T('incTime')} />
                  <Switch checked={opts.includeThinking} onChange={v => O('includeThinking', v)} label={T('incThinking')} disabled={!all.some(x => x.m.blocks.some(b => b.type === 'thinking'))} />
                  <Switch checked={opts.separators} onChange={v => O('separators', v)} label={T('separators')} />
                  <Switch checked={opts.brandingEnabled} onChange={v => O('brandingEnabled', v)} label={T('branding')} />
                  {opts.brandingEnabled && <Input value={opts.brandingText} onChange={e => O('brandingText', e.target.value)} placeholder="—" className="my-2" />}
                </div>
              </div>
              <div><SectionHeader title={T('docTheme')} />
                <div className="grid grid-cols-4 gap-1.5">{THEMES.map(th => <button key={th} onClick={() => O('theme', th)} className={clsx('rounded-[8px] border p-1.5 text-[11px]', opts.theme === th ? 'border-primary' : 'border-border')}><span className="block h-5 rounded-[5px] mb-1 border border-black/10" style={{ background: { light: '#fff', dark: '#0B0F12', note: '#FFFBEB', oldpaper: '#F3E9D2', sakura: '#FFF1F5', bluemist: '#EFF6FF', freshgreen: '#F0FDF4', lavender: '#F5F3FF' }[th] }} />{THEME_LABEL[th][s.lang === 'fa' ? 0 : 1]}</button>)}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[12px]">
                <label>{T('font')}<Select className="w-full mt-1" value={opts.fontSize} onChange={e => O('fontSize', e.target.value as never)} options={[{ value: 'small', label: T('small') }, { value: 'medium', label: T('medium') }, { value: 'large', label: T('large') }]} /></label>
                <label>{T('table')}<Select className="w-full mt-1" value={opts.tableStyle} onChange={e => O('tableStyle', e.target.value as never)} options={[{ value: 'solid', label: T('solid') }, { value: 'dashed', label: T('dashed') }, { value: 'borderless', label: T('borderless') }]} /></label>
                <label>{T('fileName')}<Select className="w-full mt-1" value={opts.fileNamePattern} onChange={e => O('fileNamePattern', e.target.value as never)} options={[{ value: 'ai_title_date', label: 'AI + Title + Date' }, { value: 'title_date', label: 'Title + Date' }, { value: 'ai_title', label: 'AI + Title' }, { value: 'date_title', label: 'Date + Title' }]} /></label>
                <label>{T('pdfOpts')}<Select className="w-full mt-1" value={opts.paperSize} onChange={e => O('paperSize', e.target.value as never)} options={['A4', 'A3', 'A5', 'Letter', 'Legal'].map(v => ({ value: v, label: v }))} /></label>
                <label>{T('margins')}<Select className="w-full mt-1" value={opts.margins} onChange={e => O('margins', e.target.value as never)} options={[{ value: 'small', label: T('small') }, { value: 'medium', label: T('medium') }, { value: 'large', label: T('large') }]} /></label>
                <label>PNG<Select className="w-full mt-1" value={opts.pngMode} onChange={e => O('pngMode', e.target.value as never)} options={[{ value: 'split', label: 'Split / ZIP' }, { value: 'single', label: 'Single' }]} /></label>
              </div>
              <Switch checked={opts.orientation === 'landscape'} onChange={v => O('orientation', v ? 'landscape' : 'portrait')} label={T('landscape')} />
              <Switch checked={opts.pageNumbers} onChange={v => O('pageNumbers', v)} label={T('pageNumbers')} />
            </div>
          </div>
        </aside>

        {/* Preview pane */}
        <section className={clsx('min-w-0 flex-1 flex flex-col', mobilePane !== 'preview' && 'hidden md:flex')}>
          <div className="flex items-center justify-between border-b border-border px-4 py-2 text-[12.5px] bg-surface">
            <span className="font-medium">{T('preview')} · <span className="ltr">{opts.format.toUpperCase()}</span></span>
            <Switch checked={printMode} onChange={setPrintMode} label={T('printPreview')} />
          </div>
          <div className="flex-1 overflow-auto p-4" style={{ background: 'repeating-linear-gradient(45deg, transparent 0 10px, rgba(127,127,127,.03) 10px 20px)' }}>
            {selectedCount === 0 ? <p className="text-center text-muted py-10">{T('noSelection')}</p> :
              <div className={clsx('mx-auto shadow-xl rounded-[4px] overflow-hidden', printMode && 'border border-border')} style={printMode ? { width: opts.orientation === 'portrait' ? '210mm' : '297mm', maxWidth: '100%', minHeight: opts.orientation === 'portrait' ? '297mm' : '210mm' } : { maxWidth: 860 }}>
                <iframe title="preview" sandbox="" srcDoc={`<!doctype html><html dir="${s.lang === 'fa' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><style>${fontCss}</style></head><body style="margin:0">${previewHtml}${opts.pageNumbers && printMode ? '<div style="text-align:center;font-size:11px;opacity:.6;padding:8px">— 1 —</div>' : ''}</body></html>`} className="block w-full bg-white" style={{ height: printMode ? (opts.orientation === 'portrait' ? '297mm' : '210mm') : 'calc(100vh - 200px)', border: 0 }} />
              </div>}
          </div>
          <footer className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-border bg-surface px-4 py-2.5">
            <span className="text-[12.5px] text-muted tabular"><b className="text-text">{selectedCount}</b> / {total} · <span className="ltr">{opts.format.toUpperCase()}</span>{busy && ` · ${T('building')}`}</span>
            <div className="flex items-center gap-2">
              {failed && <Button size="sm" variant="ghost" icon={I.refresh} disabled={busy} onClick={doExport}>{T('retry')}</Button>}
              <Button variant="primary" icon={I.download} loading={busy} disabled={!selectedCount || !available} onClick={doExport} title={!available ? T('notAvailableWeb') : ''}>{opts.format === 'pdf' ? T('pdfPrintAction') : T('download')}</Button>
            </div>
          </footer>
        </section>
      </div>

      {/* BUG-11: a state-preserving shortcut to the AI sites. Opening it never
          unmounts the selection or the export options underneath. */}
      {sitesOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-labelledby="sites-title"
          onKeyDown={event => { if (event.key === 'Escape') setSitesOpen(false); }} onClick={() => setSitesOpen(false)}>
          <div className="max-h-full w-full max-w-2xl overflow-auto rounded-[14px] border border-border bg-bg shadow-2xl" onClick={event => event.stopPropagation()}>
            <div className="sticky top-0 flex items-center justify-between gap-2 border-b border-border bg-surface px-4 py-2.5">
              <h2 id="sites-title" className="text-[14px] font-semibold">{T('tabSites')}</h2>
              <IconButton icon={I.x} label={T('close')} autoFocus onClick={() => setSitesOpen(false)} />
            </div>
            <div className="p-3">
              <p className="mb-2 text-[12px] text-muted">{T('sitesOverlayHint')}</p>
              <ul className="flex flex-col gap-1">
                {PLATFORMS.map(platform => {
                  const tone: Record<SupportStatus, 'success' | 'warning' | 'neutral' | 'error'> = { tested: 'success', experimental: 'warning', loginRequired: 'neutral', unavailable: 'error' };
                  return (
                    <li key={platform.id} className="flex items-center gap-2.5 rounded-[10px] border border-border bg-surface px-2.5 py-2">
                      <span className="grid h-7 w-7 place-items-center rounded-[7px] text-[11px] font-bold" style={{ background: `${platform.color}22`, color: platform.color }}>{platform.name.slice(0, 1)}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{platform.name}</span><span className="block truncate text-[11px] text-muted ltr text-start">{platform.domains[0]}</span></span>
                      <Chip tone={tone[platform.status]}>{T(platform.status as never)}</Chip>
                      <a href={platform.officialUrl} target="_blank" rel="noopener noreferrer" className="grid h-8 w-8 place-items-center rounded-[8px] text-muted hover:text-primary" aria-label={platform.name}><Icon d={I.ext} size={15} /></a>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
