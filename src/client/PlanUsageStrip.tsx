import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { UsageStoreInstance } from './usage-store.ts'
import type { PlanWindowView } from '../core/types.ts'
import { currentPlanProvider, orderedPlanWindows, planSourceLabelKey, type PlanRouteOverride } from '../core/plan-match.ts'
import { sessionRouteFrom, type SessionSelectionView } from './session-route.ts'
import { formatPlanReset, t } from './locales.ts'
import styles from './usage.module.css'

/** Last strip-state key and instant, for the five-minute diagnostic throttle. */
let lastDiagKey = ''
let lastDiagAt = 0

/**
 * Report a state change to the host diagnostic log. Identical `strip-state`
 * keys are throttled for five minutes (the strip re-renders on every shared
 * poll); error and registration kinds are always forwarded.
 */
export function reportDiag(kind: string, key: string): void {
  const now = Date.now()
  const full = `${kind}:${key}`
  if (kind === 'strip-state' && full === lastDiagKey && now - lastDiagAt < 300_000) return
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

/**
 * One reading format everywhere in the strip (trigger, panel, tooltip):
 * one decimal, so a row never mixes `8.0%` with `21%` and the compact pill
 * always agrees with the detail view.
 */
function percentText(value: number): string {
  return `${Math.min(100, Math.max(0, value)).toFixed(1)}%`
}

/** Absolute reset instant for the relative reset copy's tooltip. */
function resetInstantTitle(iso?: string): string | undefined {
  if (iso === undefined || iso === '') return undefined
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return undefined
  try {
    return at.toLocaleString()
  } catch {
    return undefined
  }
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
  // `barFill` supplies the non-colour geometry (most importantly height).
  // Keep it when applying a warning/danger colour: otherwise the empty inner
  // span collapses to zero height and a high-usage bar appears blank.
  if (percent >= 90) return `${styles.barFill} ${styles.barLow}`
  if (percent >= 70) return `${styles.barFill} ${styles.barWarn}`
  return styles.barFill
}

function primaryWindow(windows: PlanWindowView[]): PlanWindowView {
  // Every official window can block further usage. The compact ring must show
  // the tightest active limit, rather than always favouring a short 5h window
  // while a week or month is almost exhausted.
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
 *
 * The trigger stays a single quiet pill: a 16px ring for the tightest window
 * plus the per-window reading. The popover is the detailed view (per-window
 * bars, tone colours, reset copy) and explains that the ring tracks the
 * tightest window, so the arc and the numbers can never be misread.
 */
export function PlanUsageStrip(props: PlanUsageStripProps): ReactNode {
  const { store } = props
  const ui = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const wasOpen = useRef(false)
  const panelId = useId()

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

  // Focus contract: the popover is a dialog panel, not a tab stop — focus it on
  // open so Escape/scroll work, and hand focus back to the trigger on close.
  useEffect(() => {
    if (open) {
      wasOpen.current = true
      panelRef.current?.focus({ preventScroll: true })
      return
    }
    if (!wasOpen.current) return
    wasOpen.current = false
    triggerRef.current?.focus({ preventScroll: true })
  }, [open])

  // Keep the right-anchored panel inside the window: the composer dock can put
  // the trigger close to either edge, so nudge the panel back with a transform
  // instead of letting a narrow window clip it.
  useEffect(() => {
    if (!open) return undefined
    const clamp = (): void => {
      const panel = panelRef.current
      if (panel === null) return
      panel.style.transform = ''
      const rect = panel.getBoundingClientRect()
      const margin = 12
      let dx = 0
      if (rect.left < margin) dx = margin - rect.left
      const right = rect.right + dx
      if (right > window.innerWidth - margin) dx -= right - (window.innerWidth - margin)
      if (dx !== 0) panel.style.transform = `translateX(${Math.round(dx)}px)`
    }
    clamp()
    window.addEventListener('resize', clamp)
    return () => {
      window.removeEventListener('resize', clamp)
      if (panelRef.current !== null) panelRef.current.style.transform = ''
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
  const level = toneClass(percent)
  const windowSummary = windows.map((window) => `${windowShort(window)} ${percentText(window.percent as number)}`).join(' · ')
  const model = override?.model ?? snapshot.current.model
  const source = t(planSourceLabelKey(provider))
  const identity = model === undefined || model === ''
    ? provider.displayName
    : `${provider.displayName} · ${model}`
  // Only provider-scoped alerts (plan/balance) affect this pill; a device-wide
  // daily-cost alert is surfaced in the Overview banner instead.
  const providerAlert = snapshot.alerts?.find((alert) => alert.provider === provider.provider)

  return (
    <span ref={rootRef} className={`${styles.quotaMeter} ${level}`} data-dsh-plugin="usage-plus" data-dsh-part="quota-meter" data-usage-plus-rev="4">
      <button
        ref={triggerRef}
        type="button"
        className={styles.quotaMeterTrigger}
        aria-label={`${identity} · ${source} · ${t('usage.plan.quota')} · ${windowSummary}${providerAlert === undefined ? '' : ` · ${t('usage.alerts.stripDot')}`}`}
        aria-haspopup="dialog"
        aria-controls={panelId}
        aria-expanded={open}
        title={`${identity}\n${source} · ${t('usage.plan.quota')}\n${windows.map((window) => `${windowLabel(window)} ${percentText(window.percent as number)}`).join(' · ')}`}
        onClick={() => {
          setOpen((value) => !value)
        }}
      >
        <svg viewBox="0 0 14 14" width="16" height="16" aria-hidden="true">
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
        <span className={styles.quotaMeterLabel}>{t('usage.plan.quota')}</span>
        <span className={styles.quotaMeterReading}>{windowSummary}</span>
      </button>
      {providerAlert !== undefined && (
        <span
          className={styles.quotaMeterAlertDot}
          data-dsh-part="quota-alert-dot"
          data-alert-severity={providerAlert.severity}
          aria-hidden="true"
        />
      )}
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          className={styles.quotaMeterPanel}
          role="dialog"
          aria-label={identity}
          tabIndex={-1}
        >
          <div className={styles.quotaMeterHeader}>
            <div className={styles.quotaMeterIdentity}>
              <span className={styles.quotaMeterName}>{identity}</span>
              <span className={styles.quotaMeterMeta}>
                <span className={styles.sourceChip}>{source}</span>
                {provider.plan?.planName !== undefined ? <span>{provider.plan.planName}</span> : null}
              </span>
            </div>
          </div>
          <div className={styles.quotaMeterBars}>
            {windows.map((window) => {
              const value = window.percent as number
              // The ring tracks the tightest (highest-usage) window: mark that
              // same row in the detail view so the arc has a visible referent.
              const tightest = primary.key === window.key
              return (
                <div key={window.key} className={`${styles.quotaMeterBarRow} ${toneClass(value)}`}>
                  <div className={styles.quotaMeterBarHead}>
                    <span className={styles.quotaMeterBarLabel}>
                      {windowLabel(window)}
                      {tightest ? <span className={styles.quotaMeterTight}>{t('usage.plan.tightest')}</span> : null}
                    </span>
                    <span className={styles.quotaMeterBarPct}>{percentText(value)}</span>
                  </div>
                  <span className={styles.bar}>
                    <span className={barTone(value)} style={{ width: `${Math.min(100, Math.max(0, value))}%`, display: 'block' }} />
                  </span>
                  <span className={styles.quotaMeterReset} title={resetInstantTitle(window.resetsAt)}>{formatPlanReset(window.resetsAt)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </span>
  )
}
