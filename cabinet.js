// アーカイブカード — 筐体（100円 → スキャン → 出現 → バトル → ゲット → 排出）
'use strict';

// ===== カードが出てくる演出（筐体・作業台のプレビューで共通） =====
const Reveal = (() => {
  // opt：{ kira, isNew, demo, bonus }
  function show(card, opt = {}) {
    return new Promise(done => {
      const r = card.rar || 1;
      const el = h(`<div class="rv r${r} ${opt.kira ? 'kira' : ''}">
        <i class="rv-rays"></i><i class="rv-rays b"></i>
        <div class="rv-slot"><i></i></div>
        <div class="rv-card" id="rvCard"><div class="rv-flip"><div class="rv-back">${ACard.back()}</div><div class="rv-front">${ACard.html(card, { live:true, kira:opt.kira, cls:'tilt' })}</div></div></div>
        <div class="rv-cap" id="rvCap"><p class="rv-tap">タップしてめくる</p></div></div>`);
      document.body.appendChild(el);
      Bgm.duck(true);
      requestAnimationFrame(() => el.classList.add('on'));
      Sfx.play('eject');
      let stage = 0;
      setTimeout(() => { el.classList.add('out1'); stage = 1; }, 1100);   // 排出口から出てくる
      el.addEventListener('click', async () => {
        if (stage === 1) {
          stage = 2; el.classList.add('flip'); Sfx.play('flip'); haptic(15);
          await sleep(260); Sfx.play(r >= 4 ? 'rare' : r >= 3 ? 'flash' : 'get');
          if (opt.kira) setTimeout(() => Sfx.play('kira'), 380);
          const front = el.querySelector('.rv-front .ycard'); ACard.tilt(front);
          $('rvCap').innerHTML = `${opt.isNew ? '<em class="rv-new">NEW!</em>' : ''}${opt.kira ? '<em class="rv-k">KIRA</em>' : ''}
            <p class="rv-name"><small style="color:${ACard.RAR[r].c}">${ACard.RAR[r].n}</small>${esc(card.name)}</p>
            <p class="rv-sub">${esc(ACard.whoName(card))}${opt.demo ? '・（プレビュー）' : ''}</p><p class="rv-tap">タップで閉じる</p>`;
          setTimeout(() => { stage = 3; }, 700);
        } else if (stage === 3) {
          stage = 4; Sfx.play('tap'); el.classList.remove('on'); Bgm.duck(false);
          setTimeout(() => { el.remove(); done(); }, 300);
        }
      });
    });
  }
  return { show };
})();

