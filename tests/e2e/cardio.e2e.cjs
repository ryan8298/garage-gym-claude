// Tracking a run with the phone's location: distance builds up, and the saved entry keeps its route.
// Run `npm run build` first, then:
//   PLAYWRIGHT_PATH=/path/to/playwright node tests/e2e/cardio.e2e.cjs
const { spawn } = require('node:child_process')
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? 'playwright')

const PORT = 4187
const URL = `http://localhost:${PORT}`
const shot = process.env.SHOT_DIR

async function main() {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
  await new Promise((r) => setTimeout(r, 2500))
  const browser = await chromium.launch()
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, geolocation: { latitude: 40, longitude: -75, accuracy: 5 }, permissions: ['geolocation'] })
    await context.route('**/*.supabase.co/**', (route) => route.abort())
    await context.route('**/tile.openstreetmap.org/**', (route) => route.abort())
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto(URL)
    await page.evaluate(() => localStorage.setItem('gg.user', JSON.stringify({ id: '00000000-0000-0000-0000-000000000001', email: 'test@example.com' })))
    await page.reload()
    await page.getByRole('link', { name: /^Cardio/ }).click()
    await page.getByRole('heading', { name: 'Cardio' }).waitFor()
    await page.getByRole('link', { name: 'Track a run or walk' }).click()
    await page.getByRole('button', { name: 'Walk' }).click()
    await page.getByRole('button', { name: 'Start', exact: true }).click()
    await page.getByRole('timer').waitFor()

    // Move north in twenty steps of about 11 metres, one a second: a brisk but possible pace.
    for (let i = 1; i <= 20; i++) {
      await context.setGeolocation({ latitude: 40 + i * 0.0001, longitude: -75, accuracy: 5 })
      await page.waitForTimeout(1000)
    }
    await page.waitForFunction(() => /0\.1[2-4]/.test(document.body.innerText), null, { timeout: 8000 })
    if (shot) await page.screenshot({ path: `${shot}/cardio-track.png` })

    // A reload mid-walk keeps the route, paused.
    await page.reload()
    await page.getByText('paused').waitFor()
    await page.waitForFunction(() => /0\.1[2-4]/.test(document.body.innerText))
    await page.getByRole('button', { name: 'Finish' }).click()

    await page.waitForURL('**/cardio/*')
    await page.getByRole('heading', { name: 'Walk' }).waitFor()
    await page.getByRole('img', { name: 'Map of the route' }).waitFor()
    if (shot) await page.screenshot({ path: `${shot}/cardio-detail.png` })

    const entries = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const open = indexedDB.open('garage-gym')
          open.onsuccess = () => (open.result.transaction(['cardio_entries']).objectStore('cardio_entries').getAll().onsuccess = (e) => resolve(e.target.result))
        }),
    )
    assert.equal(entries.length, 1)
    assert.equal(entries[0].kind, 'Walk')
    assert.ok(entries[0].distance > 0.11 && entries[0].distance < 0.15, `distance ${entries[0].distance}`)
    assert.ok(entries[0].route.length >= 10, 'the route is saved with the entry')
    assert.equal(entries[0].minutes, 1)
    assert.deepEqual(errors, [], 'no errors on the page')
    console.log(`cardio e2e passed: ${entries[0].distance} mi over ${entries[0].route.length} points`)
  } finally {
    await browser.close()
    server.kill()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
