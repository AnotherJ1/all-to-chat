import { ReactNode } from 'react'

interface MainAreaProps {
  children: ReactNode
}

export default function MainArea({ children }: MainAreaProps) {
  return (
    <main className="flex-1 overflow-hidden relative z-10">
      {children}
    </main>
  )
}
