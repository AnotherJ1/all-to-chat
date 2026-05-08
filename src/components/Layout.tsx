import { ReactNode } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import MainArea from './MainArea'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="relative min-h-screen">
      {/* Aurora Background */}
      <div className="aurora-bg" />

      {/* Main Layout */}
      <div className="relative z-10 flex h-screen">
        <Sidebar />
        <div className="flex flex-col flex-1">
          <Header />
          <MainArea>{children}</MainArea>
        </div>
      </div>
    </div>
  )
}
