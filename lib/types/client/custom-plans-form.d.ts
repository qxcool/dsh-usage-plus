/**
 * Form ↔ JSON bridge for the custom-plan editor.
 *
 * The persisted value stays the JSON array the Host parses, so the form and the
 * raw editor are two views of the same setting. A form row keeps the original
 * object and only patches the fields the form owns, so unknown keys an advanced
 * user typed into the JSON are preserved on round-trip.
 * @module dsh-usage-plus/client/custom-plans-form
 */
/** Fields the form edits; everything else in the object is preserved verbatim. */
export interface CustomPlanFormRow {
    /** Original object, kept so unedited keys survive the round trip. */
    raw: Record<string, unknown>;
    id: string;
    name: string;
    url: string;
    /** Comma-separated hostnames for the wire format. */
    allowedHosts: string;
    tokenEnv: string;
    /** `name: value` lines; a header value may be a `${env:NAME}` reference. */
    headersText: string;
}
/** Why the JSON text could not be turned into form rows. */
export type CustomPlanFormParseError = 'invalid-json' | 'not-objects';
/** Rows plus an optional parse error for the current JSON text. */
export interface CustomPlanFormParseResult {
    rows: CustomPlanFormRow[];
    error?: CustomPlanFormParseError;
}
/**
 * Parse the editor's JSON text into rows. An empty document is a valid empty
 * array; anything else must be an array of objects.
 */
export declare function parseCustomPlanRows(text: string): CustomPlanFormParseResult;
/** Serialize rows back into the persisted JSON document (2-space indented). */
export declare function serializeCustomPlanRows(rows: readonly CustomPlanFormRow[]): string;
/** Duplicate ids present in the rows (empty ids excluded). */
export declare function duplicatePlanIds(rows: readonly CustomPlanFormRow[]): string[];
//# sourceMappingURL=custom-plans-form.d.ts.map