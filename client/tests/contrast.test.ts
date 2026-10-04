import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// WCAG 2.1 relative luminance and contrast ratio.
function luminance(hex: string) {
  const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
  const [r, g, b] = channels.map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contrast(foreground: string, background: string) {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (light + 0.05) / (dark + 0.05)
}

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8') + readFileSync(new URL('../src/App.css', import.meta.url), 'utf8')
const token = (name: string) => {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(css)
  if (!match) throw new Error(`Missing --${name}`)
  return match[1]
}

// Every background that body or caption text sits on.
const textBackgrounds = ['#f7f8f3', '#ffffff', '#f0f3ec', '#eff4ed', '#f8f8f3', '#fbfcf8', '#f1f2ef', '#fbf7e9', '#fbefec', '#eff6ef', '#f1f5ef', '#fdfdfa', '#fafbf7']

describe('A11Y: colour contrast of the design tokens', () => {
  it('muted text is at least 4.5:1 on every background it is used on', () => {
    for (const background of textBackgrounds) expect(contrast(token('muted'), background), background).toBeGreaterThanOrEqual(4.5)
  })

  it('primary text, coral text, and button text meet 4.5:1', () => {
    expect(contrast(token('ink'), token('paper'))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(token('coral-text'), '#f8f8f3')).toBeGreaterThanOrEqual(4.5)
    expect(contrast(token('moss'), '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(contrast('#ffffff', token('moss'))).toBeGreaterThanOrEqual(4.5)
  })

  it('mastery status badges meet 4.5:1', () => {
    const badges: Array<[string, string]> = [['#315f4a', '#eff6ef'], ['#87692b', '#fbf7e9'], ['#974e43', '#fbefec'], ['#667064', '#f1f2ef']]
    for (const [foreground, background] of badges) expect(contrast(foreground, background), foreground).toBeGreaterThanOrEqual(4.5)
  })

  it('form control borders and the focus outline meet the 3:1 non-text minimum', () => {
    expect(contrast(token('line-input'), '#fdfdfa')).toBeGreaterThanOrEqual(3)
    for (const background of ['#f7f8f3', '#ffffff']) expect(contrast(token('focus'), background)).toBeGreaterThanOrEqual(3)
  })

  it('no hard-coded low-contrast grey text remains', () => {
    for (const legacy of ['#737b72', '#8b9087', '#838a81']) expect(css.includes(legacy), legacy).toBe(false)
  })
})
