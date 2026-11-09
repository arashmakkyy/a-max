import { useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { useStore } from '../lib/store';
import { useNav } from '../lib/nav';
import { useT } from '../lib/i18n';
import { BrandLogo, Button, Card, Checkbox, Chip, Dialog, EmptyState, I, Icon, IconButton, Input, Select, Tabs, fmtBytes, fmtTime } from '../components/ui';
import { copyText, downloadBlob } from '../lib/export';
import { platformName } from '../lib/platforms';
import { searchKey } from '../lib/persian';
import type { PromptTemplate } from '../lib/types';
import { useCapture } from '../lib/capture';
import { draftConversationLabel } from '../lib/draftScope';

type PTab = 'collections' | 'vault' | 'cache';

export function SidePanel() {
  const nav = useNav();
  const T = useT(useStore().lang);
  const capture = useCapture();
  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <BrandLogo size={24} />
        <div className="flex items-center gap-0.5">
          <IconButton icon={I.refresh} label={T('captureNow')} size={32} onClick={() => capture.run()} />
          <IconButton icon={I.x} label={T('close')} onClick={() => window.close()} size={32} />
        </div>
      </header>
      <div className="px-2"><Tabs<PTab> compact value={nav.panelTab} onChange={nav.setPanelTab} tabs={[{ id: 'collections', label: T('collectionsTab'), icon: I.layers }, { id: 'vault', label: T('vaultTab'), icon: I.shield }, { id: 'cache', label: T('cacheTab'), icon: I.file }]} /></div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {nav.panelTab === 'collections' && <Collections />}
        {nav.panelTab === 'vault' && <Vault />}
        {nav.panelTab === 'cache' && <Cache />}
      </div>
    </div>
  );
}

function Collections() {
  const s = useStore(); const nav = useNav(); const T = useT(s.lang);
  const col = s.activeCollection; const [confirm, setConfirm] = useState(false); const [checked, setChecked] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const items = col.items.map(i => ({ item: i, snap: s.snapshots.find(x => x.id === i.snapshotId) })).filter(x => x.snap);
  const picked = items.filter(x => checked.size === 0 || checked.has(x.snap!.id));
  const open = () => nav.openStudio({ snapshots: picked.map(x => x.snap!), collectionTitle: col.title || (s.lang === 'fa' ? 'مجموعه گفتگوها' : 'Conversation collection') });
  return (
    <div className="flex h-full flex-col gap-3">
      <Input value={col.title} onChange={e => s.renameCollection(e.target.value)} placeholder={T('collectionTitle')} dir="auto" />
      {!items.length ? <EmptyState icon={I.layers} title={T('emptyCollection')} desc={T('emptyCollectionDesc')} /> : (
        <ul className="flex flex-col gap-1.5" role="list">
          {items.map(({ snap }, idx) => (
            <li key={snap!.id} draggable onDragStart={() => setDragId(snap!.id)} onDragOver={e => e.preventDefault()}
              onDrop={() => { if (dragId && dragId !== snap!.id) { const from = items.findIndex(x => x.snap!.id === dragId); const dir = from < idx ? 1 : -1; let steps = Math.abs(idx - from); while (steps--) s.moveInCollection(dragId, dir as 1 | -1); } setDragId(null); }}
              className={clsx('flex items-start gap-2 rounded-[10px] border border-border bg-surface p-2.5', dragId === snap!.id && 'opacity-50')}>
              <Checkbox checked={checked.has(snap!.id)} ariaLabel={snap!.title} onChange={v => setChecked(c => { const n = new Set(c); v ? n.add(snap!.id) : n.delete(snap!.id); return n; })} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium" dir="auto">{idx + 1}. {snap!.title}</p>
                <p className="text-[11.5px] text-muted flex flex-wrap gap-x-2 tabular"><span>{platformName(snap!.platformId)}</span><span>{snap!.messages.length} {T('snapshotMsg')}</span><span>{fmtTime(snap!.capturedAt, s.lang)}</span>{snap!.captureStatus !== 'complete' && <Chip tone="warning">{T('statusPartial')}</Chip>}</p>
              </div>
              <div className="flex flex-col"><IconButton icon={I.up} label={T('moveUp')} size={26} disabled={idx === 0} onClick={() => s.moveInCollection(snap!.id, -1)} /><IconButton icon={I.down} label={T('moveDown')} size={26} disabled={idx === items.length - 1} onClick={() => s.moveInCollection(snap!.id, 1)} /></div>
              <IconButton icon={I.trash} label={T('delete')} size={28} onClick={() => s.removeFromCollection(snap!.id)} className="hover:text-error" />
            </li>))}
        </ul>)}
      <div className="mt-auto flex flex-col gap-2 pt-2">
        <Button variant="primary" icon={I.fwd} disabled={!items.length} onClick={open}>{T('aggregateExport')} ({picked.length})</Button>
        {items.length > 0 && <Button variant="ghost" size="sm" icon={I.trash} onClick={() => setConfirm(true)}>{T('clearCollection')}</Button>}
      </div>
      <Dialog open={confirm} danger onClose={() => setConfirm(false)} title={T('clearCollection')} actions={<><Button variant="ghost" onClick={() => setConfirm(false)}>{T('cancel')}</Button><Button variant="danger" onClick={() => { s.clearCollection(); setConfirm(false); }}>{T('clearCollection')} ({items.length})</Button></>}>{T('confirmDeleteDesc')}</Dialog>
    </div>
  );
}

