#!/bin/bash
# This is a template scaffolding script.
# Copy this to a new widget folder to get started with the correct schema patterns built in.
# Usage: bash create-widget.sh my-widget-name

WIDGET_ID="${1:-my-widget}"

echo "Creating widget: $WIDGET_ID"

mkdir -p "src/widgets/$WIDGET_ID"
cd "src/widgets/$WIDGET_ID"

# Create constants.ts with the correct schema pattern
cat > constants.ts << 'EOF'
import { createMigration, emptyMigrations } from '@renderer/hooks/sqlMigrationHelper';
import type { SqlMigration } from '@renderer/hooks/useSqlInit';

// ─── SQL Schema ────────────────────────────────────────────────────────────

/**
 * INIT_SQL: All columns that exist in the initial schema (v1.0 release).
 * 
 * Important: Include ALL columns you need at launch here.
 * Do NOT add migration statements for these columns.
 */
export const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS items (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    title     TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`;

/**
 * MIGRATIONS: Columns added AFTER the initial release.
 * 
 * Important: Only add columns that were NOT in INIT_SQL.
 * The useSqlInit hook will validate this and throw an error if there's a conflict.
 * 
 * When you need to add a new column in a later version, replace emptyMigrations() with:
 * 
 *   export const MIGRATIONS: SqlMigration[] = [
 *     createMigration('items', 'priority', 'ALTER TABLE items ADD COLUMN priority INTEGER DEFAULT 0'),
 *   ];
 */
export const MIGRATIONS: SqlMigration[] = emptyMigrations();
EOF

# Create types.ts
cat > types.ts << 'EOF'
export interface Item {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}
EOF

# Create index.tsx with useSqlInit hook usage
cat > index.tsx << 'EOF'
import { useState, useEffect } from 'react';
import type { Widget, WidgetProps } from '@renderer/plugins/registry';
import { useSqlInit } from '@renderer/hooks/useSqlInit';
import { INIT_SQL, MIGRATIONS } from './constants';
import type { Item } from './types';

function MyWidget({ api, setTitle }: WidgetProps) {
  const [items, setItems] = useState<Item[]>([]);
  
  // This hook:
  // - Runs INIT_SQL once
  // - Applies migrations safely
  // - Validates schema for conflicts
  // - Returns true when database is ready
  const ready = useSqlInit(api, INIT_SQL, MIGRATIONS);

  const loadItems = async () => {
    const rows = await api.sql.all<Item>('SELECT * FROM items ORDER BY created_at DESC');
    setItems(rows);
  };

  useEffect(() => {
    if (ready) void loadItems();
  }, [ready]);

  const addItem = async (title: string) => {
    if (!title.trim()) return;
    await api.sql.run('INSERT INTO items (title) VALUES (?)', [title.trim()]);
    void loadItems();
  };

  if (!ready) return <div style={{ padding: 12, color: 'var(--text-dim)' }}>Loading…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <input
          type="text"
          placeholder="Add item…"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.currentTarget.value) {
              void addItem(e.currentTarget.value);
              e.currentTarget.value = '';
            }
          }}
          style={{ width: '100%' }}
        />
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {items.map((item) => (
          <li key={item.id} style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>
            {item.title}
          </li>
        ))}
      </ul>
    </div>
  );
}

const widget: Widget = {
  manifest: {
    id: 'my-widget',
    name: 'My Widget',
    description: 'A basic widget template',
    version: '0.1.0',
    icon: '📝',
    defaultSize: { w: 6, h: 5 },
    permissions: { sqlite: true },
  },
  Component: MyWidget,
};

export default widget;
EOF

echo "✅ Widget created at src/widgets/$WIDGET_ID"
echo ""
echo "Next steps:"
echo "1. Edit constants.ts to define your schema"
echo "2. Edit types.ts to define your data types"
echo "3. Edit index.tsx to build your widget UI"
echo ""
echo "Read the schema guide: src/renderer/src/hooks/SCHEMA_PATTERN.md"
