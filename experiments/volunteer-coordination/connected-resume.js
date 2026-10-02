async function resumeResponse(response) {
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'Could not load your résumé.');
  return result.resume;
}

export async function loadMyCityResume() {
  return resumeResponse(await fetch('/api/mycity/resume', {
    credentials: 'same-origin',
    cache: 'no-store',
  }));
}

export async function setMyCityResumeVisibility(isPublic) {
  return resumeResponse(await fetch('/api/mycity/resume', {
    method: 'PATCH',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isPublic }),
  }));
}
