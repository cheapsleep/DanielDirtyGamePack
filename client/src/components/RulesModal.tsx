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

					<div>
						<p className="font-semibold">Overview</p>
						<p>
							Card Calamity is an Uno-like shedding game. Players take turns playing a card that matches the current
							color or value, or play special cards to affect turn order and draw stacks.
						</p>
					</div>

					<div>
						<p className="font-semibold">Setup</p>
						<ul className="list-disc pl-5">
							<li>Each player is dealt 7 cards.</li>
							<li>One card is flipped to start the discard pile (special rules for Wild4 are handled by the server).</li>
							<li>Active color is set from the top discard or chosen after Wilds.</li>
						</ul>
					</div>

					<div>
						<p className="font-semibold">Turn Play</p>
						<ul className="list-disc pl-5">
							<li>
								On your turn you may play a card from your hand that matches color or value/type, or play a Wild/Wild4 or Calamity.
							</li>
							<li>If you cannot (or choose not to) play, you must draw cards (draw count depends on any active draw stack).</li>
							<li>
								Action cards: <strong>Skip</strong> skips the next player; <strong>Reverse</strong> flips direction (acts like Skip in
								2‑player); <strong>Draw2</strong> adds two to the draw stack.
							</li>
							<li>
								<strong>Wild</strong> lets the player pick the active color. <strong>Wild4</strong> adds +4 to the draw stack and lets the
								player pick color (subject to any house rules).
							</li>
							<li>
								<strong>Calamity</strong> is an extremely rare special card (value = 128). When a Calamity is played the next player
								immediately draws 128 cards, is skipped, and any active draw stack is cleared. The play is announced to all players
								with a dramatic effect. Calamity still scores 128 if left in hand at round end.
							</li>
						</ul>
					</div>

					<div>
						<p className="font-semibold">Scoring</p>
						<ul className="list-disc pl-5">
							<li>When a player empties their hand, the round ends.</li>
							<li>Number cards = face value.</li>
							<li>Skip / Reverse / Draw2 = 20 points.</li>
							<li>Wild / Wild4 = 50 points.</li>
							<li>Calamity = 128 points.</li>
						</ul>
					</div>

					<div>
						<p className="font-semibold">Notes</p>
						<ul className="list-disc pl-5">
							<li>Calamity is intentionally extremely rare and can dramatically change the round.</li>
							<li>House rules (stacking +2/+4, challenges, etc.) may be enabled in room settings.</li>
						</ul>
					</div>
				</div>
			)

		case 'scribble-scrabble':
			return (
				<div className="space-y-3 text-sm text-slate-200">
					<p className="font-bold">Scribble Scrabble — Rules</p>
					<div>
						<p className="font-semibold">Overview</p>
						<p>
							One player is the drawer and attempts to illustrate a secret word while others guess. Rounds and timers are configured
							in room settings.
						</p>
					</div>
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

	useEffect(() => setVisible(open), [open])

	const close = () => {
		setVisible(false)
		onClose && onClose()
	}

	if (!visible) return null

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
			<div className="bg-slate-800 rounded-xl p-6 w-full max-w-2xl shadow-xl">
				<div className="flex justify-between items-start">
					<h3 className="text-lg font-bold">Rules</h3>
					<button className="text-slate-300" onClick={close}>✕</button>
				</div>
				<div className="mt-4">{getRules(gameId)}</div>
				<div className="mt-6 text-right">
					<button onClick={close} className="px-4 py-2 bg-indigo-600 rounded text-white">Close</button>
				</div>
			</div>
		</div>
	)
}

