import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, BookOpen, CheckSquare, FileText, Heading2, List, Plus, Save, Table2, Trash2, Type } from 'lucide-react';
import { formatDate, t } from './i18n.js';
import { api, Feedback, IconButton, Modal, spaceName } from './ui.jsx';

const blockTypes = [
  ['text', Type, 'Teks', 'Text'],
  ['heading', Heading2, 'Judul bagian', 'Heading'],
  ['bullet', List, 'Poin', 'Bullet'],
  ['checklist', CheckSquare, 'Checklist', 'Checklist'],
  ['table', Table2, 'Tabel', 'Table'],
];

function NoteTable({ block, index, update }) {
  const cols = block.cells[0].length;
  const rows = block.cells.length;
  function updateCell(row, col, value) {
    update({ cells: block.cells.map((items, r) => r === row ? items.map((cell, c) => c === col ? value : cell) : items) });
  }
  return <div className="note-table-wrap">
    <div className="note-table-scroll" role="region" aria-label={t(`Isi tabel ${index}`, `Table ${index} contents`)} tabIndex={0}>
      <table className="note-table">
        <thead><tr>{block.cells[0].map((cell, col) => <th key={col} scope="col"><input value={cell} maxLength={1000}
          aria-label={t(`Judul kolom ${col + 1}`, `Column ${col + 1} heading`)} placeholder={t('Judul kolom', 'Column heading')}
          onChange={(event) => updateCell(0, col, event.target.value)} /></th>)}</tr></thead>
        <tbody>{block.cells.slice(1).map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, col) => <td key={col}><input value={cell} maxLength={1000}
          aria-label={t(`Baris ${rowIndex + 1}, kolom ${col + 1}`, `Row ${rowIndex + 1}, column ${col + 1}`)}
          onChange={(event) => updateCell(rowIndex + 1, col, event.target.value)} /></td>)}</tr>)}</tbody>
      </table>
    </div>
    <div className="note-table-actions">
      <button type="button" className="button button-secondary" disabled={rows >= 25} onClick={() => update({ cells: [...block.cells, Array(cols).fill('')] })}>
        <Plus size={14} />{t('Baris', 'Row')}
      </button>
      <button type="button" className="button button-secondary" disabled={cols >= 12} onClick={() => update({ cells: block.cells.map((row) => [...row, '']) })}>
        <Plus size={14} />{t('Kolom', 'Column')}
      </button>
      <button type="button" className="text-button" disabled={rows < 2} onClick={() => update({ cells: block.cells.slice(0, -1) })}>{t('Hapus baris terakhir', 'Remove last row')}</button>
      <button type="button" className="text-button" disabled={cols < 2} onClick={() => update({ cells: block.cells.map((row) => row.slice(0, -1)) })}>{t('Hapus kolom terakhir', 'Remove last column')}</button>
    </div>
  </div>;
}

function NoteBlock({ block, index, total, update, move, remove }) {
  const [, Icon, idLabel, enLabel] = blockTypes.find(([type]) => type === block.type);
  const label = t(idLabel, enLabel);
  return <section className="note-block" aria-label={`${label} ${index}`}>
    <div className="note-block-bar">
      <span><Icon size={14} aria-hidden="true" />{label}</span>
      <div>
        <IconButton label={t(`Naikkan blok ${index}`, `Move block ${index} up`)} disabled={index === 1} onClick={() => move(-1)}><ArrowUp size={14} /></IconButton>
        <IconButton label={t(`Turunkan blok ${index}`, `Move block ${index} down`)} disabled={index === total} onClick={() => move(1)}><ArrowDown size={14} /></IconButton>
        <IconButton label={t(`Hapus blok ${index}`, `Delete block ${index}`)} onClick={remove}><Trash2 size={14} /></IconButton>
      </div>
    </div>
    {block.type === 'table' ? <NoteTable block={block} index={index} update={update} /> :
      <div className={`note-block-field note-block-${block.type}`}>
        {block.type === 'bullet' && <span aria-hidden="true">•</span>}
        {block.type === 'checklist' && <input type="checkbox" checked={Boolean(block.checked)} onChange={(event) => update({ checked: event.target.checked })}
          aria-label={t(`Tandai checklist ${index}`, `Complete checklist item ${index}`)} />}
        <textarea aria-label={`${label} ${index}`} maxLength={8000} value={block.text || ''} placeholder={t('Mulai menulis…', 'Start writing…')}
          rows={block.type === 'text' ? 3 : 1} onChange={(event) => update({ text: event.target.value })} />
      </div>}
  </section>;
}

