import ImageGenerator from '../components/image/ImageGenerator'
import BackToHome from '../components/common/BackToHome'

/**
 * 图片生成工具页面壳
 * 桌面端：左侧表单 + 右侧历史
 * 移动端：标签切换式（生成 / 历史）
 */
export default function ImagePage() {
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      {/* 桌面端返回首页按钮（移动端在 ImageGenerator 顶部栏内） */}
      <div className="hidden md:block">
        <BackToHome />
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <ImageGenerator />
      </div>
    </div>
  )
}
