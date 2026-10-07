# Game Core、Player 與執行狀態

狀態：**IMPLEMENTED** 描述 runtime `4.2.0` 的實際行為；**PLANNED** 為後續演進接口；**OPTIONAL** 只有具體玩法需要時才加入。本文件是 loop、world、角色生命週期、暫停與事件邊界的真實來源。戰鬥公式由 [COMBAT_SYSTEM](COMBAT_SYSTEM.md) 維護；輸入裝置、UI、效能與無障礙見 [PLATFORM](PLATFORM.md)。

## IMPLEMENTED：啟動與每局流程

載入順序由 [scripts/build.py](../scripts/build.py) 決定。[src/core.js](../src/core.js) 尾端先執行 `window.game = new Game()`，公開 `window.RIFT`，再建立 `RiftTutorial(game)`。沒有 framework lifecycle、ES module loader 或 SceneManager。`Game` constructor 建立 world、renderer、audio、AI、輸入集合與 DOM 事件，呼叫一次 HUD 更新並排入 `requestAnimationFrame`；音訊仍須可信使用者手勢解鎖。

| 階段 | 入口與副作用 |
| --- | --- |
| 大廳 | `makeWorld()` 初始 `phase='menu'`；Canvas 持續繪製背景／角色立繪，選裝與天候保存於目前的 `Game` instance |
| 開始 | `Game.start(mode, config)` 重新建立兩人 world，設 `phase='fighting'`；重置輸入、AI、當場統計，沿用相機與目前分數 |
| 戰鬥 | `frame → step → tickPlayer / tickRemote → collisions → weatherTick`，詳見下節 |
| 非最後一核被斷決 | `RiftVitals.takeNode()` 復燃、切下一Phase；仍是同一 world、同一回合，詳見 [COMBAT_SYSTEM](COMBAT_SYSTEM.md) |
| 最終斷決 | `finisherScene()` 設 `phase='ended'`、winner、比分；清除輸入，1.6 秒 wall-clock timer 後 `showResult()` |
| 重試 | 本機呼叫 `start(this.mode)` 建立新 world；線上由房主 `startOnline()` 送開局配置後雙方重建 |
| 回大廳 | `lobby()` 停教學、斷線、改 `phase='menu'`、隱藏戰鬥 UI；不做永久存檔 |

`showResult()` 再檢查 `phase==='ended'`，避免離開結果流程後舊 timer 顯示面板。比分 `scores` 留在同一頁面的 `Game`，重新整理就清除；沒有跨局帳號積分。`snapshot()` 是診斷 JSON 複本，不是完整可還原的戰鬥快照，也不是存檔 API。

### 模式與控制來源

| `mode` | actor 0 | actor 1 | 權限 |
| --- | --- | --- | --- |
| `ai` | 玩家 input 0 | `RiftAI.input(world,self,enemy)` | 同一引擎擁有雙方 |
| `local` | 玩家 input 0 | 第二組鍵盤 input 1 | 同一引擎擁有雙方 |
| `tutorial` | 玩家 input 0 | `RiftTutorial.beforeStep()` 改寫的陪練輸入 | 本機；限定課程可補給／重置 |
| `online` | 房主 actor | 訪客 actor | 每端只對 `localId` 裁決，另一位由意圖與 pose 驅動副本 |

訪客也用本機 input 0 操作自己的 actor 1；不要把「鍵位組 0」誤當「永遠控制 actor 0」。`owns(p)` 在線上依 `p.id === localId` 決定權限。transport 與驗證分別在 [src/net.js](../src/net.js)、[src/authority.js](../src/authority.js)，協定細節見 [COMBAT_SYSTEM](COMBAT_SYSTEM.md)。

## IMPLEMENTED：固定時間步長與暫停

`TICK_RATE=60`、`FIXED_DT=1/60`、`MAX_STEPS=6`。`frame(t)` 讀取 rAF timestamp，累加最多 0.1 秒，逐次消耗固定步長；一次 render 最多補六步，避免背景停頓後把整場快速演算完。過長停頓被捨棄，計入 `droppedFrames` 的估計，不表示能保持真實世界經過時間。

一個正常 simulation step 的順序：

