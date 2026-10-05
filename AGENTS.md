# AI 與人類維護入口

## Project Overview / Current State

《斬境殘響》是單一 HTML 發行的原創 2D 刀劍對決原型。**IMPLEMENTED**：一名 Boss、兩核心／兩階段、五裝備／兩奧義、22 課陪練、同屏與 PeerJS 連線。戰役、背包、多敵人和完整存檔尚未實作。狀態標籤定義及文件真實來源見 [docs/README.md](docs/README.md)。

## Architecture / Important Files

| 責任 | 真實來源 |
| --- | --- |
| Boot、Game Loop、Player factory、世界與輸入 | [src/core.js](src/core.js)：`Game`、`fighter`、`makeWorld`、`frame`、`step` |
| 狀態轉移／HP、架勢、復燃 | [src/fsm.js](src/fsm.js)、[src/vitals.js](src/vitals.js) |
| Boss 策略 | [src/ai.js](src/ai.js)：`RiftAI.input`；目前沒有 Boss registry |
| 攻擊定義、判定與傷害 | `core.js` 的 `MOVES`、`hit`、`collisions`；連線權限由 [src/authority.js](src/authority.js) 把關 |
| 網路傳輸 | [src/net.js](src/net.js)：`RiftNet`，協議版本和遊戲版本不同 |
| 畫面／音訊／教學 | [src/render.js](src/render.js)、[src/audio.js](src/audio.js)、[src/tutorial.js](src/tutorial.js) |
| UI、素材、建置 | [src/shell.html](src/shell.html)、[assets/](assets/)、[scripts/build.py](scripts/build.py) |
| 測試、部署、技術債 | [TESTING](docs/TESTING.md)、[DEPLOYMENT](docs/DEPLOYMENT.md)、[TECH_DEBT](docs/TECH_DEBT.md) |

模組是有順序的傳統 inline script／IIFE，不是 ESM，也沒有現成 ECS、EventBus、SceneManager、AbilityRegistry 或 SaveManager。勿在文件或程式中假定其存在。

## How to Run / Build / Test / Deploy

在 repository root：

```sh
python3 -m http.server 8000 --bind 127.0.0.1
python3 scripts/build.py
python3 scripts/check.py
python3 scripts/test.py
```

瀏覽器完整檢查用 `python3 scripts/test.py --browser`，前置安裝見 [TESTING](docs/TESTING.md)。部署目前為 GitHub Pages `main:/`；只在任務授權時 push，依 [DEPLOYMENT](docs/DEPLOYMENT.md) 檢查 CI、Pages commit 與公開內容。不要把環境設定 Publish 和網站發布混為一談。

## Before Editing

1. 檢查 `git status --short`、`git log -5 --oneline`，保留未提交變更，確認上一棒是否完整／是否仍在 migration。
2. 依序讀 README → 本檔 → [AI_HANDOFF](docs/AI_HANDOFF.md) → [PROJECT_STATUS](docs/PROJECT_STATUS.md)（含 [CURRENT_HANDOFF](docs/CURRENT_HANDOFF.md)）→ [WORK_LOG](docs/WORK_LOG.md) → [ARCHITECTURE](docs/ARCHITECTURE.md) → 任務system／ADR；假設所有聊天上下文都已丟失。
3. 找到相關 system 與實際函式，再讀其測試；確認文件的 IMPLEMENTED／PLANNED 標籤。
4. 非微小修改先做 [Impact Analysis](docs/AI_COLLABORATION.md)：owner、影響系統、既有pattern、ADR、Save／protocol／deployment／現有內容相容性、測試與回退。
5. 優先延伸既有 pattern，先搜尋同概念的utility／registry／event／config，避免第二套戰鬥或輸入實作。
6. 記下這次要保留的行為和要證明的結果。不要僅因文件有未來藍圖就實作整個框架。

## Working Agreements

