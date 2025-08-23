import '@mediapipe/drawing_utils'
import '@mediapipe/holistic'
import type { Holistic, NormalizedLandmarkList, Results } from '@mediapipe/holistic'
import { createFileRoute } from '@tanstack/react-router'
import DeviceDetector from 'device-detector-js'
import { useEffect, useRef, useState } from 'react'
// camera_utils adds the Camera class to global scope when using script tags; in bundler we import for side effects
import '@mediapipe/camera_utils'

// Types that drawing_utils attaches to window
declare global {
    interface Window {
        // augment minimal MediaPipe drawing utils types we use
        drawConnectors?: (ctx: CanvasRenderingContext2D, landmarks: unknown, connections: unknown, style?: Record<string, unknown>) => void
        drawLandmarks?: (ctx: CanvasRenderingContext2D, landmarks: unknown, style?: Record<string, unknown>) => void
        lerp?: (...args: unknown[]) => number
    }
}

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

// Utility to remove certain landmarks
function removeElements(landmarks: NormalizedLandmarkList, elements: number[]) {
    for (const e of elements) {
        delete (landmarks as unknown as Record<number, unknown>)[e]
    }
}

function removeLandmarks(results: Results) {
    if (results.poseLandmarks) {
        removeElements(results.poseLandmarks, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 16, 17, 18, 19, 20, 21, 22])
    }
}

function RouteComponent() {
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const [ready, setReady] = useState(false)
    const holisticRef = useRef<Holistic | null>(null)
    const [selfieMode, setSelfieMode] = useState(true)
    const [effect, setEffect] = useState<'background' | 'mask'>('background')

    useEffect(() => {
        testSupport(supported)
    }, [])

    useEffect(() => {
        let cancelled = false
        async function init() {
            if (!videoRef.current || !canvasRef.current) return
            const holisticModule = await import('@mediapipe/holistic')
            const holistic = new holisticModule.Holistic({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic@${holisticModule.VERSION}/${file}`
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

            const meshConsts = holisticModule as unknown as Record<string, unknown>
            const POSE_CONNECTIONS = meshConsts.POSE_CONNECTIONS as unknown
            const HAND_CONNECTIONS = meshConsts.HAND_CONNECTIONS as unknown
            const FACEMESH_TESSELATION = meshConsts.FACEMESH_TESSELATION as unknown
            const FACEMESH_RIGHT_EYE = meshConsts.FACEMESH_RIGHT_EYE as unknown
            const FACEMESH_RIGHT_EYEBROW = meshConsts.FACEMESH_RIGHT_EYEBROW as unknown
            const FACEMESH_LEFT_EYE = meshConsts.FACEMESH_LEFT_EYE as unknown
            const FACEMESH_LEFT_EYEBROW = meshConsts.FACEMESH_LEFT_EYEBROW as unknown
            const FACEMESH_FACE_OVAL = meshConsts.FACEMESH_FACE_OVAL as unknown
            const FACEMESH_LIPS = meshConsts.FACEMESH_LIPS as unknown

            holistic.onResults((results: Results) => {
                if (cancelled) return
                document.body.classList.add('loaded')
                removeLandmarks(results)
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

                // Draw pose / hands / face landmarks (the "dots")
                const { drawConnectors, drawLandmarks } = window
                if (drawConnectors && drawLandmarks) {
                    // Pose
                    if (results.poseLandmarks) {
                        drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, { color: 'white', lineWidth: 2 })
                        drawLandmarks(
                            ctx,
                            results.poseLandmarks,
                            { color: 'white', fillColor: 'rgba(255,138,0,0.8)', radius: 3 }
                        )
                    }
                    // Hands
                    if (results.leftHandLandmarks) {
                        drawConnectors(ctx, results.leftHandLandmarks, HAND_CONNECTIONS, { color: 'white', lineWidth: 2 })
                        drawLandmarks(ctx, results.leftHandLandmarks, { color: 'white', fillColor: 'rgba(255,138,0,0.8)', radius: 2 })
                    }
                    if (results.rightHandLandmarks) {
                        drawConnectors(ctx, results.rightHandLandmarks, HAND_CONNECTIONS, { color: 'white', lineWidth: 2 })
                        drawLandmarks(ctx, results.rightHandLandmarks, { color: 'white', fillColor: 'rgba(0,217,231,0.8)', radius: 2 })
                    }
                    // Face mesh (subset for performance)
                    if (results.faceLandmarks) {
                        drawConnectors(ctx, results.faceLandmarks, FACEMESH_TESSELATION, { color: '#C0C0C050', lineWidth: 1 })
                        drawConnectors(ctx, results.faceLandmarks, FACEMESH_RIGHT_EYE, { color: 'rgb(0,217,231)' })
                        drawConnectors(ctx, results.faceLandmarks, FACEMESH_RIGHT_EYEBROW, { color: 'rgb(0,217,231)' })
                        drawConnectors(ctx, results.faceLandmarks, FACEMESH_LEFT_EYE, { color: 'rgb(255,138,0)' })
                        drawConnectors(ctx, results.faceLandmarks, FACEMESH_LEFT_EYEBROW, { color: 'rgb(255,138,0)' })
                        drawConnectors(ctx, results.faceLandmarks, FACEMESH_FACE_OVAL, { color: '#E0E0E0', lineWidth: 2 })
                        drawConnectors(ctx, results.faceLandmarks, FACEMESH_LIPS, { color: '#E0E0E0', lineWidth: 2 })
                    }
                }

                ctx.restore()
            })

            // Use Camera util to get frames
            const cameraUtils: unknown = await import('@mediapipe/camera_utils')
            const { Camera } = cameraUtils as {
                Camera: new (videoEl: HTMLVideoElement, config: { onFrame: () => Promise<void>; width: number; height: number }) => { start: () => void }
            }
            const cam = new Camera(videoRef.current, {
                onFrame: async () => {
                    if (!videoRef.current) return
                    // match canvas size to video each frame if changed
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
    }, [effect, selfieMode])

    // Apply option changes
    // effect change is read dynamically; selfieMode handled by re-init effect

    return (
        <div className="flex flex-col gap-4 p-4">
            <h1 className="text-xl font-semibold">Camera / Holistic Demo</h1>
            <div className="flex gap-4 flex-wrap">
                <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={selfieMode} onChange={(e) => setSelfieMode(e.target.checked)} /> Selfie Mode
                    </label>
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
                    {!ready && <p className="text-sm text-muted-foreground">Initializing...</p>}
                </div>
                <div className="relative">
                    <video ref={videoRef} className={selfieMode ? 'selfie hidden' : 'hidden'} playsInline style={{ display: 'none' }} />
                    <canvas ref={canvasRef} className="rounded border" />
                </div>
            </div>
            <p className="text-xs opacity-70">Powered by MediaPipe Holistic</p>
        </div>
    )
}
