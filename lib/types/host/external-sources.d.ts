import type { ProviderSnapshotState } from '../core/types.ts';
export interface CpamcOptions {
    enabled: boolean;
    baseURL: string;
    managementKey?: string;
    /** Comma-separated extra hosts (e.g. `api.example.com,cli.example.org`) allowed as management origins in addition to loopback. */
    allowedHosts?: string;
}
export interface VolcanoOptions {
    enabled: boolean;
    accessKeyId?: string;
    secretAccessKey?: string;
}
/** Query supported accounts through CPAMC's fixed, read-only management routes. */
export declare function probeCpamc(options: CpamcOptions): Promise<ProviderSnapshotState[]>;
/** Query Volcano Ark's official control-plane Plan endpoint using AK/SK HMAC. */
export declare function probeVolcano(options: VolcanoOptions): Promise<ProviderSnapshotState[]>;
//# sourceMappingURL=external-sources.d.ts.map