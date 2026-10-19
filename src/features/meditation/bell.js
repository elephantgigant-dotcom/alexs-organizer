// A soft bell, made with Web Audio (no sound file to download).
// Browsers only allow sound after a tap, so unlockBell() is called from the Start button.

let ctx = null

export function unlockBell() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
  } catch {
    ctx = null
  }
}

export function playBell() {
  if (!ctx) unlockBell()
  if (!ctx) return
  const now = ctx.currentTime
  const out = ctx.createGain()
  out.gain.value = 0.25
  out.connect(ctx.destination)
  // A few slightly inharmonic partials with long, gentle decays sound like a small bowl
  for (const [freq, level, decay] of [
    [528, 1, 4.5],
    [1056 * 1.01, 0.35, 3],
    [1584 * 0.99, 0.18, 2],
    [264, 0.25, 5],
  ]) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(level, now + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, now + decay)
    osc.connect(g).connect(out)
    osc.start(now)
    osc.stop(now + decay + 0.1)
  }
  navigator.vibrate?.(200)
}
