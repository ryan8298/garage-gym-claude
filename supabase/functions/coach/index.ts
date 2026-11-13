// The AI coach. The app sends the person's question and a summary of their
// training; this function asks Claude and returns a reply plus any proposed
// program changes, already checked against what we can actually do.
// The Anthropic API key lives only here, as the ANTHROPIC_API_KEY secret.
import Anthropic from 'npm:@anthropic-ai/sdk@1.8.0'
import { zodOutputFormat } from 'npm:@anthropic-ai/sdk@1.8.0/helpers/zod'
import { z } from 'npm:zod@4'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { sanitize, type CoachContext } from './rules.ts'

/** Change the model by setting a COACH_MODEL secret. */
const MODEL = Deno.env.get('COACH_MODEL') ?? 'claude-opus-5-5'
const DAILY_LIMIT = 30

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const Output = z.object({
  reply: z.string(),
  proposals: z.array(
    z.object({
      kind: z.enum(['swap_main', 'lock_slot', 'ban_exercise', 'reorder_slots']),
      day: z.enum(['A', 'B', 'C', 'D']).nullable(),
      target: z.string().nullable(),
      exercise_key: z.string().nullable(),
      order: z.array(z.string()).nullable(),
      reason: z.string(),
    }),
  ),
  quick_workout: z
    .object({
      title: z.string(),
      lifts: z.array(z.object({ exercise_key: z.string(), sets: z.number().int(), low: z.number().int(), high: z.number().int() })),
    })
    .nullable(),
})

