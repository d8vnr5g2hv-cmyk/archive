// アーカイブカード — カードを作る（作業台）
'use strict';
const Maker = (() => {
  // Supportにある絵（メモロビ動画・カード絵）
  const LOBBY = [['16_mika_night', 'mika'], ['mika', 'mika'], ['09_aquarium', 'hoshino'], ['lobby', 'hoshino'], ['hina', 'hina'], ['08_rest', 'hina'], ['miyako', 'miyako'],
    ['mari', 'mari'], ['07_staff', 'mari'], ['10_office', 'yuuka'], ['06_christmas', 'other'], ['11_kitchen', 'other'], ['12_conductor', 'other'], ['13_drive', 'other'], ['14_sofa', 'other'], ['15_bedtime', 'other']];
  const ARTS = (() => {
    const o = [];
    ['hoshino', 'mika', 'hina', 'miyako', 'yuuka', 'kisaki'].forEach(w => ['atk', 'bar', 'bar_evo', 'ex', 'exa', 'exa_evo', 'spd'].forEach(k => o.push([`bt_c_${w}_${k}.webp`, w, 2 / 3])));
    ['atk', 'buf', 'ex', 'exh', 'exh_evo', 'heal', 'heal_evo'].forEach(k => o.push([`bt_c_mari_${k}.webp`, 'mari', 2 / 3]));
    ['noa', 'hoshino', 'mika', 'hina', 'miyako', 'mari', 'yuuka', 'kisaki'].forEach(w => ['n', 's'].forEach(k => o.push([`nc_${w}_${k}.webp`, w, 2 / 3])));
    return o;
  })();

  let root = null, c = null, draft = null, edit = false, src = 'photo', busy = false;
  const fresh = () => ({ id:'c' + newId(), name:'', who:LS.get('lastWho', 'mika'), dname:'', rar:1, frame:'auto', layout:'normal', veil:2, tcol:'w', fx:[ACard.fxDefault('dmg')], art:null, set:LS.get('lastSet', '第1弾'), cab:true, at:Date.now() });
  const clone = o => Object.assign({}, o, { fx:(o.fx || []).map(f => Object.assign({}, f)), art:o.art ? Object.assign({}, o.art) : null });

  // ===== 画面 =====
  function mount(box, card) {
    edit = !!card; c = card ? clone(card) : (draft || (draft = fresh()));
    box.innerHTML = `<div class="scroll mk">
      <div class="mk-stage"><div class="mk-pv" id="mkPv"></div>
        <div class="mk-side"><p class="mk-hint" id="mkHint"></p>
          <button class="btn sub mk-sbtn" data-a="preview">排出演出を見る</button>
          <button class="btn mk-sbtn" data-a="save">${edit ? '直して保存' : '保存する'}</button></div></div>
      <div class="h4">絵<small>カードの上で指で動かす・2本指で拡大</small></div><div class="chips mk-src" id="mkSrc"></div><div class="mk-pick" id="mkPick"></div>
      <div class="h4">だれのカード</div><div class="chips" id="mkWho"></div>
      <div class="h4">カードに出すキャラ名<small>空ならそのまま</small></div><input class="in" id="mkDname" maxlength="14" autocomplete="off"><div class="chips mk-sub" id="mkDq"></div>
      <div class="h4">カード名</div><input class="in" id="mkName" maxlength="16" placeholder="例：放課後の約束" autocomplete="off">
      <div class="h4">レア度<small>出やすさもレア度で変わります</small></div><div class="chips" id="mkRar"></div>
      <div class="h4">枠</div><div class="chips" id="mkFrame"></div>
      <div class="h4">見た目</div><div class="chips" id="mkLay"></div><div class="chips mk-sub" id="mkVeil"></div>
      <div class="h4">文字の色</div><div class="chips" id="mkTcol"></div>
      <div class="h4">効果1</div><div id="mkFx0"></div>
      <div class="h4">効果2<small>なくてもOK</small></div><div id="mkFx1"></div>
      <div class="h4">強さの目安</div><div class="mk-pow" id="mkPow"></div>
      <div class="h4">弾<small>筐体に入れるまとまり</small></div><input class="in" id="mkSet" maxlength="12" autocomplete="off"><div class="chips mk-sub" id="mkSets"></div>
      <button class="mk-tg ${c.cab ? 'on' : ''}" data-a="cab"><i></i>筐体に入れる（ONにすると、1プレイで出てくるようになります）</button>
      ${edit ? '<button class="mk-del" data-a="del">このカードを削除する</button><button class="btn sub mk-back" data-a="back">直すのをやめる</button>' : ''}
    </div>`;
    root = box.firstElementChild;
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    $('mkName').value = c.name || ''; $('mkDname').value = c.dname || ''; $('mkSet').value = c.set || '';
    $('mkDname').placeholder = (CAST[c.who] || CAST.other).n;
    $('mkName').addEventListener('input', () => { c.name = $('mkName').value.trim(); paintCard(false); });
    $('mkDname').addEventListener('input', () => { c.dname = $('mkDname').value.trim(); paintCard(false); });
    $('mkSet').addEventListener('input', () => { c.set = $('mkSet').value.trim(); paintCard(false); });
    src = c.art ? ({ photo:'photo', lobby:'lobby', video:'video', url:'art' }[c.art.kind] || 'photo') : 'photo';
    if (edit && c.art && c.art.kind === 'photo') reopenPhoto();
    paintAll(); bindCrop();
  }
  // 保存済みの写真カードを直すとき：元の写真で位置を決めなおす
  async function reopenPhoto() {
    const p = c.art.from ? await DB.get('photos', c.art.from).catch(() => null) : null;
    if (p) { c.art = Object.assign({}, c.art, { tmpUrl:ACard.blobUrl(p.blob), baked:false }); paintCard(true); }
  }
  function paintAll() { paintSrc(); paintFields(); paintCard(true); paintSets(); }

  function paintCard(full) {
    const box = $('mkPv'); if (!box) return;
    const live = ACard.isLive(c);
    if (full || !box.firstElementChild) {
      box.innerHTML = c.art ? ACard.html(c, { live, cls:'mk-card' }) : `<div class="mk-empty">${ACard.html(c, { cls:'mk-card still' })}<span>絵を選んでください</span></div>`;
    } else {
      // 絵（動画）は止めずに、文字と枠だけ入れかえる
      const el = box.querySelector('.ycard'), nu = h(ACard.html(c, { live:false, cls:'mk-card' }));
      el.className = nu.className; el.style.cssText = nu.getAttribute('style');
      ['.yc-rar', '.yc-type', '.yc-who', '.yc-name', '.yc-text', '.yc-foot'].forEach(s => { const o = el.querySelector(s), n = nu.querySelector(s); if (o && n) o.replaceWith(n); });
      const of = el.querySelector('.yc-foil'), nf = nu.querySelector('.yc-foil');
      if (of && !nf) of.remove(); if (!of && nf) el.querySelector('.yc-shade').after(nf);
    }
    $('mkHint').textContent = c.art ? (ACard.isLive(c) ? '動画はそのまま動きます' : '写真はゆっくり動いて見えます') : '下から絵を選んでください';
    const p = ACard.power(c);
    $('mkPow').innerHTML = `<div class="mk-meter l${p.lv}"><i style="width:${Math.min(100, p.r / 1.8 * 100)}%"></i><u></u></div><b>${p.lab}</b><small>${ACard.RAR[c.rar].k}に対して ${Math.round(p.r * 100)}%（目安。ちょうどいいほど遊びやすくなります）</small>`;
  }
  async function paintSrc() {
    $('mkSrc').innerHTML = [['photo', '写真'], ['video', '動画'], ['lobby', 'メモロビ'], ['art', 'Supportの絵']].map(([k, n]) => `<button data-src="${k}" class="${src === k ? 'on' : ''}">${n}</button>`).join('');
    const box = $('mkPick');
    if (src === 'photo') {
      const list = (await DB.all('photos').catch(() => [])).sort((a, b) => b.at - a.at);
      box.innerHTML = '<button class="mk-file" data-file="photo">＋ 写真を追加</button>' + list.map(p => `<button class="mk-th" data-ph="${p.id}" style="background-image:url(${ACard.blobUrl(p.blob)})"></button>`).join('');
    } else if (src === 'video') {
      box.innerHTML = '<button class="mk-file wide" data-file="video">動画を選ぶ<small>12秒まで・20MBまで（画面収録など）</small></button>';
    } else if (src === 'lobby') {
      box.innerHTML = LOBBY.map(([n, w]) => `<button class="mk-th tall" data-lb="${n}" data-w="${w}" style="background-image:url(${A(n + '_tall_poster.jpg')})"><i>${esc(CAST[w].n)}</i></button>`).join('');
    } else {
      box.innerHTML = ARTS.map(([f, w], i) => `<button class="mk-th tall" data-art="${i}" style="background-image:url(${A(f)})"></button>`).join('');
    }
  }
  function paintFields() {
    $('mkWho').innerHTML = CAST_ORDER.map(k => `<button data-who="${k}" class="${c.who === k ? 'on' : ''}">${avImg(k)}${CAST[k].n}</button>`).join('');
    const w = CAST[c.who] || CAST.other;
    $('mkDq').innerHTML = [...new Set([w.n, w.full])].map(n => `<button data-dn="${esc(n)}">${esc(n)}</button>`).join('');
    $('mkRar').innerHTML = [1, 2, 3, 4, 5].map(r => `<button data-rar="${r}" class="${c.rar === r ? 'on' : ''}" style="${c.rar === r ? '' : 'color:' + ACard.RAR[r].c}">${ACard.RAR[r].k}</button>`).join('');
    $('mkFrame').innerHTML = Object.entries(ACard.FRAME).map(([k, n]) => `<button data-frame="${k}" class="${(c.frame || 'auto') === k ? 'on' : ''}"><span class="mk-fsw f-${k === 'auto' ? 'auto' : k}"></span>${n}</button>`).join('');
    $('mkLay').innerHTML = [['normal', '通常'], ['full', 'フルアート']].map(([k, n]) => `<button data-lay="${k}" class="${c.layout === k ? 'on' : ''}">${n}</button>`).join('');
    $('mkVeil').innerHTML = c.layout === 'full' ? '<span>文字の下の帯</span>' + [[0, '透明'], [1, 'うすい'], [2, 'ふつう'], [3, 'こい']].map(([k, n]) => `<button data-veil="${k}" class="${(c.veil == null ? 2 : c.veil) === k ? 'on' : ''}">${n}</button>`).join('') : '';
    $('mkTcol').innerHTML = Object.entries(ACard.TCOL).map(([k, n]) => `<button data-tcol="${k}" class="${(c.tcol || 'w') === k ? 'on' : ''}">${n}</button>`).join('');
    [0, 1].forEach(i => $('mkFx' + i).innerHTML = fxHTML(i));
  }
  async function paintSets() {
    const sets = [...new Set((await ACard.all()).map(x => x.set).filter(Boolean))];
    $('mkSets').innerHTML = sets.map(s => `<button data-set="${esc(s)}">${esc(s)}</button>`).join('');
  }
  function fxHTML(i) {
    const f = c.fx[i];
    const chips = (i === 1 ? `<button data-fk="" class="${!f ? 'on' : ''}">なし</button>` : '') + ACard.KEYS.map(k => `<button data-fk="${k}" class="${f && f.k === k ? 'on' : ''}">${ACard.FX[k].n}</button>`).join('');
    if (!f) return `<div class="chips mk-fx" data-fi="${i}">${chips}</div>`;
    const T = ACard.FX[f.k];
    return `<div class="chips mk-fx" data-fi="${i}">${chips}</div><div class="mk-params">${T.p.map(([key, lab, mn, mx, st]) =>
      `<div class="mk-num" data-fi="${i}" data-key="${key}" data-min="${mn}" data-max="${mx}" data-st="${st}"><span>${lab}</span><button data-step="-1">−</button><input type="number" inputmode="numeric" value="${f[key]}" min="${mn}" max="${mx}"><button data-step="1">＋</button></div>`).join('')}
      <p class="mk-fxl">${esc(ACard.fxLine(f))}</p></div>`;
  }

  // ===== 操作 =====
  async function onClick(e) {
    const t = e.target.closest('button'); if (!t) return;
    Sfx.play('tap');
    const a = t.dataset.a;
    if (a === 'save') return save();
    if (a === 'preview') { if (!c.art) return toast('絵を選んでください'); return Reveal.show(Object.assign({}, c), { kira:Math.random() < .5, isNew:true, demo:true }); }
    if (a === 'del') return del();
    if (a === 'back') return App.openBinder();
    if (a === 'cab') { c.cab = !c.cab; t.classList.toggle('on', c.cab); return; }
    if (t.dataset.src) { src = t.dataset.src; return paintSrc(); }
    if (t.dataset.ph) return pickPhoto(t.dataset.ph);
    if (t.dataset.lb) return pickLobby(t.dataset.lb, t.dataset.w);
    if (t.dataset.art) return pickArt(+t.dataset.art);
    if (t.dataset.file) return pickFile(t.dataset.file);
    if (t.dataset.who) { c.who = t.dataset.who; LS.set('lastWho', c.who); $('mkDname').placeholder = (CAST[c.who] || CAST.other).n; paintFields(); return paintCard(false); }
    if (t.dataset.dn != null) { c.dname = t.dataset.dn === (CAST[c.who] || CAST.other).n ? '' : t.dataset.dn; $('mkDname').value = c.dname; return paintCard(false); }
    if (t.dataset.rar) { c.rar = +t.dataset.rar; paintFields(); return paintCard(false); }
    if (t.dataset.frame) { c.frame = t.dataset.frame; paintFields(); return paintCard(false); }
    if (t.dataset.lay) { c.layout = t.dataset.lay; paintFields(); return paintCard(false); }
    if (t.dataset.veil) { c.veil = +t.dataset.veil; paintFields(); return paintCard(false); }
    if (t.dataset.tcol) { c.tcol = t.dataset.tcol; paintFields(); return paintCard(false); }
    if (t.dataset.set != null) { c.set = t.dataset.set; $('mkSet').value = c.set; return paintCard(false); }
    if (t.dataset.fk != null) {
      const i = +t.closest('[data-fi]').dataset.fi, k = t.dataset.fk;
      if (!k) c.fx = c.fx.slice(0, 1); else if (!c.fx[i] || c.fx[i].k !== k) c.fx[i] = ACard.fxDefault(k);
      paintFields(); return paintCard(false);
    }
    if (t.dataset.step) {
      const n = t.closest('.mk-num'), f = c.fx[+n.dataset.fi], k = n.dataset.key;
      f[k] = clamp((+f[k] || 0) + (+t.dataset.step) * (+n.dataset.st), +n.dataset.min, +n.dataset.max);
      n.querySelector('input').value = f[k]; n.parentElement.querySelector('.mk-fxl').textContent = ACard.fxLine(f); return paintCard(false);
    }
  }
  function onInput(e) {
    const n = e.target.closest('.mk-num'); if (!n) return;
    const f = c.fx[+n.dataset.fi], v = parseInt(e.target.value, 10); if (isNaN(v)) return;
    f[n.dataset.key] = clamp(v, +n.dataset.min, +n.dataset.max);
    n.parentElement.querySelector('.mk-fxl').textContent = ACard.fxLine(f); paintCard(false);
  }

  // ===== 絵の選び方 =====
  const imgSize = url => new Promise(ok => { const i = new Image(); i.onload = () => ok({ w:i.naturalWidth, h:i.naturalHeight, img:i }); i.onerror = () => ok(null); i.src = url; });
  async function pickPhoto(id) {
    const p = await DB.get('photos', id).catch(() => null); if (!p) return;
    const url = ACard.blobUrl(p.blob), s = await imgSize(url); if (!s) return toast('写真を開けませんでした');
    c.art = { kind:'photo', from:id, tmpUrl:url, ar:s.w / s.h, x:0, y:0, s:1 };
    haptic(); paintCard(true);
  }
  function pickLobby(n, w) {
    c.art = { kind:'lobby', src:A(n + '_tall_h264.mp4'), poster:A(n + '_tall_poster.jpg'), ar:1170 / 2534, x:0, y:0, s:1 };
    if (w && w !== 'other') c.who = w;
    if (!edit) c.layout = 'full';
    haptic(); paintFields(); paintCard(true);
  }
  function pickArt(i) {
    const [f, w, ar] = ARTS[i];
    c.art = { kind:'url', poster:A(f), ar, x:0, y:0, s:1 }; c.who = w;
    haptic(); paintFields(); paintCard(true);
  }
  function pickFile(kind) {
    const i = document.createElement('input'); i.type = 'file'; i.accept = kind === 'photo' ? 'image/*' : 'video/*';
    i.onchange = async () => {
      const f = i.files[0]; if (!f) return;
      if (kind === 'photo') {
        const blob = await shrink(f, 1800), id = 'p' + newId();
        await DB.put('photos', { id, blob, at:Date.now() });
        await paintSrc(); return pickPhoto(id);
      }
      if (f.size > 20 * 1048576) return toast('動画は20MBまでです（短く切ってください）', 2600);
      const url = URL.createObjectURL(f), meta = await videoMeta(url);
      if (!meta) return toast('この動画は読み込めませんでした');
      if (meta.dur > 12.5) return toast('動画は12秒までです（短く切ってください）', 2600);
      const poster = await frameBlob(meta.v);
      c.art = { kind:'video', vid:f, img:poster, ar:meta.w / meta.h, x:0, y:0, s:1 };
      if (!edit) c.layout = 'full';
      paintFields(); paintCard(true);
    };
    i.click();
  }
  function videoMeta(url) {
    return new Promise(ok => {
      const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
      const t = setTimeout(() => ok(null), 8000);
      v.onloadeddata = () => { clearTimeout(t); try { v.currentTime = Math.min(.2, v.duration / 3); } catch (e) {} setTimeout(() => ok({ v, w:v.videoWidth, h:v.videoHeight, dur:v.duration }), 350); };
      v.onerror = () => { clearTimeout(t); ok(null); };
    });
  }
  function frameBlob(v) {
    return new Promise(ok => { const k = Math.min(1, 1080 / Math.max(v.videoWidth, v.videoHeight)), cv = document.createElement('canvas');
      cv.width = Math.round(v.videoWidth * k); cv.height = Math.round(v.videoHeight * k); cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height); cv.toBlob(b => ok(b), 'image/jpeg', .85); });
  }
  async function shrink(file, max) {
    const url = URL.createObjectURL(file);
    try { const s = await imgSize(url); const k = Math.min(1, max / Math.max(s.w, s.h)), cv = document.createElement('canvas');
      cv.width = Math.round(s.w * k); cv.height = Math.round(s.h * k); cv.getContext('2d').drawImage(s.img, 0, 0, cv.width, cv.height);
      return await new Promise(ok => cv.toBlob(b => ok(b), 'image/jpeg', .9)); } finally { URL.revokeObjectURL(url); }
  }

  // ===== 指で位置と大きさを決める =====
  function bindCrop() {
    const pv = $('mkPv'), pts = new Map(); let base = null;
    const lim = a => {
      const w = a.s * Math.max(1, a.ar * 1.5), hp = w / a.ar / 1.5;
      a.x = clamp(a.x, -(w - 1) / 2, (w - 1) / 2); a.y = clamp(a.y, -(hp - 1) / 2, (hp - 1) / 2);
    };
    const apply = a => pv.querySelectorAll('.yc-m').forEach(m => m.setAttribute('style', ACard.boxStyle(a)));
    function start() {
      if (!pts.size || !c.art) { base = null; return; }
      if (c.art.baked) c.art.baked = false;
      const p = [...pts.values()], a = c.art;
      base = { x:a.x || 0, y:a.y || 0, s:a.s || 1, cx:p.reduce((s, q) => s + q.x, 0) / p.length, cy:p.reduce((s, q) => s + q.y, 0) / p.length, d:p.length >= 2 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0 };
    }
    pv.addEventListener('pointerdown', e => { if (!c.art || !c.art.ar) return; pv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x:e.clientX, y:e.clientY }); start(); });
    pv.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId) || !base) return; pts.set(e.pointerId, { x:e.clientX, y:e.clientY });
      const a = c.art, r = pv.querySelector('.ycard').getBoundingClientRect(), p = [...pts.values()];
      const cx = p.reduce((s, q) => s + q.x, 0) / p.length, cy = p.reduce((s, q) => s + q.y, 0) / p.length;
      let s = base.s; if (p.length >= 2 && base.d) s = clamp(base.s * Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) / base.d, 1, 4);
      a.s = s; a.x = base.x + (cx - base.cx) / r.width; a.y = base.y + (cy - base.cy) / r.height; lim(a); apply(a);
    });
    const up = e => { pts.delete(e.pointerId); start(); };
    pv.addEventListener('pointerup', up); pv.addEventListener('pointercancel', up);
  }

  // ===== 保存 =====
  // 写真は切り取った形で焼きこむ（あとで直すときは元の写真から）
  async function bake(a) {
    const s = await imgSize(a.tmpUrl); if (!s) return a;
    const W = 720, H = 1080, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const w = a.s * Math.max(1, a.ar * 1.5) * W, hh = w / a.ar, left = W / 2 + a.x * W - w / 2, top = H / 2 + a.y * H - hh / 2;
    const g = cv.getContext('2d'); g.fillStyle = '#0b1430'; g.fillRect(0, 0, W, H); g.drawImage(s.img, left, top, w, hh);
    const img = await new Promise(ok => cv.toBlob(b => ok(b), 'image/jpeg', .88));
    return { kind:'photo', img, from:a.from, ar:a.ar, x:a.x, y:a.y, s:a.s, baked:true };
  }
  async function save() {
    if (busy) return;
    if (!c.art) return toast('絵を選んでください');
    if (!c.name) { $('mkName').focus(); return toast('カード名を入れてください'); }
    if (!c.fx.length) return toast('効果を1つ選んでください');
    busy = true;
    try {
      if (c.art.kind === 'photo' && c.art.tmpUrl) c.art = await bake(c.art);
      const rec = Object.assign({}, c, { set:c.set || '第1弾', up:Date.now() }); delete rec.art.tmpUrl;
      await DB.put('cards', rec);
      LS.set('lastSet', rec.set);
      Sfx.play('done'); haptic(20);
      toast(edit ? '直しました' : rec.cab ? '筐体に入れました！' : '保存しました');
      if (!edit) draft = null; c = null; App.openBinder(rec.id);
    } catch (e) { console.warn(e); toast('保存できませんでした：' + (e.message || e), 3000); }
    busy = false;
  }
  async function del() {
    if (!(await Ask(`「${c.name}」を削除しますか？\n手に入れた分も消えます`, { ok:'削除する', danger:true }))) return;
    await DB.del('cards', c.id);
    for (const o of (await ACard.owned()).filter(o => o.cid === c.id)) await DB.del('owned', o.id);
    toast('削除しました'); c = null; App.openBinder();
  }
  return { mount };
})();
