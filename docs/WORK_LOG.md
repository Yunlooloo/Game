# 永久工作日誌

記錄實質任務的 **Why、架構影響與下一人需要知道的事**，不是Git流水帳。較新紀錄放前面；完成實質任務後新增一筆，不覆寫舊紀錄。微小typo／格式不另建條目。最新狀態見 [PROJECT_STATUS](PROJECT_STATUS.md)，最新接力棒見 [CURRENT_HANDOFF](CURRENT_HANDOFF.md)。

## 2026-10-05 — 可重建來源與多人／多 AI 交接基礎

### Agent

Codex（分工審核、整合驗證）；單一共同工作樹。

### Task / Before

需求是建立長期架構文件、內容擴充方法、測試／部署流程與AI協作記憶，直接提交main。基準`e5847fa`：Git只追蹤`index.html`；九個JS模組、音樂原檔、build／tests留在工作區，clone無法自行重建。玩法已有一Boss／雙核心／22課／音訊觸控修正，但沒有通用Boss registry、完整save或戰役。

### Changes / Files Changed

- 收編 `src/`、`vendor/`、`assets/audio/music/`，新增 `scripts/build.py`；產物仍根目錄HTML。
- 移植仍有用途的 `tests/`、`scripts/check.py`／`test.py`，新增最小 `.github/workflows/ci.yml`，報告留ignored `test-results/`。
- 新增 README、AGENTS、CHANGELOG、授權來源說明、docs系統／內容／維運文件、ADR與machine manifest。
- 補 PROJECT_STATUS／CURRENT_HANDOFF／本日誌／AI_COLLABORATION；固定閱讀／Impact Analysis／ownership／self-review協定。
- build明確拒絕缺失或重複標記，處理大小寫script結束字串；修正移植smoke的舊selector和過期報告風險。沒有改遊戲runtime邏輯。

### Why / Architecture Impact

不讓開發知識依賴某次聊天或雲端snapshot。source與單檔發行分離，仍逐位元相容；新增內容有實際接點和既有pattern可沿用。文件明列未來方案，沒有替不存在需求先建空架構。現有核心仍有耦合，文件不把它美化成已完成ECS／EventBus。

### Impact Analysis / Decisions

影響build、tests、CI、文件；runtime、storage key、network protocol、遊戲數值不變。查既有來源與測試後採原生Python／JS，不引入bundler或npm。決策見ADR-001（來源＋單檔）、ADR-002（增量資料化）、ADR-003（fixed tick／defender authority）。單一權威傷害路徑、兩actor和100HP契約繼續保留。

### Tests

已實跑portable build與`--check`、7組Node suites、26項Chromium smoke；builder另外驗證搬移目錄、缺模組／重複marker失敗、只讀drift檢查和大小寫結束標記。最終靜態／乾淨複本／CI／部署結果集中於 [VALIDATION](VALIDATION.md)，不在日誌維護另一份測試數字清單。

### Known Problems / Do Not Forget

既有Canvas沒有resize listener；真iPhone與跨網WebRTC未證實；第三方素材／vendor provenance待補。AI art考慮門檻與實際cost有落差，hitstop時AI觀察clock仍前進。見TECH_DEBT，這次沒有順手修它們以避免改變原版行為。

教學wraps resolver且可阻止特定斷決；帶電`charged=180`實際不自然倒數；不是所有計時欄位都能按名字猜行為。獨立審核已修正相關文件說法。未完成future registry不是「migration in progress」，而是尚未開始的PLANNED方案。

### Recommended Next Step

先做resize／實機品質驗證；內容方面以第二Boss作一條完整垂直切片驗證definition/factory接點，保留赤衡回歸。下一個實質任務完成後追加本日誌並覆寫CURRENT_HANDOFF，不能只在最終聊天留下理由。
