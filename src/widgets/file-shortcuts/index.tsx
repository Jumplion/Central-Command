import { useState, useEffect, useRef } from 'react';
import type { Widget, WidgetProps } from '@renderer/plugins/registry';

interface Shortcut {
  id: string;
  path: string;
  label: string;
  kind: 'file' | 'dir';
}

// Electron exposes path on File objects dropped from the OS
type ElectronFile = File & { path?: string };

function guessKind(file: ElectronFile): 'file' | 'dir' {
  // Directories have an empty MIME type in Electron drag-and-drop
  return file.type === '' ? 'dir' : 'file';
}

function basename(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Sub-components ────────────────────────────────────────────────────────

function ShortcutRow({ shortcut, onOpen, onReveal, onRemove }: {
  shortcut: Shortcut;
  onOpen: (s: Shortcut) => void;
  onReveal: (s: Shortcut) => void;
  onRemove: (id: string) => void;
}) {
  const icon = shortcut.kind === 'dir' ? '📁' : '📄';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 2px',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <span style={{ fontSize: 15, flexShrink: 0 }}>{icon}</span>
      <button
        className="ghost"
        style={{
          flex: 1,
          textAlign: 'left',
          padding: '2px 4px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: 13,
        }}
        title={shortcut.path}
        onClick={() => onOpen(shortcut)}
      >
        {shortcut.label}
      </button>
      <button
        className="ghost"
        style={{ padding: '2px 6px', fontSize: 12, color: 'var(--text-dim)', flexShrink: 0 }}
        title="Show in folder"
        onClick={() => onReveal(shortcut)}
      >
        ↗
      </button>
      <button
        className="ghost danger"
        style={{ padding: '2px 6px', fontSize: 12, flexShrink: 0 }}
        title="Remove shortcut"
        onClick={() => onRemove(shortcut.id)}
      >
        ✕
      </button>
    </div>
  );
}

// ─── Main widget ───────────────────────────────────────────────────────────

function FileShortcuts({ api }: WidgetProps) {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.kv.get<Shortcut[]>('shortcuts').then((v) => setShortcuts(v ?? []));
  }, []);

  const persist = async (next: Shortcut[]) => {
    setShortcuts(next);
    await api.kv.set('shortcuts', next);
  };

  const makeShortcut = (filePath: string, kind: 'file' | 'dir'): Shortcut => ({
    id: makeId(),
    path: filePath,
    label: basename(filePath),
    kind,
  });

  const browse = async (kind: 'file' | 'dir') => {
    const paths = await api.dialog.openPath({
      title: kind === 'file' ? 'Add file shortcut' : 'Add folder shortcut',
      properties: [kind === 'file' ? 'openFile' : 'openDirectory', 'multiSelections'],
    });
    if (paths) await persist([...shortcuts, ...paths.map((p) => makeShortcut(p, kind))]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files) as ElectronFile[];
    const added = files.filter((f) => f.path).map((f) => makeShortcut(f.path!, guessKind(f)));
    if (added.length > 0) persist([...shortcuts, ...added]).catch(console.error);
  };

  const handleRemove = (id: string) => persist(shortcuts.filter((s) => s.id !== id));
  const handleOpen = (s: Shortcut) => void api.shell.openPath(s.path);
  const handleReveal = (s: Shortcut) => void api.shell.showItemInFolder(s.path);

  return (
    <div
      ref={containerRef}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8, position: 'relative' }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={(e) => {
        if (!containerRef.current?.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={handleDrop}
    >
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => browse('file').catch(console.error)}>
          + File
        </button>
        <button style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => browse('dir').catch(console.error)}>
          + Folder
        </button>
      </div>

      {shortcuts.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-dim)',
            fontSize: 13,
            textAlign: 'center',
            border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 6,
            padding: 16,
            transition: 'border-color 0.15s',
          }}
        >
          Drop files or folders here,
          <br />
          or use the buttons above
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {shortcuts.map((s) => (
            <ShortcutRow
              key={s.id}
              shortcut={s}
              onOpen={handleOpen}
              onReveal={handleReveal}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}

      {dragging && shortcuts.length > 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(110,168,255,0.08)',
            border: '2px dashed var(--accent)',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent)',
            fontWeight: 600,
            fontSize: 14,
            pointerEvents: 'none',
          }}
        >
          Drop to add
        </div>
      )}
    </div>
  );
}

// ─── Widget export ─────────────────────────────────────────────────────────

const widget: Widget = {
  manifest: {
    id: 'file-shortcuts',
    name: 'File Shortcuts',
    description: 'Quick-launch shortcuts to files and folders. Drag and drop to add.',
    version: '0.1.0',
    icon: '📂',
    defaultSize: { w: 4, h: 6 },
    minSize: { w: 3, h: 4 },
  },
  Component: FileShortcuts,
};

export default widget;
