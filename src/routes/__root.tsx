import { Outlet, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
    component: RootComponent
})

function RootComponent() {
    return (
        <main className="fixed flex size-full items-center justify-center">
            <div className="relative aspect-[3/2] w-[min(100vw,150vh)] bg-[url(/arena2.png)] bg-contain bg-center bg-no-repeat">
                <Outlet />
            </div>
        </main>
    )
}
