/**
 * Custom-plan editor: a form for the common fields and a raw JSON view for
 * everything else. Both views write the same persisted JSON string, so a user
 * can start in the form and drop into JSON (or the reverse) at any time.
 * @module dsh-usage-plus/client/CustomPlanEditor
 */
import { useEffect, useState, type ReactNode } from 'react'
import { t } from './locales.ts'
import {
  duplicatePlanIds,
  parseCustomPlanRows,
  serializeCustomPlanRows,
  type CustomPlanFormRow,
} from './custom-plans-form.ts'
import styles from './usage.module.css'

/** Edit mode for the custom-plan setting. */
type EditorMode = 'form' | 'json'

/** One labelled field row in the form. */
function Field(props: {
  label: string
  value: string
  placeholder?: string
  disabled: boolean
  mono?: boolean
  onChange: (value: string) => void
}): ReactNode {
  return (
    <label className={styles.planField}>
      <span className={styles.planFieldLabel}>{props.label}</span>
      <input
        type="text"
        className={props.mono === true ? styles.mono : undefined}
        value={props.value}
        placeholder={props.placeholder}
        disabled={props.disabled}
        spellCheck={false}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </label>
  )
}

/** The JSON text view, with pretty-printing on blur and no form-key capture. */
function JsonEditor(props: {
  value: string
  disabled: boolean
  onChange: (next: string) => void
}): ReactNode {
  return (
    <textarea
      data-dsh-part="custom-plan-json"
      className={styles.customPlansInput}
      value={props.value}
      disabled={props.disabled}
      spellCheck={false}
      rows={Math.min(16, Math.max(4, props.value.split('\n').length + 1))}
      placeholder={t('usage.config.customPlans.placeholder')}
      onChange={(event) => props.onChange(event.target.value)}
      onBlur={() => {
        // Pretty-print only a valid document, and only on blur so typing is
        // never rewritten under the cursor.
        const text = props.value.trim()
        if (text === '') return
        try {
          const formatted = JSON.stringify(JSON.parse(text), null, 2)
          if (formatted !== text) props.onChange(formatted)
        } catch {
          // Invalid JSON stays exactly as the user typed it.
        }
      }}
      onKeyDown={(event) => {
        // A JSON editor must keep Enter/Tab local instead of submitting or
        // moving focus away from the field.
        if (event.key === 'Enter' || event.key === 'Tab') event.stopPropagation()
      }}
    />
  )
}

/**
 * Custom-plan setting editor. `value` is the JSON text stored in the config;
 * every form edit rewrites it, so no separate persistence path exists.
 */
