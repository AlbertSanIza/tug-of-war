import { Outlet, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
    component: RootComponent
})

function RootComponent() {
    return (
        <main className="fixed flex size-full items-center justify-center">
            <div className="w-screen h-screen bg-[url('/arena2.png')] bg-contain bg-no-repeat bg-top">
                <Outlet />
            </div>
        </main>
    )
}
