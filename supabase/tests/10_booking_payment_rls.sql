-- ════════════════════════════════════════════════════════════════════
-- GLOBENTIA — database acceptance tests (run with supabase/tests/run.sh)
-- Each block raises an exception on failure; psql stops on first error.
-- ════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP 1
\set client  '00000000-0000-4000-a000-000000000002'
\set client2 '00000000-0000-4000-a000-000000000003'
\set amina_user '00000000-0000-4000-a000-000000000011'
\set lukas_user '00000000-0000-4000-a000-000000000012'
\set admin  '00000000-0000-4000-a000-000000000001'

-- second client
insert into auth.users (id, email, raw_user_meta_data) values (:'client2', 'client2@globentia.dev', '{"full_name":"Client Deux"}');

create or replace function pg_temp.expect_error(p_sql text, p_expected text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'expected error "%" but statement succeeded: %', p_expected, p_sql;
exception when others then
  if sqlerrm not like p_expected and sqlstate <> p_expected then raise; end if;
end $$;

create or replace function pg_temp.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), false);
end $$;

-- Pick Amina's 45-min consultation and its first two available slots
select cs.id as cs_id from consultant_services cs join consultants c on c.id = cs.consultant_id
 join services s on s.id = cs.service_id where c.slug = 'amina-ndoumbe' and s.slug = 'consultation' \gset
select starts_at as slot1 from get_available_slots(:'cs_id', current_date, current_date + 14) limit 1 \gset
select starts_at as slot2 from get_available_slots(:'cs_id', current_date, current_date + 14) offset 1 limit 1 \gset
\echo '✓ T01 available slots generated:' :slot1 :slot2

-- ─── T02 anonymous visitor: search works, private tables are hidden ───
set role anon;
select pg_temp.act_as(null);
do $$
declare n int; first_status text;
begin
  select count(*), (array_agg(verification_status::text order by score desc))[1] into n, first_status
  from search_consultants(p_limit => 50);
  if n <> 6 then raise exception 'T02 expected 6 published consultants, got %', n; end if;
  if first_status <> 'verified' then raise exception 'T02 ranking must put verified consultants first'; end if;
  if (select count(*) from search_consultants(p_country_slug => 'germany')) <> 2 then raise exception 'T02 country filter'; end if;
  if (select count(*) from search_consultants(p_language => 'it')) <> 1 then raise exception 'T02 language filter'; end if;
  if (select count(*) from search_consultants(p_max_price => 15000)) <> 5 then
    raise exception 'T02 price filter: got %', (select count(*) from search_consultants(p_max_price => 15000)); end if;
  if (select count(*) from bookings) + (select count(*) from payments) + (select count(*) from consultant_documents) <> 0 then
    raise exception 'T02 anon must not see private data'; end if;
end $$;
do $$ begin
  perform create_booking_hold(gen_random_uuid(), now(), 'video', 'x', 'x@x', '1', 'CM');
  raise exception 'T02 anon must not create bookings';
exception when insufficient_privilege then null; end $$;
\echo '✓ T02 anon search, filters, ranking & privacy'

-- ─── T03 client holds a slot ───
reset role; set role authenticated;
select pg_temp.act_as(:'client');
select booking_id as b1, reference as ref1, price as price1 from create_booking_hold(:'cs_id', :'slot1', 'video',
  'Client Démo', 'client@globentia.dev', '+237600000000', 'CM', null, 'study-visa', 'Projet de master au Canada') \gset
select 1 / (:'price1'::numeric = 15000)::int as t03_price_is_base_price \gset
do $$ begin if (select count(*) from bookings) <> 1 then raise exception 'T03 client must see own booking'; end if; end $$;
\echo '✓ T03 hold created' :ref1 'price' :price1

-- ─── T04 second client cannot take the same slot (no double booking) ───
select pg_temp.act_as(:'client2');
select pg_temp.expect_error(format(
  $q$select create_booking_hold(%L, %L, 'video', 'C2', 'c2@x.com', '1', 'CM')$q$, :'cs_id', :'slot1'), 'slot_unavailable');
-- overlapping but not identical slot (starts 15 min later) is also refused
select pg_temp.expect_error(format(
  $q$select create_booking_hold(%L, %L::timestamptz + interval '30 minutes', 'video', 'C2', 'c2@x.com', '1', 'CM')$q$, :'cs_id', :'slot1'), 'slot_unavailable');
