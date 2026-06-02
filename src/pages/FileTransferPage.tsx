// src/pages/FileTransferPage.tsx
import { useState } from 'react'
import BackToHome from '../components/common/BackToHome'
import ChannelSwitcher from '../components/filetransfer/ChannelSwitcher'
import ComingSoonCard from '../components/filetransfer/ComingSoonCard'
import SignalExchange from '../components/filetransfer/SignalExchange'
import TransferPanel from '../components/filetransfer/TransferPanel'
import { useFileTransfer } from '../lib/filetransfer/useFileTransfer'
import type { Channel } from '../lib/filetransfer/types'

export default function FileTransferPage() {
  const [channel, setChannel] = useState<Channel>('lan')
  const ft = useFileTransfer()

  const connected = ft.state === 'connected' || ft.state === 'transferring'

  return (
    <div className="min-h-screen w-full pb-12" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <BackToHome />

      <header className="text-center pt-16 pb-6 px-4">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>跨设备文件传输</h1>
        <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
          内网零服务器 P2P 直传文件与文本，数据不经任何中转
        </p>
      </header>

      <div className="px-4 mb-8">
        <ChannelSwitcher value={channel} onChange={setChannel} />
      </div>

      <main className="px-4" style={{ maxWidth: 1100, margin: '0 auto' }}>
        {channel === 'wan' ? (
          <ComingSoonCard />
        ) : (
          <>
            {/* 错误提示 */}
            {ft.error && (
              <div className="theme-alert theme-alert-error mb-6" role="alert" style={{ maxWidth: 760, margin: '0 auto 1.5rem' }}>
                <span>⚠</span><span>{ft.error}</span>
              </div>
            )}

            {/* 角色选择 */}
            {ft.role === null && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6" style={{ maxWidth: 760, margin: '0 auto' }}>
                <button className="theme-card p-8 flex flex-col items-center gap-3 text-center" onClick={ft.startAsSender}>
                  <div className="text-4xl" aria-hidden>📤</div>
                  <span className="text-lg font-bold" style={{ fontFamily: 'var(--font-heading)' }}>发送文件</span>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>生成连接码给对方</span>
                </button>
                <button className="theme-card p-8 flex flex-col items-center gap-3 text-center" onClick={ft.startAsReceiver}>
                  <div className="text-4xl" aria-hidden>📥</div>
                  <span className="text-lg font-bold" style={{ fontFamily: 'var(--font-heading)' }}>接收文件</span>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>粘贴对方的连接码</span>
                </button>
              </div>
            )}

            {/* 已选角色但未连通：信令交换 */}
            {ft.role !== null && !connected && (
              <section className="theme-card cursor-default p-6" style={{ maxWidth: 760, margin: '0 auto' }}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
                    {ft.role === 'sender' ? '① 把连接码发给对方 → ② 贴回对方的连接码' : '① 贴入对方连接码 → ② 把生成的连接码发回对方'}
                  </h2>
                  <button className="theme-btn" onClick={ft.reset} style={{ fontSize: 12, padding: '4px 12px' }}>重置</button>
                </div>

                {ft.role === 'sender' ? (
                  <SignalExchange
                    localLabel="你的连接码（offer，发给对方）"
                    localCode={ft.localCode}
                    needPaste
                    pasteLabel="粘贴对方回传的连接码（answer）"
                    onSubmit={ft.acceptAnswerCode}
                  />
                ) : (
                  <SignalExchange
                    localLabel="你的连接码（answer，发回对方）"
                    localCode={ft.localCode}
                    needPaste={!ft.localCode}
                    pasteLabel="粘贴对方的连接码（offer）"
                    onSubmit={ft.acceptOfferCode}
                  />
                )}
              </section>
            )}

            {/* 已连通：传输面板 */}
            {connected && (
              <section className="theme-card cursor-default p-6" style={{ maxWidth: 760, margin: '0 auto' }}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold flex items-center gap-2" style={{ fontFamily: 'var(--font-heading)' }}>
                    <span style={{ color: 'var(--color-success)' }}>●</span> 已连接
                  </h2>
                  <button className="theme-btn" onClick={ft.reset} style={{ fontSize: 12, padding: '4px 12px' }}>断开</button>
                </div>
                <TransferPanel
                  items={ft.items}
                  onSendFiles={ft.sendFiles}
                  onSendText={ft.sendText}
                  onDownload={ft.download}
                />
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}