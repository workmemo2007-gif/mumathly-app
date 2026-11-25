-- تم تطبيق هذا الملف مسبقاً على مشروع Supabase الخاص بك (idempotent: آمن لإعادة التشغيل).
create or replace function public.start_private_chat(other_id uuid) returns uuid language plpgsql security definer set search_path to 'pg_catalog','public','pg_temp' as $$
declare cid uuid;
begin
  if not (public.is_active_user() and public.has_permission('private_messages')) then raise exception 'غير مصرح لك بالرسائل الخاصة'; end if;
  if other_id = auth.uid() then raise exception 'لا يمكن مراسلة نفسك'; end if;
  if not exists (select 1 from public.profiles where id = other_id and status = 'active') then raise exception 'الحساب غير متاح'; end if;
  select cm1.conversation_id into cid from public.conversation_members cm1 join public.conversation_members cm2 on cm2.conversation_id = cm1.conversation_id
   where cm1.user_id = auth.uid() and cm2.user_id = other_id and (select count(*) from public.conversation_members x where x.conversation_id = cm1.conversation_id) = 2 limit 1;
  if cid is null then
    insert into public.conversations default values returning id into cid;
    insert into public.conversation_members (conversation_id, user_id) values (cid, auth.uid()), (cid, other_id);
  end if;
  return cid;
end $$;
revoke all on function public.start_private_chat(uuid) from public, anon; grant execute on function public.start_private_chat(uuid) to authenticated;

create or replace function public.my_conversations() returns table(conversation_id uuid, other_id uuid, other_name text, other_avatar text, delete_after_24h boolean, last_body text, last_at timestamptz)
language sql stable security definer set search_path to 'pg_catalog','public','pg_temp' as $$
  select me.conversation_id, o.user_id, p.full_name, p.avatar_url, me.delete_messages_after_24h,
    (select m.body from public.private_messages m where m.conversation_id = me.conversation_id order by m.created_at desc limit 1),
    coalesce((select max(m.created_at) from public.private_messages m where m.conversation_id = me.conversation_id), me.joined_at)
  from public.conversation_members me join public.conversation_members o on o.conversation_id = me.conversation_id and o.user_id <> me.user_id
  join public.profiles p on p.id = o.user_id where me.user_id = auth.uid() and public.is_active_user() order by 7 desc;
$$;
revoke all on function public.my_conversations() from public, anon; grant execute on function public.my_conversations() to authenticated;

-- عند قبول حساب طالب: منحه الصلاحيات الأساسية + إشعار
create or replace function public.on_profile_activated() returns trigger language plpgsql security definer set search_path to 'pg_catalog','public','pg_temp' as $$
begin
  if new.status is distinct from old.status and new.status in ('active','rejected','suspended') then
    if new.status = 'active' and new.role = 'student' then
      insert into public.user_permissions (user_id, permission_key, enabled)
      select new.id, k, true from unnest(array['public_chat','private_messages','like_announcements','upload_files']) k on conflict (user_id, permission_key) do nothing;
    end if;
    insert into public.notifications (user_id, title, body, kind) values (new.id,
      case new.status when 'active' then 'تمت الموافقة على حسابك' when 'rejected' then 'تم رفض حسابك' else 'تم إيقاف حسابك' end, coalesce(new.approval_note, ''), 'account');
  end if; return new;
end $$;
drop trigger if exists profiles_status_change on public.profiles;
create trigger profiles_status_change after update of status on public.profiles for each row execute function public.on_profile_activated();

create or replace function public.on_announcement_created() returns trigger language plpgsql security definer set search_path to 'pg_catalog','public','pg_temp' as $$
begin
  if new.is_published then
    insert into public.notifications (user_id, title, body, kind, data)
    select id, 'تبليغ جديد: ' || new.title, left(new.body, 140), 'announcement', jsonb_build_object('id', new.id) from public.profiles where status = 'active' and id <> new.created_by;
  end if; return new;
end $$;
drop trigger if exists announcements_notify on public.announcements;
create trigger announcements_notify after insert on public.announcements for each row execute function public.on_announcement_created();

create or replace function public.on_private_message_created() returns trigger language plpgsql security definer set search_path to 'pg_catalog','public','pg_temp' as $$
begin
  insert into public.notifications (user_id, title, body, kind, data)
  select cm.user_id, 'رسالة خاصة جديدة', coalesce(left(new.body, 80), 'مرفق'), 'private_message', jsonb_build_object('conversation_id', new.conversation_id)
  from public.conversation_members cm where cm.conversation_id = new.conversation_id and cm.user_id <> new.sender_id;
  return new;
end $$;
drop trigger if exists private_messages_notify on public.private_messages;
create trigger private_messages_notify after insert on public.private_messages for each row execute function public.on_private_message_created();

-- حذف الرسائل المنتهية (24 ساعة) كل 30 دقيقة
do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('momathili-expire-public', '*/30 * * * *', 'select public.delete_expired_public_chat_messages()');
  perform cron.schedule('momathili-expire-private', '*/30 * * * *', 'select public.delete_expired_private_messages()');
exception when others then raise notice 'pg_cron unavailable: %', sqlerrm; end $$;

-- ===== تعيين الممثل الأعلى (شغّله مرة واحدة بعد إنشاء حسابك داخل التطبيق) =====
-- update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data,'{}'::jsonb) || '{"is_super_admin":true}'::jsonb where phone = '9647723681360';
