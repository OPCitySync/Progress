/**
 * Keep connected Civic-Participant records that are still referenced by the
 * organization workspace. They are not roster members unless their separate
 * relationship state says so; this only keeps issuer views able to resolve
 * names and Passport access after an identity switch.
 */
export function retainReferencedConnectedParticipants(state) {
  const referenced = new Set();
  const add = value => { if (value) referenced.add(value); };

  for (const interest of state.recruitment?.roleInterests || []) add(interest.personId);
  for (const application of state.recruitment?.applications || []) add(application.personId);
  for (const membership of state.recruitment?.memberships || []) add(membership.personId);
  for (const invitation of state.recruitment?.invitations || []) add(invitation.personId);
  for (const commitment of state.commitments || []) add(commitment.personId);
  for (const grant of state.passports?.grants || []) add(grant.personId);
  for (const record of state.passports?.records || []) add(record.personId);

  state.people = (state.people || []).filter(person => !person.connectedAccount || referenced.has(person.id));
  return state;
}
