import { sb, S, $, $$, esc, can, isRep, fmt, fmtD, toast, modal, signed, upload, localISO, rid, loadUsers } from './core.js';
import { userPicker } from './views2.js';
const err = e => toast(e?.message || 'حدث خطأ');
const ok = (r) => { if (r.error) { err(r.error); return false; } return true; };

/* ===== الجدول ===== */
const KINDS = { lecture: 'محاضرة', exam: 'امتحان', other: 'أخرى' };
export async function schedule(el) {
  const manage = can('manage_schedule');
  const [{ data: items }, { data: subs }] = await Promise.all([
    sb.from('schedule_items').select('*,subjects(name)').order('starts_at'),
    sb.from('subjects').select('id,name').eq('is_active', true)]);
  const now = Date.now() - 36e5, up = (items || []).filter(i => new Date(i.ends_at || i.starts_at) >= now - 864e5);
  const days = {}; up.forEach(i => (days[fmtD(i.starts_at)] ||= []).push(i));
  el.innerHTML = `${manage ? '<button class="btn" id="add">+ إضافة موعد</button><br><br>' : ''}` +
    (Object.keys(days).length ? Object.entries(days).map(([d, l]) => `<h3>${d}</h3>` + l.map(i => `<div class="card"><div class="row"><b class="sp">${esc(i.title)}</b><span class="pill ${i.kind === 'exam' ? 'r' : 'g'}">${KINDS[i.kind]}</span></div>
      <div class="mut">${new Date(i.starts_at).toLocaleTimeString('ar-IQ', { timeStyle: 'short' })}${i.ends_at ? ' – ' + new Date(i.ends_at).toLocaleTimeString('ar-IQ', { timeStyle: 'short' }) : ''} ${i.room ? '· القاعة ' + esc(i.room) : ''} ${i.subjects ? '· ' + esc(i.subjects.name) : ''}</div>
      ${i.notes ? `<p>${esc(i.notes)}</p>` : ''}${manage ? `<button class="btn sm bad" data-del="${i.id}">حذف</button>` : ''}</div>`).join('')).join('') : '<p class="mut">لا توجد مواعيد قادمة.</p>');
  $('#add', el)?.addEventListener('click', () => {
    const m = modal(`<h3>موعد جديد</h3><label>العنوان</label><input id="t"><label>النوع</label><select id="k">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
      <label>المادة</label><select id="s"><option value="">—</option>${(subs || []).map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>
      <label>البداية</label><input id="a" type="datetime-local"><label>النهاية (اختياري)</label><input id="b" type="datetime-local"><label>القاعة</label><input id="r"><label>ملاحظات</label><textarea id="n"></textarea><button class="btn" id="go">حفظ</button>`);
    $('#go', m).onclick = async () => {
      if (!$('#t', m).value || !$('#a', m).value) return toast('العنوان والبداية مطلوبان');
      const r = await sb.from('schedule_items').insert({ title: $('#t', m).value, kind: $('#k', m).value, subject_id: $('#s', m).value || null, starts_at: new Date($('#a', m).value).toISOString(), ends_at: $('#b', m).value ? new Date($('#b', m).value).toISOString() : null, room: $('#r', m).value || null, notes: $('#n', m).value || null, created_by: S.user.id });
      if (ok(r)) { m.close(); schedule(el); }
    };
  });
  $$('[data-del]', el).forEach(b => b.onclick = async () => { if (confirm('حذف الموعد؟') && ok(await sb.from('schedule_items').delete().eq('id', b.dataset.del))) schedule(el); });
}

