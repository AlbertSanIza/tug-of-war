import { createFileRoute, Link } from '@tanstack/react-router'
import confetti from 'canvas-confetti'
import Peer, { type DataConnection } from 'peerjs'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/arena')({
    component: RouteComponent
})

type ArenaGameState = 'idle' | 'countdown' | 'running' | 'finished'
function RouteComponent() {
    const [ropePos, setRopePos] = useState(0)
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
            </section>
            <section id="arena" className="absolute inset-0 overflow-hidden">
                {gameState !== 'finished' && (
                    <>
                        <div
                            id="rope"
                            className="absolute bottom-[34%] h-[2%] border-3 border-amber-400 bg-amber-600 transition-all"
                            style={{ left: `${18 + ropePos * 3}%`, right: `${18 + -ropePos * 3}%` }}
                        />
                        <img
                            alt="Red Center Flag"
                            src="/flag.png"
                            className="pointer-events-none absolute bottom-[18%] left-1/2 h-[26%] w-auto -translate-x-1/2 transition-all select-none"
                            draggable={false}
                            style={{ left: `${50 + ropePos * 3}%` }}
                        />
                    </>
                )}
                <img
                    alt="Left warrior"
                    src="/warrior-left.png"
                    draggable={false}
                    style={{ left: `${8 + ropePos * 3}%` }}
                    className={cn(
                        'pointer-events-none absolute bottom-[9%] h-[48%] w-auto drop-shadow-2xl drop-shadow-blue-900 transition-all select-none',
                        rightWins && 'bottom-[2%]! left-[2%]! h-[10%] animate-spin',
                        leftWins && 'left-[2%]! h-[56%]'
                    )}
                />
                <img
                    alt="Right warrior"
                    src="/warrior-right.png"
                    draggable={false}
                    style={{ right: `${8 + -ropePos * 3}%` }}
                    className={cn(
                        'pointer-events-none absolute bottom-[9%] h-[48%] w-auto drop-shadow-2xl drop-shadow-blue-900 transition-all select-none',
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
            {gameState === 'countdown' && countdown !== null && countdown > 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-[2600%] text-orange-100 text-shadow-lg/30">{countdown}</div>
            )}
        </>
    )
}
