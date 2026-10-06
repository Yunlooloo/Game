# 新增內容 Cookbook

這份文件管理「從哪裡改、先接哪個入口、如何驗收」；數值與系統契約以連結的系統文件為準。**IMPLEMENTED** 表示可用的現有路徑；**PLANNED** 表示首次新增時必須一起完成的接點；**OPTIONAL** 表示非必要的額外能力。

目前沒有Boss、Enemy、Item、Stage、Dialogue registry；core的 `BOSS_PROFILE` 是已接入赤衡的容量／攻擊覆寫配置，`RiftAI._patterns()` 是三階段組合來源。以下未來路徑及 API 範例**不會在現版自動載入**，也不能直接貼進 console。第一次新增內容通常要先把現有預設內容接上最小 registry，再增加第二份資料；不應先造完整 RPG 框架。

## 共用交付流程

1. 從 [AI_HANDOFF](AI_HANDOFF.md) 找責任文件，確認這次是現有功能變體，還是第一個需要新 system 的功能。
2. 保持現有角色、Boss、教學和對局預設。資料定義不可存每局會變的 HP、冷卻、AI history 或 `cut/torn` 狀態。
3. 新增腳本時更新 `scripts/build.py` 的 `MODULES` **明確順序**：依賴先載入，內容／factory 在使用它的 `core.js` 前。現在是傳統 script／IIFE，不是 ESM；沒有自動掃描 `src/content/`。
4. `tests/*.test.cjs` 是 Node suite 入口；`tests/cases/*.js` 是由 `tests/engine.test.cjs` 明列載入的 headless engine 案例，不會僅靠新增檔名自動執行。需要新 browser case 時，在 `tests/browser_smoke.py` 明確加入斷言。
5. 執行 `python3 scripts/build.py`、`python3 scripts/check.py`、`python3 scripts/test.py --browser`；完整前置條件與測試範圍見 [TESTING](TESTING.md)。新增內容的專用測試也要隨 runner 一起交付。
6. 更新所屬系統文件、[PROJECT_MAP](PROJECT_MAP.md)、必要的 CHANGELOG／ADR；依 [AI_COLLABORATION](AI_COLLABORATION.md) 刷新狀態／交班／工作日誌。確認生成的 `index.html` 與來源同步，再依 [DEPLOYMENT](DEPLOYMENT.md) 發布。ID 規則只在 [DEVELOPMENT](DEVELOPMENT.md) 維護。

### Extension Point 的核心邊界

首次導入registry／factory需要少量接線；完成後，同類內容應只新增definition／behavior／registry entry／素材／測試。若每次都得改`frame`、`hit`、FSM、UI、Save，記為Architecture Smell再逐步改善，不把特例堆回核心。所有新schema與檔案在未落地前都仍是PLANNED。

| 內容 | 應避免每次修改的核心 |
| --- | --- |
| Boss／Enemy | frame、共用hit／vitals／FSM；特殊攻擊留在能力或內容behavior |
| Ability／Item | 不改每一個actor controller；成本與效果走共享接點，Inventory唯一扣量 |
| Stage／Dialogue／Quest | 不改damage resolver；切場／劇情／任務透過Encounter與已確認事件 |
| Audio／Achievement | 不因每個新音軌／成就新增GameLoop條件；前者走media映射，後者看結果事件 |

## Add a Boss · PLANNED：第二位可選對手

**先讀**：[BOSS_SYSTEM](BOSS_SYSTEM.md)、[COMBAT_SYSTEM](COMBAT_SYSTEM.md)。完整 Boss 契約與測試表以 Boss 文件為準；這裡提供操作摘要。

**Files**

- 現有：`src/core.js` 的 `fighter / makeWorld / Game.start / frame`、`src/ai.js`、`src/vitals.js`、`src/render.js`、`src/shell.html`。
- 首次新增：`src/content/bosses/chiheng.js`、`registry.js`、`factory.js`；再加 `tidekeeper.js`。新策略不能用 profile 表達時才加 `tidekeeper-ai.js`。
- 測試建議：`tests/boss-definitions.test.cjs`、擴充 AI 行為案例與 browser 啟動案例。

**Steps**

