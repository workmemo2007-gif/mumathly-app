import { sb, S, PK, $, $$, esc, can, isRep, fmt, toast, modal, signed, upload, avatar, ava, ic, canAdmin, THEMES, setTheme, loadUsers, unsub, normPhone } from './core.js';
const err = e => toast(e?.message || 'حدث خطأ');
const ok = r => { if (r.error) { err(r.error); return false; } return true; };
const scrollEnd = e => { e.scrollTop = e.scrollHeight; };
const hm = d => d ? new Date(d).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }) : '';
const ROLE = { student: 'طالب', supervisor: 'مشرف', representative: 'الممثل الأعلى' };
const roomHead = o => `<header class="rhead"><a class="ib alt" href="#/chats" aria-label="رجوع">${ic('back', 20)}</a>${o.av || `<span class="av lg ph">${ic(o.icon || 'users', 22)}</span>`}<div class="rtitle"><b>${esc(o.title)}</b><small>${esc(o.sub)}</small></div>${o.right || ''}</header>`;

/* ===== اختيار مستخدم (بحث عن حساب) ===== */
export async function userPicker(onPick) {
  if (!Object.keys(S.users).length) await loadUsers();
  const m = modal(`<h3>ابحث عن حساب</h3><input id="q" placeholder="اكتب الاسم…"><div id="l"></div>`);
  const draw = () => {
    const q = $('#q', m).value.trim();
    $('#l', m).innerHTML = Object.values(S.users).filter(u => u.id !== S.user.id && (!q || u.full_name.includes(q))).slice(0, 40).map(u => `<div class="card row" data-u="${u.id}" style="cursor:pointer">${avatar(u)}<b>${esc(u.full_name)}</b></div>`).join('') || '<p class="mut">لا نتائج</p>';
    $$('[data-u]', m).forEach(d => d.onclick = () => { m.close(); onPick(d.dataset.u); });
  };
  $('#q', m).oninput = draw; draw();
}

/* ===== الدردشة العامة ===== */
export async function publicChat(el) {
  if (!Object.keys(S.users).length) await loadUsers();
  const since = new Date(Date.now() - 864e5).toISOString();
  const { data } = await sb.from('public_chat_messages').select('*').is('deleted_at', null).gte('created_at', since).order('created_at');
  const canSend = can('public_chat'), canDel = isRep() || can('delete_public_messages');
  el.innerHTML = `<section class="room">${roomHead({ title: 'الدردشة العامة', sub: 'مساحة نقاش الشعبة اليومية', icon: 'users' })}<div class="rban">${ic('timer', 12)} تُحذف الرسائل تلقائياً بعد 24 ساعة</div><div class="feed" id="m"></div>
    ${canSend ? `<div class="rin"><div class="r1"><input id="t" placeholder="اكتب رسالتك هنا…" aria-label="رسالة"><button class="ib grad" id="s" aria-label="إرسال">${ic('send', 20).replace('class="ic"', 'class="ic flip"')}</button></div></div>` : '<div class="rin"><p class="mut" style="text-align:center;margin:0">ليست لديك صلاحية الكتابة.</p></div>'}</section>`;
  const box = $('#m', el);
  const add = m => {
    const me = m.sender_id === S.user.id, u = S.users[m.sender_id], d = document.createElement('div');
    d.className = 'msg' + (me ? ' me' : ''); d.dataset.id = m.id;
    d.innerHTML = `${me ? '' : `<span class="nm">${esc(u?.full_name || 'مستخدم')}</span>`}${esc(m.body)}<small><span>${hm(m.created_at)}</span>${canDel ? '<a href="#" data-x>حذف</a>' : ''}</small>`;
    d.querySelector('[data-x]')?.addEventListener('click', async e => { e.preventDefault(); if (confirm('حذف الرسالة لدى الجميع؟') && ok(await sb.from('public_chat_messages').delete().eq('id', m.id))) d.remove(); });
    box.append(d); scrollEnd(box);
  };
  (data || []).forEach(add);
  const send = async () => { const t = $('#t', el).value.trim(); if (!t) return; $('#t', el).value = ''; ok(await sb.from('public_chat_messages').insert({ sender_id: S.user.id, body: t })); };
  $('#s', el)?.addEventListener('click', send); $('#t', el)?.addEventListener('keydown', e => e.key === 'Enter' && send());
  S.ch.push(sb.channel('pub').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'public_chat_messages' }, p => { if (!box.querySelector(`[data-id="${p.new.id}"]`)) add(p.new); })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'public_chat_messages' }, p => box.querySelector(`[data-id="${p.old.id}"]`)?.remove()).subscribe());
}

