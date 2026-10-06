# Boss 架構與第二隻 Boss 的接手指南

狀態：**IMPLEMENTED** 描述目前 `4.1.0`；**PLANNED** 提供下一次新增 Boss 時的最小改造；**OPTIONAL** 是尚未承諾的內容。現在沒有 `Boss` class、Boss registry、Boss selector、掉落或獨立 Boss 關卡。

先讀 [GAME_SYSTEMS.md](GAME_SYSTEMS.md) 的世界與角色生命週期，再讀 [COMBAT_SYSTEM.md](COMBAT_SYSTEM.md) 的防守裁決與核心容量。所有招式的底層與玩家共用，見 [ABILITY_SYSTEM.md](ABILITY_SYSTEM.md)。

## IMPLEMENTED：目前只有「赤衡」一位 AI 對手

| 責任 | 真實來源 |
| --- | --- |
| 角色建立／初始值 | [src/core.js](../src/core.js) 的 closure-local `fighter()`、`makeWorld()`、`BOSS_PROFILE`（公開於 `RIFT`） |
| AI 對局模式／顯示名稱 | `Game.start('ai')`，`players[1].aiControlled = true` |
| 決策與導航 | [src/ai.js](../src/ai.js) 的 `RiftAI.reset / input / _patterns / _observe / _route / _navigate` |
| 每 tick 執行動作 | `Game.frame()` 取得 `ai.input(world, players[1], players[0])` 的 bitmask，交給同一個 `tickPlayer()` |
| Phase 與核心數 | [src/vitals.js](../src/vitals.js) 的 `takeNode()`，不是 AI 私有 HP 寫入 |
| 美術與姿勢 | [src/render.js](../src/render.js) 的角色繪製；目前角色外觀依玩家 ID，不依 Boss ID |
| BGM | [src/audio.js](../src/audio.js) 的共用 `battle` scene，沒有每 Boss 音軌 |

只有 `Game.start('ai')` 的actor1套用 **240 HP／220架勢上限／3核**；玩家、PvP與陪練仍為100／100／2。赤衡初始架勢0、共鳴20、Phase1、修復劑3、起點 `(2150,810)`、面向左；裝備 `['aegis','hammer']`、奧義 `rift`。玩家與AI共用 `fighter()`、基礎移動5.4 px/tick、FSM與命中裁決。

`BOSS_PROFILE` 是core中的已實作容量／攻擊覆寫常數，不是registry或controller factory。`Game.attackDefinition()` 為起手及輕斬轉蓄斬建立共用move複本，僅為AI角色套用以下起手、波次覆寫與 `armor=true`，不污染玩家的 `MOVES`。起手霸體仍受HP／架勢傷害，架勢崩解、踏刃與蹬踏可中斷；飲藥沒有霸體。

| 招式 | Boss起手tick |
| --- | --- |
| `light / combo / chase / air` | 26／22／24／24 |
| `thrust / sweep / lightning / punish` | 38／40／48／30 |
| `charged / triple` | 44／32 |
| 其餘招式 | 沿用 `MOVES`；裂斬52 |

Boss另覆寫蓄斬為波次0／18、active24；雙斷為0／20、active26，使每波都有可重起的招架間隔。玩家的蓄斬0／8與雙斷0／12不變。這些起手與波次不隨Phase加速。理由與相容性見 [ADR-004](adr/004-readable-rhythm-and-boss-capacity.md)。

### 感知、策略與行動之間的界線

`_observe(self, enemy)` 只快照可見角色的公開動畫狀態，不讀 `keydown` 或玩家的 bitmask。視距為800px歐氏距離；快照排隊12tick（約200ms）後供 `input()` 使用。離開視距後，最後視覺記憶最多保留180tick；短期位置估計使用已觀察速度並夾限。看不到對手時巡邏，沒有立即追蹤對手真實位置。

AI 並非完全不使用隨機數：固定 seed 的 xorshift 產生可重現的選擇，在觀察與時機規則下決定是否反制／使用工具／何時進攻。防禦反應排程包含幾 tick 誤差、視覺 awareness 與距離限制。自己受到招架、自己成功招架、自己帶電等自身回饋可以立即得知；行動仍要等 FSM 可動。

`input()` 的優先順序大致是：

