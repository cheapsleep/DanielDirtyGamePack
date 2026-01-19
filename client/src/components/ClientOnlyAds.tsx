import React, { useEffect, useState } from 'react'

export default function ClientOnlyAds(props: { slot?: string; className?: string }) {
  const [Cmp, setCmp] = useState<null | React.ComponentType<any>>(null)

  useEffect(() => {
    let mounted = true
    if (typeof window === 'undefined') return
    import('./AdsBanner').then((m) => {
      if (mounted) setCmp(() => m.default)
    }).catch(() => {
      /* ignore */
    })
    return () => { mounted = false }
  }, [])

  if (!Cmp) return null
  return <Cmp {...props} />
}
