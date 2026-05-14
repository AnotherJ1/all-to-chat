import { useEffect } from 'react'
import Layout from './components/Layout'
import ChatView from './components/ChatView'
import ToastContainer from './components/Toast'
import ErrorBoundary from './components/ErrorBoundary'
import { useConfigStore } from './stores/configStore'
import { useSessionStore } from './stores/sessionStore'

export default function App() {
  const { theme } = useConfigStore()
  const { createSession, sessions } = useSessionStore()

  // 初始化时创建第一个会话
  useEffect(() => {
    if (sessions.length === 0) {
      createSession()
    }
  }, [])

  // 应用主题
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <ErrorBoundary>
      <Layout>
        <ChatView />
      </Layout>
      <ToastContainer />
    </ErrorBoundary>
  )
}
