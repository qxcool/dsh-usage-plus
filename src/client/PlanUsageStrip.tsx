import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { UsageStoreInstance } from './usage-store.ts'
import type { PlanWindowView } from '../core/types.ts'
import { currentPlanProvider, orderedPlanWindows, planSourceLabelKey, type PlanRouteOverride } from '../core/plan-match.ts'
import { sessionRouteFrom, type SessionSelectionView } from './session-route.ts'
import { formatPlanReset, t } from './locales.ts'
import styles from './usage.module.css'

/** Ship one diagnostic line to the host when the state key changes. */
let lastDiagKey = ''
let lastDiagAt = 0
export function reportDiag(kind: string, key: string): void {
  const now = Date.now()
  const full = `${kind}:${key}`
  if (kind === 'strip-state' && full === lastDiagKey && now - lastDiagAt < 30_000) return
  if (kind === 'strip-state') {
    lastDiagKey = full
    lastDiagAt = now
  }
  try {
    void fetch('/api/dsh-usage-plus/client-diag', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind, key }),
    }).catch(() => {})
  } catch {
    // Host diag is best-effort.
  }
}

/** Keyed projection hook from session-scope standard kit (`ui-session`). */
export type UseProjection = (key: string) => unknown

export interface PlanUsageStripProps {
  store: UsageStoreInstance
  /**
   * Acquire the shared strip poller: returns a release function. All strip
   * instances share one interval + one set of document listeners in the
   * client entry (startStripPolling), so N open conversations never fan out
   * into N independent /overview pollers.
   */
  startStripPolling?: () => () => void
  /**
   * Session-scope keyed projection hook. Returns the live projection value
   * (already subscribed). Official path for per-conversation modelSelection —
   * `useSession()` only yields the SessionSnapshot, which has no projections.
   */
  useProjection?: UseProjection
  sessionId?: string
}

export { currentPlanProvider }

