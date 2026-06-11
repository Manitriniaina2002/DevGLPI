'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Input } from '@/app/components/ui/input'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { Search, Plus } from 'lucide-react'

const tickets = [
  { id: 1001, title: 'Accès à la base de données', priority: 'Haute', status: 'En cours', user: 'Jean Dupont' },
  { id: 1002, title: 'Bug dans le formulaire', priority: 'Moyenne', status: 'En attente', user: 'Marie Martin' },
  { id: 1003, title: 'Amélioration interface', priority: 'Basse', status: 'Nouveau', user: 'Pierre Bernard' },
  { id: 1004, title: 'Erreur de synchronisation', priority: 'Haute', status: 'En cours', user: 'Sophie Lefebvre' },
  { id: 1005, title: 'Documentation manquante', priority: 'Basse', status: 'Fermé', user: 'Luc Moreau' },
]

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'Haute':
      return 'bg-error-100 text-error-700'
    case 'Moyenne':
      return 'bg-warning-100 text-warning-700'
    case 'Basse':
      return 'bg-info-100 text-info-700'
    default:
      return 'bg-neutral-100 text-neutral-700'
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'En cours':
      return 'bg-info-100 text-info-700'
    case 'En attente':
      return 'bg-warning-100 text-warning-700'
    case 'Fermé':
      return 'bg-success-100 text-success-700'
    default:
      return 'bg-neutral-100 text-neutral-700'
  }
}

export default function TicketsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Tickets</h1>
          <p className="text-neutral-600">Gestion de tous les tickets de support</p>
        </div>
        <Button asChild size="lg">
          <Link href="/tickets/demandeur">
            <Plus className="w-4 h-4 mr-2" />
            Ajouter
          </Link>
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-neutral-400" />
        <Input
          placeholder="Rechercher un ticket..."
          className="pl-10"
        />
      </div>

      {/* Tickets Table */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="text-left py-3 px-4 font-semibold text-neutral-600 text-sm">ID</th>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-600 text-sm">Titre</th>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-600 text-sm">Priorité</th>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-600 text-sm">Statut</th>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-600 text-sm">Assigné à</th>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-600 text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="border-b border-neutral-200 hover:bg-neutral-50">
                    <td className="py-3 px-4 text-sm font-mono text-neutral-900">#{ticket.id}</td>
                    <td className="py-3 px-4 text-sm text-neutral-900">{ticket.title}</td>
                    <td className="py-3 px-4 text-sm">
                      <Badge className={getPriorityColor(ticket.priority)}>
                        {ticket.priority}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <Badge className={getStatusColor(ticket.status)}>
                        {ticket.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm text-neutral-600">{ticket.user}</td>
                    <td className="py-3 px-4 text-sm">
                      <Button variant="ghost" size="sm">Voir</Button>
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
