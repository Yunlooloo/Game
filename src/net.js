
/* Riftblade Echoes — transport only. Simulation and authority live in Game. */
(() => {
  'use strict';
  const VERSION = 3;
  const PREFIX = 'riftblade-';
  const MAX_PACKET = 196608;
  const MAX_HISTORY = 240;
  const MAX_BITS = 65535;
  const UINT = 0x7fffffff;
  const isInt = (n, min = 0, max = UINT) => Number.isInteger(n) && n >= min && n <= max;
  const friendly = error => {
    const type = error && error.type;
    return ({
      'browser-incompatible': '此瀏覽器不支援 WebRTC，請使用新版 Chrome、Firefox 或 Safari。',
      'disconnected': '信令伺服器連線已中斷，請重新建立房間。',
      'invalid-id': '房間代碼格式不正確。',
      'network': '無法連上 PeerJS 信令服務，請確認網路與防火牆。',
      'peer-unavailable': '找不到這個房間；請確認代碼，並請房主保持頁面開啟。',
      'server-error': 'PeerJS 信令服務暫時無法使用，請稍後重試。',
      'socket-error': '信令連線失敗，請確認網路後重試。',
      'socket-closed': '信令連線已關閉，請重新建立房間。',
      'ssl-unavailable': '信令服務的安全連線無法使用。',
      'unavailable-id': '此房間代碼已被使用，請重新建立房間。',
      'webrtc': '無法建立玩家之間的 WebRTC 連線；其中一方的網路可能需要 TURN 中繼服務。'
    })[type] || (error instanceof Error && error.riftbladeSafe ? error.message : '連線發生錯誤，請重新建立或加入房間。');
  };
  const safeError = message => Object.assign(new Error(message), { riftbladeSafe: true });

  // Build a fresh JSON tree, rejecting prototypes, infinities and excessive nesting.
  // No remote object is merged into the transport or used as an executable callback.
  function cleanJSON(value, byteLimit = MAX_PACKET) {
    const encoded = JSON.stringify(value);
    if (!encoded || encoded.length > byteLimit) throw safeError('封包超過大小限制。');
    const decoded = JSON.parse(encoded);
    let nodes = 0;
    const check = (node, depth) => {
      if (++nodes > 16000 || depth > 24) throw safeError('封包結構超過限制。');
      if (node === null || typeof node === 'boolean') return;
      if (typeof node === 'number') {
        if (!Number.isFinite(node)) throw safeError('無效的數值封包。');
        return;
      }
      if (typeof node === 'string') {
        if (node.length > 2048) throw safeError('封包字串過長。');
        return;
      }
      if (typeof node !== 'object') throw safeError('無效的資料封包。');
      const keys = Object.keys(node);
      if (keys.length > (Array.isArray(node) ? 4096 : 256)) throw safeError('封包項目過多。');
      for (const key of keys) {
        if (key === '__proto__' || key === 'prototype' || key === 'constructor') throw safeError('不安全的資料欄位。');
        check(node[key], depth + 1);
      }
    };
    check(decoded, 0);
    return decoded;
  }

  window.RiftNet = class RiftNet {
    constructor(callbacks = {}) {
      this.callbacks = callbacks;
      this.role = null;
      this.connected = false;
      this.pingMs = 0;
      this.clockOffsetMs = 0; // remote clock minus local clock; diagnostics only.
      this._clockSamples = 0;
      this.peerId = '';
      this.roomCode = '';
      this.inputHistory = [];
      this.lastAck = 0;
      this.combatHistory = [];
      this._combatSequence = 0;
      this._combatLastReceived = 0;
      this._combatStats = { messagesReceived: 0, sequenceGaps: 0, lateMessages: 0, delayedMessages: 0 };
      this.peer = null;
      this.connection = null;
      this._generation = 0;
      this._sequence = 0;
      this._lastReceivedSeq = 0;
      this._lastSnapshotFrame = -1;
      this._pings = new Map();
      this._pendingRejects = new Set();
      this._timers = new Set();
      this._heartbeat = null;
      this._lastReceive = 0;
      this._rate = { at: 0, count: 0 };
    }

    _emit(name, ...args) {
      const fn = this.callbacks[name];
      if (typeof fn === 'function') {
        // A UI error must not turn a healthy connection into a transport failure.
        try { fn(...args); } catch (error) { console.error('Rift callback:', name, error); }
      }
    }

    _timer(fn, ms) {
      const timer = setTimeout(() => { this._timers.delete(timer); fn(); }, ms);
      this._timers.add(timer);
      return timer;
    }

    _clearTimer(timer) { clearTimeout(timer); this._timers.delete(timer); }

    _code() {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const bytes = new Uint8Array(8);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, byte => chars[byte % chars.length]).join('');
    }

    _normalizeCode(id) {
      if (typeof id !== 'string') throw safeError('請輸入房間代碼。');
      const code = id.trim().replace(/^riftblade-/i, '').toUpperCase();
      if (!/^[A-Z2-9]{6,12}$/.test(code)) throw safeError('房間代碼應為 6–12 位英文字母或數字。');
      return code;
    }

    _begin(role) {
      this._close('', false);
      this.role = role;
      this._sequence = 0;
      this._lastReceivedSeq = 0;
      this._lastSnapshotFrame = -1;
      this.inputHistory.length = 0;
      this.lastAck = 0;
      this.combatHistory.length = 0;
      this._combatSequence = 0;
      this._combatLastReceived = 0;
      this._combatStats = { messagesReceived: 0, sequenceGaps: 0, lateMessages: 0, delayedMessages: 0 };
      this.pingMs = 0;
      this.clockOffsetMs = 0;
      this._clockSamples = 0;
      this._emit('onRole', role);
      if (typeof window.Peer !== 'function') throw safeError('PeerJS 未正確載入，無法建立連線。');
      if (!window.RTCPeerConnection) throw safeError('此瀏覽器不支援 WebRTC。');
      return this._generation;
    }

    async _openPeer(id, generation) {
      return new Promise((resolve, reject) => {
        let settled = false;
        let timer;
        const fail = error => {
          if (settled) return;
          settled = true;
          this._clearTimer(timer);
          this._pendingRejects.delete(fail);
          reject(error);
        };
        this._pendingRejects.add(fail);
        timer = this._timer(() => {
          fail(safeError('連接信令服務逾時，請確認網路後重試。'));
          this._close('連接信令服務逾時。', true);
        }, 15000);
        let peer;
        try { peer = id ? new window.Peer(id, { debug: 0 }) : new window.Peer({ debug: 0 }); }
        catch (error) { fail(safeError(friendly(error))); return; }
        this.peer = peer;
        peer.on('open', ownId => {
          if (generation !== this._generation || settled) return;
          settled = true;
          this._clearTimer(timer);
          this._pendingRejects.delete(fail);
          this.peerId = ownId;
          resolve(ownId);
        });
        peer.on('connection', conn => {
          if (generation !== this._generation || this.role !== 'host' || this.connection || !conn.metadata || conn.metadata.game !== 'riftblade' || conn.metadata.v !== VERSION) {
            conn.close();
            return;
          }
          this._adopt(conn, generation);
        });
        peer.on('error', error => {
          if (generation !== this._generation) return;
          const reason = friendly(error);
          fail(safeError(reason));
          this._close(reason, true);
        });
        peer.on('disconnected', () => {
          if (generation !== this._generation) return;
          // An established DataChannel survives signaling disconnects.
          // Report this accurately while preserving an actually live match.
          if (this.connected) this._emit('onStatus', '信令服務中斷；目前玩家直連仍有效。');
          else {
            fail(safeError('信令服務連線已中斷。'));
            this._close('信令服務連線已中斷。', true);
          }
        });
        peer.on('close', () => {
          if (generation !== this._generation) return;
          fail(safeError('連線已關閉。'));
          this._close('連線已關閉。', true);
        });
      });
    }

    async host() {
      const generation = this._begin('host');
      const code = this._code();
      this.roomCode = code;
      this._emit('onStatus', '正在建立房間…');
      await this._openPeer(PREFIX + code, generation);
      if (generation !== this._generation) throw safeError('建立房間已取消。');
      this._emit('onStatus', '房間 ' + code + ' 已開啟，等待另一位劍士。');
      return code;
    }

    async join(id) {
      const code = this._normalizeCode(id);
      const generation = this._begin('guest');
      this.roomCode = code;
      this._emit('onStatus', '正在加入房間 ' + code + '…');
      await this._openPeer(null, generation);
      if (generation !== this._generation) throw safeError('加入房間已取消。');
      return new Promise((resolve, reject) => {
        const fail = error => { this._pendingRejects.delete(fail); reject(error); };
        this._pendingRejects.add(fail);
        let conn;
        try {
          conn = this.peer.connect(PREFIX + code, {
            reliable: true,
            serialization: 'json',
            label: 'riftblade-duel-v1',
            metadata: { game: 'riftblade', v: VERSION }
          });
        } catch (error) {
          fail(safeError(friendly(error)));
          this._close(friendly(error), true);
          return;
        }
        this._adopt(conn, generation, () => {
          this._pendingRejects.delete(fail);
          resolve(code);
        });
      });
    }

    _adopt(conn, generation, ready) {
      this.connection = conn;
      const timer = this._timer(() => {
        if (generation === this._generation && !this.connected) this._close('玩家直連逾時；請檢查雙方網路或防火牆。', true);
      }, 15000);
      conn.on('open', () => {
        if (generation !== this._generation || conn !== this.connection) { conn.close(); return; }
        this._clearTimer(timer);
        this.connected = true;
        this._lastReceive = Date.now();
        this._rate = { at: this._lastReceive, count: 0 };
        this._emit('onStatus', '雙人直連已建立。');
        this._ping();
        this._heartbeat = setInterval(() => {
          if (!this.connected) return;
          if (Date.now() - this._lastReceive > 30000) { this._close('超過 30 秒未收到對方資料，連線已中斷。', true); return; }
          this._ping();
        }, 1500);
        if (ready) ready();
      });
      conn.on('data', data => {
        if (generation !== this._generation || conn !== this.connection || !this.connected) return;
        try { this._receive(data); }
        catch (_) { this._close('收到不相容或無效的連線資料。', true); }
      });
      conn.on('close', () => {
        if (generation === this._generation && conn === this.connection) this._close('對方已離開房間或連線中斷。', true);
      });
      conn.on('error', error => {
        if (generation === this._generation && conn === this.connection) this._close(friendly(error), true);
      });
    }

    _send(packet) {
      if (!this.connected || !this.connection || !this.connection.open) return false;
      const channel = this.connection.dataChannel;
      if (channel && channel.bufferedAmount > 1048576) {
        this._close('網路傳輸壅塞，請重新連線。', true);
        return false;
      }
      try { this.connection.send(packet); return true; }
      catch (_) { this._close('資料傳輸失敗，連線已中斷。', true); return false; }
    }

    _ping() {
      const now = Date.now();
      for (const [id, time] of this._pings) if (now - time > 10000) this._pings.delete(id);
      const nonce = Math.floor(Math.random() * UINT);
      this._pings.set(nonce, now);
      while (this._pings.size > 8) this._pings.delete(this._pings.keys().next().value);
      this._send([VERSION, 'p', nonce, now]);
    }

    _receive(raw) {
      const now = Date.now();
      if (now - this._rate.at >= 1000) this._rate = { at: now, count: 0 };
      if (++this._rate.count > 300) throw safeError('連線資料速率異常。');
      const message = cleanJSON(raw);
      if (!Array.isArray(message) || message.length < 2 || message.length > 8 || message[0] !== VERSION) throw safeError('不支援的通訊版本。');
      const type = message[1];
      this._lastReceive = now;
      if (type === 'c') {
        if (message.length !== 5 || !isInt(message[2], 1) || !Number.isFinite(message[3]) || message[3] < 0 || message[3] > 1e15 || !message[4] || typeof message[4] !== 'object' || Array.isArray(message[4]) || JSON.stringify(message[4]).length > 16384 || typeof message[4].type !== 'string' || !/^[A-Z_]{1,32}$/.test(message[4].type)) throw safeError('無效的戰鬥封包。');
        const seq = message[2], stats = this._combatStats;
        if (seq <= this._combatLastReceived) { stats.lateMessages = Math.min(UINT, stats.lateMessages + 1); return; }
        const gap = seq - this._combatLastReceived - 1;
        if (gap > 4096) throw safeError('戰鬥封包序號超過範圍。');
        stats.sequenceGaps = Math.min(UINT, stats.sequenceGaps + gap);
        stats.messagesReceived = Math.min(UINT, stats.messagesReceived + 1);
        if (this._clockSamples && now + this.clockOffsetMs - message[3] > 250) stats.delayedMessages = Math.min(UINT, stats.delayedMessages + 1);
        this._combatLastReceived = seq;
        this._emit('onCombat', message[4]);
      } else if (type === 'i') {
        if (this.role !== 'host' || message.length !== 8) throw safeError('無效的輸入封包。');
        const [, , frame, bits, visualTick, seq, time, reserved] = message;
        if (!isInt(frame) || !isInt(bits, 0, MAX_BITS) || !isInt(visualTick) || !isInt(seq, 1) || !Number.isFinite(time) || time < 0 || reserved !== 0) throw safeError('無效的輸入數值。');
        if (seq <= this._lastReceivedSeq) return;
        this._lastReceivedSeq = seq;
        this._emit('onInput', { frame, bits, visualTick, seq, time });
      } else if (type === 's') {
        if (this.role !== 'guest' || message.length !== 5 || !isInt(message[2]) || !isInt(message[4]) || !message[3] || typeof message[3] !== 'object') throw safeError('無效的狀態封包。');
        const [, , frame, state, ack] = message;
        if (ack > this._sequence) throw safeError('無效的輸入確認。');
        if (frame < this._lastSnapshotFrame) return;
        this._lastSnapshotFrame = frame;
        this.lastAck = Math.max(this.lastAck, ack);
        this.inputHistory = this.inputHistory.filter(input => input.seq > this.lastAck);
        this._emit('onSnapshot', { frame, state, ack });
      } else if (type === 'b') {
        if (this.role !== 'guest' || message.length !== 3 || !message[2] || typeof message[2] !== 'object' || Array.isArray(message[2])) throw safeError('無效的開局封包。');
        // Sequence numbers remain monotonic across rematches; frame numbers restart.
        this._lastSnapshotFrame = -1;
        this.inputHistory.length = 0;
        this._emit('onStart', message[2]);
      } else if (type === 'e') {
        if (message.length !== 3 || !message[2] || typeof message[2] !== 'object' || Array.isArray(message[2]) || JSON.stringify(message[2]).length > 8192) throw safeError('無效的事件封包。');
        this._emit('onEvent', message[2]);
      } else if (type === 'p') {
        if (message.length !== 4 || !isInt(message[2]) || !Number.isFinite(message[3])) throw safeError('無效的延遲探測。');
        this._send([VERSION, 'q', message[2], message[3], now]);
      } else if (type === 'q') {
        if (message.length !== 5 || !isInt(message[2]) || !Number.isFinite(message[3]) || !Number.isFinite(message[4])) throw safeError('無效的延遲回應。');
        const sent = this._pings.get(message[2]);
        if (sent === undefined || sent !== message[3]) return;
        this._pings.delete(message[2]);
        const rtt = now - sent;
        if (rtt < 0 || rtt > 15000) return;
        this.pingMs = this.pingMs ? Math.round(this.pingMs * 0.75 + rtt * 0.25) : rtt;
        const offset = message[4] - (sent + rtt / 2);
        if (Math.abs(offset) <= 86400000) this.clockOffsetMs = this._clockSamples++ ? this.clockOffsetMs * 0.7 + offset * 0.3 : offset;
      } else throw safeError('未知的通訊封包。');
    }

    sendInput(frame, bits, visualTick) {
      if (this.role !== 'guest' || !this.connected || !isInt(frame) || !isInt(bits, 0, MAX_BITS) || !isInt(visualTick)) return false;
      const input = { frame, bits, visualTick, seq: ++this._sequence, time: Date.now() };
      if (!this._send([VERSION, 'i', frame, bits, visualTick, input.seq, input.time, 0])) return false;
      this.inputHistory.push(input);
      if (this.inputHistory.length > MAX_HISTORY) this.inputHistory.splice(0, this.inputHistory.length - MAX_HISTORY);
      return true;
    }

    sendSnapshot(frame, state, ack = 0) {
      if (this.role !== 'host' || !isInt(frame) || !isInt(ack)) return false;
      try { return this._send([VERSION, 's', frame, cleanJSON(state, MAX_PACKET - 256), ack]); }
      catch (_) { this._emit('onStatus', '狀態封包超過限制，請減少同步資料。'); return false; }
    }

    sendStart(config) {
      if (this.role !== 'host') return false;
      try { return this._send([VERSION, 'b', cleanJSON(config, 16384)]); }
      catch (_) { this._emit('onStatus', '開局設定格式無效。'); return false; }
    }

    sendCombat(payload) {
      if (!this.connected || this._combatSequence >= UINT) return false;
      try {
        const clean = cleanJSON(payload, 16384);
        if (!clean || typeof clean !== 'object' || Array.isArray(clean) || typeof clean.type !== 'string' || !/^[A-Z_]{1,32}$/.test(clean.type)) return false;
        const seq = ++this._combatSequence, time = Date.now(), entry = { payload: clean, seq, time };
        this.combatHistory.push(entry);
        if (this.combatHistory.length > 128) this.combatHistory.splice(0, this.combatHistory.length - 128);
        if (!this._send([VERSION, 'c', seq, time, clean])) {
          const at = this.combatHistory.indexOf(entry); if (at >= 0) this.combatHistory.splice(at, 1);
          return false;
        }
        return true;
      } catch (_) { return false; }
    }

    getMetrics() {
      const stats = this._combatStats, total = stats.messagesReceived + stats.sequenceGaps;
      return {
        rttMs: Math.max(0, Math.min(15000, this.pingMs || 0)), clockOffsetMs: this.clockOffsetMs || 0,
        messagesReceived: stats.messagesReceived, sequenceGaps: stats.sequenceGaps,
        lateMessages: stats.lateMessages, delayedMessages: stats.delayedMessages,
        estimatedMissingPercent: total ? Math.min(100, stats.sequenceGaps / total * 100) : 0,
        lastReceiveAgeMs: this._lastReceive ? Math.max(0, Math.min(3600000, Date.now() - this._lastReceive)) : 0,
        reliable: true, estimateLabel: '可靠通道序號缺口估計（非 UDP 丟包率）'
      };
    }

    sendEvent(event) {
      try { return this._send([VERSION, 'e', cleanJSON(event, 8192)]); }
      catch (_) { return false; }
    }

    _close(reason, notify) {
      ++this._generation;
      this.connected = false;
      clearInterval(this._heartbeat);
      this._heartbeat = null;
      for (const timer of this._timers) clearTimeout(timer);
      this._timers.clear();
      this._pings.clear();
      for (const reject of Array.from(this._pendingRejects)) reject(safeError(reason || '連線已取消。'));
      this._pendingRejects.clear();
      const conn = this.connection;
      const peer = this.peer;
      this.connection = null;
      this.peer = null;
      try { if (conn) conn.close(); } catch (_) { /* already closed */ }
      try { if (peer && !peer.destroyed) peer.destroy(); } catch (_) { /* already closed */ }
      if (notify && reason) { this._emit('onStatus', reason); this._emit('onDisconnect', reason); }
    }

    disconnect() { this._close('已離開房間。', true); }
  };
})();