/* ===== التبليغات ===== */
export async function announcements(el) {
  const manage = can('manage_announcements'), like = can('like_announcements');
  const { data } = await sb.from('announcements').select('*,creator:profiles!announcements_created_by_fkey(full_name),announcement_likes(user_id)').order('is_pinned', { ascending: false }).order('published_at', { ascending: false });
  const list = (data || []).filter(a => a.is_published || manage);
  el.innerHTML = `${manage ? '<button class="btn" id="add">+ تبليغ جديد</button><br><br>' : ''}` + (list.length ? list.map(a => {
    const liked = a.announcement_likes.some(l => l.user_id === S.user.id);
    return `<div class="card"><div class="row"><h3 class="sp">${a.is_pinned ? '📌 ' : ''}${esc(a.title)}</h3>${a.is_published ? '' : '<span class="pill a">غير منشور</span>'}</div>
    <div class="mut">${esc(a.creator?.full_name)} · ${fmt(a.published_at)}</div><p style="white-space:pre-wrap">${esc(a.body)}</p>
    <div class="row">${like ? `<button class="btn sm ${liked ? '' : 'alt'}" data-like="${a.id}" data-on="${liked}">👍 ${a.announcement_likes.length}</button>` : `<span class="mut">👍 ${a.announcement_likes.length}</span>`}<span class="sp"></span>
    ${manage ? `<button class="btn sm alt" data-pin="${a.id}" data-v="${a.is_pinned}">${a.is_pinned ? 'إلغاء التثبيت' : 'تثبيت'}</button><button class="btn sm alt" data-edit="${a.id}">تعديل</button><button class="btn sm bad" data-del="${a.id}">حذف</button>` : ''}</div></div>`;
  }).join('') : '<p class="mut">لا توجد تبليغات.</p>');
  const form = (a) => {
    const m = modal(`<h3>${a ? 'تعديل' : 'تبليغ جديد'}</h3><label>العنوان</label><input id="t" value="${esc(a?.title)}"><label>النص</label><textarea id="b" rows="6">${esc(a?.body)}</textarea><label><input type="checkbox" id="p" ${a?.is_published === false ? '' : 'checked'}> نشر الآن</label><br><br><button class="btn" id="go">حفظ</button>`);
    $('#go', m).onclick = async () => {
      const row = { title: $('#t', m).value.trim(), body: $('#b', m).value.trim(), is_published: $('#p', m).checked };
      if (!row.title || !row.body) return toast('العنوان والنص مطلوبان');
      const r = a ? await sb.from('announcements').update(row).eq('id', a.id) : await sb.from('announcements').insert({ ...row, created_by: S.user.id });
      if (ok(r)) { m.close(); announcements(el); }
    };
  };
  $('#add', el)?.addEventListener('click', () => form());
  $$('[data-edit]', el).forEach(b => b.onclick = () => form(list.find(x => x.id === b.dataset.edit)));
  $$('[data-del]', el).forEach(b => b.onclick = async () => { if (confirm('حذف التبليغ؟') && ok(await sb.from('announcements').delete().eq('id', b.dataset.del))) announcements(el); });
  $$('[data-pin]', el).forEach(b => b.onclick = async () => { if (ok(await sb.from('announcements').update({ is_pinned: b.dataset.v !== 'true' }).eq('id', b.dataset.pin))) announcements(el); });
  $$('[data-like]', el).forEach(b => b.onclick = async () => {
    const q = sb.from('announcement_likes'); const r = b.dataset.on === 'true' ? await q.delete().match({ announcement_id: b.dataset.like, user_id: S.user.id }) : await q.insert({ announcement_id: b.dataset.like, user_id: S.user.id });
    if (ok(r)) announcements(el);
  });
}

