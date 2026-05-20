import { dimText } from "./styles";

export function NotConnected() {
  return (
    <div
      style={{ padding: "12px 4px", lineHeight: 1.6, ...dimText, fontSize: 12 }}
    >
      <p style={{ marginBottom: 8, color: "var(--text)", fontWeight: 500 }}>
        Google not connected
      </p>
      <p style={{ margin: 0 }}>
        Open <strong>App Settings</strong> (gear icon) and connect your Google
        account to use this widget.
      </p>
    </div>
  );
}
