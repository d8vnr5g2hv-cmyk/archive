// アーカイブカード — 筐体の中のバトル（相手はSupportのHALO LINKの敵。3ターン。タイミングで威力が決まる）
'use strict';
const Battle = (() => {
  // ===== 敵：12種 × 3色＋ボス12体（絵・名前・行動はHALO LINKのもの） =====
  // 行動：atk[量,回数]／atkAll／atkBack（どれも耀平への攻撃）／block・shield（こちらの攻撃を防ぐ）／heal（GETゲージを戻す）
  //       weak（こちらの威力ダウン）／vuln（受けるダメージ1.5倍）／poison（毒）／str（力アップ）／drain・junk（手元が狂う＝威力ダウン1ターン）
  const SPECIES = [
    { n:'寝不足ゴースト',     a:'dark',  pat:[{ atk:[6, 1] }, { weak:1, atk:[4, 1] }, { drain:1, atk:[3, 1] }] },
    { n:'散らかりスライム',   a:'dark',  pat:[{ junk:2 }, { atk:[7, 1] }, { block:6, atk:[3, 1] }] },
    { n:'浪費コウモリ',       a:'fire',  pat:[{ atk:[3, 3] }, { atkBack:[6, 1] }, { drain:1, atk:[3, 1] }] },
    { n:'締切時計',           a:'fire',  pat:[{ atk:[5, 1] }, { atk:[8, 1] }, { atk:[12, 1], str:1 }] },
    { n:'ジャンクフードの箱', a:'fire',  pat:[{ poison:3 }, { atk:[8, 1] }, { heal:6, block:4 }] },
    { n:'まどろみ枕',         a:'light', pat:[{ block:10 }, { weak:2 }, { atk:[10, 1] }] },
    { n:'月曜の騎士',         a:'light', pat:[{ block:10, atk:[6, 1] }, { atk:[14, 1] }, { vuln:1, atk:[6, 1] }] },
    { n:'給料日前の亡霊',     a:'dark',  pat:[{ drain:1, atk:[5, 1] }, { atkAll:[5, 1] }, { weak:1, vuln:1 }] },
    { n:'二日酔いのタコ',     a:'dark',  pat:[{ atk:[4, 3] }, { poison:4 }, { junk:1, atk:[6, 1] }] },
    { n:'怠けの大樹',         a:'light', pat:[{ block:14 }, { atk:[9, 1], str:1 }, { atkAll:[6, 1] }] },
    { n:'積読ゴーレム',       a:'dark',  pat:[{ junk:3 }, { atk:[16, 1] }, { block:12 }] },
    { n:'終電機関車',         a:'dark',  pat:[{ atk:[8, 1] }, { atk:[8, 2] }, { atkAll:[10, 1] }] },
  ];
  const BOSSES = [
    { n:'夜更かしの王',     a:'dark',  pat:[{ atk:[10, 1] }, { drain:1, atkBack:[7, 1] }, { shield:20, str:1 }, { atk:[5, 3] }] },
    { n:'浪費の魔王',       a:'fire',  pat:[{ atk:[4, 4] }, { drain:1, junk:2 }, { shield:22 }, { atkAll:[8, 1] }] },
    { n:'締切の巨人',       a:'light', pat:[{ atk:[12, 1] }, { atk:[16, 1] }, { shield:24, str:2 }, { vuln:2, atk:[8, 1] }] },
    { n:'ガラクタ城',       a:'dark',  pat:[{ junk:3, block:12 }, { atk:[14, 1] }, { shield:26 }, { atkAll:[9, 1] }] },
    { n:'深夜の冷蔵庫竜',   a:'water', pat:[{ poison:5 }, { atk:[7, 2] }, { shield:26, heal:12 }, { atkAll:[10, 1] }] },
    { n:'スマホの魔眼',     a:'dark',  pat:[{ weak:2, vuln:1 }, { atk:[6, 3] }, { drain:1, shield:26 }, { atkBack:[12, 1] }] },
    { n:'月曜の騎士王',     a:'light', pat:[{ block:16, atk:[10, 1] }, { atk:[20, 1] }, { shield:28, str:2 }, { vuln:2, atkAll:[8, 1] }] },
    { n:'給料日前の亡霊王', a:'dark',  pat:[{ drain:2 }, { atkAll:[9, 1] }, { shield:28, weak:2 }, { atk:[7, 3] }] },
    { n:'二日酔いの大ダコ', a:'water', pat:[{ atk:[5, 4] }, { poison:6, junk:2 }, { shield:30 }, { atkAll:[11, 1] }] },
    { n:'怠けの大樹王',     a:'wood',  pat:[{ block:20, heal:15 }, { atkAll:[10, 1] }, { shield:32, str:2 }, { weak:2, atk:[16, 1] }] },
    { n:'積読の大ゴーレム', a:'light', pat:[{ junk:4 }, { atk:[24, 1] }, { shield:34, block:14 }, { atkAll:[12, 1] }] },
    { n:'終電の魔機関車',   a:'fire',  pat:[{ atk:[10, 2] }, { drain:2, atkBack:[14, 1] }, { shield:36, str:2 }, { atkAll:[12, 1] }] },
  ];
  const ATTR_C = { fire:'#ff6a4d', water:'#47a8ff', wood:'#4fdc86', light:'#ffd85a', dark:'#b46bff', none:'#c9d3e8' };
  const VAR = { a:{ s:'' }, b:{ s:'・翠', a:'wood' }, c:{ s:'・蒼', a:'water' } };
  // レア度ごとの出てくる敵（レアほど強い敵＝前ぶれの光と敵の強さで、出るカードのレア度がわかる）
  const TIER = [[0, 1, 2, 3], [2, 3, 4, 5, 6], [5, 6, 7, 8], [8, 9, 10, 11]];
  const E_HP = [60, 80, 110, 150, 210], E_POW = [.95, 1.1, 1.25, 1.45, 1.6];
  const ME_HP = 60, TURNS = 3;
  const SPEED = [1.5, 1.35, 1.15, 1, .85];   // タイミングのカーソルが1往復する秒数
  const JUDGE = [['PERFECT', 1.6, .07], ['GREAT', 1.25, .2], ['GOOD', 1, .38], ['BAD', .6, 1]];   // [名前, 倍率, 中心からの幅]

  function pickFoe(r) {
    if (r >= 5) { const i = Math.floor(Math.random() * BOSSES.length), b = BOSSES[i];
      return { n:b.n, attr:b.a, pat:b.pat, img:A(`hl_boss${String(i + 1).padStart(2, '0')}.webp`), boss:true, r, hp:E_HP[4] }; }
    const i = pickOne(TIER[r - 1]), sp = SPECIES[i], v = pickOne(['a', 'b', 'c']);
    return { n:sp.n + VAR[v].s, attr:VAR[v].a || sp.a, pat:sp.pat, img:A(`hl_en${String(i + 1).padStart(2, '0')}${v}.webp`), r, hp:Math.round(E_HP[r - 1] * rnd(.92, 1.08)) };
  }
  // 敵の見た目（背景＋敵の絵）
  const foeHTML = f => `<div class="fo ${f.boss ? 'boss' : ''}"><img class="fo-bg" src="${A(f.boss ? 'hl_bg_sand.webp' : 'hl_bg_battle.webp')}" alt=""><img class="fo-img" src="${f.img}" alt=""></div>`;
  const attrTag = f => `<em style="background:${ATTR_C[f.attr] || ATTR_C.none}">${{ fire:'火', water:'水', wood:'木', light:'光', dark:'闇' }[f.attr] || '無'}</em>`;

  function run(stage, team, foe) {
    return new Promise(done => {
      const r = foe.r, K = E_POW[r - 1];
      const st = { e:{ max:foe.hp, dealt:0, poison:null, block:0, str:0 }, me:{ hp:ME_HP, max:ME_HP, guard:0, up:null, weak:null, vuln:null, poison:null }, turn:1, used:new Set(), busy:false };
      const reuse = team.length < TURNS;
      stage.innerHTML = `<div class="bt">
        <div class="bt-foe" id="btFoe">${foeHTML(foe)}
          <div class="bt-fname">${foe.boss ? '<b class="bt-boss">BOSS</b>' : ''}${attrTag(foe)}${esc(foe.n)}</div>
          <div class="bt-fst" id="btFst"></div><div class="bt-next" id="btNext"></div></div>
        <div class="bt-gauge"><small>GET GAUGE</small><div class="bt-gbar"><i id="btG"></i><u style="left:40%"></u><u style="left:70%"></u></div><b id="btGp">0%</b></div>
        <div class="bt-log" id="btLog">カードを選んで攻撃しよう</div>
        <div class="bt-me"><div class="bt-turn" id="btTurn"></div><div class="bt-hp"><small>HP</small><div class="bt-hbar"><i id="btH"></i></div><b id="btHp"></b><span id="btGd"></span></div></div>
        <div class="bt-mst" id="btMst"></div>
        <div class="bt-hand" id="btHand">${team.map((c, i) => `<button class="bt-card" data-i="${i}">${ACard.html(c.card, { still:true, kira:c.kira })}</button>`).join('')}</div>
        <div class="bt-timing" id="btTm" hidden><div class="bt-tbar"><i class="z3"></i><i class="z2"></i><i class="z1"></i><b id="btCur"></b></div><p>タップで止める！</p></div></div>`;
      const root = stage.firstElementChild;
      paint();

      // 次の敵の行動（予告）
      function nextAct() { return foe.pat[(st.turn - 1) % foe.pat.length]; }
      function actText(a) {
        const t = [];
        ['atk', 'atkAll', 'atkBack'].forEach(k => { if (a[k]) t.push(`攻撃 ${Math.round(a[k][0] * K) + st.e.str}${a[k][1] > 1 ? '×' + a[k][1] : ''}`); });
        if (a.block || a.shield) t.push(`防御 ${Math.round(((a.block || 0) + (a.shield || 0)) * K)}`);
        if (a.heal) t.push('回復'); if (a.weak || a.drain || a.junk) t.push('威力ダウン'); if (a.vuln) t.push('弱点化'); if (a.poison) t.push('毒'); if (a.str) t.push('力アップ');
        return t.join('・');
      }
      function paint() {
        const g = Math.min(100, Math.round(st.e.dealt / st.e.max * 100));
        $('btG').style.width = g + '%'; $('btGp').textContent = g + '%';
        $('btG').className = g >= 100 ? 's' : g >= 70 ? 'a' : g >= 40 ? 'b' : '';
        $('btH').style.width = st.me.hp / st.me.max * 100 + '%'; $('btHp').textContent = `${st.me.hp}/${st.me.max}`;
        $('btGd').textContent = st.me.guard ? `ガード${st.me.guard}` : '';
        $('btTurn').innerHTML = `TURN <b>${Math.min(st.turn, TURNS)}</b>/${TURNS}`;
        $('btFst').innerHTML = (st.e.block ? `<span class="bk">防御${st.e.block}</span>` : '') + (st.e.str ? `<span class="sr">力+${st.e.str}</span>` : '') + (st.e.poison ? `<span class="ps">毒${st.e.poison.v}・${st.e.poison.t}</span>` : '');
        $('btNext').innerHTML = st.turn <= TURNS ? `<small>NEXT</small>${esc(actText(nextAct()))}` : '';
        $('btMst').innerHTML = (st.me.up ? `<span class="up">攻撃+${st.me.up.v}%・${st.me.up.t}</span>` : '') + (st.me.weak ? `<span class="wk">威力ダウン・${st.me.weak.t}</span>` : '')
          + (st.me.vuln ? `<span class="vn">弱点・${st.me.vuln.t}</span>` : '') + (st.me.poison ? `<span class="ps">毒${st.me.poison.v}・${st.me.poison.t}</span>` : '');
        root.querySelectorAll('.bt-card').forEach(b => b.classList.toggle('used', !reuse && st.used.has(+b.dataset.i)));
      }
      const log = t => { const l = $('btLog'); l.textContent = t; l.classList.remove('pop'); void l.offsetWidth; l.classList.add('pop'); };
      function pop(txt, cls, where) {
        const p = h(`<b class="bt-num ${cls}">${txt}</b>`), box = where === 'me' ? root.querySelector('.bt-hp') : $('btFoe');
        const rc = box.getBoundingClientRect(), R = root.getBoundingClientRect();
        p.style.left = (rc.left - R.left + rc.width * rnd(.3, .7)) + 'px'; p.style.top = (rc.top - R.top + rc.height * (where === 'me' ? 0 : rnd(.25, .55))) + 'px';
        root.appendChild(p); setTimeout(() => p.remove(), 1100);
      }
      const shake = el => { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); };

      root.querySelector('#btHand').addEventListener('click', async e => {
        const b = e.target.closest('.bt-card'); if (!b || st.busy || b.classList.contains('used')) return;
        st.busy = true; Sfx.play('scan'); haptic();
        const i = +b.dataset.i, c = team[i].card; st.used.add(i);
        root.querySelectorAll('.bt-card').forEach(x => x.classList.toggle('pick', x === b));
        log(`「${c.name}」！`);
        const j = await timing();
        await act(c, j);
        root.querySelectorAll('.bt-card').forEach(x => x.classList.remove('pick'));
        if (st.e.dealt >= st.e.max) return end('full');
        await foeTurn();
        if (st.e.dealt >= st.e.max) return end('full');
        if (st.me.hp <= 0) return end('down');
        st.turn++; paint();
        if (st.turn > TURNS) return end('time');
        log(`TURN ${st.turn}　次のカードを選ぼう`);
        st.busy = false;
      });

      // タイミング：カーソルが往復する。中心に近いほど強い
      function timing() {
        return new Promise(ok => {
          const tm = $('btTm'), cur = $('btCur'); tm.hidden = false; tm.classList.remove('done');
          const per = SPEED[r - 1] * 1000, t0 = performance.now(); let raf = 0, x = 0;
          const loop = now => { const ph = ((now - t0) % per) / per; x = ph < .5 ? ph * 2 : 2 - ph * 2; cur.style.left = x * 100 + '%'; raf = requestAnimationFrame(loop); };
          raf = requestAnimationFrame(loop);
          const stop = e => {
            e.preventDefault(); cancelAnimationFrame(raf); tm.removeEventListener('pointerdown', stop);
            const d = Math.abs(x - .5), J = JUDGE.find(q => d <= q[2]);
            tm.classList.add('done');
            Sfx.play(J[0] === 'PERFECT' ? 'perfect' : J[0] === 'BAD' ? 'miss' : 'ok'); haptic(J[0] === 'PERFECT' ? 30 : 10);
            pop(J[0], 'j ' + J[0].toLowerCase(), 'foe');
            setTimeout(() => { tm.hidden = true; ok({ n:J[0], m:J[1] }); }, 520);
          };
          setTimeout(() => tm.addEventListener('pointerdown', stop), 150);
        });
      }
      // こちらのダメージ：防御で減る
      function hit(raw) {
        const b = Math.min(st.e.block, raw); st.e.block -= b; const d = raw - b;
        st.e.dealt += d; return { d, b };
      }
      async function act(c, j) {
        for (const f of c.fx || []) if (f.k === 'atkup') { st.me.up = { v:f.v, t:f.t + 1 }; Sfx.play('heal'); pop(`攻撃+${f.v}%`, 'buf', 'me'); }
        const mul = j.m * (st.me.up ? 1 + st.me.up.v / 100 : 1) * (st.me.weak ? .75 : 1);
        const foeEl = $('btFoe');
        const strike = async (v, cls = '') => {
          const { d, b } = hit(Math.max(1, Math.round(v * mul)));
          Sfx.play(d >= 25 ? 'big' : b && !d ? 'guard' : 'hit'); shake(foeEl);
          pop(d ? d : '防御', (d >= 25 ? 'dmg big ' : 'dmg ') + cls, 'foe'); paint(); await sleep(260); return d;
        };
        for (const f of c.fx || []) {
          if (f.k === 'dmg') { for (let k = 0; k < (f.n || 1); k++) await strike(f.v); }
          else if (f.k === 'drain') {
            const d = await strike(f.v), hv = Math.ceil(d / 2);
            if (hv) { st.me.hp = Math.min(st.me.max, st.me.hp + hv); Sfx.play('heal'); pop('+' + hv, 'heal', 'me'); paint(); await sleep(200); }
          } else if (f.k === 'poison') { st.e.poison = { v:Math.max(1, Math.round(f.v * j.m)), t:f.t }; Sfx.play('miss'); pop('毒', 'ps', 'foe'); paint(); await sleep(260); }
          else if (f.k === 'weak') { st.e.weakV = f.v; st.e.weakT = f.t; Sfx.play('guard'); pop('攻撃ダウン', 'wk', 'foe'); paint(); await sleep(260); }
          else if (f.k === 'heal') { const hv = Math.round(f.v * j.m); st.me.hp = Math.min(st.me.max, st.me.hp + hv); Sfx.play('heal'); pop('+' + hv, 'heal', 'me'); paint(); await sleep(260); }
          else if (f.k === 'guard') { const g = Math.round(f.v * j.m); st.me.guard += g; Sfx.play('guard'); pop('ガード' + g, 'buf', 'me'); paint(); await sleep(260); }
        }
        if (st.me.up && --st.me.up.t <= 0) st.me.up = null;
        if (st.me.weak && --st.me.weak.t <= 0) st.me.weak = null;
        paint(); await sleep(250);
      }
      async function foeTurn() {
        const foeEl = $('btFoe');
        // 毒（相手）
        if (st.e.poison) {
          const d = st.e.poison.v; st.e.dealt += d; pop(d, 'dmg ps', 'foe'); Sfx.play('hit'); log(`毒で${d}ダメージ`);
          if (--st.e.poison.t <= 0) st.e.poison = null; paint(); await sleep(500);
          if (st.e.dealt >= st.e.max) return;
        }
        const a = nextAct();
        log(`${foe.n}の行動！`);
        foeEl.classList.add('lunge'); await sleep(380); foeEl.classList.remove('lunge');
        const weakE = st.e.weakT ? 1 - st.e.weakV / 100 : 1;
        // 攻撃
        for (const k of ['atk', 'atkAll', 'atkBack']) {
          if (!a[k]) continue;
          for (let n = 0; n < a[k][1]; n++) {
            let d = Math.round((a[k][0] * K + st.e.str) * weakE * (st.me.vuln ? 1.5 : 1));
            const g = Math.min(st.me.guard, d); st.me.guard -= g; d -= g;
            st.me.hp = Math.max(0, st.me.hp - d);
            if (d > 0) { Sfx.play('hurt'); haptic(20); shake(root); pop('-' + d, 'hurt', 'me'); } else { Sfx.play('guard'); pop('ガード！', 'buf', 'me'); }
            paint(); await sleep(300);
          }
        }
        st.me.guard = 0;
        if (a.block || a.shield) { const v = Math.round(((a.block || 0) + (a.shield || 0)) * K); st.e.block += v; Sfx.play('guard'); pop('防御' + v, 'wk', 'foe'); paint(); await sleep(320); }
        if (a.heal) { const v = Math.min(st.e.dealt, Math.round(a.heal * K)); st.e.dealt -= v; Sfx.play('heal'); pop('回復' + v, 'heal', 'foe'); log('GETゲージが少し戻された！'); paint(); await sleep(360); }
        if (a.weak || a.drain || a.junk) { st.me.weak = { t:Math.max(a.weak || 0, 1) + 1 }; Sfx.play('miss'); pop('威力ダウン', 'wk', 'me'); paint(); await sleep(300); }
        if (a.vuln) { st.me.vuln = { t:a.vuln + 1 }; Sfx.play('miss'); pop('弱点', 'hurt', 'me'); paint(); await sleep(300); }
        if (a.poison) { st.me.poison = { v:Math.round(a.poison * K), t:3 }; Sfx.play('miss'); pop('毒', 'ps', 'me'); paint(); await sleep(300); }
        if (a.str) { st.e.str += a.str * 2; Sfx.play('charge'); pop('力アップ', 'sr', 'foe'); paint(); await sleep(360); }
        // 毒（こちら）
        if (st.me.poison) { const d = st.me.poison.v; st.me.hp = Math.max(0, st.me.hp - d); pop('-' + d, 'hurt ps', 'me'); Sfx.play('hurt'); if (--st.me.poison.t <= 0) st.me.poison = null; paint(); await sleep(400); }
        if (st.e.weakT && --st.e.weakT <= 0) st.e.weakT = 0;
        if (st.me.vuln && --st.me.vuln.t <= 0) st.me.vuln = null;
        paint(); await sleep(260);
      }
      async function end(why) {
        const g = Math.min(100, Math.round(st.e.dealt / st.e.max * 100));
        const rank = g >= 100 ? 'S' : g >= 70 ? 'A' : g >= 40 ? 'B' : 'C';
        if (why === 'full') { $('btFoe').classList.add('ko'); Sfx.play('big'); }
        log(why === 'full' ? `${foe.n}をたおした！` : why === 'down' ? 'ダウン……でもカードはもらえる！' : 'バトル終了！');
        await sleep(900);
        const rk = h(`<div class="bt-rank r${rank}"><small>RESULT</small><b>${rank}</b><span>GETゲージ ${g}%</span></div>`);
        root.appendChild(rk); Sfx.play(rank === 'S' ? 'rare' : 'done'); haptic(20);
        await sleep(1500);
        done({ rank, gauge:g });
      }
    });
  }
  return { run, pickFoe, foeHTML, attrTag };
})();
