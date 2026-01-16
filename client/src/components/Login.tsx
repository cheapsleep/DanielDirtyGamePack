import { useState } from 'react'
import useAuth from '../hooks/useAuth'

export default function Login() {
  const { login } = useAuth()
  const [emailOrUsername, setEmailOrUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await login(emailOrUsername, password)
      window.location.href = '/home'
    } catch (err: any) {
      setError(err.message || 'Login failed')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={submit} className="bg-stone-800 p-8 rounded-lg w-full max-w-md text-white">
        <h2 className="text-2xl font-bold mb-4">Login</h2>
        {error && <div className="mb-2 text-red-400">{error}</div>}
        <label className="block mb-2">
          <div className="text-sm text-slate-300 mb-1">Email or Username</div>
          <input className="w-full p-2 rounded bg-stone-700" value={emailOrUsername} onChange={e => setEmailOrUsername(e.target.value)} />
        </label>
        <label className="block mb-4">
          <div className="text-sm text-slate-300 mb-1">Password</div>
          <input type="password" className="w-full p-2 rounded bg-stone-700" value={password} onChange={e => setPassword(e.target.value)} />
        </label>
        <div className="flex gap-2">
          <button type="submit" className="px-4 py-2 bg-amber-500 rounded text-black font-bold">Log in</button>
          <button type="button" className="px-4 py-2 bg-slate-600 rounded" onClick={() => window.location.href = '/register'}>Register</button>
        </div>
        <div className="mt-3 text-sm text-slate-300">
          <button className="underline" onClick={() => window.location.href = '/forgot-password'}>Forgot your password?</button>
        </div>
      </form>
    </div>
  )
}
