import { useForm } from '@tanstack/react-form'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { REGEXP_ONLY_CHARS } from 'input-otp'
import { ArrowBigLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Label } from '@/components/ui/label'

export const Route = createFileRoute('/gladiator')({
    component: RouteComponent
})

function RouteComponent() {
    const router = useRouter()

    const form = useForm({
        defaultValues: {
            name: '',
            arenaId: ''
        },
        onSubmit: ({ value }) => {
            localStorage.setItem('gladiator-name', value.name)
            console.log('Submitted:', value)
        }
    })

    return (
        <>
            <Dialog open>
                <DialogContent
                    showCloseButton={false}
                    onEscapeKeyDown={(event) => event.preventDefault()}
                    onInteractOutside={(event) => event.preventDefault()}
                >
                    <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => router.history.back()}
                        className="absolute top-4 right-4 text-orange-500 hover:text-orange-600"
                    >
                        <ArrowBigLeft className="h-6 w-6" />
                    </Button>
                    <DialogHeader>
                        <DialogTitle>Enter Arena</DialogTitle>
                        <DialogDescription className="hidden" />
                    </DialogHeader>

                    <form
                        className="flex flex-col gap-4"
                        onSubmit={(event) => {
                            event.preventDefault()
                            form.handleSubmit()
                        }}
                    >
                        <div className="flex gap-4">
                            <form.Field
                                name="name"
                                validators={{ onSubmit: ({ value }) => (value.length > 0 ? undefined : 'Required') }}
                                children={(field) => (
                                    <div className="flex flex-1 flex-col gap-1.5">
                                        <Label htmlFor="name">Name</Label>
                                        <Input
                                            id="name"
                                            type="text"
                                            autoComplete="off"
                                            placeholder="Username"
                                            value={field.state.value}
                                            autoFocus
                                            onChange={(event) => field.handleChange(event.target.value)}
                                        />
                                        {!field.state.meta.isValid && <em className="text-sm text-red-500">{field.state.meta.errors.join(',')}</em>}
                                    </div>
                                )}
                            />

                            <form.Subscribe
                                selector={(state) => state.values.name}
                                children={(name) => (
                                    <form.Field
                                        name="arenaId"
                                        validators={{ onSubmit: ({ value }) => (value.length === 3 ? undefined : 'Required') }}
                                        children={(field) => (
                                            <div className="flex flex-col gap-1.5">
                                                <Label htmlFor="id">Arena ID</Label>
                                                <InputOTP
                                                    id="id"
                                                    inputMode="text"
                                                    maxLength={3}
                                                    autoFocus={!!name}
                                                    value={field.state.value}
                                                    pattern={REGEXP_ONLY_CHARS}
                                                    onChange={(value) => field.handleChange(value.toUpperCase())}
                                                >
                                                    <InputOTPGroup>
                                                        <InputOTPSlot index={0} />
                                                        <InputOTPSlot index={1} />
                                                        <InputOTPSlot index={2} />
                                                    </InputOTPGroup>
                                                </InputOTP>
                                                {!field.state.meta.isValid && <em className="text-sm text-red-500">{field.state.meta.errors.join(',')}</em>}
                                            </div>
                                        )}
                                    />
                                )}
                            />
                        </div>

                        <form.Subscribe
                            selector={(state) => [state.canSubmit, state.isSubmitting]}
                            children={([canSubmit, isSubmitting]) => (
                                <Button type="submit" disabled={!canSubmit || isSubmitting}>
                                    Connect
                                </Button>
                            )}
                        />
                    </form>
                </DialogContent>
            </Dialog>
        </>
    )
}