1. `tutorial.beforeStep(inputs)`：只在教學模式修改練習輸入／補給，hitstop 時不增加課程時鐘。
2. 檢查 `world.phase`；非 fighting 只更新特效。
3. 收集非方向鍵上升緣：`buffered[i] |= inputs[i] & ~rawPrev[i] & ~7`。方向／蹲下的 bit 1、2、4 不緩衝。
4. 若 `hitstop > 0`，只減 hitstop、更新 `effects()` 後返回。角色、碰撞、天候、`world.tick/time` 都不推進。
5. 把累積上升緣合回本次輸入，遞增 `world.tick`，令 `world.time = tick / 60`。
6. 更新特效；本端角色走 `tickPlayer()`，遠端副本走 `tickRemote()`；再處理接觸、天候與教學 `afterStep()`。
7. 偵測本機低 HP 警報。線上由 `frame()` 在 step 後要求 authority 發送節流 pose。

`frame()` 最後每個 render 呼叫 renderer、音訊狀態同步和 `audio.update()`，HUD 最多約每 65ms 更新一次。renderer 以自己的 `performance.now()` 進行相機平滑與環境動畫；戰鬥不能改用此時間判斷起手、無敵或 DOT。`alpha` 傳給 renderer 不代表存在完整的 previous/current world 插值。

**AI時間契約**：`frame()` 在非凍結的固定步進才呼叫 `RiftAI.input()`；hitstop期間沿用Boss的前次bits，AI觀察歷史與內部排程一同暫停。12 tick視覺延遲及招式結束後的空檔不會被hitstop消耗。固定步長也不等於整局 deterministic replay：天雷與 VFX 使用 `Math.random()`，並沒有 rollback 世界重播。

| 事件 | 實際暫停語意 |
| --- | --- |
| 本機 Escape／HUD選單 | `togglePause()` 設 `game.paused`、清輸入、顯示面板；frame 清 accumulator，不執行 step |
| 本機開啟操作卷軸 | `toggleGuide()` 使戰鬥暫停；關閉會恢復 |
| 本機 window blur | 清輸入並開啟暫停；回到畫面需繼續 |
| visibility change | 清輸入、清 accumulator、同步音訊；這個 handler 本身不設定 gameplay paused |
| 線上 Escape／HUD選單 | Escape顯示不可暫停提示；HUD選單開啟操作卷軸並清除本端輸入，兩者都不停止對局 |
| 線上斷線 | `onDisconnect` 暫停並停用繼續按鈕，回大廳處理 |
| hitstop | 保留輸入上升緣、特效倒數與網路 callback；與完整暫停不同 |

暫停時 rAF 和 renderer 仍持續執行，相機／背景程序動畫可變化，音訊 scene 仍被同步；角色和 `effects()` 的固定 tick 倒數則停止。瀏覽器背景頁的 rAF／timer 節流也不受遊戲保證，線上沒有背景追趕或暫停協商協定。

`game.debug.step()` 直接呼叫 `step()`，**不檢查 `game.paused`**。這方便暫停後精確推進測試，但不能讓正式 UI 以此繞過暫停或權限。

## IMPLEMENTED：World 與資料所有權

`makeWorld()` 建立單一戰場：兩位角色、平台、錨點、可破壞晶簇與門、投射物、天雷與特效陣列。座標以角色腳底為基準，x 向右、y 向下。平台／掛索與地圖演進詳見 [LEVEL_SYSTEM](LEVEL_SYSTEM.md)，不是另一套 scene graph。

| 資料層 | 目前資料 | 保存期限 |
| --- | --- | --- |
| `Game` session | `mode / paused / localId / scores / loadout / art / weather`、輸入集合、audio／renderer／net／AI instance | 本頁生命週期；start 重設其中部分，不代表永久設定 |
| `world` runtime | `phase / tick / time / players / platforms / projectiles / effects / winner / round` | 每次 `start()` 新建 |
| actor runtime | 座標、HP、架勢、狀態計時、當次招式、冷卻旗標 | 單場角色實例；不能寫回共享招式定義 |
| definition | `MOVES / BOSS_PROFILE`、輸入 bits、工具名稱、FSM枚舉、LESSONS | script 載入；目前多為模組內常數與普通物件 |
| persistent | 已完成 lesson IDs | 只有 `riftblade-tutorial-v1` localStorage；見 [SAVE_SYSTEM](SAVE_SYSTEM.md) |

`window.game` 與 `window.RIFT` 是既有全域入口，不是 reactive global store。DOM 不會自動隨資料變化；需要 `renderHUD()` 或教學 `render()`。renderer 雖主要讀 world，仍會寫入 `world.camera`，不能宣稱完全純函式或把它放到另一 thread 而忽略資料同步。

