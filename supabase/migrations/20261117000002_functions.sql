-- ════════════════════════════════════════════════════════════════════
-- GLOBENTIA — helper, booking & payment functions
-- ════════════════════════════════════════════════════════════════════

-- ─── Role helpers (security definer: callable from RLS without recursion) ──
create or replace function public.has_role(p_role public.app_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.key = p_role
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role('admin') or public.has_role('super_admin');
$$;

create or replace function public.is_editor()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role('editor') or public.is_admin();
$$;

create or replace function public.current_consultant_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.consultants where user_id = auth.uid();
$$;

-- True for trusted server contexts (service role, migrations, security-definer functions)
create or replace function public.is_privileged()
returns boolean language sql stable set search_path = '' as $$
  select current_user not in ('authenticated', 'anon') or public.is_admin();
$$;

create or replace function public.get_setting(p_key text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select value from public.platform_settings where key = p_key;
$$;

-- Number of decimals for each currency (XAF has none)
create or replace function public.currency_round(p_amount numeric, p_currency public.currency_code)
returns numeric language sql immutable as $$
  select case when p_currency = 'XAF' then round(p_amount, 0) else round(p_amount, 2) end;
$$;

-- ─── New user → profile + default role ─────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email, phone, preferred_locale)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data ->> 'phone',
    case when new.raw_user_meta_data ->> 'locale' = 'en' then 'en' else 'fr' end
  );
  insert into public.user_roles (user_id, role_id)
  select new.id, id from public.roles where key = 'client';
  -- Self-registered consultants get the consultant role; their profile stays
  -- unpublished and unverified until an administrator reviews the documents.
  if new.raw_user_meta_data ->> 'account_type' = 'consultant' then
    insert into public.user_roles (user_id, role_id)
    select new.id, id from public.roles where key = 'consultant';
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ─── Column guards: non-privileged users cannot escalate ────────────
create or replace function public.guard_profiles()
returns trigger language plpgsql as $$
begin
  if not public.is_privileged() then
    new.is_active := old.is_active;
    new.id := old.id;
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function public.guard_profiles();

create or replace function public.guard_consultants()
returns trigger language plpgsql as $$
begin
  if not public.is_privileged() then
    if tg_op = 'INSERT' then
      new.verification_status := 'unverified';
      new.verified_at := null; new.verified_by := null;
      new.is_published := false;
      new.commission_rate := null;
      new.rating_avg := 0; new.reviews_count := 0; new.completed_consultations := 0;
    else
      new.user_id := old.user_id;
      new.verification_status := old.verification_status;
      new.verified_at := old.verified_at;
      new.verified_by := old.verified_by;
      new.commission_rate := old.commission_rate;
      new.rating_avg := old.rating_avg;
      new.reviews_count := old.reviews_count;
      new.completed_consultations := old.completed_consultations;
      new.is_published := old.is_published;
      -- changing the declared professional type or licence re-triggers verification
      if new.consultant_type is distinct from old.consultant_type
         or new.license_number is distinct from old.license_number then
        new.verification_status := 'pending';
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger consultants_guard before insert or update on public.consultants
for each row execute function public.guard_consultants();

create or replace function public.guard_bookings()
returns trigger language plpgsql as $$
begin
  -- Direct updates by consultants may only touch the meeting link
  if not public.is_privileged() then
    if (to_jsonb(new) - 'meeting_url' - 'updated_at') is distinct from (to_jsonb(old) - 'meeting_url' - 'updated_at') then
      raise exception 'bookings can only be changed through booking functions' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger bookings_guard before update on public.bookings for each row execute function public.guard_bookings();

-- Payments: a successful payment can only move to refunded
create or replace function public.guard_payment_transitions()
returns trigger language plpgsql as $$
begin
  if old.status = 'successful' and new.status not in ('successful', 'refunded') then
    raise exception 'invalid payment transition % → %', old.status, new.status;
  end if;
  if old.status = 'refunded' and new.status <> 'refunded' then
    raise exception 'refunded payments are final';
  end if;
  if new.status is distinct from old.status then
    insert into public.payment_status_history (payment_id, from_status, to_status, source)
    values (new.id, old.status, new.status, coalesce(current_setting('globentia.change_source', true), 'system'));
  end if;
  return new;
end $$;
create trigger payments_transitions before update on public.payments for each row execute function public.guard_payment_transitions();

