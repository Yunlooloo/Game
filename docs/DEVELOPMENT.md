# 開發與維護規範

## IMPLEMENTED：工作流程

環境與命令：Python 3.11+、Node.js 22+；瀏覽器測試另裝 [TESTING](TESTING.md) 列出的 dev dependency。遊戲 runtime 無 npm install、無 backend、無必填環境變數，因此不建立空的 `.env.example`。

1. `git status --short`／`git log -5 --oneline`，保留既有工作。按 [AGENTS](../AGENTS.md) 閱讀交接鏈並完成 [Impact Analysis](AI_COLLABORATION.md)。
2. 在 `src/` 修改來源；資料、CSS、素材同步其權威位置。不要修改 vendor 來處理遊戲 bug。
3. `python3 scripts/build.py` 重建 `index.html`。
4. `python3 scripts/check.py`、`python3 scripts/test.py`；依影響執行 browser smoke 及人工清單。
5. 同步文件／CHANGELOG，檢查 diff，依任務授權 commit/push。部署操作以 [DEPLOYMENT](DEPLOYMENT.md) 為準。

### Git

目前 `main` 是可部署版本。日常建議小分支 `feature/*`、`fix/*`、`refactor/*`、`docs/*`，review 後合併；單人與 AI 的明確直接提交指示可在 `main` 更新，不為形式建立複雜分支。不得 force push、清除使用者變更或藉此改寫歷史。

Commit：`feat:`、`fix:`、`refactor:`、`docs:`、`test:`、`chore:`。一個 commit 應有可回退的目的；不把無關平衡修改藏在文件提交裡。例：`feat: add tidekeeper boss`、`fix: reject duplicate combat result`。

### 版本

遊戲使用 `MAJOR.MINOR.PATCH`，目前數值在 `src/core.js` 的 `game.debug.version`；[project-manifest.json](project-manifest.json) 記錄相同版本。網路 `net.js VERSION` 與未來 `saveVersion` 是不同契約，不能同時盲目加一。

| 層級 | 觸發例 |
| --- | --- |
| MAJOR | 破壞既有使用／資料契約，需清楚遷移及相容策略 |
| MINOR | 相容的新 Boss、模式、內容或功能 |
| PATCH | 相容 bug fix、音訊或觸控修正 |

純文件／建置來源收編且遊戲產物相同，可只寫 CHANGELOG `Unreleased`，不虛增 runtime 版本。發布時從 Unreleased 整理 Added／Changed／Fixed／Removed。

## 穩定 ID 慣例 · PLANNED 新內容適用

`<category>_<descriptive_slug>`，小寫 ASCII、snake_case，語意穩定而不綁顯示名稱：

| 類別 | 例子 |
| --- | --- |
| Boss／Enemy | `boss_chiheng`、`boss_tidekeeper`、`enemy_marsh_guard`、`enemy_marsh_guard_elite` |
| Ability／Effect | `ability_echo_cut`、`effect_burn` |
| Item／Equipment | `item_repair_tonic`、`weapon_resonant_blade`、`armor_salt_coat`、`accessory_echo_ring` |
| Stage／Encounter | `stage_foundry_01`、`encounter_foundry_boss` |
| Story／Dialogue／Quest | `chapter_foundry`、`dialogue_gate_01`、`quest_lost_core` |
| 音訊／UI 文字／成就 | `music_boss_tidekeeper`、`ui_pause_title`、`achievement_first_duel` |

現有 `light/charged/disc/cleave/rift`、lesson IDs 和 storage key 必須保持；不做全域改名。未來 registry 可明確映射舊 move ID。顯示文字能翻譯，ID 不翻譯、不回收作別的意義。每個 registry 保證唯一、檢查 reference，缺失 ID 在 build/dev 時失敗，載入舊存檔則走保存原檔的恢復路徑。

## Configuration／開發工具

**IMPLEMENTED**：幀常數／moves 在 `core.js`，狀態規則在 `fsm.js`，音訊／畫面參數各模組持有。聲音與天候 UI 設定僅 runtime；沒有通用 `GameConfig`。`game.debug` 可 start、pause、step、move、hit、setPlayers、snapshot、reset；`window.RIFT` 暴露 moves/bits/states。它會修改真實 runtime，測試後重開對局，不能當成線上作弊防護。

**PLANNED**：首次需要跨系統設定時建立 `src/config.js` 的明確 freeze object，分 `simulation`、`presentation`、`development`，不要把一切數值混進同一 bag。`difficulty` 應改 AI policy／獎勵，不偷偷更改網路碰撞規則。feature flags 明列 default、範圍、移除條件；不要用任意 URL 字串執行程式。

**OPTIONAL**：本機 debug 面板加入 Boss／Stage selector、hitbox、damage log、FPS、state inspector、god mode。採 opt-in `?debug=1` 並在 online 禁用改狀態功能；目前尚未實作這些 UI。Boss selector 的首個接點見 [BOSS_SYSTEM](BOSS_SYSTEM.md)。

## Definition of Done

- 功能符合可觀察的驗收條件，現有 Boss／玩法／部署可用。
- build 可重現，產物已更新；check／相關 tests 通過且沒有新增 console error。
- 行為、輸入、音訊或流程變更通過瀏覽器 smoke；平台問題記錄實機驗證或明確未測。
- 新資料／ID reference 有驗證；網路、存檔變更有相容／migration／回退說明。
- 更新唯一權威文件與必要 CHANGELOG／ADR；範例標示狀態，沒有虛構 API。
- 實質任務更新 PROJECT_STATUS／CURRENT_HANDOFF／WORK_LOG；重要架構改動更新 ARCHITECTURE／ADR。Self Review無重複系統／無未標記半完成migration；未處理的重要問題已有技術債。
- `git diff --check` 通過，沒有 secret、快取、無關產物；報告使用本次測試結果。
- 有發布授權時才執行 push；確認公開部署內容後才聲稱已上線。

## 註解與設計尺度

寫 Why、時序契約、反直覺限制與效能理由。例如 hitstop 保留輸入、Safari promise retry、defender authority 都需要註解；`x += 1` 不需要翻譯。先把確定重複概念抽成模組，不預先建立未有用例的抽象工廠。重大取捨記 [ADR](adr/README.md)，候選改善記 [TECH_DEBT](TECH_DEBT.md)。
