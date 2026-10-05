'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { requestPasswordReset, resetPasswordWithToken } from '@/lib/services/password-reset'

function value(formData: FormData, key: string): string {
  const item = formData.get(key)
  return typeof item === 'string' ? item : ''
}

function publicBaseUrl(): string {
  const configured = process.env.APP_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')

  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (productionHost) return `https://${productionHost.replace(/^https?:\/\//, '').replace(/\/$/, '')}`

  const requestHeaders = headers()
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host')
  const protocol = requestHeaders.get('x-forwarded-proto') ?? (process.env.NODE_ENV === 'production' ? 'https' : 'http')
  if (host) return `${protocol}://${host}`
  return 'http://127.0.0.1:3000'
}

function requesterIdentifier(): string {
  const requestHeaders = headers()
  const forwarded = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || requestHeaders.get('x-real-ip') || 'unknown'
}

export async function requestPasswordResetAction(formData: FormData) {
  const startedAt = Date.now()
  const result = await requestPasswordReset({
    email: value(formData, 'email'),
    requesterIdentifier: requesterIdentifier(),
    baseUrl: publicBaseUrl(),
  })

  // Reduce useful timing differences between known, unknown, and throttled
  // addresses without making the form feel slow.
  const remainingDelay = 400 - (Date.now() - startedAt)
  if (remainingDelay > 0) await new Promise((resolve) => setTimeout(resolve, remainingDelay))

  const params = new URLSearchParams({ sent: '1' })
  if (result.developmentToken && process.env.NODE_ENV !== 'production') {
    params.set('developmentToken', result.developmentToken)
  }
  redirect(`/forgot-password?${params.toString()}`)
}

export async function resetPasswordAction(formData: FormData) {
  const token = value(formData, 'token')
  const password = value(formData, 'password')
  const confirmation = value(formData, 'passwordConfirmation')

  if (password !== confirmation) {
    redirect(`/reset-password?token=${encodeURIComponent(token)}&error=${encodeURIComponent('The passwords do not match.')}`)
  }

  const result = await resetPasswordWithToken({ token, password })
  if (!result.ok) {
    redirect(`/reset-password?token=${encodeURIComponent(token)}&error=${encodeURIComponent(result.error)}`)
  }

  redirect(`/login?ok=${encodeURIComponent('Your password has been updated. Sign in with your new password.')}`)
}
