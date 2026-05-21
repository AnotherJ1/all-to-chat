/**
 * CameraScanner —— 摄像头实时扫码组件（worker-2）
 *
 * 设计要点：
 * - 用户点击"启动摄像头"才请求权限，避免一打开页面就弹权限框
 * - getUserMedia 失败 / 不支持 / 权限拒绝 时给出可读错误
 * - requestAnimationFrame 循环抓 video 帧 → 隐藏 canvas getImageData → jsQR 解析
 * - 识别成功：
 *     1) 立刻 stop scanning（防止重复触发）
 *     2) 调用 props.onScan(text) 回调（业务侧用于把结果注入 useQrParser）
 *     3) 若未提供 onScan，则降级调用 QrCodeContext.parser.decodeFile 复用全套解析流程
 * - 摄像头切换：enumerateDevices().filter(kind === 'videoinput')，下拉选择 deviceId
 *   切换时主动停止旧 stream 再重新 getUserMedia
 * - 卸载 / 停止 时 stream.getTracks().forEach(t => t.stop())，防止摄像头一直亮着
 * - 移动端友好：满宽，aspect-ratio: 1，CSS 叠加扫描框 overlay
 *
 * 不修改 Stubs.tsx / index.ts / QrCodePage.tsx —— 由 team-lead 统一在 index.ts 切换 re-export 来源。
 */
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import jsQR from 'jsqr'
import { QrCodeContext } from '../QrCodeContext'
import { toast } from '../../../stores/toastStore'

export interface CameraScannerProps {
  /** 识别成功回调；返回 true 表示业务侧已处理，组件不再做降级 */
  onScan?: (text: string) => void | boolean
  /** 默认折叠（首次打开页面不主动唤起摄像头） */
  defaultOpen?: boolean
}

interface VideoDeviceOption {
  deviceId: string
  label: string
}

/** 把当前 video 帧画到隐藏 canvas，并返回 ImageData（用于 jsQR） */
function grabImageData(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): ImageData | null {
  if (video.readyState < 2 /* HAVE_CURRENT_DATA */) return null
  const w = video.videoWidth
  const h = video.videoHeight
  if (!w || !h) return null

  // 限制最大边，避免移动端高分辨率帧导致 getImageData 超时
  const MAX_SIDE = 720
  const ratio = Math.min(1, MAX_SIDE / Math.max(w, h))
  const cw = Math.max(1, Math.floor(w * ratio))
  const ch = Math.max(1, Math.floor(h * ratio))
  if (canvas.width !== cw) canvas.width = cw
  if (canvas.height !== ch) canvas.height = ch
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  try {
    ctx.drawImage(video, 0, 0, cw, ch)
    return ctx.getImageData(0, 0, cw, ch)
  } catch (err) {
    console.error('[CameraScanner] drawImage/getImageData 失败:', err)
    return null
  }
}

/** 把当前 canvas 内容转成 File，便于复用 useQrParser.decodeFile 进行结果注入 */
async function canvasToImageFile(
  canvas: HTMLCanvasElement,
  filename = 'camera-scan.png',
): Promise<File | null> {
  return new Promise((resolve) => {
    if (!canvas.toBlob) {
      resolve(null)
      return
    }
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(null)
        return
      }
      resolve(new File([blob], filename, { type: blob.type || 'image/png' }))
    }, 'image/png')
  })
}

