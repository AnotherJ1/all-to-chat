/**
 * 条形码生成 —— 基于 JsBarcode
 *
 * JsBarcode 直接把条形码画到一个 <svg> 或 <canvas> DOM 节点上。
 * 这里封装两类纯函数：
 *  - 码制元数据（FORMATS）：每种码制的显示名、对输入的约束、占位示例
 *  - validateValue：在调用 JsBarcode 之前做前置校验，给出可读中文错误
 *  - renderToSvg / renderToCanvas：把校验通过的值渲染到 DOM 节点
 *
 * 之所以自己先校验：JsBarcode 对非法输入会 `throw`（valid 回调里），
 * 直接渲染会污染控制台并破坏 React 渲染流程，提前拦截体验更好。
 */
import JsBarcode from 'jsbarcode'

/** 支持的码制（覆盖最常用的一维码） */
export type BarcodeFormat =
  | 'CODE128'
  | 'CODE39'
  | 'EAN13'
  | 'EAN8'
  | 'UPC'
  | 'ITF14'
  | 'MSI'
  | 'pharmacode'
  | 'codabar'

export interface FormatMeta {
  /** JsBarcode 识别的 format 值 */
  format: BarcodeFormat
  /** 中文显示名 */
  label: string
  /** 占位/示例值 */
  placeholder: string
  /** 一句话说明输入约束 */
  hint: string
}

export const FORMATS: FormatMeta[] = [
  { format: 'CODE128', label: 'Code 128', placeholder: 'Hello-123', hint: '通用，支持全部 ASCII 字符' },
  { format: 'CODE39', label: 'Code 39', placeholder: 'CODE39', hint: '大写字母、数字与 - . $ / + % 空格' },
  { format: 'EAN13', label: 'EAN-13', placeholder: '4006381333931', hint: '需 12 位数字（第 13 位校验位自动补全）' },
  { format: 'EAN8', label: 'EAN-8', placeholder: '96385074', hint: '需 7 位数字（自动补校验位）' },
  { format: 'UPC', label: 'UPC-A', placeholder: '036000291452', hint: '需 11 位数字（自动补校验位）' },
  { format: 'ITF14', label: 'ITF-14', placeholder: '1234567890123', hint: '需 13 位数字（自动补校验位）' },
  { format: 'MSI', label: 'MSI', placeholder: '1234567', hint: '仅数字' },
  { format: 'pharmacode', label: 'Pharmacode', placeholder: '1234', hint: '整数 3–131070' },
  { format: 'codabar', label: 'Codabar', placeholder: 'A40156B', hint: '数字与 - $ : / . +，可带 A–D 起止符' },
]

/** 按 format 取元数据 */
export function getFormatMeta(format: BarcodeFormat): FormatMeta {
  return FORMATS.find((f) => f.format === format) ?? FORMATS[0]
}

export interface ValidationResult {
  ok: boolean
  /** ok=false 时的可读错误 */
  message?: string
}

/**
 * 在渲染前对 value 做轻量前置校验。
 * 只拦截“一定会让 JsBarcode 抛错”的明显问题，细粒度校验交给 JsBarcode 自身。
 */
export function validateValue(format: BarcodeFormat, raw: string): ValidationResult {
  const value = raw.trim()
  if (!value) return { ok: false, message: '请输入内容' }

  const onlyDigits = /^\d+$/
  switch (format) {
    case 'EAN13':
      if (!onlyDigits.test(value)) return { ok: false, message: 'EAN-13 仅接受数字' }
      if (value.length !== 12 && value.length !== 13) return { ok: false, message: 'EAN-13 需 12 位（含校验位则 13 位）数字' }
      break
    case 'EAN8':
      if (!onlyDigits.test(value)) return { ok: false, message: 'EAN-8 仅接受数字' }
      if (value.length !== 7 && value.length !== 8) return { ok: false, message: 'EAN-8 需 7 位（含校验位则 8 位）数字' }
      break
    case 'UPC':
      if (!onlyDigits.test(value)) return { ok: false, message: 'UPC-A 仅接受数字' }
      if (value.length !== 11 && value.length !== 12) return { ok: false, message: 'UPC-A 需 11 位（含校验位则 12 位）数字' }
      break
    case 'ITF14':
      if (!onlyDigits.test(value)) return { ok: false, message: 'ITF-14 仅接受数字' }
      if (value.length !== 13 && value.length !== 14) return { ok: false, message: 'ITF-14 需 13 位（含校验位则 14 位）数字' }
      break
    case 'MSI':
      if (!onlyDigits.test(value)) return { ok: false, message: 'MSI 仅接受数字' }
      break
    case 'pharmacode': {
      if (!onlyDigits.test(value)) return { ok: false, message: 'Pharmacode 仅接受整数' }
      const n = Number(value)
      if (n < 3 || n > 131070) return { ok: false, message: 'Pharmacode 取值范围 3–131070' }
      break
    }
    case 'CODE39':
      if (!/^[0-9A-Z\-.$/+%\s]+$/.test(value)) {
        return { ok: false, message: 'Code 39 仅支持大写字母、数字与 - . $ / + % 空格' }
      }
      break
    case 'codabar':
      if (!/^[A-D]?[0-9\-$:/.+]+[A-D]?$/i.test(value)) {
        return { ok: false, message: 'Codabar 仅支持数字与 - $ : / . +，可选 A–D 起止符' }
      }
      break
    case 'CODE128':
    default:
      // CODE128 支持全部 ASCII，不再额外限制
      break
  }
  return { ok: true }
}

/** 渲染选项 */
export interface RenderOptions {
  format: BarcodeFormat
  /** 单条窄条宽度（px），影响整体宽度 */
  width: number
  /** 条码高度（px） */
  height: number
  /** 是否在底部显示原始文本 */
  displayValue: boolean
  /** 前景（条）颜色 */
  lineColor: string
  /** 背景颜色 */
  background: string
  /** 文本与条码间距 */
  margin: number
}

export const DEFAULT_OPTIONS: RenderOptions = {
  format: 'CODE128',
  width: 2,
  height: 100,
  displayValue: true,
  lineColor: '#000000',
  background: '#ffffff',
  margin: 10,
}

/**
 * 把条形码渲染到给定的 SVG / Canvas 元素。
 * 调用前应先 validateValue；这里再包一层 try/catch 以防 JsBarcode 对边界值抛错。
 * @returns 成功 true；失败返回 { ok:false, message }
 */
export function render(
  element: SVGElement | HTMLCanvasElement,
  value: string,
  options: RenderOptions,
): ValidationResult {
  try {
    JsBarcode(element, value.trim(), {
      format: options.format,
      width: options.width,
      height: options.height,
      displayValue: options.displayValue,
      lineColor: options.lineColor,
      background: options.background,
      margin: options.margin,
      font: 'monospace',
      valid: (valid: boolean) => {
        if (!valid) throw new Error('该内容不符合所选码制的编码规则')
      },
    })
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : '生成失败：内容不符合所选码制'
    return { ok: false, message }
  }
}
