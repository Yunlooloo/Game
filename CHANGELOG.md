# Changelog

採 `MAJOR.MINOR.PATCH`；類別為 Added／Changed／Fixed／Removed。遊戲版本與網路協議版本分開，見 [DEVELOPMENT](docs/DEVELOPMENT.md)。

## Unreleased — 維護與交接基礎

### Added

- 繁體中文架構、內容擴充 cookbook、系統現況與未來資料契約。
- `AGENTS.md`、AI 導航／任務模板、project manifest、ADR、技術債與回歸清單。
- 多人／多AI協作協定、PROJECT_STATUS、CURRENT_HANDOFF與永久WORK_LOG；包含影響分析、ownership及接手驗收。
- Repository 內的原始模組、素材來源、portable build、測試與最小品質 CI。

### Changed

- 維護真實來源由工作區獨有檔案改為 repository 內 `src/`、`vendor/`、`assets/`。
- GitHub Pages 仍發布根目錄單檔 `index.html`；runtime 保持4.0.2、產物逐位元相同。

### Fixed

- 新 clone 無法重建及無法取得必要測試的維護缺口。

### Removed

- 無移除 runtime 功能；未搬入歷史草稿、暫存報告與舊版產物。

## 4.0.2 — 2026-10-04

### Changed

- 放大手機主要控制鍵、拇指分區與按住回饋；教學可收合。

### Fixed

- 戰鬥觸控誤選取、長按選單及誤捲動；保留房間輸入與多指操作。

### Added

- 手機暫停按鈕。

## 4.0.1 — 2026-10-04

### Fixed

- iOS pending resume 不再阻擋後續可信手勢，處理 interrupted 狀態與過期播放 promise。
- 初次「開啟聲音」不再立即切成靜音；維持前景／背景音訊恢復。

## 4.0.0 — 2026-10-04

### Added

- 原創程序人物與紙色首頁、22 課陪練、內嵌使用者提供的常駐／戰鬥音樂。

### Changed

- 簡短原創招式名稱、Boss 高低差路徑及有限次治療。

此處依已有提交補記4.x，不推測更早版本的精確發布日期與功能列表。實機／跨網驗證限制見 [TECH_DEBT](docs/TECH_DEBT.md)。
