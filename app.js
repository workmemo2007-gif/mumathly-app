import { sb, S, $, $$, esc, can, toast, normPhone, upload, loadPerms, loadUsers, unsub, beep, webNotify, ic, ava, applyTheme, THEMES, canAdmin, fmt } from './core.js';
import * as V1 from './views1.js';
import * as V2 from './views2.js';
const app = $('#app');
const toEmail = p => normPhone(p).replace('+', '') + '@momathili.app'; // الدخول برقم الهاتف عبر بريد داخلي (بدون SMS)
const ROLE = { student: 'طالب', supervisor: 'مشرف', representative: 'الممثل الأعلى' };
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

/* ===== شاشات الدخول ===== */
function authScreen(mode = 'login') {
  const su = mode === 'signup';
  app.innerHTML = `<div class="authwrap"><div class="themebar"><span>مظهر التطبيق:</span><div>${THEMES.map(t => `<button type="button" class="dot" data-th="${t.k}" title="${t.name}" aria-label="${t.name}" style="background:linear-gradient(135deg,${t.sw[2]},${t.sw[1]})"></button>`).join('')}</div></div>
    <div class="brand"><div class="logo">${ic('book', 38)}</div><h1>ممثلي</h1><p>منصة إدارة شؤون الشعبة الجامعية</p></div>
    <div class="acard"><div class="seg"><button data-m="login" class="${su ? '' : 'on'}">تسجيل الدخول</button><button data-m="signup" class="${su ? 'on' : ''}">إنشاء حساب</button></div>
    ${su ? '<label for="n">الاسم الكامل (الثلاثي)</label><input id="n" autocomplete="name" placeholder="مثال: مرتضى جاسم محمد">' : ''}
    <label for="p">رقم الهاتف</label><div class="fld"><input id="p" type="tel" dir="ltr" placeholder="07XXXXXXXXX" autocomplete="tel">${ic('phone', 20)}</div>
    <label for="w">كلمة المرور</label><div class="fld"><input id="w" type="password" placeholder="6 أحرف على الأقل" autocomplete="${su ? 'new-password' : 'current-password'}">${ic('lock', 20)}</div>
    ${su ? `<div class="upl2"><label class="upl"><input id="a" type="file" accept="image/*" hidden><span id="ab">${ic('camera', 22)}الصورة الشخصية</span></label><label class="upl"><input id="c" type="file" accept="image/*,application/pdf" hidden><span id="cb">${ic('idcard', 22)}البطاقة الجامعية</span></label></div>
    <div class="note">${ic('info', 16)}<span>يخضع الحساب الجديد لمراجعة وموافقة <b>ممثل الشعبة</b> للتحقق من الهوية الجامعية قبل التفعيل.</span></div>` : ''}
    <div class="err" id="e" role="alert"></div><button class="btn big" id="go">${su ? 'إرسال طلب الانضمام' : 'دخول إلى الشعبة'}</button></div>
    <p class="foot">تطبيق «ممثلي» · مصمم لطلبة الجامعات</p></div>`;
  $$('[data-m]').forEach(b => b.onclick = () => authScreen(b.dataset.m));
  $$('[data-th]').forEach(b => b.onclick = () => applyTheme(b.dataset.th));
  if (su) for (const [inp, box] of [['a', 'ab'], ['c', 'cb']]) $('#' + inp).onchange = e => { const f = e.target.files[0]; if (!f) return; if (f.type.startsWith('image/')) { const r = new FileReader(); r.onload = () => { $('#' + box).innerHTML = `<img alt="" src="${r.result}">`; }; r.readAsDataURL(f); } else $('#' + box).textContent = f.name; };
  const fail = m => { $('#e').textContent = m; $('#go').disabled = false; };
  $('#go').onclick = async () => {
    $('#go').disabled = true; $('#e').textContent = '';
    const phone = normPhone($('#p').value), password = $('#w').value;
    if (phone.length < 10 || password.length < 6) return fail('أدخل رقماً صحيحاً وكلمة مرور من 6 أحرف على الأقل');
    if (!su) { const { error } = await sb.auth.signInWithPassword({ email: toEmail(phone), password }); return error ? fail('رقم الهاتف أو كلمة المرور غير صحيحة') : boot(); }
    const name = $('#n').value.trim(), av = $('#a').files[0], card = $('#c').files[0];
    if (name.length < 2 || !card) return fail('الاسم والبطاقة الجامعية مطلوبان');
    if ((av && av.size > 5e6) || card.size > 10e6) return fail('الحد الأقصى: 5MB للصورة و10MB للبطاقة');
    const { data, error } = await sb.auth.signUp({ email: toEmail(phone), password, options: { data: { full_name: name, phone, theme: document.body.getAttribute('data-theme') } } });
    if (error) return fail(/registered|exists/i.test(error.message) ? 'الرقم مسجّل مسبقاً' : error.message);
    if (!data.session) return fail('يلزم تعطيل Confirm email في إعدادات Supabase ثم المحاولة مجدداً');
    finishSignup(av, card);
  };
}
async function finishSignup(av, card) {
  const { data: { user } } = await sb.auth.getUser(); const row = {};
  try {
    const cp = await upload('university-cards', card, user.id); Object.assign(row, { university_card_path: cp, university_card_original_name: card.name, university_card_mime_type: card.type, university_card_size_bytes: card.size });
    if (av) row.avatar_url = sb.storage.from('avatars').getPublicUrl(await upload('avatars', av, user.id)).data.publicUrl;
    await sb.from('profiles').update(row).eq('id', user.id);
  } catch (e) { toast('تم إنشاء الحساب لكن تعذر رفع أحد الملفات: ' + e.message); }
  boot();
}
function waitScreen(p) {
  const pend = p.status === 'pending';
  app.innerHTML = `<div class="authwrap"><div class="brand"><div class="logo">${ic(pend ? 'timer' : 'lock', 38)}</div><h1>${pend ? 'حسابك قيد المراجعة' : p.status === 'rejected' ? 'تم رفض طلبك' : 'الحساب موقوف'}</h1></div>
    <div class="acard"><p>${pend ? 'سيوافق ممثل الشعبة على حسابك قريباً، وعندها تستطيع استخدام التطبيق.' : esc(p.approval_note || 'تواصل مع ممثل الشعبة.')}</p>
    <div class="row">${pend ? '<button class="btn" id="r">تحديث الحالة</button>' : ''}<button class="btn alt" id="o">تسجيل الخروج</button></div></div></div>`;
  $('#r')?.addEventListener('click', boot); $('#o').onclick = async () => { await sb.auth.signOut(); location.reload(); };
}

