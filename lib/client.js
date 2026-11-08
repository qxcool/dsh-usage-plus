window.__ModuleLoader__.load({
	id: "dsh-usage-plus",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		(function(){if(typeof document==="undefined")return;if(document.querySelector('style[data-plugin-css="dsh-usage-plus/client"]'))return;var tag=document.createElement("style");tag.dataset.plugin="dsh-usage-plus";tag.dataset.pluginCss="dsh-usage-plus/client";tag.textContent=".bAyXAa_section, .bAyXAa_quotaMeter {\n  --u-line: color-mix(in srgb, currentColor 8%, transparent);\n  --u-line-2: color-mix(in srgb, currentColor 15%, transparent);\n  --u-surface-1: color-mix(in srgb, currentColor 2.5%, transparent);\n  --u-surface-2: color-mix(in srgb, currentColor 4.5%, transparent);\n  --u-surface-3: color-mix(in srgb, currentColor 7%, transparent);\n  --u-text-2: color-mix(in srgb, currentColor 80%, transparent);\n  --u-text-3: color-mix(in srgb, currentColor 62%, transparent);\n  --u-accent: var(--dsw-alias-brand-primary, #4f6bff);\n  --u-good: var(--dsw-alias-state-success-primary, #2eb88a);\n  --u-warn: var(--dsw-alias-state-warning-primary, #d9930f);\n  --u-bad: var(--dsw-alias-state-danger-primary, #d93843);\n  --u-mono: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);\n  --u-ease: cubic-bezier(.2, 0, 0, 1);\n  --hm-cell: 13px;\n  --hm-gap: 3px;\n}\n\n.bAyXAa_mono {\n  font-family: var(--u-mono);\n  font-variant-numeric: tabular-nums;\n  font-feature-settings: \"tnum\" 1;\n}\n\n.bAyXAa_dim {\n  color: var(--u-text-3);\n}\n\n.bAyXAa_section {\n  color: inherit;\n  flex-direction: column;\n  gap: 20px;\n  min-width: 0;\n  display: flex;\n}\n\n.bAyXAa_pageHead {\n  border-bottom: 1px solid var(--u-line);\n  justify-content: space-between;\n  align-items: flex-start;\n  gap: 16px;\n  padding-bottom: 16px;\n  display: flex;\n}\n\n.bAyXAa_pageHeadMain {\n  flex-direction: column;\n  gap: 2px;\n  min-width: 0;\n  display: flex;\n}\n\n.bAyXAa_pageIdentity {\n  color: var(--u-text-2);\n  flex-wrap: wrap;\n  align-items: baseline;\n  gap: 10px;\n  min-width: 0;\n  font-size: 13px;\n  display: flex;\n}\n\n.bAyXAa_identityName {\n  overflow-wrap: anywhere;\n  min-width: 0;\n  color: color-mix(in srgb, currentColor 92%, transparent);\n  font-weight: 500;\n}\n\n.bAyXAa_identityBalance {\n  color: var(--u-text-2);\n  font-size: 12px;\n  font-weight: 500;\n}\n\n.bAyXAa_headActions {\n  flex: none;\n  align-items: center;\n  gap: 12px;\n  display: inline-flex;\n}\n\n.bAyXAa_freshness {\n  color: var(--u-text-3);\n  white-space: nowrap;\n  align-items: center;\n  gap: 6px;\n  font-size: 11.5px;\n  display: inline-flex;\n}\n\n.bAyXAa_freshnessDot {\n  background: color-mix(in srgb, currentColor 28%, transparent);\n  border-radius: 50%;\n  flex: none;\n  width: 6px;\n  height: 6px;\n  transition: background-color .16s, box-shadow .16s;\n}\n\n.bAyXAa_freshness[data-fresh=\"yes\"] .bAyXAa_freshnessDot {\n  background: var(--u-good);\n  box-shadow: 0 0 0 3px color-mix(in srgb, var(--u-good) 16%, transparent);\n}\n\n.bAyXAa_toolbar {\n  flex-wrap: wrap;\n  justify-content: space-between;\n  align-items: center;\n  gap: 16px;\n  display: flex;\n}\n\n.bAyXAa_tabs {\n  background: var(--u-surface-2);\n  border: 1px solid var(--u-line);\n  border-radius: 10px;\n  gap: 2px;\n  width: fit-content;\n  max-width: 100%;\n  padding: 3px;\n  display: inline-flex;\n}\n\n.bAyXAa_tab {\n  appearance: none;\n  height: 30px;\n  color: var(--u-text-2);\n  font: inherit;\n  cursor: pointer;\n  white-space: nowrap;\n  background: none;\n  border: 0;\n  border-radius: 7px;\n  padding: 0 12px;\n  font-size: 12.5px;\n  transition: color .12s, background-color .12s;\n}\n\n.bAyXAa_tab:hover {\n  color: inherit;\n}\n\n.bAyXAa_tab:focus-visible {\n  box-shadow: 0 0 0 2px color-mix(in srgb, var(--u-accent) 55%, transparent);\n  outline: none;\n}\n\n.bAyXAa_tabActive {\n  background: var(--u-surface-3);\n  box-shadow: inset 0 0 0 1px var(--u-line-2);\n  color: inherit;\n}\n\n.bAyXAa_scopeNote {\n  color: var(--u-text-3);\n  max-width: 54ch;\n  font-size: 11.5px;\n  line-height: 1.5;\n}\n\n.bAyXAa_cockpit {\n  grid-template-columns: repeat(12, minmax(0, 1fr));\n  align-items: stretch;\n  gap: 16px;\n  display: grid;\n}\n\n.bAyXAa_cell {\n  min-width: 0;\n  display: flex;\n}\n\n.bAyXAa_cell > * {\n  flex: auto;\n  min-width: 0;\n}\n\n.bAyXAa_cell5 {\n  grid-column: span 5;\n}\n\n.bAyXAa_cell7 {\n  grid-column: span 7;\n}\n\n.bAyXAa_cell12 {\n  grid-column: span 12;\n}\n\n.bAyXAa_card {\n  border: 1px solid var(--u-line);\n  background: var(--u-surface-1);\n  border-radius: 16px;\n  flex-direction: column;\n  gap: 16px;\n  min-width: 0;\n  padding: 20px;\n  display: flex;\n}\n\n.bAyXAa_cardHead {\n  justify-content: space-between;\n  align-items: center;\n  gap: 12px;\n  min-height: 20px;\n  display: flex;\n}\n\n.bAyXAa_cardHeadGroup {\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 8px;\n  min-width: 0;\n  display: inline-flex;\n}\n\n.bAyXAa_cardTitle {\n  color: var(--u-text-2);\n  font-size: 13px;\n  font-weight: 500;\n  line-height: 1.3;\n}\n\n.bAyXAa_cardMeta {\n  color: var(--u-text-3);\n  font-variant-numeric: tabular-nums;\n  white-space: nowrap;\n  font-size: 11px;\n}\n\n.bAyXAa_scopeChip {\n  color: var(--u-text-3);\n  border: 1px solid var(--u-line-2);\n  white-space: nowrap;\n  border-radius: 5px;\n  flex: none;\n  padding: 1px 5px;\n  font-size: 10px;\n  font-weight: 500;\n  line-height: 1.3;\n}\n\n.bAyXAa_subTitle {\n  color: var(--u-text-3);\n  margin: 0;\n  font-size: 11px;\n  font-weight: 500;\n  line-height: 1.4;\n  display: block;\n}\n\n.bAyXAa_peakPill {\n  color: var(--u-text-3);\n  border: 1px solid var(--u-line);\n  white-space: nowrap;\n  border-radius: 6px;\n  padding: 2px 7px;\n  font-size: 11px;\n}\n\n.bAyXAa_linkBtn {\n  appearance: none;\n  color: var(--u-text-3);\n  font: inherit;\n  cursor: pointer;\n  white-space: nowrap;\n  background: none;\n  border: 0;\n  padding: 0;\n  font-size: 11.5px;\n  transition: color .12s;\n}\n\n.bAyXAa_linkBtn:hover {\n  color: inherit;\n  text-underline-offset: 3px;\n  text-decoration: underline;\n}\n\n.bAyXAa_linkBtn:focus-visible {\n  box-shadow: 0 0 0 2px color-mix(in srgb, var(--u-accent) 55%, transparent);\n  border-radius: 4px;\n  outline: none;\n}\n\n.bAyXAa_muted {\n  color: var(--u-text-3);\n  font-size: 12px;\n  line-height: 1.5;\n}\n\n.bAyXAa_icon {\n  color: var(--u-text-3);\n  transition: transform .14s var(--u-ease), color .12s ease;\n  flex: none;\n}\n\n.bAyXAa_iconOpen {\n  transform: rotate(180deg);\n}\n\n.bAyXAa_iconSpin {\n  animation: .9s linear infinite bAyXAa_u-spin;\n}\n\n.bAyXAa_iconSpacer {\n  flex: none;\n  width: 14px;\n}\n\n.bAyXAa_refreshBtn {\n  appearance: none;\n  border: 1px solid var(--u-line-2);\n  height: 32px;\n  color: var(--u-text-2);\n  font: inherit;\n  cursor: pointer;\n  white-space: nowrap;\n  background: none;\n  border-radius: 8px;\n  align-items: center;\n  gap: 6px;\n  padding: 0 12px;\n  font-size: 12px;\n  transition: color .12s, background-color .12s, border-color .12s;\n  display: inline-flex;\n}\n\n.bAyXAa_refreshBtn:hover:not(:disabled) {\n  color: inherit;\n  background: var(--u-surface-2);\n  border-color: color-mix(in srgb, currentColor 24%, transparent);\n}\n\n.bAyXAa_refreshBtn:disabled {\n  cursor: default;\n  opacity: .5;\n}\n\n.bAyXAa_refreshBtn:focus-visible {\n  box-shadow: 0 0 0 2px color-mix(in srgb, var(--u-accent) 55%, transparent);\n  outline: none;\n}\n\n.bAyXAa_hero {\n  grid-template-columns: minmax(0, 1.3fr) minmax(0, 1.5fr) auto;\n  align-items: center;\n  gap: 24px;\n  padding: 20px 24px;\n  display: grid;\n}\n\n.bAyXAa_heroToday {\n  flex-direction: column;\n  justify-content: center;\n  gap: 6px;\n  min-width: 0;\n  display: flex;\n}\n\n.bAyXAa_heroLabel {\n  color: var(--u-text-3);\n  font-size: 11.5px;\n}\n\n.bAyXAa_heroFigure {\n  flex-wrap: wrap;\n  align-items: baseline;\n  gap: 4px 12px;\n  display: flex;\n}\n\n.bAyXAa_heroValue {\n  font-family: var(--u-mono);\n  font-variant-numeric: tabular-nums;\n  font-feature-settings: \"tnum\" 1;\n  letter-spacing: -.02em;\n  color: inherit;\n  font-size: 40px;\n  font-weight: 500;\n  line-height: 1.05;\n}\n\n.bAyXAa_delta {\n  align-items: baseline;\n  gap: 6px;\n  display: inline-flex;\n}\n\n.bAyXAa_deltaValue {\n  color: var(--u-text-2);\n  background: var(--u-surface-2);\n  border: 1px solid var(--u-line);\n  border-radius: 6px;\n  padding: 1px 6px;\n  font-size: 12px;\n  font-weight: 500;\n}\n\n.bAyXAa_deltaLabel {\n  color: var(--u-text-3);\n  font-size: 11px;\n}\n\n.bAyXAa_heroHint {\n  color: var(--u-text-3);\n  font-size: 11.5px;\n}\n\n.bAyXAa_statGroup {\n  border-left: 1px solid var(--u-line);\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n  align-content: center;\n  gap: 16px 24px;\n  min-width: 0;\n  padding-left: 24px;\n  display: grid;\n}\n\n.bAyXAa_stat {\n  flex-direction: column;\n  gap: 2px;\n  min-width: 0;\n  display: flex;\n}\n\n.bAyXAa_statLabel {\n  color: var(--u-text-3);\n  white-space: nowrap;\n  font-size: 11px;\n}\n\n.bAyXAa_statValue {\n  font-family: var(--u-mono);\n  font-variant-numeric: tabular-nums;\n  font-feature-settings: \"tnum\" 1;\n  color: inherit;\n  font-size: 19px;\n  font-weight: 500;\n  line-height: 1.15;\n}\n\n.bAyXAa_statHint {\n  color: var(--u-text-3);\n  white-space: nowrap;\n  text-overflow: ellipsis;\n  font-size: 10.5px;\n  overflow: hidden;\n}\n\n.bAyXAa_heroRing {\n  flex-direction: column;\n  align-items: center;\n  gap: 6px;\n  min-width: 112px;\n  display: flex;\n}\n\n.bAyXAa_heroRingLabel {\n  color: var(--u-text-2);\n  font-size: 11.5px;\n}\n\n.bAyXAa_heroRingHint {\n  font-family: var(--u-mono);\n  font-variant-numeric: tabular-nums;\n  color: var(--u-text-3);\n  font-size: 10.5px;\n}\n\n.bAyXAa_ringBox {\n  flex: none;\n  justify-content: center;\n  align-items: center;\n  display: inline-flex;\n  position: relative;\n}\n\n.bAyXAa_ringSvg {\n  width: 100%;\n  height: 100%;\n}\n\n.bAyXAa_ringTrack {\n  fill: none;\n  stroke: color-mix(in srgb, currentColor 9%, transparent);\n}\n\n.bAyXAa_ringFill {\n  fill: none;\n  stroke-linecap: round;\n  transition: stroke-dasharray .4s var(--u-ease);\n}\n\n.bAyXAa_ringValue {\n  color: inherit;\n  font-size: 15px;\n  font-weight: 500;\n  position: absolute;\n}\n\n.bAyXAa_heroRing .bAyXAa_ringValue {\n  font-size: 17px;\n}\n\n.bAyXAa_toneAccent {\n  stroke: var(--u-accent);\n}\n\n.bAyXAa_toneGood {\n  stroke: var(--u-good);\n}\n\n.bAyXAa_toneWarn {\n  stroke: var(--u-warn);\n}\n\n.bAyXAa_toneBad {\n  stroke: var(--u-bad);\n}\n\n.bAyXAa_heatmapLayout {\n  flex-wrap: wrap;\n  flex: 1;\n  justify-content: space-between;\n  align-items: center;\n  gap: 24px;\n  display: flex;\n}\n\n.bAyXAa_heatmapLeft {\n  flex-direction: column;\n  justify-content: center;\n  gap: 16px;\n  min-width: 0;\n  display: flex;\n}\n\n.bAyXAa_heatmapBody {\n  gap: 8px;\n  min-width: 0;\n  display: flex;\n}\n\n.bAyXAa_heatmapLabels {\n  gap: var(--hm-gap);\n  flex-direction: column;\n  flex: none;\n  display: flex;\n}\n\n.bAyXAa_heatmapCorner {\n  height: 12px;\n}\n\n.bAyXAa_heatmapDow {\n  grid-template-rows: repeat(7, var(--hm-cell));\n  gap: var(--hm-gap);\n  color: var(--u-text-3);\n  font-size: 10px;\n  line-height: 1;\n  display: grid;\n}\n\n.bAyXAa_heatmapDow span {\n  justify-content: flex-end;\n  align-items: center;\n  padding-right: 6px;\n  display: flex;\n}\n\n.bAyXAa_heatmapMain {\n  gap: var(--hm-gap);\n  flex-direction: column;\n  min-width: 0;\n  display: flex;\n}\n\n.bAyXAa_heatmapMonths {\n  grid-template-columns: repeat(26, var(--hm-cell));\n  gap: var(--hm-gap);\n  height: 12px;\n  color: var(--u-text-3);\n  font-size: 10px;\n  line-height: 12px;\n  display: grid;\n}\n\n.bAyXAa_heatmapMonth {\n  white-space: nowrap;\n}\n\n.bAyXAa_heatmapGrid {\n  grid-auto-flow: column;\n  grid-template-rows: repeat(7, var(--hm-cell));\n  grid-auto-columns: var(--hm-cell);\n  gap: var(--hm-gap);\n  display: grid;\n}\n\n.bAyXAa_heatmapCell {\n  width: var(--hm-cell);\n  height: var(--hm-cell);\n  background: color-mix(in srgb, currentColor 7%, transparent);\n  border-radius: 3px;\n}\n\n.bAyXAa_heatmapCell[data-level=\"0\"] {\n  background: color-mix(in srgb, currentColor 7%, transparent);\n}\n\n.bAyXAa_heatmapCell[data-level=\"1\"] {\n  background: color-mix(in srgb, var(--u-accent) 26%, transparent);\n}\n\n.bAyXAa_heatmapCell[data-level=\"2\"] {\n  background: color-mix(in srgb, var(--u-accent) 46%, transparent);\n}\n\n.bAyXAa_heatmapCell[data-level=\"3\"] {\n  background: color-mix(in srgb, var(--u-accent) 68%, transparent);\n}\n\n.bAyXAa_heatmapCell[data-level=\"4\"] {\n  background: var(--u-accent);\n}\n\n.bAyXAa_heatmapToday {\n  outline: 2px solid color-mix(in srgb, currentColor 64%, transparent);\n  outline-offset: 2px;\n}\n\n.bAyXAa_heatmapLegend {\n  color: var(--u-text-3);\n  align-items: center;\n  gap: 4px;\n  font-size: 10.5px;\n  display: flex;\n}\n\n.bAyXAa_heatmapLegend .bAyXAa_heatmapCell {\n  flex: none;\n}\n\n.bAyXAa_heatmapSide {\n  border-left: 1px solid var(--u-line);\n  flex-direction: column;\n  gap: 16px;\n  min-width: 132px;\n  margin-left: auto;\n  padding-left: 24px;\n  display: flex;\n}\n\n.bAyXAa_sideStat {\n  flex-direction: column;\n  gap: 2px;\n  min-width: 0;\n  display: flex;\n}\n\n.bAyXAa_sideLabel {\n  color: var(--u-text-3);\n  white-space: nowrap;\n  font-size: 11px;\n}\n\n.bAyXAa_sideValue {\n  font-family: var(--u-mono);\n  font-variant-numeric: tabular-nums;\n  color: inherit;\n  font-size: 16px;\n  font-weight: 500;\n  line-height: 1.2;\n}\n\n.bAyXAa_sideUnit {\n  color: var(--u-text-3);\n  margin-left: 2px;\n  font-size: 11px;\n}\n\n.bAyXAa_sideHint {\n  color: var(--u-text-3);\n  font-size: 10.5px;\n}\n\n.bAyXAa_quotaCard {\n  gap: 16px;\n}\n\n.bAyXAa_quotaIdentity {\n  color: var(--u-text-2);\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 8px;\n  min-width: 0;\n  font-size: 12.5px;\n  display: flex;\n}\n\n.bAyXAa_quotaIdentity .bAyXAa_providerName {\n  font-weight: 500;\n}\n\n.bAyXAa_sourceChip {\n  border: 1px solid var(--u-line-2);\n  color: var(--u-text-3);\n  white-space: nowrap;\n  border-radius: 5px;\n  flex: none;\n  align-items: center;\n  padding: 1px 6px;\n  font-size: 10px;\n  font-weight: 500;\n  line-height: 1.4;\n  display: inline-flex;\n}\n\n.bAyXAa_planTier {\n  color: var(--u-text-3);\n  font-size: 11px;\n}\n\n.bAyXAa_gaugesRow {\n  flex-wrap: wrap;\n  justify-content: space-between;\n  align-items: flex-start;\n  gap: 16px;\n  margin: auto 0;\n  padding: 8px 0;\n  display: flex;\n}\n\n.bAyXAa_gauge {\n  text-align: center;\n  flex-direction: column;\n  flex: 88px;\n  align-items: center;\n  gap: 8px;\n  min-width: 0;\n  display: flex;\n}\n\n.bAyXAa_gaugeLabel {\n  color: var(--u-text-2);\n  font-size: 12px;\n  font-weight: 500;\n}\n\n.bAyXAa_gaugeSub {\n  color: var(--u-text-3);\n  font-size: 10.5px;\n  line-height: 1.4;\n}\n\n.bAyXAa_emptyState {\n  align-items: center;\n  gap: 16px;\n  min-width: 0;\n  margin: auto 0;\n  padding: 8px 0;\n  display: flex;\n}\n\n.bAyXAa_emptyState .bAyXAa_ringValue {\n  color: var(--u-text-3);\n  font-size: 13px;\n}\n\n.bAyXAa_emptyBody {\n  flex-direction: column;\n  gap: 4px;\n  min-width: 0;\n  display: flex;\n}\n\n.bAyXAa_emptyTitle {\n  color: var(--u-text-2);\n  font-size: 13px;\n  font-weight: 500;\n}\n\n.bAyXAa_emptyHint {\n  color: var(--u-text-3);\n  font-size: 11.5px;\n  line-height: 1.5;\n}\n\n.bAyXAa_emptyAction {\n  appearance: none;\n  color: var(--u-text-2);\n  font: inherit;\n  cursor: pointer;\n  text-underline-offset: 3px;\n  background: none;\n  border: 0;\n  align-self: flex-start;\n  margin-top: 2px;\n  padding: 0;\n  font-size: 12px;\n  text-decoration: underline;\n  transition: color .12s;\n}\n\n.bAyXAa_emptyAction:hover {\n  color: inherit;\n}\n\n.bAyXAa_emptyAction:focus-visible {\n  box-shadow: 0 0 0 2px color-mix(in srgb, var(--u-accent) 55%, transparent);\n  border-radius: 4px;\n  outline: none;\n}\n\n.bAyXAa_providerList {\n  flex-direction: column;\n  gap: 0;\n  display: flex;\n}\n\n.bAyXAa_providerBlock {\n  border-top: 1px solid var(--u-line);\n  flex-direction: column;\n  gap: 6px;\n  padding: 10px 0;\n  display: flex;\n}\n\n.bAyXAa_providerBlock:first-of-type {\n  border-top: 0;\n  padding-top: 0;\n}\n\n.bAyXAa_providerRow {\n  appearance: none;\n  width: 100%;\n  color: inherit;\n  font: inherit;\n  text-align: left;\n  cursor: pointer;\n  background: none;\n  border: 0;\n  border-radius: 6px;\n  flex-wrap: wrap;\n  justify-content: space-between;\n  align-items: center;\n  gap: 8px 12px;\n  padding: 0;\n  display: flex;\n}\n\n.bAyXAa_providerRow:disabled {\n  cursor: default;\n}\n\n.bAyXAa_providerRow:focus-visible {\n  box-shadow: 0 0 0 2px color-mix(in srgb, var(--u-accent) 55%, transparent);\n  outline: none;\n}\n\n.bAyXAa_providerLead {\n  align-items: center;\n  gap: 8px;\n  min-width: 0;\n  display: inline-flex;\n}\n\n.bAyXAa_providerDot {\n  background: color-mix(in srgb, currentColor 30%, transparent);\n  border-radius: 50%;\n  flex: none;\n  width: 8px;\n  height: 8px;\n}\n\n.bAyXAa_providerBlock[data-accent=\"yes\"] .bAyXAa_providerDot, .bAyXAa_chartRow[data-accent=\"yes\"] .bAyXAa_providerDot {\n  background: var(--u-accent);\n}\n\n.bAyXAa_providerName {\n  color: inherit;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  align-items: center;\n  gap: 8px;\n  min-width: 0;\n  font-size: 13px;\n  font-weight: 500;\n  display: inline-flex;\n  overflow: hidden;\n}\n\n.bAyXAa_providerMeta {\n  color: var(--u-text-3);\n  flex-wrap: wrap;\n  flex: none;\n  justify-content: flex-end;\n  align-items: baseline;\n  gap: 4px 8px;\n  font-size: 11.5px;\n  display: inline-flex;\n}\n\n.bAyXAa_providerBalance {\n  font-family: var(--u-mono);\n  color: var(--u-text-2);\n  font-size: 12px;\n  font-weight: 500;\n}\n\n.bAyXAa_providerTokens {\n  font-family: var(--u-mono);\n  font-variant-numeric: tabular-nums;\n  color: var(--u-text-2);\n  font-size: 11.5px;\n}\n\n.bAyXAa_providerShare {\n  color: var(--u-text-3);\n  text-align: right;\n  min-width: 30px;\n  font-size: 11px;\n}\n\n.bAyXAa_providerTrack {\n  background: color-mix(in srgb, currentColor 7%, transparent);\n  border-radius: 2px;\n  height: 4px;\n  display: block;\n  overflow: hidden;\n}\n\n.bAyXAa_providerFill {\n  background: color-mix(in srgb, currentColor 34%, transparent);\n  height: 100%;\n  transition: width .3s var(--u-ease);\n  border-radius: 2px;\n  display: block;\n}\n\n.bAyXAa_providerBlock[data-accent=\"yes\"] .bAyXAa_providerFill {\n  background: var(--u-accent);\n}\n\n.bAyXAa_currentBadge {\n  color: var(--u-text-2);\n  border: 1px solid var(--u-line-2);\n  border-radius: 5px;\n  flex: none;\n  padding: 1px 5px;\n  font-size: 10px;\n  font-weight: 500;\n  line-height: 1.3;\n}\n\n.bAyXAa_modelRow {\n  color: var(--u-text-3);\n  justify-content: space-between;\n  align-items: center;\n  gap: 12px;\n  padding: 2px 0 2px 16px;\n  font-size: 11.5px;\n  display: flex;\n}\n\n.bAyXAa_modelName {\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  min-width: 0;\n  color: var(--u-text-2);\n  overflow: hidden;\n}\n\n.bAyXAa_modelMeta {\n  flex: none;\n  align-items: baseline;\n  gap: 10px;\n  display: inline-flex;\n}\n\n.bAyXAa_modelShare {\n  color: var(--u-text-3);\n  text-align: right;\n  min-width: 28px;\n}\n\n.bAyXAa_balanceInline {\n  border-top: 1px solid var(--u-line);\n  flex-direction: column;\n  gap: 0;\n  padding-top: 12px;\n  display: flex;\n}\n\n.bAyXAa_balanceRow {\n  border-top: 1px solid var(--u-line);\n  justify-content: space-between;\n  align-items: center;\n  gap: 12px;\n  padding: 8px 0;\n  display: flex;\n}\n\n.bAyXAa_balanceRow:first-of-type {\n  border-top: 0;\n  padding-top: 4px;\n}\n\n.bAyXAa_balanceLead {\n  align-items: center;\n  gap: 8px;\n  min-width: 0;\n  display: inline-flex;\n}\n\n.bAyXAa_balanceMeta {\n  flex-direction: column;\n  flex: none;\n  align-items: flex-end;\n  gap: 0;\n  display: inline-flex;\n}\n\n.bAyXAa_balanceAmount {\n  color: var(--u-text-2);\n  font-size: 12.5px;\n  font-weight: 500;\n}\n\n.bAyXAa_balanceHint {\n  color: var(--u-text-3);\n  font-size: 10.5px;\n}\n\n.bAyXAa_statusDot {\n  background: color-mix(in srgb, currentColor 30%, transparent);\n  border-radius: 50%;\n  flex: none;\n  width: 7px;\n  height: 7px;\n}\n\n.bAyXAa_statusOk {\n  background: var(--u-good);\n}\n\n.bAyXAa_statusWarn {\n  background: var(--u-warn);\n}\n\n.bAyXAa_composition {\n  border-top: 1px solid var(--u-line);\n  flex-direction: column;\n  gap: 10px;\n  padding-top: 12px;\n  display: flex;\n}\n\n.bAyXAa_compositionHead {\n  color: var(--u-text-3);\n  justify-content: space-between;\n  align-items: baseline;\n  gap: 12px;\n  font-size: 11px;\n  display: flex;\n}\n\n.bAyXAa_stackBar {\n  background: color-mix(in srgb, currentColor 7%, transparent);\n  border-radius: 999px;\n  height: 8px;\n  display: flex;\n  overflow: hidden;\n}\n\n.bAyXAa_stackSeg {\n  min-width: 2px;\n  height: 100%;\n  display: block;\n}\n\n.bAyXAa_stackEmpty {\n  background: repeating-linear-gradient(90deg, color-mix(in srgb, currentColor 8%, transparent) 0 4px, transparent 4px 8px);\n  flex: 1;\n}\n\n.bAyXAa_segCache {\n  background: var(--u-accent);\n}\n\n.bAyXAa_segInput {\n  background: color-mix(in srgb, var(--u-accent) 55%, transparent);\n}\n\n.bAyXAa_segWrite {\n  background: color-mix(in srgb, currentColor 28%, transparent);\n}\n\n.bAyXAa_segOutput {\n  background: color-mix(in srgb, currentColor 60%, transparent);\n}\n\n.bAyXAa_segReasoning {\n  background: var(--u-warn);\n}\n\n.bAyXAa_legend {\n  flex-wrap: wrap;\n  gap: 4px 14px;\n  display: flex;\n}\n\n.bAyXAa_legendItem {\n  color: var(--u-text-3);\n  align-items: baseline;\n  gap: 6px;\n  font-size: 10.5px;\n  display: inline-flex;\n}\n\n.bAyXAa_legendLabel {\n  color: inherit;\n}\n\n.bAyXAa_legendDot {\n  border-radius: 2px;\n  flex: none;\n  align-self: center;\n  width: 7px;\n  height: 7px;\n  display: inline-block;\n}\n\n.bAyXAa_legendValue {\n  color: var(--u-text-2);\n  font-weight: 500;\n}\n\n.bAyXAa_chart {\n  flex-direction: column;\n  flex: 1;\n  gap: 16px;\n  display: flex;\n}\n\n.bAyXAa_chartRow {\n  flex-direction: column;\n  gap: 6px;\n  display: flex;\n}\n\n.bAyXAa_chartHead {\n  justify-content: space-between;\n  align-items: baseline;\n  gap: 12px;\n  display: flex;\n}\n\n.bAyXAa_chartLead {\n  align-items: center;\n  gap: 8px;\n  min-width: 0;\n  display: inline-flex;\n}\n\n.bAyXAa_chartName {\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-size: 13px;\n  font-weight: 500;\n  overflow: hidden;\n}\n\n.bAyXAa_chartMeta {\n  color: var(--u-text-3);\n  flex: none;\n  align-items: baseline;\n  gap: 10px;\n  font-size: 11.5px;\n  display: inline-flex;\n}\n\n.bAyXAa_chartShare {\n  color: var(--u-text-2);\n  font-size: 12px;\n  font-weight: 500;\n}\n\n.bAyXAa_chartBar {\n  background: color-mix(in srgb, currentColor 7%, transparent);\n  border-radius: 3px;\n  height: 6px;\n  display: block;\n  overflow: hidden;\n}\n\n.bAyXAa_chartFill {\n  background: color-mix(in srgb, currentColor 34%, transparent);\n  height: 100%;\n  transition: width .3s var(--u-ease);\n  border-radius: 3px;\n  display: block;\n}\n\n.bAyXAa_chartRow[data-accent=\"yes\"] .bAyXAa_chartFill {\n  background: var(--u-accent);\n}\n\n.bAyXAa_chartModel {\n  color: var(--u-text-3);\n  grid-template-columns: minmax(64px, 148px) minmax(0, 1fr) auto auto;\n  align-items: center;\n  gap: 10px;\n  padding-left: 16px;\n  font-size: 11px;\n  display: grid;\n}\n\n.bAyXAa_chartModelName {\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  color: var(--u-text-2);\n  overflow: hidden;\n}\n\n.bAyXAa_chartModelBar {\n  background: color-mix(in srgb, currentColor 6%, transparent);\n  border-radius: 2px;\n  height: 3px;\n  display: block;\n  overflow: hidden;\n}\n\n.bAyXAa_chartModelFill {\n  background: color-mix(in srgb, currentColor 26%, transparent);\n  height: 100%;\n  transition: width .3s var(--u-ease);\n  border-radius: 2px;\n  display: block;\n}\n\n.bAyXAa_chartModelValue {\n  text-align: right;\n  min-width: 34px;\n}\n\n.bAyXAa_chartModelTokens {\n  text-align: right;\n  min-width: 46px;\n  color: var(--u-text-2);\n}\n\n.bAyXAa_trendAxis {\n  color: var(--u-text-3);\n  font-variant-numeric: tabular-nums;\n  justify-content: space-between;\n  margin-top: 2px;\n  font-size: 10px;\n  display: flex;\n}\n\n.bAyXAa_historyGrid {\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n  gap: 0 24px;\n  display: grid;\n}\n\n.bAyXAa_historyRow {\n  border-top: 1px solid var(--u-line);\n  color: var(--u-text-3);\n  grid-template-columns: 40px minmax(0, 1fr) 52px 62px;\n  align-items: center;\n  gap: 10px;\n  padding: 6px 0;\n  font-size: 11.5px;\n  display: grid;\n}\n\n.bAyXAa_historyGrid .bAyXAa_historyRow:first-child, .bAyXAa_historyGrid .bAyXAa_historyRow:nth-child(2) {\n  border-top: 0;\n}\n\n.bAyXAa_historyDate {\n  color: var(--u-text-2);\n}\n\n.bAyXAa_historyBar {\n  background: color-mix(in srgb, currentColor 6%, transparent);\n  border-radius: 2px;\n  height: 3px;\n  display: block;\n  overflow: hidden;\n}\n\n.bAyXAa_historyBar > span {\n  background: color-mix(in srgb, currentColor 30%, transparent);\n  border-radius: 2px;\n  height: 100%;\n  display: block;\n}\n\n.bAyXAa_historyTokens {\n  color: var(--u-text-2);\n  text-align: right;\n}\n\n.bAyXAa_historyCalls {\n  text-align: right;\n  white-space: nowrap;\n}\n\n.bAyXAa_plans {\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n  align-items: start;\n  gap: 24px 20px;\n  display: grid;\n}\n\n.bAyXAa_planGroup {\n  flex-direction: column;\n  gap: 12px;\n  min-width: 0;\n  display: flex;\n}\n\n.bAyXAa_planGroup[data-wide=\"yes\"] {\n  grid-column: 1 / -1;\n}\n\n.bAyXAa_planCards {\n  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));\n  align-items: start;\n  gap: 16px;\n  display: grid;\n}\n\n.bAyXAa_groupTitle {\n  color: var(--u-text-3);\n  font-size: 12px;\n  font-weight: 500;\n}\n\n.bAyXAa_groupEmpty {\n  color: var(--u-text-3);\n  padding: 0 2px 4px;\n  font-size: 12px;\n}\n\n.bAyXAa_planCard {\n  gap: 12px;\n}\n\n.bAyXAa_planHead {\n  justify-content: space-between;\n  align-items: baseline;\n  gap: 10px;\n  display: flex;\n}\n\n.bAyXAa_planName {\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 8px;\n  font-size: 13.5px;\n  font-weight: 500;\n  display: inline-flex;\n}\n\n.bAyXAa_windowRow {\n  flex-direction: column;\n  gap: 6px;\n  display: flex;\n}\n\n.bAyXAa_windowLabel {\n  color: var(--u-text-2);\n  font-variant-numeric: tabular-nums;\n  justify-content: space-between;\n  gap: 12px;\n  font-size: 12px;\n  display: flex;\n}\n\n.bAyXAa_bar {\n  background: color-mix(in srgb, currentColor 8%, transparent);\n  border-radius: 3px;\n  height: 6px;\n  overflow: hidden;\n}\n\n.bAyXAa_barFill {\n  background: var(--u-accent);\n  height: 100%;\n  transition: width .3s var(--u-ease);\n  border-radius: 3px;\n}\n\n.bAyXAa_barWarn {\n  background: var(--u-warn);\n}\n\n.bAyXAa_barLow {\n  background: var(--u-bad);\n}\n\n.bAyXAa_resetLine {\n  color: var(--u-text-3);\n  font-variant-numeric: tabular-nums;\n  font-size: 10.5px;\n}\n\n.bAyXAa_errorLine {\n  border: 1px solid color-mix(in srgb, var(--u-warn) 32%, transparent);\n  background: color-mix(in srgb, var(--u-warn) 8%, transparent);\n  color: var(--u-text-2);\n  border-radius: 8px;\n  padding: 8px 12px;\n  font-size: 12px;\n  line-height: 1.45;\n}\n\n.bAyXAa_settingsForm {\n  flex-direction: column;\n  gap: 20px;\n  min-width: 0;\n  max-width: 660px;\n  display: flex;\n}\n\n.bAyXAa_settingsSection {\n  border-top: 1px solid var(--u-line);\n  flex-direction: column;\n  gap: 12px;\n  padding-top: 20px;\n  display: flex;\n}\n\n.bAyXAa_settingsSection:first-of-type {\n  border-top: 0;\n  padding-top: 0;\n}\n\n.bAyXAa_settingRow {\n  color: inherit;\n  grid-template-columns: minmax(0, 1fr) minmax(0, 260px);\n  align-items: center;\n  gap: 16px;\n  font-size: 13px;\n  display: grid;\n}\n\n.bAyXAa_settingRow > :last-child:not(:only-child) {\n  justify-self: end;\n  min-width: 0;\n}\n\n.bAyXAa_settingRow input[type=\"checkbox\"] {\n  accent-color: var(--u-accent);\n  width: 16px;\n  height: 16px;\n}\n\n.bAyXAa_settingRow input[type=\"number\"], .bAyXAa_settingRow input[type=\"text\"], .bAyXAa_settingRow input[type=\"password\"], .bAyXAa_settingRow select, .bAyXAa_settingRow textarea {\n  border: 1px solid var(--u-line-2);\n  color: inherit;\n  font: inherit;\n  background: none;\n  border-radius: 8px;\n  padding: 5px 8px;\n  font-size: 13px;\n}\n\n.bAyXAa_settingRow input[type=\"number\"] {\n  text-align: right;\n  width: 96px;\n}\n\n.bAyXAa_settingRow input[type=\"text\"], .bAyXAa_settingRow input[type=\"password\"] {\n  width: 100%;\n}\n\n.bAyXAa_settingRow select {\n  width: 100%;\n  max-width: 200px;\n}\n\n.bAyXAa_settingRow textarea {\n  resize: vertical;\n  width: 100%;\n  min-height: 64px;\n  font-family: var(--u-mono);\n  font-size: 12px;\n  line-height: 1.4;\n}\n\n.bAyXAa_settingRow input:focus-visible, .bAyXAa_settingRow select:focus-visible, .bAyXAa_settingRow textarea:focus-visible {\n  box-shadow: 0 0 0 2px color-mix(in srgb, var(--u-accent) 55%, transparent);\n  outline: none;\n}\n\n.bAyXAa_settingHint {\n  color: var(--u-text-3);\n  font-variant-numeric: tabular-nums;\n  font-size: 12px;\n  line-height: 1.5;\n}\n\n.bAyXAa_settingWarn {\n  max-width: 42em;\n  color: color-mix(in srgb, var(--u-bad) 78%, currentColor);\n  font-size: 12px;\n  line-height: 1.45;\n}\n\n.bAyXAa_configActions {\n  border-top: 1px solid var(--u-line);\n  flex-wrap: wrap;\n  justify-content: flex-end;\n  align-items: center;\n  gap: 8px;\n  padding-top: 16px;\n  display: flex;\n}\n\n.bAyXAa_configActions .bAyXAa_settingWarn {\n  margin-right: auto;\n}\n\n.bAyXAa_secretField {\n  flex-direction: column;\n  gap: 8px;\n  max-width: 100%;\n  display: flex;\n}\n\n.bAyXAa_secretStatus {\n  margin-left: 8px;\n  font-size: 11px;\n  font-weight: 500;\n}\n\n.bAyXAa_secretStatus[data-configured=\"yes\"] {\n  color: color-mix(in srgb, var(--u-good) 78%, currentColor);\n}\n\n.bAyXAa_secretStatus[data-configured=\"no\"] {\n  color: var(--u-text-3);\n}\n\n.bAyXAa_secretControls {\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 8px;\n  display: flex;\n}\n\n.bAyXAa_secretControls input[type=\"password\"] {\n  border: 1px solid var(--u-line-2);\n  min-width: 140px;\n  color: inherit;\n  font: inherit;\n  background: none;\n  border-radius: 8px;\n  flex: 200px;\n  padding: 5px 8px;\n  font-size: 13px;\n}\n\n.bAyXAa_secretControls input[type=\"password\"]:focus-visible {\n  box-shadow: 0 0 0 2px color-mix(in srgb, var(--u-accent) 55%, transparent);\n  outline: none;\n}\n\n.bAyXAa_stateCard {\n  border: 1px solid var(--u-line);\n  background: var(--u-surface-1);\n  border-radius: 16px;\n  align-items: center;\n  gap: 16px;\n  padding: 20px;\n  display: flex;\n}\n\n.bAyXAa_stateBody {\n  flex-direction: column;\n  flex: 1;\n  gap: 4px;\n  min-width: 0;\n  display: flex;\n}\n\n.bAyXAa_stateTitle {\n  color: var(--u-text-2);\n  font-size: 13px;\n  line-height: 1.5;\n}\n\n.bAyXAa_stateDetail {\n  color: var(--u-text-3);\n  font-size: 11.5px;\n  line-height: 1.5;\n}\n\n.bAyXAa_stateIcon {\n  color: var(--u-text-3);\n  flex: none;\n}\n\n.bAyXAa_spinner {\n  border: 2px solid color-mix(in srgb, currentColor 16%, transparent);\n  border-top-color: var(--u-accent);\n  border-radius: 50%;\n  flex: none;\n  width: 18px;\n  height: 18px;\n  animation: .8s linear infinite bAyXAa_u-spin;\n}\n\n@keyframes bAyXAa_u-spin {\n  to {\n    transform: rotate(360deg);\n  }\n}\n\n@keyframes bAyXAa_u-pop-in {\n  from {\n    opacity: 0;\n    transform: translateY(4px);\n  }\n\n  to {\n    opacity: 1;\n    transform: translateY(0);\n  }\n}\n\n.bAyXAa_quotaMeter {\n  flex: none;\n  display: inline-flex;\n  position: relative;\n}\n\n.bAyXAa_quotaMeterTrigger {\n  appearance: none;\n  box-sizing: border-box;\n  height: 26px;\n  color: var(--dsw-alias-label-secondary, var(--u-text-2));\n  font: inherit;\n  font-variant-numeric: tabular-nums;\n  cursor: pointer;\n  background: none;\n  border: 1px solid #0000;\n  border-radius: 8px;\n  align-items: center;\n  gap: 6px;\n  margin: 0;\n  padding: 0 8px 0 6px;\n  font-size: 12px;\n  line-height: 1;\n  transition: background-color .12s, border-color .12s, color .12s;\n  display: inline-flex;\n}\n\n.bAyXAa_quotaMeterTrigger:hover {\n  background: var(--dsw-alias-interactive-bg-hover, color-mix(in srgb, currentColor 8%, transparent));\n  border-color: var(--dsw-alias-border-l3, var(--u-line));\n}\n\n.bAyXAa_quotaMeterTrigger:focus-visible {\n  box-shadow: 0 0 0 2px color-mix(in srgb, var(--u-accent) 55%, transparent);\n  outline: none;\n}\n\n.bAyXAa_quotaMeterTrigger[aria-expanded=\"true\"] {\n  background: var(--dsw-alias-interactive-bg-hover, color-mix(in srgb, currentColor 8%, transparent));\n  border-color: var(--dsw-alias-border-l3, var(--u-line));\n  color: var(--dsw-alias-label-primary, inherit);\n}\n\n.bAyXAa_quotaMeterTrack {\n  fill: none;\n  stroke: var(--dsw-alias-border-l3, color-mix(in srgb, currentColor 22%, transparent));\n  stroke-width: 2px;\n}\n\n.bAyXAa_quotaMeterFill {\n  fill: none;\n  stroke: var(--u-accent);\n  stroke-width: 2px;\n  stroke-linecap: round;\n  transition: stroke-dasharray .4s var(--u-ease);\n}\n\n.bAyXAa_quotaMeterLabel {\n  color: inherit;\n  flex: none;\n  font-weight: 500;\n}\n\n.bAyXAa_quotaMeterReading {\n  min-width: 0;\n  color: var(--dsw-alias-label-secondary, var(--u-text-2));\n  opacity: .92;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  overflow: hidden;\n}\n\n.bAyXAa_quotaMeterWarn .bAyXAa_quotaMeterFill {\n  stroke: var(--u-warn);\n}\n\n.bAyXAa_quotaMeterDanger .bAyXAa_quotaMeterFill {\n  stroke: var(--u-bad);\n}\n\n.bAyXAa_quotaMeterPanel {\n  z-index: 60;\n  box-sizing: border-box;\n  border: 1px solid var(--dsw-alias-border-l3, var(--u-line-2));\n  background: var(--dsw-specific-menu, var(--dsw-alias-bg-elevated, #1e1e1e));\n  width: min(300px, 100vw - 32px);\n  box-shadow: var(--dsw-elevation-prominent, 0 12px 32px #00000052);\n  color: var(--dsw-alias-label-primary, inherit);\n  cursor: default;\n  animation: bAyXAa_u-pop-in .14s var(--u-ease);\n  border-radius: 14px;\n  padding: 16px;\n  font-size: 12px;\n  line-height: 1.5;\n  position: absolute;\n  bottom: calc(100% + 10px);\n  right: 0;\n}\n\n.bAyXAa_quotaMeterHeader {\n  justify-content: space-between;\n  align-items: flex-start;\n  gap: 8px;\n  min-width: 0;\n  margin-bottom: 14px;\n  display: flex;\n}\n\n.bAyXAa_quotaMeterIdentity {\n  flex-direction: column;\n  gap: 3px;\n  min-width: 0;\n  display: flex;\n}\n\n.bAyXAa_quotaMeterName {\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  min-width: 0;\n  color: var(--dsw-alias-label-primary, inherit);\n  font-size: 12.5px;\n  font-weight: 500;\n  overflow: hidden;\n}\n\n.bAyXAa_quotaMeterMeta {\n  min-width: 0;\n  color: var(--dsw-alias-label-tertiary, var(--u-text-3));\n  align-items: center;\n  gap: 6px;\n  font-size: 11px;\n  display: inline-flex;\n}\n\n.bAyXAa_quotaMeterBars {\n  flex-direction: column;\n  gap: 14px;\n  display: flex;\n}\n\n.bAyXAa_quotaMeterBarRow {\n  flex-direction: column;\n  gap: 5px;\n  display: flex;\n}\n\n.bAyXAa_quotaMeterBarHead {\n  color: var(--dsw-alias-label-secondary, inherit);\n  justify-content: space-between;\n  align-items: baseline;\n  gap: 10px;\n  font-size: 12px;\n  display: flex;\n}\n\n.bAyXAa_quotaMeterBarPct {\n  font-family: var(--u-mono);\n  font-variant-numeric: tabular-nums;\n  color: var(--dsw-alias-label-primary, inherit);\n  font-weight: 500;\n}\n\n.bAyXAa_quotaMeterReset {\n  color: var(--dsw-alias-label-tertiary, var(--u-text-3));\n  font-variant-numeric: tabular-nums;\n  font-size: 10.5px;\n  font-weight: 400;\n}\n\n.bAyXAa_quotaMeterFoot {\n  border-top: 1px solid var(--dsw-alias-border-l3, var(--u-line));\n  color: var(--dsw-alias-label-tertiary, var(--u-text-3));\n  margin-top: 14px;\n  padding-top: 10px;\n  font-size: 10.5px;\n  line-height: 1.5;\n}\n\n.bAyXAa_quotaMeterPanel .bAyXAa_bar {\n  background: color-mix(in srgb, currentColor 10%, transparent);\n}\n\n@media (width <= 1180px) {\n  .bAyXAa_cockpit {\n    grid-template-columns: repeat(6, minmax(0, 1fr));\n  }\n\n  .bAyXAa_cell5, .bAyXAa_cell7, .bAyXAa_cell12 {\n    grid-column: span 6;\n  }\n\n  .bAyXAa_hero {\n    grid-template-columns: minmax(0, 1fr) auto;\n  }\n\n  .bAyXAa_heroToday {\n    grid-area: 1 / 1;\n  }\n\n  .bAyXAa_heroRing {\n    grid-area: 1 / 2;\n  }\n\n  .bAyXAa_statGroup {\n    border-left: 0;\n    border-top: 1px solid var(--u-line);\n    grid-area: 2 / 1 / auto / -1;\n    grid-template-columns: repeat(4, minmax(0, 1fr));\n    padding: 16px 0 0;\n  }\n\n  .bAyXAa_heatmapSide {\n    padding-left: 20px;\n  }\n}\n\n@media (width <= 900px) {\n  .bAyXAa_historyGrid {\n    grid-template-columns: minmax(0, 1fr);\n  }\n\n  .bAyXAa_historyGrid .bAyXAa_historyRow:nth-child(2) {\n    border-top: 1px solid var(--u-line);\n  }\n\n  .bAyXAa_chartModel {\n    grid-template-columns: minmax(0, 1fr) auto auto;\n  }\n\n  .bAyXAa_chartModelBar {\n    display: none;\n  }\n}\n\n@media (width <= 720px) {\n  .bAyXAa_pageHead {\n    flex-direction: column;\n    align-items: stretch;\n    gap: 12px;\n  }\n\n  .bAyXAa_headActions {\n    justify-content: space-between;\n  }\n\n  .bAyXAa_cockpit {\n    grid-template-columns: minmax(0, 1fr);\n  }\n\n  .bAyXAa_cell5, .bAyXAa_cell7, .bAyXAa_cell12 {\n    grid-column: span 1;\n  }\n\n  .bAyXAa_hero {\n    grid-template-columns: minmax(0, 1fr);\n    gap: 16px;\n    padding: 20px;\n  }\n\n  .bAyXAa_heroToday {\n    grid-area: auto;\n    gap: 4px;\n  }\n\n  .bAyXAa_heroValue {\n    font-size: 34px;\n  }\n\n  .bAyXAa_heroRing {\n    flex-direction: row;\n    grid-area: auto;\n    justify-content: flex-start;\n    align-items: center;\n    gap: 16px;\n  }\n\n  .bAyXAa_statGroup {\n    grid-area: auto;\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n    gap: 12px 16px;\n  }\n\n  .bAyXAa_heatmapLayout {\n    gap: 16px;\n  }\n\n  .bAyXAa_heatmapSide {\n    border-left: 0;\n    border-top: 1px solid var(--u-line);\n    flex-flow: wrap;\n    gap: 12px 24px;\n    width: 100%;\n    margin-left: 0;\n    padding: 16px 0 0;\n  }\n\n  .bAyXAa_settingRow {\n    grid-template-columns: minmax(0, 1fr);\n    gap: 6px;\n  }\n\n  .bAyXAa_settingRow > :last-child:not(:only-child) {\n    justify-self: start;\n  }\n\n  .bAyXAa_settingRow input[type=\"number\"], .bAyXAa_settingRow select {\n    width: 100%;\n    max-width: none;\n  }\n}\n\n@media (width <= 520px) {\n  .bAyXAa_section {\n    --hm-cell: 10px;\n    --hm-gap: 2px;\n  }\n\n  .bAyXAa_heatmapLabels {\n    display: none;\n  }\n\n  .bAyXAa_heatmapMonths {\n    font-size: 9px;\n  }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .bAyXAa_spinner, .bAyXAa_iconSpin, .bAyXAa_quotaMeterPanel {\n    animation: none;\n  }\n}\n";document.head.appendChild(tag);})();
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
let _deepseek_ai_dsh_client_store = require("@deepseek-ai/dsh-client-store");
let react = require("react");
let react_jsx_runtime = require("react/jsx-runtime");
//#region src/client/usage-store.ts
/**
* Browser-side usage store: the overview snapshot polled from the host plus
* the fetch lifecycle. Section-local: the store lives while the settings
* section is mounted, so polling only runs while the page is open.
* @module @linxin666/dsh-usage/client/usage-store
*/
/** Create the usage store handle (apply world only; never module-level). */
function createUsageStore() {
	return (0, _deepseek_ai_dsh_client_store.defineStore)({
		init: () => ({
			snapshot: null,
			status: "loading",
			error: null
		}),
		actions: {
			setSnapshot: (draft, snapshot) => {
				draft.snapshot = snapshot;
				draft.status = "ready";
				draft.error = null;
			},
			setState: (draft, status, error) => {
				draft.status = status;
				draft.error = error;
			}
		}
	});
}
//#endregion
//#region src/client/locales.ts
/**
* dsh-usage locale dictionaries (zh/en). The zh dictionary is the key source;
* `en` mirrors its full key set (packages/AGENTS.md bilingual discipline).
* @module @linxin666/dsh-usage/client/locales
*/
/** Dictionary namespace this package registers. */
const NS = "dsh-usage-plus";
/** Chinese copy. */
const zh = {
	"usage.title": "使用统计",
	"usage.intro": "今日用量、套餐额度与外部数据源（CPAMC / 火山方舟）。",
	"usage.tab.usage": "概览",
	"usage.tab.plans": "套餐额度",
	"usage.tab.settings": "设置",
	"usage.refresh": "刷新",
	"usage.refreshing": "刷新中…",
	"usage.retry": "重试",
	"usage.updated": "更新于 {time}",
	"usage.loading": "正在加载用量数据…",
	"usage.error": "加载失败：{error}",
	"usage.disabled": "插件已停用：在「插件 → 使用统计」中启用即可恢复。",
	"usage.current": "当前",
	"usage.today": "今日用量",
	"usage.scope.device": "全设备",
	"usage.scope.account": "账号级",
	"usage.scope.session": "本会话",
	"usage.scope.note.usage": "全设备累计；逐轮明细见会话的 轨迹 / 统计 视图",
	"usage.scope.note.plans": "账号级额度，跨会话共享；当前模型的额度也会显示在输入框下方",
	"usage.scope.note.settings": "插件配置，对所有会话生效",
	"usage.today.cost": "今日消费",
	"usage.today.breakdown": "按提供方",
	"usage.hero.today": "今日消费",
	"usage.hero.month": "近 30 天消费",
	"usage.hero.tokens": "今日 Tokens",
	"usage.summary.today": "今日",
	"usage.summary.month": "近 30 天",
	"usage.summary.all": "累计",
	"usage.summary.cost": "费用",
	"usage.summary.tokens": "Tokens",
	"usage.summary.calls": "调用",
	"usage.metric.month": "近 30 天",
	"usage.metric.avgCost": "平均成本",
	"usage.cockpit.vsYesterday": "较昨日 {pct}",
	"usage.vsYesterday": "较昨日",
	"usage.metric.avgCostHint": "按 {n} 次调用",
	"usage.metric.unpriced": "该供应商未提供单价",
	"usage.metric.models": "{n} 个模型明细",
	"usage.peak.on": "高峰计价 ×2 · {time} 结束",
	"usage.peak.off": "空闲计价 · {time} 进入高峰",
	"usage.calls": "{n} 次调用",
	"usage.tokens.total": "Tokens",
	"usage.tokens.input": "输入",
	"usage.tokens.output": "输出",
	"usage.tokens.cacheRead": "缓存读",
	"usage.tokens.cacheWrite": "缓存写",
	"usage.tokens.reasoning": "推理",
	"usage.tokens.calls": "调用",
	"usage.tokens.cacheHit": "缓存命中率",
	"usage.tokens.detail": "入 {input} · 出 {output}",
	"usage.tokens.cacheRatio": "{read} / {billed}",
	"usage.tokens.buckets": "Token 分桶",
	"usage.expand": "展开模型",
	"usage.collapse": "收起",
	"usage.heatmap": "近 26 周活动",
	"usage.heatmap.weeks": "26 周 · 周一至周日",
	"usage.heatmap.empty": "暂无按日活动",
	"usage.heatmap.day": "{date} · {tokens} · {calls}{cost}",
	"usage.heatmap.activeDays": "活跃天数",
	"usage.heatmap.busiest": "单日峰值",
	"usage.heatmap.week": "近 7 天",
	"usage.heatmap.dow.mon": "一",
	"usage.heatmap.dow.wed": "三",
	"usage.heatmap.dow.fri": "五",
	"usage.heatmap.less": "少",
	"usage.heatmap.more": "多",
	"usage.history": "按日历史",
	"usage.history.show": "展开最近 14 天",
	"usage.history.hide": "收起",
	"usage.history.empty": "暂无历史",
	"usage.trend": "近 30 天",
	"usage.trend.summary": "{tokens} · {calls}",
	"usage.noData": "暂无用量数据（统计自插件启用起）",
	"usage.balance": "账户余额",
	"usage.balance.empty": "暂无余额数据",
	"usage.balance.ok": "余额正常",
	"usage.balance.low": "余额偏低",
	"usage.balance.unsupported": "暂不支持余额查询",
	"usage.balance.noCredential": "未配置凭据",
	"usage.balance.noneConfigured": "没有已配置的提供方",
	"usage.balance.error": "查询失败",
	"usage.oauth": "OAuth 凭据，不做余额查询",
	"usage.plan.preview": "当前套餐",
	"usage.plan.quota": "额度",
	"usage.plan.seeAll": "查看全部",
	"usage.plan.reset": "{date} 重置",
	"usage.plan.reset.soon": "即将重置",
	"usage.plan.reset.inHours": "{n} 小时后重置",
	"usage.plan.reset.inDays": "{n} 天后重置",
	"usage.plan.noPlan": "未检测到套餐数据",
	"usage.plan.emptyHint": "当前模型未匹配到账号套餐，前往「套餐额度」查看已配置的额度源。",
	"usage.plan.quota.tightest": "环形显示当前最紧的窗口",
	"usage.plan.noneConfigured": "没有已配置的套餐类 provider（如 Kimi、GLM、OpenCode Go、MiniMax、Codex 订阅）",
	"usage.plan.groupEmpty": "本组暂无数据",
	"usage.plan.groupCount": "{title}（{n}）",
	"usage.plan.windows.5h": "5 小时",
	"usage.plan.windows.5h.short": "5h",
	"usage.plan.windows.week": "每周",
	"usage.plan.windows.week.short": "周",
	"usage.plan.windows.month": "每月",
	"usage.plan.windows.month.short": "月",
	"usage.plan.group.models": "模型配置自动查询",
	"usage.plan.group.cpamc": "CPAMC · CLI Proxy API 管理控制台",
	"usage.plan.group.volcano": "火山方舟",
	"usage.plan.source.model": "模型",
	"usage.plan.source.cpamc": "CPAMC",
	"usage.plan.source.volcano": "火山",
	"usage.provider.error": "查询失败：{error}",
	"usage.errorListSeparator": "；",
	"usage.config.title": "插件设置",
	"usage.config.basic": "基础",
	"usage.config.display": "显示",
	"usage.config.external": "外部额度源",
	"usage.config.enabled": "启用插件",
	"usage.config.pollIntervalSec": "轮询间隔（秒）",
	"usage.config.bubbleMode": "悬浮气泡",
	"usage.config.bubbleMode.always": "常驻显示",
	"usage.config.bubbleMode.change": "仅变化时",
	"usage.config.bubbleMode.off": "关闭",
	"usage.config.cpamc": "启用 CPAMC 独立额度源",
	"usage.config.cpamcUrl": "CPAMC 管理地址",
	"usage.config.cpamcUrl.placeholder": "http://127.0.0.1:8317",
	"usage.config.cpamcUrl.invalid": "须为本机回环地址，或在 cpamcAllowedHosts 白名单内的主机（仅 origin，无路径），例如 http://127.0.0.1:8317。请勿填写聊天 API 网关。",
	"usage.config.cpamcToken": "CPAMC Management Token",
	"usage.config.cpamcAllowedHosts": "CPAMC 允许的 host（逗号分隔）",
	"usage.config.volcano": "启用火山方舟独立额度源",
	"usage.config.volcanoAk": "火山 Access Key (AK)",
	"usage.config.volcanoSk": "火山 Secret Key (SK)",
	"usage.config.secret.configured": "已配置",
	"usage.config.secret.missing": "未配置",
	"usage.config.secret.placeholder": "输入密钥后保存",
	"usage.config.secret.replace": "输入新密钥以覆盖",
	"usage.config.secret.save": "保存",
	"usage.config.secret.clear": "清除",
	"usage.config.externalHint": "密钥写入 DSH 凭据库（不明文落盘）。也可预先设置环境变量 CPAMC_MANAGEMENT_KEY、VOLC_ACCESSKEY、VOLC_SECRETKEY。CPAMC 仅允许本机 loopback 地址。",
	"usage.config.readonly": "当前配置为只读，请在宿主配置文件中修改。",
	"usage.config.save": "保存",
	"usage.config.saving": "保存中…",
	"usage.config.discard": "放弃",
	"usage.config.saveFailed": "保存失败，请重试。"
};
/** English mirror; every zh key present. */
const en = {
	"usage.title": "Usage Statistics",
	"usage.intro": "Today’s usage, plan quotas, and external sources (CPAMC / Volcano).",
	"usage.tab.usage": "Overview",
	"usage.tab.plans": "Plan quotas",
	"usage.tab.settings": "Settings",
	"usage.refresh": "Refresh",
	"usage.refreshing": "Refreshing…",
	"usage.retry": "Retry",
	"usage.updated": "Updated {time}",
	"usage.loading": "Loading usage data…",
	"usage.error": "Failed to load: {error}",
	"usage.disabled": "Plugin disabled. Re-enable it under Plugins → Usage Statistics.",
	"usage.current": "Current",
	"usage.today": "Today",
	"usage.scope.device": "This device",
	"usage.scope.account": "Account",
	"usage.scope.session": "This session",
	"usage.scope.note.usage": "Device-wide totals; per-turn detail lives in the conversation Trajectory / Stats views",
	"usage.scope.note.plans": "Account-level quota shared across sessions; the current model's windows also appear under the composer",
	"usage.scope.note.settings": "Plugin configuration, applies to every session",
	"usage.today.cost": "Today spend",
	"usage.today.breakdown": "By provider",
	"usage.hero.today": "Today spend",
	"usage.hero.month": "30-day spend",
	"usage.hero.tokens": "Today tokens",
	"usage.summary.today": "Today",
	"usage.summary.month": "Last 30 days",
	"usage.summary.all": "All time",
	"usage.summary.cost": "Spend",
	"usage.summary.tokens": "Tokens",
	"usage.summary.calls": "Calls",
	"usage.metric.month": "Last 30 days",
	"usage.metric.avgCost": "Avg cost",
	"usage.metric.avgCostHint": "across {n} calls",
	"usage.cockpit.vsYesterday": "vs yesterday {pct}",
	"usage.vsYesterday": "vs yesterday",
	"usage.metric.unpriced": "No unit price from this provider",
	"usage.metric.models": "{n} model rows",
	"usage.peak.on": "Peak pricing ×2 · ends {time}",
	"usage.peak.off": "Off-peak pricing · peak returns {time}",
	"usage.calls": "{n} calls",
	"usage.tokens.total": "Tokens",
	"usage.tokens.input": "Input",
	"usage.tokens.output": "Output",
	"usage.tokens.cacheRead": "Cache read",
	"usage.tokens.cacheWrite": "Cache write",
	"usage.tokens.reasoning": "Reasoning",
	"usage.tokens.calls": "Calls",
	"usage.tokens.cacheHit": "Cache hit",
	"usage.tokens.detail": "In {input} · Out {output}",
	"usage.tokens.cacheRatio": "{read} / {billed}",
	"usage.tokens.buckets": "Token buckets",
	"usage.expand": "Expand models",
	"usage.collapse": "Collapse",
	"usage.heatmap": "Last 26 weeks activity",
	"usage.heatmap.weeks": "26 weeks · Mon–Sun",
	"usage.heatmap.empty": "No daily activity yet",
	"usage.heatmap.day": "{date} · {tokens} · {calls}{cost}",
	"usage.heatmap.activeDays": "Active days",
	"usage.heatmap.busiest": "Busiest day",
	"usage.heatmap.week": "Last 7 days",
	"usage.heatmap.dow.mon": "Mon",
	"usage.heatmap.dow.wed": "Wed",
	"usage.heatmap.dow.fri": "Fri",
	"usage.heatmap.less": "Less",
	"usage.heatmap.more": "More",
	"usage.history": "Daily history",
	"usage.history.show": "Show last 14 days",
	"usage.history.hide": "Hide",
	"usage.history.empty": "No history yet",
	"usage.trend": "Last 30 days",
	"usage.trend.summary": "{tokens} · {calls}",
	"usage.noData": "No usage data yet (counting starts when the plugin is enabled)",
	"usage.balance": "Balances",
	"usage.balance.empty": "No balance data",
	"usage.balance.ok": "Healthy",
	"usage.balance.low": "Running low",
	"usage.balance.unsupported": "Balance query not supported",
	"usage.balance.noCredential": "No credential configured",
	"usage.balance.noneConfigured": "No providers configured",
	"usage.balance.error": "Query failed",
	"usage.oauth": "OAuth credential, no balance query",
	"usage.plan.preview": "Current plan",
	"usage.plan.quota": "Quota",
	"usage.plan.seeAll": "See all",
	"usage.plan.reset": "resets {date}",
	"usage.plan.reset.soon": "Resets soon",
	"usage.plan.reset.inHours": "Resets in {n}h",
	"usage.plan.reset.inDays": "Resets in {n}d",
	"usage.plan.noPlan": "No plan data detected",
	"usage.plan.emptyHint": "No account plan matched this model. Open Plan quotas to see the configured sources.",
	"usage.plan.quota.tightest": "The ring tracks the tightest window",
	"usage.plan.noneConfigured": "No plan-capable provider configured (such as Kimi, GLM, OpenCode Go, MiniMax, Codex subscription)",
	"usage.plan.groupEmpty": "Nothing in this group yet",
	"usage.plan.groupCount": "{title} ({n})",
	"usage.plan.windows.5h": "5 hours",
	"usage.plan.windows.5h.short": "5h",
	"usage.plan.windows.week": "Weekly",
	"usage.plan.windows.week.short": "Wk",
	"usage.plan.windows.month": "Monthly",
	"usage.plan.windows.month.short": "Mo",
	"usage.plan.group.models": "Automatic model-provider queries",
	"usage.plan.group.cpamc": "CPAMC · CLI Proxy API console",
	"usage.plan.group.volcano": "Volcano Ark",
	"usage.plan.source.model": "Model",
	"usage.plan.source.cpamc": "CPAMC",
	"usage.plan.source.volcano": "Volcano",
	"usage.provider.error": "Query failed: {error}",
	"usage.errorListSeparator": "; ",
	"usage.config.title": "Plugin settings",
	"usage.config.basic": "Basics",
	"usage.config.display": "Display",
	"usage.config.external": "External quota sources",
	"usage.config.enabled": "Enable plugin",
	"usage.config.pollIntervalSec": "Poll interval (seconds)",
	"usage.config.bubbleMode": "Floating bubble",
	"usage.config.bubbleMode.always": "Always visible",
	"usage.config.bubbleMode.change": "On change",
	"usage.config.bubbleMode.off": "Off",
	"usage.config.cpamc": "Enable the CPAMC quota source",
	"usage.config.cpamcUrl": "CPAMC management URL",
	"usage.config.cpamcUrl.placeholder": "http://127.0.0.1:8317",
	"usage.config.cpamcUrl.invalid": "Must be a loopback origin or a host listed in cpamcAllowedHosts (no path), e.g. http://127.0.0.1:8317. Do not paste a chat API gateway URL.",
	"usage.config.cpamcToken": "CPAMC management token",
	"usage.config.cpamcAllowedHosts": "CPAMC allowed hosts (comma-separated)",
	"usage.config.volcano": "Enable the Volcano Ark quota source",
	"usage.config.volcanoAk": "Volcano Access Key (AK)",
	"usage.config.volcanoSk": "Volcano Secret Key (SK)",
	"usage.config.secret.configured": "Configured",
	"usage.config.secret.missing": "Missing",
	"usage.config.secret.placeholder": "Enter a secret, then save",
	"usage.config.secret.replace": "Enter a new secret to replace",
	"usage.config.secret.save": "Save",
	"usage.config.secret.clear": "Clear",
	"usage.config.externalHint": "Secrets are stored in the DSH credential vault (never written into config). You can also pre-set CPAMC_MANAGEMENT_KEY, VOLC_ACCESSKEY, and VOLC_SECRETKEY. CPAMC accepts loopback URLs only.",
	"usage.config.readonly": "Settings are read-only. Edit the host config file instead.",
	"usage.config.save": "Save",
	"usage.config.saving": "Saving…",
	"usage.config.discard": "Discard",
	"usage.config.saveFailed": "Save failed. Please try again."
};
/**
* Active dictionary, picked by the document language at call time. The
* section resolves its copy the same tiny way the pet's DOM-injected surface
* does (the settings section has no framework locale seat of its own).
*/
function dictionary() {
	return (typeof document !== "undefined" ? document.documentElement.lang : "zh").toLowerCase().startsWith("en") ? en : zh;
}
/** Translate a key with optional `{name}` template params; missing keys degrade to the key. */
function t(key, params) {
	let text = dictionary()[key] ?? key;
	if (params !== void 0) for (const [name, value] of Object.entries(params)) text = text.replaceAll(`{${name}}`, String(value));
	return text;
}
/** Relative plan-window reset copy; falls back to absolute locale string. */
function formatPlanReset(iso) {
	if (iso === void 0 || iso === "") return "—";
	const target = new Date(iso).getTime();
	if (Number.isNaN(target)) return "—";
	const delta = target - Date.now();
	if (delta <= 0) return t("usage.plan.reset.soon");
	const hours = Math.round(delta / 36e5);
	if (hours < 48) return t("usage.plan.reset.inHours", { n: Math.max(1, hours) });
	const days = Math.round(delta / 864e5);
	return t("usage.plan.reset.inDays", { n: Math.max(1, days) });
}
/** Same origin rule as host `cpamcOrigin` (no path/userinfo/query), plus the allowlist. */
function isCpamcLoopbackUrl(raw, allowedHosts) {
	try {
		const url = new URL(raw);
		if (url.username || url.password || url.search || url.hash || url.pathname !== "/") return false;
		const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
		const allowed = String(allowedHosts ?? "").split(",").map((item) => item.trim().toLowerCase()).filter((item) => item !== "");
		if (!loopback && !allowed.includes(url.hostname.toLowerCase())) return false;
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
}
/** Map host probe errors to actionable UI copy when we recognize them. */
function friendlyProbeError(error) {
	if (error === void 0 || error === "") return void 0;
	if (/loopback/i.test(error)) return t("usage.config.cpamcUrl.invalid");
	return error;
}
//#endregion
//#region src/client/usage.module.css
var usage_module_default = {
	"balanceAmount": "bAyXAa_balanceAmount",
	"balanceHint": "bAyXAa_balanceHint",
	"balanceInline": "bAyXAa_balanceInline",
	"balanceLead": "bAyXAa_balanceLead",
	"balanceMeta": "bAyXAa_balanceMeta",
	"balanceRow": "bAyXAa_balanceRow",
	"bar": "bAyXAa_bar",
	"barFill": "bAyXAa_barFill",
	"barLow": "bAyXAa_barLow",
	"barWarn": "bAyXAa_barWarn",
	"card": "bAyXAa_card",
	"cardHead": "bAyXAa_cardHead",
	"cardHeadGroup": "bAyXAa_cardHeadGroup",
	"cardMeta": "bAyXAa_cardMeta",
	"cardTitle": "bAyXAa_cardTitle",
	"cell": "bAyXAa_cell",
	"cell12": "bAyXAa_cell12",
	"cell5": "bAyXAa_cell5",
	"cell7": "bAyXAa_cell7",
	"chart": "bAyXAa_chart",
	"chartBar": "bAyXAa_chartBar",
	"chartFill": "bAyXAa_chartFill",
	"chartHead": "bAyXAa_chartHead",
	"chartLead": "bAyXAa_chartLead",
	"chartMeta": "bAyXAa_chartMeta",
	"chartModel": "bAyXAa_chartModel",
	"chartModelBar": "bAyXAa_chartModelBar",
	"chartModelFill": "bAyXAa_chartModelFill",
	"chartModelName": "bAyXAa_chartModelName",
	"chartModelTokens": "bAyXAa_chartModelTokens",
	"chartModelValue": "bAyXAa_chartModelValue",
	"chartName": "bAyXAa_chartName",
	"chartRow": "bAyXAa_chartRow",
	"chartShare": "bAyXAa_chartShare",
	"cockpit": "bAyXAa_cockpit",
	"composition": "bAyXAa_composition",
	"compositionHead": "bAyXAa_compositionHead",
	"configActions": "bAyXAa_configActions",
	"currentBadge": "bAyXAa_currentBadge",
	"delta": "bAyXAa_delta",
	"deltaLabel": "bAyXAa_deltaLabel",
	"deltaValue": "bAyXAa_deltaValue",
	"dim": "bAyXAa_dim",
	"emptyAction": "bAyXAa_emptyAction",
	"emptyBody": "bAyXAa_emptyBody",
	"emptyHint": "bAyXAa_emptyHint",
	"emptyState": "bAyXAa_emptyState",
	"emptyTitle": "bAyXAa_emptyTitle",
	"errorLine": "bAyXAa_errorLine",
	"freshness": "bAyXAa_freshness",
	"freshnessDot": "bAyXAa_freshnessDot",
	"gauge": "bAyXAa_gauge",
	"gaugeLabel": "bAyXAa_gaugeLabel",
	"gaugesRow": "bAyXAa_gaugesRow",
	"gaugeSub": "bAyXAa_gaugeSub",
	"groupEmpty": "bAyXAa_groupEmpty",
	"groupTitle": "bAyXAa_groupTitle",
	"headActions": "bAyXAa_headActions",
	"heatmapBody": "bAyXAa_heatmapBody",
	"heatmapCell": "bAyXAa_heatmapCell",
	"heatmapCorner": "bAyXAa_heatmapCorner",
	"heatmapDow": "bAyXAa_heatmapDow",
	"heatmapGrid": "bAyXAa_heatmapGrid",
	"heatmapLabels": "bAyXAa_heatmapLabels",
	"heatmapLayout": "bAyXAa_heatmapLayout",
	"heatmapLeft": "bAyXAa_heatmapLeft",
	"heatmapLegend": "bAyXAa_heatmapLegend",
	"heatmapMain": "bAyXAa_heatmapMain",
	"heatmapMonth": "bAyXAa_heatmapMonth",
	"heatmapMonths": "bAyXAa_heatmapMonths",
	"heatmapSide": "bAyXAa_heatmapSide",
	"heatmapToday": "bAyXAa_heatmapToday",
	"hero": "bAyXAa_hero",
	"heroFigure": "bAyXAa_heroFigure",
	"heroHint": "bAyXAa_heroHint",
	"heroLabel": "bAyXAa_heroLabel",
	"heroRing": "bAyXAa_heroRing",
	"heroRingHint": "bAyXAa_heroRingHint",
	"heroRingLabel": "bAyXAa_heroRingLabel",
	"heroToday": "bAyXAa_heroToday",
	"heroValue": "bAyXAa_heroValue",
	"historyBar": "bAyXAa_historyBar",
	"historyCalls": "bAyXAa_historyCalls",
	"historyDate": "bAyXAa_historyDate",
	"historyGrid": "bAyXAa_historyGrid",
	"historyRow": "bAyXAa_historyRow",
	"historyTokens": "bAyXAa_historyTokens",
	"icon": "bAyXAa_icon",
	"iconOpen": "bAyXAa_iconOpen",
	"iconSpacer": "bAyXAa_iconSpacer",
	"iconSpin": "bAyXAa_iconSpin",
	"identityBalance": "bAyXAa_identityBalance",
	"identityName": "bAyXAa_identityName",
	"legend": "bAyXAa_legend",
	"legendDot": "bAyXAa_legendDot",
	"legendItem": "bAyXAa_legendItem",
	"legendLabel": "bAyXAa_legendLabel",
	"legendValue": "bAyXAa_legendValue",
	"linkBtn": "bAyXAa_linkBtn",
	"modelMeta": "bAyXAa_modelMeta",
	"modelName": "bAyXAa_modelName",
	"modelRow": "bAyXAa_modelRow",
	"modelShare": "bAyXAa_modelShare",
	"mono": "bAyXAa_mono",
	"muted": "bAyXAa_muted",
	"pageHead": "bAyXAa_pageHead",
	"pageHeadMain": "bAyXAa_pageHeadMain",
	"pageIdentity": "bAyXAa_pageIdentity",
	"peakPill": "bAyXAa_peakPill",
	"planCard": "bAyXAa_planCard",
	"planCards": "bAyXAa_planCards",
	"planGroup": "bAyXAa_planGroup",
	"planHead": "bAyXAa_planHead",
	"planName": "bAyXAa_planName",
	"plans": "bAyXAa_plans",
	"planTier": "bAyXAa_planTier",
	"providerBalance": "bAyXAa_providerBalance",
	"providerBlock": "bAyXAa_providerBlock",
	"providerDot": "bAyXAa_providerDot",
	"providerFill": "bAyXAa_providerFill",
	"providerLead": "bAyXAa_providerLead",
	"providerList": "bAyXAa_providerList",
	"providerMeta": "bAyXAa_providerMeta",
	"providerName": "bAyXAa_providerName",
	"providerRow": "bAyXAa_providerRow",
	"providerShare": "bAyXAa_providerShare",
	"providerTokens": "bAyXAa_providerTokens",
	"providerTrack": "bAyXAa_providerTrack",
	"quotaCard": "bAyXAa_quotaCard",
	"quotaIdentity": "bAyXAa_quotaIdentity",
	"quotaMeter": "bAyXAa_quotaMeter",
	"quotaMeterBarHead": "bAyXAa_quotaMeterBarHead",
	"quotaMeterBarPct": "bAyXAa_quotaMeterBarPct",
	"quotaMeterBarRow": "bAyXAa_quotaMeterBarRow",
	"quotaMeterBars": "bAyXAa_quotaMeterBars",
	"quotaMeterDanger": "bAyXAa_quotaMeterDanger",
	"quotaMeterFill": "bAyXAa_quotaMeterFill",
	"quotaMeterFoot": "bAyXAa_quotaMeterFoot",
	"quotaMeterHeader": "bAyXAa_quotaMeterHeader",
	"quotaMeterIdentity": "bAyXAa_quotaMeterIdentity",
	"quotaMeterLabel": "bAyXAa_quotaMeterLabel",
	"quotaMeterMeta": "bAyXAa_quotaMeterMeta",
	"quotaMeterName": "bAyXAa_quotaMeterName",
	"quotaMeterPanel": "bAyXAa_quotaMeterPanel",
	"quotaMeterReading": "bAyXAa_quotaMeterReading",
	"quotaMeterReset": "bAyXAa_quotaMeterReset",
	"quotaMeterTrack": "bAyXAa_quotaMeterTrack",
	"quotaMeterTrigger": "bAyXAa_quotaMeterTrigger",
	"quotaMeterWarn": "bAyXAa_quotaMeterWarn",
	"refreshBtn": "bAyXAa_refreshBtn",
	"resetLine": "bAyXAa_resetLine",
	"ringBox": "bAyXAa_ringBox",
	"ringFill": "bAyXAa_ringFill",
	"ringSvg": "bAyXAa_ringSvg",
	"ringTrack": "bAyXAa_ringTrack",
	"ringValue": "bAyXAa_ringValue",
	"scopeChip": "bAyXAa_scopeChip",
	"scopeNote": "bAyXAa_scopeNote",
	"secretControls": "bAyXAa_secretControls",
	"secretField": "bAyXAa_secretField",
	"secretStatus": "bAyXAa_secretStatus",
	"section": "bAyXAa_section",
	"segCache": "bAyXAa_segCache",
	"segInput": "bAyXAa_segInput",
	"segOutput": "bAyXAa_segOutput",
	"segReasoning": "bAyXAa_segReasoning",
	"segWrite": "bAyXAa_segWrite",
	"settingHint": "bAyXAa_settingHint",
	"settingRow": "bAyXAa_settingRow",
	"settingsForm": "bAyXAa_settingsForm",
	"settingsSection": "bAyXAa_settingsSection",
	"settingWarn": "bAyXAa_settingWarn",
	"sideHint": "bAyXAa_sideHint",
	"sideLabel": "bAyXAa_sideLabel",
	"sideStat": "bAyXAa_sideStat",
	"sideUnit": "bAyXAa_sideUnit",
	"sideValue": "bAyXAa_sideValue",
	"sourceChip": "bAyXAa_sourceChip",
	"spinner": "bAyXAa_spinner",
	"stackBar": "bAyXAa_stackBar",
	"stackEmpty": "bAyXAa_stackEmpty",
	"stackSeg": "bAyXAa_stackSeg",
	"stat": "bAyXAa_stat",
	"stateBody": "bAyXAa_stateBody",
	"stateCard": "bAyXAa_stateCard",
	"stateDetail": "bAyXAa_stateDetail",
	"stateIcon": "bAyXAa_stateIcon",
	"stateTitle": "bAyXAa_stateTitle",
	"statGroup": "bAyXAa_statGroup",
	"statHint": "bAyXAa_statHint",
	"statLabel": "bAyXAa_statLabel",
	"statusDot": "bAyXAa_statusDot",
	"statusOk": "bAyXAa_statusOk",
	"statusWarn": "bAyXAa_statusWarn",
	"statValue": "bAyXAa_statValue",
	"subTitle": "bAyXAa_subTitle",
	"tab": "bAyXAa_tab",
	"tabActive": "bAyXAa_tabActive",
	"tabs": "bAyXAa_tabs",
	"toneAccent": "bAyXAa_toneAccent",
	"toneBad": "bAyXAa_toneBad",
	"toneGood": "bAyXAa_toneGood",
	"toneWarn": "bAyXAa_toneWarn",
	"toolbar": "bAyXAa_toolbar",
	"trendAxis": "bAyXAa_trendAxis",
	"u-pop-in": "bAyXAa_u-pop-in",
	"u-spin": "bAyXAa_u-spin",
	"windowLabel": "bAyXAa_windowLabel",
	"windowRow": "bAyXAa_windowRow"
};
//#endregion
//#region src/core/adapters.ts
/** Parse a string/number into a finite number, else undefined. */
function toNum(value) {
	if (typeof value === "number") return Number.isFinite(value) ? value : void 0;
	if (typeof value === "string" && value.trim() !== "") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : void 0;
	}
}
/** Read a string field that must be a non-empty string. */
function str(value) {
	return typeof value === "string" && value.trim() !== "" ? value.trim() : void 0;
}
/** Format a number to a fixed 2-decimal display string. */
function money(value) {
	return value.toFixed(2);
}
/** Millisecond epoch or ISO string → normalized ISO 8601, else undefined. */
function toIso(value) {
	if (typeof value === "number" && Number.isFinite(value) && value > 0) {
		const ms = value < 0xe8d4a51000 ? value * 1e3 : value;
		const date = new Date(ms);
		return Number.isNaN(date.getTime()) ? void 0 : date.toISOString();
	}
	const text = str(value);
	if (text === void 0) return void 0;
	if (/^\d+$/.test(text)) return toIso(Number(text));
	const date = new Date(text);
	return Number.isNaN(date.getTime()) ? void 0 : date.toISOString();
}
/** Used-percent helper guarding zero/absent limits. */
function usedPercent(used, limit) {
	const usedNum = toNum(used);
	const limitNum = toNum(limit);
	if (usedNum === void 0 || limitNum === void 0 || limitNum <= 0) return void 0;
	return Math.max(0, Math.min(100, usedNum / limitNum * 100));
}
function bearer(apiKey) {
	return { authorization: `Bearer ${apiKey}` };
}
/**
* The official pay-as-you-go balance. `deepseek` is the configurable-catalog
* route key; `deepseek-official` is the live provider route the llm-deepseek
* adapter registers (sessions and agent-default-model carry it), so both ids
* must resolve here or the current provider would never be probed.
*/
const DEEPSEEK = {
	ids: ["deepseek", "deepseek-official"],
	displayName: "DeepSeek",
	balance: {
		build: ({ apiKey }) => ({
			url: "https://api.deepseek.com/user/balance",
			headers: bearer(apiKey)
		}),
		parse: (status, body) => {
			if (status !== 200 || typeof body !== "object" || body === null) return void 0;
			const infos = body.balance_infos;
			if (!Array.isArray(infos) || infos.length === 0) return void 0;
			const first = infos[0];
			if (typeof first !== "object" || first === null) return void 0;
			const currency = str(first.currency);
			const total = str(first.total_balance);
			if (currency === void 0 || total === void 0) return void 0;
			return {
				currency,
				totalBalance: total
			};
		}
	}
};
/** Moonshot pay-as-you-go balance; CN bills in CNY, international in USD. */
function moonshotBalance(host, currency, ids) {
	return {
		ids,
		displayName: "Moonshot AI",
		balance: {
			build: ({ apiKey }) => ({
				url: `https://${host}/v1/users/me/balance`,
				headers: bearer(apiKey)
			}),
			parse: (status, body) => {
				if (status !== 200 || typeof body !== "object" || body === null) return void 0;
				const data = body.data;
				if (typeof data !== "object" || data === null) return void 0;
				const available = toNum(data.available_balance);
				if (available === void 0) return void 0;
				return {
					currency,
					totalBalance: money(available)
				};
			}
		}
	};
}
/** Kimi For Coding quota: top-level `usage` is the weekly summary, `limits[]` the per-window rows. */
const KIMI_CODING = {
	ids: ["kimi-coding"],
	displayName: "Kimi For Coding",
	plan: {
		build: ({ apiKey }) => ({
			url: "https://api.kimi.com/coding/v1/usages",
			headers: bearer(apiKey)
		}),
		parse: (status, body) => {
			if (status !== 200 || typeof body !== "object" || body === null) return void 0;
			const root = body;
			const windows = [];
			const limits = root.limits;
			if (Array.isArray(limits)) for (const entry of limits) {
				if (typeof entry !== "object" || entry === null) continue;
				const detail = entry.detail;
				const window = entry.window;
				if (typeof detail !== "object" || detail === null) continue;
				const row = detail;
				const duration = typeof window === "object" && window !== null ? toNum(window.duration) : void 0;
				const unit = typeof window === "object" && window !== null ? str(window.timeUnit) : void 0;
				const key = duration === 300 && unit === "TIME_UNIT_MINUTE" ? "5h" : duration !== void 0 ? `w-${duration}` : "window";
				const percent = usedPercent(row.used, row.limit);
				windows.push({
					key,
					name: str(row.name),
					percent,
					resetsAt: toIso(row.resetTime)
				});
			}
			const usage = root.usage;
			if (typeof usage === "object" && usage !== null) {
				const weekly = usage;
				windows.push({
					key: "week",
					name: "Weekly",
					percent: usedPercent(weekly.used, weekly.limit),
					resetsAt: toIso(weekly.resetTime)
				});
			}
			if (windows.length === 0) return void 0;
			const user = root.user;
			const membership = typeof user === "object" && user !== null ? user.membership : void 0;
			return {
				planName: typeof membership === "object" && membership !== null ? str(membership.level) : void 0,
				windows
			};
		}
	}
};
/** GLM Coding Plan quota; auth is the RAW key without a Bearer prefix. */
function glmPlan(host, ids) {
	return {
		ids,
		displayName: "GLM Coding Plan",
		plan: {
			build: ({ apiKey }) => ({
				url: `https://${host}/api/monitor/usage/quota/limit`,
				headers: {
					authorization: apiKey,
					"accept-language": "en-US,en"
				}
			}),
			parse: (status, body) => {
				if (status !== 200 || typeof body !== "object" || body === null) return void 0;
				const root = body;
				if (root.success !== true) return void 0;
				const data = root.data;
				if (typeof data !== "object" || data === null) return void 0;
				const limits = data.limits;
				if (!Array.isArray(limits)) return void 0;
				const windows = [];
				for (const entry of limits) {
					if (typeof entry !== "object" || entry === null) continue;
					const row = entry;
					const unit = toNum(row.unit);
					const percent = toNum(row.percentage);
					windows.push({
						key: unit === 3 ? "5h" : unit === 6 ? "week" : unit !== void 0 ? `unit-${unit}` : "window",
						percent: percent === void 0 ? void 0 : Math.max(0, Math.min(100, percent)),
						resetsAt: toIso(row.nextResetTime)
					});
				}
				if (windows.length === 0) return void 0;
				return {
					planName: str(data.level),
					windows
				};
			}
		}
	};
}
/** OpenCode Go quota: percent-only rolling/weekly/monthly windows. */
const OPENCODE_GO = {
	ids: ["opencode-go"],
	displayName: "OpenCode Go",
	plan: {
		build: ({ apiKey }) => ({
			url: "https://opencode.ai/zen/go/v1/usage",
			headers: bearer(apiKey)
		}),
		parse: (status, body) => {
			if (status !== 200 || typeof body !== "object" || body === null) return void 0;
			const usage = body.usage;
			if (typeof usage !== "object" || usage === null) return void 0;
			const windows = [];
			for (const [field, key] of [
				["rolling", "5h"],
				["weekly", "week"],
				["monthly", "month"]
			]) {
				const entry = usage[field];
				if (typeof entry !== "object" || entry === null) continue;
				const row = entry;
				const percent = toNum(row.percent);
				windows.push({
					key,
					percent: percent === void 0 ? void 0 : Math.max(0, Math.min(100, percent)),
					resetsAt: percent === 0 ? void 0 : toIso(row.resetsAt)
				});
			}
			if (windows.length === 0) return void 0;
			return { windows };
		}
	}
};
/** MiniMax coding-plan remains: remaining-percent semantics, `general` model entry. */
function minimaxPlan(host, ids) {
	return {
		ids,
		displayName: "MiniMax Coding Plan",
		plan: {
			build: ({ apiKey }) => ({
				url: `https://${host}/v1/api/openplatform/coding_plan/remains`,
				headers: bearer(apiKey)
			}),
			parse: (status, body) => {
				if (status !== 200 || typeof body !== "object" || body === null) return void 0;
				const remains = body.model_remains;
				if (!Array.isArray(remains)) return void 0;
				const general = remains.find((entry) => typeof entry === "object" && entry !== null && entry.model_name === "general");
				if (typeof general !== "object" || general === null) return void 0;
				const row = general;
				const windows = [];
				const intervalRemaining = toNum(row.current_interval_remaining_percent);
				if (intervalRemaining !== void 0) windows.push({
					key: "5h",
					percent: Math.max(0, Math.min(100, 100 - intervalRemaining)),
					resetsAt: toIso(row.end_time)
				});
				if (row.current_weekly_status === 1) {
					const weeklyRemaining = toNum(row.current_weekly_remaining_percent);
					if (weeklyRemaining !== void 0) windows.push({
						key: "week",
						percent: Math.max(0, Math.min(100, 100 - weeklyRemaining)),
						resetsAt: toIso(row.weekly_end_time)
					});
				}
				if (windows.length === 0) return void 0;
				return { windows };
			}
		}
	};
}
const OPENROUTER = {
	ids: ["openrouter"],
	displayName: "OpenRouter",
	balance: {
		build: ({ apiKey }) => ({
			url: "https://openrouter.ai/api/v1/credits",
			headers: bearer(apiKey)
		}),
		parse: (status, body) => {
			if (status !== 200 || typeof body !== "object" || body === null) return void 0;
			const data = body.data;
			if (typeof data !== "object" || data === null) return void 0;
			const credits = toNum(data.total_credits);
			const used = toNum(data.total_usage) ?? 0;
			if (credits === void 0) return void 0;
			return {
				currency: "USD",
				totalBalance: money(credits - used)
			};
		}
	}
};
function siliconFlow(host, ids, currency) {
	return {
		ids,
		displayName: "SiliconFlow",
		balance: {
			build: ({ apiKey }) => ({
				url: `https://${host}/v1/user/info`,
				headers: bearer(apiKey)
			}),
			parse: (status, body) => {
				if (status !== 200 || typeof body !== "object" || body === null) return void 0;
				const data = body.data;
				if (typeof data !== "object" || data === null) return void 0;
				const total = str(data.totalBalance);
				if (total === void 0) return void 0;
				return {
					currency,
					totalBalance: total
				};
			}
		}
	};
}
const ZENMUX = {
	ids: ["zenmux"],
	displayName: "ZenMux",
	balance: {
		build: ({ apiKey }) => ({
			url: "https://zenmux.ai/api/v1/management/payg/balance",
			headers: bearer(apiKey)
		}),
		parse: (status, body) => {
			if (status !== 200 || typeof body !== "object" || body === null) return void 0;
			const data = body.data;
			if (typeof data !== "object" || data === null) return void 0;
			const credits = toNum(data.total_credits);
			if (credits === void 0) return void 0;
			return {
				currency: "USD",
				totalBalance: money(credits)
			};
		}
	}
};
/**
* OpenAI Codex (ChatGPT subscription) quota over the OAuth access token the
* pi-ai grant stores — the one plan adapter whose credential is an OAuth
* token rather than an API key. A 401 here means the stored access token has
* expired; it refreshes when the harness next runs a Codex request, so the
* error line tells the user to use Codex once and refresh.
*/
const OPENAI_CODEX = {
	ids: ["openai-codex"],
	displayName: "Codex (ChatGPT 订阅)",
	plan: {
		build: ({ apiKey, accountId }) => ({
			url: "https://chatgpt.com/backend-api/wham/usage",
			headers: {
				authorization: `Bearer ${apiKey}`,
				"user-agent": "codex-cli",
				accept: "application/json",
				...accountId !== void 0 ? { "chatgpt-account-id": accountId } : {}
			}
		}),
		parse: (status, body) => {
			if (status !== 200 || typeof body !== "object" || body === null) return void 0;
			const rateLimit = body.rate_limit;
			if (typeof rateLimit !== "object" || rateLimit === null) return void 0;
			const windows = [];
			const rows = rateLimit.primary_window !== void 0 || rateLimit.secondary_window !== void 0 ? [rateLimit.primary_window, rateLimit.secondary_window] : [];
			for (const entry of rows) {
				if (typeof entry !== "object" || entry === null) continue;
				const row = entry;
				const percent = toNum(row.used_percent);
				if (percent === void 0) continue;
				const seconds = toNum(row.limit_window_seconds);
				windows.push({
					key: codexWindowKey(seconds),
					percent: Math.max(0, Math.min(100, percent)),
					resetsAt: toIso(row.reset_at)
				});
			}
			if (windows.length === 0) return void 0;
			return { windows };
		}
	}
};
/** Map a Codex window length in seconds onto the shared window key vocabulary. */
function codexWindowKey(seconds) {
	if (seconds === void 0) return "window";
	if (seconds === 18e3) return "5h";
	if (seconds === 604800) return "week";
	if (seconds === 2592e3) return "month";
	const hours = seconds / 3600;
	return hours >= 24 ? `${Math.round(hours / 24)}_day` : `${Math.round(hours)}_hour`;
}
/**
* The adapter registry, in no particular order. Route keys come from the
* pi-ai provider catalog plus the routes this deployment observed in user
* configuration (`zenmux`).
*/
const PROVIDER_ADAPTERS = [
	DEEPSEEK,
	moonshotBalance("api.moonshot.cn", "CNY", ["moonshotai-cn"]),
	moonshotBalance("api.moonshot.ai", "USD", ["moonshotai"]),
	KIMI_CODING,
	glmPlan("open.bigmodel.cn", ["zai-coding-cn"]),
	glmPlan("api.z.ai", ["zai-coding"]),
	OPENCODE_GO,
	minimaxPlan("api.minimaxi.com", ["minimax-cn"]),
	minimaxPlan("api.minimax.io", ["minimax"]),
	OPENAI_CODEX,
	OPENROUTER,
	siliconFlow("api.siliconflow.cn", ["siliconflow", "siliconflow-cn"], "CNY"),
	siliconFlow("api.siliconflow.com", ["siliconflow-intl"], "USD"),
	ZENMUX
];
/** Find the adapter serving a provider route key, if any. */
function adapterFor(provider) {
	return PROVIDER_ADAPTERS.find((adapter) => adapter.ids.includes(provider));
}
/**
* Whether a provider route belongs to the official DeepSeek family: the only
* family with a spend price book and a settings-section-owned env credential
* (llm-deepseek) rather than a pi-ai profile. Drives the env fallback in
* credential resolution and the fold-time cost stamping.
*/
function isDeepSeekProviderRoute(provider) {
	return adapterFor(provider) === DEEPSEEK;
}
//#endregion
//#region src/core/types.ts
/** A zeroed totals bucket. */
function emptyTotals() {
	return {
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		reasoningTokens: 0,
		calls: 0,
		cost: 0
	};
}
//#endregion
//#region src/core/heatmap.ts
function localDateKey(at) {
	return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
}
function startOfLocalDay(at) {
	return new Date(at.getFullYear(), at.getMonth(), at.getDate());
}
function totalTokens(totals) {
	return totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens + totals.outputTokens;
}
function levelOf(tokens, max) {
	if (tokens <= 0 || max <= 0) return 0;
	const ratio = tokens / max;
	if (ratio < .25) return 1;
	if (ratio < .5) return 2;
	if (ratio < .75) return 3;
	return 4;
}
/**
* Pad daily rows into a fixed 26×7 Mon→Sun column-major grid ending on the
* current week's Sunday (or today when today is Sunday).
*/
function buildHeatmapGrid(days, nowMs = Date.now()) {
	const byDate = new Map(days.map((day) => [day.date, day.totals]));
	const today = startOfLocalDay(new Date(nowMs));
	const todayKey = localDateKey(today);
	const weekdayMon0 = (today.getDay() + 6) % 7;
	const weekEnd = new Date(today);
	weekEnd.setDate(today.getDate() + (6 - weekdayMon0));
	const cells = [];
	const monthLabels = [];
	let lastMonth = -1;
	const tokenValues = [];
	for (let week = 25; week >= 0; week -= 1) {
		for (let dow = 0; dow < 7; dow += 1) {
			const date = new Date(weekEnd);
			date.setDate(weekEnd.getDate() - (week * 7 + (6 - dow)));
			const key = localDateKey(date);
			const totals = byDate.get(key) ?? emptyTotals();
			const tokens = totalTokens(totals);
			tokenValues.push(tokens);
			cells.push({
				date: key,
				totals,
				tokens,
				level: 0,
				isToday: key === todayKey
			});
		}
		const weekStart = new Date(weekEnd);
		weekStart.setDate(weekEnd.getDate() - (week * 7 + 6));
		const month = weekStart.getMonth();
		monthLabels.push(month !== lastMonth ? weekStart.toLocaleString(void 0, { month: "short" }) : "");
		lastMonth = month;
	}
	const max = Math.max(1, ...tokenValues);
	for (const cell of cells) cell.level = levelOf(cell.tokens, max);
	return {
		cells,
		monthLabels
	};
}
//#endregion
//#region src/core/plan-match.ts
/** Windows the strip and ContextMeter-style meter expose. */
const DISPLAY_KEYS = /* @__PURE__ */ new Set([
	"5h",
	"week",
	"month"
]);
const WINDOW_ORDER = [
	"5h",
	"week",
	"month"
];
/** Keep only percentage windows the UI knows how to render. */
function planWindowsForDisplay(plan) {
	if (plan === void 0) return [];
	return plan.windows.filter((window) => DISPLAY_KEYS.has(window.key) && window.percent !== void 0);
}
/** Stable 5h → week → month order for plan cards and the strip panel. */
function orderedPlanWindows(plan) {
	return [...planWindowsForDisplay(plan)].sort((left, right) => {
		const leftIndex = WINDOW_ORDER.indexOf(left.key);
		const rightIndex = WINDOW_ORDER.indexOf(right.key);
		return (leftIndex < 0 ? 99 : leftIndex) - (rightIndex < 0 ? 99 : rightIndex);
	});
}
/** Clone a provider row with display-only windows, or undefined when empty. */
function withDisplayPlan(provider) {
	if (provider?.plan === void 0) return void 0;
	const windows = orderedPlanWindows(provider.plan);
	if (windows.length === 0) return void 0;
	return {
		...provider,
		plan: {
			...provider.plan,
			windows
		}
	};
}
function haystack(provider, model, baseURL) {
	return `${provider} ${model ?? ""} ${baseURL ?? ""}`.toLowerCase();
}
/** Volcano Ark / Doubao coding-plan routes (and their control-plane hosts). */
function looksLikeVolcano(text) {
	return /volc|ark|doubao|byteplus|火山|volces\.com|volcengineapi\.com/.test(text);
}
/** CLI Proxy API management console / common local gateway endpoints. */
function looksLikeCpamcGateway(text) {
	return /cliproxy|cli[-_]?proxy|cpamc|cli\s*proxy|127\.0\.0\.1:8317|localhost:8317|\[::1\]:8317|:8317\b/.test(text);
}
/** Provider ids that commonly front CPAMC-backed Codex / Kimi / Claude accounts. */
function looksLikeCpamcProviderId(provider) {
	const id = provider.toLowerCase();
	return /^(openai-codex|codex|kimi-coding|kimi|anthropic|claude)\b/.test(id) || /cliproxy|cli[-_]?proxy|cpamc/.test(id);
}
/** Map a composer route onto one of the CPAMC account families we probe. */
function cpamcFamily(text) {
	if (/codex|chatgpt|openai-codex|\bgpt-|\bo[1-4]\b/.test(text)) return "codex";
	if (/kimi|moonshot/.test(text)) return "kimi";
	if (/claude|anthropic/.test(text)) return "claude";
}
/**
* Providers that belong on the Plans tab: real windows, or external sources
* that only carry a probe error (so the user can see why CPAMC/Volcano is empty).
*/
function planTabProviders(providers) {
	return providers.filter((provider) => {
		if (provider.plan !== void 0 && provider.plan.windows.some((window) => window.percent !== void 0)) return true;
		if ((provider.source === "cpamc" || provider.source === "volcano") && provider.error !== void 0) return true;
		return false;
	});
}
/** Locale key for the plan source chip on the strip / plan cards. */
function planSourceLabelKey(provider) {
	if (provider.source === "cpamc") return "usage.plan.source.cpamc";
	if (provider.source === "volcano") return "usage.plan.source.volcano";
	return "usage.plan.source.model";
}
/**
* Pick the plan snapshot for the current composer model.
* Order: explicit route override (per-session selection) → exact provider id
* → Volcano external source → CPAMC external source. The override lets the
* strip follow the model selected in each conversation instead of the host's
* global "last request seen" route.
*/
function currentPlanProvider(snapshot, override) {
	if (snapshot === null) return void 0;
	const current = override !== void 0 ? {
		provider: override.provider,
		...override.model !== void 0 && override.model !== "" ? { model: override.model } : {},
		...override.baseURL !== void 0 ? { baseURL: override.baseURL } : {}
	} : snapshot.current;
	if (current.provider === void 0) return void 0;
	const providers = snapshot.providers;
	const exact = withDisplayPlan(providers.find((row) => row.provider === current.provider));
	if (exact !== void 0) return exact;
	const text = haystack(current.provider, current.model, current.baseURL ?? (current.provider === snapshot.current.provider ? snapshot.current.baseURL : void 0));
	if (looksLikeVolcano(text)) {
		const volcano = withDisplayPlan(providers.find((row) => row.source === "volcano"));
		if (volcano !== void 0) return volcano;
	}
	const cpamcRows = providers.filter((row) => row.source === "cpamc" && row.plan !== void 0);
	if (cpamcRows.length === 0) return void 0;
	const viaGateway = looksLikeCpamcGateway(text);
	const viaProviderId = looksLikeCpamcProviderId(current.provider);
	if (!viaGateway && !viaProviderId) return void 0;
	const family = cpamcFamily(text);
	if (family !== void 0) {
		const preferred = withDisplayPlan(cpamcRows.find((row) => row.provider.startsWith(`cpamc:${family}:`)));
		if (preferred !== void 0) return preferred;
	}
	for (const row of cpamcRows) {
		const hit = withDisplayPlan(row);
		if (hit !== void 0) return hit;
	}
}
//#endregion
//#region src/core/pricing.ts
/** The published peak windows: weekday 09:00-12:00 and 14:00-18:00. */
const PEAK_WINDOWS = [{
	from: 540,
	to: 720
}, {
	from: 840,
	to: 1080
}];
/** Beijing is UTC+8 year-round (no DST), so a fixed shift is exact. */
const BEIJING_UTC_OFFSET_MS = 288e5;
function withinWindow(minuteOfDay) {
	return PEAK_WINDOWS.find((window) => minuteOfDay >= window.from && minuteOfDay < window.to);
}
/**
* The DeepSeek billing period at `ms`, plus when it next flips. The clock is
* Beijing time regardless of the host timezone (UTC+8 has no DST, so a fixed
* shift is exact). `boundaryMs` is the instant the current period ends — the
* window's close while peaking, the next window's open otherwise.
*/
function deepseekPeriodAt(ms) {
	const shifted = new Date(ms + BEIJING_UTC_OFFSET_MS);
	const weekday = shifted.getUTCDay();
	const minuteOfDay = shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
	const current = weekday >= 1 && weekday <= 5 ? withinWindow(minuteOfDay) : void 0;
	if (current !== void 0) return {
		peak: true,
		boundaryMs: ms + (current.to - minuteOfDay) * 6e4 - shifted.getUTCSeconds() * 1e3 - shifted.getUTCMilliseconds()
	};
	for (let dayOffset = 0; dayOffset < 8; dayOffset += 1) {
		const day = new Date(ms + BEIJING_UTC_OFFSET_MS + dayOffset * 864e5);
		if (day.getUTCDay() < 1 || day.getUTCDay() > 5) continue;
		const realDayStart = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()) - BEIJING_UTC_OFFSET_MS;
		for (const window of PEAK_WINDOWS) {
			if (dayOffset === 0 && window.from <= minuteOfDay) continue;
			return {
				peak: false,
				boundaryMs: realDayStart + window.from * 6e4
			};
		}
	}
	return {
		peak: false,
		boundaryMs: ms + 864e5
	};
}
//#endregion
//#region src/client/UsageSectionCard.tsx
/**
* The usage statistics settings section: overview (today's usage, plan
* quotas, trend), plan windows, and settings. Data comes from the host's
* loopback-fenced /api/dsh-usage-plus/overview document; polling runs only
* while the section is mounted and the tab is visible.
*
* The overview is a quiet instrument panel: one hero figure for today, a
* compact comparator group, then the 26-week activity heatmap and the account
* quota rings as the two rich moments. Every derived value is formatted from
* the host document; the component invents no numbers.
* @module dsh-usage-plus/client/UsageSectionCard
*/
/** Poll cadence while the section is open. */
const SECTION_POLL_MS = 1e4;
/**
* A document older than this is presented as stale: the freshness dot next to
* `更新于` dims and the exact timestamp still carries the truth.
*/
const FRESH_WINDOW_MS = 3e4;
/** How many model sub-bars render under one provider bar. */
const CHART_MODEL_CAP = 3;
/** Compact token count: 12345 -> 12.3k, 1234567 -> 1.23M. */
function formatTokens(value) {
	if (!Number.isFinite(value) || value <= 0) return "0";
	if (value < 1e3) return String(value);
	if (value < 1e6) return trim(value / 1e3) + "k";
	if (value < 1e9) return trim(value / 1e6) + "M";
	return trim(value / 1e9) + "B";
}
function trim(value) {
	return value >= 100 ? String(Math.round(value)) : value.toFixed(value >= 10 ? 1 : 2).replace(/\.?0+$/, "");
}
function formatTime(ms) {
	try {
		return new Date(ms).toLocaleTimeString();
	} catch {
		return "";
	}
}
function formatClock(ms) {
	try {
		return new Date(ms).toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit"
		});
	} catch {
		return "";
	}
}
/** Formatted CNY spend estimate (the only priced currency today). */
function formatCost(cost) {
	return "¥" + cost.toFixed(2);
}
/** One percent reading, same format everywhere in the panel. */
function percentText$1(value) {
	return `${value >= 10 ? Math.round(value) : value.toFixed(1)}%`;
}
function totalOf(totals) {
	return totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens + totals.outputTokens;
}
function cacheHitRate(totals) {
	const billed = totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens;
	if (billed <= 0) return null;
	return totals.cacheReadTokens / billed * 100;
}
/** A provider row backed by a configured credential (api key, env key, or OAuth grant). */
function isConfigured(provider) {
	return provider.credential !== "none";
}
function balanceAmount(provider) {
	if (provider.balance === void 0) return null;
	const raw = Number(provider.balance.totalBalance);
	return Number.isFinite(raw) ? raw : null;
}
function balanceStatus(provider) {
	const amount = balanceAmount(provider);
	if (amount === null) return t("usage.balance.empty");
	if (amount <= 5) return t("usage.balance.low");
	return t("usage.balance.ok");
}
function balanceText(provider) {
	if (provider.balance === void 0) return null;
	const currency = provider.balance.currency.toUpperCase();
	const prefix = currency === "CNY" ? "¥" : currency === "USD" ? "$" : "";
	const suffix = currency !== "CNY" && currency !== "USD" ? ` ${currency}` : "";
	return `${prefix}${provider.balance.totalBalance}${suffix}`;
}
/** Only providers with a real balance fact — skip unconfigured / unsupported noise. */
function balanceCardRows(providers) {
	const seen = /* @__PURE__ */ new Set();
	const rows = [];
	for (const provider of providers) {
		if (!isConfigured(provider) || balanceText(provider) === null) continue;
		const key = `${provider.displayName.trim().toLowerCase()}|${balanceText(provider)}`;
		if (seen.has(key)) continue;
		seen.add(key);
		rows.push(provider);
	}
	return rows;
}
/**
* Fill classes for one plan window. `barFill` always rides along because it
* owns the fill's non-colour geometry (height, radius, transition); `barWarn`
* and `barLow` only override the colour. Returning a colour class alone
* collapses the inner span to zero height, so a >=70% window renders blank
* while a lower one looks fine. Mirrors `barTone` in PlanUsageStrip.
*/
function toneClass$1(percent) {
	if (percent >= 90) return `${usage_module_default.barFill} ${usage_module_default.barLow}`;
	if (percent >= 70) return `${usage_module_default.barFill} ${usage_module_default.barWarn}`;
	return usage_module_default.barFill;
}
function RefreshIcon(props) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
		className: props.spinning === true ? `${usage_module_default.icon} ${usage_module_default.iconSpin}` : usage_module_default.icon,
		viewBox: "0 0 24 24",
		width: "14",
		height: "14",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "1.6",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M21 12a9 9 0 1 1-2.64-6.36" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M21 3v6h-6" })]
	});
}
function ChevronIcon(props) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
		className: props.open ? `${usage_module_default.icon} ${usage_module_default.iconOpen}` : usage_module_default.icon,
		viewBox: "0 0 24 24",
		width: "14",
		height: "14",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "1.6",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M6 9l6 6 6-6" })
	});
}
const TokenComposition = (0, react.memo)(function TokenComposition(props) {
	const { totals } = props;
	const segments = (0, react.useMemo)(() => {
		const rows = [
			{
				key: "cacheRead",
				label: t("usage.tokens.cacheRead"),
				value: totals.cacheReadTokens,
				cls: usage_module_default.segCache
			},
			{
				key: "input",
				label: t("usage.tokens.input"),
				value: totals.inputTokens,
				cls: usage_module_default.segInput
			},
			{
				key: "cacheWrite",
				label: t("usage.tokens.cacheWrite"),
				value: totals.cacheWriteTokens,
				cls: usage_module_default.segWrite
			},
			{
				key: "output",
				label: t("usage.tokens.output"),
				value: totals.outputTokens,
				cls: usage_module_default.segOutput
			}
		];
		if (totals.reasoningTokens > 0) rows.push({
			key: "reasoning",
			label: t("usage.tokens.reasoning"),
			value: totals.reasoningTokens,
			cls: usage_module_default.segReasoning
		});
		return rows;
	}, [totals]);
	const sum = (0, react.useMemo)(() => segments.reduce((acc, segment) => acc + segment.value, 0), [segments]);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: usage_module_default.composition,
		"data-dsh-part": "token-composition",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: usage_module_default.compositionHead,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: usage_module_default.subTitle,
					children: t("usage.tokens.buckets")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: usage_module_default.mono,
					children: formatTokens(sum)
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: usage_module_default.stackBar,
				children: sum === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: usage_module_default.stackEmpty }) : segments.filter((segment) => segment.value > 0).map((segment) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: `${usage_module_default.stackSeg} ${segment.cls}`,
					style: { flexGrow: segment.value },
					title: `${segment.label} ${formatTokens(segment.value)}`
				}, segment.key))
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: usage_module_default.legend,
				children: segments.map((segment) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: usage_module_default.legendItem,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {
							className: `${usage_module_default.legendDot} ${segment.cls}`,
							"aria-hidden": "true"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.legendLabel,
							children: segment.label
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: `${usage_module_default.legendValue} ${usage_module_default.mono}`,
							children: formatTokens(segment.value)
						})
					]
				}, segment.key))
			})
		]
	});
});
const ProviderBreakdown = (0, react.memo)(function ProviderBreakdown(props) {
	const { rows, providers, current } = props;
	const [open, setOpen] = (0, react.useState)(() => current === void 0 ? {} : { [current]: true });
	const derived = (0, react.useMemo)(() => {
		return {
			byProvider: new Map(providers.map((provider) => [provider.provider, provider])),
			total: rows.reduce((acc, row) => acc + totalOf(row.totals), 0)
		};
	}, [providers, rows]);
	if (rows.length === 0) return null;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: usage_module_default.providerList,
		"data-dsh-part": "provider-list",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			className: usage_module_default.subTitle,
			children: t("usage.today.breakdown")
		}), rows.map((row) => {
			const provider = derived.byProvider.get(row.provider);
			const expanded = open[row.provider] === true;
			const hasModels = row.models.length > 0;
			const balance = provider === void 0 ? null : balanceText(provider);
			const total = totalOf(row.totals);
			const share = derived.total > 0 ? Math.round(total / derived.total * 100) : 0;
			const accent = current === row.provider;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: usage_module_default.providerBlock,
				"data-accent": accent ? "yes" : "no",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: usage_module_default.providerRow,
						disabled: !hasModels,
						"aria-expanded": hasModels ? expanded : void 0,
						onClick: () => {
							if (!hasModels) return;
							setOpen((prev) => ({
								...prev,
								[row.provider]: !expanded
							}));
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: usage_module_default.providerLead,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {
									className: usage_module_default.providerDot,
									"aria-hidden": "true"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: usage_module_default.providerName,
									children: provider?.displayName ?? row.provider
								}),
								accent && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: usage_module_default.currentBadge,
									children: t("usage.current")
								})
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: usage_module_default.providerMeta,
							children: [
								balance !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: usage_module_default.providerBalance,
									children: balance
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: usage_module_default.providerTokens,
									children: [
										formatTokens(total),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: usage_module_default.dim,
											children: ` · ${t("usage.calls", { n: row.totals.calls })}`
										}),
										row.totals.cost > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: usage_module_default.dim,
											children: ` · ${formatCost(row.totals.cost)}`
										}) : null
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: `${usage_module_default.providerShare} ${usage_module_default.mono}`,
									children: [share, "%"]
								}),
								hasModels ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChevronIcon, { open: expanded }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: usage_module_default.iconSpacer,
									"aria-hidden": "true"
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: usage_module_default.providerTrack,
						"aria-hidden": "true",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.providerFill,
							style: { width: `${Math.max(1.5, share)}%` }
						})
					}),
					expanded && row.models.map((model) => {
						const modelTotal = totalOf(model.totals);
						const modelShare = total > 0 ? Math.round(modelTotal / total * 100) : 0;
						return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: usage_module_default.modelRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_module_default.modelName,
								children: model.model
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: usage_module_default.modelMeta,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: `${usage_module_default.mono}`,
										children: formatTokens(modelTotal)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: usage_module_default.dim,
										children: t("usage.calls", { n: model.totals.calls })
									}),
									model.totals.cost > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: usage_module_default.dim,
										children: formatCost(model.totals.cost)
									}) : null,
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: `${usage_module_default.modelShare} ${usage_module_default.mono}`,
										children: [modelShare, "%"]
									})
								]
							})]
						}, model.model);
					})
				]
			}, row.provider);
		})]
	});
});
/** Balance rows not already shown beside today's provider breakdown. */
function BalanceInline(props) {
	const rows = balanceCardRows(props.providers).filter((provider) => !props.excludeIds.has(provider.provider));
	if (rows.length === 0) return null;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: usage_module_default.balanceInline,
		"data-dsh-part": "balance-inline",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			className: usage_module_default.subTitle,
			children: t("usage.balance")
		}), rows.map((provider) => {
			const amount = balanceAmount(provider);
			const low = amount !== null && amount <= 5;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: usage_module_default.balanceRow,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: usage_module_default.balanceLead,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {
						className: `${usage_module_default.statusDot} ${low ? usage_module_default.statusWarn : usage_module_default.statusOk}`,
						"aria-hidden": "true"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: usage_module_default.providerName,
						children: [provider.displayName, props.current === provider.provider && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.currentBadge,
							children: t("usage.current")
						})]
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: usage_module_default.balanceMeta,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: `${usage_module_default.balanceAmount} ${usage_module_default.mono}`,
						children: balanceText(provider)
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: usage_module_default.balanceHint,
						children: balanceStatus(provider)
					})]
				})]
			}, provider.provider);
		})]
	});
}
function Stat(props) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: usage_module_default.stat,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: usage_module_default.statLabel,
				children: props.label
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: usage_module_default.statValue,
				children: props.value
			}),
			props.hint !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: usage_module_default.statHint,
				children: props.hint
			}) : null
		]
	});
}
/**
* One ring gauge. The arc is drawn on a fixed viewBox so every ring in the
* panel (hero cache hit, quota windows) shares one geometry.
*/
function Ring(props) {
	const { percent, size, stroke, tone } = props;
	const radius = size / 2 - stroke / 2 - 1;
	const circumference = 2 * Math.PI * radius;
	const clamped = percent === null ? 0 : Math.min(100, Math.max(0, percent));
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
		className: usage_module_default.ringBox,
		style: {
			width: size,
			height: size
		},
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
			className: usage_module_default.ringSvg,
			viewBox: `0 0 ${size} ${size}`,
			"aria-hidden": "true",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
				className: usage_module_default.ringTrack,
				cx: size / 2,
				cy: size / 2,
				r: radius,
				strokeWidth: stroke
			}), percent !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
				className: `${usage_module_default.ringFill} ${tone}`,
				cx: size / 2,
				cy: size / 2,
				r: radius,
				strokeWidth: stroke,
				strokeDasharray: `${clamped / 100 * circumference} ${circumference}`,
				transform: `rotate(-90 ${size / 2} ${size / 2})`
			})]
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			className: `${usage_module_default.ringValue} ${usage_module_default.mono}`,
			children: percent === null ? "—" : `${Math.round(clamped)}%`
		})]
	});
}
function HeroBand(props) {
	const hitTone = props.hitRate === null ? usage_module_default.toneAccent : props.hitRate >= 90 ? usage_module_default.toneGood : props.hitRate >= 60 ? usage_module_default.toneAccent : usage_module_default.toneWarn;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: `${usage_module_default.card} ${usage_module_default.hero}`,
		"data-dsh-part": "hero",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: usage_module_default.heroToday,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: usage_module_default.heroLabel,
						children: `${t("usage.summary.today")} ${t("usage.tokens.total")}`
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: usage_module_default.heroFigure,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.heroValue,
							children: formatTokens(props.todayTokens)
						}), props.tokenDelta !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: usage_module_default.delta,
							"data-dir": props.tokenDelta >= 0 ? "up" : "down",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: `${usage_module_default.deltaValue} ${usage_module_default.mono}`,
								children: [
									props.tokenDelta >= 0 ? "+" : "",
									Math.round(props.tokenDelta),
									"%"
								]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_module_default.deltaLabel,
								children: t("usage.vsYesterday")
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: usage_module_default.heroHint,
						children: props.todayCost > 0 ? `${t("usage.calls", { n: props.todayCalls })} · ${formatCost(props.todayCost)}` : t("usage.calls", { n: props.todayCalls })
					})
				]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: usage_module_default.statGroup,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Stat, {
						label: t("usage.summary.month"),
						value: formatTokens(props.rangeTokens),
						hint: t("usage.calls", { n: props.rangeCalls })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Stat, {
						label: t("usage.summary.all"),
						value: formatTokens(props.allTokens),
						hint: t("usage.calls", { n: props.allCalls })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Stat, {
						label: t("usage.tokens.calls"),
						value: String(props.todayCalls),
						hint: `${formatTokens(props.todayTokens)} ${t("usage.tokens.total")}`
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Stat, {
						label: t("usage.metric.avgCost"),
						value: props.avgCost === null ? "—" : formatCost(props.avgCost),
						hint: props.avgCost === null && props.todayCalls > 0 ? t("usage.metric.unpriced") : t("usage.metric.avgCostHint", { n: props.todayCalls })
					})
				]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: usage_module_default.heroRing,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Ring, {
						percent: props.hitRate,
						size: 84,
						stroke: 7,
						tone: hitTone
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: usage_module_default.heroRingLabel,
						children: t("usage.tokens.cacheHit")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: usage_module_default.heroRingHint,
						children: t("usage.tokens.cacheRatio", {
							read: formatTokens(props.cacheRead),
							billed: formatTokens(props.billed)
						})
					})
				]
			})
		]
	});
}
/** Group the per-week month labels into runs so each label starts on its column. */
function monthRuns(labels) {
	const starts = [];
	labels.forEach((label, index) => {
		if (label !== "") starts.push(index);
	});
	return starts.map((start, index) => ({
		label: labels[start] ?? "",
		start,
		span: (starts[index + 1] ?? labels.length) - start
	}));
}
const HeatmapCard = (0, react.memo)(function HeatmapCard(props) {
	const { days } = props;
	const grid = (0, react.useMemo)(() => buildHeatmapGrid(days), [days]);
	const months = (0, react.useMemo)(() => monthRuns(grid.monthLabels), [grid]);
	const week = (0, react.useMemo)(() => {
		const recent = days.slice(-7);
		return {
			tokens: recent.reduce((acc, day) => acc + totalOf(day.totals), 0),
			calls: recent.reduce((acc, day) => acc + day.totals.calls, 0)
		};
	}, [days]);
	const facts = (0, react.useMemo)(() => {
		let activeDays = 0;
		let busiest = grid.cells[0];
		for (const cell of grid.cells) {
			if (cell.tokens > 0) activeDays += 1;
			if (busiest === void 0 || cell.tokens > busiest.tokens) busiest = cell;
		}
		return {
			activeDays,
			busiest
		};
	}, [grid]);
	const hasData = facts.activeDays > 0;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: usage_module_default.card,
		"data-dsh-part": "heatmap-card",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: usage_module_default.cardHead,
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: usage_module_default.cardHeadGroup,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: usage_module_default.cardTitle,
					children: t("usage.heatmap")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: usage_module_default.scopeChip,
					children: t("usage.scope.device")
				})]
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: usage_module_default.cardMeta,
				children: t("usage.heatmap.weeks")
			})]
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: usage_module_default.heatmapLayout,
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: usage_module_default.heatmapLeft,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: usage_module_default.heatmapBody,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: usage_module_default.heatmapLabels,
						"aria-hidden": "true",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: usage_module_default.heatmapCorner }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: usage_module_default.heatmapDow,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("usage.heatmap.dow.mon") }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("usage.heatmap.dow.wed") }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("usage.heatmap.dow.fri") }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {})
							]
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: usage_module_default.heatmapMain,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: usage_module_default.heatmapMonths,
							children: months.map((run) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_module_default.heatmapMonth,
								style: { gridColumn: `${run.start + 1} / span ${run.span}` },
								children: run.label
							}, `${run.label}-${run.start}`))
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: usage_module_default.heatmapGrid,
							"data-dsh-part": "heatmap-grid",
							children: grid.cells.map((cell) => {
								const cost = cell.totals.cost > 0 ? ` · ${formatCost(cell.totals.cost)}` : "";
								return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: cell.isToday ? `${usage_module_default.heatmapCell} ${usage_module_default.heatmapToday}` : usage_module_default.heatmapCell,
									"data-level": cell.level,
									title: t("usage.heatmap.day", {
										date: cell.date,
										tokens: formatTokens(cell.tokens),
										calls: t("usage.calls", { n: cell.totals.calls }),
										cost
									})
								}, cell.date);
							})
						})]
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: usage_module_default.heatmapLegend,
					children: hasData ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("usage.heatmap.less") }),
						[
							0,
							1,
							2,
							3,
							4
						].map((level) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.heatmapCell,
							"data-level": level,
							"aria-hidden": "true"
						}, level)),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("usage.heatmap.more") })
					] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: usage_module_default.muted,
						children: t("usage.heatmap.empty")
					})
				})]
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: usage_module_default.heatmapSide,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: usage_module_default.sideStat,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.sideLabel,
							children: t("usage.heatmap.activeDays")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: usage_module_default.sideValue,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: `${usage_module_default.mono}`,
								children: facts.activeDays
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_module_default.sideUnit,
								children: `/${grid.cells.length}`
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: usage_module_default.sideStat,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_module_default.sideLabel,
								children: t("usage.heatmap.busiest")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: `${usage_module_default.sideValue} ${usage_module_default.mono}`,
								children: facts.busiest === void 0 ? "—" : formatTokens(facts.busiest.tokens)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_module_default.sideHint,
								children: facts.busiest === void 0 ? "" : facts.busiest.date.slice(5)
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: usage_module_default.sideStat,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_module_default.sideLabel,
								children: t("usage.heatmap.week")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: `${usage_module_default.sideValue} ${usage_module_default.mono}`,
								children: formatTokens(week.tokens)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_module_default.sideHint,
								children: t("usage.calls", { n: week.calls })
							})
						]
					})
				]
			})]
		})]
	});
});
function QuotaRing(props) {
	const percent = typeof props.percent === "number" ? props.percent : 0;
	const tone = percent >= 90 ? usage_module_default.toneBad : percent >= 70 ? usage_module_default.toneWarn : usage_module_default.toneAccent;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: usage_module_default.gauge,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Ring, {
				percent,
				size: 88,
				stroke: 7,
				tone
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: usage_module_default.gaugeLabel,
				children: props.label
			}),
			props.sub !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: usage_module_default.gaugeSub,
				children: props.sub
			}) : null
		]
	});
}
const QuotaCard = (0, react.memo)(function QuotaCard(props) {
	const { provider, model, onSeeAll } = props;
	const windows = (0, react.useMemo)(() => provider?.plan === void 0 ? [] : orderedPlanWindows(provider.plan), [provider]);
	const identity = provider === void 0 ? void 0 : `${provider.displayName}${model !== void 0 && model !== "" ? ` · ${model}` : ""}`;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: `${usage_module_default.card} ${usage_module_default.quotaCard}`,
		"data-dsh-part": "quota-card",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: usage_module_default.cardHead,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: usage_module_default.cardHeadGroup,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: usage_module_default.cardTitle,
						children: t("usage.plan.quota")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: usage_module_default.scopeChip,
						children: t("usage.scope.account")
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: usage_module_default.linkBtn,
					onClick: onSeeAll,
					children: t("usage.plan.seeAll")
				})]
			}),
			provider !== void 0 && identity !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: usage_module_default.quotaIdentity,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: usage_module_default.providerName,
						children: identity
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: usage_module_default.sourceChip,
						children: t(planSourceLabelKey(provider))
					}),
					provider.plan?.planName !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: usage_module_default.planTier,
						children: provider.plan.planName
					}) : null
				]
			}),
			windows.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: usage_module_default.emptyState,
				"data-dsh-part": "quota-empty",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Ring, {
					percent: null,
					size: 64,
					stroke: 5,
					tone: usage_module_default.toneAccent
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: usage_module_default.emptyBody,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.emptyTitle,
							children: t("usage.plan.noPlan")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.emptyHint,
							children: t("usage.plan.emptyHint")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: usage_module_default.emptyAction,
							onClick: onSeeAll,
							children: t("usage.plan.seeAll")
						})
					]
				})]
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: usage_module_default.gaugesRow,
				children: windows.slice(0, 3).map((window) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(QuotaRing, {
					percent: window.percent,
					label: window.name ?? t(`usage.plan.windows.${window.key}`),
					sub: window.resetsAt !== void 0 ? formatPlanReset(window.resetsAt) : void 0
				}, window.key))
			})
		]
	});
});
const RangeCard = (0, react.memo)(function RangeCard(props) {
	const { range, providers, currentProvider } = props;
	const derived = (0, react.useMemo)(() => {
		return {
			nameOf: new Map(providers.map((provider) => [provider.provider, provider.displayName])),
			grandTotal: range === void 0 ? 0 : totalOf(range.totals)
		};
	}, [providers, range]);
	if (range === void 0) return null;
	const { nameOf, grandTotal } = derived;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: usage_module_default.card,
		"data-dsh-part": "trend-card",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: usage_module_default.cardHead,
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: usage_module_default.cardHeadGroup,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: usage_module_default.cardTitle,
					children: t("usage.trend")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: usage_module_default.scopeChip,
					children: t("usage.scope.device")
				})]
			}), grandTotal > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: usage_module_default.cardMeta,
				children: t("usage.trend.summary", {
					tokens: formatTokens(grandTotal),
					calls: t("usage.calls", { n: range.totals.calls })
				})
			})]
		}), range.providers.length === 0 || grandTotal === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			className: usage_module_default.muted,
			children: t("usage.noData")
		}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: usage_module_default.chart,
			"data-dsh-part": "usage-chart",
			children: [range.providers.map((row) => {
				const total = totalOf(row.totals);
				const share = grandTotal > 0 ? total / grandTotal * 100 : 0;
				const accent = currentProvider === row.provider;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: usage_module_default.chartRow,
					"data-accent": accent ? "yes" : "no",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: usage_module_default.chartHead,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: usage_module_default.chartLead,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {
										className: usage_module_default.providerDot,
										"aria-hidden": "true"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: usage_module_default.chartName,
										children: nameOf.get(row.provider) ?? row.provider
									}),
									accent && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: usage_module_default.currentBadge,
										children: t("usage.current")
									})
								]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: usage_module_default.chartMeta,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: `${usage_module_default.chartShare} ${usage_module_default.mono}`,
									children: percentText$1(share)
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: `${usage_module_default.dim} ${usage_module_default.mono}`,
									children: [formatTokens(total), ` · ${t("usage.calls", { n: row.totals.calls })}`]
								})]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.chartBar,
							"aria-hidden": "true",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_module_default.chartFill,
								style: { width: `${Math.max(1.5, share)}%` }
							})
						}),
						row.models.slice(0, CHART_MODEL_CAP).map((model) => {
							const modelTotal = totalOf(model.totals);
							const modelShare = total > 0 ? modelTotal / total * 100 : 0;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: usage_module_default.chartModel,
								title: `${row.provider} · ${model.model}: ${formatTokens(modelTotal)}`,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: usage_module_default.chartModelName,
										children: model.model
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: usage_module_default.chartModelBar,
										"aria-hidden": "true",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: usage_module_default.chartModelFill,
											style: { width: `${Math.max(1.5, modelShare)}%` }
										})
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: `${usage_module_default.chartModelValue} ${usage_module_default.mono}`,
										children: percentText$1(modelShare)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: `${usage_module_default.chartModelTokens} ${usage_module_default.mono}`,
										children: formatTokens(modelTotal)
									})
								]
							}, model.model);
						})
					]
				}, row.provider);
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: usage_module_default.trendAxis,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: range.from.slice(5) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: range.to.slice(5) })]
			})]
		})]
	});
});
const HistoryCard = (0, react.memo)(function HistoryCard(props) {
	const [open, setOpen] = (0, react.useState)(false);
	const rows = (0, react.useMemo)(() => [...props.days].slice(-14).reverse(), [props.days]);
	const max = (0, react.useMemo)(() => Math.max(1, ...rows.map((day) => totalOf(day.totals))), [rows]);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: usage_module_default.card,
		"data-dsh-part": "history-card",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: usage_module_default.cardHead,
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: usage_module_default.cardHeadGroup,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: usage_module_default.cardTitle,
					children: t("usage.history")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: usage_module_default.scopeChip,
					children: t("usage.scope.device")
				})]
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: usage_module_default.linkBtn,
				"aria-expanded": open,
				onClick: () => setOpen((value) => !value),
				children: open ? t("usage.history.hide") : t("usage.history.show")
			})]
		}), open && (rows.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			className: usage_module_default.muted,
			children: t("usage.history.empty")
		}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			className: usage_module_default.historyGrid,
			children: rows.map((day) => {
				const total = totalOf(day.totals);
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: usage_module_default.historyRow,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: `${usage_module_default.historyDate} ${usage_module_default.mono}`,
							children: day.date.slice(5)
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.historyBar,
							"aria-hidden": "true",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { width: `${Math.max(2, Math.round(total / max * 100))}%` } })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: `${usage_module_default.historyTokens} ${usage_module_default.mono}`,
							children: formatTokens(total)
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.historyCalls,
							children: t("usage.calls", { n: day.totals.calls })
						})
					]
				}, day.date);
			})
		}))]
	});
});
function PlanGroup(props) {
	const { title, providers, currentId, showEmpty, wide } = props;
	if (providers.length === 0 && !showEmpty) return null;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: usage_module_default.planGroup,
		"data-wide": wide === true ? "yes" : "no",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			className: usage_module_default.groupTitle,
			children: providers.length > 1 ? t("usage.plan.groupCount", {
				title,
				n: providers.length
			}) : title
		}), providers.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			className: usage_module_default.groupEmpty,
			children: t("usage.plan.groupEmpty")
		}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			className: usage_module_default.planCards,
			children: providers.map((provider) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PlanCard, {
				provider,
				currentId
			}, provider.provider))
		})]
	});
}
function PlanCard(props) {
	const { provider, currentId } = props;
	const windows = orderedPlanWindows(provider.plan);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: `${usage_module_default.card} ${usage_module_default.planCard}`,
		"data-dsh-part": "plan-card",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: usage_module_default.planHead,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: usage_module_default.planName,
					children: [
						provider.displayName,
						currentId === provider.provider && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.currentBadge,
							children: t("usage.current")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.sourceChip,
							children: t(planSourceLabelKey(provider))
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.scopeChip,
							children: t("usage.scope.account")
						}),
						provider.plan?.planName !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.planTier,
							children: provider.plan.planName
						}) : ""
					]
				})
			}),
			provider.error !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: usage_module_default.errorLine,
				children: t("usage.provider.error", { error: friendlyProbeError(provider.error) ?? provider.error })
			}),
			provider.credential === "none" && provider.plan === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: usage_module_default.muted,
				children: t("usage.balance.noCredential")
			}) : windows.length === 0 ? provider.error === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: usage_module_default.muted,
				children: t("usage.plan.noPlan")
			}) : null : windows.map((window) => {
				const percent = window.percent;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: usage_module_default.windowRow,
					"data-dsh-part": "plan-window",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: usage_module_default.windowLabel,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: window.name ?? t(`usage.plan.windows.${window.key}`) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: `${usage_module_default.mono}`,
								children: percentText$1(percent)
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.bar,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: toneClass$1(percent),
								style: {
									width: `${Math.min(100, Math.max(0, percent))}%`,
									display: "block"
								}
							})
						}),
						window.resetsAt !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.resetLine,
							children: formatPlanReset(window.resetsAt)
						}) : null
					]
				}, window.key);
			})
		]
	});
}
const CONFIG_DEFAULTS = {
	enabled: true,
	pollIntervalSec: 60,
	bubbleMode: "always",
	cpamcEnabled: false,
	cpamcBaseURL: "http://127.0.0.1:8317",
	cpamcAllowedHosts: "",
	volcanoEnabled: false
};
function normalizeSettings(value) {
	const bubble = value?.bubbleMode;
	return {
		enabled: value?.enabled ?? CONFIG_DEFAULTS.enabled,
		pollIntervalSec: typeof value?.pollIntervalSec === "number" ? value.pollIntervalSec : CONFIG_DEFAULTS.pollIntervalSec,
		bubbleMode: bubble === "change" || bubble === "off" || bubble === "always" ? bubble : CONFIG_DEFAULTS.bubbleMode,
		cpamcEnabled: value?.cpamcEnabled ?? CONFIG_DEFAULTS.cpamcEnabled,
		cpamcBaseURL: value?.cpamcBaseURL ?? CONFIG_DEFAULTS.cpamcBaseURL,
		cpamcAllowedHosts: value?.cpamcAllowedHosts ?? CONFIG_DEFAULTS.cpamcAllowedHosts,
		volcanoEnabled: value?.volcanoEnabled ?? CONFIG_DEFAULTS.volcanoEnabled
	};
}
/**
* Config tab for plugins.item: edits stay staged until Save.
* Matches the official Plugins page contract (leave page → discard draft).
*/
function SettingsRow(props) {
	const { settings, snapshot, value, providers = [], credentials, setCredential, clearCredential } = props;
	const disabled = snapshot !== void 0 && !snapshot.writable;
	const [draft, setDraft] = (0, react.useState)(() => normalizeSettings(value));
	const [dirty, setDirty] = (0, react.useState)(false);
	const [saving, setSaving] = (0, react.useState)(false);
	const [saveError, setSaveError] = (0, react.useState)();
	(0, react.useEffect)(() => {
		if (dirty) return;
		setDraft(normalizeSettings(value));
	}, [value, dirty]);
	const edit = (field, next) => {
		setDraft((prev) => ({
			...prev,
			[field]: next
		}));
		setDirty(true);
		setSaveError(void 0);
	};
	const discard = () => {
		setDraft(normalizeSettings(value));
		setDirty(false);
		setSaveError(void 0);
	};
	const save = () => {
		if (disabled || saving || !dirty) return;
		setSaving(true);
		setSaveError(void 0);
		const ops = [
			{
				op: "set",
				path: ["enabled"],
				value: draft.enabled
			},
			{
				op: "set",
				path: ["pollIntervalSec"],
				value: draft.pollIntervalSec
			},
			{
				op: "set",
				path: ["bubbleMode"],
				value: draft.bubbleMode
			},
			{
				op: "set",
				path: ["cpamcEnabled"],
				value: draft.cpamcEnabled
			},
			{
				op: "set",
				path: ["cpamcBaseURL"],
				value: draft.cpamcBaseURL
			},
			{
				op: "set",
				path: ["cpamcAllowedHosts"],
				value: draft.cpamcAllowedHosts
			},
			{
				op: "set",
				path: ["volcanoEnabled"],
				value: draft.volcanoEnabled
			}
		];
		settings.mutate(ops, snapshot?.revision).then((ok) => {
			setSaving(false);
			if (!ok) {
				setSaveError(t("usage.config.saveFailed"));
				return;
			}
			setDirty(false);
		}, (err) => {
			setSaving(false);
			setSaveError(err instanceof Error ? err.message : String(err));
		});
	};
	const cpamc = providers.find((provider) => provider.source === "cpamc");
	const volcano = providers.find((provider) => provider.source === "volcano");
	const cpamcOn = draft.cpamcEnabled;
	const volcanoOn = draft.volcanoEnabled;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: usage_module_default.card,
		"data-dsh-part": "settings-row",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			className: usage_module_default.cardTitle,
			children: t("usage.config.title")
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: usage_module_default.settingsForm,
			children: [
				disabled && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: usage_module_default.muted,
					children: t("usage.config.readonly")
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: usage_module_default.settingsSection,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.subTitle,
							children: t("usage.config.basic")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: usage_module_default.settingRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("usage.config.enabled") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: draft.enabled,
								disabled: disabled || saving,
								onChange: (event) => {
									edit("enabled", event.target.checked);
								}
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: usage_module_default.settingRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("usage.config.pollIntervalSec") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "number",
								min: 30,
								max: 3600,
								value: draft.pollIntervalSec,
								disabled: disabled || saving,
								onChange: (event) => {
									const parsed = Number(event.target.value);
									if (Number.isFinite(parsed) && parsed >= 30 && parsed <= 3600) edit("pollIntervalSec", Math.round(parsed));
								}
							})]
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: usage_module_default.settingsSection,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: usage_module_default.subTitle,
						children: t("usage.config.display")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: usage_module_default.settingRow,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("usage.config.bubbleMode") }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
							value: draft.bubbleMode,
							disabled: disabled || saving,
							onChange: (event) => {
								const next = event.target.value;
								if (next === "always" || next === "change" || next === "off") edit("bubbleMode", next);
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "always",
									children: t("usage.config.bubbleMode.always")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "change",
									children: t("usage.config.bubbleMode.change")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "off",
									children: t("usage.config.bubbleMode.off")
								})
							]
						})]
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: usage_module_default.settingsSection,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.subTitle,
							children: t("usage.config.external")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: usage_module_default.settingRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("usage.config.cpamc") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: cpamcOn,
								disabled: disabled || saving,
								onChange: (event) => {
									edit("cpamcEnabled", event.target.checked);
								}
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: usage_module_default.settingRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("usage.config.cpamcUrl") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "text",
								value: draft.cpamcBaseURL,
								disabled: disabled || saving || !cpamcOn,
								placeholder: t("usage.config.cpamcUrl.placeholder"),
								onChange: (event) => {
									edit("cpamcBaseURL", event.target.value);
								}
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: usage_module_default.settingRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("usage.config.cpamcAllowedHosts") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "text",
								value: draft.cpamcAllowedHosts,
								disabled: disabled || saving || !cpamcOn,
								placeholder: "cli.example.com",
								onChange: (event) => {
									edit("cpamcAllowedHosts", event.target.value);
								}
							})]
						}),
						cpamcOn && !isCpamcLoopbackUrl(draft.cpamcBaseURL, draft.cpamcAllowedHosts) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.settingWarn,
							children: t("usage.config.cpamcUrl.invalid")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SecretField, {
							label: t("usage.config.cpamcToken"),
							configured: credentials?.cpamc === true,
							disabled: disabled || !cpamcOn,
							onSave: (secret) => setCredential("cpamc", secret),
							onClear: () => clearCredential("cpamc")
						}),
						cpamc !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: cpamc.error !== void 0 ? usage_module_default.settingWarn : usage_module_default.settingHint,
							children: [cpamc.displayName, cpamc.error !== void 0 ? ` · ${friendlyProbeError(cpamc.error) ?? cpamc.error}` : `${balanceText(cpamc) !== null ? ` · ${balanceText(cpamc)}` : ""}${cpamc.plan?.windows?.[0]?.percent !== void 0 ? ` · ${t("usage.plan.windows.5h.short")} ${Math.round(cpamc.plan.windows[0].percent)}%` : ""}`]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: usage_module_default.settingRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("usage.config.volcano") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: volcanoOn,
								disabled: disabled || saving,
								onChange: (event) => {
									edit("volcanoEnabled", event.target.checked);
								}
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SecretField, {
							label: t("usage.config.volcanoAk"),
							configured: credentials?.volcanoAk === true,
							disabled: disabled || !volcanoOn,
							onSave: (secret) => setCredential("volcano.ak", secret),
							onClear: () => clearCredential("volcano.ak")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SecretField, {
							label: t("usage.config.volcanoSk"),
							configured: credentials?.volcanoSk === true,
							disabled: disabled || !volcanoOn,
							onSave: (secret) => setCredential("volcano.sk", secret),
							onClear: () => clearCredential("volcano.sk")
						}),
						volcano !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: volcano.error !== void 0 ? usage_module_default.settingWarn : usage_module_default.settingHint,
							children: [volcano.displayName, volcano.error !== void 0 ? ` · ${volcano.error}` : `${balanceText(volcano) !== null ? ` · ${balanceText(volcano)}` : ""}${volcano.plan?.windows?.[0]?.percent !== void 0 ? ` · ${t("usage.plan.windows.5h.short")} ${Math.round(volcano.plan.windows[0].percent)}%` : ""}`]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.muted,
							children: t("usage.config.externalHint")
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: usage_module_default.configActions,
					children: [
						saveError !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.settingWarn,
							children: saveError
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: usage_module_default.refreshBtn,
							disabled: disabled || saving || !dirty,
							onClick: discard,
							children: t("usage.config.discard")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: usage_module_default.refreshBtn,
							disabled: disabled || saving || !dirty,
							onClick: save,
							children: saving ? t("usage.config.saving") : t("usage.config.save")
						})
					]
				})
			]
		})]
	});
}
function SecretField(props) {
	const [draft, setDraft] = (0, react.useState)("");
	const [busy, setBusy] = (0, react.useState)(false);
	const [error, setError] = (0, react.useState)();
	const save = () => {
		const value = draft.trim();
		if (value === "" || busy || props.disabled) return;
		setBusy(true);
		setError(void 0);
		props.onSave(value).then(() => {
			setDraft("");
			setBusy(false);
		}, (err) => {
			setBusy(false);
			setError(err instanceof Error ? err.message : String(err));
		});
	};
	const clear = () => {
		if (busy || props.disabled || !props.configured) return;
		setBusy(true);
		setError(void 0);
		props.onClear().then(() => {
			setDraft("");
			setBusy(false);
		}, (err) => {
			setBusy(false);
			setError(err instanceof Error ? err.message : String(err));
		});
	};
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: usage_module_default.secretField,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: usage_module_default.settingRow,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [props.label, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: usage_module_default.secretStatus,
					"data-configured": props.configured ? "yes" : "no",
					children: props.configured ? t("usage.config.secret.configured") : t("usage.config.secret.missing")
				})] })
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: usage_module_default.secretControls,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						type: "password",
						autoComplete: "off",
						spellCheck: false,
						placeholder: props.configured ? t("usage.config.secret.replace") : t("usage.config.secret.placeholder"),
						value: draft,
						disabled: props.disabled || busy,
						onChange: (event) => {
							setDraft(event.target.value);
						},
						onKeyDown: (event) => {
							if (event.key === "Enter") save();
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: usage_module_default.refreshBtn,
						disabled: props.disabled || busy || draft.trim() === "",
						onClick: save,
						children: t("usage.config.secret.save")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: usage_module_default.refreshBtn,
						disabled: props.disabled || busy || !props.configured,
						onClick: clear,
						children: t("usage.config.secret.clear")
					})
				]
			}),
			error !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: usage_module_default.muted,
				children: error
			})
		]
	});
}
function StateGlyph(props) {
	if (props.kind === "loading") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
		className: usage_module_default.spinner,
		"aria-hidden": "true"
	});
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
		className: usage_module_default.stateIcon,
		viewBox: "0 0 24 24",
		width: "20",
		height: "20",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "1.5",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		children: props.kind === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
				cx: "12",
				cy: "12",
				r: "9"
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M12 8v5" }),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M12 16.2v.1" })
		] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
				cx: "12",
				cy: "12",
				r: "9"
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M9.6 9.6a2.4 2.4 0 1 1 3.4 2.2c-.7.35-1 .9-1 1.7" }),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M12 16.6v.1" })
		] })
	});
}
/** The section component; the slot merges the face into these props. */
function UsageSectionCard(props) {
	const { store, poll, refresh, settings, setCredential, clearCredential, view } = props;
	if (view === "summary") return t("usage.intro");
	const ui = (0, react.useSyncExternalStore)(store.subscribe, store.getSnapshot);
	const settingsSnapshot = settings.getSnapshot();
	const settingsValue = settingsSnapshot.value ?? {};
	const [tab, setTab] = (0, react.useState)("usage");
	const [refreshing, setRefreshing] = (0, react.useState)(false);
	const [, bumpSettings] = (0, react.useState)(0);
	(0, react.useEffect)(() => settings.subscribe(() => bumpSettings((count) => count + 1)), [settings]);
	const enabled = settingsValue.enabled ?? true;
	(0, react.useEffect)(() => {
		if (!enabled) return void 0;
		poll();
		let timer;
		const start = () => {
			if (timer === void 0 && document.visibilityState === "visible") timer = window.setInterval(poll, SECTION_POLL_MS);
		};
		const onVisibility = () => {
			if (document.visibilityState === "visible") {
				poll();
				start();
			} else if (timer !== void 0) {
				window.clearInterval(timer);
				timer = void 0;
			}
		};
		start();
		document.addEventListener("visibilitychange", onVisibility);
		return () => {
			if (timer !== void 0) window.clearInterval(timer);
			document.removeEventListener("visibilitychange", onVisibility);
		};
	}, [poll, enabled]);
	const snapshot = ui.snapshot;
	const onRefresh = () => {
		setRefreshing(true);
		try {
			refresh();
		} finally {
			window.setTimeout(() => setRefreshing(false), 3e3);
		}
	};
	if (!enabled || ui.status === "error" || snapshot === null) {
		const state = !enabled ? "disabled" : ui.status === "error" ? "error" : "loading";
		return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: usage_module_default.section,
			"data-dsh-plugin": "usage",
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: usage_module_default.stateCard,
					"data-state": state,
					"data-dsh-part": "status-line",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StateGlyph, { kind: state }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: usage_module_default.stateBody,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_module_default.stateTitle,
								children: state === "disabled" ? t("usage.disabled") : state === "error" ? t("usage.error", { error: ui.error ?? "" }) : t("usage.loading")
							}), state !== "disabled" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_module_default.stateDetail,
								children: t("usage.intro")
							})]
						}),
						state === "error" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: usage_module_default.refreshBtn,
							onClick: () => poll(),
							children: t("usage.retry")
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: usage_module_default.tabs,
					role: "tablist",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						role: "tab",
						"aria-selected": true,
						className: `${usage_module_default.tab} ${usage_module_default.tabActive}`,
						children: t("usage.tab.settings")
					})
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingsRow, {
					settings,
					snapshot: settingsSnapshot.status === "ready" ? settingsSnapshot : void 0,
					value: settingsValue,
					setCredential,
					clearCredential
				})
			]
		});
	}
	const current = snapshot.current;
	const currentProvider = snapshot.providers.find((provider) => provider.provider === current.provider);
	const matchedPlan = currentPlanProvider(snapshot);
	const deepseekPeriod = deepseekPeriodAt(Date.now());
	const deepseekVisible = current.provider !== void 0 && isDeepSeekProviderRoute(current.provider) || snapshot.usage.today.providers.some((row) => isDeepSeekProviderRoute(row.provider));
	const planProviders = planTabProviders(snapshot.providers);
	const modelPlans = planProviders.filter((provider) => provider.source === void 0 || provider.source === "model");
	const cpamcPlans = planProviders.filter((provider) => provider.source === "cpamc");
	const volcanoPlans = planProviders.filter((provider) => provider.source === "volcano");
	const days = snapshot.usage.days;
	const todayTotals = snapshot.usage.today.totals;
	const rangeTotals = snapshot.usage.range?.totals ?? todayTotals;
	const allTotals = snapshot.usage.all?.totals ?? rangeTotals;
	const todayTokens = totalOf(todayTotals);
	const yesterdayTokens = days.length >= 2 ? totalOf(days[days.length - 2].totals) : void 0;
	const tokenDelta = yesterdayTokens !== void 0 && yesterdayTokens > 0 ? (todayTokens - yesterdayTokens) / yesterdayTokens * 100 : null;
	const hitRate = cacheHitRate(todayTotals);
	const billedToday = todayTotals.inputTokens + todayTotals.cacheReadTokens + todayTotals.cacheWriteTokens;
	const avgCost = todayTotals.calls > 0 && todayTotals.cost > 0 ? todayTotals.cost / todayTotals.calls : null;
	const ageMs = Date.now() - snapshot.updatedAt;
	const fresh = Number.isFinite(ageMs) && ageMs >= 0 && ageMs < FRESH_WINDOW_MS;
	const todayProviderIds = new Set(snapshot.usage.today.providers.map((row) => row.provider));
	const identity = currentProvider === void 0 ? void 0 : `${currentProvider.displayName}${current.model !== void 0 && current.model !== "" ? ` · ${current.model}` : ""}`;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: usage_module_default.section,
		"data-dsh-plugin": "usage",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
				className: usage_module_default.pageHead,
				"data-dsh-part": "header",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: usage_module_default.pageHeadMain,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: usage_module_default.pageIdentity,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.identityName,
							children: identity ?? t("usage.noData")
						}), currentProvider !== void 0 && balanceText(currentProvider) !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: `${usage_module_default.identityBalance} ${usage_module_default.mono}`,
							children: balanceText(currentProvider)
						})]
					})
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: usage_module_default.headActions,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: usage_module_default.freshness,
						"data-fresh": fresh ? "yes" : "no",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {
							className: usage_module_default.freshnessDot,
							"aria-hidden": "true"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.mono,
							children: t("usage.updated", { time: formatTime(snapshot.updatedAt) })
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: usage_module_default.refreshBtn,
						onClick: onRefresh,
						disabled: refreshing,
						"data-busy": refreshing ? "yes" : "no",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RefreshIcon, { spinning: refreshing }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: refreshing ? t("usage.refreshing") : t("usage.refresh") })]
					})]
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: usage_module_default.toolbar,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: usage_module_default.tabs,
					role: "tablist",
					"data-dsh-part": "tabs",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							role: "tab",
							"aria-selected": tab === "usage",
							className: tab === "usage" ? `${usage_module_default.tab} ${usage_module_default.tabActive}` : usage_module_default.tab,
							onClick: () => setTab("usage"),
							children: t("usage.tab.usage")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							role: "tab",
							"aria-selected": tab === "plans",
							className: tab === "plans" ? `${usage_module_default.tab} ${usage_module_default.tabActive}` : usage_module_default.tab,
							onClick: () => setTab("plans"),
							children: t("usage.tab.plans")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							role: "tab",
							"aria-selected": tab === "settings",
							className: tab === "settings" ? `${usage_module_default.tab} ${usage_module_default.tabActive}` : usage_module_default.tab,
							onClick: () => setTab("settings"),
							children: t("usage.tab.settings")
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: usage_module_default.scopeNote,
					"data-dsh-part": "scope-note",
					children: t(`usage.scope.note.${tab}`)
				})]
			}),
			tab === "usage" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: usage_module_default.cockpit,
				"data-dsh-part": "usage-cockpit",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: `${usage_module_default.cell} ${usage_module_default.cell12}`,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(HeroBand, {
							todayTokens,
							todayCalls: todayTotals.calls,
							todayCost: todayTotals.cost,
							tokenDelta,
							rangeTokens: totalOf(rangeTotals),
							rangeCalls: rangeTotals.calls,
							allTokens: totalOf(allTotals),
							allCalls: allTotals.calls,
							hitRate,
							cacheRead: todayTotals.cacheReadTokens,
							billed: billedToday,
							avgCost
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: `${usage_module_default.cell} ${usage_module_default.cell7}`,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(HeatmapCard, { days })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: `${usage_module_default.cell} ${usage_module_default.cell5}`,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(QuotaCard, {
							provider: matchedPlan,
							model: current.model,
							onSeeAll: () => setTab("plans")
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: `${usage_module_default.cell} ${usage_module_default.cell7}`,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RangeCard, {
							range: snapshot.usage.range,
							providers: snapshot.providers,
							currentProvider: current.provider
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: `${usage_module_default.cell} ${usage_module_default.cell5}`,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							className: usage_module_default.card,
							"data-dsh-part": "provider-card",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: usage_module_default.cardHead,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: usage_module_default.cardHeadGroup,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: usage_module_default.cardTitle,
											children: t("usage.today")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: usage_module_default.scopeChip,
											children: t("usage.scope.device")
										})]
									}), deepseekVisible && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: usage_module_default.peakPill,
										"data-dsh-part": "peak-status",
										children: t(deepseekPeriod.peak ? "usage.peak.on" : "usage.peak.off", { time: formatClock(deepseekPeriod.boundaryMs) })
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProviderBreakdown, {
									rows: snapshot.usage.today.providers,
									providers: snapshot.providers,
									current: current.provider
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BalanceInline, {
									providers: snapshot.providers,
									current: current.provider,
									excludeIds: todayProviderIds
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TokenComposition, { totals: todayTotals })
							]
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: `${usage_module_default.cell} ${usage_module_default.cell12}`,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(HistoryCard, { days })
					})
				]
			}),
			tab === "plans" && (planProviders.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: usage_module_default.card,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: usage_module_default.muted,
					children: t("usage.plan.noneConfigured")
				})
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: usage_module_default.plans,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(PlanGroup, {
						wide: true,
						title: t("usage.plan.group.models"),
						providers: modelPlans,
						currentId: matchedPlan?.provider,
						showEmpty: true
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(PlanGroup, {
						title: t("usage.plan.group.cpamc"),
						providers: cpamcPlans,
						currentId: matchedPlan?.provider,
						showEmpty: true
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(PlanGroup, {
						title: t("usage.plan.group.volcano"),
						providers: volcanoPlans,
						currentId: matchedPlan?.provider,
						showEmpty: true
					})
				]
			})),
			tab === "settings" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingsRow, {
				settings,
				snapshot: settingsSnapshot.status === "ready" ? settingsSnapshot : void 0,
				value: settingsValue,
				providers: snapshot.providers,
				credentials: snapshot.externalCredentials,
				setCredential,
				clearCredential
			})
		]
	});
}
//#endregion
//#region src/client/session-route.ts
/**
* Normalize one projected selection state onto a plan route. The wire view
* already ensures `next = pending ?? lastUsed`, so `next` is the session's
* effective route whenever it exists.
*/
function sessionRouteFrom(snapshot) {
	if (typeof snapshot !== "object" || snapshot === null) return void 0;
	const view = snapshot;
	const picked = view.next ?? view.lastUsed;
	if (typeof picked !== "object" || picked === null) return void 0;
	const provider = typeof picked.provider === "string" ? picked.provider : "";
	if (provider === "") return void 0;
	const model = typeof picked.model === "string" && picked.model !== "" ? picked.model : void 0;
	return {
		provider,
		...model !== void 0 ? { model } : {}
	};
}
//#endregion
//#region src/client/PlanUsageStrip.tsx
/** Ship one diagnostic line to the host when the state key changes. */
let lastDiagKey = "";
let lastDiagAt = 0;
function reportDiag(kind, key) {
	const now = Date.now();
	const full = `${kind}:${key}`;
	if (kind === "strip-state" && full === lastDiagKey && now - lastDiagAt < 3e4) return;
	if (kind === "strip-state") {
		lastDiagKey = full;
		lastDiagAt = now;
	}
	try {
		fetch("/api/dsh-usage-plus/client-diag", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				kind,
				key
			})
		}).catch(() => {});
	} catch {}
}
/** Match official ContextMeter ring geometry (14px viewBox, r=5.5). */
const RADIUS = 5.5;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
function percentText(value) {
	return `${value >= 10 ? Math.round(value) : value.toFixed(1)}%`;
}
function windowShort(window) {
	if (window.key === "5h") return t("usage.plan.windows.5h.short");
	if (window.key === "week") return t("usage.plan.windows.week.short");
	if (window.key === "month") return t("usage.plan.windows.month.short");
	return window.name ?? window.key;
}
function windowLabel(window) {
	return window.name ?? t(`usage.plan.windows.${window.key}`);
}
function toneClass(percent) {
	if (percent >= 90) return usage_module_default.quotaMeterDanger;
	if (percent >= 70) return usage_module_default.quotaMeterWarn;
	return "";
}
function barTone(percent) {
	if (percent >= 90) return `${usage_module_default.barFill} ${usage_module_default.barLow}`;
	if (percent >= 70) return `${usage_module_default.barFill} ${usage_module_default.barWarn}`;
	return usage_module_default.barFill;
}
function primaryWindow(windows) {
	return windows.reduce((worst, window) => window.percent > worst.percent ? window : worst);
}
function routeOverride(selection) {
	const route = sessionRouteFrom(selection);
	if (route === void 0) return void 0;
	return {
		provider: route.provider,
		...route.model !== void 0 ? { model: route.model } : {}
	};
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
function PlanUsageStrip(props) {
	const { store } = props;
	const ui = (0, react.useSyncExternalStore)(store.subscribe, store.getSnapshot);
	const [open, setOpen] = (0, react.useState)(false);
	const rootRef = (0, react.useRef)(null);
	const useProjection = props.useProjection;
	const override = routeOverride(useProjection !== void 0 ? useProjection("modelSelection") : void 0);
	(0, react.useEffect)(() => {
		if (props.startStripPolling === void 0) return;
		return props.startStripPolling();
	}, [props.startStripPolling]);
	(0, react.useEffect)(() => {
		if (!open) return;
		const onPointerDown = (event) => {
			if (event.target instanceof Node && rootRef.current?.contains(event.target) === true) return;
			setOpen(false);
		};
		const onKeyDown = (event) => {
			if (event.key === "Escape") setOpen(false);
		};
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [open]);
	const snapshot = ui.snapshot;
	const provider = override !== void 0 ? currentPlanProvider(snapshot, override) : currentPlanProvider(snapshot);
	const windows = provider === void 0 || provider.plan === void 0 ? [] : orderedPlanWindows(provider.plan).filter((window) => typeof window.percent === "number");
	const overrideLabel = override === void 0 ? "none" : `${override.provider}:${override.model ?? ""}`;
	reportDiag("strip-state", `snapshot=${snapshot === null ? "null" : "ok"} provider=${provider === void 0 ? "none" : provider.provider} windows=${windows.length} override=${overrideLabel} sessionId=${props.sessionId ?? "∅"}`);
	if (snapshot === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
		"data-usage-strip-state": "snapshot-null",
		style: { display: "none" }
	});
	if (provider === void 0 || windows.length === 0) {
		const emptyReason = provider === void 0 ? `no-provider-match:${overrideLabel}` : `provider=${provider.provider}`;
		return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			"data-usage-strip-state": `empty:${emptyReason}`,
			style: { display: "none" }
		});
	}
	const percent = primaryWindow(windows).percent;
	const level = toneClass(percent);
	const windowSummary = windows.map((window) => `${windowShort(window)} ${percentText(window.percent)}`).join(" · ");
	const model = override?.model ?? snapshot.current.model;
	const source = t(planSourceLabelKey(provider));
	const identity = model === void 0 || model === "" ? provider.displayName : `${provider.displayName} · ${model}`;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
		ref: rootRef,
		className: `${usage_module_default.quotaMeter} ${level}`,
		"data-dsh-plugin": "usage-plus",
		"data-dsh-part": "quota-meter",
		"data-usage-plus-rev": "4",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
			type: "button",
			className: usage_module_default.quotaMeterTrigger,
			"aria-label": `${identity} · ${source} · ${t("usage.plan.quota")} · ${windowSummary}`,
			"aria-haspopup": "dialog",
			"aria-expanded": open,
			title: `${identity}\n${source} · ${t("usage.plan.quota")}\n${windows.map((window) => `${windowLabel(window)} ${percentText(window.percent)}`).join(" · ")}`,
			onClick: () => {
				setOpen((value) => !value);
			},
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
					viewBox: "0 0 14 14",
					width: "16",
					height: "16",
					"aria-hidden": "true",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						className: usage_module_default.quotaMeterTrack,
						cx: "7",
						cy: "7",
						r: RADIUS
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						className: usage_module_default.quotaMeterFill,
						cx: "7",
						cy: "7",
						r: RADIUS,
						strokeDasharray: `${CIRCUMFERENCE * Math.min(100, Math.max(0, percent)) / 100} ${CIRCUMFERENCE}`,
						transform: "rotate(-90 7 7)"
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: usage_module_default.quotaMeterLabel,
					children: t("usage.plan.quota")
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: usage_module_default.quotaMeterReading,
					children: windowSummary
				})
			]
		}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: usage_module_default.quotaMeterPanel,
			role: "dialog",
			"aria-label": identity,
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: usage_module_default.quotaMeterHeader,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: usage_module_default.quotaMeterIdentity,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.quotaMeterName,
							children: identity
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: usage_module_default.quotaMeterMeta,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_module_default.sourceChip,
								children: source
							}), provider.plan?.planName !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: provider.plan.planName }) : null]
						})]
					})
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: usage_module_default.quotaMeterBars,
					children: windows.map((window) => {
						const value = window.percent;
						return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: `${usage_module_default.quotaMeterBarRow} ${toneClass(value)}`,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: usage_module_default.quotaMeterBarHead,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: windowLabel(window) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: usage_module_default.quotaMeterBarPct,
										children: percentText(value)
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: usage_module_default.bar,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: barTone(value),
										style: {
											width: `${Math.min(100, Math.max(0, value))}%`,
											display: "block"
										}
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: usage_module_default.quotaMeterReset,
									children: formatPlanReset(window.resetsAt)
								})
							]
						}, window.key);
					})
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: usage_module_default.quotaMeterFoot,
					children: t("usage.plan.quota.tightest")
				})
			]
		})]
	});
}
//#endregion
//#region src/client/index.ts
/**
* Must match `USAGE_ENTRY_ID` / cordis.patch.yml `id: usage-plus`.
* Host and client bundles compile separately, so this literal is duplicated.
*/
const USAGE_ENTRY_ID = "usage-plus";
/** Hard ceiling for one usage API call; a stalled host must not pile up requests. */
const USAGE_FETCH_TIMEOUT_MS = 2e4;
/** Plugins-page order among official / third-party item cards. */
const PAGE_ORDER = 40;
/** Composer-strip poll cadence (one shared interval for every strip). */
const STRIP_POLL_MS = 3e4;
/** Collapse a burst of composer interactions into one trailing poll. */
const STRIP_INTERACTION_DEBOUNCE_MS = 250;
/**
* Collapse a burst of poll triggers (strip mount, tab refocus, composer
* interaction) into one request. The overview poller is shared by the Plugins
* section and every composer strip, so without this window a route change
* would fan out into several identical conditional GETs.
*/
const POLL_DEDUPE_MS = 750;
/** Document visibility, guarded for non-DOM (SSR/test) execution. */
function isDocumentVisible() {
	return typeof document === "undefined" || document.visibilityState === "visible";
}
async function usageFetch(path, method, body) {
	const response = await fetch(path, {
		method,
		...body !== void 0 ? {
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body)
		} : {},
		signal: AbortSignal.timeout(USAGE_FETCH_TIMEOUT_MS)
	});
	if (!response.ok) throw new Error("usage " + path + " failed: " + response.status);
	return await response.json();
}
async function credentialMutation(action, target, value) {
	const payload = await usageFetch("/api/dsh-usage-plus/credentials", "POST", action === "set" ? {
		action,
		target,
		value
	} : {
		action,
		target
	});
	if (!payload.ok || payload.overview === void 0) throw new Error("usage credential mutation failed");
	return payload.overview;
}
/**
* Read the overview, revalidating with the previous ETag so an unchanged
* document answers 304 instead of a full body on every poll.
*/
async function fetchOverview(ifNoneMatch) {
	const response = await fetch("/api/dsh-usage-plus/overview", {
		method: "GET",
		...ifNoneMatch === void 0 ? {} : { headers: { "if-none-match": ifNoneMatch } },
		signal: AbortSignal.timeout(USAGE_FETCH_TIMEOUT_MS)
	});
	if (response.status === 304) return { notModified: true };
	if (!response.ok) throw new Error("usage /api/dsh-usage-plus/overview failed: " + response.status);
	const etag = response.headers.get("etag");
	return {
		notModified: false,
		snapshot: await response.json(),
		...etag === null ? {} : { etag }
	};
}
const usageApi = {
	refresh: () => usageFetch("/api/dsh-usage-plus/refresh", "POST"),
	setCredential: (target, value) => credentialMutation("set", target, value),
	clearCredential: (target) => credentialMutation("clear", target)
};
/**
* Required services.
* configForms: Host entry forms keyed by profile entry id
* (@see @deepseek-ai/dsh-client-ui-settings README).
*/
const inject = [
	"slots",
	"locale",
	"connection",
	"remote",
	"configForms"
];
/**
* Client plugin body: register dictionaries, the Plugins-page card (while the
* Host serves `usage-plus`), and the composer plan strip.
*/
function apply(ctx) {
	ctx.effect(() => {
		try {
			return ctx.locale.register(NS, {
				zh,
				en
			});
		} catch {
			return () => {};
		}
	}, "dsh-usage-plus: dictionaries");
	const settingsForm = ctx.configForms.get(USAGE_ENTRY_ID);
	const store = createUsageStore().create();
	let disposed = false;
	/** Bumped on every started read; older in-flight results are dropped. */
	let pollSeq = 0;
	/** Last ETag served for the overview; `undefined` forces a full read. */
	let overviewEtag;
	/** The one in-flight fetch: concurrent pollers join it instead of fanning out. */
	let inFlight;
	/** Work requested while a fetch was in flight; one trailing refresh wins over a poll. */
	let pending;
	/** Start instant of the last fetch; a burst of triggers inside this window is one request. */
	let lastFetchStartAt = 0;
	const setError = (seq, error) => {
		if (seq !== pollSeq) return;
		store.actions.setState("error", error instanceof Error ? error.message : String(error));
	};
	/** Release the in-flight slot and run the single queued request, if any. */
	const settle = () => {
		inFlight = void 0;
		if (disposed || pending === void 0) return;
		const next = pending;
		pending = void 0;
		if (next === "refresh") startRefresh();
		else if (isDocumentVisible()) startPoll(true);
	};
	/**
	* Start one overview read unless a read is already running (then queue one
	* trailing poll) or a burst just fired (then drop it). `force` bypasses the
	* burst window for a trailing/queued poll.
	*/
	function startPoll(force = false) {
		if (disposed) return;
		if (inFlight !== void 0) {
			if (pending !== "refresh") pending = "poll";
			return;
		}
		const now = Date.now();
		if (!force && now - lastFetchStartAt < POLL_DEDUPE_MS) return;
		lastFetchStartAt = now;
		const seq = ++pollSeq;
		inFlight = fetchOverview(overviewEtag).then((result) => {
			if (seq !== pollSeq) return;
			if (result.notModified) {
				if (store.getSnapshot().status !== "ready") store.actions.setState("ready", null);
				return;
			}
			if (result.etag !== void 0) overviewEtag = result.etag;
			store.actions.setSnapshot(result.snapshot);
		}, (error) => setError(seq, error)).finally(settle);
	}
	/**
	* Start one forced host refresh (`POST /refresh`) and apply its snapshot.
	* A refresh requested during a read queues behind it so two request kinds
	* never race on the same store.
	*/
	function startRefresh() {
		if (disposed) return;
		if (inFlight !== void 0) {
			pending = "refresh";
			return;
		}
		lastFetchStartAt = Date.now();
		const seq = ++pollSeq;
		inFlight = usageApi.refresh().then((snapshot) => {
			if (seq !== pollSeq) return;
			overviewEtag = void 0;
			store.actions.setSnapshot(snapshot);
		}, (error) => setError(seq, error)).finally(settle);
	}
	const poll = () => startPoll();
	const refresh = () => startRefresh();
	const applyOverview = (snapshot) => {
		pollSeq += 1;
		overviewEtag = void 0;
		store.actions.setSnapshot(snapshot);
	};
	let stripRefs = 0;
	let stripTimer;
	let interactionTimer;
	const onVisible = () => {
		if (isDocumentVisible()) poll();
	};
	const onComposerInteract = (event) => {
		const target = event.target;
		if (!(target instanceof Element)) return;
		if (target.closest("[data-slot=\"conversation.composer\"], [data-slot=\"conversation.input\"], [data-slot=\"conversation.composer.dock\"]") === null) return;
		if (interactionTimer !== void 0) window.clearTimeout(interactionTimer);
		interactionTimer = window.setTimeout(() => {
			interactionTimer = void 0;
			if (isDocumentVisible()) poll();
		}, STRIP_INTERACTION_DEBOUNCE_MS);
	};
	const startStripPolling = () => {
		stripRefs += 1;
		if (stripRefs === 1) {
			stripTimer = window.setInterval(() => {
				if (isDocumentVisible()) poll();
			}, STRIP_POLL_MS);
			document.addEventListener("visibilitychange", onVisible);
			document.addEventListener("pointerup", onComposerInteract, true);
			document.addEventListener("change", onComposerInteract, true);
		}
		if (isDocumentVisible()) poll();
		return () => {
			stripRefs -= 1;
			if (stripRefs === 0 && stripTimer !== void 0) {
				window.clearInterval(stripTimer);
				stripTimer = void 0;
				if (interactionTimer !== void 0) {
					window.clearTimeout(interactionTimer);
					interactionTimer = void 0;
				}
				document.removeEventListener("visibilitychange", onVisible);
				document.removeEventListener("pointerup", onComposerInteract, true);
				document.removeEventListener("change", onComposerInteract, true);
			}
		};
	};
	ctx.effect(() => () => {
		disposed = true;
		pending = void 0;
	}, "dsh-usage-plus: polling");
	const setCredential = async (target, value) => {
		applyOverview(await usageApi.setCredential(target, value));
	};
	const clearCredential = async (target) => {
		applyOverview(await usageApi.clearCredential(target));
	};
	const face = () => ({
		store,
		poll,
		refresh,
		settings: settingsForm,
		setCredential,
		clearCredential,
		startStripPolling
	});
	ctx.effect(() => ctx.configForms.whileServed([USAGE_ENTRY_ID], () => {
		try {
			return ctx.slots.inject("plugins.item", () => {
				try {
					const unregister = ctx.slots.register({
						name: "plugins.item",
						id: USAGE_ENTRY_ID,
						order: PAGE_ORDER,
						label: () => ctx.locale.bind(NS)("usage.title"),
						locale: NS,
						inject: face
					}, UsageSectionCard);
					return () => {
						unregister();
					};
				} catch (error) {
					console.error("[dsh-usage-plus] plugins.item registration failed:", error);
					return () => {};
				}
			});
		} catch (error) {
			console.error("[dsh-usage-plus] plugins.item inject failed:", error);
			return () => {};
		}
	}), "dsh-usage-plus: plugins page");
	ctx.slots.inject("conversation.composer.dock", () => {
		try {
			const unregister = ctx.slots.register({
				name: "conversation.composer.dock",
				id: "dsh-usage-plus-plan-strip",
				order: 10,
				inject: () => ({
					store,
					startStripPolling
				})
			}, PlanUsageStrip);
			console.info("[dsh-usage-plus] plan strip registered on conversation.composer.dock");
			reportDiag("registered", "conversation.composer.dock");
			return () => {
				console.info("[dsh-usage-plus] plan strip unregistered from conversation.composer.dock");
				unregister();
			};
		} catch (error) {
			console.error("[dsh-usage-plus] plan strip registration failed on conversation.composer.dock:", error);
			reportDiag("registration-failed", `conversation.composer.dock: ${error instanceof Error ? error.message : String(error)}`);
			return () => {};
		}
	});
}
//#endregion
exports.USAGE_ENTRY_ID = USAGE_ENTRY_ID;
exports.apply = apply;
exports.inject = inject;

		return module.exports;
	}
});
