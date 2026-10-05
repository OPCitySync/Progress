'use client'

import { useState } from 'react'
import { DialogForm, WorkspaceDialog } from './ProgramWorkspace'

function RoleForm({
  scope,
  organizationAddress,
  defaultDurationMinutes,
  defaultVisibility,
}: {
  scope: string
  organizationAddress: string
  defaultDurationMinutes: number
  defaultVisibility: 'public' | 'private'
}) {
  const [title, setTitle] = useState('')

  return <DialogForm scope={scope} operation="position" submitLabel="Create Role">
    <label>Role Title<input name="title" required maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Community meal host" /></label>
    <label>Role Description<textarea name="description" required placeholder="Describe the work, what a successful shift looks like, and anything volunteers should know." /></label>
    <input type="hidden" name="location" value={organizationAddress} />

    <input type="hidden" name="capacity" value="2" />
    <input type="hidden" name="roleShifts" value="[]" />
    <input type="hidden" name="defaultDurationMinutes" value={defaultDurationMinutes} />
    <input type="hidden" name="visibility" value={defaultVisibility} />
  </DialogForm>
}

export function CreateVolunteerRoleButton({
  scope,
  organizationAddress,
  defaultDurationMinutes,
  defaultVisibility,
  triggerClassName,
}: {
  scope: string
  organizationAddress: string
  defaultDurationMinutes: number
  defaultVisibility: 'public' | 'private'
  triggerClassName?: string
}) {
  return <WorkspaceDialog label="Create Role" title="Create Volunteer Role" triggerClassName={triggerClassName}>
    <RoleForm scope={scope} organizationAddress={organizationAddress} defaultDurationMinutes={defaultDurationMinutes} defaultVisibility={defaultVisibility} />
  </WorkspaceDialog>
}
