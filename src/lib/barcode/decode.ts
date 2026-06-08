/**
 * 条形码解析 —— 基于 @zxing/library
 *
 * ZXing 能同时识别一维码（Code128 / EAN / UPC / ITF / Codabar…）与二维码。
 * 这里封装两条入口：
 *  - decodeImageFile：从用户上传的图片 File 解析（一次性）
 *  - createCameraReader：包装摄像头实时解析器，供 React 组件持有 / 停止
 *
 * 设计要点：
 *  - 延迟构造 reader，避免页面加载即实例化（zxing 体积大）
 *  - 统一把 ZXing 的 Result 映射成 DecodeResult（含格式可读名）
 *  - 找不到码时返回 null 而非抛错，调用侧据此提示“未识别到条形码”
 */
import {
  BrowserMultiFormatReader,
  type Result,
} from '@zxing/library'

export interface DecodeResult {
  /** 解析出的文本 */
  text: string
  /** 码制可读名（如 CODE_128 / EAN_13 / QR_CODE） */
  format: string
}

/** 把 ZXing Result 映射为简洁结构 */
function toDecodeResult(result: Result): DecodeResult {
  return {
    text: result.getText(),
    // BarcodeFormat 枚举 → 字符串名，例如 "EAN_13"
    format: String(result.getBarcodeFormat?.() ?? '')
      // 数字枚举回退：直接给原始值
      || 'UNKNOWN',
  }
}

/** 单例 reader（图片解析复用同一个，无副作用） */
let sharedReader: BrowserMultiFormatReader | null = null
function getReader(): BrowserMultiFormatReader {
  if (!sharedReader) sharedReader = new BrowserMultiFormatReader()
  return sharedReader
}

/**
 * 从图片 File 解析条形码。
 * @returns 命中返回 DecodeResult；未识别返回 null。
 * @throws 仅在图片本身无法加载（损坏 / 非图片）时抛错。
 */
export async function decodeImageFile(file: File): Promise<DecodeResult | null> {
  const url = URL.createObjectURL(file)
  try {
    const reader = getReader()
    const result = await reader.decodeFromImageUrl(url)
    return result ? toDecodeResult(result) : null
  } catch (err) {
    // ZXing 在“没找到码”时抛 NotFoundException —— 归一化为 null
    if (isNotFound(err)) return null
    throw err
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** 从已存在的 <img>/<canvas>/dataURL 解析（供摄像头抓帧复用） */
export async function decodeImageElement(
  source: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
): Promise<DecodeResult | null> {
  try {
    const reader = getReader()
    const result = await reader.decodeFromImageElement(source as HTMLImageElement)
    return result ? toDecodeResult(result) : null
  } catch (err) {
    if (isNotFound(err)) return null
    throw err
  }
}

/** ZXing 的“未找到”异常判定 —— 兼容不同版本的命名 */
function isNotFound(err: unknown): boolean {
  if (!err) return false
  const name = (err as { name?: string }).name ?? ''
  const ctor = (err as { constructor?: { name?: string } }).constructor?.name ?? ''
  return name === 'NotFoundException' || ctor === 'NotFoundException'
}

export interface CameraReaderHandle {
  /** 启动持续解析：命中即回调（不自动停止，由调用方决定） */
  start: (
    video: HTMLVideoElement,
    deviceId: string | undefined,
    onResult: (result: DecodeResult) => void,
  ) => Promise<void>
  /** 停止解析并释放摄像头 */
  stop: () => void
  /** 枚举可用摄像头 */
  listVideoInputs: () => Promise<MediaDeviceInfo[]>
}

/**
 * 创建一个独立的摄像头解析器实例（与图片解析的单例隔离，便于独立 reset）。
 * 返回 handle，组件持有后在 cleanup 时调用 stop()。
 */
export function createCameraReader(): CameraReaderHandle {
  const reader = new BrowserMultiFormatReader()

  return {
    async start(video, deviceId, onResult) {
      await reader.decodeFromVideoDevice(deviceId ?? null, video, (result, err) => {
        if (result) {
          onResult(toDecodeResult(result))
        }
        // err 多为每帧“未找到”，忽略；真正的设备错误由 start 的 reject 抛出
        void err
      })
    },
    stop() {
      try {
        reader.reset()
      } catch {
        /* ignore */
      }
    },
    async listVideoInputs() {
      try {
        return await reader.listVideoInputDevices()
      } catch {
        return []
      }
    },
  }
}