1. 各種鎖定／倒地／死亡不輸出動作。
2. 延遲觀察到對方倒地時，取消撤退與飲藥計畫，接近斷決。
3. 自身接雷優先空中返雷。
4. 被招架且攻擊已中斷，解鎖後留18 tick原地反擊空檔；自身成功招架則取得一次近距離反擊機會。Boss多波中間招架保留ACTIVE，不會提前觸發這個空檔。
5. 觀察到300px內對手飲藥，發動明確 `THRUST | DASH` 疾刺輸入；不是引擎偷看當幀敵人狀態自動升級攻擊。
6. 根據出招動畫排程招架、踏刃、跳躍或影匣；根據自身狀態考慮治療。
7. 導航至不同平台、掛索途中攻擊、空中蹬踏，或恢復架勢與取位。
8. 依距離、架勢、裝備與內部冷卻選工具，或循序執行當前Phase的固定招式組合。

沒有正在執行的招式組合且延遲觀察到 `guardSpam >= 2` 時，AI用固定蓄斬回應；成功招架會清除該債務。AI的普通組合蓄斬與此回應皆長按30 tick，在第26 tick轉為蓄斬、44 tick起手完成前放開，保留出刀前8 tick的提示。長按未放開時renderer不顯示假的即將出刀閃光。反制與工具選擇仍可有機率失誤，這不是任意關卡的完整導航器或通用行為樹。

### 三階段招式組合與可反擊空檔

`_patterns(phase)` 依序輪替下表，每列中的括號代表一組，箭頭代表同組接招。資源不足或奧義冷卻未到時退回普通輕斬；工具、治療、防守與導航仍會影響實際出招，不保證無條件逐項演出。

| Phase | 基本循環 |
| --- | --- |
| 1 | （輕→輕→突）、（輕→掃）、（蓄斬） |
| 2 | （輕→輕→突）、（連斬）、（輕→掃）、（雷斬）、（蓄斬） |
| 3 | （連斬）、（輕→突→掃）、（奧義裂斬）、（雷→輕）、（蓄→掃） |

AI觀察自身真實FSM的收招完成：同組下一招等8 tick，整組完成後提供30 tick原地空檔，期間不移動、防守或攻擊；延遲視覺已確認對手倒地時，優先接近斷決。被末波招架後的反擊空檔從解鎖後開始，不被反彈硬直或hitstop吃掉。`frame()` 在hitstop沿用AI前次bits、不呼叫 `input()`，AI觀察與排程一同凍結。

Boss多波招式的非末波完美招架只增加架勢並保留攻擊，末波才反彈；崩解或特殊反制仍能中斷。裂斬52／30／38 tick、波次0／24；連斬32／42／32 tick、波次0／18／36。每波只開6 tick接觸，空檔可重新按下招架。renderer每波重新收刀／放刀；裂斬有紫色刀身、兩段提示與「可招架」標籤，普通格擋不扣HP。

### 高低差導航與卡住回復

`_route()` 從 `world.platforms / anchors` 建立小型平台圖，邊是 `drop / jump / grapple`；Dijkstra 找到第一個合法轉移，包括經中層平台上行的路線。掛索 anchor 的評分與 `Game.grapple()` 相同，還檢查起跳點前後20px是否仍選到同一錨點，避免 AI 想抓 A、引擎實際抓 B。

`_navigate()` 遇垂直差超過105px才導入路線；下行輸出 `DOWN | JUMP`，上行用普通掛索或跳躍。掛索前先調整面向一tick，因引擎在 `tickPlayer()` 後段才更新面向。連續75tick幾乎不動、60tick淨進展不足16px、路線逾240tick、目標平台改變時會重算；飛行逾160tick也棄掉路線。這些防卡住機制不能在添加地圖後免測。

### 治療、容量與復燃

- HP占上限 `<=55%`、還有修復劑、可動且冷卻已到才計畫治療；先撤退最多180tick，落地且水平距離 `>380`（或無已知目標）才輸出 `HEAL`。
- 貼近邊界時承諾穿越對手的撤退方向，避免每幀反算「遠離」而左右抖動。失敗計畫延後120tick再考慮；成功開始飲藥後 nextHeal 延後240tick。
- 治療仍用 `RiftVitals.beginDrink / tickDrink` 的54tick、恢復40%上限HP（赤衡96）、消耗一劑與受擊中斷；AI 不直接加血。三劑用完即不能再喝，任何復燃不重置劑數。
- 前兩次斷決後 `takeNode()` 分別切成Phase2、Phase3並回滿240HP，第三次才死亡；整場沿用同一actor。`postureRate()` 在Phase>=2維持架勢恢復 ×1.2；HP門檻按比例、速率仍為架勢點／秒。`Game.begin()` 禁止Phase1主動用 `lightning / triple`。漏斷決4秒後以36HP／77架勢起身，不自動扣核。
- AI 的工具／奧義冷卻是 `nextAttack / nextTool / nextArt / nextHeal / ...` 排程。玩家招式沒有通用 cooldown 資料表。

