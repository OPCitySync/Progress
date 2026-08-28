export type OrganizationFileKind = 'document' | 'waiver'

/**
 * A City/Sync URL for an organization-owned source file. Never expose the
 * underlying private Blob URL to the browser: this route performs the access
 * check immediately before streaming the file.
 */
export function organizationFileUrl(kind: OrganizationFileKind, id: string, taskId?: string) {
  const params = taskId ? `?taskId=${encodeURIComponent(taskId)}` : ''
  return `/api/organization-files/${kind}/${encodeURIComponent(id)}${params}`
}

export function organizationFileDownloadUrl(kind: OrganizationFileKind, id: string, taskId?: string) {
  const url = organizationFileUrl(kind, id, taskId)
  return `${url}${taskId ? '&' : '?'}download=1`
}
