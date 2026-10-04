import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type AccuracyPoint = {
  attempts: number
  accuracy: number
}

export function AccuracyChart({ points }: { points: AccuracyPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points} margin={{ top: 8, right: 15, bottom: 0, left: -16 }} accessibilityLayer={false}>
        <CartesianGrid stroke="var(--line)" strokeDasharray="3 4" vertical={false} />
        <XAxis dataKey="attempts" tickFormatter={(attempt) => `#${attempt}`} tickLine={false} axisLine={false} minTickGap={18} />
        <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(accuracy) => `${accuracy}%`} tickLine={false} axisLine={false} width={48} />
        <Tooltip
          labelFormatter={(attempt) => `Attempt ${attempt}`}
          formatter={(accuracy) => [`${Number(accuracy).toFixed(1)}%`, 'Accuracy']}
          contentStyle={{ border: '1px solid var(--line)', borderRadius: 3, fontSize: 12 }}
        />
        <Line type="monotone" dataKey="accuracy" stroke="var(--moss)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--coral)', strokeWidth: 0 }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