1. 先刻畫赤衡基準：12 tick視覺反應與hitstop凍結、垂直導航、飲藥、240／220／3容量、前兩核復燃／第三核結束、三階段節拍。不要在抽取資料時順便改平衡。
2. 把 `BOSS_PROFILE` 與 `_patterns()` 的現有預設搬成 `boss_chiheng` 定義。factory 驗證 ID／招式引用，建立新的 controller 和 runtime overrides；不能把定義物件直接當 fighter。
3. `Game.start('ai', config)` 接受 `config.bossId`，缺省仍用赤衡；把配置套到 `players[1]`，保留 actor ID 1 與兩人 authority。移除原本無條件覆寫名字的那一行，讓 `this.ai` 使用所選 controller。
4. 讓 `RiftAI.input(world,self,enemy)` 真正讀取 profile 的攻擊集合／冷卻。AI 仍只能輸出共用 input intent；新 Boss 不得直接扣玩家 HP。
5. 登錄 `boss_tidekeeper`，接 presentation palette 與大廳選擇。新音樂不是必要條件，可以先沿用 `battle`。
6. 同任務加入可測的本機 selector，例如白名單 `?debug=1&boss=boss_tidekeeper`。**現版尚無此 query 功能**；不得把它寫成目前可用命令。重試要保留選擇但重建 AI 狀態，教學與 PvP 維持原設定。

**Example**

```js
// PLANNED：完整 schema 見 BOSS_SYSTEM；這是差異摘要，不是可直接載入的定義。
const tidekeeperProfile = {
  id: 'boss_tidekeeper', name: '潮守',
  stats: { maxHp: 240, maxPosture: 220, maxNodes: 3 },
  loadout: ['disc', 'aegis'], art: 'cleave',
  attackPattern: ['light', 'thrust', 'charged']
};
```

**Tests**：兩位 Boss 都由同一 selector 啟動；赤衡基準不變；新 Boss 配置真正生效；上下層重新接近；飲藥能被打斷；Boss三核／玩家雙核、比例恢復／重試／未知ID；22 課、同屏與既有連線 authority 回歸。

**Common mistakes**：只放定義卻沒接 `start()`；只改當前 `hp` 沒設容量，或把本機Boss容量送進仍限100／100／2的PvP協議；複製整個 `RiftAI`；同場塞第三角色冒充「新增可選 Boss」；controller 直接操作 DOM 或發獎勵。

## Add an Enemy · PLANNED：先決定是否同場多敵人

**先讀**：[ENEMY_SYSTEM](ENEMY_SYSTEM.md)。新增一位可選弱對手與同場多隻敵人是不同改動規模。

**Files**：可選對手先沿用上節 factory/controller 接點；真正 Enemy 內容放 `src/content/enemies/foundry_guard.js` 與 `registry.js`。多敵人需要修改 `core.js` 的 `tickPlayer / collisions / frame / step`、`vitals.js` defeat rule、`render.js` HUD／鏡頭，以及將來 Encounter 模組。

**Steps**

1. 若只要較弱陪練／可選對手，仍放 `players[1]` 並沿用共享 fighter／雙核心，先用較少招式的 profile。
2. 若需求是關卡怪物，先解除 `players[1-id]`、固定兩格輸入及單一 AI 的假設，加入明確 target query 與 controller ownership；每一步維持雙人模式通過。
3. 將 defeat rule 與共享傷害路徑分開：普通敵人若 HP 歸零直接死，就為該 profile 實作這條規則，不改所有 fighter。
4. 新增域內 registry 與一個簡單 controller。Encounter 負責 spawn/despawn，controller 負責感知和意圖，Combat 負責命中。
5. 第一版多敵人限定 local；現有 P2P 並無多人／AI ownership 協議。完成 ownership 設計後才開放線上。

**Example**

```js
// PLANNED：hp_zero 需要先實作 defeat-rule 接點，現有 Vitals 不接受這個欄位。
const guard = {
  id: 'enemy_foundry_guard', rank: 'normal',
  abilityIds: ['light', 'thrust'], controllerId: 'patrol_guard',
  defeatRule: 'hp_zero', rewards: []
};
```

**Tests**：出生／移除後沒有殘留 attack；同波對同 target 只命中一次；死亡不再行動；切換目標／視野；暫停；Boss仍依自身 `maxNodes` 經斷決扣核；若加掉落，完成結果重送只領一次。

**Common mistakes**：只把 actor push 進 `world.players`；以 array index 當永久 entity ID；Enemy 自己做第二套傷害；一開始就加仇恨、巡邏圖、刷怪 Director，卻沒有單一可玩的 Encounter。