/* ===== الهيكل والتوجيه ===== */
const NAV = [['home', 'الرئيسية', 'home'], ['chats', 'المحادثات', 'chat'], ['profile', 'حسابي', 'user']];
const NAVOF = { home: 'home', chats: 'chats', chat: 'chats', public: 'chats', profile: 'profile', admin: 'profile' };
function shell() {
  const p = S.profile;
  app.innerHTML = `<header class="hdr"><div class="who">${ava(p.full_name, p.avatar_url, 'av lg')}<div><b>${esc(p.full_name)}</b><span><span class="pill">${ROLE[p.role]}</span></span></div></div>
    <div class="np-wrap"><button class="ib" id="bell" aria-label="الإشعارات">${ic('bell', 22)}<span class="badge" id="bd" hidden></span></button></div></header>
    <main id="v"></main>
    <nav class="bnav" aria-label="التنقل الرئيسي">${NAV.map(([k, t, i]) => `<button data-n="${k}"><span class="iw">${ic(i, 22)}</span>${t}</button>`).join('')}</nav>`;
  $$('[data-n]').forEach(b => b.onclick = () => location.hash = '#/' + b.dataset.n);
  $('#bell').onclick = toggleNotif; paintBadge();
}
document.addEventListener('unread', () => paintBadge());
document.addEventListener('click', e => { const np = $('#np'); if (np && !e.target.closest('#np') && !e.target.closest('#bell')) np.remove(); });
const paintBadge = () => { const b = $('#bd'); if (b) { b.hidden = !S.unread; b.textContent = S.unread; } };
async function toggleNotif() {
  if ($('#np')) return $('#np').remove();
  const box = document.createElement('div'); box.id = 'np'; box.className = 'np'; box.innerHTML = '<p class="mut">…</p>'; $('.np-wrap').append(box);
  const { data } = await sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(15);
  box.innerHTML = `<div class="row"><b class="sp">الإشعارات والتنبيهات</b><button class="lnk" id="mk">تحديد كمقروء</button></div>` + ((data || []).map(n => `<div class="it ${n.read_at ? '' : 'un'}"><b style="font-size:13px">${esc(n.title)}</b><div style="font-size:12px">${esc(n.body)}</div><div class="mut" style="font-size:11px">${fmt(n.created_at)}</div></div>`).join('') || '<p class="mut">لا توجد إشعارات.</p>');
  $('#mk', box).onclick = async () => { await sb.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null); S.unread = 0; paintBadge(); box.remove(); };
}
async function route() {
  unsub(); const parts = (location.hash || '#/').replace(/^#\/?/, '').split('/'); let name = parts[0] || 'home', arg = parts[1];
  const v = $('#v'); if (!v) return;
  if (!NAVOF[name]) name = 'home';
  app.classList.toggle('in-room', name === 'chat' || name === 'public');
  $$('[data-n]').forEach(b => b.classList.toggle('on', b.dataset.n === NAVOF[name]));
  window.scrollTo(0, 0);
  try {
    if (name === 'home') await home(v);
    else if (name === 'chats') await V2.chats(v);
    else if (name === 'chat') await V2.chats(v, arg);
    else if (name === 'public') await V2.publicChat(v);
    else if (name === 'profile') await V2.profile(v);
    else if (name === 'admin') { v.innerHTML = `<a class="lnk back" href="#/profile">${ic('back', 16)} حسابي</a><div id="ad"></div>`; await V2.admin($('#ad', v)); }
  } catch (e) { v.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}

/* ===== الرئيسية ===== */
const SECS = [['announcements', 'التبليغات', 'megaphone'], ['schedule', 'الجدول', 'calendar'], ['library', 'المكتبة', 'folder'], ['tasks', 'مهام ومنبهات', 'check']];
async function home(v) {
  const first = S.profile.full_name.split(' ')[0];
  v.innerHTML = `<section class="hero"><span class="chip">${ic('calendar', 14)} ${new Date().toLocaleDateString('ar-IQ', { month: 'long', year: 'numeric' })}</span><h2>أهلاً ${esc(first)} 👋</h2><p>كل التبليغات والملازم والجدول ومهامك اليومية في مكان واحد.</p>
    <div class="stats"><div><b id="s1">–</b><small>تبليغ رسمي</small></div><div><b id="s2">–</b><small>ملف بالمكتبة</small></div><div><b id="s3">–</b><small>مهام مفتوحة</small></div></div></section>
    <div class="secs">${SECS.map(([k, t, i]) => `<button class="sec ${k === (S.hs || 'announcements') ? 'on' : ''}" data-s="${k}"><span class="ibx">${ic(i, 22)}</span>${t}</button>`).join('')}</div><div id="hs"></div>`;
  $$('[data-s]', v).forEach(b => b.onclick = () => { S.hs = b.dataset.s; $$('[data-s]', v).forEach(x => x.classList.toggle('on', x === b)); section(); });
  Promise.all([sb.from('announcements').select('id', { count: 'exact', head: true }).eq('is_published', true), sb.from('study_files').select('id', { count: 'exact', head: true }).eq('status', 'published'), sb.from('student_tasks').select('id', { count: 'exact', head: true }).eq('is_completed', false)])
    .then(r => r.forEach((x, i) => { const el = $('#s' + (i + 1)); if (el) el.textContent = x.count ?? 0; })).catch(() => {});
  await section();
}
async function section() {
  const k = S.hs || 'announcements', hs = $('#hs'); if (!hs) return;
  hs.innerHTML = '<div class="sk"></div>';
  const title = { announcements: 'التبليغات الرسمية للشعبة', schedule: 'الجدول الدراسي', library: 'المكتبة الدراسية', tasks: 'مهامي ومنبهاتي' }[k];
  hs.innerHTML = `<h3 class="stitle">${title}</h3><div id="hc"></div>${k === 'tasks' ? '<div id="hc2"></div>' : ''}`;
  if (k === 'announcements') await V1.announcements($('#hc'));
  else if (k === 'schedule') await V1.schedule($('#hc'));
  else if (k === 'library') await V1.library($('#hc'));
  else { await V1.tasks($('#hc')); await V1.reminders($('#hc2')); }
}

/* ===== المنبهات والإشعارات الحية ===== */
let tick;
function startEngines() {
  clearInterval(tick);
  tick = setInterval(async () => {
    const { data } = await sb.from('student_reminders').select('*').eq('is_enabled', true).lte('remind_at', new Date().toISOString());
    for (const r of data || []) {
      beep(r.sound_name); toast('⏰ ' + r.title); webNotify('منبه', r.title);
      const next = r.recurrence === 'daily' ? 864e5 : r.recurrence === 'weekly' ? 6048e5 : 0; let t = new Date(r.remind_at).getTime();
      const upd = { last_triggered_at: new Date().toISOString() };
      if (next) { while (t <= Date.now()) t += next; upd.remind_at = new Date(t).toISOString(); } else upd.is_enabled = false;
      await sb.from('student_reminders').update(upd).eq('id', r.id);
    }
  }, 15000);
  sb.channel('notif').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${S.user.id}` }, p => { S.unread++; paintBadge(); toast(p.new.title); beep('soft-chime'); webNotify(p.new.title, p.new.body); }).subscribe();
}

/* ===== الإقلاع ===== */
async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return authScreen();
  S.user = session.user;
  const th = S.user.user_metadata?.theme; if (th) applyTheme(th); // نمط الحساب يتبع المستخدم لأي جهاز
  let { data: p } = await sb.rpc('current_profile'); // الحساب المعلّق لا يستطيع قراءة صفه مباشرة بسبب RLS
  if (!p?.id) { await sb.auth.signOut(); return authScreen(); }
  if (p.role !== 'representative') { const r = await sb.rpc('bootstrap_representative'); if (!r.error && r.data) p = r.data; } // ينجح فقط للمشرف الأعلى
  S.profile = p;
  if (p.status !== 'active') return waitScreen(p);
  sb.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', S.user.id);
  await Promise.all([loadPerms(), loadUsers()]);
  const { count } = await sb.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null); S.unread = count || 0;
  shell(); startEngines(); window.onhashchange = route; route();
}
boot();
