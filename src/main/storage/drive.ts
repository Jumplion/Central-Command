import { net } from "electron";
import type { OAuthManager } from "../oauth";
import { SHARED_GOOGLE_WIDGET_ID } from "@shared/google";

const DRIVE_SYNC_SERVICE = "drive-sync" as const;
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const BOUNDARY = "cc_drive_sync_boundary";

export class DriveError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "DriveError";
  }
}

export interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
}

export class DriveSync {
  constructor(private oauth: OAuthManager) {}

  async isConnected(): Promise<boolean> {
    return this.oauth.isConnected(SHARED_GOOGLE_WIDGET_ID, DRIVE_SYNC_SERVICE);
  }

  async listFiles(): Promise<DriveFile[]> {
    const token = await this.getToken();
    const url =
      `${DRIVE_API}/files` +
      `?spaces=appDataFolder` +
      `&q='appDataFolder'+in+parents` +
      `&fields=files(id,name,modifiedTime)` +
      `&pageSize=100`;
    const resp = await net.fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) throw new DriveError(`listFiles failed`, resp.status);
    const data = (await resp.json()) as { files: DriveFile[] };
    return data.files ?? [];
  }

  async downloadFile(fileId: string): Promise<string> {
    const token = await this.getToken();
    const resp = await net.fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) throw new DriveError(`downloadFile failed`, resp.status);
    return resp.text();
  }

  async createFile(name: string, content: string): Promise<string> {
    const token = await this.getToken();
    const metadata = JSON.stringify({ name, parents: ["appDataFolder"] });
    const body = [
      `--${BOUNDARY}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      metadata,
      `--${BOUNDARY}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      content,
      `--${BOUNDARY}--`,
    ].join("\r\n");

    const resp = await net.fetch(`${UPLOAD_API}/files?uploadType=multipart`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${BOUNDARY}`,
      },
      body,
    });
    if (!resp.ok) throw new DriveError(`createFile failed`, resp.status);
    const data = (await resp.json()) as { id: string };
    return data.id;
  }

  async updateFile(fileId: string, content: string): Promise<string> {
    const token = await this.getToken();
    const resp = await net.fetch(
      `${UPLOAD_API}/files/${fileId}?uploadType=media&fields=modifiedTime`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: content,
      },
    );
    if (!resp.ok) throw new DriveError(`updateFile failed`, resp.status);
    const data = (await resp.json()) as { modifiedTime: string };
    return data.modifiedTime;
  }

  async upsertFile(
    name: string,
    content: string,
    knownId?: string,
  ): Promise<string> {
    if (knownId) {
      try {
        await this.updateFile(knownId, content);
        return knownId;
      } catch (err) {
        if (err instanceof DriveError && err.status === 404) {
          return this.createFile(name, content);
        }
        throw err;
      }
    }
    return this.createFile(name, content);
  }

  private async getToken(): Promise<string> {
    const token = await this.oauth.getToken(
      SHARED_GOOGLE_WIDGET_ID,
      DRIVE_SYNC_SERVICE,
    );
    if (!token) throw new DriveError("Drive sync: not authenticated", 401);
    return token;
  }
}
