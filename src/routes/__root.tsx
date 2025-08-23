import { Outlet, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
    component: RootComponent
})

function RootComponent() {
    return (
        <main className="fixed flex size-full items-center justify-center">
            <div className="relative aspect-[3/2] w-[min(100vw,150vh)] bg-[url(/arena.png)] bg-contain bg-center bg-no-repeat">
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
                <Outlet />
            </div>
        </main>
    )
}
