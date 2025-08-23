import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/camera')({
    component: RouteComponent
})

function RouteComponent() {
    return <div>Hello "/camera"!</div>
}
