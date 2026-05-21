/**
 * 批量打包工具
 *
 * - generateBatchZip: 把多个 PNG/任意 Blob 打成一个 ZIP
 * - itemsToCsv: 把批量解析结果转 CSV（含 BOM，Excel 友好）
 * - triggerBlobDownload: 通过临时 a 标签触发下载（替代 file-saver，零依赖更稳）
 */
import JSZip from 'jszip'

/** 单条批量打包项 */
export interface BatchZipItem {
  name: string
  blob: Blob
}

/**
 * 把多个文件打包为 ZIP Blob
 * @param items 名称和 Blob 的列表（同名会被自动加序号 _2, _3 ...）
 */
export async function generateBatchZip(items: BatchZipItem[]): Promise<Blob> {
  const zip = new JSZip()
  // 处理同名冲突
  const usedNames = new Map<string, number>()
  for (const item of items) {
    let name = item.name || `file_${zip.files ? Object.keys(zip.files).length + 1 : 1}`
    if (usedNames.has(name)) {
      const count = (usedNames.get(name) ?? 1) + 1
      usedNames.set(name, count)
      const dot = name.lastIndexOf('.')
      name = dot > 0
        ? `${name.slice(0, dot)}_${count}${name.slice(dot)}`
        : `${name}_${count}`
    } else {
      usedNames.set(name, 1)
    }
    zip.file(name, item.blob)
  }
  return zip.generateAsync({ type: 'blob' })
}

/**
 * dataURL → Blob（用于把 QRCode.toDataURL 结果塞进 ZIP）
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const idx = dataUrl.indexOf(',')
  if (idx < 0) throw new Error('非法 dataURL')
  const meta = dataUrl.slice(0, idx) // 例如 data:image/png;base64
  const body = dataUrl.slice(idx + 1)
  const isBase64 = /;base64/i.test(meta)
  const mimeMatch = /data:([^;,]+)/i.exec(meta)
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream'
  if (!isBase64) {
    return new Blob([decodeURIComponent(body)], { type: mime })
  }
  const binary = atob(body)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/** 通过临时 a 标签触发 Blob 下载（不引入 file-saver） */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  if (typeof document === 'undefined') return
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } finally {
    // 微任务后释放，给浏览器一帧时间发起下载
    setTimeout(() => {
      try {
        URL.revokeObjectURL(url)
      } catch {
        // 忽略
      }
    }, 0)
  }
}

/** 把 CSV 单元格安全转义（包含逗号、换行、引号需要加双引号包裹） */
function csvCell(v: string): string {
  if (/[",\r\n]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`
  }
  return v
}

/** 批量解析结果导出 CSV（含 UTF-8 BOM，Excel 直接打开不乱码） */
export function buildCsv(rows: Array<Record<string, string>>, columns: string[]): Blob {
  const header = columns.map(csvCell).join(',')
  const body = rows
    .map((r) => columns.map((c) => csvCell(r[c] ?? '')).join(','))
    .join('\r\n')
  const text = `${header}\r\n${body}`
  // 显式 UTF-8 BOM (U+FEFF)，让 Excel 直接打开 CSV 不乱码；
  // 用 fromCharCode 构造，避免源码中出现裸 BOM 触发 ESLint no-irregular-whitespace
  const BOM = String.fromCharCode(0xfeff)
  return new Blob([BOM, text], { type: 'text/csv;charset=utf-8' })
}

/** 给文件名补零 */
export function padIndex(i: number, total: number): string {
  const width = String(total).length
  return String(i).padStart(width, '0')
}
