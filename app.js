import { sb, S, $, $$, esc, can, isRep, toast, normPhone, upload, loadPerms, loadUsers, unsub, beep, webNotify } from './core.js';
import * as V1 from './views1.js';
import * as V2 from './views2.js';
const app = $('#app');
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

/* ===== شاشات الدخول ===== */
function authScreen(mode = 'login') {
  const su = mode === 'signup';
  app.innerHTML = `<div class="auth"><h1>ممثلي</h1><p class="mut">منصة شعبتك الجامعية في مكان واحد</p>
    <div class="tabs"><button class="btn sm ${su ? 'alt' : 'on'}" data-m="login">دخول</button><button class="btn sm ${su ? 'on' : 'alt'}" data-m="signup">إنشاء حساب</button></div>
    ${su ? '<label>الاسم الكامل</label><input id="n" autocomplete="name">' : ''}
    <label>رقم الهاتف</label><input id="p" type="tel" dir="ltr" placeholder="07xxxxxxxxx" autocomplete="tel">
    <label>كلمة المرور</label><input id="w" type="password" autocomplete="${su ? 'new-password' : 'current-password'}">
    ${su ? '<label>الصورة الشخصية</label><input id="a" type="file" accept="image/*"><label>البطاقة الجامعية</label><input id="c" type="file" accept="image/*,application/pdf">' : ''}
    <div class="err" id="e"></div><button class="btn" id="go" style="width:100%">${su ? 'إنشاء الحساب' : 'تسجيل الدخول'}</button></div>`;
  $$('[data-m]').forEach(b => b.onclick = () => authScreen(b.dataset.m));
  const fail = m => { $('#e').textContent = m; $('#go').disabled = false; };
  $('#go').onclick = async () => {
    $('#go').disabled = true; $('#e').textContent = '';
    const phone = normPhone($('#p').value), password = $('#w').value;
    if (phone.length < 10 || password.length < 6) return fail('أدخل رقماً صحيحاً وكلمة مرور من 6 أحرف على الأقل');
    if (!su) { const { error } = await sb.auth.signInWithPassword({ phone, password }); return error ? fail('رقم الهاتف أو كلمة المرور غير صحيحة') : boot(); }
    const name = $('#n').value.trim(), av = $('#a').files[0], card = $('#c').files[0];
    if (name.length < 2 || !card) return fail('الاسم والبطاقة الجامعية مطلوبان');
    if ((av && av.size > 5e6) || card.size > 10e6) return fail('الحد الأقصى: 5MB للصورة و10MB للبطاقة');
    const { data, error } = await sb.auth.signUp({ phone, password, options: { data: { full_name: name, phone } } });
    if (error) return fail(/registered|exists/i.test(error.message) ? 'الرقم مسجّل مسبقاً' : error.message);
    if (data.session) return finishSignup(av, card);
    otpScreen(phone, av, card);
  };
}
function otpScreen(phone, av, card) {
  app.innerHTML = `<div class="auth"><h1>رمز التحقق</h1><p class="mut">أرسلنا رمزاً إلى ${esc(phone)}</p><input id="o" inputmode="numeric" dir="ltr"><div class="err" id="e"></div><button class="btn" id="go" style="width:100%">تأكيد</button></div>`;
  $('#go').onclick = async () => { const { data, error } = await sb.auth.verifyOtp({ phone, token: $('#o').value.trim(), type: 'sms' }); if (error) return $('#e').textContent = 'الرمز غير صحيح'; await finishSignup(av, card); };
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
  const rej = p.status !== 'pending';
  app.innerHTML = `<div class="auth"><h1>${p.status === 'pending' ? 'حسابك قيد المراجعة' : p.status === 'rejected' ? 'تم رفض طلبك' : 'الحساب موقوف'}</h1>
    <p>${p.status === 'pending' ? 'سيوافق الممثل على حسابك قريباً، وعندها تستطيع استخدام التطبيق.' : esc(p.approval_note || 'تواصل مع ممثل الشعبة.')}</p>
    ${rej ? '' : '<button class="btn" id="r">تحديث الحالة</button> '}<button class="btn alt" id="o">تسجيل الخروج</button></div>`;
  $('#r')?.addEventListener('click', boot); $('#o').onclick = async () => { await sb.auth.signOut(); location.reload(); };
}

