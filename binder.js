// アーカイブカード — バインダー（集めたカード）
'use strict';
const Binder = (() => {
  let box = null, fWho = 'all', fHave = 'all', cards = [], owned = [];
  const NEW = () => LS.get('newCids', []);
  async function mount(el, focusId) {
    box = el;
    [cards, owned] = await Promise.all([ACard.all(), ACard.owned()]);
    paint();
    if (focusId) detail(focusId);
  }
  function stats() {
    const by = {}; owned.forEach(o => { const s = by[o.cid] || (by[o.cid] = { n:0, k:0, at:o.at }); s.n++; if (o.kira) s.k++; s.at = Math.min(s.at, o.at); });
    return by;
  }
  function paint() {
    const by = stats(), newc = NEW();
    const pool = cards.filter(c => c.cab), have = pool.filter(c => by[c.id]).length;
    const kira = owned.filter(o => o.kira).length;
    let list = cards.slice();
    if (fWho !== 'all') list = list.filter(c => c.who === fWho);
    if (fHave === 'have') list = list.filter(c => by[c.id]); if (fHave === 'not') list = list.filter(c => !by[c.id]);
    const sets = {}; list.forEach(c => (sets[c.set || '第1弾'] = sets[c.set || '第1弾'] || []).push(c));
    const whos = CAST_ORDER.filter(k => cards.some(c => c.who === k));
    box.innerHTML = `<div class="scroll bd">
      <div class="bd-top">
        <div class="bd-stat"><small>COLLECTION</small><b>${have}</b><span>/ ${pool.length}</span><div class="bd-bar"><i style="width:${pool.length ? have / pool.length * 100 : 0}%"></i></div></div>
        <div class="bd-stat"><small>KIRA</small><b>${kira}</b><span>枚</span><div class="bd-bar"><i style="width:${Math.min(100, kira * 10)}%"></i></div></div>
        <div class="bd-stat"><small>TOTAL</small><b>${owned.length}</b><span>枚</span><div class="bd-bar"><i style="width:${Math.min(100, owned.length)}%"></i></div></div>
      </div>
      <div class="chips bd-f">${['all', ...whos].map(k => `<button data-fw="${k}" class="${fWho === k ? 'on' : ''}">${k === 'all' ? 'みんな' : avImg(k) + CAST[k].n}</button>`).join('')}</div>
      <div class="chips bd-f">${[['all', 'すべて'], ['have', '持っている'], ['not', 'まだ']].map(([k, n]) => `<button data-fh="${k}" class="${fHave === k ? 'on' : ''}">${n}</button>`).join('')}</div>
      ${Object.keys(sets).length ? Object.entries(sets).map(([s, cs]) => {
        cs.sort((a, b) => b.rar - a.rar || a.at - b.at);
        const hv = cs.filter(c => by[c.id]).length;
        return `<div class="bd-set">${esc(s)}<small>${hv} / ${cs.length}</small></div><div class="bd-grid">${cs.map((c, i) => {
          const st = by[c.id];
          return `<button class="bd-cell ${c.cab ? '' : 'off'}" data-id="${c.id}" style="animation-delay:${Math.min(i, 12) * 25}ms">${st ? ACard.html(c, { still:true, kira:st.k > 0, n:st.n }) : ACard.shadow(c)}${
            !c.cab ? '<em>筐体OFF</em>' : st && newc.includes(c.id) ? '<em class="new">NEW</em>' : ''}</button>`;
        }).join('')}</div>`;
      }).join('') : '<p class="bd-empty">カードがありません</p>'}
      <button class="btn bd-make" data-a="make">＋ 新しいカードを作る</button>
    </div>`;
    box.firstElementChild.addEventListener('click', onClick);
  }
  function onClick(e) {
    const t = e.target.closest('button'); if (!t) return;
    Sfx.play('tap');
    if (t.dataset.fw) { fWho = t.dataset.fw; return keep(paint); }
    if (t.dataset.fh) { fHave = t.dataset.fh; return keep(paint); }
    if (t.dataset.a === 'make') return App.openMaker();
    if (t.dataset.id) return detail(t.dataset.id);
  }
  // 絞り込みのときはスクロール位置を保つ
  function keep(fn) { const y = box.firstElementChild.scrollTop; fn(); box.firstElementChild.scrollTop = y; }

  function detail(id) {
    const c = cards.find(x => x.id === id); if (!c) return;
    const mine = owned.filter(o => o.cid === id), k = mine.filter(o => o.kira).length;
    let showKira = k > 0;
    const nc = NEW(); if (nc.includes(id)) LS.set('newCids', nc.filter(x => x !== id));
    const first = mine.length ? new Date(Math.min(...mine.map(o => o.at))) : null;
    const el = h(`<div class="bd-det"><div class="bd-dcard" id="bdCard"></div>
      ${k && k < mine.length ? '<div class="bd-kiras"><button data-k="0">ふつう</button><button data-k="1">キラ</button></div>' : ''}
      <p class="bd-meta">${mine.length ? `${mine.length}枚（キラ${k}枚）・${first.getMonth() + 1}月${first.getDate()}日に初めて手に入れた` : 'まだ手に入れていません。筐体で出るのを待ちましょう'}<br>${esc(c.set || '')}・${ACard.RAR[c.rar].n}・筐体${c.cab ? 'ON' : 'OFF'}</p>
      <div class="bd-act"><button data-x="edit">直す</button><button data-x="cab">${c.cab ? '筐体から外す' : '筐体に入れる'}</button><button data-x="close">閉じる</button></div></div>`);
    document.body.appendChild(el);
    const paintCard = () => {
      $('bdCard').innerHTML = mine.length ? ACard.html(c, { live:true, kira:showKira, cls:'tilt' }) : ACard.html(c, { live:true, cls:'tilt' });
      if (!mine.length) $('bdCard').insertAdjacentHTML('beforeend', '<span class="bd-not">まだ持っていない</span>');
      ACard.tilt($('bdCard').firstElementChild);
      el.querySelectorAll('[data-k]').forEach(b => b.classList.toggle('on', !!+b.dataset.k === showKira));
    };
    paintCard();
    requestAnimationFrame(() => el.classList.add('on'));
    const close = () => { el.classList.remove('on'); setTimeout(() => el.remove(), 250); };
    el.addEventListener('click', async e => {
      const b = e.target.closest('button');
      if (!b) { if (e.target === el) { Sfx.play('cancel'); close(); paint(); } return; }
      Sfx.play('tap');
      if (b.dataset.k != null) { showKira = !!+b.dataset.k; if (showKira) Sfx.play('kira'); return paintCard(); }
      if (b.dataset.x === 'close') { close(); return paint(); }
      if (b.dataset.x === 'edit') { close(); return App.openMaker(c); }
      if (b.dataset.x === 'cab') { c.cab = !c.cab; await DB.put('cards', c); toast(c.cab ? '筐体に入れました' : '筐体から外しました'); close(); return paint(); }
    });
  }
  return { mount };
})();
