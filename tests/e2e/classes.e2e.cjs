// Other workouts: a follow-along session plays pose by pose and saves, and a calisthenics workout starts like any other.
// Run `npm run build` first, then:
//   PLAYWRIGHT_PATH=/path/to/playwright node tests/e2e/classes.e2e.cjs
const { spawn } = require('node:child_process')
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? 'playwright')

const PORT = 4189
const URL = `http://localhost:${PORT}`
const shot = process.env.SHOT_DIR

async function main() {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
  await new Promise((r) => setTimeout(r, 2500))
  const browser = await chromium.launch()
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    await context.route('**/*.supabase.co/**', (route) => route.abort())
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto(URL)
    await page.evaluate(() => localStorage.setItem('gg.user', JSON.stringify({ id: '00000000-0000-0000-0000-000000000001', email: 'test@example.com' })))
    await page.goto(`${URL}/classes`)
    await page.getByRole('heading', { name: 'Other workouts' }).waitFor()
    if (shot) await page.screenshot({ path: `${shot}/classes.png`, fullPage: true })

    await page.getByRole('link', { name: /Whole-body loosen up/ }).click()
    await page.waitForURL('**/classes/*')
    await page.getByText('Photo credits', { exact: false }).or(page.getByText('sec', { exact: false }).first()).first().waitFor()
    await page.getByRole('button', { name: 'Start', exact: true }).waitFor()
    const broken = await page.evaluate(async () => {
      const imgs = [...document.images]
      await Promise.all(imgs.map((i) => (i.loading = 'eager', i.decode().catch(() => {}))))
      return imgs.filter((i) => !i.naturalWidth).length
    })
    assert.equal(broken, 0, 'every pose picture loads')
    if (shot) await page.screenshot({ path: `${shot}/class-intro.png`, fullPage: true })
    await page.getByRole('button', { name: 'Start', exact: true }).click()
    await page.getByRole('timer').waitFor()
    await page.getByText('Pose 1 of').waitFor()
    await page.getByText('Get into position').waitFor()
    await page.getByText('Hold', { exact: false }).first().waitFor({ timeout: 9000 })
    if (shot) await page.screenshot({ path: `${shot}/class-play.png` })

    // Pause holds the clock still.
    await page.getByRole('button', { name: 'Pause' }).click()
    const before = await page.getByRole('timer').innerText()
    await page.waitForTimeout(1500)
    assert.equal(await page.getByRole('timer').innerText(), before)
    await page.getByRole('button', { name: 'Resume' }).click()

    // Skip through to the end and save.
    for (let i = 0; i < 40; i++) {
      if (await page.getByText('Session complete').count()) break
      await page.getByRole('button', { name: 'Next pose' }).click()
    }
    await page.getByText('Session complete').waitFor()
    await page.getByRole('button', { name: 'Save to my history' }).click()
    await page.waitForURL('**/done/*')
    if (shot) await page.screenshot({ path: `${shot}/class-done.png` })

    const read = (store) =>
      page.evaluate(
        (s) =>
          new Promise((resolve) => {
            const open = indexedDB.open('garage-gym')
            open.onsuccess = () => (open.result.transaction([s]).objectStore(s).getAll().onsuccess = (e) => resolve(e.target.result))
          }),
        store,
      )
    let sessions = await read('workout_sessions')
    assert.equal(sessions.length, 1)
    assert.ok(sessions[0].finished_at, 'the class is saved as finished')

    // A calisthenics workout opens the normal workout screen with its moves queued.
    await page.goto(`${URL}/classes`)
    await page.getByRole('button', { name: 'Start', exact: true }).first().click()
    await page.waitForURL('**/session')
    await page.waitForFunction(() => /push/i.test(document.body.innerText))
    if (shot) await page.screenshot({ path: `${shot}/cali.png` })
    sessions = await read('workout_sessions')
    assert.equal(sessions.length, 2)
    const lifts = await read('session_exercises').catch(() => [])
    assert.deepEqual(errors, [], 'no errors on the page')
    console.log(`classes e2e passed: ${sessions.length} sessions, ${lifts.length} queued moves`)
  } finally {
    await browser.close()
    server.kill()
  }
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
