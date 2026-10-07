# 永久工作日誌

記錄實質任務的 **Why、架構影響與下一人需要知道的事**，不是Git流水帳。較新紀錄放前面；完成實質任務後新增一筆，不覆寫舊紀錄。微小typo／格式不另建條目。最新狀態見 [PROJECT_STATUS](PROJECT_STATUS.md)，最新接力棒見 [CURRENT_HANDOFF](CURRENT_HANDOFF.md)。

## 2026-10-07 — 4.2.0 蹬踏、蓄刺、手機分區與音樂雜訊

### Agent
Codex（戰鬥、手機、音訊與獨立審查分工；root整合，單一共同工作樹）。

### Task / Before
基準 `ca0625f` 的4.1.0已完成連續招架與三階段Boss；CI 37487420632、Pages 37487419373及Pages commit均成功。新回饋是蹬踏判定太窄、手機跳躍離移動鍵太遠、普通長按雙擊與奧義重疊，以及BGM似有雜訊。

### Impact Analysis
影響Combat輸入／反制、charged定義、render姿勢、教學、touch UI與audio混音；沿用既有FSM／resolver／input，不改Save鍵／Boss容量／Pages部署。相同charged ID語意改變，所以協議升5拒絕4。回退需一起回退來源、協議、教學與生成HTML。

### Changes / Why
- 空中第二跳有12tick緩衝、170px水平踏入輔助與橫掃收招18tick寬限；保留平台阻隔、行動鎖、一次滯空及attackId去重。避免要求玩家在極短時間精確對準頭頂，但不自動反制。
- 長按改單次普通pierce蓄刺，可格擋／招架，不再免費二連破防；危險紅突與雙斷仍各有用途。穩定ID不跟顯示名称改動，ADR-005記錄新語意與協議理由。
- 跳鍵置中於左右移動正上方；右侧墊步／架／斬，技具收合，暫停移到HUD。實際檢查發現320px直向和568px橫向重疊，使用局部CSS規則修正，沒有第二套手機輸入。
- 有效／載入中BGM不疊合成風雨河流；musicVolume零也不開fallback。正常振幅輸出保持線性，僅高峰限幅，保留iOS手勢流程與招架／警示duck。原曲未重編碼；ambient原檔含Rain and Vinyl Crackle標記，遊戲端修正不抹除曲目本身音色。

### Files Changed
src/core.js、fsm.js、net.js、render.js、tutorial.js、shell.html、audio.js及index.html；新增mobility-counter回歸，更新音訊／authority／combat／browser測試；系統文件、ADR005、manifest及狀態／交接文件。

### Architecture Impact / Decisions
新增tryStomp是既有counter的輸入輔助，不是新傷害系統；同一defender裁決，兩端result/contact仍去重。audio仍走原master路由，僅修正fallback條件與ceiling曲線，不建立第二套播放器。没有runtime migration in progress；Boss／Item／Stage registry仍PLANNED。

### Tests
11/11 Node suites通過，新增27項蹬踏／蓄刺包含host與guest權限，audio-music40項、iOS permission13項。Chromium測手機四尺寸、真實音樂／音量零底噪、OfflineAudioContext的正常波形與過載峰值；最終51項Chromium通過、無JS例外；遊戲提交 `0e0c116` 的CI／Pages與公開HTML全檔hash已核對成功，證據統一見 [VALIDATION](VALIDATION.md)。未關掉或跳過失敗案例。

### Known Problems / Do Not Forget
仍未取得實體iPhone與真實跨網WebRTC結果；四尺寸重新載入不等於同局旋轉，TD-16未修。常駐原曲雨聲／黑膠質感可能可聞，自動波形檢查不是實際手機聽感。不要將蹬踏輔助擴成穿平台或取消所有行動，也不要把蓄刺混回危險thrust。

### Recommended Next Step
先在真實手機驗證上跳下移、連擋／蹬踏與聲音；獨立補Canvas旋轉尺寸，再用第二Boss需求提取小型definition接點。

