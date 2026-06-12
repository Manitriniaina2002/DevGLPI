'use client'

import { ReactNode, useEffect, useMemo, useState } from 'react'

type Role = 'demandeur' | 'acheteur' | 'responsable'

function safeDecodeRoleFromJwt(token: string): Role | null {
  try {
    const payloadPart = token.split('.')[1]
    if (!payloadPart) return null

    const payloadJson = atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(payloadJson)

    const r = payload?.role
    if (r === 'demandeur' || r === 'acheteur' || r === 'responsable') return r
    return null
  } catch {
    return null
  }
}

export default function RoleGuard({

  allowedRoles,
  children,
  fallback,
}: {
  allowedRoles: Role[]
  children: ReactNode
  fallback?: ReactNode
}) {
  const [role, setRole] = useState<Role | null>(null)

  useEffect(() => {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        setRole(null)
        return
      }

      setRole(safeDecodeRoleFromJwt(token))
    } catch {
      setRole(null)
    }
  }, [])


  const isAllowed = useMemo(() => {
    if (!role) return false
    return allowedRoles.includes(role)
  }, [allowedRoles, role])

  if (role === null) {
    return <>{fallback ?? <div className="py-10 text-center text-sm text-neutral-500">Vérification…</div>}</>
  }

  if (!isAllowed) {
    return (
      <div className="py-10 text-center">
        <div className="mx-auto max-w-md rounded-2xl border border-red-200 bg-red-50 px-6 py-6">
          <div className="text-sm font-semibold text-red-700">Accès refusé</div>
          <div className="mt-1 text-sm text-red-700/90">
            Votre rôle (<span className="font-semibold">{role}</span>) n’a pas accès à cette page.
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

