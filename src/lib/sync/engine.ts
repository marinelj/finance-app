import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

import type { SyncAccount } from './account';
import { SyncError, type SyncClient, type SyncErrorCode } from './client';

/**
 * Automatic sync with the user's Finance server. While signed in, the server holds the data and
 * this device keeps a working copy, so the app still works offline:
 *
 * - After any local change, the device uploads its data, as long as the server hasn't changed
 *   since this device last synced (the server refuses it otherwise).
 * - When the app opens, comes back to the foreground, or a minute passes, the device asks the
 *   server for its revision and downloads the data if another device saved since.
 * - If both changed, sync pauses and the user picks which copy to keep.
 *
 * Whether this device changed is decided by fingerprinting its data, so writes that change
 * nothing (or a download being applied) never count as edits.
 */

export type Snapshot = {
  tables: Record<string, Record<string, unknown>[]>;
  settings: Record<string, unknown>;
};

/** Recomputed by the app on its own (monthly net worth); never worth asking the user about. */
const DERIVED_TABLES = new Set(['net_worth_snapshots']);

export type SyncPhase = 'off' | 'syncing' | 'synced' | 'offline' | 'conflict' | 'error';

export type SyncStatus = {
  phase: SyncPhase;
  lastSyncedAt: string | null;
  error?: SyncErrorCode;
};

export type SyncDeps<P extends Snapshot> = {
  readAccount: () => Promise<SyncAccount | null>;
  saveAccount: (account: SyncAccount) => Promise<void>;
  clearAccount: () => Promise<void>;
  createClient: (serverUrl: string) => SyncClient;
  /** This device's data in the backup format. */
  collect: () => P;
  /** Replaces this device's data with the server's copy. */
  apply: (payload: unknown) => void;
  now?: () => Date;
};

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

function digest(text: string): string {
  return bytesToHex(sha256(utf8ToBytes(text))).slice(0, 32);
}

/**
 * Two fingerprints: "core" covers what the user entered, "full" adds derived tables. Stored as
 * "core:full". Row order doesn't matter.
 */
export function fingerprint(snapshot: Snapshot): string {
  const part = (include: (table: string) => boolean) => {
    const tables = Object.keys(snapshot.tables)
      .filter(include)
      .sort()
      .map((name) => [name, snapshot.tables[name].map(stable).sort()]);
    return digest(stable({ tables, settings: snapshot.settings }));
  };
  return `${part((t) => !DERIVED_TABLES.has(t))}:${part(() => true)}`;
}

/** What changed on this device since `synced`: nothing, only derived tables, or user data. */
export function localChange(current: string, synced: string | null): 'none' | 'derived' | 'data' {
  if (synced === current) return 'none';
  if (!synced) return 'data';
  return synced.split(':')[0] === current.split(':')[0] ? 'derived' : 'data';
}

export function isEmpty(snapshot: Snapshot): boolean {
  return Object.entries(snapshot.tables).every(
    ([name, rows]) => DERIVED_TABLES.has(name) || rows.length === 0
  );
}

export class SyncEngine<P extends Snapshot> {
  private status: SyncStatus = { phase: 'off', lastSyncedAt: null };
  private listeners = new Set<() => void>();
  private running: Promise<void> | null = null;
  private again = false;
  private now: () => Date;

  constructor(private deps: SyncDeps<P>) {
    this.now = deps.now ?? (() => new Date());
  }

  getStatus = (): SyncStatus => this.status;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(next: Partial<SyncStatus>) {
    this.status = { ...this.status, ...next };
    if (next.phase !== 'error') delete this.status.error;
    this.listeners.forEach((listener) => listener());
  }

  /** Loads the status shown before the first sync finishes. */
  async load(): Promise<void> {
    const account = await this.deps.readAccount();
    this.set({ phase: account ? 'synced' : 'off', lastSyncedAt: account?.lastSyncedAt ?? null });
  }

