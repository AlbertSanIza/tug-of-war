import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/gladiator')({
    component: RouteComponent
})

function RouteComponent() {
    return <div>Hello "/gladiator"!</div>
}
