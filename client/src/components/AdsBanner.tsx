import { useEffect, useRef, useState } from 'react'
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
  const [loadError, setLoadError] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  const ADS_ENABLED = (import.meta.env.VITE_ADS_ENABLED ?? 'false') === 'true'
  const ADS_PROVIDER = (import.meta.env.VITE_ADS_PROVIDER ?? '').toLowerCase()
  let ADSENSE_CLIENT = (import.meta.env.VITE_ADS_ADSENSE_CLIENT ?? '').toString()
  const ADSENSE_SLOT = import.meta.env.VITE_ADS_ADSENSE_SLOT ?? ''
  const ADS_TEST_MODE = (import.meta.env.VITE_ADS_TEST_MODE ?? 'false') === 'true'
  // Ezoic script URL (e.g. //g.ezoic.net/<id>); set VITE_EZOIC_SCRIPT_URL in client env
  const EZOIC_SCRIPT_URL = (import.meta.env.VITE_EZOIC_SCRIPT_URL ?? '').toString()
  // Accept publisher ids that start with "pub-" by normalizing to "ca-pub-..."
  if (ADSENSE_CLIENT && ADSENSE_CLIENT.startsWith('pub-')) {
    ADSENSE_CLIENT = `ca-${ADSENSE_CLIENT}`
  }

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
    if (!ADS_ENABLED || (ADS_PROVIDER !== 'adsense' && ADS_PROVIDER !== 'ezoic')) return
    if (user) return // registered users see no ads
    // load AdSense script lazily
    if (typeof window === 'undefined') return
    try {
      if (ADS_PROVIDER === 'adsense') {
        console.debug('[AdsBanner] visible, loading adsense:', { ADSENSE_CLIENT, ADSENSE_SLOT, ADS_TEST_MODE })
        if (!(window as any).adsbygoogle && ADSENSE_CLIENT) {
          const s = document.createElement('script')
          s.async = true
          s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`
          s.crossOrigin = 'anonymous'
          s.onload = () => {
            setLoaded(true)
            try { (window as any).adsbygoogle = (window as any).adsbygoogle || []; (window as any).adsbygoogle.push({}) } catch {}
          }
          s.onerror = (e) => {
            console.warn('[AdsBanner] AdSense script error', e)
            setLoadError(true)
          }
          document.head.appendChild(s)
        } else {
          setLoaded(true)
          try { (window as any).adsbygoogle = (window as any).adsbygoogle || []; (window as any).adsbygoogle.push({}) } catch (e) { console.warn('[AdsBanner] push failed', e); setLoadError(true) }
        }
      } else if (ADS_PROVIDER === 'ezoic') {
        console.debug('[AdsBanner] visible, loading ezoic script:', { EZOIC_SCRIPT_URL })
        if (!EZOIC_SCRIPT_URL) {
          console.warn('[AdsBanner] VITE_EZOIC_SCRIPT_URL not set')
          setLoadError(true)
        } else {
          const s = document.createElement('script')
          s.async = true
          s.src = EZOIC_SCRIPT_URL
          s.onload = () => { setLoaded(true) }
          s.onerror = (e) => { console.warn('[AdsBanner] Ezoic script error', e); setLoadError(true) }
          document.head.appendChild(s)
        }
      }
    } catch (e) {
      console.warn('[AdsBanner] failed to load adsense script', e)
      setLoadError(true)
    }
  }, [visible, dismissed, loaded, ADS_ENABLED, ADS_PROVIDER, ADSENSE_CLIENT, user, slot, EZOIC_SCRIPT_URL])

  const close = () => {
    try { localStorage.setItem(`ads:dismissed:${slot}`, '1') } catch {}
    setDismissed(true)
  }

  if (!ADS_ENABLED || (ADS_PROVIDER !== 'adsense' && ADS_PROVIDER !== 'ezoic') || dismissed || user) return null

  return (
    <div ref={ref} className={`w-full flex justify-center ${className}`}>
      <div className="bg-stone-800 text-center rounded p-1 w-full max-w-4xl relative">
        <button onClick={close} className="absolute right-2 top-1 text-slate-400">×</button>
        <div className="mx-auto" style={{ maxWidth: 970 }}>
          { (ADS_TEST_MODE || loadError) ? (
            <div className="w-full bg-slate-700 border border-slate-600 text-center rounded p-6">
              <div className="text-xl font-bold">Test Ad</div>
              <div className="text-sm text-slate-400">This is a placeholder for ads (test mode or script load failed).</div>
            </div>
          ) : (
            ADS_PROVIDER === 'adsense' ? (
              <ins className="adsbygoogle"
                style={{ display: 'block' }}
                data-ad-client={ADSENSE_CLIENT}
                data-ad-slot={ADSENSE_SLOT}
                data-ad-format="auto"
                data-full-width-responsive="true"
                {...(ADS_TEST_MODE ? { 'data-adtest': 'on' } : {})}
              />
            ) : (
              // Ezoic: render a placeholder node the Ezoic script can target. Ezoic will auto-fill ad slots when configured.
              <div id={`ezoic-ad-${slot}`} className="ezoic-ad-slot" style={{ minHeight: 60 }} data-ez-slot={slot} />
            )
          )}
          {ADS_TEST_MODE && <div className="text-xs text-slate-400 mt-1">(Ad test mode enabled)</div>}
        </div>
      </div>
    </div>
  )
}