do $$ begin if (select count(*) from bookings) <> 0 then raise exception 'T04 client2 must not see client1 booking'; end if; end $$;
\echo '✓ T04 double booking prevented, bookings isolated between clients'

-- ─── T05 a client cannot confirm its own booking or forge a payment ───
select pg_temp.act_as(:'client');
do $$ begin
  update bookings set status = 'confirmed';
  if exists (select 1 from bookings where status = 'confirmed') then raise exception 'T05 status changed by client'; end if;
exception when insufficient_privilege then null; end $$;
do $$ begin
  perform confirm_payment('x', 'sandbox', 'x', 1, 'XAF', false);
  raise exception 'T05 client called confirm_payment';
exception when insufficient_privilege then null; end $$;
do $$ begin
  insert into payments (reference, booking_id, client_id, provider, amount, currency, status)
  select 'PAY-FAKE', id, client_id, 'sandbox', 0, 'XAF', 'successful' from bookings limit 1;
  raise exception 'T05 client inserted a payment';
exception when insufficient_privilege then null; end $$;
\echo '✓ T05 frontend cannot confirm bookings nor forge payments'

-- ─── T06 consultant visibility ───
select pg_temp.act_as(:'amina_user');
do $$ begin
  if (select count(*) from bookings) <> 1 then raise exception 'T06 consultant must see assigned booking'; end if;
  if (select count(*) from profiles) <> 2 then raise exception 'T06 consultant sees own + booked client profile only, got %', (select count(*) from profiles); end if;
end $$;
select pg_temp.act_as(:'lukas_user');
do $$ begin if (select count(*) from bookings) <> 0 then raise exception 'T06 other consultant sees booking'; end if; end $$;
\echo '✓ T06 consultants only see their assigned bookings'

-- ─── T07 consultant cannot self-verify, self-publish or change commission ───
select pg_temp.act_as(:'lukas_user');
update consultants set commission_rate = 0, rating_avg = 5 where slug = 'lukas-bauer';
update consultants set consultant_type = 'authorized_legal_representative' where slug = 'lukas-bauer';
do $$ begin
  if (select commission_rate is not null or rating_avg = 5 or verification_status <> 'pending'
      from consultants where slug = 'lukas-bauer') then
    raise exception 'T07 consultant escalated own fields';
  end if;
end $$;
do $$ begin
  update consultants set title_fr = 'hack' where slug = 'amina-ndoumbe';
  if (select title_fr from consultants where slug = 'amina-ndoumbe') = 'hack' then raise exception 'T07 edited another consultant'; end if;
end $$;
do $$ begin
  insert into user_roles (user_id, role_id) select auth.uid(), id from roles where key = 'admin';
  raise exception 'T07 self-granted admin';
exception when insufficient_privilege then null; end $$;
\echo '✓ T07 no privilege escalation (verification, commission, roles)'

-- ─── T08 server creates payment, webhook confirms (service role) ───
reset role; set role service_role;
insert into payments (reference, booking_id, client_id, provider, amount, currency)
values ('PAY-T08', :'b1', :'client', 'sandbox', 15000, 'XAF');
select confirm_payment('PAY-T08', 'sandbox', 'sbx_evt_1', 15000, 'XAF', false) ->> 'result' as r1 \gset
select confirm_payment('PAY-T08', 'sandbox', 'sbx_evt_1', 15000, 'XAF', false) ->> 'result' as r2 \gset
do $$ begin
  if (select status from bookings where reference like 'GLB-%' order by created_at limit 1) <> 'confirmed' then raise exception 'T08 booking not confirmed'; end if;
  if (select count(*) from commission_records) <> 1 then raise exception 'T08 commission must be recorded exactly once'; end if;
  if (select commission_amount from commission_records) <> 3000 or (select consultant_amount from commission_records) <> 12000 then
    raise exception 'T08 wrong commission split'; end if;
  if (select count(*) from notifications where kind in ('booking_confirmed', 'new_booking')) <> 2 then raise exception 'T08 notifications'; end if;
  if (select count(*) from payment_status_history where to_status = 'successful') <> 1 then raise exception 'T08 history'; end if;
end $$;
\echo '✓ T08 payment confirmed:' :r1 '→ replay:' :r2

-- ─── T09 duplicate webhook events are rejected by idempotency key ───
insert into payment_webhooks (provider, event_id, signature_valid, payload) values ('sandbox', 'evt_1', true, '{}');
do $$ begin
  insert into payment_webhooks (provider, event_id, signature_valid, payload) values ('sandbox', 'evt_1', true, '{}');
  raise exception 'T09 duplicate webhook stored';
