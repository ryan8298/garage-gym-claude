// Renders the app icons from one SVG. Run: node scripts/make-icons.mjs
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH ?? 'playwright')
import { writeFileSync } from 'node:fs'

const mark = (pad) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0D0F11"/>
  <g transform="translate(256 256) scale(${pad}) translate(-256 -256)" fill="#C8F250">
    <rect x="96" y="236" width="320" height="40" rx="12"/>
    <rect x="124" y="156" width="44" height="200" rx="14"/>
    <rect x="344" y="156" width="44" height="200" rx="14"/>
    <rect x="72" y="196" width="36" height="120" rx="12"/>
    <rect x="404" y="196" width="36" height="120" rx="12"/>
  </g>
</svg>`

writeFileSync('public/favicon.svg', mark(1))
const browser = await chromium.launch()
for (const [name, size, pad] of [
  ['icon-192.png', 192, 1],
  ['icon-512.png', 512, 1],
  ['icon-maskable-512.png', 512, 0.72],
  ['apple-touch-icon.png', 180, 0.86],
]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  await page.setContent(`<style>*{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${mark(pad)}`)
  await page.screenshot({ path: `public/${name}` })
  await page.close()
}
await browser.close()
