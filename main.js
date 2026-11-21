// アーカイブカード — 起動とタブ
'use strict';
const App = (() => {
  let tab = 'cab', seg = 'binder';
  function go(t, force) {
    if (t === tab && !force) return;
    tab = t;
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('on', p.id === 'pg-' + t));
    if (t === 'cab') Cabinet.mount($('pg-cab'));
    if (t === 'make') paintSeg();
    if (t === 'job') Job.mount($('pg-job'));
    Bgm.play(t);
  }
  function paintSeg(card, focus) {
    document.querySelectorAll('#mkSeg button').forEach(b => b.classList.toggle('on', b.dataset.seg === seg));
    if (seg === 'make') Maker.mount($('mkBody'), card); else Binder.mount($('mkBody'), focus);
  }
  function openBinder(focus) { seg = 'binder'; if (tab !== 'make') { tab = ''; go('make'); } paintSeg(null, focus); }
  function openMaker(card) { seg = 'make'; if (tab !== 'make') { tab = ''; go('make'); } paintSeg(card); }

  async function boot() {
    Wallet.onChange(y => { const e = $('hdYen'); if (!e) return; const old = +e.textContent || 0; e.textContent = y; if (y > old) { e.parentElement.classList.remove('up'); void e.offsetWidth; e.parentElement.classList.add('up'); } });
    const bonus = Day.check();
    await ACard.seed();
    document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => { Sfx.play('tap'); haptic(); go(b.dataset.tab); }));
    $('mkSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || b.dataset.seg === seg) return; Sfx.play('page'); seg = b.dataset.seg; paintSeg(); });
    const bg = $('hdBgm'); bg.classList.toggle('off', !Bgm.on);
    bg.addEventListener('click', () => { bg.classList.toggle('off', !Bgm.toggle()); });
    // タイトル：タップで音を鳴らせるようにしてから始める
    $('title').addEventListener('click', async () => {
      try { await ctx.resume(); } catch (e) {}
      Sfx.play('ok'); $('title').classList.add('out'); setTimeout(() => $('title').remove(), 700);
      tab = ''; go('cab');
      if (bonus) { await sleep(900); Wallet.add(bonus); Sfx.play('pay'); Cabinet.talk(Kisaki.line('bonus', bonus)); toast(`おこづかい +${bonus}円`); }
    }, { once:true });
    // 画面を戻したときに日付が変わっていたら
    document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') return; const b = Day.check(); if (b) { Wallet.add(b); toast(`おこづかい +${b}円`); if (tab === 'job') Job.mount($('pg-job')); } });
  }
  return { go, openBinder, openMaker, boot };
})();
App.boot();