exception when unique_violation then null; end $$;
do $$ begin
  update payments set status = 'failed' where reference = 'PAY-T08';
  raise exception 'T09 successful payment downgraded';
exception when others then if sqlerrm not like 'invalid payment transition%' then raise; end if; end $$;
\echo '✓ T09 webhook idempotency & payment state machine'

-- ─── T10 amount tampering is detected ───
reset role; set role authenticated; select pg_temp.act_as(:'client');
select booking_id as b2 from create_booking_hold(:'cs_id', :'slot2', 'phone', 'Client Démo', 'client@globentia.dev', '+237600000000', 'CM') \gset
reset role; set role service_role;
insert into payments (reference, booking_id, client_id, provider, amount, currency) values ('PAY-T10', :'b2', :'client', 'sandbox', 15000, 'XAF');
select confirm_payment('PAY-T10', 'sandbox', 'sbx_evt_2', 100, 'XAF', false) ->> 'result' as r10 \gset
do $$ begin
  if (select status from payments where reference = 'PAY-T10') <> 'failed' then raise exception 'T10 tampered amount accepted'; end if;
  if (select b.status from bookings b join payments p on p.booking_id = b.id where p.reference = 'PAY-T10') <> 'pending_payment' then
    raise exception 'T10 booking confirmed despite mismatch'; end if;
end $$;
\echo '✓ T10 amount mismatch →' :r10

-- ─── T11 expired holds are released and the slot becomes free ───
reset role;
update bookings set hold_expires_at = now() - interval '1 minute' where id = :'b2';
set role service_role;
select release_expired_holds() as released \gset
reset role; set role authenticated; select pg_temp.act_as(:'client2');
select booking_id as b3 from create_booking_hold(:'cs_id', :'slot2', 'video', 'Client Deux', 'c2@globentia.dev', '+237611111111', 'CM') \gset
\echo '✓ T11 released' :released 'expired hold; slot re-booked by client2'

-- ─── T12 late payment on a slot taken meanwhile → refund_required ───
reset role; set role service_role;
insert into payments (reference, booking_id, client_id, provider, amount, currency) values ('PAY-T12', :'b2', :'client', 'sandbox', 15000, 'XAF');
select confirm_payment('PAY-T12', 'sandbox', 'sbx_evt_3', 15000, 'XAF', false) ->> 'booking_status' as r12 \gset
do $$ begin
  if (select count(*) from refunds) <> 1 then raise exception 'T12 refund not created'; end if;
  if (select count(*) from support_tickets where kind = 'refund_request') <> 1 then raise exception 'T12 ticket'; end if;
end $$;
\echo '✓ T12 late payment handled →' :r12

-- ─── T13 client cancellation follows the policy (<24h before → no automatic refund) ───
reset role; set role authenticated; select pg_temp.act_as(:'client');
select cancel_booking(:'b1', 'Changement de projet') ->> 'refund' as refund13 \gset
do $$ begin
  if (select status from bookings where id = (select booking_id from payments where reference = 'PAY-T08')) <> 'cancelled' then raise exception 'T13'; end if;
end $$;
\echo '✓ T13 late client cancellation accepted, refund =' :refund13

-- ─── T14 reviews only after a completed consultation ───
reset role; set role authenticated; select pg_temp.act_as(:'client2');
do $$ begin
  insert into reviews (booking_id, consultant_id, client_id, rating) select id, consultant_id, client_id, 5 from bookings limit 1;
  raise exception 'T14 review on uncompleted booking';
exception when insufficient_privilege then null; end $$;
reset role;
update bookings set status = 'completed' where id = :'b3';
set role authenticated; select pg_temp.act_as(:'client2');
insert into reviews (booking_id, consultant_id, client_id, rating, comment)
select id, consultant_id, client_id, 4, 'Très clair et professionnel' from bookings where id = :'b3';
do $$ begin
  if (select rating_avg from consultants where slug = 'amina-ndoumbe') <> 4 then raise exception 'T14 rating not refreshed'; end if;
end $$;
-- consultant can reply but cannot alter the rating
select pg_temp.act_as(:'amina_user');
update reviews set consultant_reply = 'Merci !', rating = 5 where booking_id = :'b3';
do $$ begin
  if (select rating from reviews limit 1) <> 4 or (select consultant_reply from reviews limit 1) <> 'Merci !' then
    raise exception 'T14 consultant reply guard'; end if;
