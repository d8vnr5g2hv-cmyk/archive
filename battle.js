// アーカイブカード — 筐体の中のバトル（3ターン。タイミングで威力が決まる）
'use strict';
const Battle = (() => {
  const E_HP = [60, 80, 110, 150, 200], E_ATK = [8, 10, 13, 16, 20], ME_HP = 60, TURNS = 3;
  const SPEED = [1.5, 1.35, 1.15, 1, .85];   // タイミングのカーソルが1往復する秒数
  const JUDGE = [['PERFECT', 1.6, .07], ['GREAT', 1.25, .2], ['GOOD', 1, .38], ['BAD', .6, 1]];   // [名前, 倍率, 中心からの幅]

  function run(stage, team, foe) {
    return new Promise(done => {
      const r = foe.rar || 1;
      const st = { e:{ hp:E_HP[r - 1], max:E_HP[r - 1], dealt:0, poison:null, weak:null }, me:{ hp:ME_HP, max:ME_HP, guard:0, up:null }, turn:1, used:new Set(), busy:false };
      const reuse = team.length < TURNS;
      stage.innerHTML = `<div class="bt">
        <div class="bt-foe" id="btFoe"><div class="bt-fart">${media(foe)}</div><i class="bt-aura"></i>
          <div class="bt-fname"><em style="color:${ACard.RAR[r].c}">${ACard.RAR[r].k}</em>${esc(ACard.whoName(foe))}<small>${esc(foe.name)}</small></div>
          <div class="bt-fst" id="btFst"></div></div>
        <div class="bt-gauge"><small>GET GAUGE</small><div class="bt-gbar"><i id="btG"></i><u style="left:40%"></u><u style="left:70%"></u></div><b id="btGp">0%</b></div>
        <div class="bt-log" id="btLog">カードを選んで攻撃しよう</div>
        <div class="bt-me"><div class="bt-turn" id="btTurn"></div><div class="bt-hp"><small>HP</small><div class="bt-hbar"><i id="btH"></i></div><b id="btHp"></b><span id="btGd"></span></div><div class="bt-mst" id="btMst"></div></div>
        <div class="bt-hand" id="btHand">${team.map((c, i) => `<button class="bt-card" data-i="${i}">${ACard.html(c.card, { still:true, kira:c.kira })}</button>`).join('')}</div>
        <div class="bt-timing" id="btTm" hidden><div class="bt-tbar"><i class="z3"></i><i class="z2"></i><i class="z1"></i><b id="btCur"></b></div><p>タップで止める！</p></div>
        <div class="bt-pop" id="btPop"></div></div>`;
      const root = stage.firstElementChild;
      paint();

      function paint() {
        const g = Math.min(100, Math.round(st.e.dealt / st.e.max * 100));
        $('btG').style.width = g + '%'; $('btGp').textContent = g + '%';
        $('btG').className = g >= 100 ? 's' : g >= 70 ? 'a' : g >= 40 ? 'b' : '';
        $('btH').style.width = st.me.hp / st.me.max * 100 + '%'; $('btHp').textContent = `${st.me.hp}/${st.me.max}`;
        $('btGd').textContent = st.me.guard ? `ガード${st.me.guard}` : '';
        $('btTurn').innerHTML = `TURN <b>${Math.min(st.turn, TURNS)}</b>/${TURNS}`;
        $('btFst').innerHTML = (st.e.poison ? `<span class="ps">毒${st.e.poison.v}・${st.e.poison.t}</span>` : '') + (st.e.weak ? `<span class="wk">攻撃-${st.e.weak.v}%・${st.e.weak.t}</span>` : '');
        $('btMst').innerHTML = st.me.up ? `<span class="up">攻撃+${st.me.up.v}%・${st.me.up.t}</span>` : '';
        root.querySelectorAll('.bt-card').forEach(b => b.classList.toggle('used', !reuse && st.used.has(+b.dataset.i)));
      }
      const log = t => { const l = $('btLog'); l.textContent = t; l.classList.remove('pop'); void l.offsetWidth; l.classList.add('pop'); };
      function pop(txt, cls, where) {
        const p = h(`<b class="bt-num ${cls}">${txt}</b>`), box = where === 'me' ? root.querySelector('.bt-hp') : $('btFoe');
        const r = box.getBoundingClientRect(), R = root.getBoundingClientRect();
        p.style.left = (r.left - R.left + r.width * rnd(.3, .7)) + 'px'; p.style.top = (r.top - R.top + r.height * (where === 'me' ? 0 : rnd(.25, .55))) + 'px';
        root.appendChild(p); setTimeout(() => p.remove(), 1100);
      }
      const shake = el => { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); };

      root.querySelector('#btHand').addEventListener('click', async e => {
        const b = e.target.closest('.bt-card'); if (!b || st.busy || b.classList.contains('used')) return;
        st.busy = true; Sfx.play('scan'); haptic();
        const i = +b.dataset.i, c = team[i].card; st.used.add(i);
        root.querySelectorAll('.bt-card').forEach(x => x.classList.toggle('pick', x === b));
        log(`「${c.name}」！`);
        const j = await timing(r);
        await act(c, j);
        root.querySelectorAll('.bt-card').forEach(x => x.classList.remove('pick'));
        if (st.e.dealt >= st.e.max) return end('full');
        await foeTurn();
        if (st.me.hp <= 0) return end('down');
        st.turn++; paint();
        if (st.turn > TURNS) return end('time');
        log(`TURN ${st.turn}　次のカードを選ぼう`);
        st.busy = false;
      });

      // タイミング：カーソルが往復する。中心に近いほど強い
      function timing(r) {
        return new Promise(ok => {
          const tm = $('btTm'), cur = $('btCur'); tm.hidden = false; tm.classList.remove('done');
          const per = SPEED[r - 1] * 1000, t0 = performance.now(); let raf = 0, x = 0, lastTick = 0;
          const loop = now => { const ph = ((now - t0) % per) / per; x = ph < .5 ? ph * 2 : 2 - ph * 2; cur.style.left = x * 100 + '%';
            if (now - lastTick > 180) { lastTick = now; } raf = requestAnimationFrame(loop); };
          raf = requestAnimationFrame(loop);
          const stop = e => {
            e.preventDefault(); cancelAnimationFrame(raf); tm.removeEventListener('pointerdown', stop);
            const d = Math.abs(x - .5), J = JUDGE.find(q => d <= q[2]);
            tm.classList.add('done'); tm.dataset.j = J[0];
            Sfx.play(J[0] === 'PERFECT' ? 'perfect' : J[0] === 'BAD' ? 'miss' : 'ok'); haptic(J[0] === 'PERFECT' ? 30 : 10);
            pop(J[0], 'j ' + J[0].toLowerCase(), 'foe');
            setTimeout(() => { tm.hidden = true; ok({ n:J[0], m:J[1] }); }, 520);
          };
          setTimeout(() => tm.addEventListener('pointerdown', stop), 150);
        });
      }
      async function act(c, j) {
        const upM = st.me.up ? 1 + st.me.up.v / 100 : 1;
        // 攻撃アップは同じカードのダメージにも乗る
        for (const f of c.fx || []) if (f.k === 'atkup') { st.me.up = { v:f.v, t:f.t + 1 }; Sfx.play('heal'); pop(`攻撃+${f.v}%`, 'buf', 'me'); }
        const upM2 = st.me.up ? 1 + st.me.up.v / 100 : upM;
        const foeEl = $('btFoe');
        for (const f of c.fx || []) {
          if (f.k === 'dmg') {
            for (let k = 0; k < (f.n || 1); k++) { const d = Math.max(1, Math.round(f.v * j.m * upM2)); hit(d); Sfx.play(d >= 25 ? 'big' : 'hit'); shake(foeEl); pop(d, d >= 25 ? 'dmg big' : 'dmg', 'foe'); paint(); await sleep(260); }
          } else if (f.k === 'drain') {
            const d = Math.max(1, Math.round(f.v * j.m * upM2)); hit(d); Sfx.play('hit'); shake(foeEl); pop(d, 'dmg', 'foe');
            const hv = Math.ceil(d / 2); st.me.hp = Math.min(st.me.max, st.me.hp + hv); await sleep(200); Sfx.play('heal'); pop('+' + hv, 'heal', 'me'); paint(); await sleep(260);
          } else if (f.k === 'poison') {
            st.e.poison = { v:Math.max(1, Math.round(f.v * j.m)), t:f.t }; Sfx.play('miss'); pop('毒', 'ps', 'foe'); paint(); await sleep(260);
          } else if (f.k === 'weak') {
            st.e.weak = { v:f.v, t:f.t }; Sfx.play('guard'); pop('攻撃ダウン', 'wk', 'foe'); paint(); await sleep(260);
          } else if (f.k === 'heal') {
            const hv = Math.round(f.v * j.m); st.me.hp = Math.min(st.me.max, st.me.hp + hv); Sfx.play('heal'); pop('+' + hv, 'heal', 'me'); paint(); await sleep(260);
          } else if (f.k === 'guard') {
            const g = Math.round(f.v * j.m); st.me.guard += g; Sfx.play('guard'); pop('ガード' + g, 'buf', 'me'); paint(); await sleep(260);
          }
        }
        if (st.me.up) { st.me.up.t--; if (st.me.up.t <= 0) st.me.up = null; }
        paint(); await sleep(250);
      }
      function hit(d) { st.e.dealt += d; }
      async function foeTurn() {
        if (st.e.poison) {
          const d = st.e.poison.v; hit(d); pop(d, 'dmg ps', 'foe'); Sfx.play('hit'); log(`毒で${d}ダメージ`);
          if (--st.e.poison.t <= 0) st.e.poison = null; paint(); await sleep(500);
          if (st.e.dealt >= st.e.max) return;
        }
        const atkName = (foe.fx || []).some(f => ['dmg', 'drain', 'poison'].includes(f.k)) ? `『${foe.name}』` : 'こうげき';
        log(`${ACard.whoName(foe)}の${atkName}！`);
        $('btFoe').classList.add('lunge'); await sleep(380); $('btFoe').classList.remove('lunge');
        let d = Math.round(E_ATK[r - 1] * rnd(.85, 1.2) * (st.e.weak ? 1 - st.e.weak.v / 100 : 1));
        const g = Math.min(st.me.guard, d); st.me.guard -= g; d -= g; st.me.guard = 0;
        st.me.hp = Math.max(0, st.me.hp - d);
        if (d > 0) { Sfx.play('hurt'); haptic(25); shake(root); pop('-' + d, 'hurt', 'me'); } else { Sfx.play('guard'); pop('ガード！', 'buf', 'me'); }
        if (st.e.weak && --st.e.weak.t <= 0) st.e.weak = null;
        paint(); await sleep(560);
      }
      async function end(why) {
        const g = Math.min(100, Math.round(st.e.dealt / st.e.max * 100));
        const rank = g >= 100 ? 'S' : g >= 70 ? 'A' : g >= 40 ? 'B' : 'C';
        log(why === 'full' ? 'GETゲージMAX！' : why === 'down' ? 'ダウン……でもゲットはできる！' : 'バトル終了！');
        await sleep(700);
        const rk = h(`<div class="bt-rank r${rank}"><small>RESULT</small><b>${rank}</b><span>GETゲージ ${g}%</span></div>`);
        root.appendChild(rk); Sfx.play(rank === 'S' ? 'rare' : 'done'); haptic(20);
        await sleep(1500);
        done({ rank, gauge:g });
      }
    });
  }
  // 相手の絵（動画はそのまま動かす）
  function media(c) {
    const a = c.art || {};
    if (ACard.isLive(c)) return `<img src="${ACard.poster(c)}" alt=""><video src="${ACard.videoSrc(c)}" muted playsinline loop autoplay></video>`;
    return `<img src="${ACard.poster(c)}" alt="" style="${a.kind === 'photo' && a.baked ? '' : ''}">`;
  }
  return { run, media };
})();
