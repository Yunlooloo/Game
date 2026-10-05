# 劇情、對話與進度

狀態：遊戲目前的文案與陪練提示為 **IMPLEMENTED**；Chapter／Dialogue／Quest／NPC／Progression 模組為 **PLANNED**，尚未存在；分支主線、商店劇情與大型任務圖為 **OPTIONAL**。

## IMPLEMENTED：不可誤認成劇情系統的現況

`src/shell.html` 有原創世界觀簡介、角色介紹與操作卷軸；`src/core.js` 的 `caption()`／`toast()` 提供戰鬥狀態文字，結果面板由 `showResult()` 填入。`src/tutorial.js` 的 `LESSONS` 定義 22 課指示、條件與陪練行為，保存完成課程 ID。它不是可套用到主線的 Dialogue Graph。

沒有 NPC entity、對話節點、故事旗標、選項條件、任務、章節、獎勵進度、Localization 字串表或事件匯流排。教學以 wrapper 觀察 `Game.hit/counter/execute` 的結果；新增劇情不應再複製更多 wrapper 來攔截這些方法。

## PLANNED：最小且可測的劇情資料

第一個需求例如「戰前兩句對話」出現時，先增加 JSON-compatible JS object 與小型 `DialogueRunner`，不加入脚本語言。資料放在 `src/content/dialogue/chapter_01/`，在自己的 registry 登錄；新增模組必須加入 `scripts/build.py`，單一輸出 HTML 仍內嵌資料。

```js
// 草案；src/content/dialogue/chapter_01/gate.js 尚未存在
const gateDialogue = {
  id: "dialogue_gate", startNodeId: "arrival",
  nodes: {
    arrival: {
      speakerId: "npc_gatekeeper",
      text: "先聽清刀鳴，再踏入場中。",
      portraitId: null,
      emotion: "calm",
      choices: [
        { id: "enter", text: "開始試刃", nextNodeId: "ready", conditions: [] },
        { id: "leave", text: "稍後再來", nextNodeId: null, conditions: [] }
      ]
    },
    ready: {
      speakerId: "npc_gatekeeper", text: "守住你的距離。",
      nextNodeId: null,
      actions: [{ kind: "setStoryFlag", flagId: "story_gate_met", value: true }]
    }
  }
};
```

`text` 是第一版可用的資料形狀；需要第二語系才抽 `textKey`，不要同時讓兩者成为互相衝突的真實來源。ID 規範見 [DEVELOPMENT.md](DEVELOPMENT.md)，名稱與顯示文案可以改，保存用的旗標 ID 不隨翻譯變更。

| 層級 | 責任與界線 |
| --- | --- |
| Chapter | 整理故事內容與解鎖要求，不參與每幀碰撞。初版可只有資料夾。 |
| Story Event | 引用 dialogue／Encounter／明確獎勵；本身不直接寫 HP 或 DOM。 |
| Dialogue Definition | speaker、text、portrait、emotion、choice、next、condition、action 的純資料。 |
| Dialogue Runtime | 當前 dialogueId/nodeId、是否等待玩家、此次已提交的 choice；與永久旗標分開。 |
| Story Progress | 看過哪些一次性事件、flag 值、完成／失敗任務；只保存產品需要的最小狀態。 |
| Trigger | 描述何時請求事件，例如首次進入房間、Encounter 結束；需去重與 scope。 |

### Condition 和 action 的安全邊界

使用小型白名單判斷器，例如 `flagEquals`、`bossCleared`、`hasItem`；**禁止** `eval`、`new Function`、可執行字串或把 condition 當任意 JS。未知 kind／未知 ID 必須明確驗證失敗，而非默默開放選項。條件讀取不可變進度快照，不修改 gameplay。

選項按下時再次驗證條件；邏輯層提交一次結果後，UI 才更新下一節點。`grantItem`、`setStoryFlag`、`startEncounter` 等 action 各自呼叫責任系統，不能把多種效果混成 UI 事件處理器。永久獎勵以 `eventId + choiceId` 或獨立 reward receipt 去重，重載／重複 click 不重複給物品。

循環對話可以存在，但 loader 應驗證引用完整，runner 限制一次自動跳轉步數，避免無輸入循環卡死。必要文字用 `textContent` 顯示；未来匯入內容不能直接成為 `innerHTML`。

## PLANNED：整合到既有遊戲的順序

1. 在新增對話任務中建立 definition、registry 與 runner；先用純 Node 測 graph navigation、條件與選項提交。對話 module 不依賴 Canvas／DOM。
2. 在 `src/shell.html` 增加一個對話面板，由獨立 UI adapter 畫 speaker、text、選項。選項是 button，支援鍵盤、touch、焦點及字級。
3. `Game` 作協調者，在合適時機開啟對話並 `clearInputs()`；定義輸入是否被對話攔截。不能一邊點選項一邊揮刀。
4. 單機戰前對話先不建立戰鬥世界或明確暫停；關閉後重設 accumulator、輸入邊緣、focus。網路對局沒有可用的同步暫停／對話協議，第一版不要讓單端劇情凍結另一端。
5. [LEVEL_SYSTEM.md](LEVEL_SYSTEM.md) 的 Encounter Runner 落地後再接 `onEnter`／`onComplete` trigger。進度由 Progression 保有，依 [SAVE_SYSTEM.md](SAVE_SYSTEM.md) 版本化保存。
6. 只有第二種系統真的需要觀察同一結果時，提取一個小型 domain event dispatcher；保留 combat 的 synchronous 判定和防守方裁決，不先建立全域無型別 event bus。

## PLANNED：任務、NPC 與長期成長

Quest Definition 可包含 `questId`、prerequisites、objectives、completion、rewardId；Quest Runtime／Persistent Progress 只記完成的 objective ID 與已領獎狀態。初版目標先選明確事件，如「擊敗指定 Boss 一次」；不讓 quest 在自己的 loop 重做碰撞或掃描整個世界。

NPC Definition 可引用 dialogueId 和互動區域；與普通敵人是否共用移動實體需由實際需求決定。XP、等級、技能解鎖、裝備取得、Boss clear、成就都屬 **PLANNED**：目前沒有任何永久戰力成長，也不能將 `Game.scores` 當長期戰績。

## 驗證與常見錯誤

資料測試：起點存在、所有 next／speaker／portrait 引用有效、未知 condition 拒絕、合法循環不鎖死。整合測試：戰前播放→開始戰鬥→結果觸發一次→重試不重複獎勵；離開對話清理 input／subscription；reload 恢復永久 flag，但不恢復半段未提交 action。UI 測試：Tab 焦點、選項字級、窄螢幕捲動、touch 不觸發底下戰鬥。

新增步驟見 [CONTENT_COOKBOOK.md](CONTENT_COOKBOOK.md)。不要把教程文案、Boss phase 名稱、combat caption 當 story ID；不要把未落地的章節流程放到現況 Mermaid 中。
