import { spawn } from "node:child_process";
import { shell } from "electron";

/** True when running inside a Windows Subsystem for Linux environment. */
export const IS_WSL = !!(
  process.env["WSL_DISTRO_NAME"] ?? process.env["WSL_INTEROP"]
);

/**
 * Open a URL in the system default browser, handling all runtime environments:
 * - WSL: `shell.openExternal` has no Windows browser context, so the URL is
 *   passed to PowerShell via `-EncodedCommand` (Base64 UTF-16LE). The payload
 *   is injection-safe because the encoding is opaque to the shell.
 * - Windows / macOS / Linux: delegate to Electron's `shell.openExternal`.
 */
export function openExternal(url: string): Promise<void> {
  if (IS_WSL) {
    const psCmd = `Start-Process -FilePath '${url.replace(/'/g, "''")}'`;
    const encodedCmd = Buffer.from(psCmd, "utf16le").toString("base64");
    return new Promise<void>((resolve) => {
      spawn(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-EncodedCommand", encodedCmd],
        {
          stdio: "ignore",
        },
      ).on("close", () => resolve());
    });
  }
  return shell.openExternal(url);
}
