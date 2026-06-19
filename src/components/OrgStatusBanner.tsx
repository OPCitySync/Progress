export function OrgStatusBanner({ status }: { status: string }) {
  if (status === 'approved') return null
  return (
    <div
      className={
        status === 'pending'
          ? 'mb-6 rounded-2xl border border-gold-300 bg-gold-50 px-5 py-4 text-sm text-gold-800'
          : 'mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700'
      }
    >
      {status === 'pending' ? (
        <>
          <strong>Pending approval.</strong> A network administrator is reviewing your organization.
          You can prepare your liability waiver now; publishing unlocks once you’re approved.
        </>
      ) : (
        <>
          <strong>Suspended.</strong> Your organization is currently suspended. Contact the network
          administrator.
        </>
      )}
    </div>
  )
}
