import { ReactNode, useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import MainArea from './MainArea'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className="relative min-h-screen">
      {/* Aurora Background */}
      <div className="aurora-bg" aria-hidden="true" />

      {/* Main Layout */}
      <div className="relative z-10 flex h-screen">
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
        <div className="flex flex-col flex-1 min-w-0">
          <Header />
          <MainArea>{children}</MainArea>
        </div>
      </div>
    </div>
  )
}