/* ===== المحادثات ===== */
export async function chats(el, convId) {
  if (convId) return chatRoom(el, convId);
  sb.rpc('delete_expired_private_messages');
  if (!Object.keys(S.users).length) await loadUsers();
  const [{ data: convs }, { data: last }] = await Promise.all([sb.rpc('my_conversations'),
    sb.from('public_chat_messages').select('body,sender_id').is('deleted_at', null).order('created_at', { ascending: false }).limit(1)]);
  const lm = last?.[0], prev = lm ? `${S.users[lm.sender_id]?.full_name || ''}: ${lm.body}` : 'ابدأ النقاش مع زملائك';
  el.innerHTML = `<div class="row"><div class="sp"><h2 style="margin:0">المحادثات والتواصل</h2><span class="mut">دردشة الشعبة والمراسلات الخاصة</span></div><button class="btn" id="new">${ic('plus', 16)} جديدة</button></div>
    <a class="gcard" href="#/public"><span class="gi">${ic('users', 28)}</span><div class="sp"><b>الدردشة العامة للشعبة</b><p>${esc(prev)}</p><span class="chip" style="margin-top:6px">${ic('timer', 12)} تُحذف بعد 24 ساعة</span></div></a>
    <div class="fld"><input id="q" placeholder="ابحث باسم زميل…" aria-label="بحث">${ic('search', 20)}</div><h4 class="mut" style="margin:6px 0 10px">المحادثات الخاصة</h4><div id="l"></div>`;
  const draw = () => {
    const q = $('#q', el).value.trim(), list = (convs || []).filter(c => !q || c.other_name.includes(q));
    $('#l', el).innerHTML = list.map(c => `<div class="citem" data-c="${c.conversation_id}">${ava(c.other_name, c.other_avatar)}<div class="sp"><div class="row"><b class="sp">${esc(c.other_name)}</b><span class="mut" style="font-size:11px">${hm(c.last_at)}</span></div><p>${esc(c.last_body || 'مرفق')}</p></div>${c.delete_after_24h ? '<span class="pill a">24س</span>' : ''}</div>`).join('') || '<p class="mut" style="text-align:center">لا توجد محادثات بعد.</p>';
    $$('[data-c]', el).forEach(d => d.onclick = () => location.hash = '#/chat/' + d.dataset.c);
  };
  $('#q', el).oninput = draw; draw();
  $('#new', el).onclick = () => userPicker(async uid => { const r = await sb.rpc('start_private_chat', { other_id: uid }); if (ok(r)) location.hash = '#/chat/' + r.data; });
}
async function chatRoom(el, cid) {
  const { data: convs } = await sb.rpc('my_conversations'); const c = (convs || []).find(x => x.conversation_id === cid);
  if (!c) { el.innerHTML = '<p class="mut" style="padding:16px">المحادثة غير موجودة.</p>'; return; }
  const { data: msgs } = await sb.from('private_messages').select('*,private_message_attachments(*),study_files(title,storage_path,original_file_name)').eq('conversation_id', cid).is('deleted_at', null).order('created_at');
  let ret = c.delete_after_24h;
  const retLabel = () => `${ic('timer', 14)} 24س: ${ret ? 'مفعّل' : 'متوقف'}`;
  el.innerHTML = `<section class="room">${roomHead({ title: c.other_name, sub: 'محادثة خاصة', av: ava(c.other_name, c.other_avatar, 'av lg'), right: `<button class="btn alt sm" id="ret" title="الحذف التلقائي بعد 24 ساعة">${retLabel()}</button>` })}
    <div class="rban" id="rb" ${ret ? '' : 'hidden'}>${ic('timer', 12)} الرسائل المؤقتة مفعّلة: تُحذف تلقائياً بعد 24 ساعة</div><div class="feed" id="m"></div>
    <div class="rin"><div class="amenu" id="am" hidden><label>${ic('image', 22)}صورة أو فيديو<input id="f" type="file" accept="image/*,video/*" hidden></label><button type="button" id="lib">${ic('book', 22)}ملف من المكتبة</button></div>
    <div class="r1" id="nin"><button class="ib" id="clip" aria-label="مرفقات">${ic('clip', 20)}</button><input id="t" placeholder="اكتب رسالتك هنا…" aria-label="رسالة"><button class="ib" id="rec" aria-label="تسجيل صوتي">${ic('mic', 20)}</button><button class="ib grad" id="s" aria-label="إرسال">${ic('send', 20).replace('class="ic"', 'class="ic flip"')}</button></div>
    <div class="recbar" id="rb2" hidden><button class="ib alt" id="rc" aria-label="إلغاء">${ic('trash', 18)}</button><span class="rd"></span><span class="rtm" id="rt">00:00</span><button class="btn sm" id="rs">إرسال ${ic('send', 14).replace('class="ic"', 'class="ic flip"')}</button></div></div></section>`;
  const box = $('#m', el), seen = new Set();
  const draw = async m => {
    if (seen.has(m.id)) return; seen.add(m.id);
    const me = m.sender_id === S.user.id, d = document.createElement('div'); d.className = 'msg' + (me ? ' me' : ''); d.dataset.id = m.id;
    let html = m.body ? esc(m.body) : '';
    const atts = m.private_message_attachments || (await sb.from('private_message_attachments').select('*').eq('message_id', m.id)).data || [];
    for (const a of atts) { const u = await signed('private-message-media', a.storage_path); if (u) html += a.attachment_kind === 'image' ? `<img src="${u}" alt="صورة مرفقة">` : a.attachment_kind === 'video' ? `<video src="${u}" controls></video>` : `<audio src="${u}" controls></audio>`; }
    if (m.study_file_id) { const f = m.study_files || (await sb.from('study_files').select('title,storage_path,original_file_name').eq('id', m.study_file_id).single()).data; if (f) html += `<div>${ic('file', 16)} <a href="#" data-f>${esc(f.title)}</a></div>`; d.dataset.path = f?.storage_path || ''; }
    d.innerHTML = html + `<small><span>${hm(m.created_at)}</span></small>`;
    d.querySelector('[data-f]')?.addEventListener('click', async e => { e.preventDefault(); const u = await signed('study-files', d.dataset.path); if (u) window.open(u, '_blank'); });
    box.append(d); scrollEnd(box);
  };
  for (const m of msgs || []) await draw(m);
  const send = async (body, file, kind, dur) => {
    const ins = await sb.from('private_messages').insert({ conversation_id: cid, sender_id: S.user.id, body: body || null }).select().single(); if (!ok(ins)) return;
    if (file) { try { const path = await upload('private-message-media', file, S.user.id); ok(await sb.from('private_message_attachments').insert({ message_id: ins.data.id, uploaded_by: S.user.id, attachment_kind: kind, storage_path: path, original_file_name: file.name || null, mime_type: file.type, file_size_bytes: file.size, duration_seconds: dur || null })); } catch (e) { err(e); } }
    await draw(ins.data);
  };
  const go = async () => { const t = $('#t', el).value.trim(); if (!t) return; $('#t', el).value = ''; await send(t); };
  $('#s', el).onclick = go; $('#t', el).onkeydown = e => e.key === 'Enter' && go();
  $('#clip', el).onclick = () => { $('#am', el).hidden = !$('#am', el).hidden; };
  $('#f', el).onchange = async e => { const f = e.target.files[0]; if (!f) return; if (f.size > 52428800) return toast('الحجم الأقصى 50MB'); $('#am', el).hidden = true; await send('', f, f.type.startsWith('video') ? 'video' : 'image'); e.target.value = ''; };
  $('#ret', el).onclick = async () => { const n = !ret; if (ok(await sb.from('conversation_members').update({ delete_messages_after_24h: n }).match({ conversation_id: cid, user_id: S.user.id }))) { ret = n; $('#ret', el).innerHTML = retLabel(); $('#rb', el).hidden = !ret; } };
  let mr, chunks = [], t0, tick;
  const stopUi = () => { clearInterval(tick); $('#rb2', el).hidden = true; $('#nin', el).hidden = false; };
  $('#rec', el).onclick = async () => {
    try {
      const st = await navigator.mediaDevices.getUserMedia({ audio: true }); mr = new MediaRecorder(st); chunks = []; mr._cancel = false;
      mr.ondataavailable = x => chunks.push(x.data);
      mr.onstop = async () => { st.getTracks().forEach(t => t.stop()); stopUi(); if (mr._cancel) return; const blob = new Blob(chunks, { type: mr.mimeType }); await send('', new File([blob], 'voice.' + (mr.mimeType.includes('mp4') ? 'm4a' : 'webm'), { type: mr.mimeType }), 'audio', (Date.now() - t0) / 1000); };
      t0 = Date.now(); mr.start(); $('#nin', el).hidden = true; $('#rb2', el).hidden = false; $('#am', el).hidden = true;
      tick = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); $('#rt', el).textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }, 500);
    } catch { toast('تعذر الوصول إلى الميكروفون'); }
  };
  $('#rc', el).onclick = () => { if (mr?.state === 'recording') { mr._cancel = true; mr.stop(); } };
  $('#rs', el).onclick = () => { if (mr?.state === 'recording') mr.stop(); };
  $('#lib', el).onclick = async () => {
    $('#am', el).hidden = true;
    const { data: fs } = await sb.from('study_files').select('id,title').eq('status', 'published').order('created_at', { ascending: false }).limit(60);
    const m = modal(`<h3>اختر ملفاً من المكتبة</h3>${(fs || []).map(f => `<div class="card" data-f="${f.id}" style="cursor:pointer">${ic('file', 16)} ${esc(f.title)}</div>`).join('') || '<p class="mut">لا توجد ملفات منشورة.</p>'}`);
    $$('[data-f]', m).forEach(d => d.onclick = async () => { m.close(); const r = await sb.from('private_messages').insert({ conversation_id: cid, sender_id: S.user.id, study_file_id: d.dataset.f }).select().single(); if (ok(r)) draw(r.data); });
  };
  S.ch.push(sb.channel('pm' + cid).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'private_messages', filter: `conversation_id=eq.${cid}` }, p => setTimeout(() => draw(p.new), 600))
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'private_messages' }, p => box.querySelector(`[data-id="${p.old.id}"]`)?.remove()).subscribe());
}

