import { useEffect, useState } from 'react'

export default function Verify() {
  const [status, setStatus] = useState<'idle'|'pending'|'success'|'error'>('idle')
  const [message, setMessage] = useState<string>('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (!token) {
      setStatus('error')
      setMessage('Missing token')
      return
    }
    setStatus('pending')
    fetch(`${import.meta.env.VITE_SERVER_URL ?? ''}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      credentials: 'include'
    })
      .then(async r => {
        if (r.ok) {
          setStatus('success')
          setMessage('Email verified! Redirecting...')
          setTimeout(() => { window.location.pathname = '/home' }, 1200)
        } else {
          const data = await r.text()
          setStatus('error')
          setMessage(data || 'Verification failed')
        }
      })
      .catch(err => { setStatus('error'); setMessage(String(err)) })
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center text-white p-6">
      <div className="bg-stone-800 p-8 rounded-lg max-w-md w-full text-center">
        {status === 'pending' && <div>Verifying...</div>}
        {status === 'success' && <div className="text-green-400">{message}</div>}
        {status === 'error' && <div className="text-red-400">{message}</div>}
      </div>
    </div>
  )
}
