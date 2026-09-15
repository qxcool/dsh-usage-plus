import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { UsageStoreInstance } from './usage-store.ts'
import type { PlanWindowView } from '../core/types.ts'
import { currentPlanProvider, orderedPlanWindows, planSourceLabelKey, type PlanRouteOverride } from '../core/plan-match.ts'
import { sessionRouteFrom, sessionSelectionFace, type SessionFaceLike } from './session-route.ts'
import { t } from './locales.ts'
import styles from './usage.module.css'

export interface PlanUsageStripProps {
  store: UsageStoreInstance
  poll: () => void
  /**
   * Standard session-scope props. The renderer's `session-maybe` source
   * suite injects them automatically: the active conversation's session
   * object (via a uSES hook, `undefined` when no session is mounted) and
   * that session's id.
   */
  useSession?: () => SessionFaceLike | undefined
  sessionId?: string
}

export { currentPlanProvider }

const STRIP_POLL_MS = 5_000
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

function primaryWindow(windows: PlanWindowView[]): PlanWindowView {
  const fiveHour = windows.find((window) => window.key === '5h')
  if (fiveHour !== undefined) return fiveHour
  return windows.reduce((worst, window) =>
    (window.percent as number) > (worst.percent as number) ? window : worst)
}

/**
 * Compact plan-quota meter for `conversation.input.right`, styled like the
 * official ContextMeter (ring + %) beside the model / send controls.
 */
export function PlanUsageStrip(props: PlanUsageStripProps): ReactNode {
  const { store, poll } = props
  const ui = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    poll()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') poll()
    }, STRIP_POLL_MS)
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') poll()
    }
    const onComposerInteract = (event: Event): void => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('[data-slot="conversation.composer"], [data-slot="conversation.input"], [data-slot="conversation.composer.dock"]') === null) return
      window.setTimeout(() => {
        if (document.visibilityState === 'visible') poll()
      }, 50)
    }
    document.addEventListener('visibilitychange', onVisible)
    document.addEventListener('pointerup', onComposerInteract, true)
    document.addEventListener('change', onComposerInteract, true)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      document.removeEventListener('pointerup', onComposerInteract, true)
      document.removeEventListener('change', onComposerInteract, true)
    }
  }, [poll])

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
  const session = props.useSession?.()
  const sessionFace = session === undefined ? undefined : sessionSelectionFace(session)
  // Subscribe manually instead of feeding the projection face straight into
  // useSyncExternalStore: the face's getSnapshot may hand back a fresh object
  // per call, and React requires a cached snapshot. Normalize to a primitive
  // key and only propagate visible changes.
  const [sessionRouteKey, setSessionRouteKey] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    const read = (): void => {
      if (!active) return
      const route = sessionRouteFrom(sessionFace === undefined ? undefined : sessionFace.getSnapshot())
      const key = route === undefined ? null : `${route.provider}\u241F${route.model ?? ''}`
      setSessionRouteKey((previous) => (previous === key ? previous : key))
    }
    read()
    const stop = sessionFace?.subscribe(read)
    return () => {
      active = false
      stop?.()
    }
  }, [sessionFace])
  const override: PlanRouteOverride | undefined = sessionRouteKey === null
    ? undefined
    : (():
      | PlanRouteOverride
      | undefined => {
        const [provider, model = ''] = sessionRouteKey.split('\u241F')
        if (provider === '') return undefined
        return { provider, ...(model !== '' ? { model } : {}) }
      })()
  // The conversation's own selection wins; if that route has no plan window
  // (yet), fall back to the host's global current so an existing global
  // reading is not lost while switching.
  const provider = currentPlanProvider(snapshot, override) ?? (override !== undefined ? currentPlanProvider(snapshot) : undefined)
  if (provider?.plan === undefined || snapshot === null) return null

  const windows = orderedPlanWindows(provider.plan)
  if (windows.length === 0) return null
  const primary = primaryWindow(windows)
  const percent = primary.percent as number
  const reading = percentText(percent)
  const level = toneClass(percent)
  // With an explicit per-session route the model label follows it; when the
  // session has no projection yet the host's current model is the fallback.
  const model = override !== undefined
    ? (override.model !== undefined ? override.model : snapshot.current.model)
    : snapshot.current.model
  const source = t(planSourceLabelKey(provider))
  const identity = model === undefined || model === ''
    ? provider.displayName
    : `${provider.displayName} · ${model}`

  return (
    <span ref={rootRef} className={`${styles.quotaMeter} ${level}`} data-dsh-plugin="usage-plus" data-dsh-part="quota-meter" data-usage-plus-rev="2">
      <button
        type="button"
        className={styles.quotaMeterTrigger}
        aria-label={`${identity} · ${source} · ${windowLabel(primary)} ${reading}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={`${identity}\n${source}\n${windows.map((window) => `${windowLabel(window)} ${percentText(window.percent as number)}`).join(' · ')}`}
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
          <dl className={styles.quotaMeterRows}>
            {windows.map((window) => {
              const value = window.percent as number
              const reset = window.resetsAt === undefined
                ? null
                : new Date(window.resetsAt).toLocaleString()
              return (
                <div key={window.key} className={`${styles.quotaMeterRow} ${toneClass(value)}`}>
                  <dt>
                    <span className={styles.quotaMeterSwatch} aria-hidden="true" />
                    {windowLabel(window)}
                    <span className={styles.quotaMeterKey}>{windowShort(window)}</span>
                  </dt>
                  <dd>
                    <span>{percentText(value)}</span>
                    <span className={styles.quotaMeterReset}>{reset ?? '—'}</span>
                  </dd>
                </div>
              )
            })}
          </dl>
        </div>
      )}
    </span>
  )
}
