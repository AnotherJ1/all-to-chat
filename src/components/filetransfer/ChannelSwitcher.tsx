// src/components/filetransfer/ChannelSwitcher.tsx
import type { Channel } from '../../lib/filetransfer/types'

interface Props {
  value: Channel
  onChange: (c: Channel) => void
}

/** 内网 / 外网 渠道切换（复用 theme-tab 样式） */
export default function ChannelSwitcher({ value, onChange }: Props) {
  const tabs: { key: Channel; label: string }[] = [
    { key: 'lan', label: '内网（局域网直传）' },
    { key: 'wan', label: '外网（即将推出）' },
  ]
  return (
    <div role="tablist" aria-label="传输渠道" className="flex gap-3 justify-center flex-wrap">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={value === t.key}
          className="theme-tab"
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}