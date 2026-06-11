'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { Separator } from '@/app/components/ui/separator'

export default function SettingsPage() {
  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Paramètres</h1>
        <p className="text-neutral-600">Configuration du système GLPI</p>
      </div>

      {/* Profil */}
      <Card>
        <CardHeader>
          <CardTitle>Mon Profil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Prénom</Label>
              <Input placeholder="Jean" />
            </div>
            <div>
              <Label>Nom</Label>
              <Input placeholder="Dupont" />
            </div>
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" placeholder="jean.dupont@glpi.com" />
          </div>
          <Button>Enregistrer les modifications</Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Sécurité */}
      <Card>
        <CardHeader>
          <CardTitle>Sécurité</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Ancien mot de passe</Label>
            <Input type="password" placeholder="••••••••" />
          </div>
          <div>
            <Label>Nouveau mot de passe</Label>
            <Input type="password" placeholder="••••••••" />
          </div>
          <div>
            <Label>Confirmer le mot de passe</Label>
            <Input type="password" placeholder="••••••••" />
          </div>
          <Button variant="outline">Changer le mot de passe</Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Préférences */}
      <Card>
        <CardHeader>
          <CardTitle>Préférences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Notifications par email</Label>
            <input type="checkbox" defaultChecked className="w-4 h-4" />
          </div>
          <div className="flex items-center justify-between">
            <Label>Thème sombre</Label>
            <input type="checkbox" className="w-4 h-4" />
          </div>
          <Button>Enregistrer les préférences</Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Zone Danger */}
      <Card className="border-error-200 bg-error-50">
        <CardHeader>
          <CardTitle className="text-error-600">Zone Dangereuse</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-error-700">
            Ces actions sont irréversibles. Veuillez être prudent.
          </p>
          <Button variant="destructive">Supprimer mon compte</Button>
        </CardContent>
      </Card>
    </div>
  )
}
