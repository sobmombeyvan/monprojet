-- ════════════════════════════════════════════════════════════════════
-- MonProjet — full Supabase setup (schema + functions + RLS + storage + reference data)
-- Run ONCE on a fresh project: Supabase > SQL Editor > paste > Run.
-- Generated from supabase/migrations/*.sql + supabase/reference-data.sql
-- Does NOT include seed.sql (demo accounts — never in production).
-- ════════════════════════════════════════════════════════════════════

-- ───────────── migrations/20261117000001_core_schema.sql ─────────────
set search_path = public, extensions;
-- ════════════════════════════════════════════════════════════════════
-- GLOBENTIA — core schema
-- ════════════════════════════════════════════════════════════════════
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists pg_trgm with schema extensions;
set search_path = public, extensions;

-- ─── Enums ──────────────────────────────────────────────────────────
create type public.app_role as enum ('client', 'consultant', 'editor', 'admin', 'super_admin');

-- Never imply legal authorization without verified evidence (§7)
create type public.consultant_type as enum (
  'authorized_legal_representative',  -- e.g. avocat / représentant autorisé (CICC, barreau…)
  'licensed_professional',            -- profession réglementée avec licence vérifiée
  'immigration_consultant',           -- consultant en immigration (non représentant légal)
  'orientation_specialist'            -- information générale & orientation
);
create type public.verification_status as enum ('unverified', 'pending', 'verified', 'rejected', 'suspended');
create type public.document_status as enum ('pending', 'approved', 'rejected', 'expired');
create type public.consultation_method as enum ('video', 'phone', 'in_person', 'chat', 'other');
create type public.pricing_type as enum ('fixed', 'quote');
create type public.currency_code as enum ('XAF', 'EUR', 'USD');
create type public.booking_status as enum (
  'pending_payment', 'confirmed', 'completed', 'cancelled', 'expired', 'no_show', 'refund_required'
);
create type public.payment_status as enum ('pending', 'processing', 'successful', 'failed', 'refunded', 'cancelled');
create type public.commission_status as enum ('pending', 'available', 'paid_out', 'reversed');
create type public.review_status as enum ('pending', 'published', 'hidden');
create type public.content_status as enum ('draft', 'in_review', 'published', 'archived');
create type public.reliability_level as enum ('official', 'verified', 'editorial', 'unverified');
create type public.ticket_status as enum ('open', 'in_progress', 'resolved', 'closed');
create type public.ticket_kind as enum ('support', 'complaint', 'refund_request', 'ai_handoff');
create type public.region as enum ('africa', 'europe', 'north_america', 'latin_america', 'asia', 'middle_east', 'oceania');

-- ─── Utility: updated_at trigger ────────────────────────────────────
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ─── Identity ───────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email citext,
  phone text,
  avatar_url text,
  country_of_residence text,          -- ISO-3166 alpha-2
  preferred_locale text not null default 'fr' check (preferred_locale in ('fr', 'en')),
  preferred_currency public.currency_code not null default 'XAF',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  id smallserial primary key,
  key public.app_role not null unique,
  label_fr text not null,
  label_en text not null
);

create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role_id smallint not null references public.roles (id) on delete restrict,
  granted_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);
create index user_roles_role_idx on public.user_roles (role_id);

-- ─── Reference data ─────────────────────────────────────────────────
create table public.countries (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  iso2 char(2) not null unique,
  name_fr text not null,
  name_en text not null,
  region public.region not null,
  flag_emoji text,
  overview_fr text,
  overview_en text,
  study_info_fr text,
  study_info_en text,
  work_info_fr text,
  work_info_en text,
  immigration_info_fr text,
  immigration_info_en text,
  estimated_costs jsonb,                  -- only verified figures, each with source
  official_links jsonb not null default '[]'::jsonb,  -- [{label, url}]
  source_name text,
  source_url text,
  last_verified_at date,
  status public.content_status not null default 'draft',
  is_popular boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index countries_region_idx on public.countries (region) where status = 'published';
create index countries_name_trgm on public.countries using gin ((name_fr || ' ' || name_en) gin_trgm_ops);

create table public.visa_categories (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries (id) on delete cascade,
  slug text not null,
  name_fr text not null,
  name_en text not null,
  kind text not null check (kind in ('study', 'work', 'tourist', 'family', 'permanent_residence', 'business', 'other')),
  description_fr text,
  description_en text,
  requirements jsonb not null default '[]'::jsonb,  -- [{fr, en}] — only from official sources
  official_url text,
  source_name text,
  last_verified_at date,
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_id, slug),
  -- information cannot be published without a source and verification date (§10)
  constraint visa_published_requires_source check (
    status <> 'published' or (official_url is not null and last_verified_at is not null)
  )
);

create table public.languages (
  code text primary key,                  -- ISO-639-1
  name_fr text not null,
  name_en text not null
);

create table public.specialties (
  id smallserial primary key,
  slug text not null unique,
  name_fr text not null,
  name_en text not null
);

-- ─── Consultants ────────────────────────────────────────────────────
create table public.consultants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  professional_name text not null,
  title_fr text not null,
  title_en text,
  bio_fr text,
  bio_en text,
  short_bio_fr text check (char_length(short_bio_fr) <= 280),
  short_bio_en text check (char_length(short_bio_en) <= 280),
  photo_url text,
  consultant_type public.consultant_type not null default 'orientation_specialist',
  -- the *declared* type is only displayed once verification_status = 'verified'
  verification_status public.verification_status not null default 'unverified',
  verified_at timestamptz,
  verified_by uuid references public.profiles (id),
  license_number text,                    -- shown only when verified
  license_authority text,
  years_experience smallint not null default 0 check (years_experience between 0 and 70),
  methods public.consultation_method[] not null default array['video']::public.consultation_method[],
  timezone text not null default 'Africa/Douala',
  city text,
  base_currency public.currency_code not null default 'XAF',
  commission_rate numeric(5, 4),          -- null → platform default
  rating_avg numeric(3, 2) not null default 0,
  reviews_count integer not null default 0,
  completed_consultations integer not null default 0,
  is_published boolean not null default false,
  accepts_bookings boolean not null default true,
  min_notice_hours smallint not null default 12,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index consultants_published_idx on public.consultants (is_published, verification_status);

create table public.consultant_qualifications (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid not null references public.consultants (id) on delete cascade,
  title text not null,
  institution text,
  level text check (level in ('certificate', 'bachelor', 'master', 'doctorate', 'license', 'other')),
  year_obtained smallint,
  is_verified boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.consultant_qualifications (consultant_id);

create table public.consultant_experiences (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid not null references public.consultants (id) on delete cascade,
  role text not null,
  organization text,
  start_year smallint,
  end_year smallint,
  description text,
  created_at timestamptz not null default now()
);
create index on public.consultant_experiences (consultant_id);

-- Private: stored in the private `consultant-documents` bucket
create table public.consultant_documents (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid not null references public.consultants (id) on delete cascade,
  kind text not null check (kind in ('identity', 'diploma', 'license', 'insurance', 'company_registration', 'other')),
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  status public.document_status not null default 'pending',
  reviewer_id uuid references public.profiles (id),
  reviewed_at timestamptz,
  review_note text,
  expires_on date,
  created_at timestamptz not null default now()
);
create index on public.consultant_documents (consultant_id, status);

create table public.consultant_specialties (
  consultant_id uuid not null references public.consultants (id) on delete cascade,
  specialty_id smallint not null references public.specialties (id) on delete cascade,
  primary key (consultant_id, specialty_id)
);
create index on public.consultant_specialties (specialty_id);

create table public.consultant_countries (
  consultant_id uuid not null references public.consultants (id) on delete cascade,
  country_id uuid not null references public.countries (id) on delete cascade,
  primary key (consultant_id, country_id)
);
create index on public.consultant_countries (country_id);

create table public.consultant_languages (
  consultant_id uuid not null references public.consultants (id) on delete cascade,
  language_code text not null references public.languages (code),
  proficiency text not null default 'fluent' check (proficiency in ('native', 'fluent', 'professional')),
  primary key (consultant_id, language_code)
);
create index on public.consultant_languages (language_code);

-- ─── Services ───────────────────────────────────────────────────────
create table public.services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_fr text not null,
  name_en text not null,
  description_fr text,
  description_en text,
  icon text,                              -- lucide icon name
  pricing_type public.pricing_type not null default 'fixed',
  base_price numeric(12, 2) check (base_price is null or base_price >= 0),  -- admin-editable
  currency public.currency_code not null default 'XAF',
  default_duration_minutes smallint not null default 45 check (default_duration_minutes between 15 and 480),
  is_bookable boolean not null default true,  -- false for quote-only services
  is_active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fixed_price_required check (pricing_type = 'quote' or base_price is not null)
);

create table public.consultant_services (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid not null references public.consultants (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete restrict,
  price numeric(12, 2) check (price is null or price >= 0),  -- null → service base price
  currency public.currency_code not null default 'XAF',
  duration_minutes smallint not null default 45 check (duration_minutes between 15 and 480),
  methods public.consultation_method[] not null default array['video']::public.consultation_method[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (consultant_id, service_id, duration_minutes)
);
create index on public.consultant_services (service_id) where is_active;

-- Weekly recurring availability, in the consultant's timezone
create table public.availability (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid not null references public.consultants (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),  -- 0 = Sunday (Postgres dow)
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index on public.availability (consultant_id, weekday);

-- One-off blocked periods (holidays, personal time)
create table public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid not null references public.consultants (id) on delete cascade,
  period tstzrange not null,
  reason text,
  created_at timestamptz not null default now(),
  exclude using gist (consultant_id with =, period with &&)
);

-- ─── Bookings ───────────────────────────────────────────────────────
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  client_id uuid not null references public.profiles (id) on delete restrict,
  consultant_id uuid not null references public.consultants (id) on delete restrict,
  service_id uuid not null references public.services (id) on delete restrict,
  consultant_service_id uuid references public.consultant_services (id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  slot tstzrange generated always as (tstzrange(starts_at, ends_at, '[)')) stored,
  method public.consultation_method not null,
  status public.booking_status not null default 'pending_payment',
  hold_expires_at timestamptz,
  price numeric(12, 2) not null check (price >= 0),
  currency public.currency_code not null,
  -- client information snapshot (step 3)
  client_full_name text not null,
  client_email citext not null,
  client_phone text not null,
  client_country_of_residence text not null,
  destination_country_id uuid references public.countries (id),
  procedure_type text,
  project_description text check (char_length(project_description) <= 4000),
  meeting_url text,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id),
  cancellation_reason text,
  rescheduled_from uuid references public.bookings (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  -- ★ No double booking: two active bookings of the same consultant can never overlap.
  constraint bookings_no_overlap exclude using gist (consultant_id with =, slot with &&)
    where (status in ('pending_payment', 'confirmed', 'completed'))
);
create index bookings_client_idx on public.bookings (client_id, starts_at desc);
create index bookings_consultant_idx on public.bookings (consultant_id, starts_at);
create index bookings_hold_idx on public.bookings (hold_expires_at) where status = 'pending_payment';

create table public.booking_status_history (
  id bigserial primary key,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  from_status public.booking_status,
  to_status public.booking_status not null,
  changed_by uuid references public.profiles (id),
  note text,
  created_at timestamptz not null default now()
);
create index on public.booking_status_history (booking_id, created_at);

-- ─── Payments ───────────────────────────────────────────────────────
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,          -- our reference, sent to the provider as transaction id
  booking_id uuid not null references public.bookings (id) on delete restrict,
  client_id uuid not null references public.profiles (id) on delete restrict,
  provider text not null,
  provider_reference text,                 -- provider's id (session id, transaction id…)
  amount numeric(12, 2) not null check (amount >= 0),
  currency public.currency_code not null,
  status public.payment_status not null default 'pending',
  platform_commission numeric(12, 2),
  consultant_earnings numeric(12, 2),
  is_live boolean not null default false,  -- false = sandbox / test mode
  failure_reason text,
  paid_at timestamptz,
  refunded_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_reference)
);
create index on public.payments (booking_id);
create index on public.payments (status, created_at desc);
-- Only one successful payment per booking
create unique index payments_one_success_per_booking on public.payments (booking_id) where status = 'successful';

create table public.payment_status_history (
  id bigserial primary key,
  payment_id uuid not null references public.payments (id) on delete cascade,
  from_status public.payment_status,
  to_status public.payment_status not null,
  source text not null,                    -- 'webhook:stripe', 'admin', 'system'
  created_at timestamptz not null default now()
);

-- Raw provider notifications — idempotency key = (provider, event_id)
create table public.payment_webhooks (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text,
  payment_reference text,
  signature_valid boolean not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text,
  unique (provider, event_id)
);

create table public.commission_records (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.payments (id) on delete restrict,
  booking_id uuid not null references public.bookings (id) on delete restrict,
  consultant_id uuid not null references public.consultants (id) on delete restrict,
  gross_amount numeric(12, 2) not null,
  commission_rate numeric(5, 4) not null,
  commission_amount numeric(12, 2) not null,
  consultant_amount numeric(12, 2) not null,
  currency public.currency_code not null,
  status public.commission_status not null default 'pending',
  paid_out_at timestamptz,
  created_at timestamptz not null default now(),
  check (commission_amount + consultant_amount = gross_amount)
);
create index on public.commission_records (consultant_id, created_at desc);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  reason text not null,
  status text not null default 'requested' check (status in ('requested', 'approved', 'processing', 'completed', 'rejected')),
  requested_by uuid references public.profiles (id),
  approved_by uuid references public.profiles (id),
  provider_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Reviews ────────────────────────────────────────────────────────
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete cascade,  -- verified = tied to a completed booking
  consultant_id uuid not null references public.consultants (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  client_display_name text,               -- e.g. "Marie K." — profiles stay private
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 2000),
  consultant_reply text,
  status public.review_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.reviews (consultant_id, created_at desc) where status = 'published';

-- ─── Knowledge Center ───────────────────────────────────────────────
create table public.categories (
  id smallserial primary key,
  slug text not null unique,
  name_fr text not null,
  name_en text not null,
  sort_order smallint not null default 0
);

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  translation_of uuid references public.articles (id) on delete set null,
  title text not null,
  description text not null,
  body text not null,                      -- Markdown
  cover_url text,
  category_id smallint not null references public.categories (id),
  country_id uuid references public.countries (id) on delete set null,
  procedure_type text,
  author_id uuid not null references public.profiles (id),
  author_display_name text not null default 'Rédaction',  -- public byline (profiles are private)
  reviewer_id uuid references public.profiles (id),
  reliability public.reliability_level not null default 'editorial',
  status public.content_status not null default 'draft',
  published_at timestamptz,
  last_verified_at date,
  review_due_at date,                      -- after this date the article is flagged "to re-verify"
  search tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(body, '')), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint article_published_requires_verification check (
    status <> 'published' or (published_at is not null and last_verified_at is not null)
  )
);
create index articles_search_idx on public.articles using gin (search);
create index articles_listing_idx on public.articles (status, locale, published_at desc);
create index on public.articles (country_id);
create index on public.articles (category_id);

create table public.article_sources (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles (id) on delete cascade,
  label text not null,
  url text not null check (url ~ '^https?://'),
  is_official boolean not null default false,
  accessed_on date not null default current_date
);
create index on public.article_sources (article_id);

-- ─── Engagement ─────────────────────────────────────────────────────
create table public.saved_consultants (
  user_id uuid not null references public.profiles (id) on delete cascade,
  consultant_id uuid not null references public.consultants (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, consultant_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,                      -- booking_confirmed, booking_cancelled, new_booking…
  title text not null,
  body text,
  link text,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_email_queue on public.notifications (created_at) where emailed_at is null;

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('TCK-' || upper(substr(encode(extensions.gen_random_bytes(5), 'hex'), 1, 8))),
  user_id uuid references public.profiles (id) on delete set null,
  booking_id uuid references public.bookings (id) on delete set null,
  kind public.ticket_kind not null default 'support',
  subject text not null,
  message text not null,
  status public.ticket_status not null default 'open',
  assigned_to uuid references public.profiles (id),
  ai_conversation_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.support_tickets (status, created_at desc);

-- ─── AI assistant ───────────────────────────────────────────────────
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  anonymous_id text,                       -- for visitors not signed in
  title text,
  detected_country_id uuid references public.countries (id),
  detected_objective text,
  handed_off_at timestamptz,
  handoff_consultant_id uuid references public.consultants (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_id is not null or anonymous_id is not null)
);
alter table public.support_tickets
  add constraint support_tickets_ai_fk foreign key (ai_conversation_id) references public.ai_conversations (id) on delete set null;

create table public.ai_messages (
  id bigserial primary key,
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,  -- [{type:'article'|'consultant', id, title}]
  tokens_in integer,
  tokens_out integer,
  created_at timestamptz not null default now()
);
create index on public.ai_messages (conversation_id, id);

-- ─── Governance ─────────────────────────────────────────────────────
create table public.audit_logs (
  id bigserial primary key,
  actor_id uuid,
  action text not null,                    -- insert/update/delete or a business action
  entity text not null,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  ip inet,
  created_at timestamptz not null default now()
);
create index on public.audit_logs (entity, entity_id);
create index on public.audit_logs (created_at desc);

create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  description text,
  is_public boolean not null default false,  -- readable by anonymous visitors
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

-- ─── updated_at triggers ────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'countries', 'visa_categories', 'consultants', 'services', 'consultant_services',
    'bookings', 'payments', 'refunds', 'reviews', 'articles', 'support_tickets', 'ai_conversations'
  ] loop
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;


-- ───────────── migrations/20261117000002_functions.sql ─────────────
set search_path = public, extensions;
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


-- ───────────── migrations/20261117000003_rls.sql ─────────────
set search_path = public, extensions;
-- ════════════════════════════════════════════════════════════════════
-- GLOBENTIA — Row Level Security
-- Principle: deny by default; every table has RLS enabled.
-- Sensitive writes (bookings, payments, commissions) only go through
-- security-definer functions or the service role.
-- ════════════════════════════════════════════════════════════════════
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ─── profiles ──────────────────────────────────────────────────────
create policy "profiles: self read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
-- consultants can read the profile of clients who booked them
create policy "profiles: consultant reads own clients" on public.profiles for select to authenticated
  using (exists (select 1 from public.bookings b where b.client_id = profiles.id and b.consultant_id = public.current_consultant_id()));
create policy "profiles: self update" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- ─── roles / user_roles ────────────────────────────────────────────
create policy "roles: read" on public.roles for select to anon, authenticated using (true);
create policy "user_roles: self read" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "user_roles: admin manage" on public.user_roles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─── Public reference data ─────────────────────────────────────────
create policy "languages: read" on public.languages for select to anon, authenticated using (true);
create policy "specialties: read" on public.specialties for select to anon, authenticated using (true);
create policy "specialties: admin" on public.specialties for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "categories: read" on public.categories for select to anon, authenticated using (true);
create policy "categories: editor" on public.categories for all to authenticated using (public.is_editor()) with check (public.is_editor());

create policy "countries: read published" on public.countries for select to anon, authenticated
  using (status = 'published' or public.is_editor());
create policy "countries: editor" on public.countries for all to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "visa: read published" on public.visa_categories for select to anon, authenticated
  using (status = 'published' or public.is_editor());
create policy "visa: editor" on public.visa_categories for all to authenticated using (public.is_editor()) with check (public.is_editor());

create policy "services: read active" on public.services for select to anon, authenticated
  using (is_active or public.is_admin());
create policy "services: admin" on public.services for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "settings: public read" on public.platform_settings for select to anon, authenticated
  using (is_public or public.is_admin());
create policy "settings: admin" on public.platform_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ─── consultants & related ─────────────────────────────────────────
create policy "consultants: public read published" on public.consultants for select to anon, authenticated
  using (is_published or user_id = auth.uid() or public.is_admin());
create policy "consultants: self create" on public.consultants for insert to authenticated
  with check (user_id = auth.uid() and public.has_role('consultant'));
create policy "consultants: self update" on public.consultants for update to authenticated
  using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy "consultants: admin delete" on public.consultants for delete to authenticated using (public.is_admin());

-- Helper predicate repeated for child tables: readable if parent consultant is published; writable by owner/admin
do $$
declare t text;
begin
  foreach t in array array['consultant_qualifications', 'consultant_experiences', 'consultant_specialties',
                           'consultant_countries', 'consultant_languages', 'consultant_services', 'availability'] loop
    execute format($f$
      create policy "%1$s: public read" on public.%1$I for select to anon, authenticated
        using (exists (select 1 from public.consultants c where c.id = %1$I.consultant_id
                       and (c.is_published or c.user_id = auth.uid() or public.is_admin())));
      create policy "%1$s: owner write" on public.%1$I for all to authenticated
        using (consultant_id = public.current_consultant_id() or public.is_admin())
        with check (consultant_id = public.current_consultant_id() or public.is_admin());
    $f$, t);
  end loop;
end $$;

-- A consultant cannot self-verify a qualification
create or replace function public.guard_qualifications()
returns trigger language plpgsql as $$
begin
  if not public.is_privileged() then
    new.is_verified := case when tg_op = 'UPDATE' and old.title = new.title and old.institution is not distinct from new.institution
                            then old.is_verified else false end;
  end if;
  return new;
end $$;
create trigger qualifications_guard before insert or update on public.consultant_qualifications
for each row execute function public.guard_qualifications();

-- Exceptions: owner/admin only (periods are not public; slots come from get_available_slots)
create policy "exceptions: owner" on public.availability_exceptions for all to authenticated
  using (consultant_id = public.current_consultant_id() or public.is_admin())
  with check (consultant_id = public.current_consultant_id() or public.is_admin());

-- Verification documents: PRIVATE — owner and admins only
create policy "documents: owner read" on public.consultant_documents for select to authenticated
  using (consultant_id = public.current_consultant_id() or public.is_admin());
create policy "documents: owner upload" on public.consultant_documents for insert to authenticated
  with check (consultant_id = public.current_consultant_id() and status = 'pending' and reviewer_id is null);
create policy "documents: owner delete pending" on public.consultant_documents for delete to authenticated
  using ((consultant_id = public.current_consultant_id() and status = 'pending') or public.is_admin());
create policy "documents: admin review" on public.consultant_documents for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─── bookings ──────────────────────────────────────────────────────
-- Inserts only via create_booking_hold(); status changes only via functions.
create policy "bookings: participants read" on public.bookings for select to authenticated
  using (client_id = auth.uid() or consultant_id = public.current_consultant_id() or public.is_admin());
create policy "bookings: consultant sets meeting link" on public.bookings for update to authenticated
  using (consultant_id = public.current_consultant_id() or public.is_admin())
  with check (consultant_id = public.current_consultant_id() or public.is_admin());

create policy "booking history: participants read" on public.booking_status_history for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id
                 and (b.client_id = auth.uid() or b.consultant_id = public.current_consultant_id() or public.is_admin())));

-- ─── payments (read-only for users; written by service role) ───────
create policy "payments: client or admin read" on public.payments for select to authenticated
  using (client_id = auth.uid() or public.is_admin());
create policy "payment history: admin read" on public.payment_status_history for select to authenticated
  using (public.is_admin());
create policy "webhooks: admin read" on public.payment_webhooks for select to authenticated using (public.is_admin());
create policy "commissions: consultant or admin read" on public.commission_records for select to authenticated
  using (consultant_id = public.current_consultant_id() or public.is_admin());
create policy "commissions: admin update" on public.commission_records for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "refunds: client or admin read" on public.refunds for select to authenticated
  using (public.is_admin() or exists (select 1 from public.payments p where p.id = payment_id and p.client_id = auth.uid()));
create policy "refunds: admin manage" on public.refunds for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─── reviews ───────────────────────────────────────────────────────
create policy "reviews: public read published" on public.reviews for select to anon, authenticated
  using (status = 'published' or client_id = auth.uid() or consultant_id = public.current_consultant_id() or public.is_admin());
create policy "reviews: client writes own" on public.reviews for insert to authenticated
  with check (client_id = auth.uid());
create policy "reviews: client edits own" on public.reviews for update to authenticated
  using (client_id = auth.uid() or public.is_admin()) with check (client_id = auth.uid() or public.is_admin());
create policy "reviews: consultant replies" on public.reviews for update to authenticated
  using (consultant_id = public.current_consultant_id()) with check (consultant_id = public.current_consultant_id());
create policy "reviews: admin delete" on public.reviews for delete to authenticated using (public.is_admin());

-- ─── Knowledge Center ──────────────────────────────────────────────
create policy "articles: read published" on public.articles for select to anon, authenticated
  using (status = 'published' or public.is_editor());
create policy "articles: editor write" on public.articles for all to authenticated
  using (public.is_editor()) with check (public.is_editor());
create policy "sources: read" on public.article_sources for select to anon, authenticated
  using (exists (select 1 from public.articles a where a.id = article_id and (a.status = 'published' or public.is_editor())));
create policy "sources: editor write" on public.article_sources for all to authenticated
  using (public.is_editor()) with check (public.is_editor());

-- ─── Engagement ────────────────────────────────────────────────────
create policy "saved: own" on public.saved_consultants for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications: own read" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notifications: own mark read" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "tickets: own or admin" on public.support_tickets for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "tickets: create own" on public.support_tickets for insert to authenticated
  with check (user_id = auth.uid() and assigned_to is null and status = 'open');
create policy "tickets: admin manage" on public.support_tickets for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "ai conv: own" on public.ai_conversations for all to authenticated
  using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid());
create policy "ai msg: own" on public.ai_messages for select to authenticated
  using (exists (select 1 from public.ai_conversations c where c.id = conversation_id and (c.user_id = auth.uid() or public.is_admin())));

-- ─── Audit logs: admins read, nobody edits ─────────────────────────
create policy "audit: admin read" on public.audit_logs for select to authenticated using (public.is_admin());

-- ─── Table privileges (RLS still applies on top) ───────────────────
grant usage on schema public to anon, authenticated, service_role;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;


-- ───────────── migrations/20261117000004_storage.sql ─────────────
set search_path = public, extensions;
-- ════════════════════════════════════════════════════════════════════
-- GLOBENTIA — Storage buckets & policies
-- Path convention: <bucket>/<user_id>/<uuid>.<ext>
-- ════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('consultant-documents', 'consultant-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  ('client-documents', 'client-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  ('articles', 'articles', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Public avatars: anyone reads, owner writes in their own folder
create policy "avatars: public read" on storage.objects for select to anon, authenticated using (bucket_id = 'avatars');
create policy "avatars: owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: owner update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Private verification documents: owner + admins only, never public
create policy "consultant docs: owner/admin read" on storage.objects for select to authenticated
  using (bucket_id = 'consultant-documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "consultant docs: owner upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'consultant-documents' and (storage.foldername(name))[1] = auth.uid()::text and public.has_role('consultant'));
create policy "consultant docs: owner/admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'consultant-documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- Private client documents
create policy "client docs: owner/admin read" on storage.objects for select to authenticated
  using (bucket_id = 'client-documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "client docs: owner upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'client-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "client docs: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'client-documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- Article images: public read, editors write
create policy "article images: read" on storage.objects for select to anon, authenticated using (bucket_id = 'articles');
create policy "article images: editor write" on storage.objects for insert to authenticated
  with check (bucket_id = 'articles' and public.is_editor());


-- ───────────── migrations/20261119000005_v2_destinations_certifications.sql ─────────────
set search_path = public, extensions;
-- ════════════════════════════════════════════════════════════════════
-- v2 — destinations enrichies, certifications, tri de la recherche,
--      édition des profils par l'administration
-- ════════════════════════════════════════════════════════════════════
set search_path = public, extensions;

-- ─── Destinations : coordonnées, objectifs, opportunités, alias de recherche ──
alter table public.countries
  add column if not exists lon numeric(7, 3),
  add column if not exists lat numeric(7, 3),
  add column if not exists goals text[] not null default '{}'
    check (goals <@ array['study', 'work', 'settle']::text[]),
  add column if not exists opportunities_fr jsonb not null default '[]'::jsonb,  -- catégories générales, pas des conditions de visa
  add column if not exists opportunities_en jsonb not null default '[]'::jsonb,
  add column if not exists main_languages text,
  add column if not exists aliases text;                                        -- ex. « UK Angleterre », « Dubai EAU »

-- ─── Certifications des consultants ──────────────────────────────
create table if not exists public.consultant_certifications (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid not null references public.consultants (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 200),
  issuer text not null check (char_length(issuer) between 2 and 200),
  year_obtained smallint check (year_obtained between 1950 and 2100),
  is_verified boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists consultant_certifications_idx on public.consultant_certifications (consultant_id);
alter table public.consultant_certifications enable row level security;

create policy "certifications: public read" on public.consultant_certifications for select to anon, authenticated
  using (exists (select 1 from public.consultants c where c.id = consultant_id
                 and (c.is_published or c.user_id = auth.uid() or public.is_admin())));
create policy "certifications: owner or admin write" on public.consultant_certifications for all to authenticated
  using (consultant_id = public.current_consultant_id() or public.is_admin())
  with check (consultant_id = public.current_consultant_id() or public.is_admin());

-- Un consultant ne peut jamais marquer lui-même une certification comme vérifiée
create or replace function public.guard_certifications()
returns trigger language plpgsql as $$
begin
  if not public.is_privileged() then
    new.is_verified := case when tg_op = 'UPDATE' and old.title = new.title and old.issuer = new.issuer then old.is_verified else false end;
    new.verified_at := case when new.is_verified then old.verified_at end;
  elsif new.is_verified and (tg_op = 'INSERT' or not old.is_verified) then
    new.verified_at := now();
  end if;
  return new;
end $$;
create trigger certifications_guard before insert or update on public.consultant_certifications
for each row execute function public.guard_certifications();
create trigger consultant_certifications_audit after insert or update or delete on public.consultant_certifications
for each row execute function public.audit_row();

grant select on public.consultant_certifications to anon, authenticated;
grant insert, update, delete on public.consultant_certifications to authenticated;
grant all on public.consultant_certifications to service_role;

-- ─── Storage : l'administration peut gérer les photos de profil ───
create policy "avatars: admin write" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and public.is_admin());
create policy "avatars: admin update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and public.is_admin());
create policy "avatars: admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and public.is_admin());

-- ─── Recherche : ajout du tri (prix, note, expérience) ────────────
drop function if exists public.search_consultants(text, text, text, public.consultation_method, text, integer, numeric, numeric, text, public.consultant_type, boolean, integer, text, integer, integer);
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
  p_offset integer default 0,
  p_sort text default 'relevance'
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
    coalesce((select jsonb_agg(jsonb_build_object('slug', co.slug, 'fr', co.name_fr, 'en', co.name_en, 'flag', co.flag_emoji, 'iso', co.iso2))
              from public.consultant_countries x join public.countries co on co.id = x.country_id where x.consultant_id = s.id), '[]'),
    coalesce((select jsonb_agg(jsonb_build_object('code', l.code, 'fr', l.name_fr, 'en', l.name_en))
              from public.consultant_languages x join public.languages l on l.code = x.language_code where x.consultant_id = s.id), '[]'),
    coalesce((select jsonb_agg(jsonb_build_object('title', q.title, 'level', q.level, 'verified', q.is_verified))
              from public.consultant_qualifications q where q.consultant_id = s.id), '[]'),
    exists (select 1 from public.availability a where a.consultant_id = s.id),
    s.score,
    count(*) over ()
  from scored s
  order by
    case when p_sort = 'price' then s.min_price end asc nulls last,
    case when p_sort = 'rating' then s.rating_avg end desc,
    case when p_sort = 'experience' then s.years_experience end desc,
    s.score desc, s.reviews_count desc, s.professional_name
  limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0);
$$;

grant execute on function public.search_consultants to anon, authenticated;


-- ───────────── reference-data.sql ─────────────
set search_path = public, extensions;
-- ════════════════════════════════════════════════════════════════════
-- DONNÉES DE RÉFÉRENCE — à exécuter AUSSI EN PRODUCTION (idempotent)
-- rôles, paramètres, langues, spécialités, catégories, services (tarifs), 30 pays
-- Aucune donnée de démonstration ici : pas de comptes, pas de consultants.
-- Les textes pays sont des présentations générales ; les conditions de visa
-- doivent être saisies par l'équipe éditoriale avec source officielle et date.
-- ════════════════════════════════════════════════════════════════════
set search_path = public, extensions;

insert into public.roles (key, label_fr, label_en) values
  ('client', 'Client', 'Client'),
  ('consultant', 'Consultant', 'Consultant'),
  ('editor', 'Éditeur', 'Editor'),
  ('admin', 'Administrateur', 'Administrator'),
  ('super_admin', 'Super administrateur', 'Super administrator')
on conflict (key) do nothing;

insert into public.platform_settings (key, value, description, is_public) values
  ('commission_rate', '0.20', 'Commission plateforme par défaut (0–1)', false),
  ('booking_hold_minutes', '15', 'Durée de réservation temporaire du créneau pendant le paiement', true),
  ('cancellation_policy', '{"free_until_hours": 24, "reschedule_until_hours": 24}', 'Politique d''annulation et de report', true),
  ('supported_currencies', '["XAF", "EUR", "USD"]', 'Devises acceptées', true),
  ('exchange_rates', '{"XAF": 1, "EUR": 655.957, "USD": 600}', 'Taux indicatifs (XAF par unité) — à mettre à jour par un admin', true),
  ('contact', '{"email": "contact@monprojet.com", "phone": "+237 6XX XX XX XX", "city": "Yaoundé, Cameroun"}', 'Coordonnées affichées', true)
on conflict (key) do nothing;

insert into public.languages (code, name_fr, name_en) values
  ('fr', 'Français', 'French'), ('en', 'Anglais', 'English'), ('de', 'Allemand', 'German'),
  ('es', 'Espagnol', 'Spanish'), ('it', 'Italien', 'Italian'), ('pt', 'Portugais', 'Portuguese'),
  ('ar', 'Arabe', 'Arabic'), ('zh', 'Chinois', 'Chinese'), ('ro', 'Roumain', 'Romanian')
on conflict do nothing;

insert into public.specialties (slug, name_fr, name_en) values
  ('study-visa', 'Visa étudiant', 'Study visa'),
  ('work-permit', 'Permis de travail', 'Work permit'),
  ('permanent-residence', 'Résidence permanente', 'Permanent residence'),
  ('family-reunification', 'Regroupement familial', 'Family reunification'),
  ('tourist-visa', 'Visa touristique', 'Tourist visa'),
  ('university-admission', 'Admission universitaire', 'University admission'),
  ('career-orientation', 'Orientation professionnelle', 'Career guidance'),
  ('ausbildung', 'Ausbildung (formation en alternance)', 'Ausbildung (vocational training)'),
  ('document-review', 'Revue de dossier', 'Application review')
on conflict do nothing;

insert into public.categories (slug, name_fr, name_en, sort_order) values
  ('study-abroad', 'Études à l''étranger', 'Study Abroad', 1),
  ('work-abroad', 'Travailler à l''étranger', 'Work Abroad', 2),
  ('tourist-visas', 'Visas touristiques', 'Tourist Visas', 3),
  ('immigration', 'Immigration', 'Immigration', 4),
  ('permanent-residence', 'Résidence permanente', 'Permanent Residence', 5),
  ('opportunities', 'Opportunités internationales', 'International Opportunities', 6),
  ('country-guides', 'Guides pays', 'Country Guides', 7),
  ('updates', 'Actualités immigration', 'Immigration Updates', 8)
on conflict do nothing;

-- Services (§8) — prices editable in /admin/settings
insert into public.services (slug, name_fr, name_en, description_fr, description_en, icon, pricing_type, base_price, currency, default_duration_minutes, is_bookable, sort_order) values
  ('consultation', 'Consultation avec un expert', 'Consultation with an Expert',
   'Échangez avec un expert qualifié sur votre projet de mobilité internationale.',
   'Talk to a qualified expert about your international mobility project.',
   'MessagesSquare', 'fixed', 15000, 'XAF', 45, true, 1),
  ('profile-assessment', 'Évaluation de profil personnalisée', 'Personalized Profile Assessment',
   'Analyse approfondie de votre profil et des options adaptées à votre situation.',
   'In-depth analysis of your profile and the options that fit your situation.',
   'ClipboardCheck', 'fixed', 25000, 'XAF', 60, true, 2),
  ('procedural-assistance', 'Assistance procédurale', 'Procedural Assistance',
   'Accompagnement dans la constitution et le suivi de votre dossier. Prix sur devis.',
   'Support preparing and following up your application. Price upon quotation.',
   'FileStack', 'quote', null, 'XAF', 60, false, 3)
on conflict (slug) do nothing;

insert into public.countries (slug, iso2, name_fr, name_en, region, lon, lat, is_popular, main_languages, goals, opportunities_fr, opportunities_en, overview_fr, overview_en, official_links, source_name, source_url, aliases, status) 
select v.slug, v.iso2, v.name_fr, v.name_en, v.region::public.region, v.lon, v.lat, v.is_popular, v.main_languages, v.goals, v.opportunities_fr::jsonb, v.opportunities_en::jsonb, v.overview_fr, v.overview_en, v.official_links::jsonb, v.source_name, v.source_url, v.aliases, 'published'::public.content_status from (values
  ('canada', 'CA', 'Canada', 'Canada', 'north_america', -73.6, 45.5, true, 'Anglais, français', array['study','work','settle']::text[], '["Études", "Travail qualifié", "Résidence permanente"]', '["Study", "Skilled work", "Permanent residence"]', 'Destination majeure pour les études, le travail qualifié et l''immigration permanente.', 'A leading destination for study, skilled work and permanent immigration.', '[{"label": "Immigration, Réfugiés et Citoyenneté Canada", "url": "https://www.canada.ca/fr/services/immigration-citoyennete.html"}]', 'Immigration, Réfugiés et Citoyenneté Canada', 'https://www.canada.ca/fr/services/immigration-citoyennete.html', null),
  ('united-states', 'US', 'États-Unis', 'United States', 'north_america', -74, 40.7, true, 'Anglais', array['study','work']::text[], '["Études", "Programmes d''échange"]', '["Study", "Exchange programmes"]', 'Large choix d''universités et de programmes d''échange.', 'A wide choice of universities and exchange programmes.', '[{"label": "U.S. Department of State — Visas", "url": "https://travel.state.gov/content/travel/en/us-visas.html"}]', 'U.S. Department of State — Visas', 'https://travel.state.gov/content/travel/en/us-visas.html', 'USA'),
  ('france', 'FR', 'France', 'France', 'europe', 2.35, 48.85, true, 'Français', array['study','work','settle']::text[], '["Études supérieures", "Stages", "Travail"]', '["Higher education", "Internships", "Work"]', 'Destination francophone de référence pour les études supérieures et la mobilité professionnelle.', 'A key French-speaking destination for higher education and professional mobility.', '[{"label": "France-Visas", "url": "https://france-visas.gouv.fr"}, {"label": "Campus France", "url": "https://www.campusfrance.org"}]', 'France-Visas', 'https://france-visas.gouv.fr', null),
  ('belgium', 'BE', 'Belgique', 'Belgium', 'europe', 4.35, 50.85, true, 'Français, néerlandais', array['study','work']::text[], '["Universités francophones", "Recherche"]', '["French-speaking universities", "Research"]', 'Pays multilingue au cœur de l''Europe, apprécié pour ses universités francophones.', 'A multilingual country at the heart of Europe, popular for its French-speaking universities.', '[{"label": "Office des Étrangers", "url": "https://dofi.ibz.be"}]', 'Office des Étrangers', 'https://dofi.ibz.be', null),
  ('germany', 'DE', 'Allemagne', 'Germany', 'europe', 13.4, 52.5, true, 'Allemand', array['study','work','settle']::text[], '["Ausbildung", "Travail qualifié", "Études"]', '["Ausbildung", "Skilled work", "Study"]', 'Forte demande de main-d''œuvre qualifiée, formations Ausbildung et universités publiques.', 'Strong demand for skilled workers, Ausbildung training and public universities.', '[{"label": "Make it in Germany", "url": "https://www.make-it-in-germany.com"}, {"label": "Auswärtiges Amt", "url": "https://www.auswaertiges-amt.de"}]', 'Make it in Germany', 'https://www.make-it-in-germany.com', null),
  ('united-kingdom', 'GB', 'Royaume-Uni', 'United Kingdom', 'europe', -0.13, 51.5, true, 'Anglais', array['study','work']::text[], '["Études", "Travail qualifié"]', '["Study", "Skilled work"]', 'Universités de renommée mondiale et parcours de visas à points.', 'World-renowned universities and points-based visa routes.', '[{"label": "GOV.UK — Visas and immigration", "url": "https://www.gov.uk/browse/visas-immigration"}]', 'GOV.UK — Visas and immigration', 'https://www.gov.uk/browse/visas-immigration', 'UK Angleterre England Londres London'),
  ('switzerland', 'CH', 'Suisse', 'Switzerland', 'europe', 7.45, 46.95, false, 'Français, allemand, italien', array['study','work']::text[], '["Hautes écoles", "Hôtellerie", "Recherche"]', '["Universities", "Hospitality", "Research"]', 'Écoles réputées, notamment en hôtellerie et en ingénierie, dans un environnement multilingue.', 'Renowned schools, especially in hospitality and engineering, in a multilingual setting.', '[{"label": "Secrétariat d''État aux migrations", "url": "https://www.sem.admin.ch"}]', 'Secrétariat d''État aux migrations', 'https://www.sem.admin.ch', null),
  ('luxembourg', 'LU', 'Luxembourg', 'Luxembourg', 'europe', 6.13, 49.61, false, 'Français, allemand, luxembourgeois', array['work','study']::text[], '["Finance", "Travail qualifié"]', '["Finance", "Skilled work"]', 'Petit pays au marché du travail international, centré sur la finance et les services.', 'A small country with an international job market focused on finance and services.', '[{"label": "Guichet.lu", "url": "https://guichet.public.lu"}]', 'Guichet.lu', 'https://guichet.public.lu', null),
  ('netherlands', 'NL', 'Pays-Bas', 'Netherlands', 'europe', 4.9, 52.37, false, 'Néerlandais, anglais', array['study','work']::text[], '["Programmes en anglais", "Travail qualifié"]', '["English-taught programmes", "Skilled work"]', 'Nombreux programmes universitaires enseignés en anglais et économie très internationale.', 'Many English-taught university programmes and a highly international economy.', '[{"label": "IND — Immigration and Naturalisation Service", "url": "https://ind.nl"}]', 'IND — Immigration and Naturalisation Service', 'https://ind.nl', 'Hollande Holland'),
  ('ireland', 'IE', 'Irlande', 'Ireland', 'europe', -6.26, 53.35, false, 'Anglais', array['study','work']::text[], '["Études", "Technologies"]', '["Study", "Technology"]', 'Pays anglophone de l''Union européenne, avec un secteur technologique dynamique.', 'An English-speaking EU country with a dynamic tech sector.', '[{"label": "Irish Immigration Service", "url": "https://www.irishimmigration.ie"}]', 'Irish Immigration Service', 'https://www.irishimmigration.ie', null),
  ('spain', 'ES', 'Espagne', 'Spain', 'europe', -3.7, 40.42, false, 'Espagnol', array['study','work']::text[], '["Études", "Tourisme et hôtellerie"]', '["Study", "Tourism and hospitality"]', 'Coût de la vie modéré et offre universitaire variée.', 'Moderate cost of living and a varied university offer.', '[{"label": "Ministère des Affaires étrangères", "url": "https://www.exteriores.gob.es"}]', 'Ministère des Affaires étrangères', 'https://www.exteriores.gob.es', null),
  ('portugal', 'PT', 'Portugal', 'Portugal', 'europe', -9.14, 38.72, false, 'Portugais', array['study','work','settle']::text[], '["Études", "Travail", "Installation"]', '["Study", "Work", "Relocation"]', 'Destination appréciée pour sa qualité de vie et son coût de la vie accessible.', 'Valued for its quality of life and affordable cost of living.', '[{"label": "Portail des visas", "url": "https://vistos.mne.gov.pt"}]', 'Portail des visas', 'https://vistos.mne.gov.pt', null),
  ('italy', 'IT', 'Italie', 'Italy', 'europe', 9.19, 45.46, false, 'Italien', array['study']::text[], '["Études en anglais", "Bourses régionales"]', '["English-taught study", "Regional scholarships"]', 'Programmes universitaires en anglais et frais de scolarité souvent accessibles.', 'English-taught university programmes and often affordable tuition.', '[{"label": "Visto per l''Italia", "url": "https://vistoperitalia.esteri.it"}]', 'Visto per l''Italia', 'https://vistoperitalia.esteri.it', null),
  ('romania', 'RO', 'Roumanie', 'Romania', 'europe', 26.1, 44.43, false, 'Roumain', array['study']::text[], '["Études de médecine", "Année préparatoire"]', '["Medical studies", "Foundation year"]', 'Études médicales et techniques, avec une année préparatoire de langue roumaine.', 'Medical and technical studies, with a preparatory Romanian language year.', '[{"label": "MAE Roumanie — eVisa", "url": "https://evisa.mae.ro"}]', 'MAE Roumanie — eVisa', 'https://evisa.mae.ro', null),
  ('poland', 'PL', 'Pologne', 'Poland', 'europe', 21.01, 52.23, false, 'Polonais', array['study','work']::text[], '["Études", "Industrie"]', '["Study", "Industry"]', 'Universités aux frais modérés et économie en croissance.', 'Universities with moderate fees and a growing economy.', '[{"label": "Gouvernement polonais — diplomatie", "url": "https://www.gov.pl/web/diplomacy"}]', 'Gouvernement polonais — diplomatie', 'https://www.gov.pl/web/diplomacy', null),
  ('latvia', 'LV', 'Lettonie', 'Latvia', 'europe', 24.1, 56.95, false, 'Letton', array['study']::text[], '["Études en anglais"]', '["English-taught study"]', 'Pays balte proposant des formations en anglais à des coûts accessibles.', 'A Baltic country offering English-taught programmes at affordable cost.', '[{"label": "Office de la citoyenneté et des migrations", "url": "https://www.pmlp.gov.lv"}]', 'Office de la citoyenneté et des migrations', 'https://www.pmlp.gov.lv', null),
  ('albania', 'AL', 'Albanie', 'Albania', 'europe', 19.82, 41.33, false, 'Albanais', array['study','work']::text[], '["Études", "Travail saisonnier", "Tourisme et hôtellerie"]', '["Study", "Seasonal work", "Tourism and hospitality"]', 'Pays des Balkans au coût de la vie modéré, avec un secteur touristique en forte croissance.', 'A Balkan country with a moderate cost of living and a fast-growing tourism sector.', '[{"label": "e-Albania — portail officiel", "url": "https://e-albania.al"}]', 'e-Albania — portail officiel', 'https://e-albania.al', null),
  ('serbia', 'RS', 'Serbie', 'Serbia', 'europe', 20.46, 44.79, false, 'Serbe', array['study','work']::text[], '["Études", "Travail", "Industrie"]', '["Study", "Work", "Industry"]', 'Carrefour des Balkans, avec des universités publiques accessibles et une économie en développement.', 'A Balkan crossroads with accessible public universities and a developing economy.', '[{"label": "Ministère des Affaires étrangères de Serbie", "url": "https://www.mfa.gov.rs"}]', 'Ministère des Affaires étrangères de Serbie', 'https://www.mfa.gov.rs', null),
  ('turkey', 'TR', 'Turquie', 'Türkiye', 'europe', 28.98, 41.01, false, 'Turc', array['study']::text[], '["Études", "Bourses"]', '["Study", "Scholarships"]', 'Carrefour entre l''Europe et l''Asie, avec de nombreuses universités publiques et privées.', 'A crossroads between Europe and Asia with many public and private universities.', '[{"label": "e-Visa République de Turquie", "url": "https://www.evisa.gov.tr"}]', 'e-Visa République de Turquie', 'https://www.evisa.gov.tr', 'Turkey Istanbul'),
  ('morocco', 'MA', 'Maroc', 'Morocco', 'africa', -6.85, 34.02, false, 'Arabe, français', array['study','work']::text[], '["Études francophones", "Écoles d''ingénieurs"]', '["French-taught study", "Engineering schools"]', 'Destination francophone proche, appréciée pour ses écoles d''ingénieurs et de commerce.', 'A nearby French-speaking destination known for its engineering and business schools.', '[]', null, null, null),
  ('ivory-coast', 'CI', 'Côte d''Ivoire', 'Côte d''Ivoire', 'africa', -4.03, 5.36, false, 'Français', array['work','study']::text[], '["Travail", "Grandes écoles"]', '["Work", "Graduate schools"]', 'Pôle économique d''Afrique de l''Ouest, avec un marché du travail francophone.', 'West Africa''s economic hub with a French-speaking job market.', '[]', null, null, 'Abidjan Ivory Coast'),
  ('south-africa', 'ZA', 'Afrique du Sud', 'South Africa', 'africa', 28.04, -26.2, false, 'Anglais', array['study','work']::text[], '["Universités", "Travail qualifié"]', '["Universities", "Skilled work"]', 'Universités reconnues sur le continent et économie diversifiée.', 'Well-regarded universities and a diversified economy.', '[{"label": "Department of Home Affairs", "url": "https://www.dha.gov.za"}]', 'Department of Home Affairs', 'https://www.dha.gov.za', null),
  ('cameroon', 'CM', 'Cameroun', 'Cameroon', 'africa', 9.7, 4.05, false, 'Français, anglais', array[]::text[], '["Point de départ"]', '["Starting point"]', 'Point de départ de nombreux projets de mobilité accompagnés par la plateforme.', 'The starting point of many mobility projects supported by the platform.', '[]', null, null, null),
  ('uae', 'AE', 'Dubaï (Émirats arabes unis)', 'Dubai (United Arab Emirates)', 'middle_east', 55.27, 25.2, false, 'Arabe, anglais', array['work','settle']::text[], '["Travail", "Hôtellerie", "Commerce", "Entrepreneuriat"]', '["Work", "Hospitality", "Trade", "Entrepreneurship"]', 'Dubaï est un hub international pour le commerce, l''hôtellerie, l''aviation et les services.', 'Dubai is an international hub for trade, hospitality, aviation and services.', '[{"label": "Portail officiel des Émirats", "url": "https://u.ae"}]', 'Portail officiel des Émirats', 'https://u.ae', 'Dubai UAE EAU Abu Dhabi'),
  ('china', 'CN', 'Chine', 'China', 'asia', 116.4, 39.9, false, 'Mandarin', array['study']::text[], '["Études", "Bourses"]', '["Study", "Scholarships"]', 'Nombreuses bourses d''études et universités ouvertes aux étudiants internationaux.', 'Many scholarships and universities open to international students.', '[{"label": "Visa for China", "url": "https://www.visaforchina.cn"}]', 'Visa for China', 'https://www.visaforchina.cn', null),
  ('japan', 'JP', 'Japon', 'Japan', 'asia', 139.69, 35.68, false, 'Japonais', array['study','work']::text[], '["Études", "Recherche", "Technologies"]', '["Study", "Research", "Technology"]', 'Excellence technologique et programmes universitaires de recherche.', 'Technological excellence and research-driven university programmes.', '[{"label": "Ministère des Affaires étrangères du Japon", "url": "https://www.mofa.go.jp/j_info/visit/visa/"}]', 'Ministère des Affaires étrangères du Japon', 'https://www.mofa.go.jp/j_info/visit/visa/', null),
  ('south-korea', 'KR', 'Corée du Sud', 'South Korea', 'asia', 126.98, 37.57, false, 'Coréen', array['study']::text[], '["Études", "Bourses gouvernementales"]', '["Study", "Government scholarships"]', 'Universités reconnues et programmes de bourses pour étudiants étrangers.', 'Recognised universities and scholarship programmes for foreign students.', '[{"label": "Korea Visa Portal", "url": "https://www.visa.go.kr"}, {"label": "Study in Korea", "url": "https://www.studyinkorea.go.kr"}]', 'Korea Visa Portal', 'https://www.visa.go.kr', 'Korea Seoul'),
  ('australia', 'AU', 'Australie', 'Australia', 'oceania', 151.21, -33.87, false, 'Anglais', array['study','work','settle']::text[], '["Études", "Travail qualifié", "Résidence permanente"]', '["Study", "Skilled work", "Permanent residence"]', 'Grande destination anglophone pour les études et l''immigration qualifiée.', 'A major English-speaking destination for study and skilled immigration.', '[{"label": "Department of Home Affairs", "url": "https://immi.homeaffairs.gov.au"}]', 'Department of Home Affairs', 'https://immi.homeaffairs.gov.au', null),
  ('new-zealand', 'NZ', 'Nouvelle-Zélande', 'New Zealand', 'oceania', 174.76, -36.85, false, 'Anglais', array['study','work']::text[], '["Études", "Travail"]', '["Study", "Work"]', 'Cadre de vie recherché et formations reconnues.', 'A sought-after lifestyle and recognised training.', '[{"label": "Immigration New Zealand", "url": "https://www.immigration.govt.nz"}]', 'Immigration New Zealand', 'https://www.immigration.govt.nz', null),
  ('brazil', 'BR', 'Brésil', 'Brazil', 'latin_america', -46.63, -23.55, false, 'Portugais', array['study','work']::text[], '["Études", "Échanges"]', '["Study", "Exchanges"]', 'Première économie d''Amérique latine, avec des programmes d''échange universitaires.', 'Latin America''s largest economy, with university exchange programmes.', '[{"label": "Ministère des Relations extérieures", "url": "https://www.gov.br/mre"}]', 'Ministère des Relations extérieures', 'https://www.gov.br/mre', null)
) as v(slug, iso2, name_fr, name_en, region, lon, lat, is_popular, main_languages, goals, opportunities_fr, opportunities_en, overview_fr, overview_en, official_links, source_name, source_url, aliases)
on conflict (slug) do update set iso2 = excluded.iso2, name_fr = excluded.name_fr, name_en = excluded.name_en, region = excluded.region, lon = excluded.lon, lat = excluded.lat,
  is_popular = excluded.is_popular, main_languages = excluded.main_languages, goals = excluded.goals, opportunities_fr = excluded.opportunities_fr, opportunities_en = excluded.opportunities_en,
  overview_fr = excluded.overview_fr, overview_en = excluded.overview_en, official_links = excluded.official_links, source_name = excluded.source_name, source_url = excluded.source_url, aliases = excluded.aliases;



-- ───────────── First admin (edit the e-mail, then uncomment; run AFTER signing up on the site) ─────────────
-- insert into public.user_roles (user_id, role_id)
-- select u.id, r.id from auth.users u, public.roles r
-- where u.email = 'you@your-domain.com' and r.key in ('admin', 'editor')
-- on conflict do nothing;
