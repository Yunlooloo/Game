# Project Status

Last Updated: **2026-10-07** · 現況快照；歷史理由見 [WORK_LOG](WORK_LOG.md)，最新交班見 [CURRENT_HANDOFF](CURRENT_HANDOFF.md)。

## Current Version

**IMPLEMENTED：4.2.0**，通訊協議5。完整版本變化見 [CHANGELOG](../CHANGELOG.md)。

## Current Playable State

大廳選裝、挑戰赤衡、同屏/P2P雙人、22課陪練、多層競技場／掛索／天候、五工具／兩奧義、勝敗與重試。赤衡為三核心、240HP／220架勢；玩家與PvP／教學維持兩核心、100HP／100架勢。

| 狀態 | 系統 |
| --- | --- |
| IMPLEMENTED | 固定60Hz、FSM、命中／招架／反制、HP／架勢比例恢復、倒地與逐核斷決 |
| IMPLEMENTED | 16tick招架、成功重置懲罰、逐刀重新點按、防禦緩衝、輕招收刀轉防禦 |
| IMPLEMENTED | 赤衡三階段固定招式組合、可反擊空檔、延遲感知、導航、比例治療 |
| IMPLEMENTED | 逐波6tick接觸窗、收刀／出刀提示、Boss連段中間招架保持節拍、末刀反彈 |
| IMPLEMENTED | 空中蹬踏緩衝／踏入輔助、普通單次蓄刺、左側上跳下移的手機六主鍵與技具抽屜 |
| IMPLEMENTED | Canvas場景／人物／VFX、合成SFX／兩首內嵌BGM、滑鼠／鍵盤／觸控 |
| IMPLEMENTED | source版控、可重現單檔build、11組Node suites、Chromium smoke、品質CI與交接文件 |
| PARTIAL | P2P有實作／模擬測試，真實跨網連通仍未證實；iOS有模擬回歸，缺實機結果 |
| PARTIAL | 響應式CSS有safe-area；Canvas旋轉resize listener仍缺；設定只存記憶體 |
| PARTIAL | Boss容量與階段已支援3核，profile仍在core、單一AI；不是多Boss registry |
| PLANNED | Boss registry、第三actor、Stage／Encounter、故事／NPC／對話／任務 |
| PLANNED | 背包／裝備數值／通用status、進度／成就、版本化完整Save |
| OPTIONAL | XP／商店、Localization、controller／PWA、server-authoritative排名 |

PARTIAL只表示已實作子集的完成度，不把未完成平台保證當作已有功能。

## Architecture Health

| 分類 | 現況 | 修改邊界 |
| --- | --- | --- |
| Stable | 單檔builder、defender ownership、固定step | 維持現有回歸；不等於宣稱無bug |
| Acceptable | 共用FSM/Vitals容量helper、兩actor duel、原生Rift*模組 | 新平衡由實際玩家回饋調整，勿複製Boss私有傷害系統 |
| Needs Improvement | core協調過多、單Boss profile、固定地圖、兩actor索引 | 第二Boss才抽最小definition/factory；多敵人另做identity遷移 |
| Fragile | 教學resolver wrapper、手勢音訊、Canvas旋轉、未驗證實網 | 修改需對應測試與裝置證據 |
| Avoid Changing Without Review | bootstrap、frame/step、FSM、defender權限、storage/protocol IDs | Impact Analysis＋ADR；PvP網路容量仍100/100/2 |

沒有runtime migration in progress。BOSS_PROFILE／容量helper已全部接線；沒有同時維護兩套傷害或Boss引擎。理由見 [ADR-004](adr/004-readable-rhythm-and-boss-capacity.md)。

## Known Issues

[TECH_DEBT](TECH_DEBT.md) 維護完整清單：實網、實體iPhone、Canvas旋轉、擴充邊界與素材權利仍未解決。4.1.0已修復AI成本門檻、hitstop時鐘與連續招架；4.2.0改善蹬踏容錯、長按招式分工及手機操作，去除BGM有效時額外合成底噪與正常音量的非線性染色。自動測試不能代替真實玩家對難度與手感的回饋。

## Current Development Focus / Next Recommended Tasks

1. 實際遊玩4.2.0，分辨「看不清」「按了未生效」與「尚未掌握節拍」，以重現案例調整，不先增加速度；特別確認觸控蹬踏與蓄刺是否符合預期。
2. iPhone實測聲音、背景恢復、雙指操作與本次逐拍招架。
3. 修正Canvas旋轉尺寸同步並加resize／DPR回歸。
4. 兩裝置不同網路驗證WebRTC協議5連通與斷線。
5. 依 [BOSS_SYSTEM](BOSS_SYSTEM.md) 提取最小definition/factory加入第二Boss。
6. 補齊素材權利與vendor來源；第一個永久解鎖需求再做Save migration。

驗證記錄見 [VALIDATION](VALIDATION.md)；以上不是作者承諾的發行時程。
