-- 2026-10-12: run the push-reminders Edge Function every 5 minutes (7차). Written by the lead; do not edit.
-- Run ONLY AFTER: 2026-10-12-push-reminders.sql, the owner's Vault secrets, and the Edge Function deploy.
-- Safe to run more than once (replaces the job). The cron secret is read from Vault inside the job,
-- so it never appears in this file or in cron.job.

select cron.unschedule(jobid) from cron.job where jobname = 'seaon-push-reminders';

select cron.schedule(
  'seaon-push-reminders',
  '*/5 * * * *',
  $job$
  select net.http_post(
    url := 'https://gecuvqtchrnoqdssvjlc.supabase.co/functions/v1/push-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000);
  $job$
);

-- Check after running (expect one row: seaon-push-reminders | */5 * * * * | true):
-- select jobname, schedule, active from cron.job where jobname = 'seaon-push-reminders';
-- Recent calls (status 200 and body like {"due":0,"sent":0,"failed":0} outside reminder times):
-- select id, status_code, left(content, 120) from net._http_response order by id desc limit 5;
