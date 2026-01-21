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
				<div className="space-y-3 text-sm sm:text-base text-slate-200">
					<p className="font-bold">Card Calamity — Rules</p>

					<div>
						<p className="font-semibold">Overview</p>
						<p>
							Card Calamity is a shedding game inspired by Uno. Players match color or value and use action cards to
							influence play order and draw stacks.
						</p>
					</div>

					<div>
						<p className="font-semibold">Setup</p>
						<ul className="list-disc pl-5">
							<li>Deal 7 cards to each player.</li>
							<li>Flip one card to start the discard pile; server resolves any ambiguous Wild4 starts.</li>
							<li>Active color is taken from the top discard or chosen after Wild plays.</li>
						</ul>
					</div>

					<div>
						<p className="font-semibold">Card Types & Effects</p>
						<ul className="list-disc pl-5">
							<li><strong>Number</strong>: match color or number.</li>
							<li><strong>Skip</strong>: next player loses their turn.</li>
							<li><strong>Reverse</strong>: reverses play order (acts as Skip in 2-player).</li>
							<li><strong>Draw2</strong>: adds +2 to the current draw stack.</li>
							<li><strong>Wild</strong>: choose active color.</li>
							<li>
								<strong>Wild4</strong>: adds +4 to draw stack and lets player choose color (follow room challenge rules).
							</li>
							<li>
								<strong>Calamity</strong>: extremely rare (value = 128). When played: the next player immediately draws 128 cards,
								is skipped, and any active draw stack is cleared. The play is broadcast with dramatic UI effects.
							</li>
						</ul>
					</div>

					<div>
						<p className="font-semibold">Turn Flow</p>
						<ul className="list-disc pl-5">
							<li>On your turn, play a legal card or draw (if drawing, depending on active draw stack you may draw multiple).</li>
							<li>When playing Draw cards, the draw stack accumulates until a non-draw card resolves it or a Calamity clears it.</li>
							<li>Emptying your hand ends the round; remaining hands are scored.</li>
						</ul>
					</div>

					<div>
						<p className="font-semibold">Scoring</p>
						<ul className="list-disc pl-5">
							<li>Number cards = face value.</li>
							<li>Skip/Reverse/Draw2 = 20 points each.</li>
							<li>Wild/Wild4 = 50 points each.</li>
							<li>Calamity = 128 points.</li>
						</ul>
					</div>
				</div>
			)

		case 'scribble-scrabble':
			return (
				<div className="space-y-3 text-sm sm:text-base text-slate-200">
					<p className="font-bold">Scribble Scrabble — Rules</p>

					<div>
						<p className="font-semibold">Overview</p>
						<p>
							One player (the drawer) receives a secret word and draws it while others guess via chat. Fast, accurate guesses earn
							higher points.
						</p>
					</div>

					<div>
						<p className="font-semibold">Setup & Rounds</p>
						<ul className="list-disc pl-5">
							<li>Rounds and timer length are set in room settings.</li>
							<li>Each round assigns one drawer and multiple guessers.</li>
						</ul>
					</div>

					<div>
						<p className="font-semibold">Gameplay</p>
						<ul className="list-disc pl-5">
							<li>Drawer draws; guessers submit guesses in chat. Correct guesses are recorded and scored.</li>
							<li>Multiple players can score on the same round depending on timing.</li>
						</ul>
					</div>
				</div>
			)

		case 'scribble-scrabble-scrambled':
			return (
				<div className="space-y-3 text-sm sm:text-base text-slate-200">
					<p className="font-bold">Scribble Scrabble: Scrambled — (Paper‑Telephone Variant)</p>
					<div>
						<p className="font-semibold">Overview</p>
						<p>
							Players take turns in a chain: the first player writes a short text prompt, the next player draws it, the next writes a caption describing the drawing, then the next draws that caption, and so on until the chain returns to the origin — then the full chain is revealed for laughs.
						</p>
					</div>
					<div>
						<p className="font-semibold">Round Flow (short)</p>
						<ul className="list-disc pl-5">
							<li>Round starts with a text prompt from the first player.</li>
							<li>Players alternate: draw → caption → draw → caption until every player has contributed (full circle).</li>
							<li>After the chain completes, everyone votes for the funniest or best item (drawing or caption).</li>
							<li>No scores are awarded — votes are shown and the top two items are highlighted.</li>
						</ul>
					</div>
					<div>
						<p className="font-semibold">Tips & Notes</p>
						<ul className="list-disc pl-5">
							<li>First prompt is text by default.</li>
							<li>For groups smaller than 4, the chain will loop so contributions are repeated to keep things funny.</li>
							<li>Reveal shows the chain chronologically; author names stay hidden until reveal completes.</li>
							<li>Be playful and keep content within community guidelines.</li>
						</ul>
					</div>
				</div>
			)

		case 'dubiously-patented':
			return (
				<div className="space-y-3 text-sm sm:text-base text-slate-200">
					<p className="font-bold">Dubiously Patented — Rules</p>
					<div>
						<p className="font-semibold">Overview</p>
						<p>
							Players invent or pitch humorous solutions to problems; others invest points in ideas they like. Creativity is rewarded.
						</p>
						</div>
					<div>
						<p className="font-semibold">Round Flow</p>
						<ul className="list-disc pl-5">
							<li>Players submit problem prompts; a presenter receives one and creates title/drawing/solution.</li>
							<li>After presentation, players secretly invest points from their score into presented ideas.</li>
							<li>Investments are revealed and payouts calculated per room rules.</li>
						</ul>
					</div>
				</div>
			)

		case 'nasty-libs':
			return (
				<div className="space-y-3 text-sm sm:text-base text-slate-200">
					<p className="font-bold">Nasty Libs — Rules</p>
					<div>
						<p className="font-semibold">Overview</p>
						<p>
							Prompt-and-answer party game (Mad Libs style): players submit prompts and answers; others vote on the best/funniest.
						</p>
						</div>
					<div>
						<p className="font-semibold">Round Flow</p>
						<ul className="list-disc pl-5">
							<li>Players submit prompts; a subset answer and all players vote on winners.</li>
							<li>Votes determine round winners; scoring follows room settings.</li>
						</ul>
					</div>
				</div>
			)

		case 'autism-assessment':
			return (
				<div className="space-y-3 text-sm sm:text-base text-slate-200">
					<p className="font-bold">Autism Assessment — Rules</p>
					<div>
						<p className="font-semibold">Overview</p>
						<p>
							Light-hearted questionnaire mode presenting social-style questions for entertainment; not a medical tool.
						</p>
						</div>
					<div>
						<p className="font-semibold">Gameplay</p>
						<ul className="list-disc pl-5">
							<li>Players respond to prompts; points are awarded per room scoring rules.</li>
							<li>Respect privacy and keep content within community guidelines.</li>
						</ul>
					</div>
				</div>
			)

		default:
			return (
				<div className="space-y-3 text-sm sm:text-base text-slate-200">
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
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
			<div className="bg-slate-800 rounded-xl p-4 sm:p-6 w-full max-w-lg sm:max-w-3xl max-h-[90vh] overflow-auto shadow-xl">
				<div className="flex justify-between items-start">
					<h3 className="text-lg font-bold">Rules</h3>
					<button className="text-slate-300" onClick={close}>✕</button>
				</div>
				<div className="mt-4">{getRules(gameId)}</div>
				<div className="mt-6 sm:mt-4 sm:flex sm:justify-end">
					<button onClick={close} className="w-full sm:w-auto px-4 py-2 bg-indigo-600 rounded text-white">Close</button>
				</div>
			</div>
		</div>
	)
}

