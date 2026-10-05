# AI 接手導航

先讀 [README](../README.md) 和 [AGENTS](../AGENTS.md)，再依序讀本檔 → [PROJECT_STATUS](PROJECT_STATUS.md)（含最新 [CURRENT_HANDOFF](CURRENT_HANDOFF.md)）→ [WORK_LOG](WORK_LOG.md) → [ARCHITECTURE](ARCHITECTURE.md) → 任務system／ADR。假設沒有聊天記憶，先確認 git status/log、上一棒的 build/test 證據與 migration 狀態，完整協定見 [AI_COLLABORATION](AI_COLLABORATION.md)。

這是一個純 Canvas／Web Audio 的雙人刀劍對決原型，並非通用 RPG 引擎。`src/core.js` 協調 60 Hz loop；Boss 使用 `RiftAI`；產物為根目錄 `index.html`。系統存在與否以 [PROJECT_MAP](PROJECT_MAP.md) 為準。

## 從任務到真實來源

| 想完成的事 | 先讀 | 實際入口／下一步 |
| --- | --- | --- |
| 啟動、build | [DEVELOPMENT](DEVELOPMENT.md) | root：`python3 -m http.server 8000 --bind 127.0.0.1`；`python3 scripts/build.py` |
| 部署、rollback | [DEPLOYMENT](DEPLOYMENT.md) | main/root Pages；提交產物後檢查公開 commit／內容 |
| Game Loop／Player | [GAME_SYSTEMS](GAME_SYSTEMS.md) | core `frame/step/fighter/tickPlayer` |
| 增加第二隻 Boss | [BOSS_SYSTEM](BOSS_SYSTEM.md) | 先做最小 definition/factory 接點；目前只有一個 `RiftAI` |
| 增加普通敵人 | [ENEMY_SYSTEM](ENEMY_SYSTEM.md) | 先決定兩人 duel replacement 或多 actor；後者需要拆二人假設 |
| 改戰鬥、增加技能 | [COMBAT_SYSTEM](COMBAT_SYSTEM.md)、[ABILITY_SYSTEM](ABILITY_SYSTEM.md) | `MOVES`、FSM、vitals、authority、tutorial |
| 新道具／裝備／效果 | [ITEM_SYSTEM](ITEM_SYSTEM.md) | 現有 tool／tonic；新背包 registry 是 PLANNED |
| 新 Stage／Encounter | [LEVEL_SYSTEM](LEVEL_SYSTEM.md) | `makeWorld` 目前固定戰場；最小抽取 map definition |
| 劇情、對話、NPC | [STORY_SYSTEM](STORY_SYSTEM.md) | 目前不存在；從資料＋runner＋明確 trigger 做一條垂直切片 |
| 存檔、解鎖、成就 | [SAVE_SYSTEM](SAVE_SYSTEM.md) | 現有只有 tutorial localStorage；先設 schema／migration |
| 新素材、音樂或 SFX | [ASSET_PIPELINE](ASSET_PIPELINE.md) | assets／render／audio；保留單檔 build 和授權紀錄 |
| UI、觸控、iOS、效能 | [PLATFORM](PLATFORM.md) | shell／core input／audio；不要重引入全頁選取或 pending audio lock |
| 寫測試或 build 失敗 | [TESTING](TESTING.md)、[TROUBLESHOOTING](TROUBLESHOOTING.md) | check／test；先辨別依賴或遊戲缺陷 |
| 想知道哪些不能亂改 | [AGENTS](../AGENTS.md)、[ADR](adr/README.md) | 固定 tick、defender authority、FSM、二核心、100 HP／兩 actor 契約 |
| 技術債與下一步 | [TECH_DEBT](TECH_DEBT.md)、[ROADMAP](ROADMAP.md) | 第二 Boss 的小型 registry；平台實測與可重現驗證 |

所有新增內容的 Files → Steps → Example → Tests → Common mistakes 統一放在 [CONTENT_COOKBOOK](CONTENT_COOKBOOK.md)，任務輸入格式見 [AI_TASK_TEMPLATE](AI_TASK_TEMPLATE.md)。不要把 cookbook 的 PLANNED 範例當作已提供 API。

## 十分鐘接手順序

1. 看 Git status 和近期 log，確認自己的基準；不要靠舊聊天記憶覆蓋新程式。
2. 從上表找系統，閱讀引用的來源符號和測試；先查現有相同抽象並完成Impact Analysis，再決定最小修改範圍。
3. 執行 `python3 scripts/check.py`、`python3 scripts/test.py` 建立基準；UI 任務另外跑 browser smoke。
4. 寫下已實作行為、這次新增內容、驗證方式；開始改 source，再 build。
5. 用 DoD／Self Review 完成驗證與文件同步，刷新狀態、覆寫最新交班、追加實質工作日誌。沒有實測的裝置／網路條件，明確寫「未測」，不可把 mocked transport 當成真實連線。

## 必須保留的上下文

來源與測試已在 repository；不需 `/workspace/ashina-build`、舊會話或任何私人附件才能 build。沒有 project-wide 開源 license、沒有 server authority、沒有戰役存檔，也沒有多 Boss runtime registry。若接手者決定演進這些邊界，應以新 ADR 與 migration／rollback 取代舊決策，而非靜默推翻。
