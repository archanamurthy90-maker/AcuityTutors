type ProgressTopic = {
  subjectName: string
  topicName: string
  points: Array<{ attempts: number; accuracy: number }>
}

const formatPercent = (value: number) => `${value.toFixed(1).replace(/\.0$/, '')}%`

// Plain-language summary of a topic's accuracy trend, shown above the chart (text alternative).
export function describeProgress(topic: ProgressTopic) {
  const first = topic.points[0]
  const last = topic.points[topic.points.length - 1]
  const change = last.accuracy - first.accuracy
  const trend = Math.abs(change) < 0.05 ? 'unchanged from' : change > 0 ? `up ${formatPercent(change)} from` : `down ${formatPercent(Math.abs(change))} from`
  const attempts = `${last.attempts} ${last.attempts === 1 ? 'attempt' : 'attempts'}`
  return `${topic.subjectName} · ${topic.topicName}: ${formatPercent(last.accuracy)} accuracy after ${attempts}, ${trend} ${formatPercent(first.accuracy)} after the first attempt.`
}
