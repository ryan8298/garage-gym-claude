// Two people, one phone: a shared workout takes turns and saves a session for each.
// Run `npm run build` first, then:
//   PLAYWRIGHT_PATH=/path/to/playwright node tests/e2e/together.e2e.cjs
const { spawn } = require('node:child_process')
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? 'playwright')

const PORT = 4177
const URL = `http://localhost:${PORT}`
const shot = process.env.SHOT_DIR
const ME = '00000000-0000-0000-0000-000000000001'
const PARTNER = '00000000-0000-0000-0000-000000000002'

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
    await page.evaluate((me) => localStorage.setItem('gg.user', JSON.stringify({ id: me, email: 'test@example.com' })), ME)
    await page.reload()
    await page.getByRole('button', { name: 'Start workout' }).waitFor()
    // Both people exist on this phone, as they do after a sync.
    await page.evaluate(
      ([me, partner]) =>
        new Promise((resolve) => {
          const open = indexedDB.open('garage-gym')
          open.onsuccess = () => {
            const tx = open.result.transaction(['profiles'], 'readwrite')
            const now = new Date().toISOString()
            tx.objectStore('profiles').put({ id: me, display_name: 'Ryan', weekly_target: 4, step_target: 8000, updated_at: now, deleted: false })
            tx.objectStore('profiles').put({ id: partner, display_name: 'Stella', weekly_target: 4, step_target: 8000, updated_at: now, deleted: false })
            tx.oncomplete = resolve
          }
        }),
      [ME, PARTNER],
    )
    await page.reload()
    await page.getByText('Training with Stella').waitFor()
    if (shot) await page.screenshot({ path: `${shot}/pair-today.png` })
    await page.getByRole('button', { name: 'Start workout together' }).click()
    await page.waitForURL('**/session')
    const turn = (name) => page.getByRole('group', { name: 'Whose turn' }).getByRole('button', { name: new RegExp(name), pressed: true })
    await turn('Ryan').waitFor()

    const enter = async (digits, reps) => {
      await page.getByRole('button', { name: /^Weight/ }).first().click()
      for (const k of digits) await page.getByRole('dialog').getByRole('button', { name: k, exact: true }).click()
      await page.getByRole('button', { name: 'Next: reps' }).click()
      await page.getByRole('dialog').getByRole('button', { name: reps, exact: true }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'Done', exact: true }).click()
    }
    // Ryan lifts, then it is Stella's turn with her own numbers, then the rest starts.
    await enter(['1', '3', '5'], '8')
    await page.getByRole('button', { name: 'Mark set done' }).first().click()
    await turn('Stella').waitFor()
    assert.equal(await page.getByRole('timer').count(), 0, 'no rest until both have gone')
    await page.getByRole('heading', { name: 'Barbell back squat' }).waitFor()
    await enter(['6', '5'], '9')
    if (shot) await page.screenshot({ path: `${shot}/pair-session.png` })
    await page.getByRole('button', { name: 'Mark set done' }).first().click()
    await turn('Ryan').waitFor()
    await page.getByRole('timer').waitFor()
    await page.getByRole('button', { name: 'Skip' }).click()

    await page.getByRole('button', { name: 'Finish', exact: true }).click()
    await page.getByText('Finish both workouts?').waitFor()
    await page.getByRole('button', { name: 'Finish workout' }).click()
    await page.waitForURL('**/done/**')
    await page.getByText("Your partner's workout was saved").waitFor()

    const stored = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const open = indexedDB.open('garage-gym')
          open.onsuccess = () => {
            const tx = open.result.transaction(['sets', 'workout_sessions', 'program_state'])
            const all = (name) => new Promise((r) => (tx.objectStore(name).getAll().onsuccess = (e) => r(e.target.result)))
            Promise.all([all('sets'), all('workout_sessions'), all('program_state')]).then(([sets, sessions, programs]) => resolve({ sets, sessions, programs }))
          }
        }),
    )
    assert.equal(stored.sessions.length, 2, 'one session each')
    assert.equal(stored.sessions[0].pair_id, stored.sessions[1].pair_id)
    assert.ok(stored.sessions[0].pair_id)
    assert.ok(stored.sessions.every((s) => s.finished_at), 'both are finished')
    const done = (id) => stored.sets.filter((s) => s.user_id === id && s.done && !s.deleted).map((s) => [s.weight, s.reps])
    assert.deepEqual(done(ME), [[135, 8]], "Ryan's set is in his account")
    assert.deepEqual(done(PARTNER), [[65, 9]], "Stella's set is in hers")
    assert.deepEqual(stored.programs.map((p) => p.data.queueIndex).sort(), [1, 1], "both rotations moved on")
    assert.deepEqual(errors, [], 'no errors on the page')
    console.log('together e2e passed: two linked sessions, one set each')
  } finally {
    await browser.close()
    server.kill()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
