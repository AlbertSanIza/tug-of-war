import { cn } from '@/lib/utils'
import '@mediapipe/camera_utils'
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils'
import { HAND_CONNECTIONS, Holistic, POSE_CONNECTIONS, type LandmarkConnectionArray, type NormalizedLandmarkList, type Results } from '@mediapipe/holistic'
import DeviceDetector from 'device-detector-js'
import { useEffect, useRef, useState } from 'react'

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

export function CameraRouteComponent({ className, onCount }: { className?: string; onCount: (count: number) => void }) {
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const [ready, setReady] = useState(false)
    const holisticRef = useRef<Holistic | null>(null)
    const selfieMode = true
    const repCountRef = useRef(0)
    const phaseRef = useRef<'up' | 'down'>('up')
    const depthReachedRef = useRef(false)
    const torsoAngleRef = useRef<number | null>(null)

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

            const getActiveEffect = () => 'background'
            // Auto-tracking both arms (choose the more flexed / smaller elbow angle each frame)

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
                        const lm = results.poseLandmarks
                        const left = IDX.left
                        const right = IDX.right
                        const lOk = !!(lm[left.shoulder] && lm[left.elbow] && lm[left.wrist])
                        const rOk = !!(lm[right.shoulder] && lm[right.elbow] && lm[right.wrist])

                        let primaryAngle: number | null = null
                        let displayElbow: { x: number; y: number } | null = null
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

                            // Torso angle (average of left & right shoulder->hip vectors relative to vertical)
                            const ls = lm[11]
                            const rs = lm[12]
                            const lh = lm[23]
                            const rh = lm[24]
                            const torsoAngles: number[] = []
                            interface Lm {
                                x: number
                                y: number
                            }
                            const calcTorso = (shoulder: Lm | undefined, hip: Lm | undefined) => {
                                if (!shoulder || !hip) return
                                // Vector shoulder -> hip
                                const vx = hip.x - shoulder.x
                                const vy = hip.y - shoulder.y
                                // Angle relative to vertical (downward). atan2(x,y)
                                const deg = Math.abs((Math.atan2(vx, vy) * 180) / Math.PI)
                                torsoAngles.push(deg)
                            }
                            calcTorso(ls, lh)
                            calcTorso(rs, rh)
                            if (torsoAngles.length) {
                                torsoAngleRef.current = torsoAngles.reduce((a, b) => a + b, 0) / torsoAngles.length
                            }

                            // Hips present? (either hip landmark visible)
                            const hipsInFrame = (lm[23]?.visibility ?? 0) > 0.4 || (lm[24]?.visibility ?? 0) > 0.4
                            const torsoAngleOk = (torsoAngleRef.current ?? 0) >= 13
                            if (hipsInFrame && torsoAngleOk) {
                                if (angle <= DEPTH_THRESHOLD) {
                                    depthReachedRef.current = true
                                    phaseRef.current = 'down'
                                }
                                if (depthReachedRef.current && angle >= EXTENDED_THRESHOLD && phaseRef.current === 'down') {
                                    repCountRef.current += 1
                                    onCount(repCountRef.current)
                                    depthReachedRef.current = false
                                    phaseRef.current = 'up'
                                }
                            } else if (!torsoAngleOk) {
                                // If torso not yet at required angle, ensure we don't keep partial depth state
                                depthReachedRef.current = false
                                phaseRef.current = 'up'
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
                const panelW = 180
                const panelH = 60
                ctx.fillStyle = 'rgba(0,0,0,0.45)'
                ctx.fillRect(8, 28, panelW, panelH)
                ctx.textAlign = 'left'
                ctx.font = '32px sans-serif'
                ctx.fillStyle = '#4ade80'
                ctx.fillText(`Reps: ${repCountRef.current}`, 16, 52)
                if (torsoAngleRef.current != null) {
                    ctx.font = '12px sans-serif'
                    ctx.fillStyle = '#fff'
                    ctx.fillText(`Torso: ${Math.round(torsoAngleRef.current)}°`, 16, 68)
                }

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
    }, []) // selfieMode constant

    return (
        <div className={cn(className)}>
            <div className="flex items-center gap-2 text-sm"></div>
            {!ready && <p className="text-sm text-muted-foreground">Initializing...</p>}
            {ready && <div className="flex flex-col text-sm opacity-80"></div>}

            <div className="relative flex h-full w-full items-center justify-center">
                <canvas ref={canvasRef} className="rounded border" />
                <video ref={videoRef} autoPlay muted playsInline className="selfie hidden opacity-0" />
            </div>
        </div>
    )
}
