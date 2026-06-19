'use client'

import { createContext, ReactNode, useContext } from 'react'

type HeaderActionsContextValue = {
  setHeaderActions: (content: ReactNode | null) => void
}

const HeaderActionsContext = createContext<HeaderActionsContextValue | null>(null)

export function HeaderActionsProvider({
  value,
  children,
}: {
  value: HeaderActionsContextValue
  children: ReactNode
}) {
  return <HeaderActionsContext.Provider value={value}>{children}</HeaderActionsContext.Provider>
}

export function useHeaderActions() {
  const context = useContext(HeaderActionsContext)
  if (!context) {
    throw new Error('useHeaderActions must be used within HeaderActionsProvider')
  }
  return context
}