1. 先理解，再修改。
2. 優先延伸既有 pattern。
3. 不建立功能重複的 system。
4. 不因個人偏好重寫架構。
5. 核心架構改動必須更新 ARCHITECTURE 並留下 ADR。
6. 新增內容盡量不改穩定核心；必要的首個接點要明確記錄。
7. 實質任務完成必須更新 PROJECT_STATUS、覆寫 CURRENT_HANDOFF、追加 WORK_LOG。
8. 不把聊天當永久記憶。
9. Repository 是 single source of truth；文件矛盾時查 history／implementation／ADR。
10. 讓下一個維護者比自己接手時更容易理解；不順手擴大無關重構。

詳細協作、ownership、並行編輯、migration標記、special-case與全域狀態規則見 [AI_COLLABORATION](docs/AI_COLLABORATION.md)。本專案屬多人／多AI接力，不屬於某個agent的個人架構。

## Development / Architecture Rules

- `src/`、`vendor/`、`assets/` 為可重建來源；`index.html` 為提交的產物。不可只改 HTML 而漏改來源。
- 保持固定 60 Hz 戰鬥步長、hitstop 的輸入緩衝、FSM 轉移與兩核心規則；不得將戰鬥時序綁到渲染 FPS。
- 線上命中由防守方裁決；pose packet 不得覆蓋本機玩家 HP。多波命中須保留 attack/contact ID 去重。此架構不是防作弊伺服器。
- 目前兩名 actor 的 `0/1` 和 `1-id`、100 HP 標尺是跨模組契約。多敵人或可變最大 HP 必須先依系統文件拆解，不能只加陣列項目或改數字。
- 玩家、Boss、陪練共用 move／FSM／傷害路徑。Boss 應輸出 input bits，不直接強扣玩家 HP 或呼叫 UI。
- `RiftTutorial.observeCombat` 包装現有 resolver；修改 resolver 必須檢查教學，不能將訓練補給帶入正式對局。
- 保留 iOS 可信手勢內同步 resume/play、`interrupted` 恢復與重試；不要用 pending promise 鎖住後續手勢。觸控防選取只能作用於戰鬥區，不能吞掉音訊 `touchend`。
- 不提交 secret、PAT、真正 `.env`、測試報告或快取。不要求在聊天貼 token；使用提供的安全認證途徑。
- 保留原創世界觀／名稱與第三方授權。修改顯示名稱不等於更改穩定內部 ID；不得無意破壞協議或存檔鍵。
- 維持單檔發行及既有 Pages 流程；有必要更改時先補 ADR 與遷移／回退方式。
- 註解寫原因、契約或限制，不逐行翻譯程式。文件以繁體中文為主，API／identifier 保持英文。

## Adding New Content

統一步驟見 [CONTENT_COOKBOOK](docs/CONTENT_COOKBOOK.md)。Boss → [BOSS_SYSTEM](docs/BOSS_SYSTEM.md)；Enemy → [ENEMY_SYSTEM](docs/ENEMY_SYSTEM.md)；Ability → [ABILITY_SYSTEM](docs/ABILITY_SYSTEM.md)；Item → [ITEM_SYSTEM](docs/ITEM_SYSTEM.md)；Stage → [LEVEL_SYSTEM](docs/LEVEL_SYSTEM.md)；Story → [STORY_SYSTEM](docs/STORY_SYSTEM.md)。尚未存在的 registry 必須先做文件指定的最小接點，不能直接呼叫範例 API。

## After Editing

1. Build、check、相關 unit／integration test；UI、輸入、音訊或流程變更再做 browser smoke。
2. 依 [REGRESSION_CHECKLIST](docs/REGRESSION_CHECKLIST.md) 確認現有 Boss、移動、戰鬥、重開與平台行為。
3. Self Review：有無重複系統、模糊ownership、過度抽象、多改核心、難以再加第二份內容、過期文件？未完成重要事項寫TECH_DEBT／交班，並存舊新架構寫 `Migration in progress`。
4. 同步權威文件與三份狀態／日誌／交班；架構改動更新 ARCHITECTURE／ADR，必要時 CHANGELOG。回報未測、失敗與實機限制，不沿用舊測試數字。
5. `git diff --check`、檢查 source 和產物；按任務授權 commit/push。驗證方式及 Definition of Done 見 [DEVELOPMENT](docs/DEVELOPMENT.md)。最後提供 Handoff Summary，重要內容同步 CURRENT_HANDOFF。
