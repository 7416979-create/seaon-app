// Makes the web-push keys and the cron secret for 7차 push reminders. Written by the lead.
// Writes claude-work/push-setup-owner.sql (gitignored) for the OWNER to run once in the Supabase SQL Editor.
// Prints only the PUBLIC key (safe to put in .env as VITE_VAPID_PUBLIC_KEY). Never prints the private key.
// Refuses to run again if the owner file already exists, so keys are not replaced by accident.
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'claude-work');
const ownerFile = path.join(dir, 'push-setup-owner.sql');
if (existsSync(ownerFile)) {
  console.error(`이미 있습니다: ${ownerFile}\n대표님이 실행한 뒤 지웠는지 확인하세요. 키를 새로 만들려면 팀장 승인이 필요합니다.`);
  process.exit(1);
}

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pub = publicKey.export({ format: 'jwk' });
const priv = privateKey.export({ format: 'jwk' });
const b64u = (s) => Buffer.from(s, 'base64url');
const vapidPublic = Buffer.concat([Buffer.from([4]), b64u(pub.x), b64u(pub.y)]).toString('base64url');
const vapidPrivate = priv.d;
const cronSecret = randomBytes(24).toString('base64url');
const subject = 'https://7416979-create.github.io/seaon-app/';

const q = (s) => `'${s.replace(/'/g, "''")}'`;
mkdirSync(dir, { recursive: true });
writeFileSync(
  ownerFile,
  [
    '-- 대표님 전용 (세아온 근태관리 7차 푸시 알림 설정)',
    '-- 1) Supabase → SQL Editor에 이 내용을 전부 붙여 넣고 Run 하세요.',
    '-- 2) 결과에 4줄이 나오면 성공입니다. 이 파일을 지우세요. 누구에게도 보내거나 채팅에 붙여 넣지 마세요.',
    `select vault.create_secret(${q(vapidPublic)}, 'vapid_public_key', 'web push public key');`,
    `select vault.create_secret(${q(vapidPrivate)}, 'vapid_private_key', 'web push private key');`,
    `select vault.create_secret(${q(subject)}, 'vapid_subject', 'web push contact');`,
    `select vault.create_secret(${q(cronSecret)}, 'push_cron_secret', 'cron to push-reminders');`,
    '',
  ].join('\n'),
);

console.log('대표님 파일을 만들었습니다:', ownerFile);
console.log('.env에 추가할 줄 (공개 키, 비밀 아님):');
console.log(`VITE_VAPID_PUBLIC_KEY=${vapidPublic}`);
