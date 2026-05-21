/**
 * 二维码工具的 React Context
 * 把 generator/parser 的关键 setter 通过 context 暴露给后续 worker 模块，避免 prop drilling。
 *
 * worker-3 (TemplateBuilder) 通过 setText 把模板生成结果写回；
 * worker-4 (StyledQrPanel / SizePresetButtons) 通过 setSize 等 setter 改样式；
 * worker-5 (HistoryPanel) 通过整个 context 恢复一条历史；
 * worker-2 (CameraScanner) 通过 decodeFile 复用解析逻辑。
 */
import { createContext, useContext } from 'react'
import type { UseQrGeneratorReturn } from './hooks/useQrGenerator'
import type { UseQrParserReturn } from './hooks/useQrParser'

export interface QrCodeContextValue {
  generator: UseQrGeneratorReturn
  parser: UseQrParserReturn
}

export const QrCodeContext = createContext<QrCodeContextValue | null>(null)

/** 在 QrCodeContext 内部使用，否则抛错 */
export function useQrCodeContext(): QrCodeContextValue {
  const ctx = useContext(QrCodeContext)
  if (!ctx) {
    throw new Error('useQrCodeContext 必须在 <QrCodeContext.Provider> 内部使用')
  }
  return ctx
}
