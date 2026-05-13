import http from 'node:http';
import crypto from 'node:crypto';
import { BrowserWindow } from 'electron';
import { IPC } from '@shared/ipc';
import type { Storage } from './storage';
import type { SecretsStore } from './secrets';

const WIDGET_ID          = 'job-tracker';
const AUDITION_WIDGET_ID = 'audition-aggregator';
const SECRETS_ID = 'job-capture';
const TOKEN_KEY  = 'token';
const DEFAULT_PORT = 47293;

/**
 * Ensure the job-tracker applications table exists before the widget is
 * ever opened. Mirrors the DDL in src/widgets/job-tracker/components.tsx.
 */
const ENSURE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS applications (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    company      TEXT    NOT NULL,
    role         TEXT    NOT NULL,
    status       TEXT    NOT NULL DEFAULT 'Applied',
    applied_at   TEXT    NOT NULL,
    source       TEXT    NOT NULL DEFAULT '',
    link         TEXT    NOT NULL DEFAULT '',
    notes        TEXT    NOT NULL DEFAULT '',
    req_number   TEXT    NOT NULL DEFAULT '',
    last_updated INTEGER NOT NULL
  );
`;

const ENSURE_COLUMN_SQL =
  "ALTER TABLE applications ADD COLUMN req_number TEXT NOT NULL DEFAULT ''";

const INSERT_SQL =
  'INSERT INTO applications (company,role,status,applied_at,source,link,notes,req_number,last_updated) ' +
  'VALUES (?,?,?,?,?,?,?,?,?)';

/**
 * Ensure the audition-aggregator auditions table exists.
 * Mirrors the DDL in src/widgets/audition-aggregator/index.tsx.
 */
const ENSURE_AUDITION_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS auditions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    project_title       TEXT    NOT NULL,
    role                TEXT    NOT NULL DEFAULT '',
    project_type        TEXT    NOT NULL DEFAULT 'Film',
    status              TEXT    NOT NULL DEFAULT 'Interested',
    casting_studio      TEXT    NOT NULL DEFAULT '',
    location            TEXT    NOT NULL DEFAULT '',
    pay_rate            TEXT    NOT NULL DEFAULT '',
    submitted_at        TEXT    NOT NULL,
    submission_deadline TEXT    NOT NULL DEFAULT '',
    shoot_date          TEXT    NOT NULL DEFAULT '',
    link                TEXT    NOT NULL DEFAULT '',
    notes               TEXT    NOT NULL DEFAULT '',
    last_updated        INTEGER NOT NULL
  );
`;

const INSERT_AUDITION_SQL =
  'INSERT INTO auditions ' +
  '(project_title,role,project_type,status,casting_studio,location,pay_rate,' +
  'submitted_at,submission_deadline,shoot_date,link,notes,last_updated) ' +
  'VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)';

const VALID_STATUSES = new Set(['Applied', 'Phone', 'Onsite', 'Offer', 'Rejected', 'Ghosted']);
const VALID_AUDITION_STATUSES = new Set(['Interested', 'Submitted', 'Callback', 'Booked', 'Released', 'Passed']);
const VALID_PROJECT_TYPES = new Set(['Film', 'TV', 'Commercial', 'Theater', 'Voiceover', 'Student/Indie']);

export class JobCaptureServer {
  private server: http.Server | null = null;
  private _token  = '';
  private _port   = DEFAULT_PORT;

  constructor(
    private readonly storage: Storage,
    private readonly secrets: SecretsStore,
  ) {}

  // ── Token management ────────────────────────────────────────────────────────

  private async ensureToken(): Promise<string> {
    let token = await this.secrets.get(SECRETS_ID, TOKEN_KEY);
    if (!token) {
      token = crypto.randomBytes(32).toString('hex');
      await this.secrets.set(SECRETS_ID, TOKEN_KEY, token);
    }
    return token;
  }

  async regenerateToken(): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    await this.secrets.set(SECRETS_ID, TOKEN_KEY, token);
    this._token = token;
    return token;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  async start(port = DEFAULT_PORT): Promise<void> {
    this._port  = port;
    this._token = await this.ensureToken();

    // Ensure target tables exist before any extension data arrives
    try {
      this.storage.sqlite.exec(WIDGET_ID, ENSURE_TABLE_SQL);
    } catch { /* ignore */ }
    try {
      this.storage.sqlite.run(WIDGET_ID, ENSURE_COLUMN_SQL, []);
    } catch { /* column already exists */ }
    try {
      this.storage.sqlite.exec(AUDITION_WIDGET_ID, ENSURE_AUDITION_TABLE_SQL);
    } catch { /* ignore */ }

    this.server = http.createServer((req, res) => this.handleRequest(req, res));
    this.server.listen(port, '127.0.0.1');
  }

