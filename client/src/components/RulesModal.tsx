import React, { useState, useEffect } from 'react'

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
            <p>Card Calamity is an Uno-like shedding game. Players take turns playing a card that matches the current color or value, or play special cards to affect turn order and draw stacks.</p>
          </div>
          <div>
            <p className="font-semibold">Setup</p>
            <ul className="list-disc pl-5">
              <li>Each player is dealt 7 cards.</li>
              <li>One card is flipped to start the discard pile (special rules for wild4 are handled by the server).</li>
              <li>Active color is set from the top discard or chosen after wilds.</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold">Turn Play</p>
            <ul className="list-disc pl-5">
              <li>On your turn you may play a card from your hand that matches color or value/type, or play a Wild/Wild4 or Calamity.</li>
              <li>If you cannot (or choose not to) play, you must draw cards (draw count depends on any active draw stack).</li>
              <li>Action cards: <strong>Skip</strong> skips the next player; <strong>Reverse</strong> flips direction (acts like Skip in 2‑player); <strong>Draw2</strong> adds two to the draw stack.</li>
              <li><strong>Wild</strong> lets the player pick the active color. <strong>Wild4</strong> adds +4 to the draw stack and lets the player pick color (subject to any house rules).</li>
              <li><strong>Calamity</strong> is an extremely rare special card (value +128). When a Calamity is played the next player immediately draws 128 cards, is skipped, and any active draw stack is cleared; the play is announced to all clients with a dramatic effect. Calamity still scores 128 if left in hand at round end.</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold">Scoring</p>
            <ul className="list-disc pl-5">
              <li>When a player empties their hand, the round ends.</li>
              <li>Each remaining player's hand is scored: number cards = face value; Skip/Reverse/Draw2 = 20; Wild/Wild4 = 50; Calamity = 128.</li>
              <li>The winner receives the sum of all opponents' remaining-card points; other players receive their own remaining-card total as their score for the round.</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold">Notes</p>
            <ul className="list-disc pl-5">
              <li>Calamity is intentionally extremely rare; its appearance can dramatically change scoring.</li>
              <li>House rules (stacking +2/+4, challenge rules for Wild4, etc.) may be enabled via room settings.</li>
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
            <p>One player is the drawer; that player is given a secret word and attempts to draw it. Other players attempt to guess the word as quickly as possible.</p>
          </div>
          <div>
            <p className="font-semibold">Setup & Rounds</p>
            <ul className="list-disc pl-5">
              <li>Rounds and timer length are configured in room settings.</li>
              <li>Each round assigns a drawer; drawers rotate according to the game settings.</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold">Gameplay</p>
            <ul className="list-disc pl-5">
              <li>The drawer receives a short list of candidate words and selects or is assigned one.</li>
              <li>The drawer draws while the timer runs; other players submit guesses via chat.</li>
              <li>Correct guesses are recorded; multiple players can score on the same round depending on timing and local rules.</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold">Scoring & Winning</p>
            <ul className="list-disc pl-5">
              <li>Points are awarded for correct guesses; faster correct guesses typically earn more points.</li>
              <li>After the configured number of rounds, the player with the highest total wins.</li>
            </ul>
          </div>
        </div>
      )

    case 'scribble-scrabble-scrambled':
      return (
        <div className="space-y-3 text-sm text-slate-200">
          <p className="font-bold">Scribble Scrabble (Scrambled) — Rules</p>
          <div>
            <p className="font-semibold">Overview</p>
            <p>This variant hides the real prompt for most players: one player has the true prompt while others receive plausible decoys. Players draw and others vote to identify the real prompt after voting.</p>
          </div>
          <div>
            <p className="font-semibold">Gameplay</p>
            <ul className="list-disc pl-5">
              <li>Each round, one player receives the real prompt; others receive decoy prompts.</li>
              <li>Everyone draws their assigned prompt. Drawings are later shown anonymously for voting.</li>
              <li>Players vote on which drawing they think is the real prompt; points are awarded based on who fooled whom and who guessed correctly.</li>
            </ul>
          </div>
        </div>
      )

    case 'dubiously-patented':
      return (
        <div className="space-y-3 text-sm text-slate-200">
          <p className="font-bold">Dubiously Patented — Rules</p>
          <div>
            <p className="font-semibold">Overview</p>
            <p>Players propose problems and inventions. One player presents a 'patent' (a title + drawing) and others invest points based on how compelling they think it is.</p>
          </div>
          <div>
            <p className="font-semibold">Setup</p>
            <ul className="list-disc pl-5">
              <li>Each player submits a set of 'problems' (prompts) at the start of the round.</li>
              <li>The presenter receives one of the chosen problems and creates a title and drawing/solution for it.</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold">Investing Phase</p>
            <ul className="list-disc pl-5">
              <li>After presentations, other players allocate points from their score to 'invest' in the presented idea.</li>
              <li>Investment decisions are secret until all investments are submitted or the timer runs out.</li>
              <li>Points invested are transferred according to room scoring rules (see UI for exact mechanics).</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold">Scoring & Notes</p>
            <ul className="list-disc pl-5">
              <li>Winners and payouts are calculated based on investments and presentation order; check the in-game results for breakdowns.</li>
              <li>Be creative and humorous — the game rewards entertaining concepts.</li>
            </ul>
          </div>
        </div>
      )

    case 'nasty-libs':
      return (
        <div className="space-y-3 text-sm text-slate-200">
          <p className="font-bold">Nasty Libs — Rules</p>
          <div>
            <p className="font-semibold">Overview</p>
            <p>Nasty Libs is a prompt-and-answer party game (Mad Libs style): players submit humorous prompts and answers, then vote on the best answers.</p>
          </div>
          <div>
            <p className="font-semibold">Round Flow</p>
            <ul className="list-disc pl-5">
              <li><strong>Prompt Submission:</strong> Players submit prompts (usually a template with blanks).</li>
              <li><strong>Contestants:</strong> A subset of players are chosen as contestants who will answer a selected prompt.</li>
              <li><strong>Answering:</strong> Contestants submit answers matching the prompt's blanks.</li>
              <li><strong>Voting:</strong> All players (except the answer author where applicable) vote on the funniest or best answer.</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold">Scoring & Notes</p>
            <ul className="list-disc pl-5">
              <li>Votes determine the winner(s) of each round; scoring is displayed in the results screen.</li>
              <li>Keep submissions within community guidelines — offensive content may be moderated.</li>
            </ul>
          </div>
        </div>
      )

    case 'autism-assessment':
      return (
        <div className="space-y-3 text-sm text-slate-200">
          <p className="font-bold">Autism Assessment — Rules</p>
          <div>
            <p className="font-semibold">Overview</p>
            <p>This mode presents social-style questions for players to agree/disagree with. It is a gameized questionnaire intended for entertainment.</p>
          </div>
          <div>
            <p className="font-semibold">Gameplay</p>
            <ul className="list-disc pl-5">
              <li>Each round a question is shown to players who indicate whether they agree, disagree, or choose neutral/timeout.</li>
              <li>Points are awarded according to how responses compare to expected answers or consensus (see UI for scoring details).</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold">Notes & Sensitivity</p>
            <ul className="list-disc pl-5">
              <li>This mode is meant for light-hearted entertainment and should not be used as a real assessment.</li>
              <li>Avoid personal or sensitive data and follow community guidelines.</li>
            </ul>
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
            <p>Card Calamity is an Uno-like shedding game. Players take turns playing a card that matches the current color or value, or play special cards to affect turn order and draw stacks.</p>
          </div>
          <div>
            <p className="font-semibold">Setup</p>
            <ul className="list-disc pl-5">
              <li>Each player is dealt 7 cards.</li>
              <li>One card is flipped to start the discard pile (special rules for wild4 are handled by the server).</li>
              <li>Active color is set from the top discard or chosen after wilds.</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold">Turn Play</p>
            <ul className="list-disc pl-5">
              <li>On your turn you may play a card from your hand that matches color or value/type, or play a Wild/Wild4 or Calamity.</li>
              <li>If you cannot (or choose not to) play, you must draw cards (draw count depends on any active draw stack).</li>
              <li>Action cards: <strong>Skip</strong> skips the next player; <strong>Reverse</strong> flips direction (acts like Skip in 2‑player); <strong>Draw2</strong> adds two to the draw stack.</li>
              <li><strong>Wild</strong> lets the player pick the active color. <strong>Wild4</strong> adds +4 to the draw stack and lets the player pick color (subject to any house rules).</li>
                <li><strong>Calamity</strong> is an extremely rare special card (value +128). When a Calamity is played the next player immediately draws 128 cards, is skipped, and any active draw stack is cleared; the play is announced to all clients with a dramatic effect. Calamity still scores 128 if left in hand at round end.</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold">Scoring</p>
            <ul className="list-disc pl-5">
              <li>When a player empties their hand, the round ends.</li>
              <li>Each remaining player's hand is scored: number cards = face value; Skip/Reverse/Draw2 = 20; Wild/Wild4 = 50; Calamity = 128.</li>
              <li>The winner receives the sum of all opponents' remaining-card points; other players receive their own remaining-card total as their score for the round.</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold">Notes</p>
            <ul className="list-disc pl-5">
              <li>Calamity is intentionally extremely rare; its appearance can dramatically change scoring.</li>
              <li>House rules (stacking +2/+4, challenge rules for Wild4, etc.) may be enabled via room settings.</li>
            </ul>
          </div>
        </div>
      )

    case 'scribble-scrabble':
      return (
        <div className="space-y-3 text-sm text-slate-200">
          <p className="font-bold">Scribble Scrabble — Rules (Detailed)</p>
                    <p className="font-bold">Scribble Scrabble — Rules</p>
          <div>
            <p className="font-semibold">Overview</p>
            <p>One player is the drawer; that player is given a secret word and attempts to draw it. Other players attempt to guess the word as quickly as possible.</p>
          </div>
          <div>
            <p className="font-semibold">Setup & Rounds</p>
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
                        <p>Card Calamity is an Uno-like shedding game. Players take turns playing a card that matches the current color or value, or play special cards to affect turn order and draw stacks.</p>
                      </div>
                      <div>
                        <p className="font-semibold">Setup</p>
                        <ul className="list-disc pl-5">
                          <li>Each player is dealt 7 cards.</li>
                          <li>One card is flipped to start the discard pile (special rules for wild4 are handled by the server).</li>
                          <li>Active color is set from the top discard or chosen after wilds.</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold">Turn Play</p>
                        <ul className="list-disc pl-5">
                          <li>On your turn you may play a card from your hand that matches color or value/type, or play a Wild/Wild4 or Calamity.</li>
                          <li>If you cannot (or choose not to) play, you must draw cards (draw count depends on any active draw stack).</li>
                          <li>Action cards: <strong>Skip</strong> skips the next player; <strong>Reverse</strong> flips direction (acts like Skip in 2‑player); <strong>Draw2</strong> adds two to the draw stack.</li>
                          <li><strong>Wild</strong> lets the player pick the active color. <strong>Wild4</strong> adds +4 to the draw stack and lets the player pick color (subject to any house rules).</li>
                          <li><strong>Calamity</strong> is an extremely rare special card (value +128). When a Calamity is played the next player immediately draws 128 cards, is skipped, and any active draw stack is cleared; the play is announced to all clients with a dramatic effect. Calamity still scores 128 if left in hand at round end.</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold">Scoring</p>
                        <ul className="list-disc pl-5">
                          <li>When a player empties their hand, the round ends.</li>
                          <li>Each remaining player's hand is scored: number cards = face value; Skip/Reverse/Draw2 = 20; Wild/Wild4 = 50; Calamity = 128.</li>
                          <li>The winner receives the sum of all opponents' remaining-card points; other players receive their own remaining-card total as their score for the round.</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold">Notes</p>
                        <ul className="list-disc pl-5">
                          <li>Calamity is intentionally extremely rare; its appearance can dramatically change scoring.</li>
                          <li>House rules (stacking +2/+4, challenge rules for Wild4, etc.) may be enabled via room settings.</li>
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
                        <p>One player is the drawer; that player is given a secret word and attempts to draw it. Other players attempt to guess the word as quickly as possible.</p>
                      </div>
                      <div>
                        <p className="font-semibold">Setup & Rounds</p>
                        <ul className="list-disc pl-5">
                          <li>Rounds and timer length are configured in room settings.</li>
                          <li>Each round assigns a drawer; drawers rotate according to the game settings.</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold">Gameplay</p>
                        <ul className="list-disc pl-5">
                          <li>The drawer receives a short list of candidate words and selects or is assigned one.</li>
                          <li>The drawer draws while the timer runs; other players submit guesses via chat.</li>
                          <li>Correct guesses are recorded; multiple players can score on the same round depending on timing and local rules.</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold">Scoring & Winning</p>
                        <ul className="list-disc pl-5">
                          <li>Points are awarded for correct guesses; faster correct guesses typically earn more points.</li>
                          <li>After the configured number of rounds, the player with the highest total wins.</li>
                        </ul>
                      </div>
                    </div>
                  )

                case 'scribble-scrabble-scrambled':
                  return (
                    <div className="space-y-3 text-sm text-slate-200">
                      <p className="font-bold">Scribble Scrabble (Scrambled) — Rules</p>
                      <div>
                        <p className="font-semibold">Overview</p>
                        <p>This variant hides the real prompt for most players: one player has the true prompt while others receive plausible decoys. Players draw and others vote to identify the real prompt after voting.</p>
                      </div>
                      <div>
                        <p className="font-semibold">Gameplay</p>
                        <ul className="list-disc pl-5">
                          <li>Each round, one player receives the real prompt; others receive decoy prompts.</li>
                          <li>Everyone draws their assigned prompt. Drawings are later shown anonymously for voting.</li>
                          <li>Players vote on which drawing they think is the real prompt; points are awarded based on who fooled whom and who guessed correctly.</li>
                        </ul>
                      </div>
                    </div>
                  )

                case 'dubiously-patented':
                  return (
                    <div className="space-y-3 text-sm text-slate-200">
                      <p className="font-bold">Dubiously Patented — Rules</p>
                      <div>
                        <p className="font-semibold">Overview</p>
                        <p>Players propose problems and inventions. One player presents a 'patent' (a title + drawing) and others invest points based on how compelling they think it is.</p>
                      </div>
                      <div>
                        <p className="font-semibold">Setup</p>
                        <ul className="list-disc pl-5">
                          <li>Each player submits a set of 'problems' (prompts) at the start of the round.</li>
                          <li>The presenter receives one of the chosen problems and creates a title and drawing/solution for it.</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold">Investing Phase</p>
                        <ul className="list-disc pl-5">
                          <li>After presentations, other players allocate points from their score to 'invest' in the presented idea.</li>
                          <li>Investment decisions are secret until all investments are submitted or the timer runs out.</li>
                          <li>Points invested are transferred according to room scoring rules (see UI for exact mechanics).</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold">Scoring & Notes</p>
                        <ul className="list-disc pl-5">
                          <li>Winners and payouts are calculated based on investments and presentation order; check the in-game results for breakdowns.</li>
                          <li>Be creative and humorous — the game rewards entertaining concepts.</li>
                        </ul>
                      </div>
                    </div>
                  )

                case 'nasty-libs':
                  return (
                    <div className="space-y-3 text-sm text-slate-200">
                      <p className="font-bold">Nasty Libs — Rules</p>
                      <div>
                        <p className="font-semibold">Overview</p>
                        <p>Nasty Libs is a prompt-and-answer party game (Mad Libs style): players submit humorous prompts and answers, then vote on the best answers.</p>
                      </div>
                      <div>
                        <p className="font-semibold">Round Flow</p>
                        <ul className="list-disc pl-5">
                          <li><strong>Prompt Submission:</strong> Players submit prompts (usually a template with blanks).</li>
                          <li><strong>Contestants:</strong> A subset of players are chosen as contestants who will answer a selected prompt.</li>
                          <li><strong>Answering:</strong> Contestants submit answers matching the prompt's blanks.</li>
                          <li><strong>Voting:</strong> All players (except the answer author where applicable) vote on the funniest or best answer.</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold">Scoring & Notes</p>
                        <ul className="list-disc pl-5">
                          <li>Votes determine the winner(s) of each round; scoring is displayed in the results screen.</li>
                          <li>Keep submissions within community guidelines — offensive content may be moderated.</li>
                        </ul>
                      </div>
                    </div>
                  )

                case 'autism-assessment':
                  return (
                    <div className="space-y-3 text-sm text-slate-200">
                      <p className="font-bold">Autism Assessment — Rules</p>
                      <div>
                        <p className="font-semibold">Overview</p>
                        <p>This mode presents social-style questions for players to agree/disagree with. It is a gameized questionnaire intended for entertainment.</p>
                      </div>
                      <div>
                        <p className="font-semibold">Gameplay</p>
                        <ul className="list-disc pl-5">
                          <li>Each round a question is shown to players who indicate whether they agree, disagree, or choose neutral/timeout.</li>
                          <li>Points are awarded according to how responses compare to expected answers or consensus (see UI for scoring details).</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold">Notes & Sensitivity</p>
                        <ul className="list-disc pl-5">
                          <li>This mode is meant for light-hearted entertainment and should not be used as a real assessment.</li>
                          <li>Avoid personal or sensitive data and follow community guidelines.</li>
                        </ul>
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
