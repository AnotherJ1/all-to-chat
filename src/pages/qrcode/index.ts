/**
 * qrcode 模块对外汇总导出。
 * 其他 worker 应统一使用：
 *   import { useQrGenerator, useQrParser, QrCodeContext, useQrCodeContext, ... } from '../qrcode'
 * 而不是深路径 import。
 */
export * from './types'
export * from './utils/qrUtils'
export { useQrGenerator } from './hooks/useQrGenerator'
export type { UseQrGeneratorReturn } from './hooks/useQrGenerator'
export { useQrParser } from './hooks/useQrParser'
export type { UseQrParserReturn } from './hooks/useQrParser'
export { QrCodeContext, useQrCodeContext } from './QrCodeContext'
export type { QrCodeContextValue } from './QrCodeContext'

// 各 worker 真实实现（替换 Stubs.tsx 占位）
export { CameraScanner } from './components/CameraScanner'
export { TemplateBuilder } from './components/TemplateBuilder'
export { ParsedTemplateView } from './components/ParsedTemplateView'
export { StyledQrPanel } from './components/StyledQrPanel'
export { SizePresetButtons } from './components/SizePresetButtons'
export { QrMetadataView } from './components/QrMetadataView'
export { HistoryPanel } from './components/HistoryPanel'
export { BatchPanel } from './components/BatchPanel'
export { ThemeHintBar } from './components/ThemeHintBar'

// 模板构建工具
export {
  buildWifi,
  buildVCard,
  buildSms,
  buildEmail,
  buildGeo,
  parseTemplate,
} from './utils/templateBuilders'

// 容量信息
export { getQrCapacityInfo } from './utils/qrCapacity'

// 历史与 URL 同步 Hook
export { useQrHistory } from './hooks/useQrHistory'
export { useQrUrlSync, readInitialFromUrl } from './hooks/useQrUrlSync'
