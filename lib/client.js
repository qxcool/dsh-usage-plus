window.__ModuleLoader__.load({
	id: "dsh-usage-plus",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		(function(){if(typeof document==="undefined")return;if(document.querySelector('style[data-plugin-css="dsh-usage-plus/client"]'))return;var tag=document.createElement("style");tag.dataset.plugin="dsh-usage-plus";tag.dataset.pluginCss="dsh-usage-plus/client";tag.textContent=".bAyXAa_section {\n  color: inherit;\n  flex-direction: column;\n  gap: 16px;\n  display: flex;\n}\n\n.bAyXAa_header {\n  justify-content: space-between;\n  align-items: center;\n  gap: 12px;\n  display: flex;\n}\n\n.bAyXAa_currentProvider {\n  opacity: .9;\n  flex-wrap: wrap;\n  align-items: baseline;\n  gap: 8px;\n  min-width: 0;\n  font-size: 13px;\n  display: inline-flex;\n}\n\n.bAyXAa_identityName {\n  opacity: .78;\n}\n\n.bAyXAa_identityBalance {\n  font-variant-numeric: tabular-nums;\n  opacity: .95;\n  font-weight: 600;\n}\n\n.bAyXAa_headerActions {\n  flex: none;\n  align-items: center;\n  gap: 8px;\n  display: inline-flex;\n}\n\n.bAyXAa_refreshBtn {\n  appearance: none;\n  border: 1px solid color-mix(in srgb, currentColor 28%, transparent);\n  color: inherit;\n  font: inherit;\n  cursor: pointer;\n  opacity: .85;\n  background: none;\n  border-radius: 8px;\n  padding: 4px 12px;\n  font-size: 12px;\n  transition: opacity .12s, background-color .12s, border-color .12s;\n}\n\n.bAyXAa_refreshBtn:hover:not(:disabled) {\n  opacity: 1;\n  background: color-mix(in srgb, currentColor 8%, transparent);\n  border-color: color-mix(in srgb, currentColor 45%, transparent);\n}\n\n.bAyXAa_refreshBtn:disabled {\n  cursor: default;\n  opacity: .5;\n}\n\n.bAyXAa_refreshBtn:focus-visible {\n  box-shadow: 0 0 0 2px color-mix(in srgb, currentColor 45%, transparent);\n  outline: none;\n}\n\n.bAyXAa_configActions {\n  border-top: 1px solid color-mix(in srgb, currentColor 12%, transparent);\n  flex-wrap: wrap;\n  justify-content: flex-end;\n  align-items: center;\n  gap: 8px;\n  margin-top: 12px;\n  padding-top: 12px;\n  display: flex;\n}\n\n.bAyXAa_configActions .bAyXAa_settingWarn {\n  margin-right: auto;\n}\n\n.bAyXAa_tabs {\n  background: color-mix(in srgb, currentColor 7%, transparent);\n  border: 1px solid color-mix(in srgb, currentColor 10%, transparent);\n  border-radius: 10px;\n  gap: 2px;\n  width: fit-content;\n  max-width: 100%;\n  padding: 3px;\n  display: inline-flex;\n}\n\n.bAyXAa_tab {\n  appearance: none;\n  color: inherit;\n  font: inherit;\n  cursor: pointer;\n  opacity: .62;\n  background: none;\n  border: none;\n  border-radius: 8px;\n  padding: 6px 14px;\n  font-size: 13px;\n  transition: opacity .12s, background-color .12s;\n}\n\n.bAyXAa_tab:hover {\n  opacity: .9;\n}\n\n.bAyXAa_tab:focus-visible {\n  box-shadow: 0 0 0 2px color-mix(in srgb, currentColor 45%, transparent);\n  outline: none;\n}\n\n.bAyXAa_tabActive {\n  opacity: 1;\n  background: color-mix(in srgb, currentColor 12%, transparent);\n  font-weight: 600;\n}\n\n.bAyXAa_card {\n  border: 1px solid color-mix(in srgb, currentColor 12%, transparent);\n  background: color-mix(in srgb, currentColor 3%, transparent);\n  border-radius: 12px;\n  flex-direction: column;\n  gap: 10px;\n  padding: 14px 16px;\n  display: flex;\n}\n\n.bAyXAa_cardHead {\n  justify-content: space-between;\n  align-items: center;\n  gap: 10px;\n  display: flex;\n}\n\n.bAyXAa_cardTitle {\n  letter-spacing: .04em;\n  text-transform: uppercase;\n  opacity: .6;\n  font-size: 12px;\n  font-weight: 600;\n}\n\n.bAyXAa_cardSummary {\n  opacity: .55;\n  font-variant-numeric: tabular-nums;\n  white-space: nowrap;\n  font-size: 11px;\n}\n\n.bAyXAa_subTitle {\n  letter-spacing: .03em;\n  opacity: .5;\n  margin-top: 2px;\n  font-size: 11px;\n  font-weight: 600;\n  display: block;\n}\n\n.bAyXAa_peakPill {\n  opacity: .7;\n  border: 1px solid color-mix(in srgb, currentColor 16%, transparent);\n  white-space: nowrap;\n  border-radius: 999px;\n  padding: 2px 8px;\n  font-size: 11px;\n}\n\n.bAyXAa_linkBtn {\n  appearance: none;\n  color: inherit;\n  font: inherit;\n  opacity: .7;\n  cursor: pointer;\n  background: none;\n  border: none;\n  padding: 0;\n  font-size: 12px;\n}\n\n.bAyXAa_linkBtn:hover {\n  opacity: 1;\n  text-decoration: underline;\n}\n\n.bAyXAa_kpiGrid {\n  grid-template-columns: repeat(auto-fit, minmax(112px, 1fr));\n  gap: 10px;\n  display: grid;\n}\n\n.bAyXAa_heroCard {\n  grid-template-columns: minmax(140px, 1.1fr) minmax(180px, 1fr);\n  align-items: end;\n  gap: 16px;\n  padding: 4px 0 6px;\n  display: grid;\n}\n\n.bAyXAa_heroMain {\n  flex-direction: column;\n  gap: 4px;\n  min-width: 0;\n  display: flex;\n}\n\n.bAyXAa_heroLabel {\n  opacity: .55;\n  font-size: 12px;\n}\n\n.bAyXAa_heroValue {\n  font-variant-numeric: tabular-nums;\n  letter-spacing: -.02em;\n  font-size: 34px;\n  font-weight: 700;\n  line-height: 1.05;\n}\n\n.bAyXAa_heroSide {\n  grid-template-columns: repeat(3, minmax(0, 1fr));\n  gap: 8px;\n  display: grid;\n}\n\n.bAyXAa_heroStat {\n  flex-direction: column;\n  gap: 2px;\n  min-width: 0;\n  display: flex;\n}\n\n.bAyXAa_heroStatLabel {\n  opacity: .5;\n  font-size: 11px;\n}\n\n.bAyXAa_heroStatValue {\n  font-variant-numeric: tabular-nums;\n  font-size: 14px;\n  font-weight: 600;\n}\n\n.bAyXAa_kpiTile {\n  background: color-mix(in srgb, currentColor 5%, transparent);\n  border: 1px solid color-mix(in srgb, currentColor 8%, transparent);\n  border-radius: 10px;\n  flex-direction: column;\n  gap: 3px;\n  min-width: 0;\n  padding: 10px 12px;\n  display: flex;\n}\n\n.bAyXAa_kpiAccent {\n  border-color: #22c55e47;\n}\n\n.bAyXAa_kpiValue {\n  font-variant-numeric: tabular-nums;\n  font-size: 20px;\n  font-weight: 650;\n  line-height: 1.15;\n}\n\n.bAyXAa_kpiGood {\n  color: #22c55e;\n}\n\n.bAyXAa_kpiLabel {\n  opacity: .58;\n  font-size: 11px;\n}\n\n.bAyXAa_kpiHint {\n  opacity: .45;\n  font-variant-numeric: tabular-nums;\n  white-space: nowrap;\n  text-overflow: ellipsis;\n  font-size: 10px;\n  overflow: hidden;\n}\n\n.bAyXAa_settingRow {\n  justify-content: space-between;\n  align-items: center;\n  gap: 16px;\n  font-size: 13px;\n  display: flex;\n}\n\n.bAyXAa_settingRow input[type=\"checkbox\"] {\n  accent-color: currentColor;\n  width: 16px;\n  height: 16px;\n}\n\n.bAyXAa_settingRow input[type=\"number\"], .bAyXAa_settingRow input[type=\"text\"], .bAyXAa_settingRow input[type=\"password\"], .bAyXAa_settingRow select, .bAyXAa_settingRow textarea {\n  border: 1px solid color-mix(in srgb, currentColor 25%, transparent);\n  color: inherit;\n  font: inherit;\n  background: none;\n  border-radius: 6px;\n  padding: 4px 8px;\n  font-size: 13px;\n}\n\n.bAyXAa_settingRow input[type=\"number\"] {\n  width: 88px;\n}\n\n.bAyXAa_settingRow input[type=\"text\"], .bAyXAa_settingRow input[type=\"password\"] {\n  width: min(100%, 280px);\n}\n\n.bAyXAa_settingRow textarea {\n  resize: vertical;\n  width: min(100%, 360px);\n  min-height: 64px;\n  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n  font-size: 12px;\n  line-height: 1.4;\n}\n\n.bAyXAa_settingRow input:focus-visible, .bAyXAa_settingRow select:focus-visible, .bAyXAa_settingRow textarea:focus-visible {\n  box-shadow: 0 0 0 2px color-mix(in srgb, currentColor 45%, transparent);\n  outline: none;\n}\n\n@media (width <= 720px) {\n  .bAyXAa_heroCard {\n    grid-template-columns: 1fr;\n  }\n}\n\n.bAyXAa_statRow {\n  flex-wrap: wrap;\n  gap: 18px;\n  display: flex;\n}\n\n.bAyXAa_stat {\n  flex-direction: column;\n  gap: 2px;\n  display: flex;\n}\n\n.bAyXAa_statValue {\n  font-variant-numeric: tabular-nums;\n  font-size: 18px;\n  font-weight: 600;\n}\n\n.bAyXAa_statLabel {\n  opacity: .6;\n  font-size: 11px;\n}\n\n.bAyXAa_balanceRow {\n  border-top: 1px solid color-mix(in srgb, currentColor 8%, transparent);\n  justify-content: space-between;\n  align-items: center;\n  gap: 12px;\n  padding: 8px 0;\n  display: flex;\n}\n\n.bAyXAa_balanceRow:first-of-type {\n  border-top: none;\n  padding-top: 2px;\n}\n\n.bAyXAa_balanceLead {\n  align-items: center;\n  gap: 8px;\n  min-width: 0;\n  display: inline-flex;\n}\n\n.bAyXAa_balanceMeta {\n  flex-direction: column;\n  align-items: flex-end;\n  gap: 1px;\n  display: inline-flex;\n}\n\n.bAyXAa_balanceHint {\n  opacity: .5;\n  font-size: 11px;\n}\n\n.bAyXAa_statusDot {\n  background: color-mix(in srgb, currentColor 35%, transparent);\n  border-radius: 50%;\n  flex: none;\n  width: 7px;\n  height: 7px;\n}\n\n.bAyXAa_statusOk {\n  background: #16a34a;\n}\n\n.bAyXAa_statusWarn {\n  background: #d97706;\n}\n\n.bAyXAa_statusErr {\n  background: #dc2626;\n}\n\n.bAyXAa_summaryGrid {\n  grid-template-columns: repeat(3, minmax(0, 1fr));\n  gap: 8px;\n  display: grid;\n}\n\n.bAyXAa_summaryTile {\n  border: 1px solid color-mix(in srgb, currentColor 12%, transparent);\n  background: color-mix(in srgb, currentColor 4%, transparent);\n  border-radius: 10px;\n  flex-direction: column;\n  gap: 4px;\n  min-width: 0;\n  padding: 10px 12px;\n  display: flex;\n}\n\n.bAyXAa_summaryLabel {\n  opacity: .65;\n  font-size: 11px;\n}\n\n.bAyXAa_summaryValue {\n  font-variant-numeric: tabular-nums;\n  font-size: 18px;\n  font-weight: 650;\n  line-height: 1.2;\n}\n\n.bAyXAa_summaryHint {\n  opacity: .55;\n  font-variant-numeric: tabular-nums;\n  font-size: 11px;\n}\n\n.bAyXAa_bucketGrid {\n  flex-direction: column;\n  gap: 8px;\n  margin-top: 4px;\n  display: flex;\n}\n\n.bAyXAa_bucketRow {\n  grid-template-columns: repeat(auto-fit, minmax(88px, 1fr));\n  gap: 8px;\n  display: grid;\n}\n\n.bAyXAa_bucketCell {\n  background: color-mix(in srgb, currentColor 5%, transparent);\n  border-radius: 8px;\n  flex-direction: column;\n  gap: 2px;\n  padding: 8px 10px;\n  display: flex;\n}\n\n.bAyXAa_bucketLabel {\n  opacity: .6;\n  font-size: 11px;\n}\n\n.bAyXAa_bucketValue {\n  font-variant-numeric: tabular-nums;\n  font-size: 13px;\n  font-weight: 600;\n}\n\n.bAyXAa_providerBlock {\n  flex-direction: column;\n  gap: 0;\n  display: flex;\n}\n\n.bAyXAa_providerRowBtn {\n  appearance: none;\n  color: inherit;\n  font: inherit;\n  border: none;\n  border-top: 1px solid color-mix(in srgb, currentColor 8%, transparent);\n  cursor: pointer;\n  text-align: left;\n  background: none;\n  justify-content: space-between;\n  align-items: center;\n  gap: 12px;\n  width: 100%;\n  padding: 6px 0;\n  display: flex;\n}\n\n.bAyXAa_providerBlock:first-of-type .bAyXAa_providerRowBtn {\n  border-top: none;\n}\n\n.bAyXAa_providerRowBtn:disabled {\n  cursor: default;\n}\n\n.bAyXAa_expandHint {\n  opacity: .5;\n  white-space: nowrap;\n  font-size: 11px;\n}\n\n.bAyXAa_modelRow {\n  opacity: .85;\n  justify-content: space-between;\n  align-items: center;\n  gap: 12px;\n  padding: 4px 0 4px 14px;\n  font-size: 12px;\n  display: flex;\n}\n\n.bAyXAa_modelName {\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  min-width: 0;\n  overflow: hidden;\n}\n\n.bAyXAa_sourceChip {\n  border: 1px solid color-mix(in srgb, currentColor 22%, transparent);\n  opacity: .72;\n  vertical-align: middle;\n  border-radius: 999px;\n  align-items: center;\n  margin-left: 6px;\n  padding: 1px 6px;\n  font-size: 10px;\n  font-weight: 600;\n  display: inline-flex;\n}\n\n.bAyXAa_heatmapGrid {\n  grid-template-columns: repeat(15, minmax(0, 1fr));\n  gap: 4px;\n  display: grid;\n}\n\n.bAyXAa_heatmapCell {\n  aspect-ratio: 1;\n  background: currentColor;\n  border-radius: 3px;\n}\n\n.bAyXAa_heatmapWrap {\n  grid-template-columns: auto 1fr;\n  align-items: end;\n  gap: 6px 8px;\n  padding-bottom: 2px;\n  display: grid;\n  overflow-x: auto;\n}\n\n.bAyXAa_heatmapDow {\n  opacity: .55;\n  text-align: right;\n  grid-template-rows: repeat(7, 10px);\n  gap: 3px;\n  padding-bottom: 0;\n  font-size: 10px;\n  line-height: 10px;\n  display: grid;\n}\n\n.bAyXAa_heatmapMain {\n  flex-direction: column;\n  gap: 4px;\n  min-width: 0;\n  display: flex;\n}\n\n.bAyXAa_heatmapMonths {\n  opacity: .6;\n  grid-template-columns: repeat(26, minmax(0, 1fr));\n  gap: 3px;\n  min-height: 12px;\n  font-size: 10px;\n  line-height: 1;\n  display: grid;\n}\n\n.bAyXAa_heatmapGrid26 {\n  grid-template-rows: repeat(7, 10px);\n  grid-auto-columns: 10px;\n  grid-auto-flow: column;\n  gap: 3px;\n  display: grid;\n}\n\n.bAyXAa_heatmapCell26 {\n  background: color-mix(in srgb, currentColor 12%, transparent);\n  border-radius: 2px;\n  width: 10px;\n  height: 10px;\n}\n\n.bAyXAa_heatmapL0 {\n  background: color-mix(in srgb, currentColor 10%, transparent);\n}\n\n.bAyXAa_heatmapL1 {\n  background: color-mix(in srgb, currentColor 28%, transparent);\n}\n\n.bAyXAa_heatmapL2 {\n  background: color-mix(in srgb, currentColor 46%, transparent);\n}\n\n.bAyXAa_heatmapL3 {\n  background: color-mix(in srgb, currentColor 68%, transparent);\n}\n\n.bAyXAa_heatmapL4 {\n  background: color-mix(in srgb, currentColor 92%, transparent);\n}\n\n.bAyXAa_heatmapToday {\n  outline: 1px solid color-mix(in srgb, currentColor 70%, transparent);\n  outline-offset: 1px;\n}\n\n.bAyXAa_heatmapLegend {\n  opacity: .65;\n  align-items: center;\n  gap: 4px;\n  margin-top: 8px;\n  font-size: 11px;\n  display: flex;\n}\n\n.bAyXAa_historyRow {\n  border-top: 1px solid color-mix(in srgb, currentColor 8%, transparent);\n  justify-content: space-between;\n  align-items: center;\n  gap: 12px;\n  padding: 6px 0;\n  font-size: 13px;\n  display: flex;\n}\n\n.bAyXAa_historyRow:first-of-type {\n  border-top: none;\n}\n\n.bAyXAa_historyDate {\n  font-variant-numeric: tabular-nums;\n  opacity: .78;\n}\n\n@media (width <= 720px) {\n  .bAyXAa_summaryGrid {\n    grid-template-columns: 1fr;\n  }\n\n  .bAyXAa_heatmapGrid {\n    grid-template-columns: repeat(10, minmax(0, 1fr));\n  }\n}\n\n.bAyXAa_mutedInline {\n  opacity: .55;\n  font-weight: 400;\n}\n\n.bAyXAa_planPreviewBlock {\n  border-top: 1px solid color-mix(in srgb, currentColor 8%, transparent);\n  flex-direction: column;\n  gap: 8px;\n  padding-top: 8px;\n  display: flex;\n}\n\n.bAyXAa_planPreviewBlock:first-of-type {\n  border-top: none;\n  padding-top: 0;\n}\n\n.bAyXAa_planMiniGrid {\n  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));\n  gap: 8px 12px;\n  display: grid;\n}\n\n.bAyXAa_planMini {\n  flex-direction: column;\n  gap: 4px;\n  display: flex;\n}\n\n.bAyXAa_planMiniLabel {\n  opacity: .78;\n  font-variant-numeric: tabular-nums;\n  justify-content: space-between;\n  gap: 8px;\n  font-size: 11px;\n  display: flex;\n}\n\n.bAyXAa_settingsSection {\n  flex-direction: column;\n  gap: 10px;\n  padding-top: 4px;\n  display: flex;\n}\n\n.bAyXAa_providerRow {\n  border-top: 1px solid color-mix(in srgb, currentColor 8%, transparent);\n  justify-content: space-between;\n  align-items: center;\n  gap: 12px;\n  padding: 6px 0;\n  font-size: 13px;\n  display: flex;\n}\n\n.bAyXAa_providerRow:first-of-type {\n  border-top: none;\n}\n\n.bAyXAa_providerName {\n  align-items: center;\n  gap: 8px;\n  min-width: 0;\n  display: flex;\n}\n\n.bAyXAa_providerTokens {\n  font-variant-numeric: tabular-nums;\n  opacity: .75;\n  white-space: nowrap;\n}\n\n.bAyXAa_providerMeta {\n  align-items: center;\n  gap: 10px;\n  min-width: 0;\n  display: inline-flex;\n}\n\n.bAyXAa_providerBalanceInline {\n  font-variant-numeric: tabular-nums;\n  white-space: nowrap;\n  opacity: .92;\n  font-weight: 600;\n}\n\n.bAyXAa_balanceInline {\n  border-top: 1px solid color-mix(in srgb, currentColor 8%, transparent);\n  flex-direction: column;\n  gap: 6px;\n  margin-top: 4px;\n  padding-top: 8px;\n  display: flex;\n}\n\n.bAyXAa_settingBlock {\n  flex-direction: column;\n  gap: 8px;\n  min-width: 100%;\n  display: flex;\n}\n\n.bAyXAa_settingHint {\n  opacity: .7;\n  font-variant-numeric: tabular-nums;\n  padding-left: 2px;\n  font-size: 12px;\n}\n\n.bAyXAa_secretField {\n  flex-direction: column;\n  gap: 6px;\n  display: flex;\n}\n\n.bAyXAa_secretStatus {\n  opacity: .75;\n  margin-left: 8px;\n  font-size: 11px;\n}\n\n.bAyXAa_secretStatus[data-configured=\"yes\"] {\n  color: color-mix(in srgb, #2f9e44 80%, currentColor);\n}\n\n.bAyXAa_secretStatus[data-configured=\"no\"] {\n  color: color-mix(in srgb, #c92a2a 70%, currentColor);\n}\n\n.bAyXAa_secretControls {\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 8px;\n  display: flex;\n}\n\n.bAyXAa_secretControls input[type=\"password\"] {\n  border: 1px solid color-mix(in srgb, currentColor 25%, transparent);\n  min-width: 140px;\n  color: inherit;\n  font: inherit;\n  background: none;\n  border-radius: 6px;\n  flex: 180px;\n  padding: 4px 8px;\n  font-size: 13px;\n}\n\n.bAyXAa_secretControls input[type=\"password\"]:focus-visible {\n  outline: 2px solid color-mix(in srgb, currentColor 45%, transparent);\n  outline-offset: 1px;\n}\n\n.bAyXAa_providerBalance {\n  font-variant-numeric: tabular-nums;\n  white-space: nowrap;\n  font-weight: 600;\n}\n\n.bAyXAa_currentBadge {\n  border: 1px solid color-mix(in srgb, currentColor 35%, transparent);\n  opacity: .8;\n  border-radius: 999px;\n  flex: none;\n  padding: 1px 7px;\n  font-size: 10px;\n  font-weight: 600;\n}\n\n.bAyXAa_chart {\n  flex-direction: column;\n  gap: 12px;\n  display: flex;\n}\n\n.bAyXAa_chartProvider {\n  flex-direction: column;\n  gap: 4px;\n  display: flex;\n}\n\n.bAyXAa_chartHead {\n  justify-content: space-between;\n  align-items: baseline;\n  gap: 10px;\n  font-size: 13px;\n  display: flex;\n}\n\n.bAyXAa_chartTokens {\n  font-variant-numeric: tabular-nums;\n  opacity: .65;\n  white-space: nowrap;\n  font-size: 11px;\n}\n\n.bAyXAa_chartBar {\n  background: color-mix(in srgb, currentColor 8%, transparent);\n  border-radius: 999px;\n  height: 8px;\n  display: block;\n  overflow: hidden;\n}\n\n.bAyXAa_chartFill {\n  background: color-mix(in srgb, currentColor 55%, transparent);\n  border-radius: 999px;\n  height: 100%;\n  transition: width .3s;\n  display: block;\n}\n\n.bAyXAa_chartModel {\n  opacity: .8;\n  grid-template-columns: minmax(80px, 180px) 1fr auto;\n  align-items: center;\n  gap: 8px;\n  padding-left: 14px;\n  font-size: 11px;\n  display: grid;\n}\n\n.bAyXAa_chartModelName {\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  opacity: .8;\n  overflow: hidden;\n}\n\n.bAyXAa_chartModelBar {\n  background: color-mix(in srgb, currentColor 6%, transparent);\n  border-radius: 999px;\n  height: 4px;\n  display: block;\n  overflow: hidden;\n}\n\n.bAyXAa_chartModelFill {\n  background: color-mix(in srgb, currentColor 35%, transparent);\n  border-radius: 999px;\n  height: 100%;\n  transition: width .3s;\n  display: block;\n}\n\n.bAyXAa_trendAxis {\n  opacity: .5;\n  font-variant-numeric: tabular-nums;\n  justify-content: space-between;\n  font-size: 10px;\n  display: flex;\n}\n\n.bAyXAa_muted {\n  opacity: .6;\n  font-size: 12px;\n}\n\n.bAyXAa_errorLine {\n  opacity: .75;\n  font-size: 12px;\n}\n\n.bAyXAa_planCard, .bAyXAa_planGroup {\n  flex-direction: column;\n  gap: 8px;\n  display: flex;\n}\n\n.bAyXAa_planHead {\n  justify-content: space-between;\n  align-items: baseline;\n  gap: 10px;\n  display: flex;\n}\n\n.bAyXAa_planName {\n  font-size: 14px;\n  font-weight: 600;\n}\n\n.bAyXAa_windowRow {\n  flex-direction: column;\n  gap: 4px;\n  display: flex;\n}\n\n.bAyXAa_windowLabel {\n  opacity: .8;\n  font-variant-numeric: tabular-nums;\n  justify-content: space-between;\n  font-size: 12px;\n  display: flex;\n}\n\n.bAyXAa_bar {\n  background: color-mix(in srgb, currentColor 10%, transparent);\n  border-radius: 999px;\n  height: 6px;\n  overflow: hidden;\n}\n\n.bAyXAa_barFill {\n  background: color-mix(in srgb, currentColor 55%, transparent);\n  border-radius: 999px;\n  height: 100%;\n  transition: width .3s;\n}\n\n.bAyXAa_barWarn {\n  background: #d97706;\n}\n\n.bAyXAa_barLow {\n  background: #dc2626;\n}\n\n.bAyXAa_resetLine {\n  opacity: .55;\n  font-variant-numeric: tabular-nums;\n  font-size: 11px;\n}\n\n.bAyXAa_settingsGrid {\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 16px;\n  display: flex;\n}\n\n.bAyXAa_settingItem {\n  align-items: center;\n  gap: 8px;\n  font-size: 13px;\n  display: flex;\n}\n\n.bAyXAa_settingItem input[type=\"checkbox\"] {\n  accent-color: currentColor;\n}\n\n.bAyXAa_settingItem input[type=\"number\"], .bAyXAa_settingItem input[type=\"text\"] {\n  border: 1px solid color-mix(in srgb, currentColor 25%, transparent);\n  width: 90px;\n  color: inherit;\n  font: inherit;\n  background: none;\n  border-radius: 6px;\n  padding: 3px 8px;\n  font-size: 13px;\n}\n\n.bAyXAa_settingItem input[type=\"text\"] {\n  width: 210px;\n}\n\n.bAyXAa_settingItem select {\n  border: 1px solid color-mix(in srgb, currentColor 25%, transparent);\n  color: inherit;\n  font: inherit;\n  background: none;\n  border-radius: 6px;\n  padding: 3px 8px;\n  font-size: 13px;\n}\n\n.bAyXAa_settingItem input:focus-visible, .bAyXAa_settingItem select:focus-visible {\n  box-shadow: 0 0 0 2px color-mix(in srgb, currentColor 45%, transparent);\n  outline: none;\n}\n\n.bAyXAa_quotaMeter {\n  flex: none;\n  display: inline-flex;\n  position: relative;\n}\n\n.bAyXAa_quotaMeterTrigger {\n  appearance: none;\n  box-sizing: border-box;\n  height: 28px;\n  color: var(--dsw-alias-label-secondary, inherit);\n  cursor: pointer;\n  font: inherit;\n  font-variant-numeric: tabular-nums;\n  background: none;\n  border: none;\n  border-radius: 999px;\n  align-items: center;\n  gap: 5px;\n  margin: 0;\n  padding: 0 6px 0 4px;\n  font-size: 12px;\n  line-height: 1;\n  display: inline-flex;\n}\n\n.bAyXAa_quotaMeterTrigger:hover {\n  background: var(--dsw-alias-interactive-bg-hover, color-mix(in srgb, currentColor 10%, transparent));\n}\n\n.bAyXAa_quotaMeterMissing {\n  align-items: center;\n  margin: 0 4px 0 0;\n  display: inline-flex;\n}\n\n.bAyXAa_quotaMeterDot {\n  background: var(--dsw-alias-border-l3, color-mix(in srgb, currentColor 30%, transparent));\n  border-radius: 999px;\n  width: 5px;\n  height: 5px;\n}\n\n.bAyXAa_quotaMeterTrack {\n  fill: none;\n  stroke: var(--dsw-alias-border-l3, color-mix(in srgb, currentColor 22%, transparent));\n  stroke-width: 2px;\n}\n\n.bAyXAa_quotaMeterFill {\n  fill: none;\n  stroke: var(--dsw-alias-label-tertiary, currentColor);\n  stroke-width: 2px;\n  stroke-linecap: round;\n}\n\n.bAyXAa_quotaMeterReading {\n  color: var(--dsw-alias-label-secondary, inherit);\n  opacity: .92;\n}\n\n.bAyXAa_quotaMeterWarn .bAyXAa_quotaMeterFill, .bAyXAa_quotaMeterWarn .bAyXAa_quotaMeterReading {\n  color: #d97706;\n  stroke: #d97706;\n}\n\n.bAyXAa_quotaMeterDanger .bAyXAa_quotaMeterFill, .bAyXAa_quotaMeterDanger .bAyXAa_quotaMeterReading {\n  color: #dc2626;\n  stroke: #dc2626;\n}\n\n.bAyXAa_quotaMeterPanel {\n  z-index: 100;\n  box-sizing: border-box;\n  background: var(--dsw-specific-menu, var(--dsw-alias-bg-elevated, #1e1e1e));\n  width: 264px;\n  box-shadow: var(--dsw-elevation-prominent, 0 8px 24px #00000059);\n  color: var(--dsw-alias-label-secondary, inherit);\n  cursor: default;\n  border: 0;\n  border-radius: 12px;\n  padding: 12px;\n  font-size: 12px;\n  line-height: 20px;\n  position: absolute;\n  bottom: calc(100% + 8px);\n  right: 0;\n}\n\n.bAyXAa_quotaMeterHeader {\n  align-items: center;\n  gap: 6px;\n  margin-bottom: 8px;\n  display: flex;\n}\n\n.bAyXAa_quotaMeterIdentity {\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  min-width: 0;\n  color: var(--dsw-alias-label-tertiary, inherit);\n  overflow: hidden;\n}\n\n.bAyXAa_quotaMeterRows {\n  flex-direction: column;\n  gap: 2px;\n  margin: 0;\n  display: flex;\n}\n\n.bAyXAa_quotaMeterBars {\n  flex-direction: column;\n  gap: 10px;\n  display: flex;\n}\n\n.bAyXAa_quotaMeterBarRow {\n  flex-direction: column;\n  gap: 4px;\n  display: flex;\n}\n\n.bAyXAa_quotaMeterBarHead {\n  color: var(--dsw-alias-label-secondary, inherit);\n  justify-content: space-between;\n  align-items: baseline;\n  gap: 10px;\n  font-size: 12px;\n  display: flex;\n}\n\n.bAyXAa_quotaMeterBarPct {\n  font-variant-numeric: tabular-nums;\n  color: var(--dsw-alias-label-primary, inherit);\n  font-weight: 600;\n}\n\n.bAyXAa_quotaMeterRow {\n  justify-content: space-between;\n  align-items: center;\n  gap: 12px;\n  padding: 2px 0;\n  display: flex;\n}\n\n.bAyXAa_quotaMeterRow dt {\n  min-width: 0;\n  color: var(--dsw-alias-label-secondary, inherit);\n  align-items: center;\n  gap: 6px;\n  display: inline-flex;\n}\n\n.bAyXAa_quotaMeterRow dd {\n  font-variant-numeric: tabular-nums;\n  color: var(--dsw-alias-label-primary, inherit);\n  flex-direction: column;\n  align-items: flex-end;\n  margin: 0;\n  font-weight: 500;\n  display: flex;\n}\n\n.bAyXAa_quotaMeterSwatch {\n  opacity: .55;\n  background: currentColor;\n  border-radius: 2px;\n  flex: none;\n  width: 8px;\n  height: 8px;\n}\n\n.bAyXAa_quotaMeterKey {\n  opacity: .55;\n  margin-left: 6px;\n  font-size: 11px;\n}\n\n.bAyXAa_quotaMeterReset {\n  opacity: .62;\n  font-variant-numeric: tabular-nums;\n  font-size: 11px;\n  font-weight: 400;\n}\n\n.bAyXAa_quotaMeterWarn .bAyXAa_quotaMeterSwatch, .bAyXAa_quotaMeterDanger .bAyXAa_quotaMeterSwatch {\n  opacity: .9;\n}\n\n.bAyXAa_settingWarn {\n  opacity: .9;\n  color: color-mix(in srgb, #dc2626 75%, currentColor);\n  max-width: 36em;\n  font-size: 12px;\n  line-height: 1.4;\n}\n\n.bAyXAa_quotaStripRow {\n  align-items: center;\n  gap: 8px;\n  min-height: 22px;\n  margin-top: 8px;\n  display: flex;\n}\n\n.bAyXAa_quotaStripRow:has( > [data-usage-strip-state]) {\n  display: none;\n}\n";document.head.appendChild(tag);})();
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region dsh-store-engine
const __dshStorePlatform = ["@deepseek-ai/dsh-client", "-store"].join("");
const __dshStoreLegacy = ["@deepseek-ai/dsh-client-runtime", "/client"].join("");
let __dshStoreEngine;
try { __dshStoreEngine = require(__dshStorePlatform); } catch { __dshStoreEngine = require(__dshStoreLegacy); }
//#endregion
const _deepseek_ai_dsh_client_store = __dshStoreEngine;
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
	"usage.updated": "更新于 {time}",
	"usage.loading": "正在加载用量数据…",
	"usage.error": "加载失败：{error}",
	"usage.disabled": "插件已停用：在「插件 → 使用统计」中启用即可恢复。",
	"usage.current": "当前",
	"usage.today": "今日用量",
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
	"usage.metric.avgCostHint": "按 {n} 次调用",
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
	"usage.heatmap.less": "少",
	"usage.heatmap.more": "多",
	"usage.heatmap.dow.mon": "一",
	"usage.heatmap.dow.wed": "三",
	"usage.heatmap.dow.fri": "五",
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
	"usage.plan.seeAll": "查看全部",
	"usage.plan.reset": "{date} 重置",
	"usage.plan.reset.soon": "即将重置",
	"usage.plan.reset.inHours": "{n} 小时后重置",
	"usage.plan.reset.inDays": "{n} 天后重置",
	"usage.plan.noPlan": "未检测到套餐数据",
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
	"usage.updated": "Updated {time}",
	"usage.loading": "Loading usage data…",
	"usage.error": "Failed to load: {error}",
	"usage.disabled": "Plugin disabled. Re-enable it under Plugins → Usage Statistics.",
	"usage.current": "Current",
	"usage.today": "Today",
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
	"usage.heatmap.less": "Less",
	"usage.heatmap.more": "More",
	"usage.heatmap.dow.mon": "M",
	"usage.heatmap.dow.wed": "W",
	"usage.heatmap.dow.fri": "F",
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
	"usage.plan.seeAll": "See all",
	"usage.plan.reset": "resets {date}",
	"usage.plan.reset.soon": "Resets soon",
	"usage.plan.reset.inHours": "Resets in {n}h",
	"usage.plan.reset.inDays": "Resets in {n}d",
	"usage.plan.noPlan": "No plan data detected",
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
//#region src/client/usage.module.css
var usage_module_default = {
	"balanceHint": "bAyXAa_balanceHint",
	"balanceInline": "bAyXAa_balanceInline",
	"balanceLead": "bAyXAa_balanceLead",
	"balanceMeta": "bAyXAa_balanceMeta",
	"balanceRow": "bAyXAa_balanceRow",
	"bar": "bAyXAa_bar",
	"barFill": "bAyXAa_barFill",
	"barLow": "bAyXAa_barLow",
	"barWarn": "bAyXAa_barWarn",
	"bucketCell": "bAyXAa_bucketCell",
	"bucketGrid": "bAyXAa_bucketGrid",
	"bucketLabel": "bAyXAa_bucketLabel",
	"bucketRow": "bAyXAa_bucketRow",
	"bucketValue": "bAyXAa_bucketValue",
	"card": "bAyXAa_card",
	"cardHead": "bAyXAa_cardHead",
	"cardSummary": "bAyXAa_cardSummary",
	"cardTitle": "bAyXAa_cardTitle",
	"chart": "bAyXAa_chart",
	"chartBar": "bAyXAa_chartBar",
	"chartFill": "bAyXAa_chartFill",
	"chartHead": "bAyXAa_chartHead",
	"chartModel": "bAyXAa_chartModel",
	"chartModelBar": "bAyXAa_chartModelBar",
	"chartModelFill": "bAyXAa_chartModelFill",
	"chartModelName": "bAyXAa_chartModelName",
	"chartProvider": "bAyXAa_chartProvider",
	"chartTokens": "bAyXAa_chartTokens",
	"configActions": "bAyXAa_configActions",
	"currentBadge": "bAyXAa_currentBadge",
	"currentProvider": "bAyXAa_currentProvider",
	"errorLine": "bAyXAa_errorLine",
	"expandHint": "bAyXAa_expandHint",
	"header": "bAyXAa_header",
	"headerActions": "bAyXAa_headerActions",
	"heatmapCell": "bAyXAa_heatmapCell",
	"heatmapCell26": "bAyXAa_heatmapCell26",
	"heatmapDow": "bAyXAa_heatmapDow",
	"heatmapGrid": "bAyXAa_heatmapGrid",
	"heatmapGrid26": "bAyXAa_heatmapGrid26",
	"heatmapL0": "bAyXAa_heatmapL0",
	"heatmapL1": "bAyXAa_heatmapL1",
	"heatmapL2": "bAyXAa_heatmapL2",
	"heatmapL3": "bAyXAa_heatmapL3",
	"heatmapL4": "bAyXAa_heatmapL4",
	"heatmapLegend": "bAyXAa_heatmapLegend",
	"heatmapMain": "bAyXAa_heatmapMain",
	"heatmapMonths": "bAyXAa_heatmapMonths",
	"heatmapToday": "bAyXAa_heatmapToday",
	"heatmapWrap": "bAyXAa_heatmapWrap",
	"heroCard": "bAyXAa_heroCard",
	"heroLabel": "bAyXAa_heroLabel",
	"heroMain": "bAyXAa_heroMain",
	"heroSide": "bAyXAa_heroSide",
	"heroStat": "bAyXAa_heroStat",
	"heroStatLabel": "bAyXAa_heroStatLabel",
	"heroStatValue": "bAyXAa_heroStatValue",
	"heroValue": "bAyXAa_heroValue",
	"historyDate": "bAyXAa_historyDate",
	"historyRow": "bAyXAa_historyRow",
	"identityBalance": "bAyXAa_identityBalance",
	"identityName": "bAyXAa_identityName",
	"kpiAccent": "bAyXAa_kpiAccent",
	"kpiGood": "bAyXAa_kpiGood",
	"kpiGrid": "bAyXAa_kpiGrid",
	"kpiHint": "bAyXAa_kpiHint",
	"kpiLabel": "bAyXAa_kpiLabel",
	"kpiTile": "bAyXAa_kpiTile",
	"kpiValue": "bAyXAa_kpiValue",
	"linkBtn": "bAyXAa_linkBtn",
	"modelName": "bAyXAa_modelName",
	"modelRow": "bAyXAa_modelRow",
	"muted": "bAyXAa_muted",
	"mutedInline": "bAyXAa_mutedInline",
	"peakPill": "bAyXAa_peakPill",
	"planCard": "bAyXAa_planCard",
	"planGroup": "bAyXAa_planGroup",
	"planHead": "bAyXAa_planHead",
	"planMini": "bAyXAa_planMini",
	"planMiniGrid": "bAyXAa_planMiniGrid",
	"planMiniLabel": "bAyXAa_planMiniLabel",
	"planName": "bAyXAa_planName",
	"planPreviewBlock": "bAyXAa_planPreviewBlock",
	"providerBalance": "bAyXAa_providerBalance",
	"providerBalanceInline": "bAyXAa_providerBalanceInline",
	"providerBlock": "bAyXAa_providerBlock",
	"providerMeta": "bAyXAa_providerMeta",
	"providerName": "bAyXAa_providerName",
	"providerRow": "bAyXAa_providerRow",
	"providerRowBtn": "bAyXAa_providerRowBtn",
	"providerTokens": "bAyXAa_providerTokens",
	"quotaMeter": "bAyXAa_quotaMeter",
	"quotaMeterBarHead": "bAyXAa_quotaMeterBarHead",
	"quotaMeterBarPct": "bAyXAa_quotaMeterBarPct",
	"quotaMeterBarRow": "bAyXAa_quotaMeterBarRow",
	"quotaMeterBars": "bAyXAa_quotaMeterBars",
	"quotaMeterDanger": "bAyXAa_quotaMeterDanger",
	"quotaMeterDot": "bAyXAa_quotaMeterDot",
	"quotaMeterFill": "bAyXAa_quotaMeterFill",
	"quotaMeterHeader": "bAyXAa_quotaMeterHeader",
	"quotaMeterIdentity": "bAyXAa_quotaMeterIdentity",
	"quotaMeterKey": "bAyXAa_quotaMeterKey",
	"quotaMeterMissing": "bAyXAa_quotaMeterMissing",
	"quotaMeterPanel": "bAyXAa_quotaMeterPanel",
	"quotaMeterReading": "bAyXAa_quotaMeterReading",
	"quotaMeterReset": "bAyXAa_quotaMeterReset",
	"quotaMeterRow": "bAyXAa_quotaMeterRow",
	"quotaMeterRows": "bAyXAa_quotaMeterRows",
	"quotaMeterSwatch": "bAyXAa_quotaMeterSwatch",
	"quotaMeterTrack": "bAyXAa_quotaMeterTrack",
	"quotaMeterTrigger": "bAyXAa_quotaMeterTrigger",
	"quotaMeterWarn": "bAyXAa_quotaMeterWarn",
	"quotaStripRow": "bAyXAa_quotaStripRow",
	"refreshBtn": "bAyXAa_refreshBtn",
	"resetLine": "bAyXAa_resetLine",
	"secretControls": "bAyXAa_secretControls",
	"secretField": "bAyXAa_secretField",
	"secretStatus": "bAyXAa_secretStatus",
	"section": "bAyXAa_section",
	"settingBlock": "bAyXAa_settingBlock",
	"settingHint": "bAyXAa_settingHint",
	"settingItem": "bAyXAa_settingItem",
	"settingRow": "bAyXAa_settingRow",
	"settingsGrid": "bAyXAa_settingsGrid",
	"settingsSection": "bAyXAa_settingsSection",
	"settingWarn": "bAyXAa_settingWarn",
	"sourceChip": "bAyXAa_sourceChip",
	"stat": "bAyXAa_stat",
	"statLabel": "bAyXAa_statLabel",
	"statRow": "bAyXAa_statRow",
	"statusDot": "bAyXAa_statusDot",
	"statusErr": "bAyXAa_statusErr",
	"statusOk": "bAyXAa_statusOk",
	"statusWarn": "bAyXAa_statusWarn",
	"statValue": "bAyXAa_statValue",
	"subTitle": "bAyXAa_subTitle",
	"summaryGrid": "bAyXAa_summaryGrid",
	"summaryHint": "bAyXAa_summaryHint",
	"summaryLabel": "bAyXAa_summaryLabel",
	"summaryTile": "bAyXAa_summaryTile",
	"summaryValue": "bAyXAa_summaryValue",
	"tab": "bAyXAa_tab",
	"tabActive": "bAyXAa_tabActive",
	"tabs": "bAyXAa_tabs",
	"trendAxis": "bAyXAa_trendAxis",
	"windowLabel": "bAyXAa_windowLabel",
	"windowRow": "bAyXAa_windowRow"
};
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
function toneClass$1(percent) {
	if (percent >= 90) return usage_module_default.quotaMeterDanger;
	if (percent >= 70) return usage_module_default.quotaMeterWarn;
	return "";
}
function barTone(percent) {
	if (percent >= 90) return usage_module_default.barLow;
	if (percent >= 70) return usage_module_default.barWarn;
	return usage_module_default.barFill;
}
function primaryWindow(windows) {
	const fiveHour = windows.find((window) => window.key === "5h");
	if (fiveHour !== void 0) return fiveHour;
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
	const primary = primaryWindow(windows);
	const percent = primary.percent;
	const reading = percentText(percent);
	const level = toneClass$1(percent);
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
			"aria-label": `${identity} · ${source} · ${windowLabel(primary)} ${reading}`,
			"aria-haspopup": "dialog",
			"aria-expanded": open,
			title: `${identity}\n${source} · ${windowShort(primary)} ${reading}\n${windows.map((window) => `${windowLabel(window)} ${percentText(window.percent)}`).join(" · ")}`,
			onClick: () => {
				setOpen((value) => !value);
			},
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				viewBox: "0 0 14 14",
				width: "14",
				height: "14",
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
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: usage_module_default.quotaMeterReading,
				children: reading
			})]
		}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: usage_module_default.quotaMeterPanel,
			role: "dialog",
			"aria-label": identity,
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: usage_module_default.quotaMeterHeader,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: usage_module_default.quotaMeterIdentity,
					children: identity
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: usage_module_default.sourceChip,
					children: source
				})]
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: usage_module_default.quotaMeterBars,
				children: windows.map((window) => {
					const value = window.percent;
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: `${usage_module_default.quotaMeterBarRow} ${toneClass$1(value)}`,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: usage_module_default.quotaMeterBarHead,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [windowLabel(window), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: usage_module_default.quotaMeterKey,
									children: windowShort(window)
								})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
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
			})]
		})]
	});
}
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
* The usage statistics settings section: overview (today's usage, balances,
* trend), plan quotas, and settings. Data comes from the host's
* loopback-fenced /api/dsh-usage-plus/overview document; polling runs only
* while the section is mounted and the tab is visible.
* @module dsh-usage-plus/client/UsageSectionCard
*/
/** Poll cadence while the section is open. */
const SECTION_POLL_MS = 1e4;
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
function toneClass(percent) {
	if (percent >= 90) return usage_module_default.barLow;
	if (percent >= 70) return usage_module_default.barWarn;
	return usage_module_default.barFill;
}
/** A provider row backed by a configured credential (api key, env key, or OAuth grant). */
function isConfigured(provider) {
	return provider.credential !== "none";
}
function totalOf(totals) {
	return totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens + totals.outputTokens;
}
function cacheHitRate(totals) {
	const billed = totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens;
	if (billed <= 0) return null;
	return totals.cacheReadTokens / billed * 100;
}
function TotalsRow(props) {
	const { totals, rangeTotals, allTotals, store, startStripPolling } = props;
	const hit = cacheHitRate(totals);
	const billed = totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens;
	const month = rangeTotals ?? emptyLike(totals);
	const all = allTotals ?? month;
	const avgCost = totals.calls > 0 && totals.cost > 0 ? totals.cost / totals.calls : null;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: usage_module_default.summaryGrid,
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SummaryTile, {
					label: t("usage.summary.today"),
					totals
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SummaryTile, {
					label: t("usage.summary.month"),
					totals: month
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SummaryTile, {
					label: t("usage.summary.all"),
					totals: all
				})
			]
		}),
		/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: usage_module_default.kpiGrid,
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: `${usage_module_default.kpiTile} ${usage_module_default.kpiAccent}`,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: `${usage_module_default.kpiValue} ${hit !== null && hit >= 90 ? usage_module_default.kpiGood : ""}`,
							children: hit === null ? "—" : `${hit >= 10 ? Math.round(hit) : hit.toFixed(1)}%`
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.kpiLabel,
							children: t("usage.tokens.cacheHit")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.kpiHint,
							children: t("usage.tokens.cacheRatio", {
								read: formatTokens(totals.cacheReadTokens),
								billed: formatTokens(billed)
							})
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: usage_module_default.kpiTile,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.kpiValue,
							children: formatTokens(totalOf(totals))
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.kpiLabel,
							children: t("usage.tokens.total")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.kpiHint,
							children: t("usage.tokens.detail", {
								input: formatTokens(totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens),
								output: formatTokens(totals.outputTokens)
							})
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: usage_module_default.kpiTile,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.kpiValue,
							children: avgCost === null ? "—" : formatCost(avgCost)
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.kpiLabel,
							children: t("usage.metric.avgCost")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.kpiHint,
							children: t("usage.metric.avgCostHint", { n: totals.calls })
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: usage_module_default.kpiTile,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.kpiValue,
							children: totals.calls
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.kpiLabel,
							children: t("usage.tokens.calls")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.kpiHint,
							children: t("usage.calls", { n: totals.calls })
						})
					]
				})
			]
		}),
		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			className: usage_module_default.quotaStripRow,
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PlanUsageStrip, {
				store,
				startStripPolling
			})
		}),
		/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TokenBuckets, { totals })
	] });
}
function emptyLike(_totals) {
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
function SummaryTile(props) {
	const { label, totals } = props;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: usage_module_default.summaryTile,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: usage_module_default.summaryLabel,
				children: label
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: usage_module_default.summaryValue,
				children: totals.cost > 0 ? formatCost(totals.cost) : formatTokens(totalOf(totals))
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: usage_module_default.summaryHint,
				children: [
					t("usage.summary.tokens"),
					" ",
					formatTokens(totalOf(totals)),
					" · ",
					t("usage.summary.calls"),
					" ",
					totals.calls,
					totals.cost > 0 ? ` · ${t("usage.summary.cost")} ${formatCost(totals.cost)}` : ""
				]
			})
		]
	});
}
function TokenBuckets(props) {
	const { totals } = props;
	const rows = [
		{
			key: "input",
			label: t("usage.tokens.input"),
			value: totals.inputTokens
		},
		{
			key: "cacheRead",
			label: t("usage.tokens.cacheRead"),
			value: totals.cacheReadTokens
		},
		{
			key: "cacheWrite",
			label: t("usage.tokens.cacheWrite"),
			value: totals.cacheWriteTokens
		},
		{
			key: "output",
			label: t("usage.tokens.output"),
			value: totals.outputTokens
		}
	];
	if (totals.reasoningTokens > 0) rows.push({
		key: "reasoning",
		label: t("usage.tokens.reasoning"),
		value: totals.reasoningTokens
	});
	rows.push({
		key: "calls",
		label: t("usage.tokens.calls"),
		value: totals.calls
	});
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: usage_module_default.bucketGrid,
		"data-dsh-part": "token-buckets",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			className: usage_module_default.subTitle,
			children: t("usage.tokens.buckets")
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			className: usage_module_default.bucketRow,
			children: rows.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: usage_module_default.bucketCell,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: usage_module_default.bucketLabel,
					children: row.label
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: usage_module_default.bucketValue,
					children: row.key === "calls" ? row.value : formatTokens(row.value)
				})]
			}, row.key))
		})]
	});
}
function ProviderBreakdown(props) {
	const { rows, providers, current } = props;
	const [open, setOpen] = (0, react.useState)({});
	if (rows.length === 0) return null;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		"data-dsh-part": "provider-list",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			className: usage_module_default.subTitle,
			children: t("usage.today.breakdown")
		}), rows.map((row) => {
			const provider = providers.find((item) => item.provider === row.provider);
			const expanded = open[row.provider] === true;
			const hasModels = row.models.length > 0;
			const balance = provider === void 0 ? null : balanceText(provider);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: usage_module_default.providerBlock,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: usage_module_default.providerRowBtn,
					disabled: !hasModels,
					"aria-expanded": expanded,
					onClick: () => {
						if (!hasModels) return;
						setOpen((prev) => ({
							...prev,
							[row.provider]: !expanded
						}));
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: usage_module_default.providerName,
						children: [provider?.displayName ?? row.provider, current === row.provider && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.currentBadge,
							children: t("usage.current")
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: usage_module_default.providerMeta,
						children: [
							balance !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_module_default.providerBalanceInline,
								children: balance
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: usage_module_default.providerTokens,
								children: [
									formatTokens(totalOf(row.totals)),
									" · ",
									t("usage.calls", { n: row.totals.calls }),
									row.totals.cost > 0 ? ` · ${formatCost(row.totals.cost)}` : ""
								]
							}),
							hasModels && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_module_default.expandHint,
								children: expanded ? t("usage.collapse") : t("usage.expand")
							})
						]
					})]
				}), expanded && row.models.map((model) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: usage_module_default.modelRow,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: usage_module_default.modelName,
						children: model.model
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: usage_module_default.providerTokens,
						children: [
							formatTokens(totalOf(model.totals)),
							" · ",
							t("usage.calls", { n: model.totals.calls }),
							model.totals.cost > 0 ? ` · ${formatCost(model.totals.cost)}` : ""
						]
					})]
				}, model.model))]
			}, row.provider);
		})]
	});
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
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
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
						className: usage_module_default.providerBalance,
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
/** Overview hero: only the plan matched to the current model route. */
function PlanHero(props) {
	const { provider, model, onSeeAll } = props;
	const windows = orderedPlanWindows(provider.plan);
	if (windows.length === 0) return null;
	const title = model === void 0 || model === "" ? provider.displayName : `${provider.displayName} · ${model}`;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: usage_module_default.card,
		"data-dsh-part": "plan-hero",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: usage_module_default.cardHead,
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: usage_module_default.cardTitle,
				children: t("usage.plan.preview")
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: usage_module_default.linkBtn,
				onClick: onSeeAll,
				children: t("usage.plan.seeAll")
			})]
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: usage_module_default.planPreviewBlock,
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: usage_module_default.providerName,
				children: [
					title,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: usage_module_default.currentBadge,
						children: t("usage.current")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: usage_module_default.sourceChip,
						children: t(planSourceLabelKey(provider))
					}),
					provider.plan?.planName !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: usage_module_default.mutedInline,
						children: [" · ", provider.plan.planName]
					}) : null
				]
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: usage_module_default.planMiniGrid,
				children: windows.slice(0, 3).map((window) => {
					const percent = window.percent;
					const label = window.key === "5h" || window.key === "week" || window.key === "month" ? t(`usage.plan.windows.${window.key}`) : window.name ?? window.key;
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: usage_module_default.planMini,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: usage_module_default.planMiniLabel,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [percent >= 10 ? Math.round(percent) : percent.toFixed(1), "%"] })]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_module_default.bar,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: toneClass(percent),
									style: {
										width: `${Math.min(100, Math.max(0, percent))}%`,
										display: "block"
									}
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_module_default.resetLine,
								children: formatPlanReset(window.resetsAt)
							})
						]
					}, window.key);
				})
			})]
		})]
	});
}
function balanceText(provider) {
	if (provider.balance === void 0) return null;
	const currency = provider.balance.currency.toUpperCase();
	const prefix = currency === "CNY" ? "¥" : currency === "USD" ? "$" : "";
	const suffix = currency !== "CNY" && currency !== "USD" ? ` ${currency}` : "";
	return `${prefix}${provider.balance.totalBalance}${suffix}`;
}
/** The section component; the slot merges the face into these props. */
function UsageSectionCard(props) {
	const { store, poll, refresh, settings, setCredential, clearCredential, startStripPolling, view } = props;
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
	if (!enabled || ui.status === "error" || snapshot === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: usage_module_default.section,
		"data-dsh-plugin": "usage",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: usage_module_default.muted,
				"data-dsh-part": "status-line",
				children: !enabled ? t("usage.disabled") : ui.status === "error" ? t("usage.error", { error: ui.error ?? "" }) : t("usage.loading")
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
	const current = snapshot.current;
	const currentProvider = snapshot.providers.find((provider) => provider.provider === current.provider);
	const matchedPlan = currentPlanProvider(snapshot);
	const deepseekPeriod = deepseekPeriodAt(Date.now());
	const deepseekVisible = current.provider !== void 0 && isDeepSeekProviderRoute(current.provider) || snapshot.usage.today.providers.some((row) => isDeepSeekProviderRoute(row.provider));
	const planProviders = planTabProviders(snapshot.providers);
	const modelPlans = planProviders.filter((provider) => provider.source === void 0 || provider.source === "model");
	const cpamcPlans = planProviders.filter((provider) => provider.source === "cpamc");
	const volcanoPlans = planProviders.filter((provider) => provider.source === "volcano");
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: usage_module_default.section,
		"data-dsh-plugin": "usage",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: usage_module_default.header,
				"data-dsh-part": "header",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: usage_module_default.currentProvider,
					children: currentProvider !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: usage_module_default.identityName,
						children: [currentProvider.displayName, current.model !== void 0 && current.model !== "" ? ` · ${current.model}` : ""]
					}), balanceText(currentProvider) !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: usage_module_default.identityBalance,
						children: balanceText(currentProvider)
					})] }) : t("usage.noData")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: usage_module_default.headerActions,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: usage_module_default.muted,
						children: t("usage.updated", { time: formatTime(snapshot.updatedAt) })
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: usage_module_default.refreshBtn,
						onClick: onRefresh,
						disabled: refreshing,
						children: refreshing ? t("usage.refreshing") : t("usage.refresh")
					})]
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
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
			}),
			tab === "usage" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				matchedPlan !== void 0 && orderedPlanWindows(matchedPlan.plan).length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PlanHero, {
					provider: matchedPlan,
					model: current.model,
					onSeeAll: () => setTab("plans")
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: usage_module_default.card,
					"data-dsh-part": "today-card",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: usage_module_default.cardHead,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_module_default.cardTitle,
								children: t("usage.today")
							}), deepseekVisible && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_module_default.peakPill,
								"data-dsh-part": "peak-status",
								children: t(deepseekPeriod.peak ? "usage.peak.on" : "usage.peak.off", { time: formatClock(deepseekPeriod.boundaryMs) })
							})]
						}),
						snapshot.usage.today.totals.calls === 0 && (snapshot.usage.range?.totals.calls ?? 0) === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.muted,
							children: t("usage.noData")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TotalsRow, {
							totals: snapshot.usage.today.totals,
							rangeTotals: snapshot.usage.range?.totals,
							allTotals: snapshot.usage.all?.totals,
							store,
							startStripPolling
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProviderBreakdown, {
							rows: snapshot.usage.today.providers,
							providers: snapshot.providers,
							current: current.provider
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BalanceInline, {
							providers: snapshot.providers,
							current: current.provider,
							excludeIds: new Set(snapshot.usage.today.providers.map((row) => row.provider))
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(HeatmapCard, { days: snapshot.usage.days }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RangeCard, {
					range: snapshot.usage.range,
					providers: snapshot.providers,
					currentProvider: current.provider
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(HistoryCard, { days: snapshot.usage.days })
			] }),
			tab === "plans" && (planProviders.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: usage_module_default.card,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: usage_module_default.muted,
					children: t("usage.plan.noneConfigured")
				})
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(PlanGroup, {
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
			] })),
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
function PlanGroup(props) {
	const { title, providers, currentId, showEmpty } = props;
	if (providers.length === 0 && !showEmpty) return null;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: usage_module_default.planGroup,
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			className: usage_module_default.cardTitle,
			children: t("usage.plan.groupCount", {
				title,
				n: providers.length
			})
		}), providers.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			className: usage_module_default.card,
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: usage_module_default.muted,
				children: t("usage.plan.groupEmpty")
			})
		}) : providers.map((provider) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PlanCard, {
			provider,
			currentId
		}, provider.provider))]
	});
}
function HeatmapCard(props) {
	const grid = buildHeatmapGrid(props.days);
	const hasData = grid.cells.some((cell) => cell.tokens > 0);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: usage_module_default.card,
		"data-dsh-part": "heatmap-card",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: usage_module_default.cardHead,
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: usage_module_default.cardTitle,
				children: t("usage.heatmap")
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: usage_module_default.muted,
				children: t("usage.heatmap.weeks")
			})]
		}), !hasData ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			className: usage_module_default.muted,
			children: t("usage.heatmap.empty")
		}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: usage_module_default.heatmapWrap,
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
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
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: usage_module_default.heatmapMain,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: usage_module_default.heatmapMonths,
					children: grid.monthLabels.map((label, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label }, `m${index}`))
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: usage_module_default.heatmapGrid26,
					children: grid.cells.map((cell) => {
						const cost = cell.totals.cost > 0 ? ` · ${formatCost(cell.totals.cost)}` : "";
						return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: `${usage_module_default.heatmapCell26} ${usage_module_default[`heatmapL${cell.level}`]} ${cell.isToday ? usage_module_default.heatmapToday : ""}`,
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
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: usage_module_default.heatmapLegend,
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("usage.heatmap.less") }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: `${usage_module_default.heatmapCell26} ${usage_module_default.heatmapL0}` }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: `${usage_module_default.heatmapCell26} ${usage_module_default.heatmapL1}` }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: `${usage_module_default.heatmapCell26} ${usage_module_default.heatmapL2}` }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: `${usage_module_default.heatmapCell26} ${usage_module_default.heatmapL3}` }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: `${usage_module_default.heatmapCell26} ${usage_module_default.heatmapL4}` }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("usage.heatmap.more") })
			]
		})] })]
	});
}
function HistoryCard(props) {
	const [open, setOpen] = (0, react.useState)(false);
	const days = [...props.days].slice(-14).reverse();
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: usage_module_default.card,
		"data-dsh-part": "history-card",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: usage_module_default.cardHead,
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: usage_module_default.cardTitle,
				children: t("usage.history")
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: usage_module_default.linkBtn,
				onClick: () => setOpen((value) => !value),
				children: open ? t("usage.history.hide") : t("usage.history.show")
			})]
		}), open && (days.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			className: usage_module_default.muted,
			children: t("usage.history.empty")
		}) : days.map((day) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: usage_module_default.historyRow,
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: usage_module_default.historyDate,
				children: day.date
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: usage_module_default.providerTokens,
				children: [
					formatTokens(totalOf(day.totals)),
					" · ",
					t("usage.calls", { n: day.totals.calls }),
					day.totals.cost > 0 ? ` · ${formatCost(day.totals.cost)}` : ""
				]
			})]
		}, day.date)))]
	});
}
/** How many model sub-bars render under one provider bar. */
const CHART_MODEL_CAP = 3;
/**
* The 近 30 天 card: horizontal bars per provider over the trend window,
* each with its heaviest models as nested sub-bars. Window totals come from
* the host's aggregated `usage.range` (an older host without it renders no
* card instead of a wrong one).
*/
function RangeCard(props) {
	const { range, providers, currentProvider } = props;
	if (range === void 0) return null;
	const grandTotal = range.totals.inputTokens + range.totals.outputTokens + range.totals.cacheReadTokens + range.totals.cacheWriteTokens;
	const maxProvider = Math.max(1, ...range.providers.map((row) => totalOf(row.totals)));
	const nameOf = (id) => providers.find((provider) => provider.provider === id)?.displayName ?? id;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: usage_module_default.card,
		"data-dsh-part": "trend-card",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: usage_module_default.cardHead,
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: usage_module_default.cardTitle,
				children: t("usage.trend")
			}), grandTotal > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: usage_module_default.cardSummary,
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
			children: [range.providers.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChartProviderRow, {
				row,
				name: nameOf(row.provider),
				max: maxProvider,
				current: currentProvider === row.provider
			}, row.provider)), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: usage_module_default.trendAxis,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: range.from.slice(5) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: range.to.slice(5) })]
			})]
		})]
	});
}
function ChartProviderRow(props) {
	const { row, name, max, current } = props;
	const total = totalOf(row.totals);
	const maxModel = Math.max(1, ...row.models.slice(0, CHART_MODEL_CAP).map((model) => totalOf(model.totals)));
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: usage_module_default.chartProvider,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: usage_module_default.chartHead,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: usage_module_default.providerName,
					children: [name, current && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: usage_module_default.currentBadge,
						children: t("usage.current")
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: usage_module_default.chartTokens,
					children: [
						formatTokens(total),
						" · ",
						t("usage.calls", { n: row.totals.calls })
					]
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: usage_module_default.chartBar,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: usage_module_default.chartFill,
					style: { width: `${Math.max(2, Math.round(total / max * 100))}%` }
				})
			}),
			row.models.slice(0, CHART_MODEL_CAP).map((model) => {
				const modelTotal = totalOf(model.totals);
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: usage_module_default.chartModel,
					title: `${row.provider} · ${model.model}: ${formatTokens(modelTotal)}`,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.chartModelName,
							children: model.model
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.chartModelBar,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_module_default.chartModelFill,
								style: { width: `${Math.max(3, Math.round(modelTotal / maxModel * 100))}%` }
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.chartTokens,
							children: formatTokens(modelTotal)
						})
					]
				}, model.model);
			})
		]
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
						provider.plan?.planName !== void 0 ? ` · ${provider.plan.planName}` : ""
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
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: window.name ?? t(`usage.plan.windows.${window.key}`) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: `${percent >= 10 ? Math.round(percent) : percent.toFixed(1)}%` })]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.bar,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: toneClass(percent),
								style: {
									width: `${Math.min(100, Math.max(0, percent))}%`,
									display: "block"
								}
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_module_default.resetLine,
							children: formatPlanReset(window.resetsAt)
						})
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
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: usage_module_default.cardTitle,
				children: t("usage.config.title")
			}),
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
						className: usage_module_default.settingHint,
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
						className: usage_module_default.settingHint,
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
const STRIP_POLL_MS = 5e3;
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
const usageApi = {
	overview: () => usageFetch("/api/dsh-usage-plus/overview", "GET"),
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
	let pollSeq = 0;
	const poll = () => {
		const seq = pollSeq + 1;
		pollSeq = seq;
		usageApi.overview().then((snapshot) => {
			if (seq !== pollSeq) return;
			store.actions.setSnapshot(snapshot);
		}, (error) => {
			if (seq !== pollSeq) return;
			store.actions.setState("error", error instanceof Error ? error.message : String(error));
		});
	};
	const refresh = () => {
		const seq = pollSeq + 1;
		pollSeq = seq;
		usageApi.refresh().then((snapshot) => {
			pollSeq = seq;
			store.actions.setSnapshot(snapshot);
		}, (error) => {
			if (seq !== pollSeq) return;
			store.actions.setState("error", error instanceof Error ? error.message : String(error));
		});
	};
	const applyOverview = (snapshot) => {
		pollSeq += 1;
		store.actions.setSnapshot(snapshot);
	};
	let stripRefs = 0;
	let stripTimer;
	const onVisible = () => {
		if (document.visibilityState === "visible") poll();
	};
	const onComposerInteract = (event) => {
		const target = event.target;
		if (!(target instanceof Element)) return;
		if (target.closest("[data-slot=\"conversation.composer\"], [data-slot=\"conversation.input\"], [data-slot=\"conversation.composer.dock\"]") === null) return;
		window.setTimeout(() => {
			if (document.visibilityState === "visible") poll();
		}, 50);
	};
	const startStripPolling = () => {
		stripRefs += 1;
		if (stripRefs === 1) {
			stripTimer = window.setInterval(() => {
				if (document.visibilityState === "visible") poll();
			}, STRIP_POLL_MS);
			document.addEventListener("visibilitychange", onVisible);
			document.addEventListener("pointerup", onComposerInteract, true);
			document.addEventListener("change", onComposerInteract, true);
		}
		poll();
		return () => {
			stripRefs -= 1;
			if (stripRefs === 0 && stripTimer !== void 0) {
				window.clearInterval(stripTimer);
				stripTimer = void 0;
				document.removeEventListener("visibilitychange", onVisible);
				document.removeEventListener("pointerup", onComposerInteract, true);
				document.removeEventListener("change", onComposerInteract, true);
			}
		};
	};
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
