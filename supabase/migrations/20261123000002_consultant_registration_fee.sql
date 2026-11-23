create table if not exists public.consultant_registrations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  registration_number integer not null unique,
  fee_required boolean not null default false,
  fee_status text not null default 'free'
    check (fee_status in ('free', 'pending', 'paid', 'waived')),
  amount_xaf integer not null default 0,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payments
  add column if not exists payment_type text not null default 'booking'
  check (payment_type in ('booking', 'consultant_registration'));
alter table public.payments
  add column if not exists consultant_registration_id uuid
  references public.consultant_registrations(user_id),
  add column if not exists registration_number integer;

alter table public.payments alter column booking_id drop not null;

drop policy if exists "consultant registrations: own read" on public.consultant_registrations;
create policy "consultant registrations: own read" on public.consultant_registrations
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "consultant registrations: own update" on public.consultant_registrations;
create policy "consultant registrations: own update" on public.consultant_registrations
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.ensure_consultant_registration(p_user_id uuid)
returns public.consultant_registrations language plpgsql security definer set search_path = '' as $$
declare
  v_row public.consultant_registrations%rowtype;
  v_number integer;
begin
  if auth.uid() is not null and p_user_id is distinct from auth.uid() and not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext('consultant_registration'));
  select * into v_row from public.consultant_registrations where user_id = p_user_id;
  if found then return v_row; end if;

  select coalesce(max(registration_number), 0) + 1 into v_number
  from public.consultant_registrations;

  insert into public.consultant_registrations (
    user_id, registration_number, fee_required, fee_status, amount_xaf
  ) values (
    p_user_id,
    v_number,
    v_number > 10,
    case when v_number > 10 then 'pending' else 'free' end,
    case when v_number > 10 then 25000 else 0 end
  )
  returning * into v_row;
  return v_row;
end $$;

-- Backfill existing consultant accounts and assign places by account creation date.
with ranked as (
  select ur.user_id,
         row_number() over (order by p.created_at, ur.user_id) as rn
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  join public.profiles p on p.id = ur.user_id
  where r.key = 'consultant'
)
insert into public.consultant_registrations (
  user_id, registration_number, fee_required, fee_status, amount_xaf
)
select user_id,
       rn,
       rn > 10,
       case when rn > 10 then 'pending' else 'free' end,
       case when rn > 10 then 25000 else 0 end
from ranked
on conflict (user_id) do nothing;

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
  if new.raw_user_meta_data ->> 'account_type' = 'consultant' then
    insert into public.user_roles (user_id, role_id)
    select new.id, id from public.roles where key = 'consultant';
    perform public.ensure_consultant_registration(new.id);
  end if;
  return new;
end $$;

create or replace function public.guard_consultant_registration_fee()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_fee public.consultant_registrations%rowtype;
begin
  if public.is_privileged() then return new; end if;
  if not new.is_published then return new; end if;
  select * into v_fee
  from public.consultant_registrations
  where user_id = new.user_id;
  if found and v_fee.fee_required and v_fee.fee_status <> 'paid' then
    raise exception 'consultant_registration_fee_required'
      using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists consultant_registration_fee_guard on public.consultants;
create trigger consultant_registration_fee_guard
before update of is_published
on public.consultants
for each row execute function public.guard_consultant_registration_fee();

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
  v_fee public.consultant_registrations%rowtype;
  v_rate numeric;
  v_commission numeric;
  v_new_status public.booking_status;
begin
  perform set_config('globentia.change_source', 'webhook:' || p_provider, true);

  select * into p from public.payments where reference = p_payment_reference for update;
  if not found then raise exception 'payment_not_found' using errcode = 'P0002'; end if;
  if p.provider <> p_provider then raise exception 'provider_mismatch' using errcode = 'P0001'; end if;

  if p.status = 'successful' then
    return jsonb_build_object('result', 'already_processed',
      'booking_id', p.booking_id,
      'payment_type', p.payment_type);
  end if;
  if p.status = 'refunded' then
    return jsonb_build_object('result', 'ignored_refunded');
  end if;
  if p_amount <> p.amount or p_currency <> p.currency then
    update public.payments set status = 'failed',
      failure_reason = format('amount_mismatch: expected %s %s, got %s %s', p.amount, p.currency, p_amount, p_currency)
    where id = p.id;
    return jsonb_build_object('result', 'amount_mismatch');
  end if;

  if p.payment_type = 'consultant_registration' then
    select * into v_fee
    from public.consultant_registrations
    where user_id = p.consultant_registration_id
    for update;
    if not found then raise exception 'registration_not_found' using errcode = 'P0002'; end if;
    if p_amount <> 25000 or p_currency <> 'XAF' then
      raise exception 'registration_fee_mismatch' using errcode = 'P0001';
    end if;

    update public.payments set
      status = 'successful', paid_at = now(),
      provider_reference = coalesce(p_provider_reference, provider_reference),
      is_live = p_is_live, registration_number = v_fee.registration_number
    where id = p.id;

    update public.consultant_registrations set
      fee_status = 'paid', paid_at = now(), updated_at = now()
    where user_id = v_fee.user_id;

    insert into public.notifications (user_id, kind, title, body, link)
    values (
      v_fee.user_id,
      'consultant_registration_paid',
      'Frais d’inscription payés',
      'Votre paiement d’inscription de 25 000 FCFA a été confirmé.',
      '/consultant/profile'
    );
    return jsonb_build_object(
      'result', 'processed',
      'payment_type', 'consultant_registration',
      'registration_number', v_fee.registration_number
    );
  end if;

  select * into b from public.bookings where id = p.booking_id for update;
  if not found then raise exception 'booking_not_found' using errcode = 'P0002'; end if;
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

  if b.status in ('pending_payment', 'expired') then
    begin
      update public.bookings set status = 'confirmed', hold_expires_at = null where id = b.id;
      v_new_status := 'confirmed';
    exception when exclusion_violation then
      update public.bookings set status = 'refund_required' where id = b.id;
      v_new_status := 'refund_required';
    end;
  else
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
  end if;

  return jsonb_build_object('result', 'processed', 'booking_status', v_new_status, 'booking_id', b.id);
end $$;
