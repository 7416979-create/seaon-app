import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });

// Clock mark on brand blue. `inset` shrinks the mark for maskable icons (safe zone = inner 80%).
const svg = (inset = 0, rounded = true) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="#1f5eff"/>
  <g transform="translate(${256 - (256 - inset)} ${256 - (256 - inset)}) scale(${(512 - inset * 2) / 512})"
     fill="none" stroke="#fff" stroke-width="40" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="256" cy="256" r="150"/>
    <path d="M256 170v86l58 38"/>
  </g>
</svg>`;

const jobs = [
  ['icon-192.png', 192, svg(0)],
  ['icon-512.png', 512, svg(0)],
  ['icon-maskable-512.png', 512, svg(70, false)],
  ['apple-touch-icon.png', 180, svg(0, false)],
];

for (const [name, size, s] of jobs) {
  await sharp(Buffer.from(s)).resize(size, size).png().toFile(new URL(name, out).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
}
writeFileSync(new URL('favicon.svg', out), svg(0));
console.log('icons written');
