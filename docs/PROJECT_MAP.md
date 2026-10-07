# 現況地圖 · IMPLEMENTED

現在的維護來源是 `src/`，發行入口是根目錄 `index.html`。原本 GitHub 只有產物；本次把既有開發模組原樣納入版控。所有下列符號均存在於來源；不存在的系統另標 PLANNED。

| 想找什麼 | 檔案／符號 | 要一起看 |
| --- | --- | --- |
| HTML、DOM ID、CSS、選單 | [src/shell.html](../src/shell.html) | `Game.bind`, `renderHUD` |
| 啟動 | [src/core.js](../src/core.js) 尾端 `window.game = new Game()`；再建立 `RiftTutorial` | build script 決定載入順序 |
| 主要 loop | `Game.frame`、`Game.step` | `TICK_RATE`, `FIXED_DT`, `MAX_STEPS` |
| Player／Boss actor | `fighter(id,x,loadout,art)` | 不是 Player／Boss 繼承類別 |
| World／單一戰場 | `makeWorld` | `physics`, `grapple`, `weatherTick` |
| Boss controller | [src/ai.js](../src/ai.js) `RiftAI` | `Game.start`, `frame`, `aiControlled` |
| 攻擊資料／輸入 bit | `MOVES`、`B`，經 `window.RIFT` 供工具查閱 | 沒有獨立 content registry |
| 戰鬥 | `begin`, `tickPlayer`, `advanceAttack`, `activate`, `collisions`, `hit`, `counter` | [COMBAT_SYSTEM](COMBAT_SYSTEM.md) |
| 動作 state | [src/fsm.js](../src/fsm.js) `RiftFSM` | `enter`, `canTransition`, `postureRate` |
| 傷害／喝藥／倒地／復燃 | [src/vitals.js](../src/vitals.js) `RiftVitals` | `hurt`, `beginDrink`, `takeNode`, `recoverDown` |
| 回合／勝敗／重開 | `execute`, `finisherScene`, `showResult`, `start`, `lobby` | 首次失去核心不結束 |
| Network transport | [src/net.js](../src/net.js) `RiftNet` | vendor PeerJS；protocol `VERSION=5` |
| Defender authority | [src/authority.js](../src/authority.js) `RiftAuthority` | `Game.receive*`、`owns`、去重 |
| Rendering／Animation | [src/render.js](../src/render.js) `RiftRenderer` | `player`, `updateCamera`, `render`；程序動畫 |
| Audio | [src/audio.js](../src/audio.js) `RiftAudio` | `start`, `sfx`, `_mixMusic`, `getMusicStatus` |
| 教學 | [src/tutorial.js](../src/tutorial.js) `LESSONS`, `RiftTutorial` | [教學 HTML](../src/tutorial-ui.html)、[CSS](../src/tutorial-ui.css) |
| Save | `RiftTutorial` 的 `riftblade-tutorial-v1` localStorage | 只有課程完成 ID；[SAVE_SYSTEM](SAVE_SYSTEM.md) |
| UI 更新／事件繫結 | `Game.bind`, `renderHUD`, `showPause`, `showResult` | 目前直接操作 DOM，非獨立 UI store |
| Input | `bindMouse`, `input`, `mouseInput`, `touchInput`, `clearInputs` | keyboard、mouse、per-pointer buffers |
| Config | core 的常數／`MOVES`／`makeWorld`；audio/render 模組常數 | 沒有集中 GameConfig；見 DEVELOPMENT |
| Debug | `window.game.debug`、`window.RIFT` | 直接物件／方法，不是安全隔離 sandbox |
| Assets | [assets/audio/music](../assets/audio/music/)、程序 Canvas 和 Web Audio | [ASSET_PIPELINE](ASSET_PIPELINE.md) |
| Build | [scripts/build.py](../scripts/build.py) | 根目錄 [index.html](../index.html) 是 generated |
| Tests | [tests/](../tests/)、[scripts/test.py](../scripts/test.py) | [TESTING](TESTING.md) |
| CI／Deployment | [.github/workflows/ci.yml](../.github/workflows/ci.yml)、Pages `main:/` | [DEPLOYMENT](DEPLOYMENT.md) |

## Repository 邊界

`/workspace/ashina-build` 是歷史工作區，不是專案依賴，也不能作為下次接手的唯一資訊來源。已納入的來源與測試以本 repository 為準；歷史截圖和報告不代表本次實測。無 package.json、runtime npm install、後端、資料庫、外部 CDN 資源下載。

## 尚不存在 · PLANNED

Boss／enemy／ability registry、StageManager、Inventory、Dialogue runner、Progression、版本化 SaveStore、通用 StatusEffect、EventBus、Localization registry。它們的最小接點與新增方式由 [ARCHITECTURE](ARCHITECTURE.md) 和各系統文件定義；不要在程式中搜尋假想類別後自行建立重複框架。