/* ===== الحساب والأنماط ===== */
export async function profile(el) {
  const p = S.profile, cur = document.body.getAttribute('data-theme') || 'blue';
  el.innerHTML = `<div class="pcard"><div class="pbg"></div>${ava(p.full_name, p.avatar_url, 'av xl')}<h2>${esc(p.full_name)}</h2><div class="mut" dir="ltr">${esc(p.phone)}</div>
    <div class="row" style="justify-content:center;margin-top:10px"><span class="pill">${ROLE[p.role]}</span><span class="pill g">حساب معتمد</span></div>
    <div class="row" style="margin-top:14px">${p.university_card_path ? `<button class="btn alt sm sp" id="card">${ic('idcard', 16)} البطاقة الجامعية</button>` : ''}<button class="btn alt sm sp" id="edit">${ic('pencil', 16)} تعديل بياناتي</button></div></div>
    <div class="card"><h3>${ic('palette', 18)} مظهر وأنماط التطبيق</h3><p class="mut" style="margin:0 0 12px">اختر النمط المفضل؛ يُحفظ في حسابك ويبقى معك على أي جهاز حتى تغيّره.</p>
      <div class="tgrid">${THEMES.map(t => `<button class="tcard ${t.k === cur ? 'on' : ''}" data-th="${t.k}"><span class="row"><span class="sw">${t.sw.map(c => `<i style="background:${c}"></i>`).join('')}</span><span><b style="font-size:13px">${t.name}</b><br><span class="mut" style="font-size:11px">${t.desc}</span></span></span>${t.k === cur ? `<span class="tck">${ic('tick', 14)}</span>` : ''}</button>`).join('')}</div></div>
    ${canAdmin() ? `<a class="card row" href="#/admin" style="text-decoration:none;color:inherit;cursor:pointer"><span class="ib grad">${ic('shield', 20)}</span><span class="sp"><b>لوحة الإدارة</b><br><span class="mut">الحسابات والملفات والمواد وسجل العمليات</span></span>${ic('back', 18).replace('class="ic"', 'class="ic flip"')}</a>` : ''}
    <button class="btn bad big" id="out">${ic('logout', 18)} تسجيل الخروج</button>`;
  $$('[data-th]', el).forEach(b => b.onclick = async () => { await setTheme(b.dataset.th); profile(el); });
  $('#card', el)?.addEventListener('click', async () => { const u = await signed('university-cards', p.university_card_path); if (u) window.open(u, '_blank'); });
  $('#edit', el).onclick = () => {
    const m = modal(`<h3>تعديل بياناتي</h3><label>الاسم الكامل</label><input id="n" value="${esc(p.full_name)}"><label>صورة شخصية جديدة</label><input id="a" type="file" accept="image/*"><button class="btn big" id="save">حفظ</button>`);
    $('#save', m).onclick = async () => {
      const row = { full_name: $('#n', m).value.trim() }; if (row.full_name.length < 2) return toast('الاسم قصير');
      const f = $('#a', m).files[0];
      if (f) try { const path = await upload('avatars', f, S.user.id); row.avatar_url = sb.storage.from('avatars').getPublicUrl(path).data.publicUrl; } catch (e) { return err(e); }
      if (ok(await sb.from('profiles').update(row).eq('id', S.user.id))) { Object.assign(S.profile, row); m.close(); toast('تم الحفظ'); profile(el); }
    };
  };
  $('#out', el).onclick = async () => { await sb.auth.signOut(); location.hash = ''; location.reload(); };
}