## PLANNED：第一個新增 Boss 任務應做什麼

目標是**一場仍為玩家對一位 Boss**，新增可選對手且預設赤衡完全等價。不要同時改多人戰鬥、存檔、裝備與場景引擎。以下檔案尚不存在，第一位實作者必須連同最小註冊接口建立；建立後再把此節更新為 IMPLEMENTED。

```text
src/content/bosses/
├── chiheng.js         # 先提取現有赤衡設定，作回歸基準
├── tidekeeper.js      # 示例新 Boss 的定義
├── registry.js        # ID → definition 明確註冊，不做檔案掃描魔法
└── factory.js         # 驗證定義，回傳 actor overrides 與獨立 controller
```

如果新 Boss 的策略無法只用權重／攻擊集合表示，才加 `tidekeeper-ai.js`。優先讓 `RiftAI` 接受小型 profile、保留目前預設，不複製整個類別。定義檔可以延續原生 IIFE/global API 模式，由 build 明確按順序內嵌；沒有導入 bundler 的必要。

### 定義範例（PLANNED，設計示例，不可直接在現版 console 執行）

```js
const tidekeeper = {
  id: 'boss_tidekeeper',
  name: '潮守',
  kind: 'boss',
  stats: { maxHp: 240, maxPosture: 220, maxNodes: 3, spirit: 20, tonics: 3 },
  movement: { speed: 5.4 },
  collision: { profileId: 'duelist_v1' },
  ai: {
    controllerId: 'duelist', reactionTicks: 12, sight: 800,
    attackPattern: ['light', 'thrust', 'charged'],
    cooldownTicks: { tool: 105, art: 280 }
  },
  loadout: ['disc', 'aegis'],
  art: 'cleave',
  phases: [
    { id: 'phase_1', enterAtNodes: 3, attacks: ['light', 'thrust', 'charged'] },
    { id: 'phase_2', enterAtNodes: 2, attacks: ['light', 'thrust', 'triple'] },
    { id: 'phase_3', enterAtNodes: 1, attacks: ['triple', 'cleave'] }
  ],
  presentation: {
    animationProfileId: 'duelist_v1',
    paletteId: 'tidekeeper', soundProfileId: 'steel_v1', musicId: 'battle'
  },
  arenaId: 'stage_foundry',
  rewards: [],
  drops: [],
  specialRules: { defeat: 'all_nodes', revive: 'full_hp' }
};
```

本機AI已可使用 `maxHp / maxPosture / maxNodes`，新factory應沿用Vitals helper並依容量初始化當前值。線上authority仍維持100／100／2的PvP範圍，不能直接將Boss資料傳到現有房間。速度／collision profile仍只是接口提案，現版 `physics()` 沒有從profile讀值。示例中的 arena／palette等 ID 是未來註冊值，不是已存在的 registry。`rewards/drops` 保持空陣列，直到有真正的進度與道具服務；不能讓 Boss 自己寫存檔。

### 按順序修改的接點

