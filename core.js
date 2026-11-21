// アーカイブカード — 共通（道具・保存・音・お金・キサキ）
'use strict';

// ===== 素材の場所 =====
// 絵や音は Yohei Support（同じ github.io の kanifavofa-y）から直接読む。美愛など新しい絵はこのリポジトリ直下に置く
const SUP = '../kanifavofa-y/';
const A = f => SUP + f;

// ===== 道具 =====
const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
const h = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const rnd = (a, b) => a + Math.random() * (b - a);
const pickOne = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const LS = {
  get:(k, d = null) => { try { const v = localStorage.getItem('ac-' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set:(k, v) => { try { localStorage.setItem('ac-' + k, JSON.stringify(v)); } catch (e) {} },
};
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
function haptic(ms = 8) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }

// ===== 保存（端末の中：IndexedDB）=====
// cards：カードの設計図／owned：手に入れたカード1枚ずつ／photos：追加した写真
const DB = (() => {
  let p = null;
  function open() {
    if (p) return p;
    p = new Promise((ok, ng) => {
      const r = indexedDB.open('archive-card', 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('cards')) d.createObjectStore('cards', { keyPath:'id' });
        if (!d.objectStoreNames.contains('owned')) d.createObjectStore('owned', { keyPath:'id' });
        if (!d.objectStoreNames.contains('photos')) d.createObjectStore('photos', { keyPath:'id' });
      };
      r.onsuccess = () => ok(r.result); r.onerror = () => ng(r.error);
    });
    return p;
  }
  const tx = async (s, mode, fn) => { const d = await open(); return new Promise((ok, ng) => { const t = d.transaction(s, mode), q = fn(t.objectStore(s)); t.oncomplete = () => ok(q && q.result); t.onerror = () => ng(t.error); }); };
  return {
    all:s => tx(s, 'readonly', o => o.getAll()).then(r => r || []),
    get:(s, id) => tx(s, 'readonly', o => o.get(id)),
    put:(s, v) => tx(s, 'readwrite', o => o.put(v)),
    del:(s, id) => tx(s, 'readwrite', o => o.delete(id)),
  };
})();

// ===== 音 =====
const ctx = new (window.AudioContext || window.webkitAudioContext)();
const Sfx = (() => {
  let out = null, verb = null; const last = {};
  function bus() {
    if (out) return out;
    out = ctx.createGain(); out.gain.value = .9; out.connect(ctx.destination);
    verb = ctx.createConvolver();
    const len = ctx.sampleRate * .9, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    verb.buffer = ir; const wet = ctx.createGain(); wet.gain.value = .22; verb.connect(wet); wet.connect(out);
    return out;
  }
  function bell(f, at, dur, vol, bright = 1, type = 'sine') {
    const t = ctx.currentTime + at, o = bus();
    [[1, 1], [2.01, .32 * bright], [3.98, .12 * bright], [.5, .18]].forEach(([m, a]) => {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = type; osc.frequency.setValueAtTime(f * m, t);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * a, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + dur * (m > 1 ? .55 : 1));
      osc.connect(g); g.connect(o); g.connect(verb); osc.start(t); osc.stop(t + dur + .05);
    });
  }
  function noise(at, dur, vol, f0, f1, q = 1.2) {
    const t = ctx.currentTime + at, b = ctx.createBuffer(1, Math.max(1, ctx.sampleRate * dur), ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = b; bp.type = 'bandpass'; bp.Q.value = q; bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * .25); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(bp); bp.connect(g); g.connect(bus()); g.connect(verb); s.start(t); s.stop(t + dur);
  }
  function sweep(at, dur, f0, f1, vol, type = 'sawtooth') {
    const t = ctx.currentTime + at, osc = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    osc.type = type; osc.frequency.setValueAtTime(f0, t); osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    lp.type = 'lowpass'; lp.frequency.value = 2600;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    osc.connect(lp); lp.connect(g); g.connect(bus()); osc.start(t); osc.stop(t + dur + .05);
  }
  const P = {
    tap:() => { bell(1760, 0, .09, .06, .4); noise(0, .03, .05, 3500, 2500, 3); },
    ok:() => { bell(1046.5, 0, .5, .09); bell(1568, .07, .6, .08); },
    cancel:() => { bell(880, 0, .25, .06, .5); bell(659, .06, .3, .05, .5); },
    done:() => { [1046.5, 1318.5, 1568, 2093].forEach((f, i) => bell(f, i * .06, .7, .07)); },
    coin:() => { bell(1975, 0, .25, .08, 1.4); bell(2637, .07, .5, .08, 1.4); noise(.12, .18, .05, 900, 300, 2); },
    drop:() => { noise(0, .25, .07, 500, 160, 2); bell(330, .05, .2, .05, .3); },
    page:() => noise(0, .18, .035, 900, 2600, 1.5),
    pop:() => { bell(1320, 0, .14, .07, .6); bell(1980, .05, .2, .05, .6); },
    scan:() => { sweep(0, .35, 400, 2400, .05, 'square'); bell(2093, .32, .3, .06); },
    charge:() => { sweep(0, 1.1, 120, 1600, .06); noise(0, 1.1, .04, 300, 5000, .8); },
    flash:() => { noise(0, .6, .12, 6000, 800, .6); bell(2093, 0, 1.2, .08, 1.5); bell(2637, .05, 1.2, .07, 1.5); },
    rare:() => { [784, 988, 1175, 1568, 1976, 2349].forEach((f, i) => bell(f, i * .07, 1.1, .07, 1.2)); },
    hit:() => { noise(0, .14, .14, 1800, 300, 1); sweep(0, .12, 300, 80, .07, 'square'); },
    big:() => { noise(0, .4, .16, 2400, 120, .7); sweep(0, .35, 500, 50, .09, 'sawtooth'); },
    heal:() => { [1318, 1568, 2093].forEach((f, i) => bell(f, i * .08, .6, .05, .5)); },
    guard:() => { bell(523, 0, .4, .07, 1.8, 'triangle'); noise(0, .1, .06, 3000, 1500, 4); },
    hurt:() => { sweep(0, .25, 240, 90, .08, 'square'); noise(0, .2, .08, 900, 200, 1); },
    tick:() => bell(2400, 0, .05, .03, .2),
    miss:() => { bell(330, 0, .25, .06, .3, 'triangle'); },
    perfect:() => { bell(1568, 0, .4, .08, 1.3); bell(2093, .06, .5, .08, 1.3); bell(3136, .12, .6, .05, 1.3); },
    eject:() => { noise(0, .9, .05, 200, 900, 3); for (let i = 0; i < 6; i++) noise(i * .12, .05, .05, 2500, 2000, 6); },
    get:() => { [523, 659, 784, 1046, 1318, 1568, 2093].forEach((f, i) => bell(f, i * .06, .9, .07, 1)); },
    flip:() => { noise(0, .2, .07, 1200, 4000, 2); },
    kira:() => { for (let i = 0; i < 8; i++) bell(2093 + i * 220, i * .05, .5, .04, 1.6); },
    pay:() => { [1568, 2093, 2637].forEach((f, i) => bell(f, i * .05, .4, .06, 1.4)); },
  };
  function play(k) {
    try {
      if (ctx.state !== 'running') ctx.resume();
      const now = performance.now(); if (last[k] && now - last[k] < 60) return; last[k] = now;
      (P[k] || P.tap)();
    } catch (e) {}
  }
  return { play };
})();

