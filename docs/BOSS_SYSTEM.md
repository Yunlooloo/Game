# Boss 架構與第二隻 Boss 的接手指南

狀態：**IMPLEMENTED** 描述目前 `4.0.2`；**PLANNED** 提供下一次新增 Boss 時的最小改造；**OPTIONAL** 是尚未承諾的內容。現在沒有 `Boss` class、Boss registry、Boss selector、掉落或獨立 Boss 關卡。

先讀 [GAME_SYSTEMS.md](GAME_SYSTEMS.md) 的世界與角色生命週期，再讀 [COMBAT_SYSTEM.md](COMBAT_SYSTEM.md) 的防守裁決與雙核。所有招式的底層與玩家共用，見 [ABILITY_SYSTEM.md](ABILITY_SYSTEM.md)。

## IMPLEMENTED：目前只有「赤衡」一位 AI 對手

| 責任 | 真實來源 |
| --- | --- |
| 角色建立／初始值 | [src/core.js](../src/core.js) 的 closure-local `fighter()`、`makeWorld()` |
| AI 對局模式／顯示名稱 | `Game.start('ai')`，`players[1].aiControlled = true` |
| 決策與導航 | [src/ai.js](../src/ai.js) 的 `RiftAI.reset / input / _observe / _route / _navigate` |
| 每 tick 執行動作 | `Game.frame()` 取得 `ai.input(world, players[1], players[0])` 的 bitmask，交給同一個 `tickPlayer()` |
| Phase 與核心數 | [src/vitals.js](../src/vitals.js) 的 `takeNode()`，不是 AI 私有 HP 寫入 |
| 美術與姿勢 | [src/render.js](../src/render.js) 的角色繪製；目前角色外觀依玩家 ID，不依 Boss ID |
| BGM | [src/audio.js](../src/audio.js) 的共用 `battle` scene，沒有每 Boss 音軌 |

目前預設 actor：HP100、架勢0、共鳴20、雙核2、Phase1、修復劑3、起點 `(2150,810)`、面向左；裝備 `['aegis','hammer']`、奧義 `rift`。玩家與 AI 都走 `fighter()` 的相同基礎移動（5.4 px/tick）、碰撞與防禦規則。完整數值不另複製，對照 `fighter / MOVES / physics`。

### 感知、策略與行動之間的界線

`_observe(self, enemy)` 只快照可見角色的公開動畫狀態，不讀 `keydown` 或玩家的 bitmask。視距為800px歐氏距離；快照排隊12tick（約200ms）後供 `input()` 使用。離開視距後，最後視覺記憶最多保留180tick；短期位置估計使用已觀察速度並夾限。看不到對手時巡邏，沒有立即追蹤對手真實位置。

AI 並非完全不使用隨機數：固定 seed 的 xorshift 產生可重現的選擇，在觀察與時機規則下決定是否反制／使用工具／何時進攻。防禦反應排程包含幾 tick 誤差、視覺 awareness 與距離限制。自己受到招架、自己成功招架、自己帶電等自身回饋可以立即得知；行動仍要等 FSM 可動。

`input()` 的優先順序大致是：

1. 各種鎖定／倒地／死亡不輸出動作。
2. 延遲觀察到對方倒地時，取消撤退與飲藥計畫，接近斷決。
3. 自身接雷優先空中返雷。
4. 被招架則後跳撤退；成功招架則取得一次近距離反擊機會。
5. 觀察到300px內對手飲藥，發動明確 `THRUST | DASH` 疾刺輸入；不是引擎偷看當幀敵人狀態自動升級攻擊。
6. 根據出招動畫排程招架、踏刃、跳躍或影匣；根據自身狀態考慮治療。
7. 導航至不同平台、掛索途中攻擊、空中蹬踏，或恢復架勢與取位。
8. 依距離、架勢、裝備與內部冷卻選工具／奧義／普通或危險攻擊。

連續抖防禦 `guardSpam >= 2` 會讓 AI 長按攻擊45–65tick，改變攻擊節奏；不是直接縮短對手窗口。普通決策與反制也有機率失誤。這個 AI 不等同任意關卡的完整導航器或通用行為樹。

### 高低差導航與卡住回復

`_route()` 從 `world.platforms / anchors` 建立小型平台圖，邊是 `drop / jump / grapple`；Dijkstra 找到第一個合法轉移，包括經中層平台上行的路線。掛索 anchor 的評分與 `Game.grapple()` 相同，還檢查起跳點前後20px是否仍選到同一錨點，避免 AI 想抓 A、引擎實際抓 B。

`_navigate()` 遇垂直差超過105px才導入路線；下行輸出 `DOWN | JUMP`，上行用普通掛索或跳躍。掛索前先調整面向一tick，因引擎在 `tickPlayer()` 後段才更新面向。連續75tick幾乎不動、60tick淨進展不足16px、路線逾240tick、目標平台改變時會重算；飛行逾160tick也棄掉路線。這些防卡住機制不能在添加地圖後免測。

### 治療與 Phase 2