1. **讀基準**：閱讀 `fighter / makeWorld / Game.start / Game.frame`、完整 `RiftAI`、`RiftVitals.takeNode`，先跑 [TESTING.md](TESTING.md) 中既有戰鬥與 AI 測試。
2. **提取赤衡定義**：把現有 `BOSS_PROFILE` 與 `_patterns()` 提取至上述 `chiheng.js / registry.js / factory.js`，註冊 `boss_chiheng`；工廠只複製 allowlist 欄位、驗證招式與裝備 ID、建立新的 AI controller。禁止把共享定義物件直接當 runtime actor，否則重試會污染預設。
3. **唯一選擇接點**：`Game.start('ai', config)` 讀 `config.bossId || 'boss_chiheng'`。`makeWorld()` 仍建立兩人，工廠只設定 `players[1]` 的內容，保留 `id=1` 與現有權限。`this.ai` 換成該 controller，`frame()` 仍呼叫 `input(world,self,enemy)`。未知 ID 給安全錯誤或明確回退，不拼路徑載入任意 JS。
4. **移除覆寫**：現在 `Game.start()` 無條件把 AI 名稱設為赤衡；必須改成讀所選定義。`reset()` 應重設每場 AI 私有狀態，不能跨場殘留冷卻／視覺記憶。
5. **讓選擇真正有作用**：profile 的 attackPattern/cooldown 若未接入 `RiftAI.input()` 就不能宣稱已有新招式性格。沿用 FSM／防禦／耗能，AI 只能提出相同輸入意圖，不能直接 `enemy.hp -= ...`。
6. **外觀與音樂接點**：在 `render.js` 用小型 presentation lookup 取 palette/profile，別擴張 `if(id)` 成每隻 Boss 的條件樹。既有共用 battle BGM 可先保留；需要新素材時按 [ASSET_PIPELINE.md](ASSET_PIPELINE.md) 管理並添加音樂對映。
7. **build 與選單**：把新增腳本加入 `scripts/build.py` 的明確模組順序，registry/factory 放在 `core.js` 前且在所需 AI 後；大廳選單把 ID 傳到 `start`。線上／同屏／教學不套 Boss profile。
8. **新對手與 Phase**：再加入 `tidekeeper.js` 一筆定義。若只是每次非最終斷決後改攻擊集合，沿用現有容量版 `takeNode`；若新增血量觸發階段，另寫單次 phase transition controller，不把血量門檻撒在 `Game.hit()`。
9. **測試入口**：同任務新增本機開發 selector，例如 `?debug=1&boss=boss_tidekeeper` 或 debug面板。**目前這個 query 不存在**。未啟用debug維持預設；selector只能選白名單，不能干涉 PvP。新增測試以同一入口啟動每位 Boss。
10. **更新交接**：把新 ID、來源、測試命令與新增 seam 寫回本文件、[PROJECT_MAP.md](PROJECT_MAP.md) 與 CHANGELOG，確認 build 產物及部署。

### 必備測試與驗收

| 測試 | 期待 |
| --- | --- |
| 定義驗證 | ID唯一、數值有界、招式／裝備引用存在、phase入口互斥；未知ID失敗方式固定 |
| 赤衡基準 | 同樣 seed／初始世界／輸入下，重構前後決策與角色結果等價 |
| 新Boss啟動 | selector對應正確名稱／配置／controller，重試建立乾淨狀態，回大廳不污染玩家選裝 |
| 反應與公平 | 12tick視覺延遲、800px外不讀即時位置、招架／踏刃不讀 raw keys |
| 導航 | 玩家在上層、下層、同x異y與地圖角落都能重新接近；不連續振盪 |
| 治療 | 至少一劑才喝，安全距離計畫、54tick可懲罰、中斷不回血、復燃不補劑 |
| 核心容量 | 赤衡前兩次滿血復燃／第三次勝利，漏斷決36HP／77架勢起身；玩家／陪練維持雙核 |
| 節奏／公平 | 各Phase起手不加速、完整收招、組末30tick空檔、末波招架後18tick空檔；hitstop不消耗AI時鐘 |
| 全模式回歸 | 舊Boss、教學22課、本機雙人、線上既有權限與觸控／音效無回歸 |

具體執行命令由 [TESTING.md](TESTING.md) 管理，不在此維護第二份測試清單命令。新 Boss 測試只需擴充有用的行為案例，不為每個靜態欄位重複寫一次實作鏡像測試。

## 已知限制與下一個抽象邊界

- AI費用讀取 `RIFT.MOVES`，缺少完整遊戲環境時才使用相同值的fallback；cost仍由 `begin()` 最終驗證。新增工具或奧義須同步fallback與測試。
- 容量／攻擊覆寫配置仍在core，招式組合仍在單一 `RiftAI`；下一位Boss應提取這些已使用的接點，尚未存在可直接登錄的Boss API。
- 兩名角色用 `1-id` 索引；第二隻**可選** Boss 不需多敵人引擎，同場兩隻則必須按 [ENEMY_SYSTEM.md](ENEMY_SYSTEM.md) 遷移目標模型。
- **OPTIONAL**：掉落、通關獎勵、Boss房封門、專屬劇情、更多階段、討伐成就。只在相應服務完成後以事件連接；Boss controller 不直接操作 DOM／音樂節點／存檔。
