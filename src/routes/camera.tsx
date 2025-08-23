import '@mediapipe/camera_utils'
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils'
import { HAND_CONNECTIONS, Holistic, POSE_CONNECTIONS, type LandmarkConnectionArray, type NormalizedLandmarkList, type Results } from '@mediapipe/holistic'
import { createFileRoute } from '@tanstack/react-router'
import DeviceDetector from 'device-detector-js'
import { useEffect, useRef, useState } from 'react'

export const Route = createFileRoute('/camera')({
    component: RouteComponent
})

interface SupportedDeviceRule {
    client?: string
    os?: string
}

const supported: SupportedDeviceRule[] = [{ client: 'Chrome' }]

function testSupport(rules: SupportedDeviceRule[]) {
    const detector = new DeviceDetector()
    const detected = detector.parse(navigator.userAgent)
    const ok = rules.some((rule) => {
        if (rule.client && !new RegExp(`^${rule.client}$`).test(detected.client?.name || '')) return false
        if (rule.os && !new RegExp(`^${rule.os}$`).test(detected.os?.name || '')) return false
        return true
    })
    if (!ok) {
        alert(`This demo, running on ${detected.client?.name}/${detected.os?.name}, is not well supported at this time, continue at your own risk.`)
    }
}

function RouteComponent() {
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const [ready, setReady] = useState(false)
    const holisticRef = useRef<Holistic | null>(null)
    // Always use selfie mode
    const selfieMode = true
    const [effect, setEffect] = useState<'background' | 'mask'>('background')
    const [selectedSide, setSelectedSide] = useState<'left' | 'right'>('right')
    const [reps, setReps] = useState(0)
    const repCountRef = useRef(0)
    const phaseRef = useRef<'up' | 'down' | 'unknown'>('unknown')
    const lastRepTimestampRef = useRef<number>(0)

    useEffect(() => {
        testSupport(supported)
    }, [])

    useEffect(() => {
        let cancelled = false
        async function init() {
            if (!videoRef.current || !canvasRef.current) return
            const holistic = new Holistic({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`
            })

            holistic.setOptions({
                selfieMode,
                modelComplexity: 1,
                smoothLandmarks: true,
                enableSegmentation: false,
                smoothSegmentation: true,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            })

            const canvasEl = canvasRef.current
            const ctx = canvasEl!.getContext('2d')!

            const getActiveEffect = () => effect
            const getSelectedSide = () => selectedSide

            // Geometry helpers
            const toVec = (a: { x: number; y: number; z?: number }, b: { x: number; y: number; z?: number }) => {
                return { x: a.x - b.x, y: a.y - b.y, z: (a.z || 0) - (b.z || 0) }
            }
            const dot = (u: { x: number; y: number; z: number }, v: { x: number; y: number; z: number }) => u.x * v.x + u.y * v.y + u.z * v.z
            const mag = (u: { x: number; y: number; z: number }) => Math.hypot(u.x, u.y, u.z)
            const angleAt = (a: { x: number; y: number; z?: number }, b: { x: number; y: number; z?: number }, c: { x: number; y: number; z?: number }) => {
                const ba = toVec(a, b)
                const bc = toVec(c, b)
                const cosTheta =
                    dot({ x: ba.x, y: ba.y, z: ba.z || 0 }, { x: bc.x, y: bc.y, z: bc.z || 0 }) /
                    (mag({ x: ba.x, y: ba.y, z: ba.z || 0 }) * mag({ x: bc.x, y: bc.y, z: bc.z || 0 }) || 1)
                const clamped = Math.min(1, Math.max(-1, cosTheta))
                return (Math.acos(clamped) * 180) / Math.PI
            }

            // BlazePose indices for elbows
            const IDX = {
                left: { shoulder: 11, elbow: 13, wrist: 15 },
                right: { shoulder: 12, elbow: 14, wrist: 16 }
            } as const

            // Hysteresis thresholds
            const UP_THRESHOLD_DEG = 155 // arms extended
            const DOWN_THRESHOLD_DEG = 90 // arms bent

            const fallbackDrawPoints = (points?: NormalizedLandmarkList | null, color = 'red') => {
                if (!points) return
                ctx.fillStyle = color
                for (const p of points) {
                    if (!p) continue
                    ctx.beginPath()
                    ctx.arc(p.x * canvasEl!.width, p.y * canvasEl!.height, 3, 0, Math.PI * 2)
                    ctx.fill()
                }
            }

            let lastDetectionTime = 0
            holistic.onResults((results: Results) => {
                if (cancelled) return
                document.body.classList.add('loaded')
                ctx.save()
                ctx.clearRect(0, 0, canvasEl!.width, canvasEl!.height)

                if (results.segmentationMask) {
                    ctx.drawImage(results.segmentationMask as HTMLCanvasElement | HTMLVideoElement | HTMLImageElement, 0, 0, canvasEl!.width, canvasEl!.height)
                    if (getActiveEffect() === 'mask') {
                        ctx.globalCompositeOperation = 'source-in'
                        ctx.fillStyle = '#00FF007F'
                        ctx.fillRect(0, 0, canvasEl!.width, canvasEl!.height)
                    } else {
                        ctx.globalCompositeOperation = 'source-out'
                        ctx.fillStyle = '#0000FF7F'
                        ctx.fillRect(0, 0, canvasEl!.width, canvasEl!.height)
                    }
                    ctx.globalCompositeOperation = 'destination-atop'
                    ctx.drawImage(results.image as HTMLCanvasElement | HTMLVideoElement | HTMLImageElement, 0, 0, canvasEl!.width, canvasEl!.height)
                    ctx.globalCompositeOperation = 'source-over'
                } else {
                    ctx.drawImage(results.image as HTMLCanvasElement | HTMLVideoElement | HTMLImageElement, 0, 0, canvasEl!.width, canvasEl!.height)
                }

                const hasAny = !!(results.poseLandmarks || results.leftHandLandmarks || results.rightHandLandmarks || results.faceLandmarks)
                if (hasAny) lastDetectionTime = performance.now()

                if (results.poseLandmarks) {
                    try {
                        drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS as LandmarkConnectionArray, {
                            color: 'white',
                            lineWidth: 2
                        })
                        drawLandmarks(ctx, results.poseLandmarks, { color: 'white', fillColor: 'rgba(255,138,0,0.8)', radius: 3 })
                    } catch {
                        fallbackDrawPoints(results.poseLandmarks, 'orange')
                    }
                    // Push-up counter logic
                    try {
                        const side = getSelectedSide()
                        const ids = IDX[side]
                        const lm = results.poseLandmarks
                        const shoulder = lm[ids.shoulder]
                        const elbow = lm[ids.elbow]
                        const wrist = lm[ids.wrist]
                        const haveJoints = !!(shoulder && elbow && wrist)
                        if (haveJoints) {
                            const angle = angleAt(shoulder, elbow, wrist) // elbow angle

                            // Draw angle text near elbow
                            const ex = elbow.x * canvasEl!.width
                            const ey = elbow.y * canvasEl!.height
                            ctx.fillStyle = 'rgba(0,0,0,0.6)'
                            ctx.fillRect(ex - 28, ey - 24, 56, 18)
                            ctx.fillStyle = 'yellow'
                            ctx.font = '12px sans-serif'
                            ctx.textAlign = 'center'
                            ctx.fillText(`${Math.round(angle)}°`, ex, ey - 10)

                            // State machine with hysteresis
                            const now = performance.now()
                            const prevPhase = phaseRef.current
                            let nextPhase = prevPhase
                            if (angle >= UP_THRESHOLD_DEG) nextPhase = 'up'
                            else if (angle <= DOWN_THRESHOLD_DEG) nextPhase = 'down'

                            // Count on transition down -> up with debounce
                            if (prevPhase === 'down' && nextPhase === 'up') {
                                if (now - lastRepTimestampRef.current > 600) {
                                    repCountRef.current += 1
                                    lastRepTimestampRef.current = now
                                    setReps(repCountRef.current)
                                }
                            }
                            phaseRef.current = nextPhase
                        }
                    } catch {
                        // ignore counter errors
                    }
                }
                if (results.leftHandLandmarks) {
                    try {
                        drawConnectors(ctx, results.leftHandLandmarks, HAND_CONNECTIONS as LandmarkConnectionArray, {
                            color: 'white',
                            lineWidth: 2
                        })
                        drawLandmarks(ctx, results.leftHandLandmarks, { color: 'white', fillColor: 'rgba(255,138,0,0.8)', radius: 2 })
                    } catch {
                        fallbackDrawPoints(results.leftHandLandmarks, 'orange')
                    }
                }
                if (results.rightHandLandmarks) {
                    try {
                        drawConnectors(ctx, results.rightHandLandmarks, HAND_CONNECTIONS as LandmarkConnectionArray, {
                            color: 'white',
                            lineWidth: 2
                        })
                        drawLandmarks(ctx, results.rightHandLandmarks, { color: 'white', fillColor: 'rgba(0,217,231,0.8)', radius: 2 })
                    } catch {
                        fallbackDrawPoints(results.rightHandLandmarks, 'cyan')
                    }
                }

                if (performance.now() - lastDetectionTime > 2000) {
                    ctx.fillStyle = 'rgba(255,0,0,0.8)'
                    ctx.font = '14px sans-serif'
                    ctx.fillText('No landmarks detected. Ensure good lighting and full body in frame.', 10, 20)
                }

                // Overlay rep counter
                ctx.fillStyle = 'rgba(0,0,0,0.5)'
                ctx.fillRect(8, 28, 120, 28)
                ctx.fillStyle = 'lime'
                ctx.font = '18px sans-serif'
                ctx.textAlign = 'left'
                ctx.fillText(`Reps: ${repCountRef.current}`, 14, 48)

                ctx.restore()
            })

            const cameraUtils: unknown = await import('@mediapipe/camera_utils')
            const { Camera } = cameraUtils as {
                Camera: new (videoEl: HTMLVideoElement, config: { onFrame: () => Promise<void>; width: number; height: number }) => { start: () => void }
            }
            const cam = new Camera(videoRef.current, {
                onFrame: async () => {
                    if (!videoRef.current) return
                    if (canvasEl!.width !== videoRef.current.videoWidth) {
                        canvasEl!.width = videoRef.current.videoWidth
                        canvasEl!.height = videoRef.current.videoHeight
                    }
                    await holistic.send({ image: videoRef.current })
                },
                width: 640,
                height: 480
            })
            cam.start()
            holisticRef.current = holistic
            setReady(true)

            return () => {
                cancelled = true
                holistic.close()
            }
        }
        init()
        return () => {
            cancelled = true
        }
    }, [effect, selectedSide]) // selfieMode removed from deps

    return (
        <div className="flex flex-col gap-4 p-4">
            <h1 className="text-xl font-semibold">Camera / Holistic Demo</h1>
            <div className="flex gap-4 flex-wrap">
                <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-sm">
                        <select
                            value={effect}
                            onChange={(e) => setEffect(e.target.value as 'background' | 'mask')}
                            className="border rounded px-2 py-1 text-sm"
                        >
                            <option value="background">Background</option>
                            <option value="mask">Foreground</option>
                        </select>
                        Effect
                    </label>
                    <div className="flex items-center gap-2 text-sm">
                        <select
                            value={selectedSide}
                            onChange={(e) => setSelectedSide(e.target.value as 'left' | 'right')}
                            className="border rounded px-2 py-1 text-sm"
                        >
                            <option value="right">Right arm</option>
                            <option value="left">Left arm</option>
                        </select>
                        <button
                            className="border rounded px-2 py-1 text-sm hover:bg-secondary"
                            onClick={() => {
                                repCountRef.current = 0
                                setReps(0)
                                phaseRef.current = 'unknown'
                                lastRepTimestampRef.current = 0
                            }}
                        >
                            Reset reps
                        </button>
                    </div>
                    {!ready && <p className="text-sm text-muted-foreground">Initializing...</p>}
                    {ready && (
                        <p className="text-sm opacity-80">
                            Reps: <span className="font-semibold">{reps}</span>
                        </p>
                    )}
                </div>
                <div className="relative h-full w-full">
                    <canvas ref={canvasRef} className="rounded border h-full w-full" />
                    <video ref={videoRef} autoPlay muted playsInline className="selfie opacity-0 hidden" />
                </div>
            </div>
            <p className="text-xs opacity-70">Powered by MediaPipe Holistic</p>
        </div>
    )
}
