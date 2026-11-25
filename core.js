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
export function avatar(u) { return `<img class="av" alt="" src="${esc(u?.avatar_url || 'icon.svg')}">`; }
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