## 2026-10-06 — 4.1.0 連續招架與三階段赤衡
### Agent
Codex（並行AI／Vitals／render／測試／文件，最後整合與獨立審查）。
### Task / Before
4.0.2招架連按降至4tick、紫色雙波共用長動畫、Boss首次被招架後後跳、100/100/2容量與玩家相同。玩家要求讀招與連續接刀，並提高Boss耐久和階段。
### Impact Analysis
修改Combat/FSM、Vitals、Boss AI、renderer、HUD和教學；保存鍵不變，PvP維持100標尺但時序變更需protocol4；單檔與Pages方式不變。沿用同一resolver，不加第二套引擎／registry。回退必須一起回退source／artifact／protocol。
### Changes / Why
- 成功招架重置懲罰、空按保留可用下限與8tick緩衝；輕招收刀可接防禦，修正硬直末幀空隙，避免把正確連擋誤當抖刀。
- 明確maxHp/maxPosture/maxNodes與比例helper，使三核Boss復燃、治療、HUD不再被100硬上限截斷。
- 固定三階段組合、較清楚起手、組末空檔；多波中途招架保持節拍且每波6tick，避免第一彈取消整段或收刀仍命中。
- 紫色裂斬不再block chip，逐波準備提示；審查發現蓄斬先閃假輕斬cue，改為30tick放開、44tick真正出刀前提示。
- 修正AI成本與hitstop時鐘；沒有加入尚未使用的抽象。
### Files Changed
src/core.js、fsm.js、vitals.js、ai.js、render.js、net.js、shell.html、tutorial.js；index.html；新增三組回歸、更新既有與browser smoke；系統文件、ADR004、README／AGENTS、狀態與manifest。
### Architecture Impact / Decisions
既有actor首次支援不同容量，仍只有兩actor。Boss profile實際啟用但registry仍未存在；PvP邊界不變。ADR-004說明取代全域雙核／100HP假設，保留ADR-003防守方權限。
### Tests
build/check、10/10 Node suites、29/29 Chromium checks；正式engine129項、combat rhythm18項、AI rhythm9項、Boss vitals6項；瀏覽器含三核／重試、提示對準碰撞、非零音訊、手機長按與雙指。曾發現舊48tick charge期望與舊AI撤退欄位，依新設計更新；沒有跳過失敗。詳VALIDATION。
### Known Problems / Do Not Forget
未驗證真實iPhone、跨網WebRTC及主觀平衡；Canvas旋轉仍TD-16。每刀成功會消耗窗口，需要下一次按鍵；AI Boss末刀才Recoil的規則不可無意帶進PvP。所有多波變動都要對齊提示／碰撞。
### Recommended Next Step
先實玩新版取得可重現回饋，再調節拍或耐久；第二Boss才提取registry/factory，不因此次容量接點順手改整個引擎。

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

已實跑portable build與`--check`、7組Node suites、26項Chromium smoke；builder另外驗證搬移目錄、缺模組／重複marker失敗、只讀drift檢查和大小寫結束標記。靜態、乾淨複本、GitHub CI與Pages均通過，主要提交`2bd1772`已推送main；公開HTML和README內容一致。證據集中於 [VALIDATION](VALIDATION.md)，不在日誌維護另一份測試數字清單。

### Known Problems / Do Not Forget

既有Canvas沒有resize listener；真iPhone與跨網WebRTC未證實；第三方素材／vendor provenance待補。AI art考慮門檻與實際cost有落差，hitstop時AI觀察clock仍前進。見TECH_DEBT，這次沒有順手修它們以避免改變原版行為。

教學wraps resolver且可阻止特定斷決；帶電`charged=180`實際不自然倒數；不是所有計時欄位都能按名字猜行為。獨立審核已修正相關文件說法。未完成future registry不是「migration in progress」，而是尚未開始的PLANNED方案。

### Recommended Next Step

先做resize／實機品質驗證；內容方面以第二Boss作一條完整垂直切片驗證definition/factory接點，保留赤衡回歸。下一個實質任務完成後追加本日誌並覆寫CURRENT_HANDOFF，不能只在最終聊天留下理由。
