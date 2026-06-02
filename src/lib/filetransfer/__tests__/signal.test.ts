import { describe, it, expect } from 'vitest'
import { encodeSignal, decodeSignal } from '../signal'
import type { SignalPayload } from '../types'

const sample: SignalPayload = {
  v: 1,
  role: 'sender',
  type: 'offer',
  sdp: 'v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\ns=-\r\na=candidate:1 1 udp 2113 192.168.1.5 50000 typ host\r\n',
}

describe('encodeSignal / decodeSignal', () => {
  it('编码后是非空字符串且不含换行（便于复制/二维码）', () => {
    const code = encodeSignal(sample)
    expect(typeof code).toBe('string')
    expect(code.length).toBeGreaterThan(0)
    expect(code).not.toMatch(/[\r\n]/)
  })

  it('往返一致：decode(encode(x)) === x', () => {
    const code = encodeSignal(sample)
    const back = decodeSignal(code)
    expect(back).toEqual(sample)
  })

  it('支持含中文/特殊字符的 SDP（UTF-8 安全）', () => {
    const withUtf8: SignalPayload = { ...sample, sdp: sample.sdp + 'a=note:测试😀\r\n' }
    expect(decodeSignal(encodeSignal(withUtf8))).toEqual(withUtf8)
  })

  it('非法连接码抛出可识别错误', () => {
    expect(() => decodeSignal('not-a-valid-code!!!')).toThrow()
  })

  it('解码结构不完整时抛错', () => {
    const bad = encodeSignal({ ...sample })
    const tampered = bad.slice(0, Math.max(1, bad.length - 4))
    expect(() => decodeSignal(tampered)).toThrow()
  })
})