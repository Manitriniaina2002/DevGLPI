'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Input } from '@/app/components/ui/input'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { Search, Plus } from 'lucide-react'

const users = [
  { id: 1, name: 'Jean Dupont', email: 'jean.dupont@glpi.com', role: 'Admin', status: 'Actif' },
  { id: 2, name: 'Marie Martin', email: 'marie.martin@glpi.com', role: 'Technicien', status: 'Actif' },
  { id: 3, name: 'Pierre Bernard', email: 'pierre.bernard@glpi.com', role: 'Technicien', status: 'Actif' },
  { id: 4, name: 'Sophie Lefebvre', email: 'sophie.lefebvre@glpi.com', role: 'Gestionnaire', status: 'Inactif' },
  { id: 5, name: 'Luc Moreau', email: 'luc.moreau@glpi.com', role: 'Technicien', status: 'Actif' },
]

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Utilisateurs</h1>
          <p className="text-neutral-600">Gestion des comptes utilisateurs</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Nouvel Utilisateur
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-neutral-400" />
        <Input
          placeholder="Rechercher un utilisateur..."
          className="pl-10"
        />
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des Utilisateurs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="text-left py-3 px-4 font-semibold text-neutral-600 text-sm">Nom</th>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-600 text-sm">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-600 text-sm">Rôle</th>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-600 text-sm">Statut</th>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-600 text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-neutral-200 hover:bg-neutral-50">
                    <td className="py-3 px-4 text-sm font-medium text-neutral-900">{user.name}</td>
                    <td className="py-3 px-4 text-sm text-neutral-600">{user.email}</td>
                    <td className="py-3 px-4 text-sm">
                      <Badge className="bg-primary-100 text-primary-700">
                        {user.role}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <Badge className={user.status === 'Actif' ? 'bg-success-100 text-success-700' : 'bg-neutral-100 text-neutral-700'}>
                        {user.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm space-x-2">
                      <Button variant="ghost" size="sm">Éditer</Button>
                      <Button variant="ghost" size="sm" className="text-error-600">Supprimer</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