## Add an Ability · IMPLEMENTED 變體路徑／PLANNED registry

**先讀**：[ABILITY_SYSTEM](ABILITY_SYSTEM.md)、[COMBAT_SYSTEM](COMBAT_SYSTEM.md)。現有 `MOVES` 已共用於玩家、Boss、陪練，先延伸它。

**Files**：`src/core.js` 的 `MOVES / begin / tool / tickPlayer / activate / collisions / hit`；需要顯示或聲音時加 `render.js / audio.js`。玩家可選項另改 `shell.html`；線上改動檢查 `net.js / authority.js` 的 allowlist。

**Steps**

1. 先選既有 `kind` 和數據，避免每招都造新的判定系統。設定完整 startup／active／recovery、reach、傷害、架勢、cost；waves必須落在active內，各波 `hitWindow` 與畫面重起節拍須一致。
2. 在 `MOVES` 加唯一 ID，再明確接到一個既有裝備槽、奧義選項或 AI profile。一般起手統一呼叫 `begin()`，不能直接 `activate()` 繞成本。
3. 新 `kind` 才增加 resolver 和 presentation handler；新工具／奧義需同步 UI 與網路引用驗證。現有 input bitmask 已用到第 16 bit，不能任意再加一位。
4. 若內容已造成重複，再把既有定義原樣抽到 `src/content/abilities/registry.js` 與各定義檔，保留舊 ID；接回 `begin()` 和 authority 後才增加新的資料格式。

**Example**

```js
// PLANNED 新變體；插入 MOVES 後仍要接可達的輸入／AI 選擇入口。
// kind 使用現有輕斬的 'slash'，不假定有未實作的新 resolver。
echo_cut: { name: '鳴斬', windup: 24, active: 6, recovery: 20,
  reach: 150, damage: 12, posture: 18, kind: 'slash', cost: 3 }
```

**Tests**：起手不可防禦；花費不足不出招；揮空／格擋／招架／受傷取消；一波不重複傷害；多波各自命中、波間不命中；Boss非末波招架保留／末波反彈；本地與防守端authority結果；新增裝備可實際選配。

**Common mistakes**：只加 `MOVES` 但玩家永遠無法選到；新 kind 沒 resolver；用顯示名判斷招式；攻擊端直接扣遠端 HP；把 cooldown 交給真實時間 `setTimeout()`。

## Add an Item · PLANNED：第一個背包功能

**先讀**：[ITEM_SYSTEM](ITEM_SYSTEM.md)、[SAVE_SYSTEM](SAVE_SYSTEM.md)。現在只有三次修復劑計數與兩個工具槽，沒有通用背包。

**Files**：首次建立 `src/content/items/repair_tonic.js`、`registry.js`、`src/inventory.js`；整合 `core.js` 的 `fighter / tickPlayer` 與 `RiftVitals.beginDrink / tickDrink`。需要永久保存才增加 `src/save.js`。

**Steps**

1. 先寫玩法範圍：每局補充，還是跨關庫存；消耗品、裝備、任務物品應由 `kind` 區分。
2. Definition 記穩定 ID、描述、maxStack、效果引用；InventoryEntry 只記持有量／必要 instance 資料。
3. 純邏輯 inventory 驗證 `canAdd/add/remove`，用一個 adapter 將修復劑接回目前 54 tick 可被打斷的治療。`tonics` 和 inventory 不能同時成為數量真實來源。
4. 道具 UI 只提出使用請求，FSM／Ability 驗證成本和當前狀態。裝備 modifier 從 base 重算，不能反覆乘回舊值。
5. 將來 Encounter 結算才發獎勵，並以 receipt 去重；最後才依版本化 Save Schema 保存。未有商店時 `price:null` 即可。

**Example**

```js
// PLANNED；ability_repair_tonic 也需登錄並接回既有飲藥流程。
const tonic = { id: 'item_repair_tonic', kind: 'consumable',
  name: '修復劑', maxStack: 3, rarity: 'common', price: null,
  use: { abilityId: 'ability_repair_tonic' } };
const held = { itemId: 'item_repair_tonic', quantity: 2 };
```

**Tests**：零／負／非整數量；滿堆疊；使用失敗不扣量；喝藥被打斷後不治療、不退次數；裝備移除無數值漂移；若保存，舊版遷移與未知 ID 恢復；所有舊教學仍可完成。