// BGM：タブごとに曲を切り替える（ふわっと入れ替え）
const Bgm = (() => {
  const SONG = { cab:'kisaki_bgm.mp3', make:'bgm_profile.mp3', job:'cafe_bgm.mp3', battle:'ops_lounge_bgm.mp3', title:'bgm_title.mp3' };
  let cur = null, curK = '', on = LS.get('bgm', true);
  function fade(a, to, ms) { const from = a.volume, t0 = performance.now(); return new Promise(r => { const f = () => { const k = Math.min(1, (performance.now() - t0) / ms); a.volume = from + (to - from) * k; k < 1 ? requestAnimationFrame(f) : r(); }; f(); }); }
  async function play(k) {
    if (k === curK) return; curK = k;
    const old = cur; cur = null;
    if (old) fade(old, 0, 500).then(() => old.pause());
    if (!on || !SONG[k]) return;
    const a = new Audio(A(SONG[k])); a.loop = true; a.volume = 0; cur = a;
    try { await a.play(); fade(a, .45, 900); } catch (e) {}
  }
  function toggle() { on = !on; LS.set('bgm', on); const k = curK; curK = ''; if (!on && cur) { cur.pause(); cur = null; } else play(k); return on; }
  function duck(v) { if (cur) fade(cur, v ? .12 : .45, 300); }
  return { play, toggle, duck, get on() { return on; } };
})();

// ===== 通知・確認 =====
function toast(msg, ms = 1900) {
  const t = h(`<div class="toast">${esc(msg)}</div>`); document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('on'));
  setTimeout(() => { t.classList.remove('on'); setTimeout(() => t.remove(), 300); }, ms);
}
function Ask(msg, opt = {}) {
  return new Promise(ok => {
    const el = h(`<div class="ask"><div class="ask-box"><p>${esc(msg).replace(/\n/g, '<br>')}</p><div><button data-v="0">${esc(opt.no || 'やめる')}</button><button data-v="1" class="${opt.danger ? 'danger' : 'go'}">${esc(opt.ok || 'OK')}</button></div></div></div>`);
    document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('on'));
    el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; Sfx.play(b.dataset.v === '1' ? 'ok' : 'cancel'); el.classList.remove('on'); setTimeout(() => el.remove(), 250); ok(b.dataset.v === '1'); });
  });
}

