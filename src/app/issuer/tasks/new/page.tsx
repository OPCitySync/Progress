import { redirect } from 'next/navigation'

// Opportunities are now created from the Opportunity Catalog (template → schedule).
export default function NewTaskRedirect() {
  redirect('/issuer/catalog')
}
