import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/arena')({
    component: RouteComponent
})

function RouteComponent() {
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
                <img
                    alt="Left warrior"
                    src="/warrior-left.png"
                    draggable={false}
                    className={cn('pointer-events-none absolute bottom-[9%] h-[44%] w-auto drop-shadow-2xl drop-shadow-blue-900 transition-all select-none')}
                />
                <img
                    alt="Right warrior"
                    src="/warrior-right.png"
                    draggable={false}
                    className={cn('pointer-events-none absolute bottom-[9%] h-[44%] w-auto drop-shadow-2xl drop-shadow-red-900 transition-all select-none')}
                />
            </section>
            <section className="absolute top-6 left-6">
                <Button size="sm" asChild>
                    <Link to="/">Back</Link>
                </Button>
            </section>
        </>
    )
}
