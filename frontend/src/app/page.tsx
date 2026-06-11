'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // TODO: Vérifier si l'utilisateur est authentifié
    // Si oui, rediriger vers /dashboard
    // Si non, rediriger vers /auth/login
    const token = localStorage.getItem('auth_token')
    
    if (token) {
      router.push('/dashboard')
    } else {
      router.push('/auth/login')
    }
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">GLPI Dashboard</h1>
        <p className="text-neutral-600">Redirection en cours...</p>
      </div>
    </div>
  )
}
