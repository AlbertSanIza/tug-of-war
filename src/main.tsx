import { createHashHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { Toaster } from '@/components/ui/sonner'

import '@/index.css'
import { routeTree } from '@/lib/route-tree.gen'

const hashHistory = createHashHistory()
const router = createRouter({ routeTree, history: hashHistory, basepath: '/tug-of-war/' })

declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router
    }
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <RouterProvider router={router} />
        <Toaster offset={24} toastOptions={{ classNames: { toast: 'right-0 w-[352px] border-2' } }} richColors />
    </StrictMode>
)
