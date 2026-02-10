import { useEffect, useMemo, useRef, useState } from 'react'

const API_BASE = 'http://localhost:5117'
const DEFAULT_DURATION = 30

const formatTime = (ms) => {
  const totalSeconds = Math.max(Math.ceil(ms / 1000), 0)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const formatFinishTime = (ms) => {
  const totalSeconds = (ms / 1000).toFixed(1)
  return `${totalSeconds}s`
}

function App() {
  const [nameInput, setNameInput] = useState('')
  const [participants, setParticipants] = useState([])
  const [duration, setDuration] = useState(DEFAULT_DURATION)
  const [raceData, setRaceData] = useState(null)
  const [currentTick, setCurrentTick] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState('')
  const [liveResults, setLiveResults] = useState([])
  const finishedRacersRef = useRef(new Set())

  const tickMs = raceData?.tickMs ?? 100
  const totalDurationMs = (raceData?.durationSeconds ?? duration) * 1000
  const timeLeftMs = totalDurationMs - currentTick * tickMs

  const positions = useMemo(() => {
    if (!raceData) return {}
    const tick = raceData.ticks[Math.min(currentTick, raceData.ticks.length - 1)]
    return tick.positions.reduce((acc, item) => {
      acc[item.id] = item.position
      return acc
    }, {})
  }, [raceData, currentTick])

  // Track racers crossing the finish line and update live results
  useEffect(() => {
    if (!raceData || !isRunning) return

    const trackLength = raceData.trackLength
    const currentTimeMs = currentTick * tickMs

    raceData.racers.forEach((racer) => {
      const position = positions[racer.id] ?? 0
      
      if (position >= trackLength && !finishedRacersRef.current.has(racer.id)) {
        finishedRacersRef.current.add(racer.id)
        setLiveResults((prev) => {
          const newResult = {
            id: racer.id,
            name: racer.name,
            finishTimeMs: currentTimeMs,
            place: prev.length + 1
          }
          return [...prev, newResult]
        })
      }
    })
  }, [raceData, positions, currentTick, tickMs, isRunning])

  useEffect(() => {
    if (!isRunning || !raceData) return undefined

    const maxTick = raceData.ticks.length - 1
    const interval = setInterval(() => {
      setCurrentTick((prev) => {
        if (prev >= maxTick) {
          clearInterval(interval)
          setIsRunning(false)
          
          const totalDurationMs = raceData.durationSeconds * 1000
          raceData.racers.forEach((racer) => {
            if (!finishedRacersRef.current.has(racer.id)) {
              finishedRacersRef.current.add(racer.id)
              setLiveResults((prevResults) => {
                const newResult = {
                  id: racer.id,
                  name: racer.name,
                  finishTimeMs: totalDurationMs,
                  place: prevResults.length + 1
                }
                return [...prevResults, newResult]
              })
            }
          })
          
          return prev
        }
        return prev + 1
      })
    }, tickMs)

    return () => clearInterval(interval)
  }, [isRunning, raceData, tickMs])

  const addParticipant = () => {
    const trimmed = nameInput.trim()
    if (!trimmed) {
      setError('Enter a participant name before adding.')
      return
    }
    if (participants.length >= 12) {
      setError('Participant limit reached (12).')
      return
    }
    setParticipants((prev) => [...prev, trimmed])
    setNameInput('')
    setError('')
  }

  const removeParticipant = (index) => {
    setParticipants((prev) => prev.filter((_, i) => i !== index))
  }

  const clearParticipants = () => {
    setParticipants([])
    setError('')
  }

  const startRace = async () => {
    if (isRunning) return
    if (participants.length === 0) {
      setError('Add at least one participant to start the race.')
      return
    }
    if (duration < 5 || duration > 180) {
      setError('Duration must be between 5 and 180 seconds.')
      return
    }

    setError('')
    setCurrentTick(0)
    setRaceData(null)
    setLiveResults([])
    finishedRacersRef.current = new Set()

    try {
      const response = await fetch(`${API_BASE}/api/race/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participants, durationSeconds: duration }),
      })

      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload?.detail || 'Failed to start the race.')
      }

      const data = await response.json()
      setRaceData(data)
      setIsRunning(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start the race.')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-slate-400">
              Custom Race Simulator
            </p>
            <h1 className="font-display text-4xl font-semibold text-slate-900">
              Rigged finishes. Real drama.
            </h1>
            <p className="mt-2 max-w-xl text-base text-slate-600">
              Add racers, set the countdown, and watch the final 10% deliver the guaranteed overtake.
            </p>
          </div>
          <div className="rounded-3xl bg-white/80 p-4 shadow-glow backdrop-blur">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Countdown</p>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="number"
                min={5}
                max={180}
                value={duration}
                disabled={isRunning}
                onChange={(event) => setDuration(Number(event.target.value))}
                className="w-24 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-lg font-semibold text-slate-900 focus:border-slate-400 focus:outline-none"
              />
              <span className="text-sm text-slate-500">seconds</span>
            </div>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
          <section className="panel-animate space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-glow">
            <div>
              <h2 className="font-display text-xl font-semibold text-slate-900">Participants</h2>
              <p className="text-sm text-slate-500">Build the field before launching the race.</p>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nameInput}
                  disabled={isRunning}
                  onChange={(event) => setNameInput(event.target.value)}
                  placeholder="Add racer name"
                  className="flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') addParticipant()
                  }}
                />
                <button
                  type="button"
                  onClick={addParticipant}
                  disabled={isRunning}
                  className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  Add
                </button>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{participants.length} / 12 racers</span>
                <button
                  type="button"
                  onClick={clearParticipants}
                  disabled={isRunning || participants.length === 0}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Clear all
                </button>
              </div>
            </div>

            <ul className="space-y-2">
              {participants.map((name, index) => (
                <li
                  key={`${name}-${index}`}
                  className="flex items-center justify-between rounded-2xl border border-slate-100 px-3 py-2 text-sm"
                >
                  <span className="text-slate-700">{name}</span>
                  <button
                    type="button"
                    onClick={() => removeParticipant(index)}
                    disabled={isRunning}
                    className="text-xs font-semibold text-slate-400 transition hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>

            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                {error}
              </div>
            )}
          </section>

          <section className="panel-animate relative overflow-hidden rounded-[32px] border border-slate-200 shadow-glow">
            <div className="track-grid track-sheen relative flex h-full min-h-[520px] flex-col gap-4 overflow-hidden p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Live Race</p>
                  <h2 className="font-display text-2xl font-semibold text-white">Main Track</h2>
                </div>
                <div className="timer-chip rounded-2xl px-4 py-2 text-center">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-300">Time Left</p>
                  <p className="font-display text-2xl text-white">{formatTime(timeLeftMs)}</p>
                </div>
              </div>

              <div className="relative flex-1 space-y-3">
                <div className="track-finish absolute right-6 top-0 h-full w-6 rounded-2xl opacity-80" />
                {raceData?.racers?.map((racer) => {
                  const position = positions[racer.id] ?? 0
                  return (
                    <div
                      key={racer.id}
                      className="track-lane relative flex h-12 items-center rounded-2xl border border-white/10 px-4"
                    >
                      <span className="text-xs font-semibold text-slate-200">{racer.name}</span>
                      <div
                        className="emoji-token absolute text-2xl transition-[left]"
                        style={{
                          left: `${Math.min(position, 98)}%`,
                          transform: 'translateX(-50%)',
                          transitionDuration: `${tickMs}ms`,
                        }}
                      >
                        {racer.emoji}
                      </div>
                    </div>
                  )
                })}

                {!raceData && (
                  <div className="flex h-full flex-col items-center justify-center text-center text-slate-200">
                    <p className="text-lg font-semibold">Awaiting racers…</p>
                    <p className="text-sm text-slate-300">Add participants and press start.</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-300">
                  Rigged boost begins at <span className="font-semibold">{raceData ? Math.round((raceData.riggedStartMs / totalDurationMs) * 100) : 90}%</span>
                </div>
                <button
                  type="button"
                  onClick={startRace}
                  disabled={isRunning}
                  className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-200"
                >
                  {isRunning ? 'Race in progress' : 'Start Race'}
                </button>
              </div>
            </div>
          </section>
        </div>

        <section className="panel-animate mt-10 rounded-3xl border border-slate-200 bg-white p-6 shadow-glow">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-2xl font-semibold text-slate-900">Final Results</h2>
              <p className="text-sm text-slate-500">Racers appear as they cross the finish line.</p>
            </div>
            <div className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-500">
              Total time: {formatFinishTime(totalDurationMs)}
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">Place</th>
                  <th className="px-4 py-3">Racer</th>
                  <th className="px-4 py-3">Finish time</th>
                </tr>
              </thead>
              <tbody>
                {liveResults.map((result) => (
                  <tr key={result.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-semibold text-slate-700">#{result.place}</td>
                    <td className="px-4 py-3 text-slate-600">{result.name}</td>
                    <td className="px-4 py-3 text-slate-500">{formatFinishTime(result.finishTimeMs)}</td>
                  </tr>
                ))}
                {liveResults.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-sm text-slate-400">
                      Results will appear after the first race.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}

export default App
