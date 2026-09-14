'use client'

import { FileText, FolderKanban, MoreHorizontal, Paperclip, Share2, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  archiveOrganizationDocumentAction,
  retireWaiverAction,
  setOrganizationDocumentProgramAction,
  setOrganizationResourceAssignmentsAction,
  setOrganizationResourcePublicationsAction,
  setWaiverProgramAction,
} from '@/app/actions'
import styles from '../prototype.module.css'

type TaskOption = { id: string; title: string }
type ProgramOption = { id: string; name: string }
type Resource = {
  id: string
  title: string
  kind: 'document' | 'waiver'
  taskIds: string[]
  publications: string[]
  programId: string | null
}

type Dialog = 'attach' | 'assign' | 'publish' | 'delete' | null

const defaultRedirectTo = '/aesthetic-lab/issuer/documents'

/** A deliberately shallow action flow: the overflow menu chooses an action,
 * then one focused modal handles the choices. Nested menus are hard to scan
 * and especially fragile on smaller screens. */
export function DocumentOverflowActions({ resource, tasks, programs, redirectTo = defaultRedirectTo }: { resource: Resource; tasks: TaskOption[]; programs: ProgramOption[]; redirectTo?: string }) {
  const [dialog, setDialog] = useState<Dialog>(null)
  const menuRef = useRef<HTMLDetailsElement>(null)
  const isWaiver = resource.kind === 'waiver'

  useEffect(() => {
    const closeMenuOutside = (event: PointerEvent) => {
      const menu = menuRef.current
      if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) {
        menu.removeAttribute('open')
      }
    }
    document.addEventListener('pointerdown', closeMenuOutside)
    return () => document.removeEventListener('pointerdown', closeMenuOutside)
  }, [])

  const openDialog = (next: Exclude<Dialog, null>) => {
    menuRef.current?.removeAttribute('open')
    setDialog(next)
  }

  const hiddenResourceFields = <>
    <input type="hidden" name="resourceId" value={resource.id} />
    <input type="hidden" name="resourceKind" value={resource.kind} />
    <input type="hidden" name="redirectTo" value={redirectTo} />
  </>

  return <>
    <details className={styles.workspaceDocumentOverflow} ref={menuRef}>
      <summary aria-label={`More actions for ${resource.title}`}><MoreHorizontal size={17} /></summary>
      <div>
        <button type="button" onClick={() => openDialog('assign')}><FolderKanban size={14} /> Assign to…</button>
        <button type="button" onClick={() => openDialog('attach')}><Paperclip size={14} /> Attach To…</button>
        <button type="button" onClick={() => openDialog('publish')}><Share2 size={14} /> Publish To…</button>
        <button type="button" className={styles.workspaceDocumentDeleteButton} onClick={() => openDialog('delete')}><Trash2 size={14} /> Delete {isWaiver ? 'Waiver' : 'Document'}</button>
      </div>
    </details>

    {dialog === 'assign' ? <div className={styles.issuerCalendarModalBackdrop} role="presentation" onMouseDown={() => setDialog(null)}>
      <section className={styles.issuerCalendarModal} role="dialog" aria-modal="true" aria-labelledby={`assign-resource-${resource.id}`} onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.issuerCalendarModalHeading}>
          <div><p className={styles.eyebrow}>Volunteer program</p><h2 id={`assign-resource-${resource.id}`}>Where does {resource.title} belong?</h2><p>Assign this {isWaiver ? 'waiver' : 'document'} to a volunteer program, or leave it organization-wide.</p></div>
          <button type="button" aria-label="Close" onClick={() => setDialog(null)}><X size={18} /></button>
        </div>
        <form action={isWaiver ? setWaiverProgramAction : setOrganizationDocumentProgramAction} className={styles.issuerCalendarForm} onSubmit={() => setDialog(null)}>
          <input type="hidden" name={isWaiver ? 'waiverVersionId' : 'documentId'} value={resource.id} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <label>Volunteer program<select name="programId" defaultValue={resource.programId ?? ''}><option value="">Organization-wide / not assigned</option>{programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select><small>Programs are optional and can be changed later.</small></label>
          <div className={styles.issuerCalendarFormActions}><button type="button" onClick={() => setDialog(null)}>Cancel</button><button type="submit"><FolderKanban size={15} /> Save assignment</button></div>
        </form>
      </section>
    </div> : null}

    {dialog === 'attach' ? <div className={styles.issuerCalendarModalBackdrop} role="presentation" onMouseDown={() => setDialog(null)}>
      <section className={styles.issuerCalendarModal} role="dialog" aria-modal="true" aria-labelledby={`attach-resource-${resource.id}`} onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.issuerCalendarModalHeading}>
          <div><p className={styles.eyebrow}>Attach to roles or opportunities</p><h2 id={`attach-resource-${resource.id}`}>Where should {resource.title} appear?</h2><p>{isWaiver ? 'This adds the waiver as a reference resource for selected roles or opportunities. Active waivers remain automatically included with onboarding, and this does not create a new signature requirement.' : 'Volunteers will see this resource when they open each selected role or opportunity.'}</p></div>
          <button type="button" aria-label="Close" onClick={() => setDialog(null)}><X size={18} /></button>
        </div>
        <form action={setOrganizationResourceAssignmentsAction} className={styles.issuerCalendarForm} onSubmit={() => setDialog(null)}>
          {hiddenResourceFields}
          <fieldset className={styles.documentAssignmentFieldset}>
            <legend>Available roles and opportunities</legend>
            {tasks.length ? <div>{tasks.map((task) => <label key={task.id}><input type="checkbox" name="taskIds" value={task.id} defaultChecked={resource.taskIds.includes(task.id)} /><span>{task.title}</span></label>)}</div> : <p>Your organization does not have any roles or opportunities to attach right now.</p>}
          </fieldset>
          <div className={styles.issuerCalendarFormActions}><button type="button" onClick={() => setDialog(null)}>Cancel</button><button type="submit"><Paperclip size={15} /> Save attachments</button></div>
        </form>
      </section>
    </div> : null}

    {dialog === 'publish' ? <div className={styles.issuerCalendarModalBackdrop} role="presentation" onMouseDown={() => setDialog(null)}>
      <section className={styles.issuerCalendarModal} role="dialog" aria-modal="true" aria-labelledby={`publish-resource-${resource.id}`} onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.issuerCalendarModalHeading}>
          <div><p className={styles.eyebrow}>Publish resource</p><h2 id={`publish-resource-${resource.id}`}>Choose where {resource.title} is available.</h2><p>You can use either destination or both. Removing every selection returns this item to your private organization library.</p></div>
          <button type="button" aria-label="Close" onClick={() => setDialog(null)}><X size={18} /></button>
        </div>
        <form action={setOrganizationResourcePublicationsAction} className={styles.issuerCalendarForm} onSubmit={() => setDialog(null)}>
          {hiddenResourceFields}
          <fieldset className={styles.documentAssignmentFieldset}>
            <legend>Publish to</legend>
            <div>
              <label><input type="checkbox" name="destinations" value="profile" defaultChecked={resource.publications.includes('profile')} /><span><b>Public Profile page</b><small>Visible to anyone viewing your organization.</small></span></label>
              <label><input type="checkbox" name="destinations" value="volunteer_resources" defaultChecked={resource.publications.includes('volunteer_resources')} /><span><b>Volunteer Resources</b><small>Available to Civic Participants in the local City/Sync network.</small></span></label>
            </div>
          </fieldset>
          <div className={styles.issuerCalendarFormActions}><button type="button" onClick={() => setDialog(null)}>Cancel</button><button type="submit"><Share2 size={15} /> Save visibility</button></div>
        </form>
      </section>
    </div> : null}

    {dialog === 'delete' ? <div className={styles.issuerCalendarModalBackdrop} role="presentation" onMouseDown={() => setDialog(null)}>
      <section className={styles.issuerCalendarModal} role="dialog" aria-modal="true" aria-labelledby={`delete-resource-${resource.id}`} onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.issuerCalendarModalHeading}>
          <div><p className={styles.eyebrow}>Remove resource</p><h2 id={`delete-resource-${resource.id}`}>Delete {resource.title}?</h2><p>{isWaiver ? 'This stops the waiver from being used for future onboarding and removes its resource placements. Past acceptance records remain intact.' : 'This removes the document from your private library, selected tasks, and any public resource pages.'}</p></div>
          <button type="button" aria-label="Close" onClick={() => setDialog(null)}><X size={18} /></button>
        </div>
        <form action={isWaiver ? retireWaiverAction : archiveOrganizationDocumentAction} className={styles.issuerCalendarForm} onSubmit={() => setDialog(null)}>
          <input type="hidden" name={isWaiver ? 'waiverVersionId' : 'documentId'} value={resource.id} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <div className={styles.issuerCalendarFormActions}><button type="button" onClick={() => setDialog(null)}>Keep it</button><button type="submit" className={styles.resourceDeleteConfirm}><Trash2 size={15} /> Delete {isWaiver ? 'Waiver' : 'Document'}</button></div>
        </form>
      </section>
    </div> : null}
  </>
}
