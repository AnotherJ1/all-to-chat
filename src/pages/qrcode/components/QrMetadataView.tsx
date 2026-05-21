/**
 * QrMetadataView - 二维码容量元信息
 *
 * 实时展示：
 *  - 当前内容字节数（UTF-8）
 *  - 估算占用最小 QR 版本
 *  - 占用百分比，并按阈值上色：
 *      < 80%  : 正常（次要文本色）
 *      >= 80% : 橙色提示"接近容量上限"
 *      > 100% : 红色提示"超出容量，请提高容错等级或减少内容"
 */
import { useMemo } from 'react'
import { useQrCodeContext } from '../QrCodeContext'
import { getQrCapacityInfo } from '../utils/qrCapacity'

export function QrMetadataView(): JSX.Element {
  const { generator } = useQrCodeContext()
  const { text, errorLevel } = generator

  const info = useMemo(() => getQrCapacityInfo(text, errorLevel), [text, errorLevel])

  // 判定状态颜色与提示
  const overflow = info.percentUsed > 100
  const warn = !overflow && info.percentUsed >= 80

  // 进度条最大显示 100%（溢出部分用红色满条）
  const barPercent = Math.min(100, info.percentUsed)

  const barColor = overflow ? '#ef4444' : warn ? '#f59e0b' : 'var(--accent-1)'

  return (
    <div
      data-testid="qr-metadata"
      className="rounded-lg p-3 text-xs flex flex-col gap-2"
      style={{
        background: 'var(--bg-secondary)',
        border: 'var(--border-width) solid var(--border-color)',
        color: 'var(--text-secondary)',
      }}
      aria-label="二维码容量信息"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          字节数：
          <strong style={{ color: 'var(--text-primary)' }}>{info.byteLength}</strong>
          <span style={{ marginLeft: 4 }}>B</span>
        </span>
        <span>
          估算版本：
          <strong style={{ color: 'var(--text-primary)' }}>v{info.version}</strong>
          <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>
            (上限 {info.maxBytes}B)
          </span>
        </span>
        <span>
          占用：
          <strong style={{ color: barColor }}>
            {info.percentUsed.toFixed(1)}%
          </strong>
        </span>
      </div>

      {/* 占用进度条 */}
      <div
        style={{
          width: '100%',
          height: 6,
          borderRadius: 3,
          background: 'var(--bg-surface)',
          overflow: 'hidden',
        }}
        role="progressbar"
        aria-valuenow={Math.round(info.percentUsed)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          style={{
            width: `${barPercent}%`,
            height: '100%',
            background: barColor,
            transition: 'width 200ms ease',
          }}
        />
      </div>

      {warn && (
        <div role="alert" style={{ color: '#d97706' }}>
          ⚠ 接近容量上限，可能需要提高 QR 版本
        </div>
      )}
      {overflow && (
        <div role="alert" style={{ color: '#ef4444' }}>
          ✗ 超出容量，请提高容错等级或减少内容
        </div>
      )}
    </div>
  )
}