export function CustomPlanEditor(props: {
  value: string
  disabled: boolean
  onChange: (next: string) => void
}): ReactNode {
  const { value, disabled, onChange } = props
  const parsed = parseCustomPlanRows(value)
  const [mode, setMode] = useState<EditorMode>(() => (parsed.error === undefined ? 'form' : 'json'))
  // Keep the view stable while the user edits JSON that is momentarily invalid:
  // switching modes on every keystroke would make the editor unusable.
  useEffect(() => {
    if (parsed.error !== undefined && mode === 'form') setMode('json')
  }, [parsed.error, mode])

  const rows = parsed.rows
  const duplicates = duplicatePlanIds(rows)

  const writeRows = (next: readonly CustomPlanFormRow[]): void => {
    onChange(serializeCustomPlanRows(next))
  }
  const updateRow = (index: number, patch: Partial<CustomPlanFormRow>): void => {
    writeRows(rows.map((row, position) => (position === index ? { ...row, ...patch } : row)))
  }
  const removeRow = (index: number): void => {
    writeRows(rows.filter((_, position) => position !== index))
  }
  const addRow = (): void => {
    writeRows([...rows, { raw: {}, id: '', name: '', url: '', allowedHosts: '', tokenEnv: '', headersText: '' }])
  }

  return (
    <div className={styles.customPlanEditor} data-dsh-part="custom-plan-editor">
      <div className={styles.planEditorHead}>
        <span className={styles.settingLabel}>{t('usage.config.customPlans')}</span>
        <div className={styles.rangeSeg} role="group" aria-label={t('usage.config.customPlans.mode')}>
          {(['form', 'json'] as const).map((next) => (
            <button
              key={next}
              type="button"
              aria-pressed={mode === next}
              className={mode === next ? `${styles.rangeBtn} ${styles.rangeBtnActive}` : styles.rangeBtn}
              data-dsh-part={`custom-plan-mode-${next}`}
              disabled={disabled}
              onClick={() => setMode(next)}
            >
              {t(`usage.config.customPlans.mode.${next}`)}
            </button>
          ))}
        </div>
      </div>

      {mode === 'json' ? (
        <>
          <JsonEditor value={value} disabled={disabled} onChange={onChange} />
          <span className={styles.settingHint}>{t('usage.config.customPlansHint')}</span>
        </>
      ) : parsed.error !== undefined ? (
        <div className={styles.settingWarn} data-dsh-part="custom-plan-form-error">
          {t(`usage.config.customPlans.parseError.${parsed.error}`)}
        </div>
      ) : (
        <>
          {rows.length === 0 && (
            <span className={styles.settingHint}>{t('usage.config.customPlans.empty')}</span>
          )}
          <div className={styles.customPlanForm} data-dsh-part="custom-plan-form">
            {rows.map((row, index) => (
              <div className={styles.customPlanFormCard} key={`${row.id}-${index}`} data-dsh-part="custom-plan-entry">
                <div className={styles.customPlanFormHead}>
                  <span className={styles.customPlanName}>
                    {row.name.trim() !== '' ? row.name : t('usage.config.customPlans.entryN', { n: index + 1 })}
                  </span>
                  <button
                    type="button"
                    className={styles.refreshBtn}
                    disabled={disabled}
                    onClick={() => removeRow(index)}
                  >
                    {t('usage.config.customPlans.remove')}
                  </button>
                </div>
                <div className={styles.planFieldGrid}>
                  <Field
                    label={t('usage.config.customPlans.id')}
                    value={row.id}
                    placeholder="my-plan"
                    disabled={disabled}
                    mono
                    onChange={(next) => updateRow(index, { id: next })}
                  />
                  <Field
                    label={t('usage.config.customPlans.name')}
                    value={row.name}
                    placeholder={t('usage.config.customPlans.namePlaceholder')}
                    disabled={disabled}
                    onChange={(next) => updateRow(index, { name: next })}
                  />
                  <Field
                    label={t('usage.config.customPlans.url')}
                    value={row.url}
                    placeholder="https://api.example.com/usage"
                    disabled={disabled}
                    mono
                    onChange={(next) => updateRow(index, { url: next })}
                  />
                  <Field
                    label={t('usage.config.customPlans.allowedHosts')}
                    value={row.allowedHosts}
                    placeholder="api.example.com"
                    disabled={disabled}
                    mono
                    onChange={(next) => updateRow(index, { allowedHosts: next })}
                  />
                  <Field
                    label={t('usage.config.customPlans.tokenEnv')}
                    value={row.tokenEnv}
                    placeholder="MY_PLAN_TOKEN"
                    disabled={disabled}
                    mono
                    onChange={(next) => updateRow(index, { tokenEnv: next })}
                  />
                </div>
                <label className={styles.planField}>
                  <span className={styles.planFieldLabel}>{t('usage.config.customPlans.headers')}</span>
                  <textarea
                    className={styles.planHeadersInput}
                    value={row.headersText}
                    placeholder="x-tenant: ${env:MY_TENANT}"
                    disabled={disabled}
                    spellCheck={false}
                    rows={Math.min(6, Math.max(2, row.headersText.split('\n').length))}
                    onChange={(event) => updateRow(index, { headersText: event.target.value })}
                  />
                </label>
                {row.id.trim() === '' && (
                  <span className={styles.settingWarn}>{t('usage.config.customPlans.missingId')}</span>
                )}
                {duplicates.includes(row.id.trim()) && row.id.trim() !== '' && (
                  <span className={styles.settingWarn}>{t('usage.config.customPlans.duplicateId', { id: row.id.trim() })}</span>
                )}
              </div>
            ))}
          </div>
          <div className={styles.planFormActions}>
            <button type="button" className={styles.refreshBtn} disabled={disabled} onClick={addRow} data-dsh-part="custom-plan-add">
              {t('usage.config.customPlans.add')}
            </button>
          </div>
          <span className={styles.settingHint}>{t('usage.config.customPlansFormHint')}</span>
        </>
      )}
    </div>
  )
}
