import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
export const S = { user: null, profile: null, perms: {}, users: {}, ch: [], unread: 0 };
export const PK = ['approve_accounts','approve_student_files','approve_supervisor_files','upload_files','public_chat','private_messages','like_announcements','manage_accounts','manage_subjects','manage_file_types','manage_content','manage_announcements','manage_schedule','delete_public_messages','suspend_accounts','view_audit_logs'];
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const isRep = () => S.profile?.role === 'representative';
export const can = k => isRep() || !!S.perms[k];
export const fmt = d => d ? new Date(d).toLocaleString('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' }) : '';
export const fmtD = d => d ? new Date(d).toLocaleDateString('ar-IQ', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
export const ext = n => (n.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
export const rid = () => crypto.randomUUID();
export const localISO = d => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
export function toast(m) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; $('#toasts').append(t); setTimeout(() => t.remove(), 3500); }
export function normPhone(p) {
  let d = String(p).replace(/[^\d+]/g, '');
  if (d.startsWith('+')) return d;
  if (d.startsWith('00')) return '+' + d.slice(2);
  if (d.startsWith('964')) return '+' + d;
  if (d.startsWith('0')) return '+964' + d.slice(1);
  return '+964' + d;
}
export function modal(html) {
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div>${html}</div>`;
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });
  document.body.append(m); m.close = () => m.remove(); return m;
}
export async function signed(bucket, path, download) {
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, 3600, download ? { download } : undefined);
  if (error) { toast('تعذر فتح الملف'); return null; }
  return data.signedUrl;
}
export async function upload(bucket, file, uid) {
  const path = `${uid}/${rid()}.${ext(file.name)}`;
  const { error } = await sb.storage.from(bucket).upload(path, file, { contentType: file.type || undefined });
  if (error) throw error;
  return path;
}
export async function loadUsers() {
  const { data } = await sb.from('profiles').select('id,full_name,avatar_url,role,status').eq('status', 'active');
  S.users = Object.fromEntries((data || []).map(u => [u.id, u]));
}
export async function loadPerms() {
  const r = await Promise.all(PK.map(k => sb.rpc('has_permission', { permission_key_input: k })));
  S.perms = Object.fromEntries(PK.map((k, i) => [k, r[i].data === true]));
}
export function ava(name, url, cls = 'av') { return url ? `<img class="${cls}" alt="" src="${esc(url)}">` : `<span class="${cls} ph">${esc(String(name || '؟').trim().charAt(0))}</span>`; }
export function avatar(u) { return ava(u?.full_name, u?.avatar_url); }
export function unsub() { S.ch.forEach(c => sb.removeChannel(c)); S.ch = []; }
// صوت المنبه والتنبيه
let actx;
export function beep(kind = 'classic-bell') {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const seq = { 'classic-bell': [880, 1100, 880, 1100], 'soft-chime': [660, 880], 'digital': [1200, 1200, 1200, 1200, 1200] }[kind] || [880, 1100];
    seq.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.frequency.value = f; o.type = kind === 'digital' ? 'square' : 'sine';
      g.gain.setValueAtTime(.25, actx.currentTime + i * .25); g.gain.exponentialRampToValueAtTime(.001, actx.currentTime + i * .25 + .22);
      o.connect(g).connect(actx.destination); o.start(actx.currentTime + i * .25); o.stop(actx.currentTime + i * .25 + .24);
    });
  } catch {}
}
export async function webNotify(title, body) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) reg.showNotification(title, { body, icon: 'icon.svg', dir: 'rtl', lang: 'ar' }); else new Notification(title, { body });
  } catch {}
}

// ===== الأيقونات (SVG مضمّنة) =====
const P = {
 home:'<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
 chat:'<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/>',
 user:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"/>',
 bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
 megaphone:'<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
 calendar:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
 folder:'<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/>',
 check:'<path d="M21 10.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12.5"/><path d="m9 11 3 3L22 4"/>',
 tick:'<path d="M20 6 9 17l-5-5"/>',
 clip:'<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
 mic:'<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3"/>',
 send:'<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
 image:'<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
 search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
 plus:'<path d="M5 12h14M12 5v14"/>',
 x:'<path d="M18 6 6 18M6 6l12 12"/>',
 trash:'<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
 shield:'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
 palette:'<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
 logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
 idcard:'<rect width="20" height="14" x="2" y="5" rx="2"/><circle cx="8" cy="12" r="2"/><path d="M14 10h4M14 14h4"/>',
 timer:'<circle cx="12" cy="14" r="8"/><path d="M12 10v4M10 2h4"/>',
 users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
 file:'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8"/>',
 back:'<path d="M5 12h14M12 5l7 7-7 7"/>',
 phone:'<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
 lock:'<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
 camera:'<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
 book:'<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
 info:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
 pencil:'<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>'
};
export const ic = (n, s = 20) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;
export const canAdmin = () => ['approve_accounts', 'manage_accounts', 'approve_student_files', 'approve_supervisor_files', 'manage_subjects', 'manage_file_types', 'view_audit_logs'].some(can);
// ===== الأنماط (تُحفظ على الجهاز وفي حساب المستخدم) =====
export const THEMES = [
  { k: 'pink', name: 'الوردي والزهري والأبيض', desc: 'تدرجات الوردي الناعمة', sw: ['#FFFFFF', '#F472B6', '#BE185D'] },
  { k: 'blue', name: 'الأزرق والسماوي والأبيض', desc: 'تدرجات الأزرق والسماوي', sw: ['#FFFFFF', '#38BDF8', '#1E40AF'] },
  { k: 'green', name: 'الأخضر والعشبي والأبيض', desc: 'تدرجات الأخضر الحيوية', sw: ['#FFFFFF', '#4ADE80', '#15803D'] },
  { k: 'yellow', name: 'الأصفر الغامق والفاتح والأبيض', desc: 'تدرجات الأصفر الذهبي', sw: ['#FFFFFF', '#FDE047', '#D97706'] }
];
export function applyTheme(k) {
  const t = THEMES.some(x => x.k === k) ? k : 'blue';
  document.body.setAttribute('data-theme', t);
  try { localStorage.setItem('momathili_theme', t); } catch {}
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = getComputedStyle(document.body).getPropertyValue('--primary').trim() || '#0284c7';
  return t;
}
export async function setTheme(k) {
  const t = applyTheme(k);
  if (S.user) { const { error } = await sb.auth.updateUser({ data: { theme: t } }); if (error) toast('تعذر حفظ النمط في حسابك'); else toast('تم حفظ النمط في حسابك'); }
  return t;
}
