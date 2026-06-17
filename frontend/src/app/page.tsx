"use client"
export const dynamic = 'force-dynamic'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()
  const glpiToken = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('glpi_token') : null
  const oneTime = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('one_time') : null

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
            let apiBase = process.env.NEXT_PUBLIC_API_URL ?? ''
            if (typeof window !== 'undefined') {
              // In local browser development, the backend is on localhost:9000
              if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                apiBase = 'http://localhost:9000'
              }
            }
            const url = apiBase ? `${apiBase.replace(/\/$/, '')}/api/auth/login` : '/api/auth/login'
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

              // Redirect to dashboard after successful auth
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

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">GLPI Dashboard</h1>
        <p className="text-neutral-600">Authentification en cours...</p>
      </div>
    </div>
  )
}
