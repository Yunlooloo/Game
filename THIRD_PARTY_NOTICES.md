# 第三方素材與授權聲明

## IMPLEMENTED — PeerJS 1.5.5

- 檔案：`vendor/peerjs-1.5.5.js`，原樣保存目前遊戲內嵌版本。
- 用途：WebRTC 連線與 PeerJS 公用信令；僅線上模式需要網路。
- 上游：https://github.com/peers/peerjs/tree/v1.5.5
- 檔案 SHA-256：`63802d53d564378eba2aa98f6a2580f072293d0ded3e5a4adf9e8bc59bcd2329`。
- 以下文字逐字保留既有 `src/shell.html` 中的 PeerJS 授權；build 也會繼續將它保留在 `index.html`。

```text
Copyright (c) 2015 Michelle Bu and Eric Zhang, http://peerjs.com

(The MIT License)

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## IMPLEMENTED — 專案擁有者提供的音樂

| Repository 檔案 | 提供時的名稱 | SHA-256 |
| --- | --- | --- |
| `assets/audio/music/ambient.mp3` | 雨とレコードの静寂(常駐輕音樂BGM).mp3 | `978bf0185269d969b5a4a155dbdd19bdd77b7bd06830b246a866d0556aed1ca4` |
| `assets/audio/music/battle.mp3` | 雨夜の竹笛(戰鬥音樂).mp3 | `13bbc67bbfd1be87ac67c54809b451a2514838904bff139b572d48298efc9ff1` |

這兩首音樂由專案擁有者於開發期間上傳，已存在於原先發布的單檔遊戲中。本次整理僅原樣保存，沒有替素材授予新授權。Repository 尚未附上可核對的作者、來源網址或再散布／商業使用授權證明；擁有者應補齊紀錄。PeerJS 的 MIT License 不適用於這兩首音樂，也不自動涵蓋遊戲自有程式、美術或文字。

## 專案本身的授權

本次維護未替作者選擇或新增專案授權。公開可讀不代表所有內容皆可任意再散布。若日後新增素材，請依 [素材流程](docs/ASSET_PIPELINE.md) 記錄來源與權利，勿把他人授權套用到整個專案。