const Cabinet = (() => {
  let box = null, attractT = 0;
  // ===== 待機中の筐体 =====
  async function mount(el) {
    box = el;
    const cards = await ACard.all(), pool = cards.filter(c => c.cab);
    const by = new Set((await ACard.owned()).map(o => o.cid));
    const have = pool.filter(c => by.has(c.id)).length;
    box.innerHTML = `<div class="cb">
      <div class="cb-nav"><img src="${A('o_kisaki_talk.webp')}" alt=""><div class="talk pop" id="cbTalk"><b>KISAKI</b><span>${esc(Kisaki.line(Wallet.yen < 100 ? 'poor' : 'idle'))}</span></div></div>
      <div class="cb-mc">
        <div class="cb-mq"><i class="cb-bulbs"></i><b>ARCHIVE CARD</b><small>KISAKI'S ARCADE</small><i class="cb-bulbs b"></i></div>
        <div class="cb-scr" id="cbScr"><div class="cb-att" id="cbAtt"></div><p class="cb-ins">INSERT COIN<small>100円で1プレイ・必ず1枚もらえる</small></p></div>
        <div class="cb-pn">
          <div class="cb-info"><small>LINE UP</small><b>${have}<span>/${pool.length}</span></b><em>手に入れた種類</em></div>
          <button class="cb-coin" id="cbCoin" ${pool.length ? '' : 'disabled'}><i class="cb-slot"></i><b>100</b><small>円を入れる</small></button>
          <div class="cb-info"><small>TODAY</small><b>${Day.get().plays || 0}<span>回</span></b><em>今日のプレイ</em></div>
        </div>
        <div class="cb-out"><i></i><small>CARD OUT</small></div>
      </div>
    </div>`;
    attract(pool);
    $('cbCoin').addEventListener('click', insert);
    box.querySelector('.cb-nav').addEventListener('click', () => talk(Kisaki.line(Wallet.yen < 100 ? 'poor' : 'idle')));
    if (!pool.length) talk('筐体が空っぽだ。カードを作って「筐体に入れる」をONにするといい');
  }
  function talk(t) { const b = $('cbTalk'); if (!b) return; b.querySelector('span').textContent = t; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
  // 画面に収録カードを順番に流す
  function attract(pool) {
    clearInterval(attractT);
    const box = $('cbAtt'); if (!box || !pool.length) return;
    const list = shuffle(pool.slice()); let i = 0;
    const show = () => {
      if (!box.isConnected) return clearInterval(attractT);
      const c = list[i++ % list.length];
      const el = h(`<div class="cb-ac">${ACard.html(c, { still:true })}</div>`);
      box.appendChild(el); setTimeout(() => el.remove(), 3400);
    };
    show(); attractT = setInterval(show, 1700);
  }

  // ===== 100円を入れる =====
  async function insert() {
    if (!Wallet.pay(100)) { Sfx.play('cancel'); talk(Kisaki.line('poor')); return toast('お金が足りません（アルバイトで稼げます）'); }
    const btn = $('cbCoin'); btn.disabled = true;
    const coin = h('<i class="cb-coinfx">¥100</i>'); btn.appendChild(coin);
    Sfx.play('coin'); haptic(15);
    await sleep(500); Sfx.play('drop');
    $('cbScr').classList.add('boot'); await sleep(650);
    clearInterval(attractT);
    Day.countPlay();
    await Play.start();
    App.go('cab', true);
  }
  return { mount, talk };
})();

// ===== 1プレイ（全画面） =====
const Play = (() => {
  let el = null;
  async function start() {
    const cards = await ACard.all(), owned = await ACard.owned();
    let pool = cards.filter(c => c.cab); if (!pool.length) pool = cards;
    const me = el = h(`<div class="pl"><div class="pl-scan"></div><div class="pl-stage" id="plStage"></div>
      <div class="pl-kis" id="plKis"><img src="${A('o_kisaki_talk.webp')}" alt=""><div class="talk"><b>KISAKI</b><span></span></div></div></div>`);
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('on'));
    Bgm.play('battle');
    // ① スキャン
    const team = await scan(cards, owned);
    // ② 抽選（レア度の重み→同じレア度の中は均等）。キラは完全ランダム
    const foe = draw(pool), kira = Math.random() < .12;
    await encounter(foe);
    // ③ バトル
    const res = await Battle.run($('plStage'), team, foe);
    // ④ ゲット
    await getAnim(foe);
    const isNew = !owned.some(o => o.cid === foe.id);
    await ACard.give(foe.id, kira);
    if (isNew) LS.set('newCids', [...new Set([...LS.get('newCids', []), foe.id])]);
    const bonus = { S:30, A:20, B:10, C:0 }[res.rank];
    // ⑤ 排出
    el.classList.add('dim');
    await Reveal.show(foe, { kira, isNew });
    if (bonus) { Wallet.add(bonus); Sfx.play('pay'); }
    await result(foe, kira, isNew, res, bonus);
    el.classList.remove('on'); Bgm.play('cab');
    await sleep(320); me.remove(); if (el === me) el = null;
  }
  function kisaki(t, show = true) {
    const k = $('plKis'); if (!k) return;
    k.querySelector('span').textContent = t || ''; k.classList.toggle('on', show);
    if (show) { k.classList.remove('in'); void k.offsetWidth; k.classList.add('in'); }
  }
  function draw(pool) {
    const tiers = [...new Set(pool.map(c => c.rar || 1))];
    const tot = tiers.reduce((a, t) => a + ACard.RAR[t].w, 0);
    let x = Math.random() * tot, t = tiers[0];
    for (const q of tiers) { x -= ACard.RAR[q].w; if (x <= 0) { t = q; break; } }
    return pickOne(pool.filter(c => (c.rar || 1) === t));
  }

  // ----- ① 相棒をスキャン -----
  function scan(cards, owned) {
    return new Promise(done => {
      const best = {};   // 同じカードは1つにまとめる（キラがあればキラ）
      owned.forEach(o => { const c = cards.find(x => x.id === o.cid); if (!c) return; if (!best[c.id] || o.kira) best[c.id] = { card:c, kira:o.kira }; });
      const list = Object.values(best).sort((a, b) => ACard.power(b.card).r * b.card.rar - ACard.power(a.card).r * a.card.rar);
      const sel = [];
      $('plStage').innerHTML = `<div class="sc"><div class="sc-hd"><small>SCAN YOUR CARDS</small><b>相棒をスキャン</b><span>最大3枚。バトルで1ターンに1枚ずつ使います</span></div>
        <div class="sc-slots" id="scSlots">${[0, 1, 2].map(i => `<i data-s="${i}"></i>`).join('')}</div>
        <div class="sc-grid" id="scGrid">${list.map((o, i) => `<button class="sc-c" data-i="${i}">${ACard.html(o.card, { still:true, kira:o.kira })}</button>`).join('') || '<p class="mu">まだカードがありません。素手で挑みます</p>'}</div>
        <div class="sc-act"><button class="btn sub" data-a="auto">おまかせ</button><button class="btn" data-a="go" id="scGo" disabled>スキャン！</button></div></div>`;
      kisaki(Kisaki.line('coin'));
      const paint = () => {
        $('plStage').querySelectorAll('.sc-c').forEach(b => { const k = sel.indexOf(+b.dataset.i); b.classList.toggle('on', k >= 0); b.dataset.n = k >= 0 ? k + 1 : ''; });
        $('scSlots').innerHTML = [0, 1, 2].map(i => sel[i] != null ? `<i class="on">${ACard.html(list[sel[i]].card, { still:true, kira:list[sel[i]].kira })}</i>` : '<i></i>').join('');
        $('scGo').disabled = !!list.length && !sel.length;
      };
      $('plStage').firstElementChild.addEventListener('click', async e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.i != null) {
          const i = +b.dataset.i, k = sel.indexOf(i);
          if (k >= 0) sel.splice(k, 1); else if (sel.length < 3) sel.push(i); else { Sfx.play('cancel'); return; }
          Sfx.play('tap'); return paint();
        }
        if (b.dataset.a === 'auto') { sel.length = 0; list.slice(0, 3).forEach((_, i) => sel.push(i)); Sfx.play('tap'); return paint(); }
        if (b.dataset.a === 'go') {
          kisaki('', false);
          const sc = $('plStage').querySelector('.sc'); sc.classList.add('scanning'); Sfx.play('scan'); haptic(20);
          await sleep(1100);
          done(list.length ? sel.map(i => list[i]) : [{ card:{ id:'basic', name:'体当たり', who:'other', rar:1, fx:[{ k:'dmg', v:10, n:1 }], art:null, set:'BASIC' }, kira:false }]);
        }
      });
      paint();
    });
  }

  // ----- ② 出現：レア度の前ぶれ → カットイン → 登場 -----
  async function encounter(foe) {
    const r = foe.rar || 1, st = $('plStage');
    st.innerHTML = `<div class="en r${r}"><i class="en-pillar"></i><i class="en-pillar b"></i><i class="en-pillar c"></i><div class="en-msg">${['', 'なにかが来る……', '青い光……！', '金色の光！', '虹色の光！？', '……？'][r]}</div></div>`;
    Sfx.play('charge'); haptic(10);
    await sleep(r >= 4 ? 1700 : 1300);
    if (r >= 3) {
      kisaki(Kisaki.line('r' + r));
      st.firstElementChild.classList.add('cut'); Sfx.play('rare'); haptic(40);
      await sleep(r >= 4 ? 1900 : 1300); kisaki('', false);
    }
    st.firstElementChild.classList.add('flash'); Sfx.play('flash');
    await sleep(380);
    st.innerHTML = `<div class="ap r${r}"><div class="ap-art">${Battle.media(foe)}</div><i class="ap-aura"></i>
      <div class="ap-txt"><em style="color:${ACard.RAR[r].c}">${ACard.RAR[r].k}</em><b>${esc(ACard.whoName(foe))}</b><span>が あらわれた！</span><small>${esc(foe.name)}</small></div></div>`;
    await sleep(2100);
  }

  // ----- ④ ゲット -----
  async function getAnim(foe) {
    const g = h(`<div class="gt"><i class="gt-ring"></i><b>GET!</b><small>${esc(ACard.whoName(foe))}のカード</small></div>`);
    $('plStage').appendChild(g); Sfx.play('get'); haptic(30);
    await sleep(1500);
  }

  // ----- ⑤ 結果 -----
  function result(foe, kira, isNew, res, bonus) {
    return new Promise(done => {
      $('plStage').innerHTML = `<div class="rs"><div class="rs-card">${ACard.html(foe, { live:true, kira, cls:'tilt' })}</div>
        <p class="rs-t">${isNew ? '<em>NEW</em>' : ''}${kira ? '<em class="k">KIRA</em>' : ''}${esc(foe.name)}</p>
        <div class="rs-row"><span>バトル</span><b class="rk r${res.rank}">${res.rank}</b><span>ボーナス</span><b>+${bonus}円</b></div>
        <div class="rs-act"><button class="btn" data-a="again">もう1回（100円）</button><button class="btn sub" data-a="binder">バインダー</button><button class="btn sub" data-a="back">もどる</button></div></div>`;
      el.classList.remove('dim');
      ACard.tilt($('plStage').querySelector('.rs-card .ycard'));
      kisaki(Kisaki.line(kira ? 'kira' : isNew ? 'neu' : 'get'));
      $('plStage').firstElementChild.addEventListener('click', async e => {
        const b = e.target.closest('button'); if (!b) return;
        Sfx.play('tap');
        if (b.dataset.a === 'again') {
          if (Wallet.yen < 100) { Sfx.play('cancel'); return toast('お金が足りません（アルバイトで稼げます）'); }
          done();
          setTimeout(() => { if (Wallet.pay(100)) { Sfx.play('coin'); Day.countPlay(); Play.start().then(() => App.go('cab', true)); } }, 400);
          return;
        }
        done();
        if (b.dataset.a === 'binder') setTimeout(() => App.openBinder(foe.id), 350);
      });
    });
  }
  return { start };
})();
