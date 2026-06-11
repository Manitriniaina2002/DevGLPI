/// <reference types="next" />
/// <reference types="next/image-types/global" />
/// <reference types="next/navigation-types/compat/navigation" />

// NOTE:
// Ce fichier existe souvent déjà dans un projet Next.
// Ici on force la résolution des types Next pour éviter l'erreur TS:
// "Could not find a declaration file for module 'next/link'".

declare module 'next/link' {
  import type { ComponentType } from 'react'

  export type LinkProps = {
    href: string
    children?: React.ReactNode
    className?: string
    [key: string]: unknown
  }

  const Link: ComponentType<LinkProps>
  export default Link
}