### System Ownership

下表的owner是主要程式責任，不是某位AI永久擁有檔案。現在多個責任仍在`Game`，未來抽離也不能產生第二個傷害／存檔真實來源。

| System／狀態 | 主要owner | 負責／不負責 |
| --- | --- | --- |
| Core／IMPLEMENTED | `Game.frame/step/start/lobby` | 時鐘、模式、世界生命週期；不讓render FPS決定招式 |
| Player action／IMPLEMENTED | `Game.tickPlayer / tryStomp`＋`RiftFSM` | intent與合法轉移；Input adapter不直接扣血 |
| Combat／IMPLEMENTED | `Game.collisions/hit/counter`＋`RiftVitals` | 前者唯一防禦／命中裁決，後者生命規則；UI／AI不另算damage |
| Online ownership／IMPLEMENTED | `RiftAuthority`；傳輸由`RiftNet` | 封包驗證／去重／owner；不代替server anti-cheat |
| Boss／IMPLEMENTED | `RiftAI` | 可見狀態觀察、導航與input決策；不操作DOM或直接傷害 |
| Tutorial／IMPLEMENTED | `RiftTutorial` | 課程、訓練特例與驗收；不建立第二份combat公式 |
| Presentation／IMPLEMENTED | `RiftRenderer`、`RiftAudio` | 畫面／動畫／聲音；不觸發HP變更 |
| UI／IMPLEMENTED | `Game.bind/renderHUD`＋教學UI | 顯示state、發操作請求；目前耦合但不可新增UI直寫AI |
| Stage／Encounter／PLANNED | Stage definition＋EncounterRunner | 場所資料、遭遇流程與結算；Boss不自行切場 |
| Item／Effect／PLANNED | Inventory＋共用Effect evaluator | 持有量／效果生命週期，套用仍經Combat/Vitals |
| Progression／PLANNED | 獨立Progression service | 已確認解鎖／quest／achievement結果；不重演damage |
| Save／PLANNED | 單一SaveStore／migration | 永久schema、驗證、備份、寫入；不保存live Game |

未來依賴方向與事件適配見下節及 [ARCHITECTURE](ARCHITECTURE.md)。Ownership變更必須更新此表、ADR和交班，禁止在同責任旁另建`ManagerV2`。

## IMPLEMENTED：Player 與角色 FSM

`fighter(id,x,loadout,art)` 建立普通物件，玩家、Boss、同屏對手、遠端副本與陪練共用；沒有獨立 Player class 或 Stats system。核心欄位：

| 群組 | 欄位／責任 |
| --- | --- |
| 身份與控制 | `id / name / aiControlled`；現在 id 恰為 0 或 1 |
| 身體與移動 | `x/y/vx/vy/facing/ground/drop/grapple/dash/dashDir/hidden/stomp/stompBuffer/lastStompAttackId` |
| 生命與資源 | `hp/maxHp/posture/maxPosture/spirit/nodes/maxNodes/phase/tonics/healPending/peace`；玩家/PvP/陪練100／100／2，AI赤衡240／220／3 |
| FSM | `state/st/lockFrames/stun/revive`；`st` 為當前段經過 tick，不是全局時間 |
| 攻擊實例 | `moveName/move/attackId/moveSeq/wave/hits/charge/attackReleased/holdCharged/confirm` |
| 防守與效果 | `guard/deflect/deflectWindow/guardSpam/guardBuffer/lastParryTick/aegis/invuln/blinkWindow/burn/fireBlade/charged` |
| 輸入與觀察 | `prevBits/lastGuard/parries/wasParried/lastCounterTick` 等 |

`tickPlayer()` 把輸入意圖轉為動作，`advanceAttack()` 管起手／有效／收招，`physics()` 管位置／重力／平台，`RiftVitals` 管生命規則；程序動畫讀這些結果，不能以「動畫播完 callback」決定命中或解除鎖定。能力內容見 [ABILITY_SYSTEM](ABILITY_SYSTEM.md)，反制／無敵／復燃數值見 [COMBAT_SYSTEM](COMBAT_SYSTEM.md)，不在此複製幀數表。

[src/fsm.js](../src/fsm.js) 的完整枚舉與約束：

