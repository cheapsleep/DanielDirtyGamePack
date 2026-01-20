import { useState, useEffect } from 'react'

type Props = {
  gameId: string | undefined
  open?: boolean
  onClose?: () => void
}

function getRules(gameId?: string) {
  switch (gameId) {
    case 'card-calamity':
      return (
        <div className="space-y-3 text-sm text-slate-200">
          <p className="font-bold">Card Calamity — Rules</p>
          <ul className="list-disc pl-5">
            <li>Standard Uno-like play: match color or value, or play wilds.</li>
            <li>Action cards: Skip, Reverse, Draw2 have usual effects.</li>
            <li>Wild & Wild4 let you pick a color; Wild4 adds +4 to draw stack.</li>
            <li>Calamity card (extremely rare): value +128. It can be played anytime.</li>
            <li>Scoring: when a player empties their hand, the winner receives the sum of points from all opponents' remaining cards.</li>
            <li>Card point values: number cards = face value; Skip/Reverse/Draw2 = 20; Wild/Wild4 = 50; Calamity = 128.</li>
            <li>Have fun — chaos guaranteed when Calamity appears!</li>
          </ul>
        </div>
      )
    case 'scribble-scrabble':
      return (
        <div className="space-y-3 text-sm text-slate-200">
          <p className="font-bold">Scribble Scrabble — Rules</p>
          <ul className="list-disc pl-5">
            <li>One player draws a word while others guess.</li>
            <li>Scoring and rounds depend on room settings.</li>
            <li>Try to be concise and clear — no offensive content.</li>
          </ul>
        </div>
      )
    default:
      return (
        <div className="space-y-3 text-sm text-slate-200">
          <p className="font-bold">Game Rules</p>
          <p>No specific rules available for this game.</p>
        </div>
      )
  }
}

export default function RulesModal({ gameId, open = false, onClose }: Props) {
  const [visible, setVisible] = useState(open)

  useEffect(() => {
    setVisible(open)
  }, [open])

  const close = () => {
    setVisible(false)
    onClose && onClose()
  }

  return (
    <> 
      {visible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-2xl shadow-xl">
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-bold">Rules</h3>
              <button className="text-slate-300" onClick={close}>✕</button>
            </div>
            <div className="mt-4">
              {getRules(gameId)}
            </div>
            <div className="mt-6 text-right">
              <button onClick={close} className="px-4 py-2 bg-indigo-600 rounded text-white">Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
