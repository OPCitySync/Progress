import { Building2, MapPinPlus, ShieldCheck } from 'lucide-react'
import { createCityLaunchApplicationAction } from '@/app/actions'
import { InviteLinkDetails } from '@/components/organization/InviteLinkDetails'
import { Badge, Button, Card, Input, Label, Textarea } from '@/components/ui'
import { cityLaunchClaimCode, type CityLaunchApplication } from '@/lib/services/city-launch'

function launchTone(status: CityLaunchApplication['status']) {
  if (status === 'owner_assigned') return 'green'
  if (status === 'submitted') return 'gold'
  if (status === 'rejected') return 'red'
  return 'blue'
}

function launchLabel(status: CityLaunchApplication['status']) {
  if (status === 'awaiting_owner') return 'Awaiting local owner'
  if (status === 'owner_assigned') return 'Local owner assigned'
  return status[0].toUpperCase() + status.slice(1)
}

export function CityLaunchLocations({
  applications,
  canManage,
}: {
  applications: CityLaunchApplication[]
  canManage: boolean
}) {
  return (
    <div className="space-y-7">
      <Card className="border-brand-100 bg-brand-50/40">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-brand-100 p-2 text-brand-700"><MapPinPlus size={20} /></div>
          <div>
            <h2 className="font-display text-xl font-semibold text-ink-900">Launch a City Network</h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-600">
              Request City/Sync for another physical location. After network approval, City/Sync provisions a separate city database and creates a distinct, city-local organization account. The intended local owner claims that account with their Civic Participant identity.
            </p>
          </div>
        </div>
      </Card>

      {canManage ? (
        <Card>
          <div className="flex items-center gap-2"><Building2 size={19} className="text-brand-700" /><h2 className="font-display text-xl font-semibold text-ink-900">New City Application</h2></div>
          <form action={createCityLaunchApplicationAction} className="mt-5 grid gap-4 md:grid-cols-2">
            <input type="hidden" name="redirectTo" value="/settings?tab=locations" />
            <div><Label htmlFor="cityName">City name</Label><Input id="cityName" name="cityName" placeholder="City Z" required maxLength={100} /></div>
            <div><Label htmlFor="proposedOwnerName">Proposed local owner</Label><Input id="proposedOwnerName" name="proposedOwnerName" placeholder="Name of the local operator" required maxLength={120} /></div>
            <div className="md:col-span-2"><Label htmlFor="proposedOwnerEmail">Local owner’s Civic Participant email</Label><Input id="proposedOwnerEmail" name="proposedOwnerEmail" type="email" placeholder="owner@example.org" required maxLength={254} /></div>
            <div className="md:col-span-2"><Label htmlFor="cityDescription">Why this location needs City/Sync <span className="font-normal text-ink-400">(optional)</span></Label><Textarea id="cityDescription" name="cityDescription" rows={4} maxLength={600} placeholder="Describe the local civic network and your organization’s presence there." /></div>
            <div className="flex justify-end md:col-span-2"><Button type="submit">Submit City Application</Button></div>
          </form>
        </Card>
      ) : (
        <Card><p className="text-sm text-ink-600">Only an organization owner can submit or manage a city launch application.</p></Card>
      )}

      <section>
        <div className="mb-3 flex items-center gap-2"><ShieldCheck size={19} className="text-brand-700" /><h2 className="font-display text-xl font-semibold text-ink-900">Your City Applications</h2></div>
        {applications.length === 0 ? <Card><p className="text-sm text-ink-600">No city launch applications yet.</p></Card> : (
          <div className="space-y-4">
            {applications.map((application) => {
              const claimCode = canManage ? cityLaunchClaimCode(application) : null
              return (
                <Card key={application.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-ink-900">{application.cityName}</h3><Badge tone={launchTone(application.status)}>{launchLabel(application.status)}</Badge></div>
                      <p className="mt-1 text-sm text-ink-600">Proposed local owner: {application.proposedOwnerName} · {application.proposedOwnerEmail}</p>
                      {application.cityDescription ? <p className="mt-3 text-sm leading-relaxed text-ink-500">{application.cityDescription}</p> : null}
                    </div>
                  </div>
                  {claimCode ? (
                    <div className="mt-4 border-t border-ink-100 pt-4">
                      <p className="text-sm font-semibold text-ink-800">Send this claim link to the proposed local owner</p>
                      <p className="mt-1 text-xs leading-relaxed text-ink-500">They must sign in with the Civic Participant account using {application.proposedOwnerEmail}. The link expires {new Date(application.ownershipExpiresAt as number).toLocaleDateString()}.</p>
                      <InviteLinkDetails code={claimCode} claimPath="/city-launch/claim" />
                    </div>
                  ) : null}
                </Card>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