const INSTRUCTIONS = `You are the strength coach inside Garage Gym, a private workout app used by two people who train together in a home garage: a RitFit M1 Pro (Smith bar, two plate-loaded cables, landmine, pull-up bar, dip handles), a 45 lb barbell, an adjustable bench and dumbbells from 5 to 50 lb. Each message comes from one of them, with their name and a summary of their own training data.

Their goals are to lose fat, get stronger and build visible muscle. They are returning to training after time away.

How the app works, so your advice fits it:
- Four workouts rotate in order: A Legs & Lower Back, B Arms, Upper Back & Shoulders, C Core & Cardio, D Full Body. They aim for 3 or 4 a week.
- Each day has two main lifts that stay the same for months, then accessory slots, then a short core finisher. A slot is a role (for example "Calves") filled from a small pool of exercises that rotates every few weeks.
- Training runs in 4-week blocks that cycle Foundation, Build, Strength. The app sets how many accessories each session gets and schedules a lighter week every eighth week.
- The app suggests weight and reps for every set from last time's numbers (add reps to the top of the range, then add the smallest loadable weight). You do not set weights set by set. You explain, spot patterns, and recommend changes to the program.
- Weekly targets the app tracks: their workout count, about 10 hard sets per muscle group, and 150 minutes of cardio.

Changing the program:
When you recommend a change the app can make, put it in "proposals". The person sees each one as a card and accepts or rejects it; nothing changes until they accept. The app throws away any proposal that names an exercise outside the library below, or puts an exercise where it does not belong, so use only exercise keys, main lift ids and slot roles exactly as they appear in the library and program below. The kinds are:
- swap_main: replace a main lift. Give day, target (the main lift id, such as "A1") and exercise_key (one of that main lift's options).
- lock_slot: fix an accessory or finisher slot to one exercise instead of rotating. Give day, target (the slot role) and exercise_key (one from that slot's pool).
- ban_exercise: remove an exercise from the rotation everywhere. Give exercise_key.
- reorder_slots: change a day's accessory priority. Give day and order (every reorderable slot role of that day, once each, most important first). Short sessions only use the top three.
Give each proposal a one-sentence reason in plain words. Leave proposals empty when you are only answering a question.

One-off workouts:
If they ask for a session for today (short on time, travelling, want something different), put it in "quick_workout": a title and 3 to 8 lifts from the library, each with sets and a rep range (for timed holds, low and high are seconds). Otherwise quick_workout is null.

How to answer:
- "reply" is read on a phone between sets, so make it scannable, not an essay. Start with one sentence that gives the answer. Then, if there is more to say, give up to four bullet lines, each starting with "- " and a two-or-three-word label in **double asterisks**, then one short sentence. No headings, tables, numbered lists or other markdown.
- Length: about 60 words for a question, 50 for a post-workout debrief, 110 for a weekly review. Never more than five bullets. A simple question can be answered in one or two sentences with no bullets.
- Do not repeat in the reply what a proposal card or workout card already shows; point to it in a few words.
- Be specific. Use their actual numbers and exercise names from the data. If the data does not show something, say so instead of guessing; in the first weeks there is little history.
- If you mention a weight, use one they can load. The "loading" note in their data says what steps are possible.
- Talk like a knowledgeable training partner: direct, encouraging without hype, no lectures.

Limits:
- You are not a doctor. If they mention pain or a possible injury, tell them to stop that movement for now, offer a gentler alternative from the library, and suggest seeing a professional if it persists. Do not diagnose.
- The app does not track food. You can say that fat loss depends on eating less than they burn, but do not prescribe diets, calorie targets or supplements.
- Ab exercises build the abdominal muscles; they do not burn belly fat. Say so plainly if it comes up.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: auth } = await admin.auth.getUser(token)
    const user = auth?.user
    if (!user) return json({ error: 'Sign in again to use the coach.' }, 401)

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) return json({ error: 'The coach is not set up yet: no API key has been added.' }, 503)

    const raw = await req.text()
    if (raw.length > 300_000) return json({ error: 'That request was too large.' }, 413)
    const body = JSON.parse(raw) as {
      mode: 'chat' | 'debrief' | 'weekly'
      message?: string
      name?: string
      history?: { role: 'user' | 'coach'; text: string }[]
      context: CoachContext
      data: unknown
    }
    if (!['chat', 'debrief', 'weekly'].includes(body.mode) || !body.context?.catalog?.length) return json({ error: 'Bad request.' }, 400)

    // Daily limit, counted on the server.
    const day = new Date().toISOString().slice(0, 10)
    const { data: usage } = await admin.from('coach_usage').select('messages, input_tokens, output_tokens').eq('user_id', user.id).eq('day', day).maybeSingle()
    if ((usage?.messages ?? 0) >= DAILY_LIMIT) return json({ error: `You have used all ${DAILY_LIMIT} coach messages for today. It resets at midnight UTC.` }, 429)

    const task =
      body.mode === 'debrief'
        ? 'I just finished the workout shown as "latest_workout" in my data. Give me a debrief: what went well, what stalled, and one thing to do next time.'
        : body.mode === 'weekly'
          ? 'Review my last 7 days against my plan and goals, and tell me the one or two changes you would make, if any.'
          : (body.message ?? '').slice(0, 2000)
    if (!task.trim()) return json({ error: 'Type a question first.' }, 400)

    // Earlier turns, as alternating user and assistant messages starting with the user.
    const messages: { role: 'user' | 'assistant'; content: string }[] = []
    for (const h of (body.history ?? []).slice(-10)) {
      const role = h.role === 'coach' ? 'assistant' : 'user'
      if (messages.length === 0 && role === 'assistant') continue
      if (messages.length && messages[messages.length - 1].role === role) continue
      messages.push({ role, content: h.text.slice(0, 4000) })
    }
    if (messages.length && messages[messages.length - 1].role === 'user') messages.pop()
    messages.push({
      role: 'user',
      content: `My name is ${body.name || 'not set'}.\n\n<my_equipment>${JSON.stringify(body.context.equipment)}</my_equipment>\n\n<my_training_data>\n${JSON.stringify(body.data)}\n</my_training_data>\n\n${task}`,
    })

    // The instructions, library and program are identical for every request, so they are cached.
    const system = `${INSTRUCTIONS}\n\n<exercise_library>\n${JSON.stringify(body.context.catalog)}\n</exercise_library>\n\n<program>\n${JSON.stringify(body.context.program)}\n</program>`

    const client = new Anthropic({ apiKey })
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages,
      output_config: { effort: 'medium', format: zodOutputFormat(Output) },
    })

    const used = response.usage
    await admin.from('coach_usage').upsert({
      user_id: user.id,
      day,
      messages: (usage?.messages ?? 0) + 1,
      input_tokens: Number(usage?.input_tokens ?? 0) + used.input_tokens + (used.cache_creation_input_tokens ?? 0) + (used.cache_read_input_tokens ?? 0),
      output_tokens: Number(usage?.output_tokens ?? 0) + used.output_tokens,
    })

    if (response.stop_reason === 'refusal' || !response.parsed_output) {
      return json({ reply: 'I could not answer that one. Try asking it a different way.', proposals: [], quick_workout: null, used: (usage?.messages ?? 0) + 1, limit: DAILY_LIMIT })
    }
    const clean = sanitize(response.parsed_output, body.context)
    return json({ reply: clean.reply, proposals: clean.proposals, quick_workout: clean.quick_workout, dropped: clean.dropped, used: (usage?.messages ?? 0) + 1, limit: DAILY_LIMIT })
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return json({ error: "The coach's API key was rejected. Check it in the Supabase dashboard." }, 502)
    if (err instanceof Anthropic.RateLimitError) return json({ error: 'The coach is busy right now. Try again in a minute.' }, 503)
    if (err instanceof Anthropic.APIError) return json({ error: `The coach could not answer (${err.status ?? 'error'}). Try again.` }, 502)
    return json({ error: 'The coach could not answer. Try again.' }, 500)
  }
})
