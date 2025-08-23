import { createFileRoute, Link } from '@tanstack/react-router'
import confetti from 'canvas-confetti'
import Peer, { type DataConnection } from 'peerjs'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { cn, generateId } from '@/lib/utils'

export const Route = createFileRoute('/arena')({
    component: RouteComponent
})

export const WIN_THRESHOLD = 4

type ArenaConnectionState = 'idle' | 'listening' | 'error'
type ArenaGameState = 'idle' | 'countdown' | 'running' | 'finished'

function RouteComponent() {
    const peerLoadedRef = useRef(false)
    const [ropePos, setRopePos] = useState(0)
    const [id, setId] = useState<string | null>()
    const [gladiatorIds, setGladiatorIds] = useState<string[]>([])
    const [countdown, setCountdown] = useState<number | null>(null)
    const [status, setStatus] = useState<ArenaConnectionState>('idle')
    const [winnerPeerId, setWinnerPeerId] = useState<string | null>(null)
    const leftRightPeers = useMemo(() => ({ left: gladiatorIds[0], right: gladiatorIds[1] }), [gladiatorIds])

    const videoLeftRef = useRef<HTMLVideoElement | null>(null)
    const videoRightRef = useRef<HTMLVideoElement | null>(null)
    const remoteStreamsRef = useRef<Record<string, MediaStream>>({})

    const gameStateRef = useRef<ArenaGameState>('idle')
    const countdownTimerRef = useRef<number | null>(null)
    const peerNamesRef = useRef<Record<string, string>>({})
    const [readyPeerIds, setReadyPeerIds] = useState<string[]>([])
    const dataConnsRef = useRef<Record<string, DataConnection>>({})
    const [gameState, setGameState] = useState<ArenaGameState>('idle')

    useEffect(() => {
        if (peerLoadedRef.current) {
            return
        }
        peerLoadedRef.current = true

        async function attachStreamToSlot(peerId: string, stream: MediaStream) {
            remoteStreamsRef.current[peerId] = stream
            const index = (Object.keys(remoteStreamsRef.current).indexOf(peerId) % 2) as 0 | 1
            const targetRef = index === 0 ? videoLeftRef : videoRightRef
            if (targetRef.current) {
                targetRef.current.srcObject = stream
                await targetRef.current.play().catch(() => {})
            }
            setGladiatorIds(Object.keys(remoteStreamsRef.current))
        }

        function removeStream(peerId: string) {
            delete remoteStreamsRef.current[peerId]
            const allIds = Object.keys(remoteStreamsRef.current)
            if (videoLeftRef.current) {
                const leftId = allIds[0]
                videoLeftRef.current.srcObject = leftId ? remoteStreamsRef.current[leftId] : null
            }
            if (videoRightRef.current) {
                const rightId = allIds[1]
                videoRightRef.current.srcObject = rightId ? remoteStreamsRef.current[rightId] : null
            }
            setGladiatorIds(allIds)
        }

        const peer = new Peer(`tug-of-war-arena-${generateId()}`)
        peer.on('open', (id) => {
            setId(id.replace('tug-of-war-arena-', ''))
            setStatus('listening')
        })
        peer.on('call', (call) => {
            call.answer(undefined)
            call.on('stream', (remoteStream) => attachStreamToSlot(call.peer, remoteStream))
            call.on('close', () => removeStream(call.peer))
            call.on('error', () => removeStream(call.peer))
        })
        peer.on('connection', (conn) => {
            dataConnsRef.current[conn.peer] = conn
            conn.on('data', (raw) => {
                const { type, name } = raw as { type: 'intro' | 'ready' | 'pull'; name?: string }
                switch (type) {
                    case 'intro':
                        if (name) {
                            peerNamesRef.current[conn.peer] = name
                        }
                        break
                    case 'ready':
                        setReadyPeerIds((prev) => {
                            if (prev.includes(conn.peer)) {
                                return prev
                            }
                            const updated = [...prev, conn.peer]
                            if (updated.length >= 2 && gameStateRef.current === 'idle') {
                                setGameState('countdown')
                                setRopePos(0)
                                setCountdown(3)
                            }
                            return updated
                        })
                        break
                    case 'pull': {
                        if (gameStateRef.current !== 'running') {
                            return
                        }
                        const idx = Object.keys(remoteStreamsRef.current).indexOf(conn.peer)
                        if (idx === -1) {
                            return
                        }
                        const delta = idx % 2 === 0 ? -1 : 1
                        setRopePos((prev) => {
                            if (gameStateRef.current !== 'running') return prev
                            const next = Math.max(-WIN_THRESHOLD, Math.min(WIN_THRESHOLD, prev + delta))
                            if ((next === WIN_THRESHOLD || next === -WIN_THRESHOLD) && gameStateRef.current === 'running') {
                                setGameState('finished')
                                setWinnerPeerId(conn.peer)
                                generateFireworks()
                            }
                            return next
                        })
                    }
                }
            })
            conn.on('close', () => {
                delete dataConnsRef.current[conn.peer]
                setReadyPeerIds((prev) => prev.filter((p) => p !== conn.peer))
            })
            conn.on('error', () => {
                delete dataConnsRef.current[conn.peer]
                setReadyPeerIds((prev) => prev.filter((p) => p !== conn.peer))
            })
        })
        peer.on('disconnected', () => setStatus('idle'))
        peer.on('error', console.error)
    }, [])

    useEffect(() => {
        gameStateRef.current = gameState
    }, [gameState])

    useEffect(() => {
        if (gameState !== 'countdown' || countdown === null) {
            return
        }
        if (countdown <= 0) {
            setCountdown(null)
            setGameState('running')
            return
        }
        countdownTimerRef.current = window.setTimeout(() => setCountdown((c) => (c ?? 0) - 1), 1000)
        return () => {
            if (countdownTimerRef.current) {
                window.clearTimeout(countdownTimerRef.current)
            }
        }
    }, [gameState, countdown])

    const generateFireworks = () => {
        const duration = 5 * 1000
        const animationEnd = Date.now() + duration
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }
        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min
        const interval = window.setInterval(() => {
            const timeLeft = animationEnd - Date.now()
            if (timeLeft <= 0) {
                return clearInterval(interval)
            }
            const particleCount = 50 * (timeLeft / duration)
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } })
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } })
        }, 250)
    }

    const leftWins = leftRightPeers.left === winnerPeerId && gameState === 'finished'
    const rightWins = leftRightPeers.right === winnerPeerId && gameState === 'finished'

    return (
        <>
            <section id="environment" className="absolute inset-0">
                <img
                    alt="Left Fire"
                    src="/fire.gif"
                    className="pointer-events-none absolute top-[10%] left-[6%] h-[12%] w-auto drop-shadow-2xl drop-shadow-red-500 select-none"
                    draggable={false}
                />
                <img
                    alt="Right Fire"
                    src="/fire.gif"
                    className="pointer-events-none absolute top-[10%] right-[7%] h-[12%] w-auto drop-shadow-2xl drop-shadow-red-500 select-none"
                    draggable={false}
                />
                <div className="translate absolute bottom-[6%] left-[50%] h-[10%] w-2 -translate-x-1/2 border bg-white opacity-60" />
            </section>
            <section id="cameras" className="absolute flex w-full justify-center gap-6 p-8">
                <div
                    className={cn(
                        'text-center transition-all',
                        !readyPeerIds.includes(leftRightPeers.left) && 'opacity-40',
                        rightWins && 'hidden',
                        leftWins && 'text-right'
                    )}
                >
                    <div className="size-fit overflow-hidden rounded-4xl border-4 backdrop-blur-sm">
                        <video ref={videoLeftRef} className={cn('aspect-video h-5000 max-h-30 w-full object-cover', leftWins && 'max-h-140')} playsInline />
                    </div>
                    <span className={cn('text-3xl font-semibold text-orange-200 text-shadow-lg/30', leftWins && 'animate-pulse text-8xl font-black')}>
                        {peerNamesRef.current[leftRightPeers.left]} {leftWins && 'WINS!'}
                    </span>
                </div>
                {gameState !== 'finished' && <span className="mt-14 text-6xl font-bold text-orange-200 text-shadow-lg/30">vs</span>}
                <div
                    className={cn(
                        'text-center transition-all',
                        !readyPeerIds.includes(leftRightPeers.right) && 'opacity-40',
                        leftWins && 'hidden',
                        rightWins && 'text-left'
                    )}
                >
                    <div className="size-fit overflow-hidden rounded-4xl border-4 backdrop-blur-sm">
                        <video ref={videoRightRef} className={cn('aspect-video h-5000 max-h-30 w-full object-cover', rightWins && 'max-h-140')} playsInline />
                    </div>
                    <span className={cn('text-3xl font-semibold text-orange-200 text-shadow-lg/30', rightWins && 'animate-pulse text-8xl font-bold')}>
                        {peerNamesRef.current[leftRightPeers.right]} {rightWins && 'WINS!'}
                    </span>
                </div>
            </section>
            <section id="arena" className="absolute inset-0 overflow-hidden">
                {gameState !== 'finished' && (
                    <>
                        <div
                            id="rope"
                            className="absolute bottom-[34%] h-[2%] border-2 border-amber-500 bg-[url(/rope.png)] transition-all"
                            style={{ left: `${18 + ropePos * 11}%`, right: `${18 + -ropePos * 10}%` }}
                        />
                        <img
                            alt="Red Center Flag"
                            src="/flag.png"
                            className="pointer-events-none absolute bottom-[18%] left-1/2 h-[26%] w-auto -translate-x-1/2 transition-all select-none"
                            draggable={false}
                            style={{ left: `${50 + ropePos * 11}%` }}
                        />
                    </>
                )}
                <img
                    alt="Left warrior"
                    src="/warrior-left.png"
                    draggable={false}
                    style={{ left: `${8 + ropePos * 11}%` }}
                    className={cn(
                        'pointer-events-none absolute bottom-[9%] h-[48%] w-auto drop-shadow-2xl drop-shadow-red-500 transition-all select-none',
                        rightWins && 'bottom-[2%]! left-[2%]! h-[10%] animate-spin',
                        leftWins && 'left-[2%]! h-[56%]'
                    )}
                />
                <img
                    alt="Right warrior"
                    src="/warrior-right.png"
                    draggable={false}
                    style={{ right: `${8 + -ropePos * 11}%` }}
                    className={cn(
                        'pointer-events-none absolute bottom-[9%] h-[48%] w-auto drop-shadow-2xl drop-shadow-blue-500 transition-all select-none',
                        leftWins && 'right-[2%]! bottom-[2%]! h-[10%] animate-spin',
                        rightWins && 'right-[2%]! h-[56%]'
                    )}
                />
            </section>
            <section className="absolute top-6 left-6">
                <Button size="sm" asChild>
                    <Link to="/">Back</Link>
                </Button>
            </section>
            <section className="absolute top-6 right-6 flex items-center gap-2 text-orange-200">
                <Button
                    size="sm"
                    disabled={!id}
                    onClick={() => {
                        toast('Copied Arena ID to Clipboard', { description: 'You can share this with Gladiators to connect to the Arena!' })
                        navigator.clipboard.writeText(id || '')
                    }}
                >
                    {id ? `Arena ID: ${id}` : 'Connecting...'}
                </Button>
                <div className={cn('my-3 size-2 rounded-full bg-red-500', status === 'listening' ? 'bg-green-500' : 'animate-pulse')} />
            </section>
            {gameState === 'countdown' && countdown !== null && countdown > 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-[2600%] text-orange-100 text-shadow-lg/30">{countdown}</div>
            )}
        </>
    )
}