**Common mistakes**：把戰鬥工具的 spirit 當背包數量；UI 直接改 HP；新增 item JSON 卻無使用入口；沒有 saveVersion 就寫永久背包；以未知 ID 為由默默刪玩家物品。

## Add a Stage · PLANNED：第二競技場先沿用兩人規則

**先讀**：[LEVEL_SYSTEM](LEVEL_SYSTEM.md)。目前唯一場地由 `makeWorld()` 建立，4000×1200 不是已集中設定的可變尺寸。

**Files**：先加 `src/content/stages/foundry.js`、`registry.js`，再加新圖 `observatory.js`；接 `core.js` 的 `makeWorld / start / physics / weatherTick / finisherScene`、`ai.js` 導航、`render.js` 背景／相機。教學 `tutorial.js` 保留原圖。

**Steps**

1. 把現有 platforms／anchors／spawns 抽成完整的 `stage_foundry`，數值與順序不變；每局複製可破壞物和 runtime 陣列。
2. 讓 `makeWorld()` 和 `Game.start()` 接受已驗證 stageId，缺省保持原圖；新圖初版沿用同樣世界邊界。
3. 加 selector 的同時加 loader／validation。**現版沒有 stage query**；不要只在文件寫 `?stage=...` 然後假定會生效。
4. 測 AI 在新平台和錨點間能往返，再加入大廳選項。若真的要可變世界尺寸，再統一 physics、projectile、camera、background 的 bounds。
5. 多場串接需求出現時才加 Encounter Runner。最終 `finisherScene(a,t,final)` 的 confirmed 結果只發一次，由 runner 決定下一場／返回，不由 Boss 自行切 DOM。

**Example**

```js
// PLANNED 差異摘要；不是省略平台後也能執行的完整 Stage。
const observatory = { id: 'stage_observatory', defaultWeather: 'storm',
  musicId: 'battle', encounters: [{ id: 'encounter_observatory_tidekeeper',
    kind: 'boss', bossId: 'boss_tidekeeper' }] };
```

**Tests**：spawn 可站立；平台有限數值和正寬度；掛索可達；上下追擊、角落脫困；天雷防守端權限；重試清空破壞／投射物／timer；舊圖教學22課；mobile camera。線上新圖另測兩端 stage 版本協商。

**Common mistakes**：地圖只改畫面沒有改碰撞；共享被上一場切斷的物件；忘了教學橋面硬編碼；單端切換線上場地；先建立 World/Chapter 框架卻沒有第二張可玩地圖。

## Add Dialogue · PLANNED：第一段戰前對話

**先讀**：[STORY_SYSTEM](STORY_SYSTEM.md)、[SAVE_SYSTEM](SAVE_SYSTEM.md)。`LESSONS` 與 combat caption 不是 Dialogue API。

**Files**：`src/content/dialogue/chapter_01/gate.js`、`src/content/dialogue/registry.js`、`src/dialogue.js`；UI 在 `shell.html` 的獨立面板，協調入口在 `Game.bind / start / clearInputs`。新增進度後才接 SaveService。

**Steps**

1. 用純資料描述 start node、speaker、text、choice／next；先以兩句線性對話實作可測 runner，避免腳本語言。
2. 驗證所有 node 引用；condition／action 只允許登錄 kind，不能 `eval` 任意字串。重複提交選項必須無副作用。
3. UI 用 `textContent`，支援 keyboard、touch 和焦點；打開／關閉時清掉 gameplay input，避免點選對話時揮刀。
4. 第一版只放單機戰前；`Game.start()` 前播放較容易保持 combat 時鐘不動。若戰鬥中播放，明確處理 pause／accumulator 和恢復焦點，不能單端凍結線上對局。
5. 選擇提交／事件完成後才更新永久 flags；有真正 Encounter Runner 再接事件。重試或 reload 不可重複發獎勵。

**Example**

```js
// PLANNED，須有 runner / registry / UI 才會出現。
const greeting = { id: 'dialogue_gate', startNodeId: 'greeting', nodes: {
  greeting: { speakerId: 'npc_gatekeeper', text: '聽清刀鳴，再踏入場中。',
    emotion: 'calm', portraitId: null, nextNodeId: null }
} };
```

