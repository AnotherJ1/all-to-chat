// src/components/filetransfer/ComingSoonCard.tsx

/** 外网渠道占位：解释受 TURN 服务器限制，本期不实现真·外网 P2P */
export default function ComingSoonCard() {
  return (
    <div className="theme-card cursor-default p-8 flex flex-col items-center text-center gap-4" style={{ maxWidth: 560, margin: '0 auto' }}>
      <div className="text-5xl" aria-hidden>🌐</div>
      <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
        外网传输 · 即将推出
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        跨网络的 P2P 直传需要 TURN 中转服务器来穿透对称型 NAT。
        本工具是纯前端零后端应用，暂无稳定的免费 TURN 资源，
        因此外网渠道尚未开放。
      </p>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        当前请使用「内网」渠道：在同一局域网 / 同一热点下，
        两台设备可零服务器直接互传。
      </p>
    </div>
  )
}