-- ─── Generic audit trigger ─────────────────────────────────────────
create or replace function public.audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_id text;
begin
  v_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id', to_jsonb(new) ->> 'key', to_jsonb(old) ->> 'key');
  insert into public.audit_logs (actor_id, action, entity, entity_id, old_data, new_data)
  values (
    auth.uid(), lower(tg_op), tg_table_name, v_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'consultants', 'consultant_documents', 'services', 'bookings', 'payments',
    'commission_records', 'refunds', 'platform_settings', 'user_roles', 'articles'
  ] loop
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_row()', t, t);
  end loop;
end $$;

-- ─── Reference generator ───────────────────────────────────────────
create or replace function public.gen_booking_reference()
returns text language plpgsql volatile set search_path = '' as $$
declare v text;
begin
  loop
    v := 'GLB-' || to_char(now() at time zone 'Africa/Douala', 'YYMMDD') || '-' ||
         upper(encode(extensions.gen_random_bytes(3), 'hex'));
    exit when not exists (select 1 from public.bookings where reference = v);
  end loop;
  return v;
end $$;

-- ─── Slot validation (shared by holds & rescheduling) ──────────────
create or replace function public._assert_slot_bookable(
  p_consultant_id uuid, p_starts_at timestamptz, p_ends_at timestamptz, p_ignore_booking uuid default null
) returns void language plpgsql stable security definer set search_path = '' as $$
declare
  c record;
  v_local_start timestamp;
  v_local_end timestamp;
begin
  select * into c from public.consultants where id = p_consultant_id;
  if not found or not c.is_published or not c.accepts_bookings then
    raise exception 'consultant_unavailable' using errcode = 'P0001';
  end if;
  if p_starts_at < now() + make_interval(hours => c.min_notice_hours) then
    raise exception 'too_late_to_book' using errcode = 'P0001';
  end if;
  v_local_start := p_starts_at at time zone c.timezone;
  v_local_end := p_ends_at at time zone c.timezone;
  if v_local_start::date <> (v_local_end - interval '1 microsecond')::date or not exists (
    select 1 from public.availability a
    where a.consultant_id = p_consultant_id
      and a.weekday = extract(dow from v_local_start)
      and v_local_start::time >= a.start_time
      and (v_local_end::time <= a.end_time or (v_local_end::time = '00:00' and a.end_time = '23:59:59'))
  ) then
    raise exception 'outside_availability' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.availability_exceptions e
    where e.consultant_id = p_consultant_id and e.period && tstzrange(p_starts_at, p_ends_at, '[)')
  ) then
    raise exception 'outside_availability' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.bookings b
    where b.consultant_id = p_consultant_id
      and b.id is distinct from p_ignore_booking
      and b.slot && tstzrange(p_starts_at, p_ends_at, '[)')
      and (b.status in ('confirmed', 'completed') or (b.status = 'pending_payment' and b.hold_expires_at > now()))
  ) then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end if;
end $$;