**Tests**：起點／next 缺失報錯；條件未知拒絕；循環不鎖死；選項提交一次；對話→戰鬥→返回；底下不觸發移動；窄螢幕文字捲動；加入 flags 後測 save migration。

**Common mistakes**：把文字和故事 flag 散在 `Game.hit()`；複製教學 wrapper 當 event bus；`innerHTML` 注入內容；把尚無 NPC loader 的 speakerId 誤當可互動角色。

## Add Music · IMPLEMENTED 替換／PLANNED 第三首

**先讀**：[ASSET_PIPELINE](ASSET_PIPELINE.md)、[PLATFORM](PLATFORM.md)。音訊的來源、授權與 iOS 手勢限制不可省略。

**Files**：`assets/audio/music/ambient.mp3`、`battle.mp3`；`scripts/build.py` 的 `TRACKS`；`src/audio.js` 的 `setScene / _ensureMusic / _mixMusic`；`core.js` 的 `syncAudioState()`。

**Steps**

1. 只替換現有常駐／戰鬥音樂時，保留檔名與 IDs，確認取得／再散布條件並更新素材紀錄，再 build；不需要新 music 系統。
2. 新增第三首例如 `music_boss_tidekeeper.mp3` 時，同時加入 build `TRACKS` 和 runtime 曲目允許集合；`_ensureMusic()` 現在只遍歷 `ambient/battle`，`setScene()` 也只接受它們。
3. 由已實作的 encounter／Boss selection 接到選曲入口。現在 `syncAudioState()` 每次按 `world.phase` 選 `battle/ambient`，也要更新，否則新曲會立即被覆寫。
4. 保留 crossfade、離場 pause、loop、master/mute/musicVolume、duck 和可信手勢重試；不要一次 decode 所有完整 PCM 或新增無關 AudioContext。
5. 把第三首之後的對映提成小型 music manifest 即可；不是要換音訊引擎。新曲失敗仍能戰鬥，不能卡在載入畫面。

**Example**

```python
# PLANNED 第三首接入的一部分；只改這行不會让 runtime 自動播放它。
TRACKS = ("ambient", "battle", "music_boss_tidekeeper")
```

**Tests**：MP3 真實樣本可解碼；手勢開聲、首次按鍵不誤靜音；ambient↔battle↔新曲切換無疊播；fade 中連續切曲／mute／pause；iOS interrupted／pending play 可重試；刀鳴與危險提示不被蓋過；記錄新增檔案及 HTML 大小。

**Common mistakes**：只放 MP3 沒 build；只改 `TRACKS` 忘 runtime allowlist；更改 `syncAudioState` 後破壞 lobby 音樂；先 await 再 `play()` 丟失手勢授權；宣稱 Chromium 模擬通過就等於真 iPhone 出聲。

## Add SFX · IMPLEMENTED 合成音效

**Files**：`src/audio.js` 的 `sfx / _voice / _tone / _noise / _source`；事件發生的位置通常在 `core.js` 的 `fx / hit / counter`，而非 render loop；測試用既有 audio suite pattern。

**Steps**

1. 為一個明確事件選短 ID，於 `sfx` 的有限 switch 加合成組合。聲音由既有 voice 管理，經 master／limiter 輸出。
2. 設 voice duration、rate limit 和需要的 music duck；新 voice 長度需涵蓋最晚 source 結束，不能每 tick 無限制建立 oscillator。
3. 在 authoritative 成功事件或本地 UI 意圖觸發一次；網路重送不重播確認音。既有 SFX ID 不隨顯示名称改動。
4. 只有確有錄製音效需求才新增 `assets/audio/sfx/`、内嵌管線與播放生命週期；目前沒有此 loader。

**Example**

```js
// PLANNED 新 case；v 是現有 sfx() 建立、會清理的 voice。
case 'uiConfirm':
  this._tone(v, 660, 660, 0, 0.08, 0.06, 'sine');
  this._tone(v, 880, 880, 0.07, 0.10, 0.04, 'sine');
  break;
```

**Tests**：mute／暫停無聲；rate limit；真實 AudioContext 有樣本；voice 最終 disconnect；長時間重複觸發無累積；新聲不遮蔽戰鬥反制；iOS gesture/恢復路徑不變。

**Common mistakes**：直接接 `context.destination` 繞過 master；在 renderer 每幀播事件音；只測 mock 呼叫次數卻沒聽／量測真實輸出；把高增益當作更好的打擊感。

