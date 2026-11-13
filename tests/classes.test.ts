import { describe, expect, it } from 'vitest'
import { beatAt, calisthenics, classSeconds, classes, missingFor, timeline } from '../src/lib/classes'
import { hasExercise } from '../src/lib/exercises'
import { gymsOf, homeGym } from '../src/lib/gym'

describe('classes', () => {
  it('every pose has a picture and a cue', () => {
    expect(classes.length).toBeGreaterThan(0)
    for (const c of classes) for (const s of c.steps) {
      expect(s.image, `${c.id} ${s.name}`).toBeTruthy()
      expect(s.cue.length, `${c.id} ${s.name}`).toBeGreaterThan(10)
    }
  })
  it('walks through the timeline in order and ends', () => {
    const c = classes[0]
    const beats = timeline(c)
    expect(beatAt(beats, 0)!.index).toBe(0)
    expect(beatAt(beats, 0)!.phase).toBe('ready')
    const mid = beatAt(beats, beats[1].at + 6)!
    expect(mid.index).toBe(1)
    expect(mid.phase).toBe('hold')
    expect(beatAt(beats, classSeconds(c) + 1)!.phase).toBe('done')
  })
  it('two-sided poses appear once per side', () => {
    const c = classes.find((x) => x.steps.some((s) => s.side))!
    expect(timeline(c).length).toBeGreaterThan(c.steps.length)
  })
  it('calisthenics presets only use exercises that exist', () => {
    for (const c of calisthenics) for (const l of c.lifts) expect(hasExercise(l.key), l.key).toBe(true)
  })
  it('older saved places are assumed to have a mat and bars', () => {
    const old = { ...homeGym(), equipment: ['barbell', 'dumbbell'] }
    const [g] = gymsOf({ gyms: [old] } as never)
    expect(g.equipment).toContain('mat')
    expect(missingFor({ needs: ['mat'] }, g)).toEqual([])
    const said = gymsOf({ gyms: [{ ...old, extras: true }] } as never)[0]
    expect(missingFor({ needs: ['mat'] }, said)).toEqual(['mat'])
  })
})
