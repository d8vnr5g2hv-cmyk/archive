// アーカイブカード — カードの形・効果・見た目・最初から入っているカード
// カード：{ id, name, who, dname（表示するキャラ名。空ならキャラの名前）, rar(1-5), frame, layout('normal'|'full'), veil(0-3), tcol, fx:[{k, v, n, t}],
//          art:{ kind:'photo'|'video'|'lobby'|'url', img(Blob), vid(Blob), src, poster, ar, x, y, s }, set（弾）, cab（筐体に入れる）, at }
// 持っているカード：{ id, cid（どのカードか）, kira, at }
'use strict';
const ACard = (() => {
  const RAR = {
    1:{ k:'N',   n:'ノーマル',     c:'#c9d3e8', w:50 },
    2:{ k:'R',   n:'レア',         c:'#5fb8ff', w:28 },
    3:{ k:'SR',  n:'スーパーレア', c:'#ffd76a', w:15 },
    4:{ k:'UR',  n:'ウルトラレア', c:'#ff7ad9', w:6 },
    5:{ k:'SEC', n:'シークレット', c:'#b9a4ff', w:1 },
  };
  const FRAME = { auto:'おまかせ', silver:'シルバー', blue:'ブルー', gold:'ゴールド', holo:'ホロ', black:'ブラック', pink:'ピンク', white:'ホワイト' };
  const FRAME_OF = { 1:'silver', 2:'blue', 3:'gold', 4:'holo', 5:'black' };
  const TCOL = { w:'白', gold:'金', char:'キャラ色', ink:'黒' };
  const TYPE = { atk:{ n:'ATTACK', c:'#ff5a6e' }, def:{ n:'GUARD', c:'#4aa8ff' }, sup:{ n:'SKILL', c:'#b48cff' }, heal:{ n:'HEAL', c:'#4fd69a' } };

  // ===== 効果（数字は自分で決める） p：[キー, ラベル, 最小, 最大, 刻み, 初期値] =====
  const FX = {
    dmg:   { n:'ダメージ',   p:[['v', '1回のダメージ', 1, 99, 1, 10], ['n', '回数', 1, 4, 1, 1]] },
    drain: { n:'吸収',       p:[['v', 'ダメージ（半分回復）', 1, 80, 1, 8]] },
    heal:  { n:'回復',       p:[['v', '回復量', 1, 60, 1, 10]] },
    guard: { n:'ガード',     p:[['v', 'ガード', 1, 60, 1, 10]] },
    atkup: { n:'攻撃アップ', p:[['v', '上がる割合（%）', 5, 100, 5, 30], ['t', 'ターン', 1, 3, 1, 2]] },
    weak:  { n:'弱体化',     p:[['v', '相手の攻撃ダウン（%）', 5, 75, 5, 30], ['t', 'ターン', 1, 3, 1, 2]] },
    poison:{ n:'毒',         p:[['v', '毎ターンのダメージ', 1, 30, 1, 5], ['t', 'ターン', 1, 3, 1, 3]] },
  };
  const KEYS = Object.keys(FX);
  function fxDefault(k) { const o = { k }; FX[k].p.forEach(([key, , , , , d]) => o[key] = d); return o; }
  function fxLine(f, mul = 1) {
    const d = v => Math.max(1, Math.round(v * mul));
    switch (f.k) {
      case 'dmg':    return `${d(f.v)}${f.n > 1 ? '×' + f.n : ''}ダメージ`;
      case 'drain':  return `${d(f.v)}ダメージ＋半分回復`;
      case 'heal':   return `HP${d(f.v)}回復`;
      case 'guard':  return `ガード${d(f.v)}`;
      case 'atkup':  return `攻撃+${f.v}%（${f.t}ターン）`;
      case 'weak':   return `相手の攻撃-${f.v}%（${f.t}ターン）`;
      case 'poison': return `毒${f.v}（${f.t}ターン）`;
    }
    return '';
  }
  const fxText = (fx, mul) => (fx || []).map(f => fxLine(f, mul)).join('、');
  function typeOf(c) {
    const ks = (c.fx || []).map(f => f.k);
    return ks.includes('dmg') || ks.includes('drain') || ks.includes('poison') ? 'atk' : ks.includes('heal') ? 'heal' : ks.includes('guard') ? 'def' : 'sup';
  }
  // 強さの目安：レア度ごとの「ちょうどいい」に対して何％か
  function score(c) {
    return (c.fx || []).reduce((a, f) => a + ({
      dmg:f.v * (f.n || 1), drain:f.v * 1.5, heal:f.v * 1.1, guard:f.v * .9,
      atkup:f.v / 100 * f.t * 16, weak:f.v / 100 * f.t * 18, poison:f.v * f.t * .8,
    }[f.k] || 0), 0);
  }
  const BUDGET = [12, 18, 26, 36, 48];
  function power(c) {
    const r = score(c) / BUDGET[(c.rar || 1) - 1];
    return { r, lab:r <= .8 ? '控えめ' : r <= 1.15 ? 'ちょうどいい' : r <= 1.5 ? '強め' : '強すぎ', lv:r <= .8 ? 0 : r <= 1.15 ? 1 : r <= 1.5 ? 2 : 3 };
  }

  // ===== 絵 =====
  const urls = new Map();
  function blobUrl(b) { if (!b) return ''; if (!urls.has(b)) urls.set(b, URL.createObjectURL(b)); return urls.get(b); }
  function poster(c) { const a = c.art || {}; return a.tmpUrl || (a.kind === 'photo' || a.kind === 'video' ? blobUrl(a.img) : a.poster || ''); }
  function videoSrc(c) { const a = c.art || {}; return a.kind === 'video' ? blobUrl(a.vid) : a.kind === 'lobby' ? a.src : ''; }
  const isLive = c => c.art && (c.art.kind === 'lobby' || c.art.kind === 'video');
  // 切り取りの位置（カードの幅＝1、高さ＝1.5）。s：拡大、x・y：中心のずれ
  function boxStyle(a) {
    if (!a || !a.ar || a.baked) return 'left:0;top:0;width:100%;height:100%';
    const s = a.s || 1, w = s * Math.max(1, a.ar * 1.5), hh = w / a.ar, hp = hh / 1.5;
    return `width:${(w * 100).toFixed(2)}%;height:${(hp * 100).toFixed(2)}%;left:${(50 + (a.x || 0) * 100 - w * 50).toFixed(2)}%;top:${(50 + (a.y || 0) * 100 - hp * 50).toFixed(2)}%`;
  }
  const whoName = c => c.dname || (CAST[c.who] || CAST.other).n;
  const frameOf = c => !c.frame || c.frame === 'auto' ? FRAME_OF[c.rar || 1] : c.frame;

  // ===== 1枚のHTML =====
  // opt：{ cls, live（動画を動かす）, still, kira, n（枚数）, id, no（通し番号） }
  function html(c, opt = {}) {
    const w = CAST[c.who] || CAST.other, t = TYPE[typeOf(c)], r = RAR[c.rar || 1], a = c.art || {};
    const live = opt.live && isLive(c), st = boxStyle(a);
    const media = !c.art ? '' : live
      ? `<img class="yc-m" src="${poster(c)}" alt="" style="${st}"><video class="yc-m yc-v" src="${videoSrc(c)}" muted playsinline loop autoplay preload="auto" style="${st}"></video>`
      : `<img class="yc-m" src="${poster(c)}" alt="" style="${st}">`;
    const full = c.layout === 'full';
    const cls = ['ycard', 'r' + (c.rar || 1), 'f-' + frameOf(c), 't-' + typeOf(c), 'tc-' + (c.tcol || 'w'), full ? 'full v' + (c.veil == null ? 2 : c.veil) : '', opt.kira ? 'kira' : '', opt.still ? 'still' : '', opt.cls || ''].filter(Boolean).join(' ');
    return `<div class="${cls}" data-id="${opt.id || c.id}" style="--tc:${t.c};--rc:${r.c};--cc:${w.c}">
      <div class="yc-in"><div class="yc-art ${a.kind === 'photo' || a.kind === 'url' ? 'kb' : 'mv'}">${media}</div>
        <div class="yc-shade"></div>${c.rar >= 3 ? '<i class="yc-foil"></i>' : ''}${opt.kira ? '<i class="yc-kira"></i><i class="yc-spark"></i>' : ''}<i class="yc-shine"></i>
        <div class="yc-rar"><b>${r.k}</b></div><div class="yc-type">${t.n}</div>
        <div class="yc-who"><i></i>${esc(whoName(c))}</div>
        <div class="yc-name">${esc(c.name || '名前のないカード')}</div>
        <div class="yc-text">${esc(fxText(c.fx)) || '<span class="yc-none">効果なし</span>'}</div>
        <div class="yc-foot"><span>${esc(c.set || 'ARCHIVE')}${opt.no ? ' · ' + opt.no : ''}</span><em>${r.k}</em></div>
        ${opt.n > 1 ? `<span class="yc-n">×${opt.n}</span>` : ''}${opt.kira ? '<span class="yc-kb">KIRA</span>' : ''}</div></div>`;
  }
  // 裏面
  const back = (cls = '') => `<div class="ycard yback ${cls}"><div class="yc-in"><i class="yb-ring"></i><i class="yb-ring b"></i><div class="yb-logo"><small>ARCHIVE</small><b>CARD</b><span>— KISAKI'S ARCADE —</span></div></div></div>`;
  // 手に入れていないカード（影だけ）
  const shadow = (c, cls = '') => `<div class="ycard yshadow r${c.rar || 1} ${cls}" style="--rc:${RAR[c.rar || 1].c}"><div class="yc-in"><b>?</b><small>${RAR[c.rar || 1].k}</small></div></div>`;

  // 指で傾けると光る
  function tilt(el) {
    const mv = e => { const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      el.style.transform = `perspective(900px) rotateY(${x * 22}deg) rotateX(${-y * 22}deg)`; el.style.setProperty('--mx', (x + .5) * 100 + '%'); el.style.setProperty('--my', (y + .5) * 100 + '%'); };
    const lv = () => { el.style.transform = ''; };
    el.addEventListener('pointermove', mv); el.addEventListener('pointerleave', lv); el.addEventListener('pointerup', lv);
  }
  document.addEventListener('playing', e => { const v = e.target; if (v.classList && v.classList.contains('yc-v')) v.classList.add('on'); }, true);

  // ===== 保存 =====
  const all = () => DB.all('cards');
  const owned = () => DB.all('owned');
  async function give(cid, kira) { const rec = { id:'o' + newId(), cid, kira:!!kira, at:Date.now() }; await DB.put('owned', rec); return rec; }

  // ===== ベーシック（だれでも使える3枚。スキャンでいつでも選べる） =====
  const U = f => ({ kind:'url', poster:A(f), ar:2 / 3, x:0, y:0, s:1 });
  const BASIC = [
    { id:'b_atk',  name:'踏み込み', who:'other', dname:'耀平', rar:1, layout:'normal', tcol:'w', fx:[{ k:'dmg', v:12, n:1 }], art:U('hl_g_atk.webp'), set:'BASIC', basic:true },
    { id:'b_def',  name:'身構える', who:'other', dname:'耀平', rar:1, layout:'normal', tcol:'w', fx:[{ k:'guard', v:10 }, { k:'dmg', v:5, n:1 }], art:U('hl_g_def.webp'), set:'BASIC', basic:true },
    { id:'b_heal', name:'深呼吸',   who:'other', dname:'耀平', rar:1, layout:'normal', tcol:'w', fx:[{ k:'heal', v:12 }], art:U('hl_g_heal.webp'), set:'BASIC', basic:true },
  ];
  // 初めて開いたとき：300円だけ（筐体の中身は自分で作る）
  async function seed() {
    // 前の版で最初から入れていたカード（id が s0〜s23）と、そのスターター分を一度だけ消す
    if (!LS.get('cleanV2')) {
      const old = (await all()).filter(c => /^s\d+$/.test(c.id)), ids = new Set(old.map(c => c.id));
      for (const c of old) await DB.del('cards', c.id);
      for (const o of await owned()) if (ids.has(o.cid)) await DB.del('owned', o.id);
      LS.set('newCids', LS.get('newCids', []).filter(id => !ids.has(id)));
      LS.set('cleanV2', 1);
    }
    if (LS.get('seeded')) return;
    Wallet.add(300); LS.set('seeded', 1);
  }

  return { RAR, FRAME, TCOL, TYPE, FX, KEYS, fxDefault, fxLine, fxText, typeOf, power, BUDGET, blobUrl, poster, videoSrc, isLive, boxStyle, whoName,
    html, back, shadow, tilt, all, owned, give, seed, BASIC };
})();
