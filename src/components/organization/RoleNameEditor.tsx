'use client'

import { useState, type KeyboardEvent } from 'react'
import { Pencil } from 'lucide-react'
import { updateOrganizationRoleAction } from '@/app/actions'
import { Input } from '@/components/ui'

function submitOnEnter(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key !== 'Enter') return
  event.preventDefault()
  event.currentTarget.form?.requestSubmit()
}

export function RoleNameEditor({
  roleId,
  initialName,
  permissions,
}: {
  roleId: string
  initialName: string
  permissions: string[]
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(initialName)

  return (
    <form action={updateOrganizationRoleAction} className="flex min-w-0 flex-wrap items-center gap-1.5">
      <input type="hidden" name="redirectTo" value="/settings?tab=permissions" />
      <input type="hidden" name="roleId" value={roleId} />
      {permissions.map((permission) => <input key={permission} type="hidden" name="permission" value={permission} />)}
      {editing ? (
        <Input name="roleName" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={submitOnEnter} maxLength={50} required autoFocus className="w-52 py-1.5 font-semibold" aria-label="Role name" />
      ) : <p className="font-semibold text-ink-900">{name}</p>}
      <button type="button" aria-label={`Edit ${name} role`} onClick={() => setEditing(true)} className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-50 hover:text-brand-700"><Pencil size={15} /></button>
    </form>
  )
}
