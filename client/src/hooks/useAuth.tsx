import { useState, useEffect, useCallback } from 'react'

export type User = { id: string; email: string; username: string; nickname?: string | null; emailVerifiedAt?: string | null }

export default function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchMe = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`${import.meta.env.VITE_SERVER_URL ?? ''}/api/auth/me`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setUser(data)
      } else {
        setUser(null)
      }
    } catch (e) {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  const login = useCallback(async (emailOrUsername: string, password: string) => {
    const res = await fetch(`${import.meta.env.VITE_SERVER_URL ?? ''}/api/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrUsername, password })
    })
    if (!res.ok) throw new Error('Invalid credentials')
    const data = await res.json()
    setUser(data)
    return data
  }, [])

  const register = useCallback(async (email: string, username: string, password: string) => {
    const res = await fetch(`${import.meta.env.VITE_SERVER_URL ?? ''}/api/auth/register`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'failed' }))
      throw new Error(err.error || 'Registration failed')
    }
    const data = await res.json()
    setUser(data)
    return data
  }, [])

  const logout = useCallback(async () => {
    await fetch(`${import.meta.env.VITE_SERVER_URL ?? ''}/api/auth/logout`, { method: 'POST', credentials: 'include' })
    setUser(null)
  }, [])

  return { user, loading, fetchMe, login, logout, register }
}