export function CameraScanner({
  onScan,
  defaultOpen = false,
}: CameraScannerProps): JSX.Element {
  // QrCodeContext 在测试场景下可能没有 Provider —— 用裸 useContext 而非 useQrCodeContext，
  // 拿不到也不抛错，组件依然可用，仅失去"自动注入 parseResult"的能力。
  const ctx = useContext(QrCodeContext)
  const parserDecodeFile = ctx?.parser.decodeFile

  const [open, setOpen] = useState<boolean>(defaultOpen)
  const [running, setRunning] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [devices, setDevices] = useState<VideoDeviceOption[]>([])
  const [activeDeviceId, setActiveDeviceId] = useState<string>('')

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const hiddenCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  /** 标记当前是否处于扫描中（防止 stop 后还有未消费的 rAF 帧再次触发回调） */
  const scanningRef = useRef<boolean>(false)
  /** 防止 onScan 被识别成功的同一帧多次触发 */
  const hitRef = useRef<boolean>(false)

  /** 摄像头不支持检测 —— SSR / 老浏览器 / iOS 非 HTTPS 场景 */
  const supported = useMemo<boolean>(() => {
    if (typeof navigator === 'undefined') return false
    if (!navigator.mediaDevices) return false
    return typeof navigator.mediaDevices.getUserMedia === 'function'
  }, [])

  /** 释放当前 stream，并取消 rAF —— 卸载 / 切换 / 命中 / 用户停止 都会调用 */
  const stopScanning = useCallback(() => {
    scanningRef.current = false
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    const stream = streamRef.current
    if (stream) {
      try {
        stream.getTracks().forEach((t) => {
          try { t.stop() } catch (err) { console.warn(err) }
        })
      } catch (err) {
        console.warn('[CameraScanner] stop tracks 失败:', err)
      }
    }
    streamRef.current = null
    if (videoRef.current) {
      try { videoRef.current.srcObject = null } catch { /* ignore */ }
    }
    setRunning(false)
  }, [])

  /** rAF 循环：每帧抓画面 → jsQR 解析 */
  const tick = useCallback(async () => {
    if (!scanningRef.current) return
    const video = videoRef.current
    const canvas = hiddenCanvasRef.current
    if (!video || !canvas) {
      rafRef.current = requestAnimationFrame(() => { void tick() })
      return
    }

    const imageData = grabImageData(video, canvas)
    if (imageData) {
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      })
      if (code && code.data && !hitRef.current) {
        hitRef.current = true
        // 命中：先停扫描，避免重复回调
        scanningRef.current = false

        // 1) 业务回调
        let handled = false
        if (onScan) {
          try {
            const ret = onScan(code.data)
            handled = ret === true
          } catch (err) {
            console.error('[CameraScanner] onScan 抛错:', err)
          }
        }

        // 2) 降级：注入 parser.parseResult，让右侧"解析结果"正常显示
        if (!handled && parserDecodeFile) {
          try {
            const file = await canvasToImageFile(canvas)
            if (file) {
              await parserDecodeFile(file)
            } else {
              toast.success('扫码成功')
            }
          } catch (err) {
            console.error('[CameraScanner] decodeFile 注入失败:', err)
          }
        } else if (!handled && !parserDecodeFile) {
          // 既无 onScan 又无 context —— 至少给个 toast 反馈
          toast.success(`扫码成功：${code.data.slice(0, 40)}`)
        }

        stopScanning()
        return
      }
    }
    rafRef.current = requestAnimationFrame(() => { void tick() })
  }, [onScan, parserDecodeFile, stopScanning])

  /** 启动摄像头 —— 由用户点击触发 */
  const startScanning = useCallback(
    async (deviceId?: string) => {
      if (!supported) {
        setErrorMsg('当前浏览器或环境不支持 getUserMedia（请使用 HTTPS / 现代浏览器）')
        toast.error('当前浏览器不支持摄像头扫码')
        return
      }
      // 如果已经在跑，先停掉
      stopScanning()
      setErrorMsg('')
      hitRef.current = false

      const constraints: MediaStreamConstraints = {
        audio: false,
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: { ideal: 'environment' } },
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        streamRef.current = stream
        if (!videoRef.current) {
          // video 还没挂载（比如刚 toggle open）—— 直接停掉
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        videoRef.current.srcObject = stream
        // iOS Safari 需要显式 play
        try {
          await videoRef.current.play()
        } catch (err) {
          console.warn('[CameraScanner] video.play 失败（可能用户未交互）:', err)
        }

        // 拉取设备列表（必须在 getUserMedia 后才能拿到 label）
        try {
          const list = await navigator.mediaDevices.enumerateDevices()
          const videoInputs = list
            .filter((d) => d.kind === 'videoinput')
            .map<VideoDeviceOption>((d, i) => ({
              deviceId: d.deviceId,
              label: d.label || `摄像头 ${i + 1}`,
            }))
          setDevices(videoInputs)

          // 同步当前实际使用的 deviceId
          const settings = stream.getVideoTracks()[0]?.getSettings?.()
          const currentId = settings?.deviceId || deviceId || ''
          if (currentId) setActiveDeviceId(currentId)
        } catch (err) {
          console.warn('[CameraScanner] enumerateDevices 失败:', err)
        }

        scanningRef.current = true
        setRunning(true)
        rafRef.current = requestAnimationFrame(() => { void tick() })
      } catch (err: unknown) {
        const e = err as { name?: string; message?: string }
        let msg = '启动摄像头失败'
        if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') {
          msg = '摄像头权限被拒绝，请在浏览器站点设置中允许后重试'
        } else if (e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError') {
          msg = '未找到可用的摄像头设备'
        } else if (e?.name === 'NotReadableError') {
          msg = '摄像头被其他应用占用，请关闭后重试'
        } else if (e?.message) {
          msg = `启动摄像头失败：${e.message}`
        }
        setErrorMsg(msg)
        toast.error(msg)
        setRunning(false)
      }
    },
    [supported, stopScanning, tick],
  )

  /** 切换摄像头 */
  const handleSwitchDevice = useCallback(
    (deviceId: string) => {
      setActiveDeviceId(deviceId)
      if (running) {
        void startScanning(deviceId)
      }
    },
    [running, startScanning],
  )

  // 卸载时务必释放摄像头
  useEffect(() => {
    return () => {
      stopScanning()
    }
  }, [stopScanning])

  // 折叠时也释放
  useEffect(() => {
    if (!open && running) {
      stopScanning()
    }
  }, [open, running, stopScanning])

  return (
    <div
      className="theme-card-section"
      data-testid="camera-scanner"
      style={{
        padding: '12px',
        borderRadius: 'var(--radius-sm)',
        border: 'var(--border-width) solid var(--border-color)',
        background: 'var(--bg-secondary)',
      }}
    >
      {/* 折叠头 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between"
        data-testid="camera-scanner-toggle"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-primary)',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          padding: '4px 0',
        }}
        aria-expanded={open}
      >
        <span>📷 启用摄像头扫码</span>
        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
          {open ? '收起 ▲' : '展开 ▼'}
        </span>
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-2">
          {!supported && (
            <div
              className="text-xs px-3 py-2 rounded"
              style={{
                background: 'rgba(239,68,68,0.08)',
                color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              当前浏览器或环境不支持摄像头扫码（需 HTTPS + 现代浏览器）
            </div>
          )}

          {/* 视频预览 + 扫描框 overlay */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '1 / 1',
              background: '#000',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
            }}
          >
            <video
              ref={videoRef}
              data-testid="camera-scanner-video"
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: running ? 'block' : 'none',
              }}
            />
            {!running && (
              <div
                className="absolute inset-0 flex items-center justify-center text-xs"
                style={{ color: 'rgba(255,255,255,0.55)' }}
              >
                摄像头未启动
              </div>
            )}
            {/* CSS 扫描框 overlay */}
            {running && (
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    width: '60%',
                    height: '60%',
                    border: '2px solid var(--accent-1, #6366f1)',
                    borderRadius: '8px',
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
                  }}
                />
              </div>
            )}
            {/* 隐藏抓帧 canvas */}
            <canvas
              ref={hiddenCanvasRef}
              data-testid="camera-scanner-canvas"
              style={{ display: 'none' }}
            />
          </div>

          {/* 控件区 */}
          <div className="flex flex-wrap gap-2 items-center">
            {!running ? (
              <button
                type="button"
                className="theme-btn theme-btn-primary"
                onClick={() => void startScanning(activeDeviceId || undefined)}
                disabled={!supported}
                data-testid="camera-scanner-start"
                style={{ padding: '6px 14px', fontSize: '12px' }}
              >
                启动摄像头
              </button>
            ) : (
              <button
                type="button"
                className="theme-btn"
                onClick={stopScanning}
                data-testid="camera-scanner-stop"
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  borderColor: '#ef4444',
                  color: '#ef4444',
                }}
              >
                停止扫描
              </button>
            )}

            {devices.length > 1 && (
              <select
                className="theme-select"
                value={activeDeviceId}
                onChange={(e) => handleSwitchDevice(e.target.value)}
                data-testid="camera-scanner-device"
                style={{ padding: '6px 28px 6px 10px', fontSize: '12px' }}
                aria-label="选择摄像头"
              >
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          {errorMsg && (
            <div
              className="text-xs px-3 py-2 rounded"
              data-testid="camera-scanner-error"
              style={{
                background: 'rgba(239,68,68,0.08)',
                color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              ⚠ {errorMsg}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default CameraScanner
