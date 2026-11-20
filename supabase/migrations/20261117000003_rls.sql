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
