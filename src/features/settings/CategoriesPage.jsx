// Areas of life: add, rename, recolor, reorder, delete.

import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useData } from '../../app/DataContext.jsx'
import { COLOR_SLOTS, nextSlot, slotColor } from '../../lib/colors.js'
import { addCategory, deleteCategory, updateCategory } from '../../services/categories.js'
import { Button, Card, IconButton, PageTitle, TextField } from '../../ui/basics.jsx'
import { Icon } from '../../ui/Icons.jsx'
import { ConfirmSheet, Sheet } from '../../ui/Sheet.jsx'

export function CategoriesPage() {
  const { uid, categories } = useData()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(null) // category or { new: true }
  const [confirm, setConfirm] = useState(null)

  async function move(i, dir) {
    const a = categories[i]
    const b = categories[i + dir]
    if (!b) return
    await Promise.all([updateCategory(uid, a.id, { order: b.order }), updateCategory(uid, b.id, { order: a.order })])
  }

  return (
    <div className="flex flex-col gap-5">
      <PageTitle right={<IconButton label="Back" icon="back" onClick={() => navigate('/more')} />}>Areas of life</PageTitle>
      <Card className="overflow-hidden p-0">
        {categories.map((c, i) => (
          <div key={c.id} className={`flex min-h-14 items-center gap-2 pl-4 pr-2 ${i ? 'border-t border-line' : ''}`}>
            <span className="size-3 shrink-0 rounded-full" style={{ background: slotColor(c.color) }} aria-hidden="true" />
            <button type="button" onClick={() => setEditing(c)} className="h-14 min-w-0 flex-1 truncate text-left text-base font-semibold">
              {c.name}
            </button>
            <button type="button" aria-label={`Move ${c.name} up`} disabled={i === 0} onClick={() => move(i, -1)} className="grid size-11 place-items-center text-muted disabled:opacity-30">
              <Icon name="up" size={20} />
            </button>
            <button type="button" aria-label={`Move ${c.name} down`} disabled={i === categories.length - 1} onClick={() => move(i, 1)} className="grid size-11 place-items-center text-muted disabled:opacity-30">
              <Icon name="down" size={20} />
            </button>
            <button type="button" aria-label={`Delete ${c.name}`} onClick={() => setConfirm(c)} className="grid size-11 place-items-center text-muted">
              <Icon name="trash" size={20} />
            </button>
          </div>
        ))}
      </Card>
      <Button variant="outline" onClick={() => setEditing({ new: true })}>
        + Add an area
      </Button>

      {editing && (
        <CategorySheet
          category={editing}
          onClose={() => setEditing(null)}
          onSave={async ({ name, color }) => {
            if (editing.new) await addCategory(uid, { name, color, order: Math.max(-1, ...categories.map((c) => c.order ?? 0)) + 1 })
            else await updateCategory(uid, editing.id, { name: name.trim(), color })
            setEditing(null)
          }}
          defaultColor={nextSlot(categories)}
        />
      )}
      <ConfirmSheet
        open={!!confirm}
        title={`Delete "${confirm?.name}"?`}
        text="Tasks in this area stay; they just show no area."
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          await deleteCategory(uid, confirm.id)
          setConfirm(null)
        }}
        onClose={() => setConfirm(null)}
      />
    </div>
  )
}

function CategorySheet({ category, onClose, onSave, defaultColor }) {
  const [name, setName] = useState(category.name || '')
  const [color, setColor] = useState(category.color || defaultColor)
  return (
    <Sheet
      open
      compact
      onClose={onClose}
      title={category.new ? 'New area' : 'Edit area'}
      footer={
        <Button className="w-full" disabled={!name.trim()} onClick={() => onSave({ name, color })}>
          Save
        </Button>
      }
    >
      <div className="flex flex-col gap-5 pt-2">
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={40} />
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-2 p-0 text-[13px] font-semibold text-muted">Color</legend>
          <div className="grid grid-cols-4 gap-2">
            {COLOR_SLOTS.map((s) => (
              <button
                key={s.slot}
                type="button"
                aria-pressed={color === s.slot}
                onClick={() => setColor(s.slot)}
                className={`flex h-12 items-center gap-2 rounded-[14px] border px-3 text-sm font-semibold ${color === s.slot ? 'border-accent ring-2 ring-accent' : 'border-line'} bg-surface`}
              >
                <span className="size-4 rounded-full" style={{ background: slotColor(s.slot) }} aria-hidden="true" />
                {s.label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    </Sheet>
  )
}