/** Match official ContextMeter ring geometry (14px viewBox, r=5.5). */
const RADIUS = 5.5
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function percentText(value: number): string {
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)}%`
}

function windowShort(window: PlanWindowView): string {
  if (window.key === '5h') return t('usage.plan.windows.5h.short')
  if (window.key === 'week') return t('usage.plan.windows.week.short')
  if (window.key === 'month') return t('usage.plan.windows.month.short')
  return window.name ?? window.key
}

function windowLabel(window: PlanWindowView): string {
  return window.name ?? t(`usage.plan.windows.${window.key}`)
}

function toneClass(percent: number): string {
  if (percent >= 90) return styles.quotaMeterDanger
  if (percent >= 70) return styles.quotaMeterWarn
  return ''
}

function barTone(percent: number): string {
  if (percent >= 90) return styles.barLow
  if (percent >= 70) return styles.barWarn
  return styles.barFill
}

function primaryWindow(windows: PlanWindowView[]): PlanWindowView {
  const fiveHour = windows.find((window) => window.key === '5h')
  if (fiveHour !== undefined) return fiveHour
  return windows.reduce((worst, window) =>
    (window.percent as number) > (worst.percent as number) ? window : worst)
}

function routeOverride(selection: unknown): PlanRouteOverride | undefined {
  const route = sessionRouteFrom(selection)
  if (route === undefined) return undefined
  return { provider: route.provider, ...(route.model !== undefined ? { model: route.model } : {}) }
}

/**
 * Compact plan-quota meter for `conversation.composer.dock`, seated on the
 * bottom strip beside official StatsPills and ContextMeter.
 */
export function PlanUsageStrip(props: PlanUsageStripProps): ReactNode {
  const { store } = props
  const ui = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement | null>(null)

  // Session-scope standard kit always injects useProjection; tests pass a stub.
  // Calling through a stable local keeps the hook name recognizable to the
  // renderer and avoids reading SessionSnapshot (which has no projections).
  const useProjection = props.useProjection
  const selection = (useProjection !== undefined
    ? useProjection('modelSelection')
    : undefined) as SessionSelectionView | undefined
  const override = routeOverride(selection)

  // Shared poller lifecycle: the client entry multiplexes one interval and
  // one document-listener set across every live strip instance.
  useEffect(() => {
    if (props.startStripPolling === undefined) return
    return props.startStripPolling()
  }, [props.startStripPolling])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent): void => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target) === true) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const snapshot = ui.snapshot
  // Per-session selection wins. No silent fall-through to a different
  // conversation's / global plan when this session already has a route.
  // Virgin sessions (empty projection) still follow snapshot.current so the
  // strip matches the model selector's catalog default until the first pick.
  const provider = override !== undefined
    ? currentPlanProvider(snapshot, override)
    : currentPlanProvider(snapshot)
  const windows = provider === undefined || provider.plan === undefined ? [] : orderedPlanWindows(provider.plan)
    .filter((window) => typeof window.percent === 'number')

  const overrideLabel = override === undefined ? 'none' : `${override.provider}:${override.model ?? ''}`
  reportDiag(
    'strip-state',
    `snapshot=${snapshot === null ? 'null' : 'ok'} provider=${provider === undefined ? 'none' : provider.provider} windows=${windows.length} override=${overrideLabel} sessionId=${props.sessionId ?? '∅'}`,
  )

  if (snapshot === null) {
    return <span data-usage-strip-state="snapshot-null" style={{ display: 'none' }} />
  }
  if (provider === undefined || windows.length === 0) {
    const emptyReason = provider === undefined
      ? `no-provider-match:${overrideLabel}`
      : `provider=${provider.provider}`
    return <span data-usage-strip-state={`empty:${emptyReason}`} style={{ display: 'none' }} />
  }

  const primary = primaryWindow(windows)
  const percent = primary.percent as number
  const reading = percentText(percent)
  const level = toneClass(percent)
  const model = override?.model ?? snapshot.current.model
  const source = t(planSourceLabelKey(provider))
  const identity = model === undefined || model === ''
    ? provider.displayName
    : `${provider.displayName} · ${model}`

  return (
    <span ref={rootRef} className={`${styles.quotaMeter} ${level}`} data-dsh-plugin="usage-plus" data-dsh-part="quota-meter" data-usage-plus-rev="4">
      <button
        type="button"
        className={styles.quotaMeterTrigger}
        aria-label={`${identity} · ${source} · ${windowLabel(primary)} ${reading}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={`${identity}\n${source} · ${windowShort(primary)} ${reading}\n${windows.map((window) => `${windowLabel(window)} ${percentText(window.percent as number)}`).join(' · ')}`}
        onClick={() => {
          setOpen((value) => !value)
        }}
      >
        <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
          <circle className={styles.quotaMeterTrack} cx="7" cy="7" r={RADIUS} />
          <circle
            className={styles.quotaMeterFill}
            cx="7"
            cy="7"
            r={RADIUS}
            strokeDasharray={`${CIRCUMFERENCE * Math.min(100, Math.max(0, percent)) / 100} ${CIRCUMFERENCE}`}
            transform="rotate(-90 7 7)"
          />
        </svg>
        <span className={styles.quotaMeterReading}>{reading}</span>
      </button>
      {open && (
        <div className={styles.quotaMeterPanel} role="dialog" aria-label={identity}>
          <div className={styles.quotaMeterHeader}>
            <span className={styles.quotaMeterIdentity}>{identity}</span>
            <span className={styles.sourceChip}>{source}</span>
          </div>
          <div className={styles.quotaMeterBars}>
            {windows.map((window) => {
              const value = window.percent as number
              return (
                <div key={window.key} className={`${styles.quotaMeterBarRow} ${toneClass(value)}`}>
                  <div className={styles.quotaMeterBarHead}>
                    <span>
                      {windowLabel(window)}
                      <span className={styles.quotaMeterKey}>{windowShort(window)}</span>
                    </span>
                    <span className={styles.quotaMeterBarPct}>{percentText(value)}</span>
                  </div>
                  <span className={styles.bar}>
                    <span className={barTone(value)} style={{ width: `${Math.min(100, Math.max(0, value))}%`, display: 'block' }} />
                  </span>
                  <span className={styles.quotaMeterReset}>{formatPlanReset(window.resetsAt)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </span>
  )
}
