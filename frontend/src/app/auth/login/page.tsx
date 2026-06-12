'use client'

import { useState } from 'react'

import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Alert, AlertDescription } from '@/app/components/ui/alert'
import { AlertCircle, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [userToken, setUserToken] = useState('')

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      // TODO: Implémenter l'appel API d'authentification
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:9000'
      const response = await fetch(`${apiUrl}/api/auth/login`, {

        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_token: userToken }),
      })

      if (!response.ok) {
        throw new Error('Identifiants invalides')
      }

      // TODO: Rediriger vers le dashboard
      const data = await response.json()
      if (data?.access_token) {
        localStorage.setItem('auth_token', data.access_token)
      }
      window.location.href = '/dashboard'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Connexion GLPI</CardTitle>
          <CardDescription className="text-center">
            Accédez à votre tableau de bord de gestion des tickets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="userToken">User token GLPI</Label>
              <Input
                id="userToken"
                type="text"
                placeholder="<user_token>"
                value={userToken}
                onChange={(e) => setUserToken(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>


            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connexion en cours...
                </>
              ) : (
                'Se connecter'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
