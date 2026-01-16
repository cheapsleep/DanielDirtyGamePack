import { useEffect, useState } from 'react'
import useAuth from '../hooks/useAuth'

export default function Profile() {
  const { user, logout, fetchMe } = useAuth()
  const [stats, setStats] = useState<any>(null)
  const [editingNick, setEditingNick] = useState(false)
  const [nickDraft, setNickDraft] = useState('')
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    setNickDraft(user.nickname ?? '')
    setSelectedIcon(user.profileIcon ?? (typeof window !== 'undefined' ? localStorage.getItem('profileIcon') : null))

    ;(async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_SERVER_URL ?? ''}/api/stats/me`, { credentials: 'include' })
        if (res.ok) setStats(await res.json())
      } catch {
        setStats(null)
      }
    })()
  }, [user, fetchMe])

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">Please log in to view your profile.</div>
    )
  }

  return (
    <div className="min-h-screen p-4 sm:p-8 text-white flex justify-center">
      <div className="w-full max-w-2xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: selectedIcon ?? '#444' }}>
              <span className="text-2xl font-bold opacity-80">{(user.username || '').charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold">Profile</h1>
              <div className="text-sm text-slate-400">Manage your account and appearance</div>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => { window.location.href = 'https://danieldgp.com/join' }} className="px-3 py-1 bg-stone-700 rounded">Back</button>
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
            <button onClick={async () => { await logout(); window.location.href = '/home' }} className="px-3 py-1 bg-stone-700 rounded">Log out</button>
          </div>
        </div>

        <div className="bg-stone-800 p-6 rounded mb-4">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: selectedIcon ?? '#444' }}>
              <span className="text-xl font-bold opacity-90">{(user.username || '').charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <p className="font-bold">{user.username}</p>
              <p className="text-sm text-slate-400">{user.email}</p>
            </div>
          </div>
          <p><strong>Nickname:</strong> {user.nickname ?? '(none)'} {editingNick ? null : (<button onClick={() => setEditingNick(true)} className="ml-2 text-sm text-slate-300 underline">Edit</button>)}</p>
          <p><strong>Verified:</strong> {user.emailVerifiedAt ? 'Yes' : 'No' }</p>
        </div>

        {editingNick && (
          <div className="mt-2 max-w-md mb-4">
            <label className="block text-sm text-slate-400 mb-1">Nickname</label>
            <input value={nickDraft} onChange={e => setNickDraft(e.target.value)} className="w-full p-2 rounded bg-stone-800" />
            <div className="flex gap-2 mt-2">
              <button onClick={async () => {
                try {
                  const res = await fetch(`${import.meta.env.VITE_SERVER_URL ?? ''}/api/auth/nickname`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nickname: nickDraft }) })
                  if (res.ok) {
                    setEditingNick(false)
                    window.location.reload()
                  } else {
                    alert('Failed to update nickname')
                  }
                } catch (e) { alert('Failed to update nickname') }
              }} className="px-3 py-1 bg-pink-500 rounded">Save</button>
              <button onClick={() => { setEditingNick(false); setNickDraft(user.nickname ?? '') }} className="px-3 py-1 bg-stone-700 rounded">Cancel</button>
            </div>
          </div>
        )}

        <div className="mt-4 bg-stone-800 p-6 rounded mb-4">
          <h2 className="text-xl font-bold mb-3">Profile Icon</h2>
          <p className="text-sm text-slate-400 mb-4">Choose an avatar color. Images can be added later.</p>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 max-w-md">
            {['#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#10b981','#06b6d4','#3b82f6','#6366f1','#8b5cf6','#ec4899','#64748b'].map(c => (
              <button
                key={c}
                onClick={() => setSelectedIcon(c)}
                className={`w-12 h-12 rounded-full border-4 ${selectedIcon === c ? 'border-white' : 'border-transparent'}`}
                style={{ background: c }}
                aria-label={`Choose ${c}`}
              />
            ))}
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <button className="w-full sm:w-auto px-4 py-2 bg-pink-500 rounded" onClick={async () => {
              try {
                const res = await fetch(`${import.meta.env.VITE_SERVER_URL ?? ''}/api/auth/profile`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileIcon: selectedIcon }) })
                if (res.ok) {
                  if (selectedIcon) localStorage.setItem('profileIcon', selectedIcon)
                  else localStorage.removeItem('profileIcon')
                  try { await fetchMe() } catch {}
                  alert('Profile icon saved')
                } else {
                  alert('Failed to save profile icon')
                }
              } catch (e) {
                alert('Failed to save profile icon')
              }
            }}>Save Icon</button>

            <button className="w-full sm:w-auto px-4 py-2 bg-stone-700 rounded" onClick={async () => {
              setSelectedIcon(user.profileIcon ?? null)
              try {
                const res = await fetch(`${import.meta.env.VITE_SERVER_URL ?? ''}/api/auth/profile`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileIcon: null }) })
                if (res.ok) {
                  localStorage.removeItem('profileIcon')
                  try { await fetchMe() } catch {}
                }
              } catch {}
            }}>Reset</button>
          </div>
        </div>

        <div className="mt-2">
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
    </div>
  )
}
import { useEffect, useState } from 'react'
import useAuth from '../hooks/useAuth'

export default function Profile() {
  const { user, logout, fetchMe } = useAuth()
  const [stats, setStats] = useState<any>(null)
  const [editingNick, setEditingNick] = useState(false)
  const [nickDraft, setNickDraft] = useState('')
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      setNickDraft(user.nickname ?? '');
      setSelectedIcon(user.profileIcon ?? localStorage.getItem('profileIcon') ?? null);
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
    <div className="min-h-screen p-4 sm:p-8 text-white flex justify-center">
      <div className="w-full max-w-2xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: selectedIcon ?? '#444' }}>
            <span className="text-2xl font-bold opacity-80">{(user.username || '').charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold">Profile</h1>
            <div className="text-sm text-slate-400">Manage your account and appearance</div>
          </div>
        </div>
          <div className="flex gap-2">
          <button onClick={() => { window.location.href = 'https://danieldgp.com/join' }} className="px-3 py-1 bg-stone-700 rounded">Back</button>
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
        <div className="flex items-center gap-4 mb-3">
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: selectedIcon ?? '#444' }}>
            <span className="text-xl font-bold opacity-90">{(user.username || '').charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <p className="font-bold">{user.username}</p>
            <p className="text-sm text-slate-400">{user.email}</p>
          </div>
        </div>
        <p><strong>Nickname:</strong> {user.nickname ?? '(none)'} {editingNick ? null : (<button onClick={() => setEditingNick(true)} className="ml-2 text-sm text-slate-300 underline">Edit</button>)}</p>
        <p><strong>Verified:</strong> {user.emailVerifiedAt ? 'Yes' : 'No' }</p>
      </div>

      {editingNick && (
        <div className="mt-4 max-w-md">
          <label className="block text-sm text-slate-400 mb-1">Nickname</label>
          <input value={nickDraft} onChange={e => setNickDraft(e.target.value)} className="w-full p-2 rounded bg-stone-800" />
          <div className="flex gap-2 mt-2">
            <button onClick={async () => {
              try {
                const res = await fetch(`${import.meta.env.VITE_SERVER_URL ?? ''}/api/auth/nickname`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nickname: nickDraft }) })
                if (res.ok) {
                  setEditingNick(false)
                  window.location.reload()
                } else {
                  alert('Failed to update nickname')
                }
              } catch (e) { alert('Failed to update nickname') }
            }} className="px-3 py-1 bg-pink-500 rounded">Save</button>
            <button onClick={() => { setEditingNick(false); setNickDraft(user.nickname ?? '') }} className="px-3 py-1 bg-stone-700 rounded">Cancel</button>
          </div>
        </div>
      )}

      <div className="mt-6 bg-stone-800 p-6 rounded">
        <h2 className="text-xl font-bold mb-3">Profile Icon</h2>
        <p className="text-sm text-slate-400 mb-4">Choose an avatar color. Images can be added later.</p>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 max-w-md">
          {['#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#10b981','#06b6d4','#3b82f6','#6366f1','#8b5cf6','#ec4899','#64748b'].map(c => (
            <button
              key={c}
              onClick={() => setSelectedIcon(c)}
              className={`w-12 h-12 rounded-full border-4 ${selectedIcon === c ? 'border-white' : 'border-transparent'}`}
              style={{ background: c }}
              aria-label={`Choose ${c}`}
            />
          ))}
        </div>
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <button className="w-full sm:w-auto" onClick={async () => {
            try {
              const res = await fetch(`${import.meta.env.VITE_SERVER_URL ?? ''}/api/auth/profile`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileIcon: selectedIcon }) })
              if (res.ok) {
                // persist locally too for instant UI
                if (selectedIcon) localStorage.setItem('profileIcon', selectedIcon)
                else localStorage.removeItem('profileIcon')
                try { await fetchMe() } catch {}
                alert('Profile icon saved')
              } else {
                alert('Failed to save profile icon')
              }
            } catch (e) {
              alert('Failed to save profile icon')
            }
          }} className="px-4 py-2 bg-pink-500 rounded">Save Icon</button>
          <button className="w-full sm:w-auto" onClick={async () => { setSelectedIcon(user.profileIcon ?? null); try { const res = await fetch(`${import.meta.env.VITE_SERVER_URL ?? ''}/api/auth/profile`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileIcon: null }) }); if (res.ok) { localStorage.removeItem('profileIcon'); try { await fetchMe() } catch {} } } catch {} }} className="px-4 py-2 bg-stone-700 rounded">Reset</button>
        </div>
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