| 狀態 | 語意與離開方式 |
| --- | --- |
| `IDLE / MOVE / GUARD` | 中立可動狀態；`canAct` 還要求 HP >0、未死、lockFrames<=0 |
| `STARTUP` | 起手；普通完成只進 ACTIVE，不能開始防禦 |
| `ACTIVE` | 有效段；普通完成只進 RECOVERY |
| `RECOVERY` | 收招；完成後回中立；命中確認允許追擊／墊步取消及跳躍，成功蹬踏亦結束收招；指定輕招經過6 tick另可防禦取消 |
| `DEFLECT` | 點按防禦狀態鎖；進入時以16→12 tick窗口設鎖；成功後消耗窗口並縮鎖到最多2 tick，合法新按可重起招架；新按跳躍可離開並放棄招架窗口 |
| `RECOIL / BLADE_PINNED / HIT_STUN` | 反彈／踏刃被制／受創；倒數完成才能正常回中立 |
| `STUNNED` | 失衡倒地，暫停所有主動操作、鎖住橫向位移；倒數完由 Vitals 恢復低 HP |
| `GRAPPLING` | 沿掛索移動；落點或允許的攻擊／取消路徑結束 |
| `DRINKING` | 飲藥鎖定；完整完成才治療，受反應中斷會清除待治療值 |
| `EXECUTING` | 發動斷決者的鎖定；完成回 IDLE |
| `REVIVING` | 核心復燃；正常完成回中立，拒絕一般受擊中斷 |
| `DEAD` | 最終死亡；不可從一般 FSM 操作回到 IDLE，下一場建立新 actor |

受擊等特殊反應使用 `enter(...,{interrupt:true})`；正常進程使用經核准的 `complete`，不是 UI 可以任意傳入的開鎖許可。`enter()` 會清除取消攻擊、招架、掛索、治療等欄位；新增控制狀態必須同步轉移、更新、網路 allowlist、render、AI與教學。現有遠端副本 adapter 和教學 reset 有直接賦值特例，其他新功能不應複製為通用捷徑。

移動為固定 tick 速度，重力與向下速度有上限；平台只有由上往下穿過頂面的站立判定，沒有完整剛體碰撞／牆滑動。墊步與跳躍是 actor 欄位，不各自占一個 FSM 狀態。未來新增動畫名稱需維持 gameplay state 與 visual pose 分離，詳見 [ASSET_PIPELINE](ASSET_PIPELINE.md)。

空中新按跳躍保存12 combat tick的 `stompBuffer`，`tryStomp()` 沿用自由行動／已確認收招取消，經橫掃階段、範圍與平台遮擋判定才呼叫共用 `counter()`。`stomp` 記錄本次滯空已成功，`lastStompAttackId` 防同招重播；落地、受擊鎖定及競爭動作輸入清理緩衝，hitstop不扣緩衝時間。具體範圍與反制效果見 [COMBAT_SYSTEM](COMBAT_SYSTEM.md)，變更理由見 [ADR-005](adr/005-stomp-assist-and-charged-thrust.md)。

## IMPLEMENTED：教學與目前事件耦合

目前**沒有通用 EventBus**。`Game.hit/counter/execute` 直接呼叫 Vitals、音效、VFX、caption 與網路回覆；`RiftNet` 的 callback 只是一個 transport adapter，不能當作全遊戲事件系統。

`RiftTutorial.observeCombat()` 在 Game instance 上包裝三個方法：

- `hit / counter`：先呼叫原 resolver，讀實際結果後交給課程 `onEvent()`；不以按鍵次數冒充命中。
- `execute`：除觀察結果外，**教學 active 時也限制斷決**，只允許最後一課、玩家執行、尚未完成且對手有兩核的第一次斷決。這是明確的訓練規則，不能一概說所有 wrapper 都沒有行為。
- `beforeStep / afterStep`：給陪練輸入、課程定位、限定補給／重置與驗收。正式對局不可引入這些資源例外。

課程以穩定 lesson ID 儲存完成標記。改 resolver signature、outcome字串、move ID 或生命週期，必須跑22課回歸；event介面演進時也要保留最後一課斷決 gate，而非只把包裝整段刪掉。

## PLANNED：小型事件與系統邊界

真正有第二個結果 observer（如進度／成就）時，再引入小型同步 dispatcher 或本 tick outcome queue。先替代觀察用途，不建 command bus／可執行腳本框架。命令表示「請求做什麼」，事件表示「裁決已經做完什麼」；訂閱者不能藉事件再次套傷害、繞過 FSM 或讓兩端重複發獎勵。

