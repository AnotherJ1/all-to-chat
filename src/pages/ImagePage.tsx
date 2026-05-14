import ImageGenerator from '../components/image/ImageGenerator'
import BackToHome from '../components/common/BackToHome'

/**
 * 图片生成工具页面壳
 * 全屏布局，包含 ImageGenerator 组件。
 */
export default function ImagePage() {
  return (
    <div className="h-screen w-screen flex flex-col">
      <BackToHome />
      <div className="flex-1 overflow-hidden">
        <ImageGenerator />
      </div>
    </div>
  )
}