function Vault() {
  const s = useStore(); const nav = useNav(); const T = useT(s.lang);
  const [sub, setSub] = useState<'drafts' | 'history' | 'templates'>('drafts');
  const [q, setQ] = useState(''); const [order, setOrder] = useState<'newest' | 'oldest'>('newest'); const [edit, setEdit] = useState<Partial<PromptTemplate> | null>(null);
  const [del, setDel] = useState<{ kind: string; id: string } | null>(null); const fileRef = useRef<HTMLInputElement>(null);
  const k = searchKey(q); const sortFn = (a: string, b: string) => order === 'newest' ? b.localeCompare(a) : a.localeCompare(b);
  const drafts = s.drafts.filter(d => searchKey(d.text).includes(k)).sort((a, b) => sortFn(a.updatedAt, b.updatedAt));
  const hist = s.history.filter(d => searchKey(d.text).includes(k)).sort((a, b) => (Number(!!b.pinned) - Number(!!a.pinned)) || sortFn(a.createdAt, b.createdAt));
  const tpls = s.templates.filter(t => searchKey(t.title + ' ' + t.body).includes(k)).sort((a, b) => sortFn(a.updatedAt, b.updatedAt));
  const copy = async (t: string) => s.toast((await copyText(t)) ? 'success' : 'error', T('copied'));
  const useIn = (t: string) => { nav.setComposerText(t); nav.go('inpage'); };
  const exportVault = () => downloadBlob(JSON.stringify({ schemaVersion: 1, drafts: s.drafts, history: s.history, templates: s.templates }, null, 2), 'application/json', 'amtool-prompts.json').then(r => s.toast(r.ok ? 'success' : 'error', r.ok ? T('fileReady') : T('errDOWNLOAD_FAILED')));
  const importVault = async (f: File) => { const r = s.importBackup(JSON.stringify({ schemaVersion: 1, categories: JSON.parse(await f.text()) }), 'merge'); s.toast(r.ok ? 'success' : 'error', r.ok ? `${T('saved')} (${r.report})` : r.report); };

  const Row = ({ title, text, meta, actions, warn }: { title?: string; text: string; meta: string; actions: React.ReactNode; warn?: string }) => (
    <li className="rounded-[10px] border border-border bg-surface p-2.5">
      {title && <p className="text-[13px] font-medium" dir="auto">{title}</p>}
      <p className="line-clamp-3 text-[12.5px] whitespace-pre-wrap" dir="auto">{text}</p>
      <p className="mt-1 text-[11px] text-muted">{meta}{warn && <Chip tone="warning" className="ms-2">{warn}</Chip>}</p>
      <div className="mt-1.5 flex flex-wrap gap-1">{actions}</div>
    </li>);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex rounded-[8px] border border-border overflow-hidden text-[12px]">
        {(['drafts', 'history', 'templates'] as const).map(x => <button key={x} onClick={() => setSub(x)} className={clsx('flex-1 py-1.5 whitespace-nowrap px-2', sub === x && 'bg-selected text-primary font-medium')}>{T(x === 'drafts' ? 'drafts' : x === 'history' ? 'sentHistory' : 'templates')} <span className="tabular text-muted">({x === 'drafts' ? s.drafts.length : x === 'history' ? s.history.length : s.templates.length})</span></button>)}
      </div>
      <div className="flex gap-2"><Input value={q} onChange={e => setQ(e.target.value)} placeholder={T('search')} /><Select value={order} onChange={e => setOrder(e.target.value as never)} options={[{ value: 'newest', label: T('newest') }, { value: 'oldest', label: T('oldest') }]} /></div>
      {sub === 'templates' && <Button size="sm" icon={I.plus} onClick={() => setEdit({ title: '', body: '', category: '' })}>{T('newTemplate')}</Button>}
      <ul className="flex flex-col gap-1.5" role="list">
        {sub === 'drafts' && (drafts.length ? drafts.map(d => <Row key={d.id} text={d.text} meta={`${platformName(d.platformId)}${draftConversationLabel(d) ? ` · ${T('groupChat')} ${draftConversationLabel(d)}` : ''} · ${fmtTime(d.persistedAt, s.lang)} · rev ${d.revision}`} actions={<><Button size="sm" onClick={() => useIn(d.text)}>{T('restore')}</Button><Button size="sm" variant="ghost" onClick={() => copy(d.text)}>{T('copy')}</Button><Button size="sm" variant="ghost" className="text-error" onClick={() => setDel({ kind: 'draft', id: d.id })}>{T('delete')}</Button></>} />) : <EmptyState icon={I.shield} title={T('emptyList')} />)}
        {sub === 'history' && (hist.length ? hist.map(h => <Row key={h.id} text={h.text} meta={`${platformName(h.platformId)} · ${fmtTime(h.submittedAt, s.lang)}`} warn={h.pinned ? T('pinned') : undefined} actions={<><Button size="sm" onClick={() => useIn(h.text)}>{T('use')}</Button><Button size="sm" variant="ghost" onClick={() => copy(h.text)}>{T('copy')}</Button><Button size="sm" variant="ghost" onClick={() => s.togglePinHistory(h.id)}>{T('pin')}</Button><Button size="sm" variant="ghost" className="text-error" onClick={() => setDel({ kind: 'history', id: h.id })}>{T('delete')}</Button></>} />) : <EmptyState icon={I.send} title={T('emptyList')} />)}
        {sub === 'templates' && (tpls.length ? tpls.map(t => <Row key={t.id} title={t.title} text={t.body} meta={`${t.category || '—'} · ${fmtTime(t.updatedAt, s.lang)}`} actions={<><Button size="sm" onClick={() => useIn(t.body)}>{T('use')}</Button><Button size="sm" variant="ghost" onClick={() => copy(t.body)}>{T('copy')}</Button><Button size="sm" variant="ghost" onClick={() => setEdit(t)}>{T('edit')}</Button><Button size="sm" variant="ghost" className="text-error" onClick={() => setDel({ kind: 'template', id: t.id })}>{T('delete')}</Button></>} />) : <EmptyState icon={I.file} title={T('emptyList')} />)}
      </ul>
      <div className="flex gap-2 pt-1"><Button size="sm" icon={I.download} onClick={exportVault}>{T('exportJson')}</Button><Button size="sm" onClick={() => fileRef.current?.click()}>{T('importJson')}</Button><input ref={fileRef} type="file" accept="application/json" hidden onChange={e => e.target.files?.[0] && importVault(e.target.files[0])} /></div>

      <Dialog open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? T('edit') : T('newTemplate')} actions={<><Button variant="ghost" onClick={() => setEdit(null)}>{T('cancel')}</Button><Button variant="primary" disabled={!edit?.title?.trim() || !edit?.body?.trim()} onClick={() => { s.upsertTemplate({ ...edit!, title: edit!.title!, body: edit!.body! }); setEdit(null); }}>{T('save')}</Button></>}>
        {edit && <div className="flex flex-col gap-2 text-text">
          <Input placeholder={T('title')} value={edit.title ?? ''} onChange={e => setEdit({ ...edit, title: e.target.value })} dir="auto" />
          <Input placeholder={T('category')} value={edit.category ?? ''} onChange={e => setEdit({ ...edit, category: e.target.value })} dir="auto" />
          <textarea placeholder={T('body')} value={edit.body ?? ''} onChange={e => setEdit({ ...edit, body: e.target.value })} rows={5} dir="auto" className="w-full rounded-[8px] border border-border bg-raised p-2 text-[13px] text-text" />
        </div>}
      </Dialog>
      <Dialog open={!!del} danger onClose={() => setDel(null)} title={T('confirmDeleteTitle')} actions={<><Button variant="ghost" onClick={() => setDel(null)}>{T('cancel')}</Button><Button variant="danger" onClick={() => { if (del?.kind === 'draft') s.deleteDraft(del.id); if (del?.kind === 'history') s.deleteHistory(del.id); if (del?.kind === 'template') s.deleteTemplate(del.id); setDel(null); }}>{T('delete')}</Button></>}>{T('confirmDeleteDesc')}</Dialog>
    </div>
  );
}

