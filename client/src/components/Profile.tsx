import { useEffect, useState } from 'react'
import useAuth from '../hooks/useAuth'

export default function Profile() {
  const { user, logout } = useAuth()
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    if (user) {
      // fetch stats when API is available; currently placeholder
      (async () => {
        try {
          const res = await fetch(`${import.meta.env.VITE_SERVER_URL ?? ''}/api/stats/me`, { credentials: 'include' })
          if (res.ok) setStats(await res.json())
        } catch {
          setStats(null)
        }
      })()
    }
  }, [user])

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">Please log in to view your profile.</div>
    )
  }

  return (
    <div className="min-h-screen p-8 text-white">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Profile</h1>
        <div className="flex gap-2">
          <button onClick={() => { window.location.pathname = '/home' }} className="px-3 py-1 bg-stone-700 rounded">Back</button>
          {!user?.emailVerifiedAt && (
            <button
              onClick={async () => {
                try {
                  await fetch(`${import.meta.env.VITE_SERVER_URL ?? ''}/api/auth/resend-verification`, { method: 'POST', credentials: 'include' })
                  alert('Verification email resent (if your email exists)')
                } catch (e) {
                  alert('Failed to resend verification email')
                }
              }}
              className="px-3 py-1 bg-amber-500 rounded text-black"
            >
              Resend verification
            </button>
          )}
          <button onClick={async () => { await logout(); window.location.href='/home' }} className="px-3 py-1 bg-stone-700 rounded">Log out</button>
        </div>
      </div>

      <div className="bg-stone-800 p-6 rounded">
        <p><strong>Username:</strong> {user.username}</p>
        <p><strong>Email:</strong> {user.email}</p>
        <p><strong>Verified:</strong> {user.emailVerifiedAt ? 'Yes' : 'No' }</p>
      </div>

      <div className="mt-6">
        <h2 className="text-xl font-bold mb-2">Stats</h2>
        {stats && stats.length > 0 ? (
          <div className="grid grid-cols-1 gap-3">
            {stats.map((s: any) => (
              <div key={s.id} className="bg-stone-900 p-4 rounded">
                <div><strong>Game:</strong> {s.game}</div>
                <div><strong>Sessions:</strong> {s.sessions}</div>
                <div><strong>Wins:</strong> {s.wins}</div>
                <div><strong>Total score:</strong> {s.totalScore}</div>
                <div><strong>Best score:</strong> {s.bestScore}</div>
                {s.metadata && <div className="text-sm text-slate-400 mt-2">{JSON.stringify(s.metadata)}</div>}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-slate-400">No stats available yet.</div>
        )}
      </div>
    </div>
  )
}