/* ===== الهيكل والتوجيه ===== */
const ROUTES = {
  schedule: ['الجدول', V1.schedule], announcements: ['التبليغات', V1.announcements], library: ['المكتبة', V1.library], public: ['الدردشة العامة', V2.publicChat],
  chat: ['الرسائل الخاصة', V2.chats], tasks: ['المهام', V1.tasks], reminders: ['المنبهات', V1.reminders], notifications: ['الإشعارات', V2.notifications], profile: ['حسابي', V2.profile], admin: ['الإدارة', V2.admin]
};
const canAdmin = () => ['approve_accounts', 'manage_accounts', 'approve_student_files', 'approve_supervisor_files', 'manage_subjects', 'manage_file_types', 'view_audit_logs'].some(can);
function shell() {
  app.innerHTML = `<header class="top"><button class="ib" id="home" aria-label="الرئيسية">🏠</button><h1 id="ttl">ممثلي</h1><button class="ib" id="bell" aria-label="الإشعارات">🔔<span class="badge" id="bd" hidden></span></button><button class="ib" id="me" aria-label="حسابي">👤</button></header><main id="v"></main>`;
  $('#home').onclick = () => location.hash = '#/'; $('#bell').onclick = () => location.hash = '#/notifications'; $('#me').onclick = () => location.hash = '#/profile';
  document.addEventListener('unread', paintBadge); paintBadge();
}
const paintBadge = () => { const b = $('#bd'); if (b) { b.hidden = !S.unread; b.textContent = S.unread; } };
async function route() {
  unsub(); const [, name, arg] = (location.hash || '#/').split('/'); const v = $('#v'); if (!v) return;
  if (!name || !ROUTES[name]) { $('#ttl').textContent = 'ممثلي'; return home(v); }
  $('#ttl').textContent = ROUTES[name][0]; v.innerHTML = '<p class="boot" style="margin:40px">…</p>';
  try { await ROUTES[name][1](v, arg); } catch (e) { v.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}
function home(v) {
  const t = [['schedule', '🗓', 'الجدول'], ['announcements', '📢', 'التبليغات'], ['library', '📚', 'المكتبة'], ['public', '💬', 'الدردشة العامة'], ['chat', '✉️', 'الرسائل الخاصة'], ['tasks', '✅', 'المهام'], ['reminders', '⏰', 'المنبهات'], ['notifications', '🔔', 'الإشعارات']];
  if (canAdmin()) t.push(['admin', '🛠', 'الإدارة']);
  v.innerHTML = `<p>أهلاً ${esc(S.profile.full_name.split(' ')[0])} 👋</p><div class="tiles">${t.map((x, i) => `<a class="tile c${i}" href="#/${x[0]}"><span>${x[1]}</span>${x[2]}</a>`).join('')}</div>`;
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
  let { data: p } = await sb.from('profiles').select('*').eq('id', S.user.id).maybeSingle();
  if (!p) { await sb.auth.signOut(); return authScreen(); }
  if (p.role !== 'representative') { const r = await sb.rpc('bootstrap_representative'); if (!r.error && r.data) p = r.data; } // ينجح فقط للمشرف الأعلى
  S.profile = p;
  if (p.status !== 'active') return waitScreen(p);
  sb.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', S.user.id);
  await Promise.all([loadPerms(), loadUsers()]);
  const { count } = await sb.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null); S.unread = count || 0;
  shell(); startEngines(); window.onhashchange = route; route();
}
boot();
