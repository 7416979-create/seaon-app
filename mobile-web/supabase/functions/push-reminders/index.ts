// 출퇴근 N분 전 푸시 알림 (7차). Written by the lead; do not edit without a request.
// Called every 5 minutes by pg_cron (migrations/2026-10-12-push-cron.sql) with header x-cron-secret.
// Deploy with "Verify JWT" OFF: the function checks the cron secret itself (push_config in the DB).
// Secrets live in Supabase Vault; this function never logs them.
// Test call (TST employees only): POST body { "testNow": "2026-10-13T08:35:00+09:00", "testEmpNo": "TST701" }
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const APP_URL = 'https://7416979-create.github.io/seaon-app/#/home';

interface Due {
  endpoint: string;
  p256dh: string;
  auth: string;
  title: string;
  body: string;
}

Deno.serve(async (req) => {
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const cfg = await db.rpc('push_config', { p_secret: req.headers.get('x-cron-secret') ?? '' });
  if (cfg.error || !cfg.data?.privateKey) return new Response('forbidden', { status: 403 });
  webpush.setVapidDetails(cfg.data.subject, cfg.data.publicKey, cfg.data.privateKey);

  const input = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const due = await db.rpc('push_due', {
    p_now: typeof input.testNow === 'string' ? input.testNow : new Date().toISOString(),
    p_test_emp_no: typeof input.testEmpNo === 'string' ? input.testEmpNo : null,
  });
  if (due.error) return Response.json({ error: due.error.message }, { status: 500 });

  let sent = 0;
  let failed = 0;
  for (const n of (due.data ?? []) as Due[]) {
    try {
      await webpush.sendNotification(
        { endpoint: n.endpoint, keys: { p256dh: n.p256dh, auth: n.auth } },
        JSON.stringify({ title: n.title, body: n.body, url: APP_URL }),
        { TTL: 1800, urgency: 'high' },
      );
      sent++;
      await db.rpc('push_result', { p_endpoint: n.endpoint, p_ok: true, p_gone: false });
    } catch (e) {
      failed++;
      const code = (e as { statusCode?: number }).statusCode;
      await db.rpc('push_result', { p_endpoint: n.endpoint, p_ok: false, p_gone: code === 404 || code === 410 });
    }
  }
  return Response.json({ due: (due.data ?? []).length, sent, failed });
});
