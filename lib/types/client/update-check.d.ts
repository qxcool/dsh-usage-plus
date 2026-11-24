/**
 * Client-side plugin update check, following dsh-context's shape: one shared
 * module-level cache (1h for a successful read, 30s between retries), an
 * in-flight de-duplicated fetch of the host's `/api/dsh-usage-plus/version`
 * route, and a bounded retry loop per mount (5 attempts, 30s apart) so a
 * still-starting host converges without polling forever. The hook returns the
 * latest version string only when the host says it is strictly newer than the
 * running build; every other outcome (unknown, failed, up to date) reads as
 * "no chip".
 * @module dsh-usage-plus/client/update-check
 */
/** Wire shape of GET /api/dsh-usage-plus/version → `value`. */
export interface UsageVersionValue {
    /** True exactly when a registry answered with a usable version. */
    ready: boolean;
    /** True after a check cycle where every registry failed. */
    failed: boolean;
    /** Epoch ms of the host's last completed check cycle. */
    checkedAt: number;
    /** The running plugin version, when readable. */
    current: string | null;
    /** Strictly-newer verdict; null when either side is unknown. */
    updateAvailable: boolean | null;
    /** Latest published version, present only when known. */
    latest?: string;
}
/** The GitHub Releases page the chip links to. */
export declare const RELEASES_URL = "https://github.com/qxcool/dsh-usage-plus/releases/latest";
/**
 * The latest version string when an update is available, else null. Each
 * mount runs its own bounded retry loop (canceled on unmount), while the
 * module-level cache de-duplicates the underlying fetches. Renders nothing
 * until a check lands, so the header never flickers a chip that cannot be
 * clicked yet.
 */
export declare function useUpdateAvailable(): string | null;
//# sourceMappingURL=update-check.d.ts.map