import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/arena')({
    component: RouteComponent
})

function RouteComponent() {
    return (
        <>
            <section></section>
        </>
    )
}
