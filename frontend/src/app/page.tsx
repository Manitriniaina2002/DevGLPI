'use client'
export const dynamic = 'force-dynamic'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getApiBase } from '@/app/hooks/apiBase'

export default function HomePage() {
  return (
    <Suspense fallback={<AuthLoading />}>
      <HomePageContent />
    </Suspense>
  )
}

function HomePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const glpiToken = searchParams.get('glpi_token')
  const oneTime = searchParams.get('one_time')

  useEffect(() => {
    const authenticate = async () => {
      try {
        // Check if already authenticated
        const existingToken = localStorage.getItem('auth_token')
        
        if (existingToken) {
          router.push('/dashboard')
          return
        }

        // If GLPI token or one-time token is provided, exchange it for JWT
        if (glpiToken || oneTime) {
          try {
            const url = `${getApiBase()}/api/auth/login`
            const payload = { user_token: glpiToken, one_time_token: oneTime }
            console.log('[auth] sending payload', payload)

            const response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(payload),
            })

            const responseBody = await response.text()
            console.log('[auth] response status', response.status, 'body', responseBody)

            if (response.ok) {
              const data = JSON.parse(responseBody)
              localStorage.setItem('auth_token', data.access_token || '')
              localStorage.setItem('user_id', data.user_id.toString())
              localStorage.setItem('user_login', data.login)
              localStorage.setItem('user_full_name', data.full_name)
              localStorage.setItem('user_role', data.role)

              router.replace('/dashboard')
              return
            } else {
              console.error('Auth failed:', response.status, responseBody)
            }
          } catch (error) {
            console.error('Error exchanging GLPI token:', error)
          }
        }

        // No token provided or exchange failed, go to login
        router.push('/auth/login')
      } catch (error) {
        console.error('Authentication error:', error)
        router.push('/auth/login')
      }
    }

    authenticate()
  }, [glpiToken, oneTime, router])

  return <AuthLoading />
}

function AuthLoading() {
  return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">GLPI Dashboard</h1>
          <p className="text-neutral-600">Authentification en cours...</p>
        </div>
      </div>
    )
}
