/* ============================================================
   GROZOV IMPERIUM — логика
   Один слушатель на document (делегирование).
   Никаких innerHTML-перерисовок целых секций — только точечно.
   Все данные — в localStorage через один слой D.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- ТАРИФЫ ---------- */
  const RANKS = {
    unassigned:{name:'Ожидает назначения',cat:'pending',r30:0,r60:0,norm:'—',ctrl:false,high:false,lvl:0},
    moderator:   {name:'Модератор',                cat:'server',r30:15,r60:30,norm:14,ctrl:false,high:false,lvl:0},
    sr_moderator:{name:'Старший модератор',        cat:'server',r30:20,r60:40,norm:16,ctrl:false,high:false,lvl:0},
    jr_admin:    {name:'Младший администратор',    cat:'server',r30:25,r60:50,norm:18,ctrl:false,high:false,lvl:0},
    admin:       {name:'Администратор',             cat:'server',r30:30,r60:60,norm:21,ctrl:false,high:false,lvl:0},
    sr_admin:    {name:'Старший администратор',     cat:'server',r30:38,r60:76,norm:21,ctrl:false,high:false,lvl:0},
    zgs:         {name:'ЗГС ГОСС / ОПГ',           cat:'server',r30:45,r60:90,norm:21,ctrl:false,high:false,lvl:0},
    gs:          {name:'ГС ГОСС / ОПГ',            cat:'server',r30:55,r60:110,norm:21,ctrl:false,high:false,lvl:0},
    curator:     {name:'Куратор администрации',    cat:'server',r30:65,r60:130,norm:21,ctrl:false,high:false,lvl:0},
    zga:         {name:'ЗГА',                      cat:'server',r30:78,r60:156,norm:'Своб.',ctrl:false,high:false,lvl:0},
    ga:          {name:'ГА (Руководитель)',        cat:'server',r30:110,r60:220,norm:'Рук-во',ctrl:false,high:false,lvl:0},
    main_tech:   {name:'ГТС',                      cat:'supreme',r30:0,r60:0,norm:'Контроль',ctrl:true,high:false,lvl:1},
    spec_admin:  {name:'Спец. Администратор',      cat:'supreme',r30:0,r60:0,norm:'Контроль',ctrl:true,high:false,lvl:1},
    dep_spec:    {name:'Зам. Спец. Администратора',cat:'supreme',r30:0,r60:0,norm:'Контроль',ctrl:true,high:false,lvl:1},
    dep_lead:    {name:'Зам. Руководителя Проекта',cat:'supreme',r30:0,r60:0,norm:'Контроль',ctrl:true,high:true,lvl:2},
    lead:        {name:'Руководитель Проекта',     cat:'supreme',r30:0,r60:0,norm:'Контроль',ctrl:true,high:true,lvl:2},
    zam_founder: {name:'Заместитель Основателя',   cat:'supreme',r30:0,r60:0,norm:'Владелец',ctrl:true,high:true,lvl:3},
    founder:     {name:'Основатель',               cat:'supreme',r30:0,r60:0,norm:'Создатель',ctrl:true,high:true,lvl:3}
  };

  const BONUSES = [
    {key:'bFriend', label:'Привёл друга',   hint:'Кандидат отстоял 7 дней',       amount:200, nick:true},
    {key:'bMp',     label:'МП / ГРП',        hint:'Одобренное мероприятие',        amount:150},
    {key:'bForum',  label:'Чистый форум',    hint:'Без просроченных жалоб',        amount:400},
    {key:'bMentor', label:'Обучение стажёра',hint:'Инструктаж и выпуск',           amount:100},
    {key:'bNight',  label:'Ночная смена',    hint:'7+ часов подряд',               amount:250}
  ];

  /* ---------- ХРАНИЛИЩЕ ---------- */
  const K = {
    users:'gi_u_v3', reports:'gi_r_v3', black:'gi_b_v3', audit:'gi_a_v3',
    tasks:'gi_t_v3', appeals:'gi_ap_v3', notifs:'gi_n_v3',
    pinL:'gi_pl_v3', pinF:'gi_pf_v3', cur:'gi_cu_v3', acc:'gi_ac_v3'
  };

  function read(k, def){
    try{ const v=localStorage.getItem(k); return v?JSON.parse(v):def; }catch(e){ return def; }
  }
  function write(k, v){
    try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){}
  }
  function str(k, def){ try{ return localStorage.getItem(k)||def; }catch(e){ return def; } }
  function sstr(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }
  function sread(k, def){ try{ return sessionStorage.getItem(k)||def; }catch(e){ return def; } }
  function swrite(k, v){ try{ sessionStorage.setItem(k, v); }catch(e){} }
  function sdel(k){ try{ sessionStorage.removeItem(k); }catch(e){} }

  /* При первом запуске база пуста. Никаких авто-владельцев.
   Первого владельца создаёшь ты сам через консоль — см. код ниже. */