  /**
   * Brings this device and the server in line. `checkServer: false` skips asking the server
   * when this device has no changes (used right after local writes). Calls made while a sync is
   * running are folded into one more pass.
   */
  sync(options: { checkServer?: boolean } = {}): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      try {
        do {
          this.again = false;
          await this.pass(options.checkServer ?? true);
        } while (this.again);
      } finally {
        this.running = null;
      }
    })();
    return this.running;
  }

  /** Settles a conflict: keep this device's data (upload it) or the server's (download it). */
  async resolve(keep: 'device' | 'server'): Promise<void> {
    const account = await this.deps.readAccount();
    if (!account) return;
    const client = this.deps.createClient(account.serverUrl);
    this.set({ phase: 'syncing' });
    try {
      if (keep === 'device') await this.push(account, client, this.deps.collect());
      else await this.pull(account, client);
    } catch (error) {
      await this.fail(error);
    }
  }

  private async pass(checkServer: boolean) {
    const account = await this.deps.readAccount();
    if (!account) {
      this.set({ phase: 'off', lastSyncedAt: null });
      return;
    }
    if (this.status.phase === 'conflict') return;
    if (
      localChange(fingerprint(this.deps.collect()), account.syncedHash) === 'none' &&
      !checkServer
    )
      return;

    const client = this.deps.createClient(account.serverUrl);
    this.set({ phase: 'syncing' });
    try {
      const remote = await client.revision(account.token);
      if ((await this.deps.readAccount())?.token !== account.token) return;
      // The user may have saved while the revision request was in flight.
      const local = this.deps.collect();
      const change = localChange(fingerprint(local), account.syncedHash);
      const serverChanged = remote !== account.revision;

      if (remote === 0) {
        // Nothing on the server yet (new account, or its database was reset): fill it.
        await this.push(account, client, local);
      } else if (account.revision === null) {
        // First sync on this device with a server that has data.
        if (isEmpty(local)) await this.pull(account, client);
        else this.set({ phase: 'conflict' });
      } else if (!serverChanged) {
        if (change === 'none') await this.markSynced(account, account.revision, account.syncedHash);
        else await this.push(account, client, local, account.revision);
      } else if (change === 'data') {
        this.set({ phase: 'conflict' });
      } else {
        // Only the server changed (or just the derived net-worth figures here): take it.
        await this.pull(account, client);
      }
    } catch (error) {
      if (error instanceof SyncError && error.code === 'stale') {
        this.set({ phase: 'conflict' });
        return;
      }
      await this.fail(error);
    }
  }

  private async push(account: SyncAccount, client: SyncClient, local: P, base?: number) {
    const result = await client.upload(account.token, local, base);
    await this.markSynced(account, result.revision, fingerprint(local));
  }

  private async pull(account: SyncAccount, client: SyncClient) {
    const before = fingerprint(this.deps.collect());
    const payload = await client.download(account.token);
    if ((await this.deps.readAccount())?.token !== account.token) return;
    // A network response must never overwrite a user edit made after the request began.
    if (localChange(fingerprint(this.deps.collect()), before) === 'data') {
      this.set({ phase: 'conflict' });
      return;
    }
    this.deps.apply(payload);
    await this.markSynced(account, payload.revision, fingerprint(this.deps.collect()));
  }

  private async markSynced(account: SyncAccount, revision: number, hash: string | null) {
    const lastSyncedAt = this.now().toISOString();
    // Re-read so a sign-out during the request isn't undone.
    const current = await this.deps.readAccount();
    if (!current || current.token !== account.token) return;
    await this.deps.saveAccount({ ...current, revision, syncedHash: hash, lastSyncedAt });
    this.set({ phase: 'synced', lastSyncedAt });
  }

  private async fail(error: unknown) {
    const code = error instanceof SyncError ? error.code : 'server';
    if (code === 'signedOut') {
      await this.deps.clearAccount();
      this.set({ phase: 'off', lastSyncedAt: null });
    } else if (code === 'network') {
      this.set({ phase: 'offline' });
    } else {
      this.set({ phase: 'error', error: code });
    }
  }
}
