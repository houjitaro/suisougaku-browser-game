/* BrowserGameCore v1 — 既存Code.gsから新人募集とイベント抽選を段階移植。
 * 第5段階では BrowserUiBridge.js を介して元のGameStart画面に接続。stateの変更は呼び出し側でSuisougakuSave.save(state)する。
 * 元の抽選確率・Rating加算を維持。1年度の重複抽選は拒否。
 */
(function(root){
'use strict';
function getManagerMaster() {
  return {
    MGR01: {
      id: 'MGR01',
      name: '新米マネージャー',
      animal: '黒猫',
      trait: '必死の勧誘',
      description: '毎年の新入団員が3人以上になる。',
      initialRating: 40,
      playStyle: '団員数重視'
    },
    MGR02: {
      id: 'MGR02',
      name: '敏腕マネージャー',
      animal: 'キリン',
      trait: '盤石の運営',
      description: '高いRatingからゲームを開始する。',
      initialRating: 45,
      playStyle: '安定重視'
    },
    MGR03: {
      id: 'MGR03',
      name: '謎のマネージャー',
      animal: 'タヌキ',
      trait: '謎の人脈',
      description: 'SR以上の新入団員が出やすくなる。',
      initialRating: 40,
      playStyle: 'レア新人重視'
    }
  };
}
function pickByProbability(items) {

  const totalWeight =
    items.reduce(
      (sum, item) =>
        sum + item.weight,
      0
    );

  let random =
    Math.random() * totalWeight;

  for (const item of items) {

    if (random < item.weight) {
      return item.value;
    }

    random -= item.weight;
  }

  return items[
    items.length - 1
  ].value;
}
function generateMemberTitle(instrument, activity, rarity) {

  const basicTitles = {
    '熱心': [
      '熱心な',
      '努力家の',
      '練習熱心な',
      '負けず嫌いの',
      '研究熱心な',
      '朝練大好きな'
    ],
    '普通': [
      '普通の',
      '堅実な',
      'マイペースな',
      '穏やかな',
      '縁の下の力持ちの',
      '職人気質の'
    ],
    '気まぐれ': [
      '気まぐれな',
      '自由奔放な',
      'ムラっ気のある',
      '本番だけ強い',
      '天才肌の',
      'ノリで参加する'
    ],
    '幽霊団員': [
      '幽霊団員の',
      '神出鬼没の',
      'たまに現れる',
      '本番にだけ来る',
      '消息不明の',
      '幻の'
    ]
  };

  const instrumentTitles = {
    'フルート': [
      'ブレスの場所を見失った',
      '高音域を駆け回る',
      'ピッコロも吹かされる'
    ],
    'オーボエ': [
      'リードを育てる',
      'いつもリードを削っている',
      'チューニングを任された'
    ],
    'ファゴット': [
      'リード職人の',
      '低音で暗躍する',
      'いつも人数が足りない'
    ],
    'クラリネット': [
      '譜読みが異常に速い',
      '指が回りすぎる',
      'クラリネット軍団の'
    ],
    'サックス': [
      'リード沼にはまった',
      'ソロを狙っている',
      'ジャズもやりたい'
    ],
    'トランペット': [
      'ハイトーンに取り憑かれた',
      '音量で勝負する',
      '目立ちたがりの'
    ],
    'ホルン': [
      'チューナーを信じない',
      '裏打ち職人の',
      '音を外しても顔に出さない'
    ],
    'トロンボーン': [
      '音量で解決する',
      'グリッサンドしたがる',
      'スライドがよく当たる'
    ],
    'ユーフォニアム': [
      '存在感がありすぎる',
      '美しい旋律を狙う',
      '低音なのに歌いたがる'
    ],
    'チューバ': [
      'ロングトーン命の',
      '低音で大地を揺らす',
      '楽団を底から支える'
    ],
    'コントラバス': [
      '低音を支配する',
      '弓とピチカートを使い分ける',
      'ひとりだけ弦楽器の'
    ],
    'パーカッション': [
      '休符を数え続ける',
      '楽器移動で走り回る',
      '何でも叩きたがる'
    ]
  };

  const rareTitles = [
    '伝説の',
    '覚醒した',
    '百戦錬磨の',
    '謎の',
    '奇跡の',
    '選ばれし',
    '野生の',
    '楽団の主',
    '音楽に愛された',
    '次元の違う',
    '歴戦の',
    '神に選ばれし'
  ];

  // カードレアリティが高いほど、珍しい肩書が出やすくなる。
  // Nでもごく稀に激レア肩書は出現する。
  const titleWeightsByRarity = {
    N:   { basic: 85, instrument: 14, rare: 1 },
    R:   { basic: 75, instrument: 23, rare: 2 },
    SR:  { basic: 45, instrument: 50, rare: 5 },
    SSR: { basic: 15, instrument: 70, rare: 15 },
    UR:  { basic: 0,  instrument: 60, rare: 40 }
  };

  const titleWeights =
    titleWeightsByRarity[rarity] ||
    titleWeightsByRarity.N;

  const category = pickByProbability([
    { value: 'basic', weight: titleWeights.basic },
    { value: 'instrument', weight: titleWeights.instrument },
    { value: 'rare', weight: titleWeights.rare }
  ]);

  let candidates = [];
  let titleType = category;

  if (category === 'rare') {
    candidates = rareTitles;
  } else if (category === 'instrument') {
    candidates = instrumentTitles[instrument] || [];
    if (candidates.length === 0) {
      titleType = 'basic';
      candidates = basicTitles[activity] || ['普通の'];
    }
  } else {
    candidates = basicTitles[activity] || ['普通の'];
  }

  const title =
    candidates[
      Math.floor(Math.random() * candidates.length)
    ];

  return {
    title: title,
    titleType: titleType
  };
}
function ensureYearHistory(state, year) {
  var h = state.history.find(function(x){return x.year === year;});
  if (!h) {
    h = {year:year, newMembers:0, bandEvent:'', branchResult:'', nationalResult:''};
    state.history.push(h);
    state.history.sort(function(a,b){return a.year-b.year;});
  }
  return h;
}
function requireGame(state) {
  if (!state || !state.player || !Array.isArray(state.members) || !Array.isArray(state.history) ||
      !Number.isInteger(state.year) || state.year < 1 || state.year > 5 || state.status !== 'in_progress') {
    throw new Error('有効なプレイ中データがありません。');
  }
}
function selectManager(state, managerId) {
  requireGame(state);
  if (state.members.length || state.history.length) throw new Error('ゲーム開始後はマネージャーを変更できません。');
  var manager = getManagerMaster()[String(managerId || '').trim()];
  if (!manager) throw new Error('マネージャーを選択してください。');
  state.player.managerId = manager.id;
  state.player.rating = manager.initialRating;
  state.scene = 'manager_confirm';
  return manager;
}
function drawNewMembers(state) {

  const manager = getManagerMaster()[state.player.managerId];

  // 年間加入人数
  // 通常：最低2人
  // 黒猫（MGR01）：《必死の勧誘》により最低3人
  const memberCount =
    manager && manager.id === 'MGR01'
      ? pickByProbability([
          { value: 3, weight: 65 },
          { value: 4, weight: 15 },
          { value: 5, weight: 10 },
          { value: 6, weight: 10 }
        ])
      : pickByProbability([
          { value: 2, weight: 35 },
          { value: 3, weight: 30 },
          { value: 4, weight: 20 },
          { value: 5, weight: 10 },
          { value: 6, weight: 5 }
        ]);

  const members = [];

  for (let i = 0; i < memberCount; i++) {

    const instrument = pickByProbability([
      { value: 'フルート', weight: 10 },
      { value: 'オーボエ', weight: 3 },
      { value: 'ファゴット', weight: 2 },
      { value: 'クラリネット', weight: 19 },
      { value: 'サックス', weight: 11 },

      { value: 'トランペット', weight: 13 },
      { value: 'ホルン', weight: 10 },
      { value: 'トロンボーン', weight: 10 },
      { value: 'ユーフォニアム', weight: 6 },
      { value: 'チューバ', weight: 5 },

      { value: 'コントラバス', weight: 2 },
      { value: 'パーカッション', weight: 9 }
    ]);

    // 新人レアリティ
    // 通常：N55 / R28 / SR12 / SSR4 / UR1
    // タヌキ（MGR03）：N45 / R30 / SR17 / SSR6 / UR2
    const rarityWeights =
      manager && manager.id === 'MGR03'
        ? { N: 45, R: 30, SR: 17, SSR: 6, UR: 2 }
        : { N: 55, R: 28, SR: 12, SSR: 4, UR: 1 };

    const ability = pickByProbability([
      {
        value: { rarity: 'N', power: 0.5 },
        weight: rarityWeights.N
      },
      {
        value: { rarity: 'R', power: 1.2 },
        weight: rarityWeights.R
      },
      {
        value: { rarity: 'SR', power: 2.5 },
        weight: rarityWeights.SR
      },
      {
        value: { rarity: 'SSR', power: 4.0 },
        weight: rarityWeights.SSR
      },
      {
        value: { rarity: 'UR', power: 6.0 },
        weight: rarityWeights.UR
      }
    ]);

    const activity = pickByProbability([
      {
        value: {
          type: '熱心',
          multiplier: 1.2
        },
        weight: 25
      },
      {
        value: {
          type: '普通',
          multiplier: 1.0
        },
        weight: 50
      },
      {
        value: {
          type: '気まぐれ',
          multiplier: 0.6
        },
        weight: 20
      },
      {
        value: {
          type: '幽霊団員',
          multiplier: 0.2
        },
        weight: 5
      }
    ]);

    const effectivePower =
      ability.power *
      activity.multiplier;

    const memberTitle =
      generateMemberTitle(
        instrument,
        activity.type,
        ability.rarity
      );

    members.push({
  instrument: instrument,
  rarity: ability.rarity,

  // 01～12のカード絵柄をランダム決定
  // 能力には影響せず、画像の違いだけを表す
  cardVariant:
    Math.floor(Math.random() * 12) + 1,

  activity: activity.type,

  // カード表示用肩書
  title: memberTitle.title,
  titleType: memberTitle.titleType,

  basePower: ability.power,

  effectivePower:
    Math.round(
      effectivePower * 100
    ) / 100
});
  }

    // ========================================
  // 新入団員の戦力合計
  // ========================================

  const totalPower =
    members.reduce(
      (sum, member) =>
        sum + member.effectivePower,
      0
    );
  const currentRating = Number(state.player.rating);
  if (!Number.isFinite(currentRating)) throw new Error('Ratingが不正です。');
  const newRating = Math.round((currentRating + totalPower) * 100) / 100;
  const currentYear = state.year;
  const existingCount = state.members.length;
  const activityMultiplierMap = {'熱心':1.2, '普通':1.0, '気まぐれ':0.6, '幽霊団員':0.2};
  members.forEach(function(member, index) {
    state.members.push(Object.assign({
      year: currentYear,
      memberId: 'M' + String(existingCount + index + 1).padStart(3, '0'),
      activityMultiplier: activityMultiplierMap[member.activity] || 1
    }, member));
  });
  state.player.rating = newRating;
  const h = ensureYearHistory(state, currentYear);
  h.newMembers = memberCount;
  state.scene = 'new_members';
  return {
    year: currentYear,
    bandName: state.player.bandName,
    memberCount: memberCount,
    members: members,
    totalPower: Math.round(totalPower * 100) / 100,
    ratingBefore: currentRating,
    ratingAfter: newRating
  };
}
function recruitNewMembers(state) {
  requireGame(state);
  if (!getManagerMaster()[state.player.managerId]) throw new Error('マネージャーが未選択です。');
  if (state.history.some(function(h){return h.year === state.year && h.newMembers > 0;})) {
    throw new Error('この年度の新入団員募集は完了しています。');
  }
  return drawNewMembers(state);
}
function drawBandEvent(state) {
  requireGame(state);
  const h = ensureYearHistory(state, state.year);
  if (h.bandEvent) throw new Error('この年度のイベント抽選は完了しています。');
  const flags = state.player.eventFlags || (state.player.eventFlags = {});
  const events = [
    {id:'none', weight:35, title:'特に大きな変化はありませんでした', ratingBonus:0},
  ];
  if (!flags.percussion) events.push({id:'percussion', weight:12, title:'打楽器問題が解決！', ratingBonus:2});
  if (!flags.practice_place) events.push({id:'practice_place', weight:12, title:'練習場所の安定確保！', ratingBonus:2});
  if (!flags.recruiting) events.push({id:'recruiting', weight:10, title:'団員募集が軌道に乗った！', ratingBonus:1});
  if (!flags.finance) events.push({id:'finance', weight:10, title:'財政状況が改善！', ratingBonus:1});
  if (!flags.sectional) events.push({id:'sectional', weight:8, title:'パート練習が定着！', ratingBonus:2});
  if (!flags.concert) events.push({id:'concert', weight:8, title:'定期演奏会が成功！', ratingBonus:2});
  if (!flags.instructor) events.push({id:'instructor', weight:5, title:'優秀な指導者が登場！', ratingBonus:4});
  const selected = pickByProbability(events.map(function(e){return {value:e,weight:e.weight};}));
  if (selected.id !== 'none') flags[selected.id] = true;
  const ratingBefore = Number(state.player.rating);
  const ratingAfter = Math.round((ratingBefore + selected.ratingBonus)*100)/100;
  state.player.rating = ratingAfter;
  h.bandEvent = selected.title;
  state.scene = 'band_event';
  return {id:selected.id, title:selected.title, ratingBonus:selected.ratingBonus,
          ratingBefore:ratingBefore, ratingAfter:ratingAfter};
}
root.SuisougakuGameCore = Object.freeze({
  managers: function(){return ['MGR01','MGR02','MGR03'].map(function(id){return getManagerMaster()[id];});},
  selectManager: selectManager,
  recruitNewMembers: recruitNewMembers,
  drawBandEvent: drawBandEvent
});
})(typeof window !== 'undefined' ? window : globalThis);
