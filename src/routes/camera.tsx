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
    const selfieMode = true
    const [effect, setEffect] = useState<'background' | 'mask'>('background')
    const [selectedSide, setSelectedSide] = useState<'left' | 'right' | 'both'>('both')
    const [reps, setReps] = useState(0)
    const repCountRef = useRef(0)
    const phaseRef = useRef<'up' | 'down'>('up')
    const depthReachedRef = useRef(false)

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

            const EXTENDED_THRESHOLD = 160
            const DEPTH_THRESHOLD = 90

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

                const hasAny = !!(results.poseLandmarks || results.leftHandLandmarks || results.rightHandLandmarks)
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
                    // Simplified push-up counter logic
                    try {
                        const side = getSelectedSide()
                        const lm = results.poseLandmarks
                        const left = IDX.left
                        const right = IDX.right
                        const lOk = !!(lm[left.shoulder] && lm[left.elbow] && lm[left.wrist])
                        const rOk = !!(lm[right.shoulder] && lm[right.elbow] && lm[right.wrist])

                        let primaryAngle: number | null = null
                        let displayElbow: { x: number; y: number } | null = null
                        if (side === 'both') {
                            const lAngle = lOk ? angleAt(lm[left.shoulder], lm[left.elbow], lm[left.wrist]) : null
                            const rAngle = rOk ? angleAt(lm[right.shoulder], lm[right.elbow], lm[right.wrist]) : null
                            if (lAngle == null && rAngle == null) throw new Error('no elbows')
                            if (lAngle != null && rAngle != null) {
                                primaryAngle = Math.min(lAngle, rAngle)
                                displayElbow = lAngle <= rAngle ? lm[left.elbow] : lm[right.elbow]
                            } else if (lAngle != null) {
                                primaryAngle = lAngle
                                displayElbow = lm[left.elbow]
                            } else if (rAngle != null) {
                                primaryAngle = rAngle
                                displayElbow = lm[right.elbow]
                            }
                        } else {
                            const ids = IDX[side]
                            if (!(lm[ids.shoulder] && lm[ids.elbow] && lm[ids.wrist])) throw new Error('missing joints')
                            primaryAngle = angleAt(lm[ids.shoulder], lm[ids.elbow], lm[ids.wrist])
                            displayElbow = lm[ids.elbow]
                        }

                        if (primaryAngle != null && displayElbow) {
                            const angle = primaryAngle

                            // Draw angle near the chosen elbow
                            const ex = displayElbow.x * canvasEl!.width
                            const ey = displayElbow.y * canvasEl!.height
                            ctx.fillStyle = 'rgba(0,0,0,0.6)'
                            ctx.fillRect(ex - 30, ey - 26, 60, 20)
                            ctx.fillStyle = 'yellow'
                            ctx.font = '12px sans-serif'
                            ctx.textAlign = 'center'
                            ctx.fillText(`${Math.round(angle)}°`, ex, ey - 11)

                            // Hips present? (either hip landmark visible)
                            const hipsInFrame = (lm[23]?.visibility ?? 0) > 0.4 || (lm[24]?.visibility ?? 0) > 0.4
                            if (hipsInFrame) {
                                if (angle <= DEPTH_THRESHOLD) {
                                    depthReachedRef.current = true
                                    phaseRef.current = 'down'
                                }
                                if (depthReachedRef.current && angle >= EXTENDED_THRESHOLD && phaseRef.current === 'down') {
                                    repCountRef.current += 1
                                    setReps(repCountRef.current)
                                    depthReachedRef.current = false
                                    phaseRef.current = 'up'
                                }
                            }
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

                // Overlay panel
                const panelW = 140
                const panelH = 40
                ctx.fillStyle = 'rgba(0,0,0,0.45)'
                ctx.fillRect(8, 28, panelW, panelH)
                ctx.textAlign = 'left'
                ctx.font = '18px sans-serif'
                ctx.fillStyle = '#4ade80'
                ctx.fillText(`Reps: ${repCountRef.current}`, 16, 52)

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
        // We intentionally exclude live/form feedback states to avoid reinitializing MediaPipe every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effect, selectedSide]) // selfieMode constant

    return (
        <div className="flex flex-col gap-4 p-4">
            <h1 className="text-xl font-semibold">Camera / Holistic Demo</h1>
            <div className="flex flex-wrap gap-4">
                <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-sm">
                        <select
                            value={effect}
                            onChange={(e) => setEffect(e.target.value as 'background' | 'mask')}
                            className="rounded border px-2 py-1 text-sm"
                        >
                            <option value="background">Background</option>
                            <option value="mask">Foreground</option>
                        </select>
                        Effect
                    </label>
                    <div className="flex items-center gap-2 text-sm">
                        <select
                            value={selectedSide}
                            onChange={(e) => setSelectedSide(e.target.value as 'left' | 'right' | 'both')}
                            className="border rounded px-2 py-1 text-sm"
                        >
                            <option value="right">Right arm</option>
                            <option value="left">Left arm</option>
                            <option value="both">Both arms</option>
                        </select>
                        <button
                            className="rounded border px-2 py-1 text-sm hover:bg-secondary"
                            onClick={() => {
                                repCountRef.current = 0
                                setReps(0)
                                phaseRef.current = 'up'
                                depthReachedRef.current = false
                            }}
                        >
                            Reset reps
                        </button>
                    </div>
                    {!ready && <p className="text-sm text-muted-foreground">Initializing...</p>}
                    {ready && (
                        <div className="flex flex-col opacity-80 text-sm">
                            Reps: <span className="font-semibold">{reps}</span>
                        </div>
                    )}
                </div>
                <div className="relative flex h-full w-full items-center justify-center">
                    <canvas ref={canvasRef} className="h-2xl w-2xl rounded border" />
                    <video ref={videoRef} autoPlay muted playsInline className="selfie hidden opacity-0" />
                </div>
            </div>
            <p className="text-xs opacity-70">Powered by MediaPipe Holistic</p>
        </div>
    )
}
