import React, { useEffect, useRef, useState } from 'react'
import useAuth from '../hooks/useAuth'

type Props = {
  slot?: string
  className?: string
}

export default function AdsBanner({ slot = 'default', className = '' }: Props) {
  const { user } = useAuth()
  const [visible, setVisible] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  const ADS_ENABLED = (import.meta.env.VITE_ADS_ENABLED ?? 'false') === 'true'
  const ADS_PROVIDER = (import.meta.env.VITE_ADS_PROVIDER ?? '').toLowerCase()
  const ADSENSE_CLIENT = import.meta.env.VITE_ADS_ADSENSE_CLIENT ?? ''
  const ADSENSE_SLOT = import.meta.env.VITE_ADS_ADSENSE_SLOT ?? ''

  useEffect(() => {
    try {
      const k = `ads:dismissed:${slot}`
      const v = typeof window !== 'undefined' ? localStorage.getItem(k) : null
      if (v) setDismissed(true)
    } catch {}
  }, [slot])

  useEffect(() => {
    if (!ref.current) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) setVisible(true)
      })
    }, { rootMargin: '200px' })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!visible || dismissed || loaded) return
    if (!ADS_ENABLED || ADS_PROVIDER !== 'adsense') return
    if (user) return // registered users see no ads
    // load AdSense script lazily
    if (typeof window === 'undefined') return
    try {
      if (!(window as any).adsbygoogle && ADSENSE_CLIENT) {
        const s = document.createElement('script')
        s.async = true
        s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`
        s.crossOrigin = 'anonymous'
        document.head.appendChild(s)
        s.onload = () => {
          setLoaded(true)
          try { (window as any).adsbygoogle = (window as any).adsbygoogle || []; (window as any).adsbygoogle.push({}) } catch {}
        }
      } else {
        setLoaded(true)
        try { (window as any).adsbygoogle = (window as any).adsbygoogle || []; (window as any).adsbygoogle.push({}) } catch {}
      }
    } catch (e) {
      // ignore
    }
  }, [visible, dismissed, loaded, ADS_ENABLED, ADS_PROVIDER, ADSENSE_CLIENT, user, slot])

  const close = () => {
    try { localStorage.setItem(`ads:dismissed:${slot}`, '1') } catch {}
    setDismissed(true)
  }

  if (!ADS_ENABLED || ADS_PROVIDER !== 'adsense' || dismissed || user) return null

  return (
    <div ref={ref} className={`w-full flex justify-center ${className}`}>
      <div className="bg-stone-800 text-center rounded p-1 w-full max-w-4xl relative">
        <button onClick={close} className="absolute right-2 top-1 text-slate-400">×</button>
        <div className="mx-auto" style={{ maxWidth: 970 }}>
          <ins className="adsbygoogle"
            style={{ display: 'block' }}
            data-ad-client={ADSENSE_CLIENT}
            data-ad-slot={ADSENSE_SLOT}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>
      </div>
    </div>
  )
}
