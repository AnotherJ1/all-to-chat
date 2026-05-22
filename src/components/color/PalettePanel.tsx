import { useMemo } from 'react'
import type { RGB } from '../../lib/color/convert'
import { rgbToHex } from '../../lib/color/convert'
import { buildAllPalettes } from '../../lib/color/palette'
import { toast } from '../../stores/toastStore'

/**
 * 调色板面板
 * - 基于主色一次性渲染 5 套方案
 * - 点击色块复制 HEX
 */

interface Props {
  base: RGB
}

export default function PalettePanel({ base }: Props) {
  const all = useMemo(() => buildAllPalettes(base), [base])

  const copy = async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex)
      toast.success(`已复制 ${hex}`)
    } catch {
      toast.error('复制失败')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {all.map(({ scheme, colors }) => (
        <section key={scheme.id}>
          <header style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, fontFamily: 'var(--font-heading)' }}>
              {scheme.name}
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {colors.length} 色
            </span>
          </header>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${colors.length}, minmax(0, 1fr))`,
              gap: '6px',
            }}
          >
            {colors.map((c, i) => {
              const hex = rgbToHex(c)
              return (
                <button
                  key={`${scheme.id}-${i}`}
                  type="button"
                  onClick={() => copy(hex)}
                  title={`点击复制 ${hex}`}
                  style={{
                    background: hex,
                    border: 'var(--border-width) solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    height: '64px',
                    padding: 0,
                    cursor: 'pointer',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                  }}
                >
                  <span
                    style={{
                      fontSize: '11px',
                      fontFamily: "'JetBrains Mono', monospace",
                      padding: '2px 6px',
                      margin: '4px',
                      borderRadius: '4px',
                      background: 'rgba(0, 0, 0, 0.55)',
                      color: '#fff',
                    }}
                  >
                    {hex}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
