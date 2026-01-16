import { useState, useEffect } from 'react'

export default function ResetPassword() {
  const [token, setToken] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState<'idle'|'pending'|'success'|'error'>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const t = params.get('token')
    setToken(t)
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) { setStatus('error'); setMessage('Missing token'); return }
    if (!password || password.length < 6) { setStatus('error'); setMessage('Password too short') ; return }
    if (password !== confirm) { setStatus('error'); setMessage('Passwords do not match'); return }
    setStatus('pending')
    try {
      const res = await fetch(`${import.meta.env.VITE_SERVER_URL ?? ''}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password })
      })
      if (res.ok) {
        setStatus('success')
        setMessage('Password reset. Redirecting to sign in...')
        setTimeout(() => window.location.href = '/login', 1200)
      } else {
        const data = await res.json()
        setStatus('error')
        setMessage(data?.error || 'Reset failed')
      }
    } catch (err: any) {
      setStatus('error')
      setMessage(err.message || 'Reset failed')
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <div className="bg-stone-800 p-6 rounded">Missing token</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center text-white p-6">
      <form onSubmit={submit} className="bg-stone-800 p-8 rounded-lg w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">Choose a new password</h2>
        {status === 'error' && <div className="text-red-400 mb-2">{message}</div>}
        {status === 'success' && <div className="text-green-400 mb-2">{message}</div>}
        <label className="block mb-2">
          <div className="text-sm text-slate-300 mb-1">New password</div>
          <input type="password" className="w-full p-2 rounded bg-stone-700" value={password} onChange={e => setPassword(e.target.value)} />
        </label>
        <label className="block mb-4">
          <div className="text-sm text-slate-300 mb-1">Confirm password</div>
          <input type="password" className="w-full p-2 rounded bg-stone-700" value={confirm} onChange={e => setConfirm(e.target.value)} />
        </label>
        <div className="flex gap-2">
          <button type="submit" className="px-4 py-2 bg-emerald-500 rounded text-black font-bold">Reset password</button>
          <button type="button" className="px-4 py-2 bg-slate-600 rounded" onClick={() => window.location.href = '/login'}>Cancel</button>
        </div>
      </form>
    </div>
  )
}
