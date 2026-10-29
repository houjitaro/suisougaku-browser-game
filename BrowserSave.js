/* 吹奏楽ゲーム：ブラウザ版のセーブ基盤 v1
 * 第5段階では GameStart_Browser.html に接続済み。
 * 状態変更後は BrowserUiBridge.js が save() を呼ぶ。
 */
(function (root) {
  'use strict';
  var KEY = 'suisougaku.browser.save.v1';
  var FORMAT = 'suisougaku-browser-save';
  var VERSION = 1;
  var MAX_IMPORT_BYTES = 5 * 1024 * 1024;

  function storage() {
    try {
      var s = root.localStorage;
      if (!s) throw new Error('localStorageが利用できません');
      return s;
    } catch (err) {
      throw new Error('ブラウザ保存を利用できません。プライベートモードや保存設定を確認してください。');
    }
  }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function validate(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data) ||
        data.format !== FORMAT || data.version !== VERSION ||
        !data.state || typeof data.state !== 'object' || Array.isArray(data.state)) {
      throw new Error('対応していないセーブデータです。');
    }
    var state = data.state;
    if (!state.player || typeof state.player !== 'object' ||
        !Array.isArray(state.members) || !Array.isArray(state.history) ||
        !state.contests || typeof state.contests !== 'object' ||
        !Number.isInteger(state.year) || state.year < 1 || state.year > 5 ||
        !['in_progress', 'completed'].includes(state.status)) {
      throw new Error('セーブデータの内容が不正です。');
    }
    return data;
  }
  function now() { return new Date().toISOString(); }
  function createId() {
    if (root.crypto && typeof root.crypto.randomUUID === 'function') return root.crypto.randomUUID();
    return String(Date.now()) + '-' + Math.random().toString(36).slice(2);
  }
  function createGame(bandName, prefecture, branch) {
    if (!String(bandName || '').trim() || !String(prefecture || '').trim()) {
      throw new Error('楽団名と都道府県を入力してください。');
    }
    var state = {
      gameId: createId(),
      status: 'in_progress',
      scene: 'manager_selection',
      year: 1,
      player: {
        bandName: String(bandName).trim(),
        prefecture: String(prefecture).trim(),
        branch: String(branch || ''),
        rating: 40,
        managerId: '',
        eventFlags: {}
      },
      members: [],
      history: [],
      contests: {branch: null, national: null, representatives: [], simulation: []}
    };
    return state;
  }
  function loadEnvelope() {
    var raw = storage().getItem(KEY);
    if (!raw) return null;
    try { return validate(JSON.parse(raw)); }
    catch (err) { throw new Error('保存済みデータを読み込めません: ' + err.message); }
  }
  function load() {
    var envelope = loadEnvelope();
    return envelope ? clone(envelope.state) : null;
  }
  function save(state) {
    var old = loadEnvelope();
    var envelope = {
      format: FORMAT, version: VERSION,
      createdAt: old && old.state.gameId === state.gameId ? old.createdAt : now(), updatedAt: now(),
      state: clone(state)
    };
    validate(envelope);
    try { storage().setItem(KEY, JSON.stringify(envelope)); }
    catch (err) { throw new Error('保存に失敗しました。ブラウザの空き容量・設定を確認してください。'); }
    return clone(envelope.state);
  }
  function clear() { storage().removeItem(KEY); }
  function exportJson() {
    var envelope = loadEnvelope();
    if (!envelope) throw new Error('書き出すセーブデータがありません。');
    return JSON.stringify(envelope, null, 2);
  }
  function importJson(json) {
    if (typeof json !== 'string' || json.length > MAX_IMPORT_BYTES) {
      throw new Error('セーブファイルが大きすぎるか、不正です。');
    }
    var data;
    try { data = validate(JSON.parse(json)); }
    catch (err) { throw new Error('読み込み失敗: ' + err.message); }
    // 検証を通過してから上書きする。既存データはエラー時に維持される。
    try { storage().setItem(KEY, JSON.stringify(data)); }
    catch (err) { throw new Error('読み込んだデータを保存できませんでした。'); }
    return clone(data.state);
  }
  root.SuisougakuSave = Object.freeze({
    createGame: createGame, load: load, save: save, clear: clear,
    hasSave: function () { return loadEnvelope() !== null; },
    exportJson: exportJson, importJson: importJson,
    info: function () {
      var e = loadEnvelope();
      return e ? {createdAt: e.createdAt, updatedAt: e.updatedAt,
        bandName: e.state.player.bandName, year: e.state.year,
        status: e.state.status} : null;
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
