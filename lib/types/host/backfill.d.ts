/**
 * Historical session backfill: rebuild the usage ledger from prior DSH
 * sessions when the plugin starts with an empty ledger (fresh install, data-dir
 * loss, or an upgrade from a version that predated the ledger). Reads the
 * optional context-wide `ctx.sessionQuery` service — never the persistence
 * files directly — and folds `assistant/message` usage exactly like the live
 * `session/event` listener: the provider/model come from the preceding
 * `request/header` / `request/context` events, and the DeepSeek spend estimate
 * is stamped at the event's own timestamp.
 *
 * The pass is bounded (session and event caps, yields between sessions) and
 * never throws; the caller merges the returned temporary ledger, flushes, and
 * records the completion state itself.
 * @module dsh-usage-plus/host/backfill
 */
import type { UsageLedgerDocument } from '../core/types.ts';
/** File (inside the plugin data dir) recording a completed/declined backfill. */
export declare const BACKFILL_STATE_FILE = "backfill.json";
/** Hard cap on sessions inspected in one pass (newest first). */
export declare const MAX_BACKFILL_SESSIONS = 500;
/** Hard cap on raw events inspected in one pass. */
export declare const MAX_BACKFILL_EVENTS = 100000;
/** Yield to the event loop after this many session reads. */
export declare const BACKFILL_YIELD_EVERY_SESSIONS = 10;
/** Version of the `backfill.json` state document. */
export declare const BACKFILL_STATE_VERSION = 1;
/**
 * The minimal `ctx.sessionQuery` surface backfill needs. Declared locally so
 * the Host half does not depend on the session-query package types; the
 * service is optional and may be absent from a composition.
 */
export interface SessionQueryLike {
    /** Every logical session, newest-first (created time). */
    listSessions(): Promise<unknown>;
    /** The complete raw event log of one session. */
    readSession(sessionId: string): Promise<unknown>;
}
/** Completion state persisted as `<persistDir>/backfill.json`. */
export interface BackfillState {
    version: typeof BACKFILL_STATE_VERSION;
    /** Epoch ms the pass finished (or was declined). */
    completedAt: number;
    /** Epoch ms cutoff: only events strictly older than this were folded. */
    cutoff: number;
    /** Sessions read successfully during the pass. */
    sessions: number;
    /** `assistant/message` events folded into the ledger. */
    events: number;
    /** True when a session/event cap ended the pass early (partial history). */
    truncated?: boolean;
}
/** Options for one backfill collection pass. */
export interface BackfillOptions {
    /** Epoch ms captured before the pass; events at/after it belong to live folding. */
    startedAt: number;
    /** Ledger retention in local days; older events are ignored. */
    retainDays: number;
    /** "Now" for the retention cutoff (tests pass a fixed instant). */
    nowMs?: number;
    maxSessions?: number;
    maxEvents?: number;
    yieldEvery?: number;
    /** Return true when the owning service is disposed; aborts the pass. */
    shouldAbort?: () => boolean;
}
/** Result of one backfill collection pass. */
export interface BackfillResult {
    /** False when the pass aborted or the session list could not be read. */
    ok: boolean;
    /** Temporary ledger containing only the folded historical usage. */
    ledger: UsageLedgerDocument;
    /** Sessions read successfully. */
    sessions: number;
    /** `assistant/message` events folded into `ledger`. */
    events: number;
    /** Raw events inspected (diagnostic; capped separately from `events`). */
    processed: number;
    /** Local-date key `YYYY-MM-DD`; events older than it are ignored. */
    cutoffKey: string;
    /** True when a session/event cap ended the pass early. */
    truncated: boolean;
}
/** Path of the backfill state file for one plugin data directory. */
export declare function backfillStatePath(persistDir: string): string;
/**
 * Whether a ledger document holds any usage bucket. An empty day map means a
 * fresh install/data loss, which is the only case backfill may run in.
 */
export declare function hasLedgerUsage(document: Readonly<UsageLedgerDocument>): boolean;
/**
 * First local-date key inside the retention window, matching
 * `pruneLedger`'s cutoff: days strictly before it are pruned.
 */
export declare function retentionCutoffKey(nowMs: number, retainDays: number): string;
/** Add every bucket of `source` into `target` in place. */
export declare function mergeLedgerDocuments(target: UsageLedgerDocument, source: Readonly<UsageLedgerDocument>): void;
/**
 * Read prior sessions and fold their historical usage into a temporary ledger.
 * Never throws: a missing/invalid session list yields `ok: false`, per-session
 * read failures are skipped, and all work is bounded by the caps plus a yield
 * between session batches.
 */
export declare function collectBackfill(sessionQuery: SessionQueryLike, options: BackfillOptions): Promise<BackfillResult>;
//# sourceMappingURL=backfill.d.ts.map