import React from 'react'
import useAuth from '../hooks/useAuth'
import WoodenButton from './WoodenButton'

export default function AuthHeader() {
  const { user } = useAuth()

  const go = (path: string) => { window.location.pathname = path }

  if (user) {
    return (
      <div className="flex gap-2">
        <WoodenButton onClick={() => go('/profile')} variant="green">Profile</WoodenButton>
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      <WoodenButton onClick={() => go('/login')} variant="amber">Login</WoodenButton>
      <WoodenButton onClick={() => go('/register')} variant="emerald">Register</WoodenButton>
    </div>
  )
}
