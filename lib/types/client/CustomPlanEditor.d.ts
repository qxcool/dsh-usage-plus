/**
 * Custom-plan editor: a form for the common fields and a raw JSON view for
 * everything else. Both views write the same persisted JSON string, so a user
 * can start in the form and drop into JSON (or the reverse) at any time.
 * @module dsh-usage-plus/client/CustomPlanEditor
 */
import { type ReactNode } from 'react';
/**
 * Custom-plan setting editor. `value` is the JSON text stored in the config;
 * every form edit rewrites it, so no separate persistence path exists.
 */
export declare function CustomPlanEditor(props: {
    value: string;
    disabled: boolean;
    onChange: (next: string) => void;
}): ReactNode;
//# sourceMappingURL=CustomPlanEditor.d.ts.map