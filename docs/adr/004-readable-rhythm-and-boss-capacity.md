# ADR-004：可學習的招架節奏與 Boss 容量

Status: Accepted · Date: 2026-10-06

## Context

**IMPLEMENTED，4.1.0**。玩家需要能從出刀提示學會連續招架。舊版連按很快將窗口縮到4 tick，多波共用長有效段、首次招架即取消整招，難以形成穩定節拍；裂斬的穿透傷害與大面積特效也削弱讀招。赤衡與玩家相同的100HP／雙核及短起手，無法支撐這次要求的三階段練習。

本次需求明確授權調整戰鬥與Boss結構。此決策取代「所有角色固定100HP／雙核」的全域假設；保留 [ADR-003](003-combat-authority.md) 的60Hz、FSM、defender authority與PvP雙核規則，不把本機Boss改動擴張成多人引擎。

## Decision

- 共用招架窗基礎16 tick、下限12 tick；只有未成功且間隔小於12 tick的空按累積債務，最多2，成功立即清除。8 tick防禦緩衝與指定輕招收招6 tick後的防禦取消改善接招；起手、有效段、飲藥仍承諾完成或受擊中斷。
- 多波每波只開6 tick接觸窗，波間無傷害。Boss非末波被招架仍累積架勢並保持攻擊，末波反彈；崩解或特殊反制可提早中斷。裂斬可格擋且無HP穿透，保留逐波招架的架勢回報。
- 赤衡以三階段固定招式組合增加選擇與結尾，不縮短各階段起手。完整收招後有組內間隔與組末反擊空檔；hitstop凍結AI觀察／排程，renderer使用同一攻擊時鐘逐波收刀、放刀及提示。
- 延伸現有actor，加入 `maxHp / maxPosture / maxNodes` 與Vitals容量／比例helper。玩家、PvP、教學維持100／100／2；僅AI赤衡使用240／220／3。治療40%HP、倒地恢復15%HP／35%架勢、踏刃35%與蹬踏30%架勢按容量計算；雙斷命中仍固定回復50架勢點。
- core內已接線的 `BOSS_PROFILE` 保存容量、起手與波次覆寫，`Game.attackDefinition()` 統一起手／輕斬轉蓄斬的move複本；Boss起手霸體仍受傷害與崩解。第二位Boss出現時才提取registry／factory，目前沒有未啟用的第二套架構。
- 通訊版本升至4並拒絕3，避免不同窗口／波次規則互連。線上仍是100／100／2的雙人PvP，不傳送本機Boss配置；教學storage key與單檔發行方式不變。

## Alternatives

- 只放大招架窗：無法解決波間碰撞、畫面提示與首次招架取消整段的問題。
- 全面取消連按成本：失去讀節拍與空按的差異；採成功重置與可用下限。
- 只提高Boss當前HP：恢復、架勢崩解、HUD、復燃會繼續套用100上限；改為明確容量接點。
- 立即加入通用Stats、Boss registry或新引擎：沒有第二份內容驗證需求，增加與現有路徑競爭的真實來源；先延伸既有fighter／MOVES／FSM。

## Consequences

共享攻擊／防禦仍只有一條裁決路徑。Boss局容許三核與不同容量，PvP／教學維持既有上限；HP比例決定自然架勢恢復檔位，但恢復量仍為架勢點／秒。Phase>=2保留原有AI恢復×1.2，不能把「起手不加速」誤寫成所有數值完全相同。

舊客戶端需更新後才能互連；網路authority尚未支援任意Boss容量。多actor、通用狀態效果、掉落與完整存檔仍為PLANNED。

## Verification / Revisit trigger

用實際engine驗證成功連續招架／空按、緩衝與取消、逐波接觸／末波反彈、Boss三次斷決／PvP兩次、比例治療與倒地、霸體受傷及崩解。AI測試驗證三階段組合、完整收招空檔、共用費用與hitstop時鐘；瀏覽器檢查紫色裂斬、逐波提示及HUD。實跑結果由 [VALIDATION](../VALIDATION.md) 維護，不以本ADR宣稱未執行的檢查通過。

若新增第二Boss、線上PvE或同場第三actor，再分別評估definition/factory、網路容量schema、target／ownership遷移。回退須一併回退source、協議版本與生成HTML，不可只換單一模組。
