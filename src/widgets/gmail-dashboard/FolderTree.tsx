import type { FolderTreeNode } from "./types";

interface FolderNodeProps {
  node: FolderTreeNode;
  depth: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
}

function FolderNode({ node, depth, selectedId, onSelect }: FolderNodeProps) {
  const isSelected = selectedId === node.id;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: `3px 6px 3px ${8 + depth * 14}px`,
          cursor: "pointer",
          borderRadius: 4,
          background: isSelected ? "var(--accent)" : "transparent",
          color: isSelected ? "#fff" : "var(--text)",
          fontSize: 12,
          userSelect: "none",
        }}
        onClick={() => onSelect(node.id)}
        onMouseEnter={(e) => {
          if (!isSelected)
            e.currentTarget.style.background = "rgba(255,255,255,0.06)";
        }}
        onMouseLeave={(e) => {
          if (!isSelected) e.currentTarget.style.background = "transparent";
        }}
      >
        {node.icon && (
          <span style={{ fontSize: 11, lineHeight: 1 }}>{node.icon}</span>
        )}
        <span
          style={{
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {node.name}
        </span>
        {node.unreadCount > 0 && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              background: isSelected
                ? "rgba(255,255,255,0.3)"
                : "var(--accent)",
              color: isSelected ? "#fff" : "#fff",
              borderRadius: 8,
              padding: "1px 5px",
              minWidth: 16,
              textAlign: "center",
            }}
          >
            {node.unreadCount}
          </span>
        )}
        {node.unreadCount === 0 && node.emailCount > 0 && (
          <span
            style={{
              fontSize: 10,
              color: isSelected ? "rgba(255,255,255,0.7)" : "var(--text-dim)",
            }}
          >
            {node.emailCount}
          </span>
        )}
      </div>
      {node.children.map((child) => (
        <FolderNode
          key={child.id}
          node={child}
          depth={depth + 1}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

interface FolderTreeProps {
  roots: FolderTreeNode[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export function FolderTree({ roots, selectedId, onSelect }: FolderTreeProps) {
  if (roots.length === 0) {
    return (
      <div
        style={{ fontSize: 11, color: "var(--text-dim)", padding: "8px 6px" }}
      >
        No folders yet
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {roots.map((node) => (
        <FolderNode
          key={node.id}
          node={node}
          depth={0}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
