import { Link, createFileRoute } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({
    component: RouteComponent
})

function RouteComponent() {
    return (
        <main className="fixed inset-0 flex flex-col items-center justify-center gap-4">
            <h1 className="text-4xl font-bold text-orange-200 text-shadow-lg/30 md:text-8xl">TUG OF WAR</h1>
            <nav className="flex gap-4">
                <Button size="lg" asChild>
                    <Link to="/gladiator">Gladiator</Link>
                </Button>
                <Button size="lg" asChild>
                    <Link to="/arena">Arena</Link>
                </Button>
            </nav>
        </main>
    )
}