/* ===== الإدارة ===== */
const STAT = { pending: ['بانتظار', 'a'], active: ['فعّال', 'g'], rejected: ['مرفوض', 'r'], suspended: ['موقوف', 'r'] };
export async function admin(el, tab = 'accounts') {
  const tabs = [['accounts', 'الحسابات', can('approve_accounts') || can('manage_accounts')], ['files', 'مراجعة الملفات', can('approve_student_files') || can('approve_supervisor_files')], ['subjects', 'المواد', can('manage_subjects')], ['types', 'أنواع الملفات', can('manage_file_types')], ['logs', 'السجل', can('view_audit_logs')]].filter(t => t[2]);
  if (!tabs.length) { el.innerHTML = '<p class="mut">لا تملك صلاحيات إدارية.</p>'; return; }
  if (!tabs.find(t => t[0] === tab)) tab = tabs[0][0];
  el.innerHTML = `<div class="tabs">${tabs.map(t => `<button class="btn sm ${t[0] === tab ? 'on' : 'alt'}" data-t="${t[0]}">${t[1]}</button>`).join('')}</div><div id="p"></div>`;
  $$('[data-t]', el).forEach(b => b.onclick = () => admin(el, b.dataset.t));
  const p = $('#p', el); await ({ accounts: adAccounts, files: adFiles, subjects: adSubjects, types: adTypes, logs: adLogs })[tab](p);
}
async function adAccounts(p) {
  const { data } = await sb.from('profiles').select('*').order('created_at', { ascending: false });
  const rep = isRep();
  p.innerHTML = (data || []).map(u => `<div class="card"><div class="row">${avatar(u)}<span class="sp"><b>${esc(u.full_name)}</b> <span class="pill ${STAT[u.status][1]}">${STAT[u.status][0]}</span><br><span class="mut" dir="ltr">${esc(u.phone)}</span> <span class="mut">· ${{ student: 'طالب', supervisor: 'مشرف', representative: 'ممثل' }[u.role]}</span>${u.approval_note ? `<br><span class="mut">${esc(u.approval_note)}</span>` : ''}</span></div>
    <div class="row" style="margin-top:8px">${u.university_card_path ? `<button class="btn sm alt" data-card="${u.id}">البطاقة الجامعية</button>` : ''}
    ${can('approve_accounts') && u.status !== 'active' && u.id !== S.user.id ? `<button class="btn sm ok" data-st="active" data-id="${u.id}">قبول</button>` : ''}
    ${can('approve_accounts') && u.status === 'pending' ? `<button class="btn sm bad" data-st="rejected" data-id="${u.id}">رفض</button>` : ''}
    ${(rep || can('suspend_accounts')) && u.status === 'active' && u.id !== S.user.id ? `<button class="btn sm bad" data-sus="${u.id}">إيقاف</button>` : ''}
    ${rep && u.role !== 'representative' ? `<button class="btn sm alt" data-role="${u.id}" data-r="${u.role === 'supervisor' ? 'student' : 'supervisor'}">${u.role === 'supervisor' ? 'إلغاء الإشراف' : 'تعيين مشرف'}</button>` : ''}
    ${(rep || can('manage_accounts')) && u.role !== 'representative' ? `<button class="btn sm alt" data-perm="${u.id}">الصلاحيات</button>` : ''}</div></div>`).join('');
  const user = id => data.find(x => x.id === id);
  $$('[data-card]', p).forEach(b => b.onclick = async () => { const u = await signed('university-cards', user(b.dataset.card).university_card_path); if (u) window.open(u, '_blank'); });
  $$('[data-st]', p).forEach(b => b.onclick = async () => { const note = b.dataset.st === 'rejected' ? prompt('سبب الرفض (يظهر للطالب):') : null; if (b.dataset.st === 'rejected' && note === null) return; if (ok(await sb.rpc('approve_account', { target_user_id: b.dataset.id, target_status: b.dataset.st, note }))) adAccounts(p); });
  $$('[data-sus]', p).forEach(b => b.onclick = async () => { const note = prompt('سبب الإيقاف:'); if (note === null) return; if (ok(await sb.from('profiles').update({ status: 'suspended', approval_note: note }).eq('id', b.dataset.sus))) adAccounts(p); });
  $$('[data-role]', p).forEach(b => b.onclick = async () => { if (ok(await sb.from('profiles').update({ role: b.dataset.r }).eq('id', b.dataset.role))) adAccounts(p); });
  $$('[data-perm]', p).forEach(b => b.onclick = async () => {
    const [{ data: cat }, { data: cur }] = await Promise.all([sb.from('permission_catalog').select('*').eq('is_active', true), sb.from('user_permissions').select('*').eq('user_id', b.dataset.perm)]);
    const on = Object.fromEntries((cur || []).map(x => [x.permission_key, x.enabled]));
    const m = modal(`<h3>صلاحيات ${esc(user(b.dataset.perm).full_name)}</h3>${(cat || []).filter(c => c.key !== 'group_broadcast').map(c => `<label class="row" style="color:var(--text);font-size:15px"><input type="checkbox" data-k="${c.key}" ${on[c.key] ? 'checked' : ''}> ${esc(c.label)}</label><br>`).join('')}`);
    $$('[data-k]', m).forEach(c => c.onchange = async () => ok(await sb.from('user_permissions').upsert({ user_id: b.dataset.perm, permission_key: c.dataset.k, enabled: c.checked, updated_by: S.user.id, updated_at: new Date().toISOString() })) || (c.checked = !c.checked));
  });
}
async function adFiles(p) {
  const { data } = await sb.from('study_files').select('*,uploader:profiles!study_files_uploaded_by_fkey(full_name,role),subjects(name)').in('status', ['pending', 'pending_representative']).order('created_at');
  p.innerHTML = (data || []).map(f => `<div class="card"><b>${esc(f.title)}</b> <span class="pill a">${f.status === 'pending' ? 'من طالب' : 'من مشرف'}</span><div class="mut">${esc(f.uploader?.full_name)} · ${esc(f.subjects?.name)} · ${fmt(f.created_at)}</div>
    <div class="row" style="margin-top:8px"><button class="btn sm alt" data-v="${f.id}">عرض</button><button class="btn sm ok" data-d="approved" data-id="${f.id}">اعتماد</button><button class="btn sm bad" data-d="rejected" data-id="${f.id}">رفض</button></div></div>`).join('') || '<p class="mut">لا توجد ملفات بانتظار المراجعة.</p>';
  $$('[data-v]', p).forEach(b => b.onclick = async () => { const u = await signed('study-files', data.find(x => x.id === b.dataset.v).storage_path); if (u) window.open(u, '_blank'); });
  $$('[data-d]', p).forEach(b => b.onclick = async () => {
    const a = b.dataset.d === 'approved', note = a ? null : prompt('سبب الرفض:'); if (!a && note === null) return;
    const r = await sb.from('study_files').update(a ? { status: 'published', published_at: new Date().toISOString(), published_by: S.user.id, rejection_reason: null } : { status: 'rejected', rejection_reason: note }).eq('id', b.dataset.id);
    if (ok(r)) { await sb.from('file_reviews').insert({ file_id: b.dataset.id, reviewer_id: S.user.id, decision: b.dataset.d, note }); adFiles(p); }
  });
}
const nameList = (table, label) => async function self(p) {
  const { data } = await sb.from(table).select('*').order('name');
  p.innerHTML = `<div class="card row"><input id="n" placeholder="${label}" style="flex:1;margin:0"><button class="btn" id="add">إضافة</button></div>` + (data || []).map(x => `<div class="card row"><span class="sp">${esc(x.name)} ${x.is_active ? '' : '<span class="pill r">معطّل</span>'}</span><button class="btn sm alt" data-t="${x.id}" data-a="${x.is_active}">${x.is_active ? 'تعطيل' : 'تفعيل'}</button><button class="btn sm bad" data-x="${x.id}">حذف</button></div>`).join('');
  $('#add', p).onclick = async () => { const n = $('#n', p).value.trim(); if (!n) return; const row = { name: n, created_by: S.user.id }; if (table === 'file_types') row.slug = n.replace(/\s+/g, '-').toLowerCase() + '-' + Math.random().toString(36).slice(2, 6); if (ok(await sb.from(table).insert(row))) self(p); };
  $$('[data-t]', p).forEach(b => b.onclick = async () => { if (ok(await sb.from(table).update({ is_active: b.dataset.a !== 'true' }).eq('id', b.dataset.t))) (table === 'subjects' ? adSubjects : adTypes)(p); });
  $$('[data-x]', p).forEach(b => b.onclick = async () => { if (confirm('حذف نهائي؟ (الأفضل التعطيل)') && ok(await sb.from(table).delete().eq('id', b.dataset.x))) (table === 'subjects' ? adSubjects : adTypes)(p); });
};
const adSubjects = nameList('subjects', 'اسم المادة'), adTypes = nameList('file_types', 'نوع جديد (مثل: أسئلة وزارية)');
async function adLogs(p) {
  const { data } = await sb.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100);
  if (!Object.keys(S.users).length) await loadUsers();
  p.innerHTML = (data || []).map(l => `<div class="card"><b>${esc(l.action)}</b> · ${esc(l.entity_type)}<div class="mut">${esc(S.users[l.actor_id]?.full_name || '—')} · ${fmt(l.created_at)}</div><div class="mut" dir="ltr">${esc(JSON.stringify(l.details))}</div></div>`).join('') || '<p class="mut">السجل فارغ.</p>';
}
