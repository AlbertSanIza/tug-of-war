import { Button } from '@/components/ui/button'
import { createFileRoute, Link } from '@tanstack/react-router'

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
            <section className="absolute top-6 left-6">
                <Button size="sm" asChild>
                    <Link to="/">Back</Link>
                </Button>
            </section>
        </>
    )
}
