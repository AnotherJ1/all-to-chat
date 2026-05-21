/**
 * 各 worker 子模块的占位 Stub。
 * 完成 Task #1 时统一返回 null，让其他 worker 在自己的任务中接管该文件。
 *
 * 各 worker 替换约定：
 *  - worker-2 接管 CameraScanner.tsx
 *  - worker-3 接管 TemplateBuilder.tsx
 *  - worker-4 接管 StyledQrPanel.tsx 与 SizePresetButtons.tsx
 *  - worker-5 接管 HistoryPanel.tsx 与 BatchPanel.tsx
 *
 * 替换时保留默认导出名，QrCodePage 主壳不需要再调整 import。
 */

/** 摄像头实时扫码（worker-2 接管） */
export function CameraScanner(): JSX.Element | null {
  return null
}

/** 结构化模板生成器（worker-3 接管） */
export function TemplateBuilder(): JSX.Element | null {
  return null
}

/** 风格化二维码面板（worker-4 接管） */
export function StyledQrPanel(): JSX.Element | null {
  return null
}

/** 尺寸预设按钮组（worker-4 接管） */
export function SizePresetButtons(): JSX.Element | null {
  return null
}

/** 历史记录面板（worker-5 接管） */
export function HistoryPanel(): JSX.Element | null {
  return null
}

/** 批量生成 / 批量解析面板（worker-5 接管） */
export function BatchPanel(): JSX.Element | null {
  return null
}
