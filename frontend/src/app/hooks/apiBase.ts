'use client'

export function getApiBase() {
  const envBase = process.env.NEXT_PUBLIC_API_URL?.trim()
  if (envBase) return envBase.replace(/\/$/, '')

  return 'http://10.85.1.14:9000'
}
