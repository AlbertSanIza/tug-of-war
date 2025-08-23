import { useForm } from '@tanstack/react-form'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { REGEXP_ONLY_CHARS } from 'input-otp'
import Peer, { type DataConnection } from 'peerjs'
import { useCallback, useEffect, useRef, useState } from 'react'

import { CameraRouteComponent } from '@/components/camera'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/gladiator')({
    component: RouteComponent
})

function RouteComponent() {
    const router = useRouter()
    const [dialogOpen, setDialogOpen] = useState(true)
    const connRef = useRef<DataConnection | null>(null)
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const [countdown, setCountdown] = useState<number | null>(null)
    const [gameState, setGameState] = useState<'idle' | 'countdown' | 'running' | 'finished'>('idle')

    const form = useForm({
        defaultValues: { name: localStorage.getItem('gladiator-name') || '', arenaId: '' },
        onSubmit: ({ value }) => {
            localStorage.setItem('gladiator-name', value.name)
            connect(value.arenaId, value.name)
        }
    })

    const connect = useCallback(async (arenaId: string, name: string) => {
        try {
            const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
            if (videoRef.current) {
                videoRef.current.srcObject = localStream
                videoRef.current.muted = true
                await videoRef.current.play().catch(() => {})
                setDialogOpen(false)
            }
            const peer = new Peer()
            peer.on('open', () => {
                peer.call(`tug-of-war-arena-${arenaId}`, localStream)
                const conn = peer.connect(`tug-of-war-arena-${arenaId}`)
                connRef.current = conn
                conn.on('open', () => conn.send({ type: 'intro', name }))
                conn.on('data', (data) => {
                    const { type, state, count } = data as { type: 'gameState' | 'countdown'; state?: string; count?: number }
                    switch (type) {
                        case 'gameState':
                            setGameState(state as any)
                            if (state === 'running') {
                                setCountdown(null)
                            }
                            break
                        case 'countdown':
                            setCountdown(count ?? null)
                            if (count !== null) {
                                setGameState('countdown')
                            }
                            break
                    }
                })
                conn.on('error', () => {
                    connRef.current = null
                })
                conn.on('close', () => {
                    connRef.current = null
                })
            })
            peer.on('disconnected', () => setDialogOpen(true))
            peer.on('error', () => setDialogOpen(true))
        } catch {
            setDialogOpen(true)
        }
    }, [])

    useEffect(() => {
        function onKey(event: KeyboardEvent) {
            if (event.code === 'Space') {
                event.preventDefault()
                connRef.current?.send({ type: 'pull' })
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [])

    return (
        <>
            <section className="absolute inset-0 flex items-center justify-center p-6">
                <div
                    className={cn(
                        'overflow-hidden rounded-4xl border-4 backdrop-blur-sm transition-all duration-300',
                        gameState === 'running' && 'border-8 border-green-500 shadow-lg shadow-green-500/50',
                        gameState === 'countdown' && 'border-6 border-yellow-500'
                    )}
                >
                    <CameraRouteComponent
                        className={cn('size-full h-1/2 object-contain', { hidden: dialogOpen })}
                        onCount={(count) => connRef.current?.send({ type: 'pull', count })}
                    />
                    <video ref={videoRef} className={cn('hidden size-full h-1/2 object-contain', { hidden: dialogOpen })} playsInline />
                </div>
                {/* Countdown Display */}
                {gameState === 'countdown' && countdown !== null && countdown > 0 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="animate-pulse rounded-full bg-black/30 p-8 text-[2000%] font-bold text-yellow-400 text-shadow-lg/50">{countdown}</div>
                    </div>
                )}
                {/* START! Indicator */}
                {gameState === 'running' && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="animate-[bounce_0.5s_ease-out_0s_3,fadeOut_0.5s_ease-in_1.5s_forwards] rounded-full bg-black/40 p-8 text-[1500%] font-bold text-green-400 text-shadow-lg/50">
                            START!
                        </div>
                    </div>
                )}
                {/* Game Finished Indicator */}
                {gameState === 'finished' && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="animate-pulse text-[1200%] font-bold text-red-400 text-shadow-lg/50">GAME OVER!</div>
                    </div>
                )}
            </section>
            {!dialogOpen && (
                <section className="absolute bottom-6 flex w-full items-center justify-center gap-3">
                    <Button onClick={() => connRef.current?.send({ type: 'ready' })}>Ready</Button>
                    <div className="rounded-full bg-black/50 px-3 py-1 text-lg font-semibold text-white">
                        {gameState === 'idle' && 'Waiting'}
                        {gameState === 'countdown' && `Starting in ${countdown}...`}
                        {gameState === 'running' && 'GO!'}
                        {gameState === 'finished' && 'Game Over'}
                    </div>
                </section>
            )}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent
                    showCloseButton={false}
                    onEscapeKeyDown={(event) => event.preventDefault()}
                    onInteractOutside={(event) => event.preventDefault()}
                >
                    <DialogHeader>
                        <DialogTitle>Enter Arena</DialogTitle>
                        <DialogDescription className="hidden" />
                    </DialogHeader>
                    <form
                        className="flex flex-col gap-4"
                        onSubmit={(event) => {
                            event.preventDefault()
                            form.handleSubmit()
                        }}
                    >
                        <div className="flex gap-4">
                            <form.Field
                                name="name"
                                validators={{ onSubmit: ({ value }) => (value.length > 0 ? undefined : 'Required') }}
                                children={(field) => (
                                    <div className="flex flex-1 flex-col gap-1.5">
                                        <Label htmlFor="name">Name</Label>
                                        <Input
                                            id="name"
                                            type="text"
                                            autoComplete="off"
                                            placeholder="Username"
                                            value={field.state.value}
                                            autoFocus={!field.state.value}
                                            onChange={(event) => field.handleChange(event.target.value)}
                                        />
                                        {!field.state.meta.isValid && <em className="text-sm text-red-500">{field.state.meta.errors.join(',')}</em>}
                                    </div>
                                )}
                            />
                            <form.Subscribe
                                selector={(state) => state.values.name}
                                children={(name) => (
                                    <form.Field
                                        name="arenaId"
                                        validators={{ onSubmit: ({ value }) => (value.length === 3 ? undefined : 'Required') }}
                                        children={(field) => (
                                            <div className="flex flex-col gap-1.5">
                                                <Label htmlFor="id">Arena ID</Label>
                                                <InputOTP
                                                    id="id"
                                                    inputMode="text"
                                                    maxLength={3}
                                                    autoFocus={!!name}
                                                    value={field.state.value}
                                                    pattern={REGEXP_ONLY_CHARS}
                                                    onChange={(value) => field.handleChange(value.toUpperCase())}
                                                >
                                                    <InputOTPGroup>
                                                        <InputOTPSlot index={0} />
                                                        <InputOTPSlot index={1} />
                                                        <InputOTPSlot index={2} />
                                                    </InputOTPGroup>
                                                </InputOTP>
                                                {!field.state.meta.isValid && <em className="text-sm text-red-500">{field.state.meta.errors.join(',')}</em>}
                                            </div>
                                        )}
                                    />
                                )}
                            />
                        </div>
                        <form.Subscribe
                            selector={(state) => [state.canSubmit, state.isSubmitting]}
                            children={([canSubmit, isSubmitting]) => (
                                <div className="flex gap-1">
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="outline"
                                        onClick={() => router.history.back()}
                                        className="flex-1 text-orange-500 hover:text-orange-600"
                                    >
                                        Back
                                    </Button>
                                    <Button type="submit" disabled={!canSubmit || isSubmitting} className="flex-1">
                                        Connect
                                    </Button>
                                </div>
                            )}
                        />
                    </form>
                </DialogContent>
            </Dialog>
        </>
    )
}
