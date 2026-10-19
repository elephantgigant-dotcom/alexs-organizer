// Category colors: 8 slots of the validated chart palette, in a fixed order
// (light and dark steps live in index.css as --c1 … --c8).
// A category stores its slot number (1–8), never a hex, so dark mode gets its own step.

export const COLOR_SLOTS = [
  { slot: 1, label: 'Blue' },
  { slot: 2, label: 'Orange' },
  { slot: 3, label: 'Aqua' },
  { slot: 4, label: 'Yellow' },
  { slot: 5, label: 'Pink' },
  { slot: 6, label: 'Green' },
  { slot: 7, label: 'Violet' },
  { slot: 8, label: 'Red' },
]

export function slotColor(slot) {
  return `var(--c${slot >= 1 && slot <= 8 ? slot : 1})`
}

export const DEFAULT_CATEGORIES = [
  { name: 'Learning', color: 1, order: 0 },
  { name: 'Self-development', color: 3, order: 1 },
  { name: 'Health', color: 6, order: 2 },
  { name: 'Work', color: 7, order: 3 },
  { name: 'Personal', color: 2, order: 4 },
]

// The next free slot for a new category (fixed order, never a generated color)
export function nextSlot(categories) {
  const used = new Set(categories.map((c) => c.color))
  return COLOR_SLOTS.find((s) => !used.has(s.slot))?.slot || ((categories.length % 8) + 1)
}