/* ===== المكتبة ===== */
export async function library(el, sel = {}) {
  const [{ data: subs }, { data: types }] = await Promise.all([sb.from('subjects').select('*').eq('is_active', true).order('name'), sb.from('file_types').select('*').eq('is_active', true).order('name')]);
  const up = can('upload_files');
  const top = `<div class="row">${sel.subject ? '<button class="btn alt sm" id="back">← المواد</button>' : ''}<span class="sp"></span>${up ? '<button class="btn" id="up">رفع ملف</button>' : ''}</div><br>`;
  if (!sel.subject) {
    el.innerHTML = top + (subs?.length ? `<div class="tiles">${subs.map((s, i) => `<button class="tile c${i % 9}" data-s="${s.id}"><span>📚</span>${esc(s.name)}</button>`).join('')}</div>` : '<p class="mut">لا توجد مواد بعد.</p>');
    $$('[data-s]', el).forEach(b => b.onclick = () => library(el, { subject: b.dataset.s }));
  } else {
    const sub = subs.find(s => s.id === sel.subject);
    let q = sb.from('study_files').select('*,uploader:profiles!study_files_uploaded_by_fkey(full_name)').eq('subject_id', sel.subject).order('created_at', { ascending: false });
    const { data: files } = await q;
    const shown = (files || []).filter(f => (!sel.type || f.file_type_id === sel.type) && (f.status === 'published' || f.uploaded_by === S.user.id));
    el.innerHTML = top + `<h3>${esc(sub?.name)}</h3><div class="tabs"><button class="btn sm ${sel.type ? 'alt' : 'on'}" data-t="">الكل</button>${types.map(t => `<button class="btn sm ${sel.type === t.id ? 'on' : 'alt'}" data-t="${t.id}">${esc(t.name)}</button>`).join('')}</div>` +
      (shown.length ? shown.map(f => `<div class="card"><div class="row"><b class="sp">${esc(f.title)}</b><span class="pill ${f.status === 'published' ? 'g' : 'a'}">${f.status === 'published' ? esc(types.find(t => t.id === f.file_type_id)?.name || '') : 'بانتظار الموافقة'}</span></div>
      <div class="mut">${esc(f.uploader?.full_name)} · ${fmt(f.created_at)} · ${f.file_size_bytes ? (f.file_size_bytes / 1048576).toFixed(1) + ' MB' : ''}</div>
      <div class="row" style="margin-top:8px"><button class="btn sm" data-v="${f.id}">عرض</button><button class="btn sm alt" data-d="${f.id}">تنزيل</button>${f.status === 'published' && can('private_messages') ? `<button class="btn sm alt" data-sh="${f.id}">إرسال في محادثة</button>` : ''}</div></div>`).join('') : '<p class="mut">لا توجد ملفات هنا.</p>');
    $('#back', el).onclick = () => library(el);
    $$('[data-t]', el).forEach(b => b.onclick = () => library(el, { subject: sel.subject, type: b.dataset.t || null }));
    const f = id => files.find(x => x.id === id);
    $$('[data-v]', el).forEach(b => b.onclick = async () => { const u = await signed('study-files', f(b.dataset.v).storage_path); if (u) window.open(u, '_blank'); });
    $$('[data-d]', el).forEach(b => b.onclick = async () => { const x = f(b.dataset.d), u = await signed('study-files', x.storage_path, x.original_file_name); if (u) location.href = u; });
    $$('[data-sh]', el).forEach(b => b.onclick = () => userPicker(async (uid) => {
      const c = await sb.rpc('start_private_chat', { other_id: uid }); if (c.error) return err(c.error);
      if (ok(await sb.from('private_messages').insert({ conversation_id: c.data, sender_id: S.user.id, study_file_id: b.dataset.sh }))) toast('تم إرسال الملف');
    }));
  }
  $('#up', el)?.addEventListener('click', () => {
    const m = modal(`<h3>رفع ملف دراسي</h3><label>اسم الملف</label><input id="t"><label>المادة (إجباري)</label><select id="s"><option value="">اختر…</option>${subs.map(s => `<option value="${s.id}" ${s.id === sel.subject ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
      <label>نوع الملف (إجباري)</label><select id="k"><option value="">اختر…</option>${types.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select><label>الملف (حتى 50MB)</label><input type="file" id="f"><button class="btn" id="go">رفع</button>
      <p class="mut">${isRep() ? 'ملفات الممثل تُنشر مباشرة.' : 'سيُراجع الملف قبل نشره.'}</p>`);
    $('#go', m).onclick = async () => {
      const file = $('#f', m).files[0], t = $('#t', m).value.trim() || file?.name, s = $('#s', m).value, k = $('#k', m).value;
      if (!file || !s || !k) return toast('اختر المادة والنوع والملف');
      if (file.size > 52428800) return toast('الحجم الأقصى 50MB');
      $('#go', m).disabled = true;
      try {
        const path = await upload('study-files', file, S.user.id);
        const status = isRep() ? 'published' : S.profile.role === 'supervisor' ? 'pending_representative' : 'pending';
        const r = await sb.from('study_files').insert({ title: t, subject_id: s, file_type_id: k, storage_path: path, original_file_name: file.name, mime_type: file.type, file_size_bytes: file.size, uploaded_by: S.user.id, status, ...(status === 'published' ? { published_at: new Date().toISOString(), published_by: S.user.id } : {}) });
        if (ok(r)) { m.close(); toast(status === 'published' ? 'تم النشر' : 'أُرسل للمراجعة'); library(el, { subject: s }); }
      } catch (e) { err(e); $('#go', m).disabled = false; }
    };
  });
}

/* ===== المهام ===== */
export async function tasks(el) {
  const { data } = await sb.from('student_tasks').select('*').order('due_date').order('created_at');
  const open = (data || []).filter(t => !t.is_completed), done = (data || []).filter(t => t.is_completed);
  const row = t => `<div class="card row" data-id="${t.id}"><input type="checkbox" data-c="${t.id}" ${t.is_completed ? 'checked' : ''} style="width:22px;height:22px"><span class="sp" style="${t.is_completed ? 'text-decoration:line-through;opacity:.6' : ''}">${esc(t.title)}<br><span class="mut">${fmtD(t.due_date)}</span></span><button class="btn sm alt" data-x="${t.id}">✕</button></div>`;
  el.innerHTML = `<div class="card"><div class="row"><input id="t" placeholder="مهمة جديدة…" style="flex:1;margin:0"><input id="d" type="date" value="${localISO(new Date()).slice(0, 10)}" style="width:auto;margin:0"><button class="btn" id="add">إضافة</button></div></div>
    ${open.length ? open.map(row).join('') : '<p class="mut">لا توجد مهام مفتوحة 🎉</p>'}${done.length ? `<details><summary class="mut">المكتملة (${done.length})</summary><br>${done.map(row).join('')}</details>` : ''}`;
  $('#add', el).onclick = async () => { const t = $('#t', el).value.trim(); if (!t) return; if (ok(await sb.from('student_tasks').insert({ title: t, due_date: $('#d', el).value, user_id: S.user.id }))) tasks(el); };
  $$('[data-c]', el).forEach(c => c.onchange = async () => {
    c.closest('.card').classList.add('done'); const r = await sb.from('student_tasks').update({ is_completed: c.checked, completed_at: c.checked ? new Date().toISOString() : null }).eq('id', c.dataset.c);
    if (ok(r)) setTimeout(() => tasks(el), 350);
  });
  $$('[data-x]', el).forEach(b => b.onclick = async () => { if (ok(await sb.from('student_tasks').delete().eq('id', b.dataset.x))) tasks(el); });
}

/* ===== المنبهات ===== */
export async function reminders(el) {
  const { data } = await sb.from('student_reminders').select('*').order('remind_at');
  const SND = { 'classic-bell': 'جرس كلاسيكي', 'soft-chime': 'رنين هادئ', 'digital': 'رقمي' };
  el.innerHTML = `<div class="card"><label>اسم المنبه</label><input id="t" placeholder="مراجعة محاضرة التشريح"><label>الموعد</label><input id="a" type="datetime-local" value="${localISO(Date.now() + 36e5)}">
    <div class="row"><div class="sp"><label>التكرار</label><select id="r"><option value="none">مرة واحدة</option><option value="daily">يومياً</option><option value="weekly">أسبوعياً</option></select></div><div class="sp"><label>الصوت</label><select id="s">${Object.entries(SND).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div></div>
    <button class="btn" id="add">حفظ المنبه</button> <button class="btn alt" id="perm">تفعيل إشعارات المتصفح</button><p class="mut">يرنّ المنبه ما دام التطبيق مفتوحاً. على الهاتف ثبّت التطبيق من المتصفح وأبقِه مفتوحاً لأفضل نتيجة.</p></div>` +
    ((data || []).map(r => `<div class="card row"><span class="sp"><b>${esc(r.title)}</b><br><span class="mut">${fmt(r.remind_at)} · ${{ none: 'مرة واحدة', daily: 'يومياً', weekly: 'أسبوعياً' }[r.recurrence]}</span></span>
      <input type="checkbox" data-e="${r.id}" ${r.is_enabled ? 'checked' : ''} style="width:22px;height:22px"><button class="btn sm alt" data-x="${r.id}">✕</button></div>`).join('') || '<p class="mut">لا توجد منبهات.</p>');
  $('#perm', el).onclick = async () => toast((await Notification.requestPermission?.()) === 'granted' ? 'تم التفعيل' : 'لم يُمنح الإذن');
  $('#add', el).onclick = async () => {
    const t = $('#t', el).value.trim(); if (!t || !$('#a', el).value) return toast('اكتب الاسم والموعد');
    if (ok(await sb.from('student_reminders').insert({ user_id: S.user.id, title: t, remind_at: new Date($('#a', el).value).toISOString(), recurrence: $('#r', el).value, sound_name: $('#s', el).value, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Baghdad' }))) reminders(el);
  };
  $$('[data-e]', el).forEach(c => c.onchange = async () => ok(await sb.from('student_reminders').update({ is_enabled: c.checked }).eq('id', c.dataset.e)));
  $$('[data-x]', el).forEach(b => b.onclick = async () => { if (ok(await sb.from('student_reminders').delete().eq('id', b.dataset.x))) reminders(el); });
}
