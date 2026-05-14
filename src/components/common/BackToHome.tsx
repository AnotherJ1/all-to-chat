import { useNavigate } from 'react-router-dom'
import { IconArrowLeft } from './Icons'

/**
 * 返回首页导航按钮 — 主题感知
 */
export default function BackToHome() {
  const navigate = useNavigate()

  return (
    <button
      onClick={() => navigate('/')}
      className="fixed top-4 left-4 z-50 w-10 h-10 flex items-center justify-center theme-btn"
      style={{ padding: '0', width: '40px', height: '40px' }}
      aria-label="返回首页"
    >
      <IconArrowLeft className="w-5 h-5" style={{ color: 'var(--text-primary)' }} />
    </button>
  )
}