  stop(): void {
    this.server?.close();
    this.server = null;
  }

  // ── Status accessors ────────────────────────────────────────────────────────

  get isRunning(): boolean { return this.server !== null; }
  get currentPort(): number { return this._port; }
  get currentToken(): string { return this._token; }

  // ── Request routing ─────────────────────────────────────────────────────────

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Only accept connections from localhost
    const remote = req.socket.remoteAddress ?? '';
    if (remote !== '127.0.0.1' && remote !== '::1' && remote !== '::ffff:127.0.0.1') {
      res.writeHead(403).end();
      return;
    }

    // CORS — allow extension popups (origin is "null" for extension pages)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Job-Capture');

    if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }

    if (req.method === 'GET' && req.url === '/api/ping') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, version: '0.1.0' }));
      return;
    }

    if (req.method === 'POST' && req.url === '/api/add-job') {
      this.handleAddJob(req, res);
      return;
    }

    if (req.method === 'POST' && req.url === '/api/add-audition') {
      this.handleAddAudition(req, res);
      return;
    }

    res.writeHead(404).end();
  }

  private handleAddJob(req: http.IncomingMessage, res: http.ServerResponse): void {
    const auth = req.headers['authorization'] ?? '';
    if (auth !== `Bearer ${this._token}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const job = JSON.parse(body) as Record<string, unknown>;

        const company    = String(job['company']    ?? '').slice(0, 500);
        const role       = String(job['role']       ?? '').slice(0, 500);
        const link       = String(job['link']       ?? '').slice(0, 2000);
        const notes      = String(job['notes']      ?? '').slice(0, 5000);
        const source     = String(job['source']     ?? 'Browser Extension').slice(0, 200);
        const rawStatus  = String(job['status']     ?? 'Applied');
        const applied_at = String(job['applied_at'] ?? new Date().toISOString().slice(0, 10)).slice(0, 20);

        const status = VALID_STATUSES.has(rawStatus) ? rawStatus : 'Applied';

        this.storage.sqlite.run(WIDGET_ID, INSERT_SQL, [
          company, role, status, applied_at, source, link, notes, '', Date.now(),
        ]);

        const captured = { company, role, link, notes, source, status, applied_at };
        const wins = BrowserWindow.getAllWindows();
        if (wins[0] && !wins[0].isDestroyed()) {
          wins[0].webContents.send(IPC.JOB_CAPTURE_JOB_ADDED, captured);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Bad request' }));
      }
    });
  }

  private handleAddAudition(req: http.IncomingMessage, res: http.ServerResponse): void {
    const auth = req.headers['authorization'] ?? '';
    if (auth !== `Bearer ${this._token}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const a = JSON.parse(body) as Record<string, unknown>;

        const project_title       = String(a['project_title']       ?? '').slice(0, 500);
        const role                = String(a['role']                ?? '').slice(0, 500);
        const casting_studio      = String(a['casting_studio']      ?? '').slice(0, 500);
        const location            = String(a['location']            ?? '').slice(0, 500);
        const pay_rate            = String(a['pay_rate']            ?? '').slice(0, 200);
        const submitted_at        = String(a['submitted_at']        ?? new Date().toISOString().slice(0, 10)).slice(0, 20);
        const submission_deadline = String(a['submission_deadline'] ?? '').slice(0, 20);
        const shoot_date          = String(a['shoot_date']          ?? '').slice(0, 20);
        const link                = String(a['link']                ?? '').slice(0, 2000);
        const notes               = String(a['notes']               ?? '').slice(0, 5000);

        const rawType   = String(a['project_type'] ?? 'Film');
        const rawStatus = String(a['status']       ?? 'Interested');
        const project_type = VALID_PROJECT_TYPES.has(rawType)       ? rawType   : 'Film';
        const status       = VALID_AUDITION_STATUSES.has(rawStatus) ? rawStatus : 'Interested';

        if (!project_title) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'project_title is required' }));
          return;
        }

        this.storage.sqlite.run(AUDITION_WIDGET_ID, INSERT_AUDITION_SQL, [
          project_title, role, project_type, status, casting_studio, location, pay_rate,
          submitted_at, submission_deadline, shoot_date, link, notes, Date.now(),
        ]);

        const captured = {
          project_title, role, project_type, status, casting_studio, location,
          pay_rate, submitted_at, submission_deadline, shoot_date, link, notes,
        };
        const wins = BrowserWindow.getAllWindows();
        if (wins[0] && !wins[0].isDestroyed()) {
          wins[0].webContents.send(IPC.JOB_CAPTURE_AUDITION_ADDED, captured);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Bad request' }));
      }
    });
  }
}
