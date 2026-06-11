import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'GLPI Dashboard',
  description: 'Système de gestion des tickets GLPI',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className="bg-neutral-50">
        {children}
      </body>
    </html>
  )
}
