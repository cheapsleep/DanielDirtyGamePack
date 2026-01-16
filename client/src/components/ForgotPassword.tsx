import { useState } from 'react'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const res = await fetch(`${import.meta.env.VITE_SERVER_URL ?? ''}/api/auth/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      if (res.ok) {
        setSent(true)
      } else {
        const data = await res.json()
        setError(data?.error || 'Failed')
      }
    } catch (err: any) {
      setError(err.message || 'Failed')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center text-white p-6">
      <form onSubmit={submit} className="bg-stone-800 p-8 rounded-lg w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">Reset password</h2>
        {sent ? (
          <div className="text-slate-300">If that email exists we'll send a reset link.</div>
        ) : (
          <>
            {error && <div className="text-red-400 mb-2">{error}</div>}
            <label className="block mb-2">
              <div className="text-sm text-slate-300 mb-1">Email</div>
              <input className="w-full p-2 rounded bg-stone-700" value={email} onChange={e => setEmail(e.target.value)} />
            </label>
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 bg-amber-500 rounded text-black font-bold">Send reset</button>
              <button type="button" className="px-4 py-2 bg-slate-600 rounded" onClick={() => window.location.href = '/login'}>Sign in</button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}
