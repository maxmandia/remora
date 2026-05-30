import { Button } from '@/components/ui/button'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <div className="p-8">
      <h1 className="text-4xl font-semibold">Welcome to TanStack Start</h1>
      <p className="mt-4 text-lg font-light">
        prompt
      </p>
      <Button>Click me</Button>
    </div>
  )
}
