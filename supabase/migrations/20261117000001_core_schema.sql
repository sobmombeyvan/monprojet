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
