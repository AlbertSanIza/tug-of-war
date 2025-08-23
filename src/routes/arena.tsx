import { createFileRoute } from '@tanstack/react-router'

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
        </>
    )
}
