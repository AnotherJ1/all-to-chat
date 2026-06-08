/**
 * BarcodeCameraScanner —— 条形码摄像头实时扫描
 *
 * 与二维码页的 CameraScanner 思路一致，但底层换成 @zxing/library
 * （jsQR 无法识别一维条形码）。ZXing 自带视频解码循环，所以这里不手写 rAF：
 *  - 用户点击“启动摄像头”才请求权限
 *  - createCameraReader().start 持续解析，命中即回调并自动停止
 *  - 卸载 / 折叠 / 停止时调用 stop() 释放摄像头
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createCameraReader, type CameraReaderHandle, type DecodeResult } from '../../lib/barcode/decode'
import { toast } from '../../stores/toastStore'

export interface BarcodeCameraScannerProps {
  /** 识别成功回调 */
  onResult: (result: DecodeResult) => void
}

interface VideoDeviceOption {
  deviceId: string
  label: string
}

export default function BarcodeCameraScanner({ onResult }: BarcodeCameraScannerProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [devices, setDevices] = useState<VideoDeviceOption[]>([])
  const [activeDeviceId, setActiveDeviceId] = useState('')

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const handleRef = useRef<CameraReaderHandle | null>(null)
  const hitRef = useRef(false)

  const supported = useMemo(() => {
    if (typeof navigator === 'undefined') return false
    if (!navigator.mediaDevices) return false
    return typeof navigator.mediaDevices.getUserMedia === 'function'
  }, [])

  const stop = useCallback(() => {
    handleRef.current?.stop()
    handleRef.current = null
    setRunning(false)
  }, [])

  const start = useCallback(
    async (deviceId?: string) => {
      if (!supported) {
        setErrorMsg('当前浏览器或环境不支持摄像头（需 HTTPS + 现代浏览器）')
        toast.error('当前浏览器不支持摄像头扫码')
        return
      }
      stop()
      setErrorMsg('')
      hitRef.current = false

      const handle = createCameraReader()
      handleRef.current = handle
      const video = videoRef.current
      if (!video) return

      try {
        await handle.start(video, deviceId, (result) => {
          if (hitRef.current) return
          hitRef.current = true
          onResult(result)
          stop()
        })
        setRunning(true)

        // 拉取设备列表（权限授予后才有 label）
        const inputs = await handle.listVideoInputs()
        setDevices(
          inputs.map((d, i) => ({ deviceId: d.deviceId, label: d.label || `摄像头 ${i + 1}` })),
        )
        if (deviceId) setActiveDeviceId(deviceId)
      } catch (err: unknown) {
        const e = err as { name?: string; message?: string }
        let msg = '启动摄像头失败'
        if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') {
          msg = '摄像头权限被拒绝，请在浏览器站点设置中允许后重试'
        } else if (e?.name === 'NotFoundError') {
          msg = '未找到可用的摄像头设备'
        } else if (e?.name === 'NotReadableError') {
          msg = '摄像头被其他应用占用，请关闭后重试'
        } else if (e?.message) {
          msg = `启动摄像头失败：${e.message}`
        }
        setErrorMsg(msg)
        toast.error(msg)
        stop()
      }
    },
    [supported, stop, onResult],
  )

  const switchDevice = useCallback(
    (deviceId: string) => {
      setActiveDeviceId(deviceId)
      if (running) void start(deviceId)
    },
    [running, start],
  )

  // 卸载释放
  useEffect(() => () => stop(), [stop])
  // 折叠释放
  useEffect(() => {
    if (!open && running) stop()
  }, [open, running, stop])

  return (
    <div
      data-testid="barcode-camera-scanner"
      style={{
        padding: '12px',
        borderRadius: 'var(--radius-sm)',
        border: 'var(--border-width) solid var(--border-color)',
        background: 'var(--bg-secondary)',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between"
        data-testid="barcode-camera-toggle"
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
        <span>📷 摄像头实时扫描</span>
        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{open ? '收起 ▲' : '展开 ▼'}</span>
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-2">
          {!supported && (
            <div
              className="text-xs px-3 py-2 rounded"
              style={{
                background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
                color: 'var(--color-danger)',
                border: '1px solid color-mix(in srgb, var(--color-danger) 25%, transparent)',
              }}
            >
              当前浏览器或环境不支持摄像头扫码（需 HTTPS + 现代浏览器）
            </div>
          )}

          <div
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '4 / 3',
              background: '#000',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
            }}
          >
            <video
              ref={videoRef}
              data-testid="barcode-camera-video"
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: running ? 'block' : 'none' }}
            />
            {!running && (
              <div
                className="absolute inset-0 flex items-center justify-center text-xs"
                style={{ color: 'rgba(255,255,255,0.55)' }}
              >
                摄像头未启动
              </div>
            )}
            {running && (
              <div
                aria-hidden
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <div
                  style={{
                    width: '80%',
                    height: '40%',
                    border: '2px solid var(--accent-1, #6366f1)',
                    borderRadius: '8px',
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
                  }}
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {!running ? (
              <button
                type="button"
                className="theme-btn theme-btn-primary"
                onClick={() => void start(activeDeviceId || undefined)}
                disabled={!supported}
                data-testid="barcode-camera-start"
                style={{ padding: '6px 14px', fontSize: '12px' }}
              >
                启动摄像头
              </button>
            ) : (
              <button
                type="button"
                className="theme-btn"
                onClick={stop}
                data-testid="barcode-camera-stop"
                style={{ padding: '6px 14px', fontSize: '12px', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
              >
                停止扫描
              </button>
            )}

            {devices.length > 1 && (
              <select
                className="theme-select"
                value={activeDeviceId}
                onChange={(e) => switchDevice(e.target.value)}
                data-testid="barcode-camera-device"
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
              data-testid="barcode-camera-error"
              style={{
                background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
                color: 'var(--color-danger)',
                border: '1px solid color-mix(in srgb, var(--color-danger) 25%, transparent)',
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
