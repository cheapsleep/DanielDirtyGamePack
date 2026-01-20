import { useEffect } from 'react'

type CalamityEvent = { by: string; victimId: string; card?: any } | null

export default function CalamityExplosion({ event, players }: { event: CalamityEvent; players?: any[] }) {
  useEffect(() => {
    if (!event) return
    // could play a sound here in future
  }, [event])

  if (!event) return null

  const victim = players?.find((p: any) => p.id === event.victimId)
  const byPlayer = players?.find((p: any) => p.id === event.by)

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative text-center text-white max-w-lg px-6">
        <div className="text-8xl animate-explode">💥</div>
        <div className="mt-4 text-lg font-bold">Calamity Struck!</div>
        <div className="mt-2 text-sm text-white/90">
          {byPlayer ? byPlayer.name : event.by} played the Calamity — {victim ? victim.name : event.victimId} draws 128 cards!
        </div>
      </div>
      <style>{`
        @keyframes explode {
          0% { transform: scale(0.6) rotate(0deg); opacity: 0 }
          30% { transform: scale(1.15) rotate(6deg); opacity: 1 }
          60% { transform: scale(0.95) rotate(-6deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        .animate-explode { animation: explode 900ms cubic-bezier(.2,.9,.2,1); }
      `}</style>
    </div>
  )
}
