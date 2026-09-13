import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import type { UsageStoreInstance } from './usage-store.ts'
import type { PlanWindowView, ProviderSnapshotView, UsageOverviewView } from '../core/types.ts'
import { t } from './locales.ts'
import styles from './usage.module.css'

export interface PlanUsageStripProps {
  store: UsageStoreInstance
  poll: () => void
}

const STRIP_POLL_MS = 15_000
const DISPLAY_KEYS = new Set(['5h', 'week', 'month'])

function percentText(value: number): string {
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)}%`
}

function windowLabel(window: PlanWindowView): string {
  return window.name ?? t(`usage.plan.windows.${window.key}`)
}

export function currentPlanProvider(snapshot: UsageOverviewView | null): ProviderSnapshotView | undefined {
  if (snapshot === null || snapshot.current.provider === undefined) return undefined
  const provider = snapshot.providers.find((row) => row.provider === snapshot.current.provider)
  if (provider?.plan === undefined) return undefined
  const windows = provider.plan.windows.filter((window) => DISPLAY_KEYS.has(window.key) && window.percent !== undefined)
  return windows.length > 0 ? { ...provider, plan: { ...provider.plan, windows } } : undefined
}

/** Compact official quota strip under the conversation input. No real plan window means no UI. */
export function PlanUsageStrip(props: PlanUsageStripProps): ReactNode {
  const { store, poll } = props
  const ui = useSyncExternalStore(store.subscribe, store.getSnapshot)

  useEffect(() => {
    poll()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') poll()
    }, STRIP_POLL_MS)
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') poll()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [poll])

  const snapshot = ui.snapshot
  const provider = currentPlanProvider(snapshot)
  if (provider?.plan === undefined || snapshot === null) return null

  const model = snapshot.current.model
  return (
    <div className={styles.quotaStrip} data-dsh-plugin="usage-plus" data-dsh-part="quota-strip">
      <span className={styles.quotaIdentity} title={model === undefined ? provider.displayName : `${provider.displayName} · ${model}`}>
        {provider.displayName}{model !== undefined && model !== '' ? ` · ${model}` : ''}
      </span>
      {provider.plan.windows.map((window) => {
        const percent = window.percent as number
        const level = percent >= 90 ? styles.quotaDanger : percent >= 70 ? styles.quotaWarn : ''
        const reset = window.resetsAt === undefined ? '' : ` · ${t('usage.plan.reset', { date: new Date(window.resetsAt).toLocaleString() })}`
        return (
          <span key={window.key} className={`${styles.quotaChip} ${level}`} title={`${windowLabel(window)} ${percentText(percent)}${reset}`}>
            <span>{windowLabel(window)}</span>
            <span className={styles.quotaMiniBar}><span style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} /></span>
            <span>{percentText(percent)}</span>
          </span>
        )
      })}
    </div>
  )
}
