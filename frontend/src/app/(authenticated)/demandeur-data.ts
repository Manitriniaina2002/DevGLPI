export type StatutDemande =
  | 'en_attente'
  | 'attribue'
  | 'circuit_validation'
  | 'valide_commande'
  | 'cloture'

export interface Demande {
  id: string
  titre: string
  statut: StatutDemande
  attribueA?: string
  date: string
  reference: string
}

export const demandes: Demande[] = [
  { id: '1', titre: 'Achat fournitures bureau', statut: 'en_attente', date: '2025-06-01', reference: 'DA-2025-001' },
  { id: '2', titre: 'Matériel informatique', statut: 'attribue', attribueA: 'Jean Dupont', date: '2025-06-02', reference: 'DA-2025-002' },
  { id: '3', titre: 'Mobilier salle de réunion', statut: 'circuit_validation', date: '2025-06-03', reference: 'DA-2025-003' },
  { id: '4', titre: 'Licences logiciels', statut: 'valide_commande', date: '2025-06-04', reference: 'DA-2025-004' },
  { id: '5', titre: 'Consommables imprimante', statut: 'cloture', date: '2025-05-20', reference: 'DA-2025-005' },
  { id: '6', titre: 'Équipement réseau', statut: 'en_attente', date: '2025-06-05', reference: 'DA-2025-006' },
  { id: '7', titre: 'Papeterie urgente', statut: 'attribue', attribueA: 'Marie Martin', date: '2025-06-05', reference: 'DA-2025-007' },
  { id: '8', titre: 'Outillage atelier', statut: 'circuit_validation', date: '2025-06-06', reference: 'DA-2025-008' },
  { id: '9', titre: 'Produits hygiène', statut: 'valide_commande', date: '2025-06-06', reference: 'DA-2025-009' },
  { id: '10', titre: 'Équipements sécurité', statut: 'cloture', date: '2025-05-28', reference: 'DA-2025-010' },
]
