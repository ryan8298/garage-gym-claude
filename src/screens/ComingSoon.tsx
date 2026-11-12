import { Card, Label } from '../components/ui'

export function ComingSoon({ title, phase, what }: { title: string; phase: number; what: string }) {
  return (
    <div className="flex flex-col gap-3 px-5 pt-3">
      <h1 className="font-display text-[28px] font-bold tracking-[-0.5px]">{title}</h1>
      <Card className="flex flex-col gap-2">
        <Label>Built in phase {phase}</Label>
        <p className="text-[15px] leading-relaxed text-muted">{what}</p>
      </Card>
    </div>
  )
}