- HP `<=55`、還有修復劑、可動且冷卻已到才計畫治療；先撤退最多180tick，落地且水平距離 `>380`（或無已知目標）才輸出 `HEAL`。
- 貼近邊界時承諾穿越對手的撤退方向，避免每幀反算「遠離」而左右抖動。失敗計畫延後120tick再考慮；成功開始飲藥後 nextHeal 延後240tick。
- 治療仍用 `RiftVitals.beginDrink / tickDrink` 的54tick、+40HP、消耗一劑與受擊中斷；AI 不直接加血。三劑用完即不能再喝，第一核復燃不重置劑數。
- 第一核被斷決後 `takeNode()` 切成Phase2，整個 AI 沿用相同 actor。`postureRate()` 讓 AI 架勢恢復 ×1.2；決策可選 `lightning` 與 `triple`，`Game.begin()` 也禁止Phase1主動用這兩招。
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
  stats: { hp: 100, posture: 0, spirit: 20, nodes: 2, tonics: 3 },
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
    { id: 'phase_1', enterAtNodes: 2, attacks: ['light', 'thrust', 'charged'] },
    { id: 'phase_2', enterAtNodes: 1, attacks: ['light', 'thrust', 'triple'] }
  ],
  presentation: {
    animationProfileId: 'duelist_v1',
    paletteId: 'tidekeeper', soundProfileId: 'steel_v1', musicId: 'battle'
  },
  arenaId: 'stage_foundry',
  rewards: [],
  drops: [],
  specialRules: { defeat: 'two_nodes', revive: 'full_hp' }
};
```

`hp:100` 刻意不寫為1000：目前 HP 範圍同時刻在 Vitals、FSM恢復門檻、HUD與網路驗證器。要變可調maxHP是另一個有遷移與測試的任務。速度／collision profile 也只是接口提案，現版 `physics()` 還沒有從 profile 讀值。示例中的 arena／palette等 ID 是未來註冊值，不是已存在的 registry。`rewards/drops` 保持空陣列，直到有真正的進度與道具服務；不能讓 Boss 自己寫存檔。

### 按順序修改的接點

1. **讀基準**：閱讀 `fighter / makeWorld / Game.start / Game.frame`、完整 `RiftAI`、`RiftVitals.takeNode`，先跑 [TESTING.md](TESTING.md) 中既有戰鬥與 AI 測試。
2. **提取赤衡定義**：建立上述 `chiheng.js / registry.js / factory.js`，註冊 `boss_chiheng`；工廠只複製 allowlist 欄位、驗證招式與裝備 ID、建立新的 AI controller。禁止把共享定義物件直接當 runtime actor，否則重試會污染預設。
3. **唯一選擇接點**：`Game.start('ai', config)` 讀 `config.bossId || 'boss_chiheng'`。`makeWorld()` 仍建立兩人，工廠只設定 `players[1]` 的內容，保留 `id=1` 與現有權限。`this.ai` 換成該 controller，`frame()` 仍呼叫 `input(world,self,enemy)`。未知 ID 給安全錯誤或明確回退，不拼路徑載入任意 JS。
4. **移除覆寫**：現在 `Game.start()` 無條件把 AI 名稱設為赤衡；必須改成讀所選定義。`reset()` 應重設每場 AI 私有狀態，不能跨場殘留冷卻／視覺記憶。
5. **讓選擇真正有作用**：profile 的 attackPattern/cooldown 若未接入 `RiftAI.input()` 就不能宣稱已有新招式性格。沿用 FSM／防禦／耗能，AI 只能提出相同輸入意圖，不能直接 `enemy.hp -= ...`。
6. **外觀與音樂接點**：在 `render.js` 用小型 presentation lookup 取 palette/profile，別擴張 `if(id)` 成每隻 Boss 的條件樹。既有共用 battle BGM 可先保留；需要新素材時按 [ASSET_PIPELINE.md](ASSET_PIPELINE.md) 管理並添加音樂對映。
7. **build 與選單**：把新增腳本加入 `scripts/build.py` 的明確模組順序，registry/factory 放在 `core.js` 前且在所需 AI 後；大廳選單把 ID 傳到 `start`。線上／同屏／教學不套 Boss profile。
8. **新對手與 Phase**：再加入 `tidekeeper.js` 一筆定義。若只是第二核後改攻擊集合，沿用現有 `takeNode`；若新增血量觸發階段，另寫單次 phase transition controller，不把血量門檻撒在 `Game.hit()`。
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
| 雙核 | 第一斷決滿血二階段，第二次才勝利，漏斷決後15HP起身且不逃跑 |
| 全模式回歸 | 舊Boss、教學22課、本機雙人、線上既有權限與觸控／音效無回歸 |

具體執行命令由 [TESTING.md](TESTING.md) 管理，不在此維護第二份測試清單命令。新 Boss 測試只需擴充有用的行為案例，不為每個靜態欄位重複寫一次實作鏡像測試。

## 已知限制與下一個抽象邊界

- AI 的奧義「考慮施放」門檻仍是 `cleave:4 / rift:7`，真正消耗由 `MOVES` 強制為5／9；不會負共鳴，但可能浪費決策。建立 profile 時應讀同一 Ability 定義，先以測試刻畫。
- `RiftAI.input()` 在 hitstop 前仍被呼叫，觀察／內部冷卻時鐘和 `world.tick` 暫停不完全一致。修正需獨立回歸節奏，不能順手藏在文件抽取中。
- 兩名角色用 `1-id` 索引；第二隻**可選** Boss 不需多敵人引擎，同場兩隻則必須按 [ENEMY_SYSTEM.md](ENEMY_SYSTEM.md) 遷移目標模型。
- **OPTIONAL**：掉落、通關獎勵、Boss房封門、專屬劇情、更多階段、討伐成就。只在相應服務完成後以事件連接；Boss controller 不直接操作 DOM／音樂節點／存檔。
