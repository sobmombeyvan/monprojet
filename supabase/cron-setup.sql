-- ════════════════════════════════════════════════════════════════════
-- Scheduled maintenance every 5 minutes, run by Supabase (free plan OK)
-- Replaces the 5-minute Vercel cron (Vercel Hobby allows only one run per day).
--
-- Every 5 minutes Supabase calls  GET <site>/api/cron/maintenance  which:
--   · frees unpaid slot holds        · re-checks pending Fapshi payments
--   · expires unused payment links   · sends queued e-mails
--
-- HOW TO RUN: Supabase › SQL Editor › paste › replace the 2 values below › Run.
--   1. YOUR_SITE_URL     → your Vercel address, e.g. https://monprojet.vercel.app (no trailing /)
--   2. YOUR_CRON_SECRET  → exactly the CRON_SECRET set in Vercel › Settings › Environment Variables
-- Safe to run again (e.g. after changing the domain or the secret).
-- ════════════════════════════════════════════════════════════════════

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Store the URL and secret encrypted in Supabase Vault (not in plain text in the job)
do $$
declare
  v_url    text := 'YOUR_SITE_URL';
  v_secret text := 'YOUR_CRON_SECRET';
  v_id uuid;
begin
  if v_url like 'YOUR_%' or v_secret like 'YOUR_%' then
    raise exception 'Replace YOUR_SITE_URL and YOUR_CRON_SECRET before running this script';
  end if;
  v_url := rtrim(v_url, '/');

  select id into v_id from vault.secrets where name = 'maintenance_url';
  if v_id is null then perform vault.create_secret(v_url, 'maintenance_url');
  else perform vault.update_secret(v_id, v_url); end if;

  v_id := null;
  select id into v_id from vault.secrets where name = 'cron_secret';
  if v_id is null then perform vault.create_secret(v_secret, 'cron_secret');
  else perform vault.update_secret(v_id, v_secret); end if;
end $$;

-- Every 5 minutes: call the maintenance endpoint (same name = the job is updated, not duplicated)
select cron.schedule(
  'site-maintenance',
  '*/5 * * * *',
  $job$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'maintenance_url') || '/api/cron/maintenance',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    timeout_milliseconds := 30000
  );
  $job$
);

-- Safety net in pure SQL, every minute: free expired slot holds even if the site is unreachable
select cron.schedule('release-expired-holds', '* * * * *', $job$ select public.release_expired_holds(); $job$);

-- ─── Check it works (run a few minutes later) ──────────────────────────
-- select jobname, schedule, active from cron.job;
-- select status_code, content::text, created from net._http_response order by created desc limit 5;
--   → status_code 200 and {"released":…,"payments":…,"emailed":…}. 401 = wrong secret.
--
-- ─── Stop it ───────────────────────────────────────────────────────────
-- select cron.unschedule('site-maintenance');
-- select cron.unschedule('release-expired-holds');
