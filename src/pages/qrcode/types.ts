/**
 * 二维码工具公共类型定义
 * worker-2/3/4/5 都从此处导入类型
 */

/** 二维码容错等级 */
export type QrErrorLevel = 'L' | 'M' | 'Q' | 'H'

/** 二维码点样式（worker-4 风格化二维码使用） */
export type QrDotStyle = 'square' | 'rounded' | 'dots'

/** 二维码渐变定义（worker-4 风格化二维码使用） */
export interface QrGradient {
  type: 'linear' | 'radial'
  from: string
  to: string
  /** 线性渐变方向角度，单位度 */
  angle?: number
}

/** 二维码生成的统一参数 */
export interface QrGenOptions {
  text: string
  size: number
  fgColor: string
  bgColor: string
  errorLevel: QrErrorLevel
  /** Logo 已转为 dataURL，避免反复 createObjectURL/revokeObjectURL */
  logoDataUrl?: string
  /** 风格化点样式 */
  dotStyle?: QrDotStyle
  /** 渐变前景色 */
  gradient?: QrGradient
}

/** 单条历史记录 */
export interface QrHistoryItem {
  id: string
  text: string
  options: QrGenOptions
  createdAt: number
}

/** 模板生成器支持的模板类型 */
export type QrTemplateType = 'text' | 'url' | 'wifi' | 'vcard' | 'sms' | 'email' | 'geo'

/** WiFi 模板字段（worker-3） */
export interface WifiTemplate {
  ssid: string
  password: string
  encryption: 'WPA' | 'WEP' | 'nopass'
  hidden?: boolean
}

/** vCard 模板字段（worker-3） */
export interface VCardTemplate {
  name: string
  org?: string
  title?: string
  phone?: string
  email?: string
  url?: string
  address?: string
}

/** 短信模板字段（worker-3） */
export interface SmsTemplate {
  phone: string
  body?: string
}

/** 邮件模板字段（worker-3） */
export interface EmailTemplate {
  to: string
  subject?: string
  body?: string
}

/** 地理位置模板字段（worker-3） */
export interface GeoTemplate {
  lat: number
  lng: number
  query?: string
}

/** jsQR 解析结果中的角点位置 */
export interface QrLocation {
  topLeftCorner: { x: number; y: number }
  topRightCorner: { x: number; y: number }
  bottomLeftCorner: { x: number; y: number }
  bottomRightCorner: { x: number; y: number }
}
