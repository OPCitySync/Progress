/** Organization-local intake decisions are not public civic activity. Keep
 * their immutable audit entries in the control ledger, not the city mirror. */
export const privateOnboardingEventTypes = [
  'ONBOARDING_APPLICATION_FORM_SAVED',
  'ONBOARDING_APPLICATION_FORM_ARCHIVED',
  'ONBOARDING_APPLICATION_FORM_PUBLISHED',
  'ONBOARDING_APPLICATION_FORM_UNPUBLISHED',
  'ONBOARDING_APPLICATION_SUBMITTED',
  'ONBOARDING_APPLICATION_REVIEWED',
  'ONBOARDING_SESSION_INVITATIONS_SENT',
  'VOLUNTEER_ADMISSION_REVIEWED',
]
export function isPrivateOnboardingEvent(type: string) {
  return privateOnboardingEventTypes.includes(type)
}
