// Phone-size end-to-end check of a whole workout, including going offline
// partway through and reloading. Run `npm run build` first, then:
//   PLAYWRIGHT_PATH=/path/to/playwright node tests/e2e/workout.e2e.cjs
const { spawn } = require('node:child_process')
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? 'playwright')

const PORT = 4174
const URL = `http://localhost:${PORT}`
const shot = process.env.SHOT_DIR

async function main() {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
  await new Promise((r) => setTimeout(r, 2500))
  const browser = await chromium.launch()
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    // The test has no server to sync with. Every request to Supabase fails, as it would with no signal.
    await context.route('**/*.supabase.co/**', (route) => route.abort())
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))

    await page.goto(URL)
    await page.evaluate(() => localStorage.setItem('gg.user', JSON.stringify({ id: '00000000-0000-0000-0000-000000000001', email: 'test@example.com' })))
    await page.reload()
    await page.getByRole('button', { name: 'Start workout' }).click()
    await page.waitForURL('**/session')
    await page.getByRole('heading', { name: 'Barbell back squat' }).waitFor()

    // Enter a weight that cannot be loaded and check it snaps to one that can.
    await page.getByRole('button', { name: /^Weight/ }).first().click()
    for (const k of ['1', '3', '6']) await page.getByRole('dialog').getByRole('button', { name: k, exact: true }).click()
    await page.getByText("136 lb can't be loaded").waitFor()
    await page.getByRole('button', { name: 'Next: reps' }).click()
    await page.getByRole('dialog').getByRole('button', { name: '9', exact: true }).click()
    if (shot) await page.screenshot({ path: `${shot}/e2e-pad.png` })
    await page.getByRole('dialog').getByRole('button', { name: 'Done', exact: true }).click()
    await page.getByText('Per side: 45 on the 45 lb bar').waitFor()

    // Tick off set 1: the rest timer starts.
    await page.getByRole('button', { name: 'Mark set done' }).first().click()
    await page.getByRole('timer').waitFor()
    if (shot) await page.screenshot({ path: `${shot}/e2e-session.png` })
    await page.getByRole('button', { name: 'Skip' }).click()

    // Lose the connection, then close and reopen the app mid-workout.
    await page.evaluate(() => navigator.serviceWorker.ready) // the app shell has finished caching
    await context.setOffline(true)
    await page.getByRole('button', { name: 'Mark set done' }).first().click()
    await page.getByRole('button', { name: 'Skip' }).click()
    await page.reload().catch(() => undefined) // the service worker serves the app shell offline
    await page.getByRole('heading', { name: 'Barbell back squat' }).waitFor({ timeout: 15000 })
    assert.equal(await page.getByRole('button', { name: 'Mark set not done' }).count(), 2, 'both logged sets survive an offline restart')

    // The resume bar appears on other screens.
    await page.getByRole('link', { name: 'Minimize workout' }).click()
    await page.getByText('WORKOUT IN PROGRESS').waitFor()
    await page.getByText('WORKOUT IN PROGRESS').click()

    // Finish with sets left over: they are dropped, the two done sets are kept.
    await page.getByRole('button', { name: 'Finish', exact: true }).click()
    await page.getByRole('button', { name: 'Finish workout' }).click()
    await page.waitForURL('**/done/**')
    await page.getByText('Workout complete').waitFor()
    if (shot) await page.screenshot({ path: `${shot}/e2e-done.png` })
    await page.getByRole('button', { name: 'Effort 4' }).click()
    await page.getByRole('button', { name: 'Save workout' }).click()

    // Back on Today: one workout this week, and the rotation has moved to Day B.
    await page.getByText('Next up · Day B').waitFor()
    await page.getByText('1 of 4 workouts').waitFor()

    // Progress and history reflect the workout.
    await page.getByRole('link', { name: 'Progress', exact: true }).click()
    await page.getByText('1 of 4', { exact: true }).waitFor()
    await page.getByText('Barbell back squat · estimated max').waitFor()
    if (shot) await page.screenshot({ path: `${shot}/e2e-progress.png`, fullPage: false })
    await page.getByRole('link', { name: 'Workout history (1)' }).click()
    await page.getByText('Legs & Lower Back').click()
    await page.getByRole('button', { name: '135 × 9' }).waitFor()
    if (shot) await page.screenshot({ path: `${shot}/e2e-history.png` })

    // Cardio on the Log tab counts toward the weekly target.
    await page.getByRole('link', { name: 'Log', exact: true }).click()
    await page.getByRole('button', { name: '+ Add' }).click()
    await page.getByRole('button', { name: 'Minutes' }).click()
    for (const k of ['3', '0']) await page.getByRole('dialog').last().getByRole('button', { name: k, exact: true }).click()
    await page.getByRole('dialog').last().getByRole('button', { name: 'Done', exact: true }).click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.waitForFunction(() => document.body.innerText.includes('30 of 150 minutes this week'), null, { timeout: 5000 })
    if (shot) await page.screenshot({ path: `${shot}/e2e-log.png` })

    // Program editor: move Calves to the top of Day A and check the next Day A workout follows it.
    await page.goto(`${URL}/settings/program`)
    await page.getByRole('heading', { name: 'My program' }).waitFor()
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Move Calves up' }).click()
    // Leave through the app's own navigation, as a person would, so the last save is not cut off by a page load.
    await page.getByRole('button', { name: 'Move Calves up' }).isDisabled()
    await page.waitForFunction(() => document.querySelector('button[aria-label="Move Calves up"]')?.hasAttribute('disabled'))
    await page.waitForTimeout(400)
    if (shot) await page.screenshot({ path: `${shot}/e2e-editor.png` })
    await page.goto(`${URL}/workout/A`)
    await page.getByText('Accessories', { exact: true }).waitFor()
    const firstAccessory = await page.locator('section', { hasText: 'Accessories' }).locator('a').first().innerText()
    assert.match(firstAccessory, /calf raise/i, 'the reordered slot comes first')
    await page.goto(URL)

    // The Us tab lists the workout in the activity feed.
    await page.getByRole('link', { name: 'Us', exact: true }).click()
    await page.getByText('finished Legs & Lower Back').waitFor()
    await page.getByText('of 4 workouts', { exact: true }).waitFor()
    if (shot) await page.screenshot({ path: `${shot}/e2e-us.png` })

    const stored = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const open = indexedDB.open('garage-gym')
          open.onsuccess = () => {
            const tx = open.result.transaction(['sets', 'outbox', 'workout_sessions'])
            const all = (name) => new Promise((r) => (tx.objectStore(name).getAll().onsuccess = (e) => r(e.target.result)))
            Promise.all([all('sets'), all('outbox'), all('workout_sessions')]).then(([sets, outbox, sessions]) => resolve({ sets, outbox, sessions }))
          }
        }),
    )
    const done = stored.sets.filter((s) => s.done && !s.deleted)
    assert.equal(done.length, 2, 'exactly the two ticked sets are recorded')
    assert.deepEqual(done.map((s) => s.weight), [135, 135], 'the typed 136 was saved as a loadable 135')
    assert.equal(new Set(stored.sets.map((s) => s.id)).size, stored.sets.length, 'no duplicate sets')
    assert.equal(stored.sessions.length, 1)
    assert.ok(stored.sessions[0].finished_at && stored.sessions[0].effort === 4)
    assert.equal(stored.outbox.filter((o) => o.table === 'sets').length, stored.sets.length, 'every set is queued for upload exactly once')
    assert.deepEqual(errors, [], 'no page errors')
    console.log('workout e2e passed:', done.length, 'sets recorded,', stored.outbox.length, 'changes waiting to sync')
  } finally {
    await browser.close()
    server.kill()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