function Cache() {
  const s = useStore(); const nav = useNav(); const T = useT(s.lang);
  const [q, setQ] = useState(''); const [sel, setSel] = useState<Set<string>>(new Set()); const [confirm, setConfirm] = useState(false);
  const list = useMemo(() => s.snapshots.filter(x => searchKey(x.title).includes(searchKey(q))), [s.snapshots, q]);
  const size = (x: object) => JSON.stringify(x).length * 2;
  return (
    <div className="flex h-full flex-col gap-3">
      {!s.settings.autoCacheEnabled && <p className="flex gap-1.5 text-[11.5px] text-muted"><Icon d={I.info} size={14} className="shrink-0 mt-0.5" />{T('autoCacheOff')}</p>}
      <Input value={q} onChange={e => setQ(e.target.value)} placeholder={T('search')} />
      {!list.length ? <EmptyState icon={I.file} title={T('emptyList')} /> : (
        <ul className="flex flex-col gap-1.5" role="list">{list.map(x => (
          <li key={x.id} className="flex items-start gap-2 rounded-[10px] border border-border bg-surface p-2.5">
            <Checkbox checked={sel.has(x.id)} ariaLabel={x.title} onChange={v => setSel(c => { const n = new Set(c); v ? n.add(x.id) : n.delete(x.id); return n; })} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium" dir="auto">{x.title} {x.pinned && <Chip tone="primary">{T('pinned')}</Chip>}{x.demo && <Chip tone="warning">{T('demoBadge')}</Chip>}</p>
              <p className="text-[11px] text-muted tabular flex flex-wrap gap-x-2"><span>{platformName(x.platformId)}</span><span>{x.messages.length} {T('snapshotMsg')}</span><span>{x.captureStatus}</span><span>{fmtBytes(size(x))}</span><span>{fmtTime(x.capturedAt, s.lang)}</span></p>
              <div className="mt-1.5 flex gap-1"><Button size="sm" onClick={() => nav.openStudio({ snapshots: [x] })}>{T('openInStudio')}</Button><Button size="sm" variant="ghost" onClick={() => s.togglePin(x.id)}>{T('pin')}</Button></div>
            </div>
          </li>))}</ul>)}
      <Card raised className="mt-auto p-2.5 text-[12px] flex items-center justify-between"><span className="text-muted">{T('storageUsed')}: <b className="text-text tabular">{fmtBytes(s.storageBytes)}</b></span><Button size="sm" variant="danger" icon={I.trash} disabled={!sel.size} onClick={() => setConfirm(true)}>{T('delete')} ({sel.size})</Button></Card>
      <Dialog open={confirm} danger onClose={() => setConfirm(false)} title={T('confirmDeleteTitle')} actions={<><Button variant="ghost" onClick={() => setConfirm(false)}>{T('cancel')}</Button><Button variant="danger" onClick={() => { s.deleteSnapshots([...sel]); setSel(new Set()); setConfirm(false); }}>{T('delete')} {sel.size} {T('items')}</Button></>}>{T('confirmDeleteDesc')}</Dialog>
    </div>
  );
}