let users = read(K.users, []);
if (!Array.isArray(users)) users = [];
write(K.users, users);
  let reports = read(K.reports, []);
  let black   = read(K.black, []);
  let audit   = read(K.audit, []);
  let tasks   = read(K.tasks, []);
  let appeals = read(K.appeals, []);
  let notifs  = read(K.notifs, []);
  let curId   = str(K.cur, users[0].id);
  let pinL    = str(K.pinL, 'imperium2026');
  let pinF    = str(K.pinF, 'founder2026');
  let access  = sread(K.acc, null);
  let anKey   = 'hours';
  let revId   = null;

  function persist(){
    write(K.users,users); write(K.reports,reports);
    write(K.black,black); write(K.tasks,tasks);
    write(K.appeals,appeals); write(K.notifs,notifs);
  }
  function me(){
    let u = users.find(x => x.id === curId);
    if (!u){ curId = users[0].id; sstr(K.cur,curId); u = users[0]; }
    return u;
  }
  function log(a, d){
    audit.unshift({id:Date.now(),a,d,t:new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'})});
    if (audit.length>80) audit.pop();
    write(K.audit, audit);
  }
  function pushNotif(ic, tx, cls){
    notifs.unshift({id:Date.now(),ic,tx,cls:cls||'',t:new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})});
    if (notifs.length>30) notifs.pop();
    persist();
  }

  /* ---------- ХЕЛПЕРЫ ---------- */
  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);
  const fmt = n => (n||0).toLocaleString('ru-RU');
  const today = () => new Date().toISOString().split('T')[0];
  const initials = n => n && n.includes('_')
    ? ((n.split('_')[0][0]||'')+(n.split('_')[1]?.[0]||'')).toUpperCase()
    : (n||'??').substring(0,2).toUpperCase();

  let toastT;
  function toast(m){
    const t = $('#toast');
    $('#toastMsg').textContent = m;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 2600);
  }
  function openM(id){ document.getElementById(id).classList.add('open'); }
  function closeM(id){ document.getElementById(id).classList.remove('open'); }
  function closeAllM(){ $$('.ov.open').forEach(o => o.classList.remove('open')); }

  /* ---------- НАВИГАЦИЯ ---------- */
  function go(tab){
    $$('.pane').forEach(p => p.classList.remove('on'));
    const pane = document.getElementById('p-' + tab);
    if (pane) pane.classList.add('on');
    $$('[data-go]').forEach(b => b.classList.toggle('on', b.dataset.go === tab));
    if (tab === 'cabinet')   renderCabinet();
    if (tab === 'registry'){ syncGate(); if (access) renderRegistry(); }
    if (tab === 'analytics'){ renderAnalytics(); renderCalendar(); }
    if (tab === 'tasks'){    renderTasks(); renderAppeals(); renderNotifs(); renderAchievements(); }
    window.scrollTo({top:0,behavior:'smooth'});
  }

  /* ---------- USER ---------- */
  function syncUser(){
    const u = me();
    const r = RANKS[u.rankKey] || RANKS.unassigned;
    const ini = initials(u.nick);

    $('#hAv').textContent = ini;
    $('#hNick').textContent = u.nick;
    $('#hRank').textContent = r.name;

    $('#cabAv').textContent = ini;
    $('#cabNick').textContent = u.nick;
    $('#cabRank').textContent = r.name;

    const f = $('#cabForum'), v = $('#cabVk');
    if (f) f.href = u.forum || '#';
    if (v) v.href = u.vk || '#';

    if (r.ctrl){
      $('#hBal').textContent = '⚜ Контроль';
      $('#cabBalBig').textContent = 'Контролирующий орган';
      $('#cabBalBox').style.display = 'none';
      $('#cabCta').style.display = 'none';
      $('#cabCtrl').classList.remove('hide');
      $('#ctrlBlock').classList.remove('hide');
      $('#repForm').style.display = 'none';
    } else {
      $('#hBal').textContent = fmt(u.balance) + ' БС';
      $('#cabBalBig').textContent = fmt(u.balance) + ' БС';
      $('#cabBalBox').style.display = 'block';
      $('#cabCta').style.display = '';
      $('#cabCtrl').classList.add('hide');
      $('#ctrlBlock').classList.add('hide');
      $('#repForm').style.display = '';
    }

    $('#cabPend').classList.toggle('hide', u.rankKey !== 'unassigned');

    $('#fNick').value = u.nick;
    $('#fRankName').value = r.name;
    $('#fRankKey').value = u.rankKey;
    $('#formWho').textContent = u.nick + ' (' + r.name + ')';

    const h = $('#fRankHint');
    if (u.rankKey === 'unassigned') h.innerHTML = '<span class="tr">⚠ Должность не назначена.</span>';
    else h.textContent = 'Ставка: ' + r.r30 + ' БС / 30 мин · ' + r.r60 + ' БС / ч';

    $('#mNick').textContent = u.nick;
    $('#mRank').textContent = r.name;
    $('#mBal').textContent = r.ctrl ? 'Руководство' : fmt(u.balance) + ' БС';
  }

  function copyLink(){
    const u = me();
    const base = location.href.split('#')[0];
    const link = base + '#assign=' + u.id;
    const txt = '⚜ GROZOV IMPERIUM\nНик: ' + u.nick + '\nID: ' + u.id + '\nСсылка: ' + link;
    if (navigator.clipboard){
      navigator.clipboard.writeText(txt).then(() => toast('📋 Ссылка скопирована')).catch(() => prompt('Ссылка:', link));
    } else prompt('Ссылка:', link);
  }

  function checkHash(){
    const h = location.hash;
    if (h && h.startsWith('#assign=')){
      const t = h.slice(8).trim();
      const u = users.find(x => x.id === t || x.nick.toLowerCase() === t.toLowerCase());
      if (u){
        toast('📍 Запрос для: ' + u.nick);
        go('registry');
        setTimeout(() => openAssign(u.id), 350);
      }
    }
  }

  /* ---------- КАБИНЕТ ---------- */
  function renderCabinet(){
    syncUser();
    const box = $('#myReps');
    const u = me();
    const mine = reports.filter(r => r.userId === u.id || r.nick.toLowerCase() === u.nick.toLowerCase());

    if (!mine.length){
      box.innerHTML = '<div class="empty-state muted" style="padding:24px 12px;text-align:center">Отчётов пока нет.</div>';
      return;
    }

    let html = '';
    for (let i = 0; i < mine.length; i++){
      const r = mine[i];
      const rk = RANKS[r.rankKey] || RANKS.unassigned;
      let st;
      if (r.status === 'pending') st = '<span class="pill pend">⏳ Ждёт</span>';
      else if (r.status === 'approved') st = '<span class="pill appr">✅ Одобрено</span>';
      else if (r.status === 'paid') st = '<span class="pill paid">💜 Выплачено</span>';
      else st = '<span class="pill rej">❌ Отклонено</span>';

      html += '<div class="rep">' +
        '<div class="rep-hd"><div>' +
          '<div class="muted">' + r.date + '</div>' +
          '<div style="font-weight:800;color:#FFF;font-size:13.5px;margin-top:2px">' +
            r.hDay + 'ч + ' + r.hNight + 'ч 🌙 + ' + r.hOver + 'ч ⚡' +
          '</div>' +
          '<div class="muted">' + rk.name + '</div>' +
        '</div><div style="text-align:right">' +
          '<div class="rep-sum">' + fmt(r.final || r.base) + ' БС</div>' +
          '<div style="margin-top:4px">' + st + '</div>' +
        '</div></div>' +
        '<div class="muted" style="margin-bottom:8px">💬 ' + r.comment + '</div>' +
        '<div class="rep-acts">' +
          '<a href="' + r.proof + '" target="_blank" rel="noopener" class="ts" style="font-size:11.5px;margin-right:auto">🔗 Скрины</a>' +
          (r.status === 'rejected' ? '<button class="ghost sm" data-appeal="' + r.id + '">⚖ Апелляция</button>' : '') +
        '</div></div>';
    }
    box.innerHTML = html;
  }

  /* ---------- БОНУСЫ ---------- */
  function renderBonuses(){
    const box = $('#bonusList');
    let html = '';
    for (let i = 0; i < BONUSES.length; i++){
      const b = BONUSES[i];
      html += '<label class="chk" data-bk="' + b.key + '" style="display:flex;justify-content:space-between;align-items:center;gap:10px;background:var(--bg3);border:1px solid var(--line);border-radius:10px;padding:11px 13px;margin-bottom:8px;cursor:pointer">' +
        '<span style="display:flex;gap:9px;align-items:flex-start">' +
          '<input type="checkbox" id="' + b.key + '" style="width:17px;height:17px;accent-color:var(--copper);margin-top:2px;flex:0 0 17px">' +
          '<span><b style="font-size:12.5px;color:var(--ink);display:block">' + b.label + '</b>' +
          '<i class="hint" style="font-style:normal">' + b.hint + '</i></span>' +
        '</span>' +
        '<span class="badge">+' + b.amount + ' БС</span>' +
      '</label>' +
      (b.nick ? '<div class="fld hide" id="' + b.key + 'NickG" style="margin-left:26px"><label>Ник кандидата<input type="text" id="' + b.key + 'Nick"></label></div>' : '');
    }
    box.innerHTML = html;
  }

  /* ---------- КАЛЬКУЛЯТОР ---------- */
  function calc(){
    const r = RANKS[$('#fRankKey').value] || RANKS.unassigned;
    const hD = parseFloat($('#hDay').value) || 0;
    const hN = parseFloat($('#hNight').value) || 0;
    const hO = parseFloat($('#hOver').value) || 0;

    const day   = Math.round(hD * r.r60);
    const night = Math.round(hN * r.r60 * 1.5);
    const over  = Math.round(hO * r.r60 * 1.25);

    let bonus = 0;
    for (let i = 0; i < BONUSES.length; i++){
      const b = BONUSES[i];
      const cb = document.getElementById(b.key);
      if (cb && cb.checked){
        bonus += b.amount;
        if (b.nick){ const g = document.getElementById(b.key+'NickG'); if (g) g.classList.remove('hide'); }
      } else if (b.nick){
        const g = document.getElementById(b.key+'NickG'); if (g) g.classList.add('hide');
      }
    }
    const total = day + night + over + bonus;

    $('#cTotal').textContent = fmt(total);
    $('#lDayH').textContent = hD;
    $('#lDayB').textContent = day + ' БС';
    $('#lNightH').textContent = hN;
    $('#lNightB').textContent = night + ' БС';
    $('#lOverH').textContent = hO;
    $('#lOverB').textContent = over + ' БС';
    $('#lBonus').textContent = '+' + bonus + ' БС';
    return {day, night, over, bonus, total};
  }

  /* ---------- ОТПРАВКА ОТЧЁТА ---------- */
  function submitReport(e){
    e.preventDefault();
    const u = me();
    const bl = black.find(b => b.nick.toLowerCase() === u.nick.toLowerCase());
    if (bl){ alert('⛔ Вы в ЧСА!'); return; }
    if (u.rankKey === 'unassigned'){ alert('❌ Должность не назначена!'); return; }
    const r = RANKS[u.rankKey];
    if (r && r.ctrl){ alert('⚜ Контролирующий состав не сдаёт отчёты.'); return; }

    const c = calc();
    const bl2 = [];
    for (let i = 0; i < BONUSES.length; i++){
      const b = BONUSES[i];
      const cb = document.getElementById(b.key);
      if (cb && cb.checked){
        if (b.nick){
          const nk = document.getElementById(b.key+'Nick').value || 'Кандидат';
          bl2.push(b.label + ' (' + nk + ') +' + b.amount);
        } else bl2.push(b.label + ' +' + b.amount);
      }
    }

    reports.unshift({
      id: Date.now(),
      userId: u.id,
      date: new Date().toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}),
      shiftDate: $('#shiftDate').value || today(),
      nick: u.nick,
      rankKey: u.rankKey,
      hDay: parseFloat($('#hDay').value) || 0,
      hNight: parseFloat($('#hNight').value) || 0,
      hOver: parseFloat($('#hOver').value) || 0,
      reps: parseInt($('#repCount').value) || 0,
      proof: $('#proofUrl').value.trim(),
      bonuses: bl2,
      base: c.total, final: c.total,
      penalties: 'Без взысканий',
      comment: $('#comment').value.trim() || 'Без примечаний',
      status: 'pending'
    });
    persist();
    log('Подача отчёта', u.nick + ' — ' + c.total + ' БС');
    pushNotif('📜', 'Новый отчёт от ' + u.nick + ' на ' + c.total + ' БС', 'new');
    toast('🚀 Отчёт отправлен!');

    $('#repForm').reset();
    $('#hDay').value = '0';
    $('#hNight').value = '0';
    $('#hOver').value = '0';
    $('#repCount').value = '0';
    $('#shiftDate').value = today();
    calc();
    go('cabinet');
  }

  function copyChat(){
    const u = me();
    const r = RANKS[u.rankKey] || RANKS.unassigned;
    const c = calc();
    const txt = '⚜ GROZOV IMPERIUM | ОТЧЁТ\n' +
      '👤 ' + u.nick + ' [' + r.name + ']\n' +
      '⏱ День: ' + ($('#hDay').value||0) + ' ч\n' +
      '🌙 Ночь ×1.5: ' + ($('#hNight').value||0) + ' ч\n' +
      '⚡ Овер +25%: ' + ($('#hOver').value||0) + ' ч\n' +
      '💬 Репортов: ' + ($('#repCount').value||0) + '\n' +
      '📸 Скрины: ' + ($('#proofUrl').value||'[ссылка]') + '\n' +
      '💰 Сумма: ' + c.total + ' БС';
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => toast('📋 Скопировано')).catch(() => alert(txt));
    else alert(txt);
  }

  function aiCheck(){
    const hD = parseFloat($('#hDay').value) || 0;
    const hN = parseFloat($('#hNight').value) || 0;
    const hO = parseFloat($('#hOver').value) || 0;
    const pr = $('#proofUrl').value.trim();
    const r = RANKS[$('#fRankKey').value] || RANKS.unassigned;
    const tot = hD + hN + hO;
    const bad = [], ok = [];
    if (tot === 0) bad.push('⚠ Все часы нулевые — отчёт отклонят.');
    if (tot > 60) bad.push('⚠ Более 60 ч за неделю — аномально.');
    if (tot > 0 && !pr) bad.push('⚠ Нет ссылки на скрины.');
    if (hN > hD * 2 && hN > 10) bad.push('⚠ Ночь сильно больше дня.');
    if (r.ctrl) bad.push('⚠ Контролирующий состав отчёты не сдаёт.');
    if (pr) ok.push('✔ Ссылка на скрины есть.');
    if (tot > 0 && tot <= 60) ok.push('✔ Часы в норме.');

    let h = '';
    if (bad.length) h += '<div class="tr" style="font-weight:700;margin-bottom:4px">Замечания:</div>' + bad.map(x => '<div class="tr">' + x + '</div>').join('');
    if (ok.length) h += '<div class="te" style="font-weight:700;margin:8px 0 4px">Ок:</div>' + ok.map(x => '<div class="te">' + x + '</div>').join('');
    if (!h) h = '<div class="muted">Недостаточно данных.</div>';
    $('#aiOut').innerHTML = h;
  }

  /* ---------- КАНЦЕЛЯРИЯ ---------- */
  function syncGate(){
    if (access){
      $('#gate').classList.add('hide');
      $('#work').classList.remove('hide');
      const tag = $('#accTag'), d = $('#accDesc');
      if (access === 'founder'){
        tag.textContent = '👑 ЗАМ. ОСНОВАТЕЛЯ';
        tag.className = 'pill pend';
        d.textContent = 'Полный контроль: любые должности, проверка отчётов, ЧСА.';
      } else {
        tag.textContent = '🛠 ГТС–РП';
        tag.className = 'pill paid';
        d.textContent = 'Проверка отчётов, выдача серверных должностей и ГТС/ЗСА.';
      }
    } else {
      $('#gate').classList.remove('hide');
      $('#work').classList.add('hide');
    }
  }

  function tryUnlock(e){
    e.preventDefault();
    const v = $('#pinIn').value.trim();
    if (v === pinF){ access = 'founder'; swrite(K.acc, 'founder'); syncGate(); renderRegistry(); log('Авторизация','Зам. Основателя'); toast('👑 Доступ активирован'); }
    else if (v === pinL){ access = 'project'; swrite(K.acc, 'project'); syncGate(); renderRegistry(); log('Авторизация','Руководство'); toast('🛠 Доступ активирован'); }
    else alert('❌ Неверный пароль! ЗГА и ГА доступа не имеют.');
    $('#pinIn').value = '';
  }

  function lockPanel(){
    access = null; sdel(K.acc); syncGate(); toast('🔒 Заблокировано');
  }

  function renderRegistry(){
    renderReports();
    renderRoster();
    renderLoad();
    renderAudit();
  }

  function renderReports(){
    const box = $('#repBox');
    const q  = ($('#fSearch')?.value || '').toLowerCase();
    const fs = $('#fStatus')?.value || 'all';
    const ft = $('#fType')?.value || 'all';

    let pend = 0, appr = 0;
    for (let i = 0; i < reports.length; i++){
      if (reports[i].status === 'pending') pend++;
      if (reports[i].status === 'approved' || reports[i].status === 'paid') appr++;
    }
    let bal = 0;
    for (let i = 0; i < users.length; i++) bal += users[i].balance || 0;

    $('#sBs').textContent = fmt(bal) + ' БС';
    $('#sAdmins').textContent = users.length;
    $('#sTotal').textContent = reports.length;
    $('#sPend').textContent = pend;
    $('#sAppr').textContent = appr;

    let html = '';
    for (let i = 0; i < reports.length; i++){
      const r = reports[i];
      const mq = r.nick.toLowerCase().includes(q);
      const ms = fs === 'all' || r.status === fs;
      let mt = true;
      if (ft === 'ga_zga') mt = (r.rankKey === 'ga' || r.rankKey === 'zga');
      else if (ft === 'server') mt = (r.rankKey !== 'ga' && r.rankKey !== 'zga');
      if (!mq || !ms || !mt) continue;

      const rk = RANKS[r.rankKey] || RANKS.unassigned;
      const gg = r.rankKey === 'zga' || r.rankKey === 'ga';
      let st;
      if (r.status === 'pending') st = '<span class="pill pend">⏳ Ждёт</span>';
      else if (r.status === 'approved') st = '<span class="pill appr">✅ Одобрено</span>';
      else if (r.status === 'paid') st = '<span class="pill paid">💜 Выплачено</span>';
      else st = '<span class="pill rej">❌ Отклонено</span>';
      const bn = r.bonuses && r.bonuses.length ? r.bonuses.join(', ') : 'нет';

      html += '<div class="rep ' + (gg?'hi':'') + '">' +
        '<div class="rep-hd">' +
          '<div class="rep-u">' +
            '<div class="rep-av">' + initials(r.nick) + '</div>' +
            '<div><div class="rep-n">' + r.nick + '</div><div class="rep-r">' + rk.name + '</div></div>' +
          '</div>' +
          '<div><div class="rep-sum">' + fmt(r.final || r.base) + ' БС</div><div style="margin-top:4px;text-align:right">' + st + '</div></div>' +
        '</div>' +
        '<div class="chips">' +
          '<div><span>Дата:</span> <b>' + r.date + '</b></div>' +
          '<div><span>Д:</span> <b>' + r.hDay + 'ч</b></div>' +
          '<div><span>Н:</span> <b>' + r.hNight + 'ч</b></div>' +
          '<div><span>О:</span> <b>' + r.hOver + 'ч</b></div>' +
          '<div><span>Реп:</span> <b>' + (r.reps||0) + '</b></div>' +
          '<div><span>Взыск:</span> <b class="' + (r.penalties!=='Без взысканий'?'tr':'') + '">' + r.penalties + '</b></div>' +
        '</div>' +
        '<div class="muted" style="margin-bottom:4px">🎁 <b>Премии:</b> ' + bn + '</div>' +
        '<div class="muted" style="margin-bottom:8px">💬 ' + r.comment + '</div>' +
        '<div class="rep-acts">' +
          '<a href="' + r.proof + '" target="_blank" rel="noopener" class="ts" style="font-size:11.5px;margin-right:auto">🔗 Скрины</a>' +
          (r.status === 'pending'
            ? '<button class="btn em sm" data-rev="' + r.id + '">⚖ Открыть</button><button class="btn cr sm" data-rej="' + r.id + '">❌</button>'
            : '<button class="ghost sm" data-reset="' + r.id + '">Сбросить</button>') +
        '</div>' +
      '</div>';
    }
    box.innerHTML = html || '<div class="card"><div class="muted" style="text-align:center;padding:20px">Отчётов нет.</div></div>';
  }

  function renderRoster(){
    const box = $('#roster');
    let html = '';
    for (let i = 0; i < users.length; i++){
      const u = users[i];
      const r = RANKS[u.rankKey] || RANKS.unassigned;
      const gg = u.rankKey === 'zga' || u.rankKey === 'ga';
      html += '<div class="rr" style="border-color:' + (r.ctrl?'rgba(217,83,79,.28)':(u.balance>0?'var(--line2)':'var(--line)')) + '">' +
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;min-width:0">' +
          '<b style="font-size:12.5px;color:#FFF">' + u.nick + '</b>' +
          '<span class="pill ' + (r.ctrl?'rej':'pend') + '" style="font-size:9.5px">' + r.name + (gg?' 🛡':'') + '</span>' +
        '</div>' +
        '<div style="display:flex;gap:8px;align-items:center">' +
          '<b class="mono" style="font-size:12.5px;color:' + (r.ctrl?'#F08080':(u.balance>0?'var(--copper)':'var(--ink3)')) + '">' + (r.ctrl?'Контроль':fmt(u.balance)+' БС') + '</b>' +
          '<button class="ghost sm" data-assign="' + u.id + '">Изменить</button>' +
        '</div>' +
      '</div>';
    }
    box.innerHTML = html;
  }

  function renderLoad(){
    const box = $('#loadChart');
    const data = {};
    for (let i = 0; i < reports.length; i++){
      const r = reports[i];
      if (r.status === 'rejected') continue;
      data[r.nick] = (data[r.nick] || 0) + r.hDay + r.hNight + r.hOver;
    }
    const arr = Object.keys(data).map(n => [n, data[n]]).sort((a,b) => b[1] - a[1]).slice(0, 10);
    if (!arr.length){ box.innerHTML = '<div class="muted">Нет данных.</div>'; return; }
    const max = Math.max.apply(null, arr.map(a => a[1])) || 1;
    let html = '';
    for (let i = 0; i < arr.length; i++){
      const n = arr[i][0], h = arr[i][1];
      html += '<div class="bar"><div class="bar-l"><span>' + n + '</span><b>' + h + ' ч</b></div>' +
        '<div class="bar-t"><div class="bar-f" style="width:' + Math.round(h/max*100) + '%"></div></div></div>';
    }
    box.innerHTML = html;
  }

  function renderAudit(){
    const box = $('#auditBox');
    if (!audit.length){ box.innerHTML = '<div class="muted">Записей нет.</div>'; return; }
    let html = '';
    for (let i = 0; i < audit.length; i++){
      const a = audit[i];
      html += '<div class="audit"><div><b class="tc">' + a.a + ':</b> <span style="color:var(--ink2)">' + a.d + '</span></div><span class="mono" style="color:var(--ink3);font-size:10px">' + a.t + '</span></div>';
    }
    box.innerHTML = html;
  }

  /* ---------- РЕВЬЮ ---------- */
  function openReview(id){
    const r = reports.find(x => x.id === id);
    if (!r) return;
    revId = id;
    $('#rvNick').textContent = r.nick;
    $('#rvRank').textContent = (RANKS[r.rankKey] || RANKS.unassigned).name;
    $('#rvBase').textContent = fmt(r.base) + ' БС';
    $('#rvProof').href = r.proof;
    $('#rvOral').value = '0';
    $('#rvStrict').value = '0';
    $('#rvManual').value = '0';
    $('#rvReason').value = '';
    recRev();
    openM('mRev');
  }
  function recRev(){
    const r = reports.find(x => x.id === revId);
    if (!r) return;
    const oral = parseInt($('#rvOral').value) || 0;
    const strict = parseInt($('#rvStrict').value) || 0;
    const man = parseInt($('#rvManual').value) || 0;
    const pct = Math.min(oral*10 + strict*25, 100);
    const fin = Math.max(0, r.base - Math.round(r.base*pct/100) - man);
    $('#rvFinal').textContent = fmt(fin) + ' БС';
    return {pct, man, fin};
  }
  function approveReport(){
    const r = reports.find(x => x.id === revId);
    if (!r) return;
    const c = recRev();
    const oral = parseInt($('#rvOral').value) || 0;
    const strict = parseInt($('#rvStrict').value) || 0;
    const rsn = $('#rvReason').value.trim();
    let pen = 'Без взысканий';
    if (c.pct > 0 || c.man > 0){
      pen = (oral>0?oral+' уст. ':'') + (strict>0?strict+' строг. ':'') + (c.man>0?'-'+c.man+'БС ':'') + (rsn?'('+rsn+')':'');
    }
    let u = users.find(x => x.id === r.userId) || users.find(x => x.nick.toLowerCase() === r.nick.toLowerCase());
    if (!u){
      u = {id:'user_'+Date.now(), nick:r.nick, forum:'https://forum.blackrussia.online', vk:'https://vk.com', rankKey:r.rankKey, balance:0, pass:'123'};
      users.push(u);
    }
    u.balance = (u.balance || 0) + c.fin;
    r.final = c.fin;
    r.penalties = pen;
    r.status = 'approved';
    persist();
    syncUser();
    renderReports();
    renderRoster();
    renderCabinet();
    closeM('mRev');
    log('Одобрение', u.nick + ': ' + c.fin + ' БС');
    pushNotif('✅', 'Одобрен отчёт ' + u.nick + ' на ' + c.fin + ' БС', 'new');
    toast('✅ Одобрено! ' + c.fin + ' БС зачислено');
  }
  function rejectFromModal(){ if (revId){ quickReject(revId); closeM('mRev'); } }
  function quickReject(id){
    const r = reports.find(x => x.id === id);
    if (!r) return;
    r.status = 'rejected';
    persist();
    renderReports();
    renderCabinet();
    log('Отклонение', 'Отчёт ' + r.nick);
    pushNotif('❌', 'Отчёт ' + r.nick + ' отклонён');
    toast('❌ Отклонён');
  }
  function resetRep(id){
    const r = reports.find(x => x.id === id);
    if (!r) return;
    if (r.status === 'approved'){
      const u = users.find(x => x.id === r.userId || x.nick.toLowerCase() === r.nick.toLowerCase());
      if (u && u.balance >= (r.final || r.base)) u.balance -= (r.final || r.base);
    }
    r.status = 'pending';
    persist();
    syncUser();
    renderReports();
    renderCabinet();
    toast('Сброшено на рассмотрение');
  }

  /* ---------- НАЗНАЧЕНИЕ ---------- */
  function openAssign(presel){
    const us = $('#asUser');
    let uo = '';
    for (let i = 0; i < users.length; i++){
      const u = users[i];
      uo += '<option value="' + u.id + '">' + u.nick + ' [' + (RANKS[u.rankKey] || RANKS.unassigned).name + ']</option>';
    }
    us.innerHTML = uo;
    if (presel) us.value = presel;

    let h = '<optgroup label="Ожидание"><option value="unassigned">⏳ Ожидает назначения</option></optgroup>';
    h += '<optgroup label="Серверная ветка">';
    for (const k in RANKS){ if (RANKS[k].cat === 'server') h += '<option value="' + k + '">' + RANKS[k].name + ' (' + RANKS[k].r60 + ' БС/ч)</option>'; }
    h += '</optgroup>';
    h += '<optgroup label="⚜ ГТС, ЗСА, Спец. Админ">';
    for (const k in RANKS){ const v = RANKS[k]; if (v.cat === 'supreme' && v.lvl === 1) h += '<option value="' + k + '">⚜ ' + v.name + '</option>'; }
    h += '</optgroup>';
    h += '<optgroup label="⚜ ЗРП и РП (Зам. Основателя)">';
    for (const k in RANKS){ const v = RANKS[k]; if (v.cat === 'supreme' && v.lvl === 2){
      const lock = access !== 'founder';
      h += '<option value="' + k + '">⚜ ' + v.name + (lock?' [🔒]':'') + '</option>';
    } }
    h += '</optgroup>';
    h += '<optgroup label="⚜ Владельцы (Зам. Основателя)">';
    for (const k in RANKS){ const v = RANKS[k]; if (v.cat === 'supreme' && v.lvl === 3){
      const lock = access !== 'founder';
      h += '<option value="' + k + '">⚜ ' + v.name + (lock?' [🔒]':'') + '</option>';
    } }
    h += '</optgroup>';
    $('#asRank').innerHTML = h;

    syncAssign();
    openM('mAssign');
  }
  function syncAssign(){
    const u = users.find(x => x.id === $('#asUser').value);
    if (u) $('#asRank').value = u.rankKey || 'unassigned';
    checkSupreme();
  }
  function checkSupreme(){
    const info = RANKS[$('#asRank').value];
    const box = $('#founderBox');
    const hint = $('#asHint');
    if (info && info.high && access !== 'founder'){
      box.classList.remove('hide');
      hint.textContent = '⚠ Выдаёт только Зам. Основателя!';
    } else {
      box.classList.add('hide');
      hint.textContent = info && info.high ? '👑 Вы Зам. Основателя.' : '';
    }
  }
  function saveAssign(){
    const uid = $('#asUser').value;
    const nk = $('#asRank').value;
    const info = RANKS[nk];
    const u = users.find(x => x.id === uid);
    if (!u){ alert('Не найден'); return; }
    const bl = black.find(b => b.nick.toLowerCase() === u.nick.toLowerCase());
    if (bl){ alert('⛔ ' + u.nick + ' в ЧСА: ' + bl.reason); return; }
    if (info && info.high && access !== 'founder'){
      if ($('#founderPass').value.trim() !== pinF){ alert('❌ Неверный мастер-пароль'); return; }
    }
    const old = (RANKS[u.rankKey] || {}).name;
    u.rankKey = nk;
    persist();
    syncUser();
    renderReports();
    renderRoster();
    closeM('mAssign');
    log('Назначение', u.nick + ': [' + old + '] → [' + info.name + ']');
    pushNotif('👑', 'Назначена должность ' + info.name + ' — ' + u.nick, 'new');
    toast('👑 ' + u.nick + ': ' + info.name);
  }

  /* ---------- ВЫПЛАТА ---------- */
  function openPayout(){
    const box = $('#payList');
    let sum = 0, html = '';
    for (let i = 0; i < users.length; i++){
      const u = users[i];
      if ((u.balance||0) > 0){
        sum += u.balance;
        html += '<div class="fb"><span>' + u.nick + ' (' + (RANKS[u.rankKey]||{}).name + '):</span><b class="tc">' + fmt(u.balance) + ' БС</b></div>';
      }
    }
    $('#payTotal').textContent = fmt(sum) + ' БС';
    box.innerHTML = html || '<div class="muted">Все балансы равны 0.</div>';
    openM('mPay');
  }
  function confirmPayout(){
    let sum = 0, cnt = 0;
    for (let i = 0; i < users.length; i++){
      if ((users[i].balance||0) > 0){ sum += users[i].balance; cnt++; users[i].balance = 0; }
    }
    if (!cnt){ alert('Нет средств!'); closeM('mPay'); return; }
    for (let i = 0; i < reports.length; i++){
      if (reports[i].status === 'approved') reports[i].status = 'paid';
    }
    persist();
    syncUser();
    renderReports();
    renderRoster();
    renderCabinet();
    closeM('mPay');
    log('Выплата', 'Выдано ' + fmt(sum) + ' БС');
    pushNotif('💸', 'Выплата на ' + fmt(sum) + ' БС завершена', 'new');
    toast('🎉 Выплата ' + fmt(sum) + ' БС');
  }

  /* ---------- ЧСА ---------- */
  function renderBlack(){
    const box = $('#blackList');
    if (!black.length){ box.innerHTML = '<div class="muted">Пусто.</div>'; return; }
    let html = '';
    for (let i = 0; i < black.length; i++){
      const b = black[i];
      html += '<div style="background:var(--bg3);border:1px solid rgba(217,83,79,.3);border-radius:9px;padding:8px 10px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;gap:8px">' +
        '<div><b style="color:#FFF;font-size:12.5px">' + b.nick + '</b><div class="tr" style="font-size:11px">' + b.reason + ' (' + b.date + ')</div></div>' +
        '<button class="ghost sm" data-rmblack="' + b.id + '">Вынести</button></div>';
    }
    box.innerHTML = html;
  }
  function addBlack(e){
    e.preventDefault();
    const n = $('#blNick').value.trim();
    const r = $('#blReason').value.trim();
    if (black.find(b => b.nick.toLowerCase() === n.toLowerCase())){ alert('Уже в ЧСА'); return; }
    black.unshift({id:Date.now(),nick:n,reason:r,date:new Date().toLocaleDateString('ru-RU')});
    persist();
    renderBlack();
    log('ЧСА', n + ' — ' + r);
    pushNotif('⛔', n + ' в ЧСА: ' + r);
    $('#blNick').value = '';
    $('#blReason').value = '';
    toast('⛔ ' + n + ' в ЧСА');
  }
  function removeBlack(id){
    black = black.filter(b => b.id !== id);
    persist();
    renderBlack();
    toast('Вынесен из ЧСА');
  }

  /* ---------- АНАЛИТИКА / КАЛЕНДАРЬ ---------- */
  function renderAnalytics(){
    const box = $('#anBox');
    const data = {};
    for (let i = 0; i < reports.length; i++){
      const r = reports[i];
      if (r.status === 'rejected') continue;
      if (!data[r.nick]) data[r.nick] = {hours:0, bs:0, reports:0};
      data[r.nick].hours += r.hDay + r.hNight + r.hOver;
      data[r.nick].bs += r.final || r.base || 0;
      data[r.nick].reports++;
    }
    const arr = Object.keys(data).map(n => [n, data[n]]).sort((a,b) => b[1][anKey] - a[1][anKey]).slice(0, 12);
    if (!arr.length){ box.innerHTML = '<div class="muted">Нет данных.</div>'; return; }
    const max = Math.max.apply(null, arr.map(a => a[1][anKey])) || 1;
    let html = '';
    for (let i = 0; i < arr.length; i++){
      const n = arr[i][0], v = arr[i][1][anKey];
      const lbl = anKey === 'hours' ? v + ' ч' : anKey === 'bs' ? fmt(v) + ' БС' : v;
      html += '<div class="bar"><div class="bar-l"><span>' + n + '</span><b>' + lbl + '</b></div>' +
        '<div class="bar-t"><div class="bar-f" style="width:' + Math.round(v/max*100) + '%"></div></div></div>';
    }
    box.innerHTML = html;
  }

  function renderCalendar(){
    const box = $('#calBox');
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const first = new Date(y, m, 1);
    const start = (first.getDay() + 6) % 7;
    const days = new Date(y, m+1, 0).getDate();
    const mn = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
    const dn = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

    const map = {};
    for (let i = 0; i < reports.length; i++){
      const r = reports[i];
      if (!r.shiftDate) continue;
      const d = new Date(r.shiftDate);
      if (d.getFullYear() === y && d.getMonth() === m){
        map[d.getDate()] = (map[d.getDate()] || 0) + r.hDay + r.hNight + r.hOver;
      }
    }

    let html = '<div class="cal-h">' + mn[m] + ' ' + y + '</div><div class="cal">';
    for (let i = 0; i < 7; i++) html += '<div class="cal-d">' + dn[i] + '</div>';
    for (let i = 0; i < start; i++) html += '<div class="cal-c empty"></div>';
    for (let d = 1; d <= days; d++){
      const h = map[d] || 0;
      const cls = 'cal-c' + (h?' has':'') + (d === now.getDate()?' today':'');
      html += '<div class="' + cls + '"><div class="d">' + d + '</div>' + (h?'<div class="h">'+h+'ч</div>':'') + '</div>';
    }
    html += '</div>';
    box.innerHTML = html;
  }

  /* ---------- ЗАДАЧИ / АПЕЛЛЯЦИИ / УВЕДОМЛЕНИЯ / ДОСТИЖЕНИЯ ---------- */
  function renderTasks(){
    const box = $('#taskList');
    if (!tasks.length){ box.innerHTML = '<div class="muted">Пусто.</div>'; return; }
    const col = {normal:'var(--ink3)', high:'var(--am)', urgent:'var(--cr)'};
    let html = '';
    for (let i = 0; i < tasks.length; i++){
      const t = tasks[i];
      html += '<div class="task ' + (t.done?'done':'') + '">' +
        '<input type="checkbox" ' + (t.done?'checked':'') + ' data-tgt="' + t.id + '">' +
        '<div class="task-b"><div class="task-t">' + t.title + '</div>' +
        '<div class="task-d"><span style="color:' + col[t.prio] + ';font-weight:700">' +
          (t.prio==='urgent'?'🔴 срочно':t.prio==='high'?'🟡 высокий':'⚪ обычный') + '</span>' +
          (t.date?' · до '+t.date:'') + '</div></div>' +
        '<button class="ghost sm" data-tdl="' + t.id + '">✕</button></div>';
    }
    box.innerHTML = html;
  }
  function addTask(e){
    e.preventDefault();
    const t = $('#taskTitle').value.trim();
    if (!t) return;
    tasks.unshift({id:Date.now(), title:t, prio:$('#taskPrio').value, date:$('#taskDate').value, done:false});
    persist();
    renderTasks();
    $('#taskTitle').value = '';
    toast('🗂 Добавлено');
  }

  function renderAppeals(){
    const box = $('#appealList');
    if (!appeals.length){ box.innerHTML = '<div class="muted">Пусто.</div>'; return; }
    let html = '';
    for (let i = 0; i < appeals.length; i++){
      const a = appeals[i];
      const cls = 'appeal' + (a.status==='accepted'?' res':a.status==='rejected'?' rej':'');
      html += '<div class="' + cls + '">' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:5px"><b style="color:#FFF;font-size:12.5px">' + a.nick + '</b><small class="muted">' + a.date + '</small></div>' +
        '<div class="muted" style="margin-bottom:8px">' + a.reason + '</div>' +
        (a.status === 'pending'
          ? '<div style="display:flex;gap:6px"><button class="btn em sm" data-apok="' + a.id + '">✅</button><button class="btn cr sm" data-apno="' + a.id + '">❌</button></div>'
          : '<span class="pill ' + (a.status==='accepted'?'appr':'rej') + '">' + (a.status==='accepted'?'✅ Удовлетворена':'❌ Отклонена') + '</span>') +
      '</div>';
    }
    box.innerHTML = html;
  }

  function renderNotifs(){
    const box = $('#notifList');
    if (!notifs.length){ box.innerHTML = '<div class="muted">Пусто.</div>'; return; }
    let html = '';
    for (let i = 0; i < notifs.length; i++){
      const n = notifs[i];
      html += '<div class="notif ' + (n.cls||'') + '"><div class="notif-ic">' + n.ic + '</div><div class="notif-tx">' + n.tx + '</div><div class="notif-tm">' + n.t + '</div></div>';
    }
    box.innerHTML = html;
  }

  function renderAchievements(){
    const box = $('#achBox');
    const data = {};
    for (let i = 0; i < reports.length; i++){
      const r = reports[i];
      if (r.status === 'rejected') continue;
      if (!data[r.nick]) data[r.nick] = {hours:0, bs:0, reports:0, night:0};
      data[r.nick].hours += r.hDay + r.hNight + r.hOver;
      data[r.nick].bs += r.final || r.base || 0;
      data[r.nick].reports++;
      data[r.nick].night += r.hNight;
    }
    const ach = [];
    for (const n in data){
      const v = data[n];
      if (v.hours >= 50) ach.push({n, ic:'🏆', t:'Марафонец', d:v.hours+' ч'});
      else if (v.hours >= 30) ach.push({n, ic:'🥈', t:'Активный', d:v.hours+' ч'});
      if (v.reports >= 5) ach.push({n, ic:'📜', t:'Исполнительный', d:v.reports+' отчётов'});
      if (v.night >= 15) ach.push({n, ic:'🌙', t:'Ночной страж', d:v.night+' ночн. ч'});
      if (v.bs >= 1000) ach.push({n, ic:'💎', t:'Высокий доход', d:fmt(v.bs)+' БС'});
    }
    if (!ach.length){ box.innerHTML = '<div class="muted">Появятся позже.</div>'; return; }
    let html = '';
    for (let i = 0; i < Math.min(ach.length, 12); i++){
      const a = ach[i];
      html += '<div style="display:flex;gap:10px;padding:9px 11px;background:var(--bg3);border:1px solid var(--line);border-radius:10px;margin-bottom:6px">' +
        '<div style="font-size:17px">' + a.ic + '</div><div><b style="font-size:12.5px;color:var(--ink)">' + a.n + ' — ' + a.t + '</b><div class="muted">' + a.d + '</div></div></div>';
    }
    box.innerHTML = html;
  }

  /* ---------- АККАУНТЫ ---------- */
  function renderAccs(){
    const box = $('#accList');
    let html = '';
    for (let i = 0; i < users.length; i++){
      const u = users[i];
      const cur = u.id === curId;
      const r = RANKS[u.rankKey] || RANKS.unassigned;
      html += '<div class="accrow ' + (cur?'cur':'') + '" data-pick="' + u.id + '">' +
        '<div style="display:flex;gap:9px;align-items:center;min-width:0">' +
          '<div class="rep-av" style="width:28px;height:28px;font-size:11px;flex:0 0 28px">' + initials(u.nick) + '</div>' +
          '<div><b style="font-size:12.5px;color:#FFF;display:block">' + u.nick + (cur?' <span class="tc" style="font-size:10px">(вы)</span>':'') + '</b>' +
          '<small class="muted">' + r.name + '</small></div>' +
        '</div>' +
        '<b class="mono" style="font-size:12.5px;color:' + (r.ctrl?'#F08080':'var(--copper)') + '">' + (r.ctrl?'Контроль':fmt(u.balance)+' БС') + '</b>' +
      '</div>';
    }
    box.innerHTML = html;
  }
  function pickAcc(id){
    if (users.find(u => u.id === id)){
      curId = id;
      sstr(K.cur, id);
      syncUser();
      renderCabinet();
      closeM('mAcc');
      toast('👤 ' + me().nick);
    }
  }
  function register(e){
    e.preventDefault();
    const n = $('#rNick').value.trim();
    const f = $('#rForum').value.trim();
    const v = $('#rVk').value.trim();
    const p = $('#rPass').value.trim();
    if (black.find(b => b.nick.toLowerCase() === n.toLowerCase())){ alert('⛔ Ник в ЧСА!'); return; }
    if (users.find(u => u.nick.toLowerCase() === n.toLowerCase())){ alert('Ник занят!'); return; }
    const u = {id:'user_'+Date.now(), nick:n, forum:f, vk:v, rankKey:'unassigned', balance:0, pass:p};
    users.push(u);
    curId = u.id;
    sstr(K.cur, curId);
    persist();
    log('Регистрация', n);
    pushNotif('👤', 'Зарегистрирован ' + n);
    $('#regForm').reset();
    closeM('mAcc');
    syncUser();
    renderCabinet();
    toast('👑 ' + n + ' создан!');
  }

  /* ---------- ПАРОЛИ / CSV / ТАРИФЫ ---------- */
  function changePin(e){
    e.preventDefault();
    const t = $('#pcType').value;
    const old = $('#pcOld').value.trim();
    const nw = $('#pcNew').value.trim();
    const cf = $('#pcConf').value.trim();
    const exp = t === 'founder' ? pinF : pinL;
    if (old !== exp){ alert('Старый неверен!'); return; }
    if (nw !== cf){ alert('Не совпадают!'); return; }
    if (t === 'founder'){ pinF = nw; sstr(K.pinF, nw); log('Пароль', 'Зам. Основателя'); toast('👑 Обновлён'); }
    else { pinL = nw; sstr(K.pinL, nw); log('Пароль', 'Руководство'); toast('🔑 Обновлён'); }
    closeM('mPin');
    $('#pcOld').value = ''; $('#pcNew').value = ''; $('#pcConf').value = '';
  }

  function exportCSV(){
    let csv = 'Ник;Должность;Статус;Форум;ВК;Баланс\n';
    for (let i = 0; i < users.length; i++){
      const u = users[i];
      const r = RANKS[u.rankKey] || RANKS.unassigned;
      csv += '"' + u.nick + '";"' + r.name + '";"' + (r.ctrl?'Контроль':'ЗП') + '";"' + (u.forum||'') + '";"' + (u.vk||'') + '";"' + (u.balance||0) + '"\n';
    }
    const b = new Blob(['\uFEFF' + csv], {type:'text/csv;charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = 'GROZOV_IMPERIUM_' + new Date().toLocaleDateString('ru-RU') + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('📥 CSV выгружен');
  }

  function renderTariffs(){
    const box = $('#tariffBox');
    let html = '';
    for (const k in RANKS){
      if (k === 'unassigned') continue;
      const v = RANKS[k];
      const gg = k === 'zga' || k === 'ga';
      const night = Math.round(v.r60 * 1.5);
      const over = Math.round(v.r60 * 1.25);
      html += '<div class="trow ' + (v.ctrl?'ctrl':(gg?'gg':'')) + '">' +
        '<div class="trow-l"><div class="trow-n">' + v.name + '</div>' +
        '<div class="trow-m">' + (v.ctrl?'Контролирующий орган':(gg?'Сдаёт отчёт (ЗП)':'Серверный состав')) + '</div></div>' +
        '<div class="trow-r">' +
          (v.ctrl
            ? '<b>—</b><small>без БС</small>'
            : '<b>' + v.r60 + ' БС/ч</b><small>ночь ' + night + ' · овер ' + over + '</small>') +
          '<small>Норма: ' + (typeof v.norm === 'number' ? v.norm + ' ч' : v.norm) + '</small>' +
        '</div>' +
      '</div>';
    }
    box.innerHTML = html;
  }

  /* ---------- ДЕЛЕГИРОВАНИЕ СОБЫТИЙ ---------- */
  function bind(){
    document.addEventListener('click', function(e){
      const t = e.target;

      const goBtn = t.closest('[data-go]');
      if (goBtn){ e.preventDefault(); go(goBtn.dataset.go); return; }

      const closeBtn = t.closest('[data-close]');
      if (closeBtn){ e.preventDefault(); closeAllM(); return; }

      const act = t.closest('[data-act]');
      if (act){
        const a = act.dataset.act;
        if (a === 'acc'){ renderAccs(); openM('mAcc'); }
        else if (a === 'copy') copyLink();
        else if (a === 'copychat') copyChat();
        else if (a === 'aicheck') aiCheck();
        else if (a === 'payout') openPayout();
        else if (a === 'assign') openAssign();
        else if (a === 'black'){ renderBlack(); openM('mBlack'); }
        else if (a === 'csv') exportCSV();
        else if (a === 'pin') openM('mPin');
        else if (a === 'lock') lockPanel();
        else if (a === 'clra'){ audit = []; write(K.audit, audit); renderAudit(); toast('Очищено'); }
        else if (a === 'approve') approveReport();
        else if (a === 'reject') rejectFromModal();
        else if (a === 'saveAssign') saveAssign();
        else if (a === 'confirmPayout') confirmPayout();
        else if (a === 'sendAppeal') sendAppeal();
      }

      const rev = t.closest('[data-rev]');
      if (rev) openReview(parseInt(rev.dataset.rev));

      const rej = t.closest('[data-rej]');
      if (rej) quickReject(parseInt(rej.dataset.rej));

      const rst = t.closest('[data-reset]');
      if (rst) resetRep(parseInt(rst.dataset.reset));

      const asn = t.closest('[data-assign]');
      if (asn) openAssign(asn.dataset.assign);

      const rmb = t.closest('[data-rmblack]');
      if (rmb) removeBlack(parseInt(rmb.dataset.rmblack));

      const pk = t.closest('[data-pick]');
      if (pk) pickAcc(pk.dataset.pick);

      const ap = t.closest('[data-appeal]');
      if (ap){ window._apRep = parseInt(ap.dataset.appeal); $('#apReason').value = ''; openM('mAppeal'); }

      const aok = t.closest('[data-apok]');
      if (aok){ const a = appeals.find(x => x.id === parseInt(aok.dataset.apok)); if (a){ a.status = 'accepted'; persist(); renderAppeals(); toast('✅'); } }

      const ano = t.closest('[data-apno]');
      if (ano){ const a = appeals.find(x => x.id === parseInt(ano.dataset.apno)); if (a){ a.status = 'rejected'; persist(); renderAppeals(); toast('❌'); } }

      const tgt = t.closest('[data-tgt]');
      if (tgt){ const tsk = tasks.find(x => x.id === parseInt(tgt.dataset.tgt)); if (tsk){ tsk.done = !tsk.done; persist(); renderTasks(); } }

      const tdl = t.closest('[data-tdl]');
      if (tdl){ tasks = tasks.filter(x => x.id !== parseInt(tdl.dataset.tdl)); persist(); renderTasks(); }

      // Клик по фону модалки — закрыть
      if (t.classList && t.classList.contains('ov')) t.classList.remove('open');
    });

    // Escape
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllM(); });

    // Формы
    $('#repForm').addEventListener('submit', submitReport);
    $('#gateForm').addEventListener('submit', tryUnlock);
    $('#regForm').addEventListener('submit', register);
    $('#taskForm').addEventListener('submit', addTask);
    $('#blackForm').addEventListener('submit', addBlack);
    $('#pinForm').addEventListener('submit', changePin);

    // Калькулятор: только 4 инпута, слушаем на форме через делегирование
    $('#repForm').addEventListener('input', function(e){
      const id = e.target.id;
      if (id === 'hDay' || id === 'hNight' || id === 'hOver' || id === 'repCount') calc();
    });

    // Чекбоксы бонусов
    $('#bonusList').addEventListener('click', function(e){
      const lbl = e.target.closest('[data-bk]');
      if (!lbl) return;
      if (e.target.tagName === 'INPUT'){ setTimeout(calc, 0); return; }
      const cb = lbl.querySelector('input[type=checkbox]');
      if (cb){ cb.checked = !cb.checked; calc(); }
    });

    // Фильтры
    $('#fSearch').addEventListener('input', renderReports);
    $('#fStatus').addEventListener('change', renderReports);
    $('#fType').addEventListener('change', renderReports);

    // Subtabs аналитики
    $('#anTabs').addEventListener('click', function(e){
      const b = e.target.closest('button[data-an]');
      if (!b) return;
      anKey = b.dataset.an;
      $$('#anTabs button').forEach(x => x.classList.toggle('on', x === b));
      renderAnalytics();
    });

    // Назначение
    $('#asUser').addEventListener('change', syncAssign);
    $('#asRank').addEventListener('change', checkSupreme);

    // Review пересчёт
    ['rvOral','rvStrict','rvManual'].forEach(function(id){
      const el = document.getElementById(id);
      el.addEventListener('input', recRev);
      el.addEventListener('change', recRev);
    });
  }

  function sendAppeal(){
    const rsn = $('#apReason').value.trim();
    if (!rsn){ alert('Укажите причину'); return; }
    const r = reports.find(x => x.id === window._apRep);
    if (!r) return;
    appeals.unshift({
      id: Date.now(), reportId: r.id, nick: r.nick, reason: rsn, status: 'pending',
      date: new Date().toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})
    });
    persist();
    renderAppeals();
    closeM('mAppeal');
    pushNotif('⚖', 'Апелляция от ' + r.nick, 'new');
    toast('⚖ Подана');
  }

  /* ---------- СТАРТ ---------- */
  window.addEventListener('DOMContentLoaded', function(){
    renderBonuses();
    renderTariffs();
    syncUser();
    calc();
    renderCabinet();
    renderReports();
    renderBlack();
    renderAudit();
    renderTasks();
    renderAppeals();
    renderNotifs();
    renderAchievements();
    syncGate();
    renderAnalytics();
    renderCalendar();
    checkHash();

    $('#shiftDate').value = today();
    $('#taskDate').value = today();

   /* ============================================================
   МАСТЕР-КОМАНДА: создать владельца.
   Открыть в браузере консоль (F12 → Console) и выполнить:
       __createOwner('Твой_Ник', 'твойПароль')
   Только ты знаешь эту команду. Больше никто владельцем не станет.
   ============================================================ */
window.__createOwner = function(nick, pass){
  if (!nick || !pass){ console.log('Формат: __createOwner("Nick_Name", "пароль")'); return; }
  if (users.find(u => u.nick === nick)){ console.log('Такой ник уже есть'); return; }
  const u = {
    id: 'owner_' + Date.now(),
    nick,
    forum: '',
    vk: '',
    rankKey: 'zam_founder',
    balance: 0,
    pass
  };
  users.push(u);
  curId = u.id;
  sstr(K.cur, curId);
  persist();
  console.log('👑 Владелец ' + nick + ' создан. Обнови страницу.');
  location.reload();
};

/* Мастер-сброс: если потерял доступ и нужно пересоздать владельца */
window.__resetOwner = function(nick, pass){
  users = users.filter(u => u.rankKey !== 'zam_founder' && u.rankKey !== 'founder');
  persist();
  __createOwner(nick, pass);
};
     bind();
  });
})();
