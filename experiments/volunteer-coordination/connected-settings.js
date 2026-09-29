/** Connected organization identity only. Other prototype screens remain sample data. */
export async function loadMyCityContext() {
  const response = await fetch('/api/mycity/context', { credentials: 'same-origin', cache: 'no-store' });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'Could not load your organization.');
  return result;
}

export async function saveOrganizationSettings(values) {
  const response = await fetch('/api/mycity/organization-settings', {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'Could not save organization settings.');
  return result.organization;
}

export function renderConnectedSettings(context, error, escape) {
  if (error) return `<section class="connected-settings-state panel"><h1>Organization Settings</h1><p role="alert">${escape(error)}</p><a class="btn secondary" href="/login">Sign in again</a></section>`;
  if (!context) return '<section class="connected-settings-state panel" role="status">Loading organization settings…</section>';
  const org = context.organization;
  if (!org) return '<section class="connected-settings-state panel"><h1>Organization Settings</h1><p>Switch to an issuer organization to manage its settings.</p></section>';
  const fields = [
    ['name', 'Organization name', org.name, 'text', 120],
    ['email', 'Organization email', org.email, 'email', 150],
    ['location', 'Location', org.location, 'text', 240],
    ['phone', 'Phone number', org.phone, 'tel', 50],
  ];
  return `<div class="connected-settings-page">
    <header class="connected-settings-heading"><div><span class="eyebrow">${escape(context.cityName || 'YOUR CITY NETWORK')}</span><h1>Organization Settings</h1><p>Keep your organization’s identity and contact details current.</p></div><span class="connected-settings-live">Connected workspace</span></header>
    <section class="connected-settings-card panel"><div class="connected-settings-card-heading"><div><span class="eyebrow">ORGANIZATION IDENTITY</span><h2>${escape(org.name)}</h2></div></div>
      ${org.canEdit ? `<form data-form="organizationSettings" class="connected-settings-form"><div class="connected-settings-fields">${fields.map(([key,label,value,type,max])=>`<label>${escape(label)}<input name="${key}" type="${type}" maxlength="${max}" value="${escape(value || '')}" ${key==='name'?'required':''}></label>`).join('')}</div><p class="form-error" role="alert" tabindex="-1"></p><div class="connected-settings-actions"><span>Changes are saved to your organization’s workspace.</span><button type="submit" class="btn primary">Save Organization</button></div></form>` : `<div class="connected-settings-readonly"><p>Only an organization owner can change these settings.</p>${fields.map(([,label,value])=>`<div><span>${escape(label)}</span><strong>${escape(value || 'Not provided')}</strong></div>`).join('')}</div>`}
    </section>
  </div>`;
}