建議最小 envelope（**尚無此 API**）：

```js
const event = {
  type: 'PLAYER_DAMAGED',
  eventId: 'round:contact:target:outcome', // 由已驗證 contact ID 等穩定構成
  roundId: 1,
  tick: 120,
  sourceId: 1,
  targetId: 0,
  payload: { damage: 10, hpAfter: 90, postureAfter: 12 }
};
```

只傳可複製的值與 ID，不傳 DOM、AudioNode、live actor reference 或 callback。當前數字actor ID先保留，等多目標遷移才版本化entity ID。每場持有訂閱生命週期，離開關卡／重試解除一次；事件ID有界去重，順序在simulation tick內明定，避免 listener 重入造成重複斷決。

| 候選事件 | 唯一發布時機 | 可能消費者 |
| --- | --- | --- |
| `PLAYER_DAMAGED` | 擁有者完成 HP 變更後，含實際 damage；不得另從動畫重建 | HUD、音效、教學、統計 |
| `ACTOR_DOWNED` | 首次進 STUNNED；與最終死亡分開 | 斷決提示、教學 |
| `PLAYER_DIED` | 最後一核移除且進 DEAD；不是 HP 第一次歸零 | 結果／未來 Encounter |
| `BOSS_SPAWNED` | 由 Boss factory / Encounter 成功建立 actor 後；該接口尚未存在 | HUD、音樂 |
| `BOSS_PHASE_CHANGED` | phase controller 確認從舊階段轉入新階段一次 | 表現、場地規則 |
| `BOSS_DEFEATED` | 確認最終擊敗一次；reward 所有權由 Encounter 決定 | Progression、掉落 |
| `ITEM_PICKED` | Inventory 接受物品後；模組尚未存在 | UI、Save |
| `STAGE_COMPLETED` | Encounter／Stage完成條件確認後 | Progression、Save |
| `DIALOGUE_STARTED` | Dialogue runner 成功進入節點後 | UI、場景控制 |

線上傷害事件只由擁有者裁決發布；遠端確認可用於本機表現，但不能據此再更動本機受擊 HP。事件不必全部廣播到網路，維持現有意圖／確認協定，先用 adapter 對接；protocol更動另行版本化。PvP 的 `PLAYER_DIED` 不能直接當作單機 `BOSS_DEFEATED` 發永久獎勵。

### 按需求抽取，不預先建框架

| 接點 | 如何新增／觸發條件 | 系統互動 |
| --- | --- | --- |
| `BossDefinition / controller factory` | 第二位可選Boss；依 [BOSS_SYSTEM](BOSS_SYSTEM.md) 保留現有赤衡 | controller只輸出意圖，共用Player／Combat底層 |
| `TargetQuery / actor IDs` | 第一個同場第三actor；依 [ENEMY_SYSTEM](ENEMY_SYSTEM.md) 先清除兩人假設 | combat、AI、camera、authority與HUD一併遷移 |
| `Stage / Encounter` | 第二地圖或可切換遭遇；依 [LEVEL_SYSTEM](LEVEL_SYSTEM.md) | World地形與遭遇生命週期分離，切換清除暫態物件 |
| `GameConfig` | 第一個跨模組設定／難度需求；見 [DEVELOPMENT](DEVELOPMENT.md) | simulation與presentation設定分開，網路需一致的值不可單端任改 |
| `Progression / SaveStore` | 第一個永久解鎖／背包需求；見 [SAVE_SYSTEM](SAVE_SYSTEM.md) | 確認結果→進度→版本化儲存，不能保存live Game物件 |

**OPTIONAL**：ECS、worker、完整 replay／rollback、通用物理引擎、更多本機玩家。目前沒有證據需要一次導入；先為一個具體需求做最小可測接點。

## 修改後必查

測試命令統一見 [TESTING](TESTING.md)。改 loop 時要比較60／144／240Hz的相同simulation結果、長stall上限、pause與hitstop差異、短tap緩衝；改actor／FSM時驗證中斷清除、防禦緩衝、蹬踏緩衝／去重／平台遮擋與鎖定、玩家雙核／Boss三核、容量比例、重開與線上副本；改事件／教學時驗證沒有重複結果／重複listener且22課依真實接觸完成。完整清單見 [REGRESSION_CHECKLIST](REGRESSION_CHECKLIST.md)。