export function NotesPage({ space, unsaved }) {
  const [notes, setNotes] = useState(null);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [saved, setSaved] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const scope = { space: space.id };

  useEffect(() => {
    const controller = new AbortController();
    api('/documents', 'GET', undefined, { space: space.id, signal: controller.signal }).then((items) => {
      if (controller.signal.aborted) return;
      setNotes(items);
      setSelected((current) => items.some(({ id }) => id === current) ? current : items[0]?.id || null);
    }).catch((problem) => { if (!controller.signal.aborted) setError(problem.message); });
    return () => controller.abort();
  }, [space.id, retry]);

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    api(`/documents/${selected}`, 'GET', undefined, { space: space.id, signal: controller.signal }).then((item) => {
      if (!controller.signal.aborted) { setDraft(item); setError(''); }
    }).catch((problem) => { if (!controller.signal.aborted) setError(problem.message); });
    return () => controller.abort();
  }, [space.id, selected, retry]);

  useEffect(() => {
    const beforeUnload = (event) => {
      if (!unsaved.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      unsaved.current = false;
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [unsaved]);

  function markDirty(value) {
    unsaved.current = value;
    setDirty(value);
    if (value) setSaved(false);
  }

  function canDiscard() {
    return !dirty || window.confirm(t('Buang perubahan catatan yang belum disimpan?', 'Discard unsaved note changes?'));
  }

  function open(id) {
    if (id === selected || !canDiscard()) return;
    markDirty(false);
    setSaved(false);
    setError('');
    setDraft(null);
    setSelected(id);
  }

  async function create() {
    if (!canDiscard()) return;
    setBusy(true);
    setError('');
    try {
      const item = await api('/documents', 'POST', { title: t('Catatan tanpa judul', 'Untitled note') }, scope);
      markDirty(false);
      setSaved(false);
      setNotes((items) => [item, ...(items || [])]);
      setDraft(null);
      setSelected(item.id);
    } catch (problem) { setError(problem.message); }
    finally { setBusy(false); }
  }

  async function save(event) {
    event.preventDefault();
    if (!draft.title.trim()) {
      setError(t('Isi judul catatan.', 'Enter a note title.'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const item = await api(`/documents/${draft.id}`, 'PUT', { title: draft.title, blocks: draft.blocks, revision: draft.revision }, scope);
      setNotes((items) => [item, ...items.filter(({ id }) => id !== item.id)]);
      setDraft(item);
      markDirty(false);
      setSaved(true);
    } catch (problem) { setError(problem.message); }
    finally { setBusy(false); }
  }

  async function deleteNote() {
    setError('');
    setBusy(true);
    try {
      await api(`/documents/${draft.id}`, 'DELETE', { revision: draft.revision }, scope);
      const remaining = notes.filter(({ id }) => id !== draft.id);
      markDirty(false);
      setSaved(false);
      setNotes(remaining);
      setDraft(null);
      setSelected(remaining[0]?.id || null);
      setDeleteOpen(false);
    } catch (problem) { setError(problem.message); }
    finally { setBusy(false); }
  }

  function edit(change) {
    markDirty(true);
    setDraft((current) => ({ ...current, ...change(current) }));
  }

  function add(type) {
    const id = crypto.getRandomValues(new Uint32Array(4)).join('-');
    const block = type === 'table' ? { id, type, cells: [['', ''], ['', '']] } : { id, type, text: '' };
    edit(({ blocks }) => ({ blocks: [...blocks, block] }));
    requestAnimationFrame(() => document.getElementById(id)?.querySelector('textarea, table input')?.focus());
  }

  function move(index, step) {
    edit(({ blocks }) => {
      const ordered = [...blocks];
      [ordered[index], ordered[index + step]] = [ordered[index + step], ordered[index]];
      return { blocks: ordered };
    });
  }

  return <main className="page inner-page notes-page">
    <div className="page-heading"><span className="section-icon section-icon-blue"><BookOpen size={23} /></span><div><h1>{t('Catatan', 'Notes')}</h1><p>{spaceName(space)}</p></div></div>
    <div className="notes-layout">
      <aside className="panel notes-index" aria-label={t('Daftar catatan', 'Notes list')}>
        <div className="notes-index-heading"><h2>{t('Daftar catatan', 'Notes list')}</h2><IconButton label={t('Catatan baru', 'New note')} disabled={busy || !notes} onClick={create}><Plus size={19} /></IconButton></div>
        {notes?.length > 0 ? <ul>{notes.map((item) => <li key={item.id}>
          <button type="button" aria-current={item.id === selected ? 'true' : undefined} disabled={busy} onClick={() => open(item.id)}>
            <FileText size={16} aria-hidden="true" /><span>{item.title}<small>{formatDate(new Date(item.updated), { dateStyle: 'medium' })}</small></span>
          </button>
        </li>)}</ul> : <p>{notes ? t('Belum ada catatan.', 'No notes yet.') : !error && t('Memuat catatan…', 'Loading notes…')}</p>}
      </aside>
      {draft ? <section className="panel note-editor">
        <form onSubmit={save}>
          <fieldset className="note-editor-fields" disabled={busy}>
            <div className="note-editor-toolbar">
              <label className="note-title-label"><span className="sr-only">{t('Judul catatan', 'Note title')}</span>
                <input className="note-title" value={draft.title} maxLength={120} required onChange={(event) => edit(() => ({ title: event.target.value }))} />
              </label>
              <IconButton label={t('Hapus catatan', 'Delete note')} onClick={() => { setError(''); setDeleteOpen(true); }}><Trash2 size={18} /></IconButton>
            </div>
            <div className="note-blocks">
              {draft.blocks.map((block, index) => <div id={block.id} key={block.id}>
                <NoteBlock block={block} index={index + 1} total={draft.blocks.length}
                  update={(fields) => edit(({ blocks }) => ({ blocks: blocks.map((item) => item.id === block.id ? { ...item, ...fields } : item) }))}
                  move={(step) => move(index, step)} remove={() => edit(({ blocks }) => ({ blocks: blocks.filter((item) => item.id !== block.id) }))} />
              </div>)}
            </div>
            <div className="note-add" role="group" aria-label={t('Tambah blok', 'Add a block')}>
              {blockTypes.map(([type, Icon, idLabel, enLabel]) => <button type="button" className="button button-secondary" disabled={draft.blocks.length >= 100} key={type} onClick={() => add(type)}>
                <Icon size={15} aria-hidden="true" />{t(idLabel, enLabel)}
              </button>)}
            </div>
          </fieldset>
          {!deleteOpen && <Feedback error={error} />}
          <div className="settings-actions"><p role="status">{dirty ? t('Belum disimpan', 'Unsaved changes') : saved ? t('Catatan disimpan.', 'Note saved.') : ''}</p>
            <button className="button button-primary" disabled={busy || !dirty}><Save size={17} />{t('Simpan catatan', 'Save note')}</button>
          </div>
          {error && !deleteOpen && <button className="text-button" type="button" disabled={busy} onClick={() => {
            if (!canDiscard()) return;
            markDirty(false); setDraft(null); setError(''); setRetry((value) => value + 1);
          }}>{t('Muat ulang catatan', 'Reload note')}</button>}
        </form>
      </section> : <section className="panel empty-feature notes-empty">
        <span className="section-icon section-icon-blue"><BookOpen size={22} /></span>
        <Feedback error={error} />
        {error ? <button className="button button-secondary" onClick={() => { setError(''); setRetry((value) => value + 1); }}>{t('Coba lagi', 'Try again')}</button>
          : selected || !notes ? <h2 role="status">{t('Memuat catatan…', 'Loading notes…')}</h2>
            : <><h2>{t('Catatan pertamamu', 'Your first note')}</h2><p>{t('Tulis ide, daftar tugas, atau tabel untuk ruang ini.', 'Write ideas, checklists, or tables for this space.')}</p>
              <button className="button button-primary" disabled={busy} onClick={create}><Plus size={17} />{t('Buat catatan', 'Create note')}</button></>}
      </section>}
    </div>
    {deleteOpen && draft && <Modal title={t('Hapus catatan?', 'Delete note?')} close={() => setDeleteOpen(false)}>{(dismiss) => (
      <div className="form">
        <p>{t(`“${draft.title}” akan dihapus dari ruang ini.`, `“${draft.title}” will be removed from this space.`)}</p>
        <Feedback error={error} />
        <div className="modal-actions"><button className="button button-secondary" disabled={busy} onClick={dismiss}>{t('Batal', 'Cancel')}</button>
          <button className="button button-danger" disabled={busy} onClick={deleteNote}>{t('Hapus', 'Delete')}</button></div>
      </div>
    )}</Modal>}
  </main>;
}
