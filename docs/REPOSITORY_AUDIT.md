# Repository 稽核紀錄

Date: 2026-10-05 · Baseline commit: `e5847fa279a49a92b0f7fc296dfe052b751648b2` · Runtime: **4.0.2**

## 稽核前 · IMPLEMENTED

Git 只追蹤 `index.html`，沒有 README、AGENTS、package manifest、build script、tests 或 Actions workflow。遊戲可由 Pages 使用；實際開發模組、build及測試存在 `/workspace/ashina-build`，因此單靠repository無法接手。工作樹稽核開始時乾淨，remote main與baseline相同。

## 本次檢查範圍

- 九個 authored JS 模組：core、FSM、vitals、authority、network、AI、renderer、audio、tutorial；DOM/CSS 外殼與教學 fragments。
- 所有 move定義、input adapters、世界幾何、雙核心／phase、Boss決策／導航／heal、碰撞與damage、防守方網路同步。
- render／程序人物動畫／相機、兩段music及合成SFX、touch/iOS啟動、localStorage存取、debug入口。
- 歷史build組裝、可保留測試、PeerJS版本／授權／檔案雜湊、原始素材與生成產物一致性。
- Git歷史、remote main、Pages API：`build_type=legacy`、`source=main:/`、HTTPS公開網址；不是Vercel/Netlify、沒有遊戲backend。

對minified vendor採來源／版本／使用介面及checksum稽核，未將其稱為完整第三方安全或授權審計。未在實體iPhone、任意NAT或所有瀏覽器驗證。

## 技術 Stack

| 項目 | IMPLEMENTED／版本 | 說明 |
| --- | --- | --- |
| Language | HTML5、CSS、原生JavaScript（現代瀏覽器API） | 無TypeScript/transpile |
| Framework／Engine | 無第三方UI或遊戲engine；自製 `Game` | 無React/Vue/Phaser/Pixi/Three |
| Rendering | Canvas2D、程序美術；DPR上限2 | DOM用於menus/HUD |
| State | mutable world/fighter + RiftFSM | 無Redux/ECS/EventBus |
| Audio | Web Audio API + HTMLAudioElement／內嵌MP3 | 無外部音樂URL |
| Networking | vendored PeerJS **1.5.5**、WebRTC；自製協議 **3** | 與遊戲4.0.2不同版本軸 |
| Build | Python stdlib `scripts/build.py` | 本次建立portable入口；不需要bundler |
| Package manager | runtime無；browser tests使用pip | 無package.json或npm鎖檔 |
| Test | Node `assert`/VM + Python Playwright **1.62.0** | 真實瀏覽器與mock權限/transport須區分 |
| Dev runtime | Python **3.12.14**、Node **24.19.0**（本次環境） | 支援範圍Python3.11+、Node22+，非全矩陣已測 |
| Browser observed | Chromium **151.0.7922.173** | 非Safari/iPhone實機 |
| CI | 本次加入最小GitHub Actions品質檢查 | 不取代Pages branch發布 |
| Hosting／Deploy | GitHub Pages `main:/` | https://yunlooloo.github.io/Game/ |

## 本次必要結構改善

**IMPLEMENTED**：原樣收編來源至 `src/`、vendor至 `vendor/`、MP3至 `assets/audio/music/`，用portable build產出root HTML。測試只收編仍有用途的回歸與harness，改為repo-relative，不提交歷史log／舊遊戲／執行報告。目錄責任見 [PROJECT_MAP](PROJECT_MAP.md)。

未將PLANNED的Boss registry、背包、story、save或eventbus做成空殼程式；現況已可運作，這次不混入玩法改寫。

## 相容基準

`index.html` baseline bytes：**14,335,866**。

SHA256：`10a98714423629033c78cd756e7d2305a9276c4de530d81b5568ce56bbb0d81a`。

新build必須逐位元再現此檔案；這是本次相容證據，不是未來版本永遠必須相同的checksum。未來修改遊戲應由source重建並更新版本及測試，不要把驗證改成永遠接受baseline。

## 現況／未來分界

已有單Boss duel、22課、local／online模式，沒有多actor encounter、inventory、story/quest、stage切換或完整persistent save。可擴充性設計見 [ARCHITECTURE](ARCHITECTURE.md)。發現的旋轉resize缺口、測試範圍、信任與素材權利風險統一見 [TECH_DEBT](TECH_DEBT.md)。

當次執行結果會寫入 [VALIDATION](VALIDATION.md)；日常指令由 [TESTING](TESTING.md) 維護，避免把歷史通過數當成新修改的證據。
