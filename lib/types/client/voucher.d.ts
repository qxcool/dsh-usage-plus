/**
 * The Whale-yuan voucher (鲸元券): the DeepSeek official family's retained
 * ledger totals stamped onto the banknote artwork as a denomination, ready
 * to save or share. The canvas copy is deliberately locale-neutral (digits,
 * latin captions, ISO dates) so the exported image needs no dictionary;
 * everything user-facing around it lives in the section's locales. The pure
 * helpers are unit-tested; the draw itself degrades to a thrown error the
 * section renders as its failure line.
 * @module @linxin666/dsh-usage/client/voucher
 */
import type { UsageWindowSummary } from '../core/types.ts';
/** The facts stamped onto one voucher. */
export interface VoucherData {
    /** DeepSeek official family total tokens over the retained window. */
    tokens: number;
    /** Provider calls that reported usage. */
    calls: number;
    /** Fold-time spend estimate in CNY (the only priced family). */
    cost: number;
    /** Retained window bounds (local date keys, inclusive). */
    from: string;
    to: string;
}
/** Anti-inflation exchange rate: 1000 tokens mint one whale yuan. */
export declare const TOKENS_PER_WHALE_YUAN = 1000;
/** The note's face value in whale yuan; the smallest denomination is 1. */
export declare function faceValue(tokens: number): number;
/** Local calendar day (`YYYY-MM-DD`) for an epoch ms timestamp. */
export declare function formatDay(ms: number): string;
/**
 * Sum the DeepSeek official family rows out of a usage window (both the
 * `deepseek` catalog alias and the live `deepseek-official` route fold into
 * one voucher). Undefined when the window is absent (older host) or the
 * family has no usage — a zero-token note mints nothing.
 */
export declare function deepseekVoucherData(window: UsageWindowSummary | undefined): VoucherData | undefined;
/** Banknote denomination: full digits with thousands separators. */
export declare function formatDenomination(value: number): string;
/** Deterministic serial number flavor: the face value mod 1e9, zero-padded. */
export declare function voucherSerial(face: number): string;
/** The decoded note artwork plus its intrinsic size. */
export interface VoucherArt {
    image: CanvasImageSource;
    width: number;
    height: number;
}
/** Decode the note artwork once per page; a failed decode retries next call. */
export declare function loadVoucherArt(): Promise<VoucherArt>;
/**
 * Stamp the denomination block onto a canvas sized to the artwork: the
 * minted whale yuan as the face value under the note title, a small
 * `whale yuan` caption, and a seal-red serial line with the minting
 * window. All geometry is relative to the artwork size so a regenerated
 * asset reflows.
 */
export declare function drawVoucher(canvas: HTMLCanvasElement, art: VoucherArt, data: VoucherData): void;
//# sourceMappingURL=voucher.d.ts.map