// ===== お金（円）とシフト =====
const Wallet = (() => {
  let yen = LS.get('yen', 0);
  const listeners = [];
  function paint() { listeners.forEach(f => f(yen)); }
  function add(n) { yen = Math.max(0, yen + n); LS.set('yen', yen); paint(); }
  function pay(n) { if (yen < n) return false; add(-n); return true; }
  function onChange(f) { listeners.push(f); f(yen); }
  return { add, pay, onChange, get yen() { return yen; } };
})();
const Day = (() => {
  // 1日1回：シフトの回数を戻す／ログインのおこづかい
  const SHIFTS = 5, BONUS = 100;
  function check() {
    const d = today(), s = LS.get('day', {});
    if (s.d === d) return null;
    LS.set('day', { d, shifts:SHIFTS, plays:0 });
    return s.d ? BONUS : null;   // 初日はスターターのお金があるので、おこづかいなし
  }
  const get = () => LS.get('day', { d:today(), shifts:SHIFTS, plays:0 });
  function useShift() { const s = get(); if (s.shifts <= 0) return false; s.shifts--; LS.set('day', s); return true; }
  function countPlay() { const s = get(); s.plays = (s.plays || 0) + 1; LS.set('day', s); }
  return { check, get, useShift, countPlay, SHIFTS, BONUS };
})();

// ===== キャラ =====
// 美愛（みあ）の絵はこのリポジトリ直下に置く：mia_av.webp（丸アイコン）／mia_chibi.webp（ちびキャラ・透過）／mia_stand.webp（立ち絵・透過）／mia_card.webp（カード用 2:3）
const CAST = {
  hoshino:{ n:'ホシノ', full:'小鳥遊ホシノ', c:'#ffb0c8' },
  mika:   { n:'ミカ',   full:'聖園ミカ',   c:'#ffc8ef' },
  hina:   { n:'ヒナ',   full:'空崎ヒナ',   c:'#d9c8ff' },
  miyako: { n:'ミヤコ', full:'月雪ミヤコ', c:'#cfe3ff' },
  mari:   { n:'マリー', full:'伊落マリー', c:'#ffe0a8' },
  yuuka:  { n:'ユウカ', full:'早瀬ユウカ', c:'#7aa8ff' },
  kisaki: { n:'キサキ', full:'竜華キサキ', c:'#9fd7c0' },
  noa:    { n:'乃亜',   full:'乃亜',       c:'#ff9ad5' },
  mia:    { n:'美愛',   full:'白峰美愛',   c:'#c9a8ff', own:true },
  other:  { n:'ゲスト', full:'ゲスト',     c:'#c9d3e8' },
};
const CAST_ORDER = ['hoshino', 'mika', 'hina', 'miyako', 'mari', 'yuuka', 'kisaki', 'noa', 'mia', 'other'];
const Cast = {
  av:k => k === 'other' ? A('icon-192.png') : CAST[k] && CAST[k].own ? `${k}_av.webp` : A(`av_${k}.webp`),
  chibi:k => CAST[k] && CAST[k].own ? `${k}_chibi.webp` : A(`${k}_chibi.webp`),
  stand:k => CAST[k] && CAST[k].own ? `${k}_stand.webp` : A(`o_${k}_stand.webp`),
};
// 絵がまだないとき（美愛など）は、頭文字の丸に差し替える
document.addEventListener('error', e => {
  const im = e.target; if (!(im instanceof HTMLImageElement) || im.dataset.fb === 'done') return;
  const who = im.dataset.who; if (!who) return;
  im.dataset.fb = 'done';
  const c = CAST[who] || CAST.other, ch = c.n.slice(0, 1);
  im.src = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="${c.c}"/></linearGradient></defs><circle cx="50" cy="50" r="48" fill="url(#g)"/><text x="50" y="66" font-size="46" text-anchor="middle" font-family="sans-serif" font-weight="900" fill="#3a2a55">${ch}</text></svg>`);
  im.classList.add('fb');
}, true);
const avImg = (k, cls = '') => `<img class="${cls}" src="${Cast.av(k)}" data-who="${k}" alt="">`;

// ===== キサキ（店番・ナビ） =====
const Kisaki = (() => {
  const L = {
    idle:['いらっしゃい。今日も一枚、持って帰るといい', '筐体の中身は、すべて耀平が作ったカードだ', '100円で1プレイ。迷うより、入れてみることだ', 'レアの光は、見逃すな', 'ふむ……今日の筐体は、なにか良い予感がする'],
    poor:['お金が足りないな。アルバイトで稼いでくるといい', '財布が軽いぞ。シフトに入ってきたらどうだ'],
    coin:['よし。カードをスキャンして、仲間を選べ', '相棒を3枚まで選べる。よく考えるといい'],
    r1:['来たな。落ち着いて挑め'], r2:['青い光……悪くない'], r3:['金色だ。これは当たりかもしれん'],
    r4:['虹色……！？ 耀平、気を抜くな'], r5:['……この気配。まさか、シークレットか'],
    get:['手に入れたな。大事にするといい', 'いい一枚だ', 'バインダーに入れておこう'],
    kira:['キラだ……！ 運がいいな、耀平'],
    neu:['新しいカードだ。おめでとう'],
    bonus:n => [`今日のおこづかいだ。${n}円、受け取るといい`],
  };
  function line(k, ...a) { const v = L[k]; return typeof v === 'function' ? pickOne(v(...a)) : pickOne(v || L.idle); }
  return { line, L };
})();