## Add UI Screen · IMPLEMENTED DOM 接點／PLANNED 獨立 adapter

**先讀**：[GAME_SYSTEMS](GAME_SYSTEMS.md)、[PLATFORM](PLATFORM.md)。現版 UI 與 `Game` 耦合，新增畫面應逐步縮小耦合，不能假定已有 UI router。

**Files**：`src/shell.html` 的 DOM／CSS，`core.js` 的 `bind / clearInputs / togglePause / lobby / renderHUD`。需要獨立控制器時新增 `src/ui/<screen>.js`，以明確建置順序接入；教程保留在 `tutorial-ui.html/css`，不要把無關畫面塞進去。

**Steps**

1. 確定畫面作用範圍：大廳、單機暫停、戰鬥 HUD，或未來 Inventory／Dialogue。決定是否阻止 gameplay input 和是否真的暫停模擬；線上不能單端暫停。
2. 增加語意化 section／dialog、標籤及 buttons；顯示文案與遊戲狀態讀取由 adapter 處理，click 只發請求，不直接扣血／發物品。
3. 開啟時 `clearInputs()`，記錄返回焦點；關閉也清除 held input，恢復正確模式。modal 處理 Tab／Escape／焦點，不留下隱藏但可操作的按鈕。
4. 防選取與 `touch-action:none` 只覆蓋戰鬥操作區；新表單／對話文字應可正常點選或捲動。可信 `touchend` 仍需到達音訊解鎖監聽器。
5. render 只在必要時更新文字／DOM；不要每 tick 全量重建面板及 event listener。需多語時再引入字串表，不把 ID 換成翻譯文本。

**Example**

```html
<!-- PLANNED 畫面片段；仍需由 adapter 接上開關與命令。 -->
<section id="loadout-help" hidden aria-labelledby="loadout-help-title">
  <h2 id="loadout-help-title">裝備說明</h2>
  <p id="loadout-help-description"></p>
  <button type="button" id="loadout-help-close">返回</button>
</section>
```

**Tests**：keyboard-only 導航、Escape、焦點返回；touch 目標尺寸與 safe area；長按不選取戰鬥區但表單可編輯；雙指鬆開不留移動；橫豎旋轉；面板開關不多次綁 listener；開聲／暫停／返回 lobby 都正常。

**Common mistakes**：全域禁止頁面觸控造成文字不能捲動；用 CSS 隱藏卻不鎖 gameplay input；按暫停實際仍推進戰鬥；UI 直接修改 actor 狀態繞 FSM；把本機 menu overlay 當線上同步暫停。

## Quest / Achievement Extension Points · PLANNED

目前沒有這兩個runner或registry。第一個需求應隨Progression／版本化Save做一條完整垂直切片；它們不能偷用目前教程localStorage陣列保存異型資料。

| 接點 | Files／欄位／註冊 | 互動與素材 | Tests／常見錯誤 |
| --- | --- | --- | --- |
| Quest | 未來`src/content/quests/<slug>.js`、同目錄`registry.js`；`id,titleKey,requirements,objectives,rewardId`。例`quest_lost_core`的objective引用已註冊item／event ID | 小型quest evaluator讀已確認Inventory／Story事件，回報完成；icon／text引用ASSET／localization ID，無需新圖片也可先用文字 | 重複event只完成／領獎一次、前置未達、save/load、未知reference；不要在每個Boss的hit分支檢查quest |
| Achievement | 未來`src/content/achievements/<slug>.js`、`registry.js`；`id,titleKey,condition,scope,iconId`。例`achievement_first_duel`僅採localAI正式勝利 | Progression讀一次最終Encounter結果，存stable ID；通知交UI adapter，不能反向改HP或重發reward | tutorial/PvP不得誤領PvE成就、兩次事件去重、存檔重載保留、名稱變更ID不變；不要把可修改localStorage當可信線上排名 |

首個實作者需建立registry驗證、明確訂閱／解除生命週期、Save schema/migration及UI結果，再於build登錄module。一般新增第N個quest／achievement不應修改CombatCore；需要全新條件kind時，在該evaluator增加有界白名單handler與測試，不`eval`內容字串。參照 [STORY_SYSTEM](STORY_SYSTEM.md)、[SAVE_SYSTEM](SAVE_SYSTEM.md) 和 [GAME_SYSTEMS](GAME_SYSTEMS.md) 的事件／ownership契約。
