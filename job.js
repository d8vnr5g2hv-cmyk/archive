// アーカイブカード — アルバイト（1回1分くらいのミニゲームでお金を稼ぐ。1日5シフトまで）
'use strict';
const Job = (() => {
  const SHOPS = [
    { k:'keiri', who:'yuuka', name:'セミナーの経理', sub:'計算問題を時間内にどんどん解く', time:30, c1:'#7aa8ff', c2:'#2a3f8f',
      say:{ start:'先生、計算はスピードと正確さです！ 予算がかかってますからね', good:'その調子です！', bad:'ちょ、ちょっと先生！？', end:['……まあ、今日はこれで良しとします', 'さすが先生、帳簿がきれいに合いました！', '完璧です！ ボーナスを付けておきますね'] } },
    { k:'sweets', who:'mika', name:'スイーツ店の店番', sub:'お客さんの注文どおりにスイーツを出す', time:30, c1:'#ffc8ef', c2:'#a0447a',
      say:{ start:'先生、いらっしゃーい☆ 今日は一緒に店番だね！', good:'わーい、ありがと☆', bad:'あれ？ それ違うよ〜', end:['うーん、ちょっと失敗しちゃったね', '先生と店番、楽しかった！', 'すごーい！ 行列ぜんぶさばいちゃった☆'] } },
    { k:'souji', who:'mari', name:'教会のおそうじ', sub:'出てくるほこりをタップしてきれいにする', time:30, c1:'#ffe0a8', c2:'#8a6a2a',
      say:{ start:'先生、今日もお手伝いありがとうございます。よろしくお願いしますね', good:'ありがとうございます！', bad:'あっ……', end:['大丈夫です、少しずつきれいにしましょう', 'とてもきれいになりました。感謝します', '主もきっと喜んでいます……！'] } },
    { k:'tea', who:'mia', name:'お屋敷の給仕', sub:'長押しで紅茶を注いで、線ぴったりで止める', time:0, c1:'#c9a8ff', c2:'#4a3a7a',
      say:{ start:'……はいはい、紅茶ね。こぼしたら許さないから', good:'……ふーん、やるじゃん', bad:'……ちょっと。全然ちがうんだけど', over:'ちょっと。こぼれてるんだけど', end:['……まあ、飲めなくはないかな', 'ふふ、悪くないね。また頼むかも', '……なにそれ、完璧じゃん。ずるい'] } },
  ];
  let box = null;

  function mount(el) {
    box = el;
    const d = Day.get(), best = LS.get('jobBest', {});
    box.innerHTML = `<div class="scroll jb">
      <div class="jb-hd"><div><small>PART-TIME JOB</small><b>アルバイト</b></div><div class="jb-sh"><small>今日のシフト</small><b>${d.shifts}</b><span>/ ${Day.SHIFTS}</span></div></div>
      <p class="mu jb-note">1シフト1分くらい。成績がいいほどお給料が上がります。シフトは毎日もどります</p>
      ${SHOPS.map(s => `<button class="jb-shop" data-k="${s.k}" style="--c1:${s.c1};--c2:${s.c2}" ${d.shifts ? '' : 'disabled'}>
        <img class="jb-chibi" src="${Cast.chibi(s.who)}" data-who="${s.who}" alt="">
        <div class="jb-txt"><small>${esc(CAST[s.who].n)}のお店</small><b>${esc(s.name)}</b><span>${esc(s.sub)}</span>
          <em>${best[s.k] ? `ベスト ${best[s.k]}円` : 'まだ働いていません'}</em></div><i class="jb-go">›</i></button>`).join('')}
      ${d.shifts ? '' : '<p class="jb-done">今日のシフトはおしまい。また明日！</p>'}
    </div>`;
    box.firstElementChild.addEventListener('click', e => {
      const b = e.target.closest('.jb-shop'); if (!b || b.disabled) return;
      Sfx.play('tap'); open(SHOPS.find(s => s.k === b.dataset.k));
    });
  }

  // ===== 1シフト =====
  async function open(s) {
    if (!Day.useShift()) return toast('今日のシフトはおしまいです');
    const el = h(`<div class="ov jg" style="--c1:${s.c1};--c2:${s.c2}">
      <div class="ov-hd"><div><small>${esc(CAST[s.who].n)}のお店</small><b>${esc(s.name)}</b></div><div class="jg-sc"><small>SCORE</small><b id="jgSc">0</b></div></div>
      ${s.time ? '<div class="jg-time"><i id="jgT"></i></div>' : '<div class="jg-time"><i id="jgT" style="width:100%"></i></div>'}
      <div class="jg-boss"><img src="${Cast.chibi(s.who)}" data-who="${s.who}" alt="" id="jgBoss"><div class="talk" id="jgTalk"><b>${esc(CAST[s.who].full)}</b><span>${esc(s.say.start)}</span></div></div>
      <div class="jg-area" id="jgArea"></div><div class="jg-cd" id="jgCd"></div></div>`);
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('on'));
    const ctl = {
      el, area:$('jgArea'), score:0,
      set(v) { this.score = v; $('jgSc').textContent = v; },
      say(t, mood) { const b = $('jgTalk'); b.querySelector('span').textContent = t; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
        const im = $('jgBoss'); im.classList.remove('jump', 'sad'); void im.offsetWidth; if (mood) im.classList.add(mood); },
      good() { if (Math.random() < .25) this.say(s.say.good, 'jump'); },
      bad(over) { this.say(over && s.say.over ? s.say.over : s.say.bad, 'sad'); },
    };
    await sleep(700);
    for (const n of ['3', '2', '1', 'START!']) { $('jgCd').textContent = n; $('jgCd').className = 'jg-cd on'; Sfx.play(n === 'START!' ? 'ok' : 'tick'); await sleep(n === 'START!' ? 500 : 650); $('jgCd').className = 'jg-cd'; await sleep(60); }
    const pay = await GAMES[s.k](ctl, s);
    // お給料
    const best = LS.get('jobBest', {}); const isBest = pay > (best[s.k] || 0); if (isBest) { best[s.k] = pay; LS.set('jobBest', best); }
    const tier = pay >= 150 ? 2 : pay >= 80 ? 1 : 0;
    ctl.say(s.say.end[tier], tier ? 'jump' : '');
    const r = h(`<div class="jg-pay"><small>お給料</small><b>¥<span id="jgPay">0</span></b>${isBest ? '<em>BEST!</em>' : ''}<button class="btn">受け取る</button></div>`);
    el.appendChild(r); requestAnimationFrame(() => r.classList.add('on'));
    for (let v = 0; v <= pay; v += Math.max(1, Math.ceil(pay / 24))) { $('jgPay').textContent = v; Sfx.play('tick'); await sleep(30); }
    $('jgPay').textContent = pay; Sfx.play('pay');
    await new Promise(ok => r.querySelector('button').addEventListener('click', ok, { once:true }));
    Wallet.add(pay); Sfx.play('coin'); haptic(15);
    el.classList.remove('on'); setTimeout(() => el.remove(), 380);
    mount(box);
  }

  // 時間制のゲームの共通：残り時間のバー
  function timer(sec, onEnd) {
    const t0 = performance.now(); let raf = 0, stopped = false, pen = 0;
    const loop = now => { if (stopped) return; const left = sec - (now - t0) / 1000 - pen; $('jgT').style.width = Math.max(0, left / sec * 100) + '%';
      if (left <= 0) { stopped = true; return onEnd(); } raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return { stop() { stopped = true; cancelAnimationFrame(raf); }, penalty(s) { pen += s; } };
  }

  const GAMES = {
    // ----- ユウカ：計算 -----
    keiri(ctl) {
      return new Promise(done => {
        let ok = 0, combo = 0, bonus = 0, ans = 0;
        ctl.area.innerHTML = `<div class="kr"><p class="kr-q" id="krQ"></p><p class="kr-c" id="krC"></p><div class="kr-a" id="krA"></div></div>`;
        function next() {
          const t = Math.random(), lv = Math.min(3, Math.floor(ok / 5));
          let a, b, q;
          if (t < .4) { a = 10 + Math.floor(Math.random() * (40 + lv * 30)); b = 5 + Math.floor(Math.random() * (30 + lv * 30)); q = `${a} + ${b}`; ans = a + b; }
          else if (t < .75) { a = 30 + Math.floor(Math.random() * (60 + lv * 40)); b = 5 + Math.floor(Math.random() * a * .8); q = `${a} − ${b}`; ans = a - b; }
          else { a = 2 + Math.floor(Math.random() * (8 + lv * 2)); b = 2 + Math.floor(Math.random() * 9); q = `${a} × ${b}`; ans = a * b; }
          $('krQ').textContent = q + ' ＝ ？';
          const opts = new Set([ans]); while (opts.size < 4) { const d = ans + (Math.floor(Math.random() * 9) - 4) * (Math.random() < .5 ? 1 : 10); if (d >= 0 && d !== ans) opts.add(d); }
          $('krA').innerHTML = shuffle([...opts]).map(v => `<button data-v="${v}">${v}</button>`).join('');
        }
        const tm = timer(30, () => { $('krA').innerHTML = ''; $('krQ').textContent = 'しゅうりょう！'; setTimeout(() => done(Math.min(220, ok * 7 + bonus)), 700); });
        $('krA').addEventListener('click', e => {
          const b = e.target.closest('button'); if (!b) return;
          if (+b.dataset.v === ans) { ok++; combo++; if (combo % 5 === 0) { bonus += 10; $('krC').textContent = `${combo}連続！ +10円`; Sfx.play('perfect'); } else { $('krC').textContent = combo > 1 ? `${combo}連続` : ''; Sfx.play('ok'); } ctl.set(ok); ctl.good(); }
          else { combo = 0; $('krC').textContent = 'ミス！ −2秒'; tm.penalty(2); Sfx.play('miss'); haptic(30); ctl.bad(); }
          next();
        });
        next();
      });
    },
    // ----- ミカ：スイーツの注文 -----
    sweets(ctl) {
      return new Promise(done => {
        const S = ['🍰', '🍮', '🍩', '🍪', '🧁', '🍓'];
        let orders = 0, miss = 0, want = [], got = [];
        ctl.area.innerHTML = `<div class="sw"><div class="sw-cus" id="swCus"><small>ご注文</small><div id="swWant"></div></div><div class="sw-tray" id="swTray"></div><div class="sw-btns" id="swBtns">${S.map(x => `<button data-s="${x}">${x}</button>`).join('')}</div></div>`;
        function next() {
          const n = orders < 3 ? 2 : orders < 8 ? 3 : 4;
          want = Array.from({ length:n }, () => pickOne(S)); got = [];
          $('swWant').innerHTML = want.map(x => `<span>${x}</span>`).join('');
          $('swTray').innerHTML = ''; const c = $('swCus'); c.classList.remove('in'); void c.offsetWidth; c.classList.add('in');
        }
        timer(30, () => { $('swBtns').innerHTML = ''; setTimeout(() => done(Math.max(0, Math.min(220, orders * 16 - miss * 3))), 700); });
        $('swBtns').addEventListener('click', e => {
          const b = e.target.closest('button'); if (!b) return;
          const x = b.dataset.s, rest = want.slice(); got.forEach(g => rest.splice(rest.indexOf(g), 1));
          if (!rest.includes(x)) { miss++; Sfx.play('miss'); haptic(30); ctl.bad(); $('swTray').classList.remove('ng'); void $('swTray').offsetWidth; $('swTray').classList.add('ng'); return; }
          got.push(x); Sfx.play('pop');
          $('swTray').insertAdjacentHTML('beforeend', `<span>${x}</span>`);
          [...$('swWant').children].find(sp => sp.textContent === x && !sp.classList.contains('ok')).classList.add('ok');
          if (got.length === want.length) { orders++; ctl.set(orders); Sfx.play('pay'); ctl.good(); setTimeout(next, 220); }
        });
        next();
      });
    },
    // ----- マリー：ほこりをタップ -----
    souji(ctl) {
      return new Promise(done => {
        let n = 0, gold = 0, live = true;
        ctl.area.innerHTML = '<div class="sj" id="sjBox"><i class="sj-glass"></i></div>';
        const bx = $('sjBox');
        function spawn() {
          if (!live) return;
          const g = Math.random() < .08, d = h(`<button class="sj-d ${g ? 'g' : ''}" style="left:${rnd(6, 82)}%;top:${rnd(6, 82)}%;--s:${rnd(.8, 1.3)}"></button>`);
          bx.appendChild(d); setTimeout(() => d.isConnected && d.classList.add('gone'), 1500); setTimeout(() => d.remove(), 1800);
          setTimeout(spawn, Math.max(260, 620 - n * 9));
        }
        bx.addEventListener('pointerdown', e => {
          const d = e.target.closest('.sj-d'); if (!d || d.classList.contains('hit') || d.classList.contains('gone')) return;
          d.classList.add('hit'); setTimeout(() => d.remove(), 300);
          if (d.classList.contains('g')) { gold++; Sfx.play('kira'); } else Sfx.play('pop');
          n++; ctl.set(n); ctl.good(); haptic(5);
        });
        timer(30, () => { live = false; bx.querySelectorAll('.sj-d').forEach(d => d.remove()); setTimeout(() => done(Math.min(220, n * 3 + gold * 15)), 600); });
        spawn(); setTimeout(spawn, 300);
      });
    },
    // ----- 美愛：紅茶を線ぴったりで止める（6杯） -----
    tea(ctl) {
      return new Promise(done => {
        const CUPS = 6; let k = 0, total = 0, lv = 0, target = 0, pouring = false, raf = 0, t0 = 0;
        ctl.area.innerHTML = `<div class="te"><p class="te-n" id="teN"></p><div class="te-cup" id="teCup"><i class="te-tea" id="teTea"></i><i class="te-line" id="teLine"></i><i class="te-pot" id="tePot"></i></div><p class="te-msg" id="teMsg">長押しで注ぐ・指をはなして止める</p></div>`;
        const cup = $('teCup');
        function next() {
          if (k >= CUPS) { window.removeEventListener('pointerup', release); window.removeEventListener('pointercancel', release); setTimeout(() => done(Math.min(220, total)), 600); return; }
          lv = 0; target = rnd(52, 86); $('teTea').style.height = '0%'; $('teLine').style.bottom = target + '%'; $('teN').textContent = `${k + 1} / ${CUPS} 杯目`;
          cup.classList.remove('over'); $('teMsg').textContent = '長押しで注ぐ・指をはなして止める';
          $('jgT').style.width = (1 - k / CUPS) * 100 + '%';
        }
        const speed = () => 34 + k * 7;   // 1秒に注げる量（%）
        const loop = now => { lv += speed() * (now - t0) / 1000; t0 = now; $('teTea').style.height = Math.min(100, lv) + '%';
          if (lv >= 100) { release(); return; } if (pouring) raf = requestAnimationFrame(loop); };
        function press(e) { e.preventDefault(); if (pouring || k >= CUPS || lv > 0) return; pouring = true; t0 = performance.now(); cup.classList.add('pour'); Sfx.play('page'); raf = requestAnimationFrame(loop); }
        function release() {
          if (!pouring) return; pouring = false; cancelAnimationFrame(raf); cup.classList.remove('pour');
          const d = Math.abs(lv - target), over = lv >= 100;
          const p = over ? 0 : d < 2 ? 36 : d < 5 ? 26 : d < 10 ? 15 : d < 18 ? 6 : 0;
          total += p; ctl.set(total);
          $('teMsg').textContent = over ? 'あふれた！' : d < 2 ? `ぴったり！ +${p}円` : d < 5 ? `おしい！ +${p}円` : `+${p}円`;
          if (over) cup.classList.add('over');
          if (p >= 26) { Sfx.play('perfect'); ctl.good(); } else if (p === 0) { Sfx.play('miss'); haptic(30); ctl.bad(over); } else Sfx.play('ok');
          k++; setTimeout(next, 900);
        }
        cup.parentElement.addEventListener('pointerdown', press);
        window.addEventListener('pointerup', release); window.addEventListener('pointercancel', release);
        next();
      });
    },
  };
  return { mount, SHOPS };
})();