-- ─── Release expired unpaid holds ──────────────────────────────────
create or replace function public.release_expired_holds(p_consultant_id uuid default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  with expired as (
    update public.bookings set status = 'expired'
    where status = 'pending_payment' and hold_expires_at <= now()
      and (p_consultant_id is null or consultant_id = p_consultant_id)
    returning id
  ), hist as (
    insert into public.booking_status_history (booking_id, from_status, to_status, note)
    select id, 'pending_payment', 'expired', 'hold expired without payment' from expired
  ), pay as (
    update public.payments p set status = 'cancelled', failure_reason = 'hold_expired'
    where p.booking_id in (select id from expired) and p.status in ('pending', 'processing')
  )
  select count(*) into n from expired;
  return n;
end $$;

-- ─── Available slots (public, leaks no booking data) ────────────────
create or replace function public.get_available_slots(
  p_consultant_service_id uuid, p_from date, p_to date
) returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  cs record;
  c record;
begin
  if p_to < p_from or p_to - p_from > 62 then
    raise exception 'invalid_range' using errcode = 'P0001';
  end if;
  select * into cs from public.consultant_services where id = p_consultant_service_id and is_active;
  if not found then return; end if;
  select * into c from public.consultants where id = cs.consultant_id and is_published and accepts_bookings;
  if not found then return; end if;

  return query
  with days as (
    select d::date as day from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') d
  ), candidates as (
    select (gs at time zone c.timezone) as s
    from days dy
    join public.availability a on a.consultant_id = c.id and a.weekday = extract(dow from dy.day)
    cross join lateral generate_series(
      dy.day + a.start_time,
      dy.day + a.end_time - make_interval(mins => cs.duration_minutes),
      make_interval(mins => greatest(30, least(cs.duration_minutes, 60)))
    ) gs
  )
  select cand.s, cand.s + make_interval(mins => cs.duration_minutes)
  from candidates cand
  where cand.s >= now() + make_interval(hours => c.min_notice_hours)
    and not exists (
      select 1 from public.bookings b
      where b.consultant_id = c.id
        and b.slot && tstzrange(cand.s, cand.s + make_interval(mins => cs.duration_minutes), '[)')
        and (b.status in ('confirmed', 'completed') or (b.status = 'pending_payment' and b.hold_expires_at > now()))
    )
    and not exists (
      select 1 from public.availability_exceptions e
      where e.consultant_id = c.id
        and e.period && tstzrange(cand.s, cand.s + make_interval(mins => cs.duration_minutes), '[)')
    )
  order by 1;
end $$;

-- ─── Create a temporary hold during checkout ───────────────────────
create or replace function public.create_booking_hold(
  p_consultant_service_id uuid,
  p_starts_at timestamptz,
  p_method public.consultation_method,
  p_full_name text,
  p_email text,
  p_phone text,
  p_country_of_residence text,
  p_destination_country_id uuid default null,
  p_procedure_type text default null,
  p_project_description text default null
) returns table (booking_id uuid, reference text, hold_expires_at timestamptz, price numeric, currency public.currency_code)
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  cs record;
  s record;
  c record;
  v_price numeric;
  v_currency public.currency_code;
  v_hold_minutes integer;
  v_booking public.bookings;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;

  select * into cs from public.consultant_services where id = p_consultant_service_id and is_active;
  if not found then raise exception 'service_unavailable' using errcode = 'P0001'; end if;
  select * into s from public.services where id = cs.service_id and is_active and is_bookable;
  if not found then raise exception 'service_unavailable' using errcode = 'P0001'; end if;
  select * into c from public.consultants where id = cs.consultant_id;
  if c.user_id = v_uid then raise exception 'cannot_book_self' using errcode = 'P0001'; end if;
  if not (p_method = any (cs.methods)) then raise exception 'method_unavailable' using errcode = 'P0001'; end if;

  -- anti slot-squatting: max 3 simultaneous unpaid holds per client
  if (select count(*) from public.bookings b
      where b.client_id = v_uid and b.status = 'pending_payment' and b.hold_expires_at > now()) >= 3 then
    raise exception 'too_many_pending_holds' using errcode = 'P0001';
  end if;

  perform public.release_expired_holds(c.id);
  perform public._assert_slot_bookable(c.id, p_starts_at, p_starts_at + make_interval(mins => cs.duration_minutes));

  if cs.price is not null then
    v_price := cs.price; v_currency := cs.currency;
  else
    v_price := s.base_price; v_currency := s.currency;
  end if;
  v_hold_minutes := coalesce((public.get_setting('booking_hold_minutes'))::text::integer, 15);

  begin
    insert into public.bookings (
      reference, client_id, consultant_id, service_id, consultant_service_id, starts_at, ends_at, method,
      status, hold_expires_at, price, currency, client_full_name, client_email, client_phone,
      client_country_of_residence, destination_country_id, procedure_type, project_description
    ) values (
      public.gen_booking_reference(), v_uid, c.id, s.id, cs.id, p_starts_at,
      p_starts_at + make_interval(mins => cs.duration_minutes), p_method,
      'pending_payment', now() + make_interval(mins => v_hold_minutes), v_price, v_currency,
      p_full_name, p_email, p_phone, p_country_of_residence, p_destination_country_id,
      p_procedure_type, p_project_description
    ) returning * into v_booking;
  exception when exclusion_violation then
    -- concurrent checkout grabbed the same slot a few ms earlier
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end;

  insert into public.booking_status_history (booking_id, from_status, to_status, changed_by, note)
  values (v_booking.id, null, 'pending_payment', v_uid, 'slot held during checkout');

  return query select v_booking.id, v_booking.reference, v_booking.hold_expires_at, v_booking.price, v_booking.currency;
end $$;

-- ─── Confirm a payment (SERVICE ROLE ONLY — called after server-side verification) ──
create or replace function public.confirm_payment(
  p_payment_reference text,
  p_provider text,
  p_provider_reference text,
  p_amount numeric,
  p_currency public.currency_code,
  p_is_live boolean
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  p public.payments;
  b public.bookings;
  c public.consultants;
  v_rate numeric;
  v_commission numeric;
  v_new_status public.booking_status;
begin
  perform set_config('globentia.change_source', 'webhook:' || p_provider, true);

  select * into p from public.payments where reference = p_payment_reference for update;
  if not found then raise exception 'payment_not_found' using errcode = 'P0002'; end if;
  if p.provider <> p_provider then raise exception 'provider_mismatch' using errcode = 'P0001'; end if;

  -- ★ Idempotency: a second notification for the same payment changes nothing
  if p.status = 'successful' then
    return jsonb_build_object('result', 'already_processed', 'booking_id', p.booking_id);
  end if;
  if p.status = 'refunded' then
    return jsonb_build_object('result', 'ignored_refunded');
  end if;

  -- ★ Never trust the amount: it must match what we asked the provider to charge
  if p_amount <> p.amount or p_currency <> p.currency then
    update public.payments set status = 'failed',
      failure_reason = format('amount_mismatch: expected %s %s, got %s %s', p.amount, p.currency, p_amount, p_currency)
    where id = p.id;
    return jsonb_build_object('result', 'amount_mismatch');
  end if;

  select * into b from public.bookings where id = p.booking_id for update;
  select * into c from public.consultants where id = b.consultant_id;

  v_rate := coalesce(c.commission_rate, (public.get_setting('commission_rate'))::text::numeric, 0.20);
  v_commission := public.currency_round(p.amount * v_rate, p.currency);

  update public.payments set
    status = 'successful', paid_at = now(), provider_reference = coalesce(p_provider_reference, provider_reference),
    is_live = p_is_live, platform_commission = v_commission, consultant_earnings = p.amount - v_commission
  where id = p.id;

  insert into public.commission_records (payment_id, booking_id, consultant_id, gross_amount, commission_rate,
    commission_amount, consultant_amount, currency)
  values (p.id, b.id, c.id, p.amount, v_rate, v_commission, p.amount - v_commission, p.currency)
  on conflict (payment_id) do nothing;

  -- Confirm the booking. If the hold expired and someone else took the slot, flag for refund.
  if b.status in ('pending_payment', 'expired') then
    begin
      update public.bookings set status = 'confirmed', hold_expires_at = null where id = b.id;
      v_new_status := 'confirmed';
    exception when exclusion_violation then
      update public.bookings set status = 'refund_required' where id = b.id;
      v_new_status := 'refund_required';
    end;
  else
    -- cancelled before the payment arrived
    update public.bookings set status = 'refund_required' where id = b.id;
    v_new_status := 'refund_required';
  end if;

  insert into public.booking_status_history (booking_id, from_status, to_status, note)
  values (b.id, b.status, v_new_status, 'payment ' || p.reference || ' verified by ' || p_provider);

  if v_new_status = 'confirmed' then
    insert into public.notifications (user_id, kind, title, body, link, data) values
      (b.client_id, 'booking_confirmed', 'Réservation confirmée',
       format('Votre consultation %s est confirmée.', b.reference), '/booking/' || b.reference,
       jsonb_build_object('booking_reference', b.reference)),
      (c.user_id, 'new_booking', 'Nouvelle réservation',
       format('Nouvelle consultation %s le %s.', b.reference, to_char(b.starts_at at time zone c.timezone, 'DD/MM/YYYY HH24:MI')),
       '/consultant/bookings', jsonb_build_object('booking_reference', b.reference));
  else
    insert into public.refunds (payment_id, amount, reason) values (p.id, p.amount, 'slot no longer available at payment time');
    insert into public.support_tickets (user_id, booking_id, kind, subject, message)
    values (b.client_id, b.id, 'refund_request', 'Remboursement requis ' || b.reference,
            'Paiement reçu après expiration du créneau. Remboursement automatique à traiter.');
    insert into public.notifications (user_id, kind, title, body, link)
    values (b.client_id, 'booking_refund_required', 'Créneau indisponible',
            'Votre paiement a bien été reçu mais le créneau n''est plus disponible. Vous serez remboursé(e).', '/dashboard/bookings');
  end if;

  return jsonb_build_object('result', 'processed', 'booking_status', v_new_status, 'booking_id', b.id);
end $$;

-- ─── Mark a payment failed/cancelled (SERVICE ROLE ONLY) ───────────
create or replace function public.fail_payment(p_payment_reference text, p_status public.payment_status, p_reason text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare p public.payments;
begin
  if p_status not in ('failed', 'cancelled', 'processing') then raise exception 'invalid_status'; end if;
  select * into p from public.payments where reference = p_payment_reference for update;
  if not found then raise exception 'payment_not_found' using errcode = 'P0002'; end if;
  if p.status in ('successful', 'refunded', 'failed', 'cancelled') then
    return jsonb_build_object('result', 'already_final', 'status', p.status);
  end if;
  update public.payments set status = p_status, failure_reason = p_reason where id = p.id;
  return jsonb_build_object('result', 'updated', 'status', p_status);
end $$;

-- ─── Cancellation (client, consultant or admin) ────────────────────
create or replace function public.cancel_booking(p_booking_id uuid, p_reason text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  b public.bookings;
  c public.consultants;
  v_uid uuid := auth.uid();
  v_actor text;
  v_free_hours integer := coalesce((public.get_setting('cancellation_policy') ->> 'free_until_hours')::integer, 24);
  v_refund boolean := false;
  p public.payments;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'booking_not_found' using errcode = 'P0002'; end if;
  select * into c from public.consultants where id = b.consultant_id;

  v_actor := case when public.is_admin() then 'admin'
                  when b.client_id = v_uid then 'client'
                  when c.user_id = v_uid then 'consultant' end;
  if v_actor is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if b.status not in ('pending_payment', 'confirmed') then raise exception 'not_cancellable' using errcode = 'P0001'; end if;

  if b.status = 'confirmed' then
    select * into p from public.payments where booking_id = b.id and status = 'successful';
    -- consultant / admin cancellations are always refunded; client within policy window
    v_refund := found and (v_actor <> 'client' or b.starts_at - now() >= make_interval(hours => v_free_hours));
    if v_refund then
      insert into public.refunds (payment_id, amount, reason, requested_by, status)
      values (p.id, p.amount, coalesce(p_reason, 'cancellation'), v_uid, 'requested');
    end if;
  end if;

  update public.bookings set status = 'cancelled', cancelled_at = now(), cancelled_by = v_uid,
    cancellation_reason = p_reason, hold_expires_at = null
  where id = b.id;
  insert into public.booking_status_history (booking_id, from_status, to_status, changed_by, note)
  values (b.id, b.status, 'cancelled', v_uid, v_actor || ': ' || coalesce(p_reason, ''));

  if b.status = 'confirmed' then
    insert into public.notifications (user_id, kind, title, body, link) values
      (b.client_id, 'booking_cancelled', 'Réservation annulée', format('La consultation %s a été annulée.', b.reference), '/dashboard/bookings'),
      (c.user_id, 'booking_cancelled', 'Réservation annulée', format('La consultation %s a été annulée.', b.reference), '/consultant/bookings');
  end if;
  return jsonb_build_object('result', 'cancelled', 'refund', v_refund);
end $$;

-- ─── Rescheduling (client, within policy) ──────────────────────────
create or replace function public.reschedule_booking(p_booking_id uuid, p_new_starts_at timestamptz)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  b public.bookings;
  v_uid uuid := auth.uid();
  v_hours integer := coalesce((public.get_setting('cancellation_policy') ->> 'reschedule_until_hours')::integer, 24);
  v_duration interval;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'booking_not_found' using errcode = 'P0002'; end if;
  if b.client_id <> v_uid and not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if b.status <> 'confirmed' then raise exception 'not_reschedulable' using errcode = 'P0001'; end if;
  if b.starts_at - now() < make_interval(hours => v_hours) and not public.is_admin() then
    raise exception 'reschedule_window_closed' using errcode = 'P0001';
  end if;
  v_duration := b.ends_at - b.starts_at;
  perform public._assert_slot_bookable(b.consultant_id, p_new_starts_at, p_new_starts_at + v_duration, b.id);
  begin
    update public.bookings set starts_at = p_new_starts_at, ends_at = p_new_starts_at + v_duration where id = b.id;
  exception when exclusion_violation then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end;
  insert into public.booking_status_history (booking_id, from_status, to_status, changed_by, note)
  values (b.id, 'confirmed', 'confirmed', v_uid, format('rescheduled from %s to %s', b.starts_at, p_new_starts_at));
  insert into public.notifications (user_id, kind, title, body, link)
  select c.user_id, 'booking_rescheduled', 'Réservation déplacée', format('La consultation %s a été déplacée.', b.reference), '/consultant/bookings'
  from public.consultants c where c.id = b.consultant_id;
  return jsonb_build_object('result', 'rescheduled');
end $$;

-- ─── Mark consultation completed (consultant or admin) ─────────────
create or replace function public.complete_booking(p_booking_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'booking_not_found' using errcode = 'P0002'; end if;
  if b.consultant_id is distinct from public.current_consultant_id() and not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if b.status <> 'confirmed' or b.starts_at > now() then raise exception 'not_completable' using errcode = 'P0001'; end if;
  update public.bookings set status = 'completed' where id = b.id;
  update public.consultants set completed_consultations = completed_consultations + 1 where id = b.consultant_id;
  update public.commission_records set status = 'available' where booking_id = b.id and status = 'pending';
  insert into public.booking_status_history (booking_id, from_status, to_status, changed_by)
  values (b.id, 'confirmed', 'completed', auth.uid());
  insert into public.notifications (user_id, kind, title, body, link)
  values (b.client_id, 'review_request', 'Donnez votre avis', 'Comment s''est passée votre consultation ?', '/dashboard/bookings');
  return jsonb_build_object('result', 'completed');
end $$;

-- ─── Reviews keep consultant rating up to date ─────────────────────
create or replace function public.refresh_consultant_rating()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_id uuid := coalesce(new.consultant_id, old.consultant_id);
begin
  update public.consultants c set
    rating_avg = coalesce((select round(avg(rating)::numeric, 2) from public.reviews r where r.consultant_id = v_id and r.status = 'published'), 0),
    reviews_count = (select count(*) from public.reviews r where r.consultant_id = v_id and r.status = 'published')
  where c.id = v_id;
  return null;
end $$;
create trigger reviews_rating after insert or update or delete on public.reviews
for each row execute function public.refresh_consultant_rating();

-- Reviews may only be written for the client's own completed booking
create or replace function public.guard_reviews()
returns trigger language plpgsql as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = new.booking_id;
  if not public.is_privileged() then
    -- consultant replying to a review on their own profile: only consultant_reply may change
    if tg_op = 'UPDATE' and old.consultant_id = public.current_consultant_id() and b.client_id <> auth.uid() then
      new.rating := old.rating; new.comment := old.comment; new.status := old.status;
      new.client_display_name := old.client_display_name; new.client_id := old.client_id;
      new.consultant_id := old.consultant_id; new.booking_id := old.booking_id;
      return new;
    end if;
    if b.client_id <> auth.uid() or b.status <> 'completed' then
      raise exception 'reviews require a completed booking' using errcode = '42501';
    end if;
    new.client_id := b.client_id;
    new.consultant_id := b.consultant_id;
    new.client_display_name := (
      select split_part(full_name, ' ', 1) || coalesce(' ' || left(nullif(split_part(full_name, ' ', 2), ''), 1) || '.', '')
      from public.profiles where id = b.client_id);
    if tg_op = 'UPDATE' then
      new.status := old.status;
      new.consultant_reply := old.consultant_reply;
    end if;
  end if;
  return new;
end $$;
create trigger reviews_guard before insert or update on public.reviews for each row execute function public.guard_reviews();

-- Submitting a verification document puts an unverified profile in the admin review queue
create or replace function public.documents_to_review_queue()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.consultants set verification_status = 'pending'
  where id = new.consultant_id and verification_status in ('unverified', 'rejected');
  return new;
end $$;
create trigger consultant_documents_queue after insert on public.consultant_documents
for each row execute function public.documents_to_review_queue();

-- ─── Marketplace search & ranking ──────────────────────────────────
-- Ranking = relevance + verification + qualifications + experience + rating.
-- ★ Commission is deliberately NOT an input (§6).
create or replace function public.search_consultants(
  p_country_slug text default null,
  p_specialty_slug text default null,
  p_language text default null,
  p_method public.consultation_method default null,
  p_service_slug text default null,
  p_duration integer default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_qualification_level text default null,
  p_consultant_type public.consultant_type default null,
  p_verified_only boolean default false,
  p_available_days integer default null,
  p_query text default null,
  p_limit integer default 12,
  p_offset integer default 0
) returns table (
  id uuid, slug text, professional_name text, title_fr text, title_en text,
  short_bio_fr text, short_bio_en text, photo_url text,
  consultant_type public.consultant_type, verification_status public.verification_status,
  years_experience smallint, rating_avg numeric, reviews_count integer, methods public.consultation_method[],
  starting_price numeric, starting_currency public.currency_code,
  specialties jsonb, countries jsonb, languages jsonb, qualifications jsonb,
  has_availability boolean, score numeric, total_count bigint
) language sql stable security definer set search_path = '' as $$
  with base as (
    select c.*,
      (select min(coalesce(cs.price, s.base_price)) from public.consultant_services cs
         join public.services s on s.id = cs.service_id
       where cs.consultant_id = c.id and cs.is_active and s.is_active and s.pricing_type = 'fixed'
         and (p_service_slug is null or s.slug = p_service_slug)
         and (p_duration is null or cs.duration_minutes = p_duration)) as min_price,
      (select count(*) from public.consultant_qualifications q where q.consultant_id = c.id and q.is_verified) as verified_quals
    from public.consultants c
    where c.is_published
      and (p_verified_only is not true or c.verification_status = 'verified')
      and (p_consultant_type is null or (c.consultant_type = p_consultant_type and c.verification_status = 'verified'))
      and (p_method is null or p_method = any (c.methods))
      and (p_country_slug is null or exists (
        select 1 from public.consultant_countries cc join public.countries co on co.id = cc.country_id
        where cc.consultant_id = c.id and co.slug = p_country_slug))
      and (p_specialty_slug is null or exists (
        select 1 from public.consultant_specialties sp join public.specialties s on s.id = sp.specialty_id
        where sp.consultant_id = c.id and s.slug = p_specialty_slug))
      and (p_language is null or exists (
        select 1 from public.consultant_languages l where l.consultant_id = c.id and l.language_code = p_language))
      and (p_qualification_level is null or exists (
        select 1 from public.consultant_qualifications q where q.consultant_id = c.id and q.level = p_qualification_level))
      and (p_service_slug is null or exists (
        select 1 from public.consultant_services cs join public.services s on s.id = cs.service_id
        where cs.consultant_id = c.id and cs.is_active and s.slug = p_service_slug))
      and (p_duration is null or exists (
        select 1 from public.consultant_services cs where cs.consultant_id = c.id and cs.is_active and cs.duration_minutes = p_duration))
      and (p_query is null or c.professional_name ilike '%' || p_query || '%' or c.title_fr ilike '%' || p_query || '%'
           or coalesce(c.title_en, '') ilike '%' || p_query || '%' or coalesce(c.short_bio_fr, '') ilike '%' || p_query || '%')
      and (p_available_days is null or exists (
        select 1 from public.consultant_services cs
        cross join lateral public.get_available_slots(cs.id, current_date, current_date + p_available_days) sl
        where cs.consultant_id = c.id and cs.is_active limit 1))
  ), scored as (
    select b.*,
      ( case b.verification_status when 'verified' then 40 when 'pending' then 5 else 0 end
      + least(b.verified_quals * 5, 20)
      + least(b.years_experience, 20)
      + case when b.reviews_count > 0 then b.rating_avg * 4 * least(b.reviews_count, 20) / 20.0 else 0 end
      + case when p_query is not null and b.professional_name ilike '%' || p_query || '%' then 15 else 0 end
      )::numeric as score
    from base b
    where (p_min_price is null or b.min_price >= p_min_price)
      and (p_max_price is null or b.min_price <= p_max_price)
  )
  select s.id, s.slug, s.professional_name, s.title_fr, s.title_en, s.short_bio_fr, s.short_bio_en, s.photo_url,
    s.consultant_type, s.verification_status, s.years_experience, s.rating_avg, s.reviews_count, s.methods,
    s.min_price, s.base_currency,
    coalesce((select jsonb_agg(jsonb_build_object('slug', sp.slug, 'fr', sp.name_fr, 'en', sp.name_en))
              from public.consultant_specialties x join public.specialties sp on sp.id = x.specialty_id where x.consultant_id = s.id), '[]'),
    coalesce((select jsonb_agg(jsonb_build_object('slug', co.slug, 'fr', co.name_fr, 'en', co.name_en, 'flag', co.flag_emoji))
              from public.consultant_countries x join public.countries co on co.id = x.country_id where x.consultant_id = s.id), '[]'),
    coalesce((select jsonb_agg(jsonb_build_object('code', l.code, 'fr', l.name_fr, 'en', l.name_en))
              from public.consultant_languages x join public.languages l on l.code = x.language_code where x.consultant_id = s.id), '[]'),
    coalesce((select jsonb_agg(jsonb_build_object('title', q.title, 'level', q.level, 'verified', q.is_verified))
              from public.consultant_qualifications q where q.consultant_id = s.id), '[]'),
    exists (select 1 from public.availability a where a.consultant_id = s.id),
    s.score,
    count(*) over ()
  from scored s
  order by s.score desc, s.reviews_count desc, s.professional_name
  limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0);
$$;

-- ─── Admin analytics ───────────────────────────────────────────────
create or replace function public.admin_metrics(p_from date default null, p_to date default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_from timestamptz := coalesce(p_from, date '2000-01-01');
  v_to timestamptz := coalesce(p_to, current_date) + interval '1 day';
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'total_users', (select count(*) from public.profiles),
    'registered_consultants', (select count(*) from public.consultants),
    'verified_consultants', (select count(*) from public.consultants where verification_status = 'verified'),
    'total_bookings', (select count(*) from public.bookings where created_at >= v_from and created_at < v_to and status <> 'expired'),
    'completed_consultations', (select count(*) from public.bookings where status = 'completed' and starts_at >= v_from and starts_at < v_to),
    'revenue', (select coalesce(jsonb_object_agg(currency, total), '{}') from (
        select currency, sum(amount) total from public.payments where status = 'successful' and paid_at >= v_from and paid_at < v_to group by currency) t),
    'platform_commissions', (select coalesce(jsonb_object_agg(currency, total), '{}') from (
        select currency, sum(commission_amount) total from public.commission_records where created_at >= v_from and created_at < v_to group by currency) t),
    'consultant_earnings', (select coalesce(jsonb_object_agg(currency, total), '{}') from (
        select currency, sum(consultant_amount) total from public.commission_records where created_at >= v_from and created_at < v_to group by currency) t),
    'pending_payments', (select count(*) from public.payments where status in ('pending', 'processing')),
    'refunds', (select count(*) from public.refunds where created_at >= v_from and created_at < v_to),
    'monthly', (select coalesce(jsonb_agg(m order by m.month), '[]') from (
        select to_char(date_trunc('month', created_at), 'YYYY-MM') as month,
               count(*) filter (where true) as bookings,
               count(*) filter (where status in ('confirmed', 'completed')) as paid_bookings
        from public.bookings where created_at >= now() - interval '12 months' group by 1) m)
  );
end $$;

-- ─── Grants: lock down privileged functions ────────────────────────
revoke execute on function public.confirm_payment(text, text, text, numeric, public.currency_code, boolean) from public, anon, authenticated;
revoke execute on function public.fail_payment(text, public.payment_status, text) from public, anon, authenticated;
revoke execute on function public.release_expired_holds(uuid) from public, anon, authenticated;
revoke execute on function public._assert_slot_bookable(uuid, timestamptz, timestamptz, uuid) from public, anon, authenticated;
revoke execute on function public.create_booking_hold(uuid, timestamptz, public.consultation_method, text, text, text, text, uuid, text, text) from public, anon;
revoke execute on function public.cancel_booking(uuid, text) from public, anon;
revoke execute on function public.reschedule_booking(uuid, timestamptz) from public, anon;
revoke execute on function public.complete_booking(uuid) from public, anon;
revoke execute on function public.admin_metrics(date, date) from public, anon;
grant execute on function public.confirm_payment(text, text, text, numeric, public.currency_code, boolean) to service_role;
grant execute on function public.fail_payment(text, public.payment_status, text) to service_role;
grant execute on function public.release_expired_holds(uuid) to service_role;
grant execute on function public.create_booking_hold(uuid, timestamptz, public.consultation_method, text, text, text, text, uuid, text, text) to authenticated;
grant execute on function public.cancel_booking(uuid, text) to authenticated;
grant execute on function public.reschedule_booking(uuid, timestamptz) to authenticated;
grant execute on function public.complete_booking(uuid) to authenticated;
grant execute on function public.admin_metrics(date, date) to authenticated;
grant execute on function public.search_consultants to anon, authenticated;
grant execute on function public.get_available_slots(uuid, date, date) to anon, authenticated;