end $$;
\echo '✓ T14 verified reviews, rating aggregation, consultant reply cannot change rating'

-- ─── T15 admin monitoring ───
select pg_temp.act_as(:'admin');
select admin_metrics() ->> 'revenue' as revenue, admin_metrics() ->> 'platform_commissions' as commissions \gset
do $$ begin
  if (select count(*) from payments) < 3 then raise exception 'T15 admin must see all payments'; end if;
  if (select count(*) from audit_logs where entity = 'payments') = 0 then raise exception 'T15 audit log empty'; end if;
end $$;
select pg_temp.act_as(:'client');
do $$ begin
  perform admin_metrics();
  raise exception 'T15 client accessed admin metrics';
exception when others then if sqlerrm <> 'forbidden' then raise; end if; end $$;
\echo '✓ T15 admin metrics revenue=' :revenue 'commissions=' :commissions '(clients denied)'

-- ─── T16 storage: documents are private ───
select pg_temp.act_as(:'lukas_user');
insert into storage.objects (bucket_id, name) values ('consultant-documents', :'lukas_user' || '/diploma.pdf');
do $$ begin
  insert into storage.objects (bucket_id, name) values ('consultant-documents', '00000000-0000-4000-a000-000000000011/fake.pdf');
  raise exception 'T16 uploaded into another consultant folder';
exception when insufficient_privilege then null; end $$;
select pg_temp.act_as(:'client');
do $$ begin if (select count(*) from storage.objects where bucket_id = 'consultant-documents') <> 0 then raise exception 'T16 client read docs'; end if; end $$;
\echo '✓ T16 storage isolation'

-- ─── T17 submitting a document moves the profile to the review queue ───
select pg_temp.act_as('00000000-0000-4000-a000-000000000016');
insert into consultant_documents (consultant_id, kind, storage_path, file_name, mime_type, size_bytes)
select id, 'diploma', '00000000-0000-4000-a000-000000000016/d.pdf', 'd.pdf', 'application/pdf', 1000 from consultants where slug = 'paul-ekambi';
do $$ begin
  if (select verification_status from consultants where slug = 'paul-ekambi') <> 'pending' then raise exception 'T17'; end if;
end $$;
\echo '✓ T17 document upload → verification queue'

-- ─── T18 v2 : certifications, édition admin, tri, destinations ───
select pg_temp.act_as(:'lukas_user');
insert into consultant_certifications (consultant_id, title, issuer, is_verified)
select id, 'Auto-déclarée', 'Moi-même', true from consultants where slug = 'lukas-bauer';
do $$ begin
  if (select is_verified from consultant_certifications where title = 'Auto-déclarée') then raise exception 'T18 self-verified certification'; end if;
end $$;
select pg_temp.expect_error($q$insert into consultant_certifications (consultant_id, title, issuer)
  select id, 'Intrus', 'X' from consultants where slug = 'amina-ndoumbe'$q$, '%row-level security%');
select pg_temp.act_as(:'admin');
update consultants set bio_fr = 'Bio modifiée par admin', title_fr = 'Titre admin', is_published = false where slug = 'paul-ekambi';
update consultant_certifications set is_verified = true where title = 'Auto-déclarée';
do $$ begin
  if (select bio_fr from consultants where slug = 'paul-ekambi') <> 'Bio modifiée par admin' then raise exception 'T18 admin edit'; end if;
  if not (select is_verified and verified_at is not null from consultant_certifications where title = 'Auto-déclarée') then raise exception 'T18 admin verify'; end if;
end $$;
reset role; set role anon; select pg_temp.act_as(null);
do $$ declare first_slug text; begin
  if (select count(*) from search_consultants(p_limit => 50)) <> 5 then raise exception 'T18 hidden consultant still public'; end if;
  select slug into first_slug from search_consultants(p_sort => 'experience') limit 1;
  if first_slug <> 'david-mensah' then raise exception 'T18 sort by experience: %', first_slug; end if;
  if (select count(*) from countries) <> 30 then raise exception 'T18 expected 30 published countries (29 + origin), got %', (select count(*) from countries); end if;
  if (select count(*) from consultant_certifications) < 7 then raise exception 'T18 public certifications'; end if;
end $$;
\echo '✓ T18 certifications (pas d auto-vérification), édition admin, masquage, tri, 30 pays'

reset role;
\echo ''
\echo '══ ALL DATABASE TESTS PASSED ══'
