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
