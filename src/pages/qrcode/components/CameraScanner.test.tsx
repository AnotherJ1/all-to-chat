/**
 * CameraScanner 组件测试
 *
 * 覆盖：
 * 1. 默认折叠时不渲染视频区
 * 2. 展开后显示"启动摄像头"按钮、未启动时不显示 stop 按钮
 * 3. 点击启动 → mock getUserMedia 被调用、video 显示
 * 4. 卸载组件时 stream.getTracks().forEach(t.stop) 被调用
 * 5. 不支持 getUserMedia 时显示友好提示
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { CameraScanner } from './CameraScanner'

interface MockTrack {
  stop: ReturnType<typeof vi.fn>
  getSettings: () => MediaTrackSettings
}

interface MockStream {
  getTracks: () => MockTrack[]
  getVideoTracks: () => MockTrack[]
}

function makeMockStream(): { stream: MockStream; tracks: MockTrack[] } {
  const tracks: MockTrack[] = [
    {
      stop: vi.fn(),
      getSettings: () => ({ deviceId: 'cam-1' } as MediaTrackSettings),
    },
  ]
  const stream: MockStream = {
    getTracks: () => tracks,
    getVideoTracks: () => tracks,
  }
  return { stream, tracks }
}

describe('CameraScanner 摄像头扫码组件', () => {
  let originalMediaDevices: MediaDevices | undefined
  let getUserMediaMock: ReturnType<typeof vi.fn>
  let enumerateDevicesMock: ReturnType<typeof vi.fn>
  let mockTracks: MockTrack[]

  beforeEach(() => {
    // 保存原值
    originalMediaDevices = (navigator as Navigator & { mediaDevices?: MediaDevices })
      .mediaDevices

    const built = makeMockStream()
    mockTracks = built.tracks
    getUserMediaMock = vi.fn().mockResolvedValue(built.stream as unknown as MediaStream)
    enumerateDevicesMock = vi.fn().mockResolvedValue([
      { kind: 'videoinput', deviceId: 'cam-1', label: '后置摄像头' },
    ])

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      writable: true,
      value: {
        getUserMedia: getUserMediaMock,
        enumerateDevices: enumerateDevicesMock,
      } as unknown as MediaDevices,
    })

    // jsdom 不实现 video.play —— mock 掉
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      writable: true,
      value: vi.fn().mockResolvedValue(undefined),
    })
  })

  afterEach(() => {
    if (originalMediaDevices === undefined) {
      // 用 Reflect.deleteProperty 清理；如果删除失败则忽略
      try {
        Reflect.deleteProperty(navigator, 'mediaDevices')
      } catch {
        // ignore
      }
    } else {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        writable: true,
        value: originalMediaDevices,
      })
    }
    vi.restoreAllMocks()
  })

  it('默认折叠：只显示展开按钮，不渲染启动按钮', () => {
    render(<CameraScanner />)
    expect(screen.getByTestId('camera-scanner-toggle')).toBeInTheDocument()
    expect(screen.queryByTestId('camera-scanner-start')).not.toBeInTheDocument()
  })

  it('展开后未启动时显示"启动摄像头"按钮，且不显示停止按钮', () => {
    render(<CameraScanner />)
    fireEvent.click(screen.getByTestId('camera-scanner-toggle'))
    expect(screen.getByTestId('camera-scanner-start')).toHaveTextContent('启动摄像头')
    expect(screen.queryByTestId('camera-scanner-stop')).not.toBeInTheDocument()
    // 未启动时显示占位文案
    expect(screen.getByText('摄像头未启动')).toBeInTheDocument()
  })

  it('点击启动 → 调用 getUserMedia，video 元素显示', async () => {
    render(<CameraScanner defaultOpen />)

    const startBtn = screen.getByTestId('camera-scanner-start')
    await act(async () => {
      fireEvent.click(startBtn)
    })

    await waitFor(() => {
      expect(getUserMediaMock).toHaveBeenCalledTimes(1)
    })
    // 启动后停止按钮出现
    await waitFor(() => {
      expect(screen.getByTestId('camera-scanner-stop')).toBeInTheDocument()
    })
    // video 显示（display: block）
    const video = screen.getByTestId('camera-scanner-video') as HTMLVideoElement
    expect(video.style.display).toBe('block')
  })

  it('卸载组件时调用 stream.getTracks().stop() 释放摄像头', async () => {
    const { unmount } = render(<CameraScanner defaultOpen />)
    await act(async () => {
      fireEvent.click(screen.getByTestId('camera-scanner-start'))
    })
    await waitFor(() => {
      expect(getUserMediaMock).toHaveBeenCalled()
    })

    // 卸载，验证 stop 被调用
    unmount()
    expect(mockTracks[0].stop).toHaveBeenCalled()
  })

  it('点击"停止扫描"按钮时立即释放摄像头', async () => {
    render(<CameraScanner defaultOpen />)
    await act(async () => {
      fireEvent.click(screen.getByTestId('camera-scanner-start'))
    })
    await waitFor(() => {
      expect(screen.getByTestId('camera-scanner-stop')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('camera-scanner-stop'))
    expect(mockTracks[0].stop).toHaveBeenCalled()
    // 停止后回到"启动摄像头"按钮
    expect(screen.getByTestId('camera-scanner-start')).toBeInTheDocument()
  })

  it('当浏览器不支持 getUserMedia 时显示友好提示', () => {
    // 移除 mediaDevices
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      writable: true,
      value: undefined,
    })

    render(<CameraScanner defaultOpen />)
    expect(
      screen.getByText(/不支持摄像头扫码/),
    ).toBeInTheDocument()
    // 启动按钮 disabled
    const startBtn = screen.getByTestId('camera-scanner-start') as HTMLButtonElement
    expect(startBtn.disabled).toBe(true)
  })
})
