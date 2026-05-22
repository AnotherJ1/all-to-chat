/**
 * env / properties 解析与序列化测试
 */

import { describe, it, expect } from 'vitest'
import { parseEnv, parseProperties } from '../parsers'
import { serializeEnv, serializeProperties } from '../serializers'

describe('parseEnv', () => {
  it('1. 基础 KEY=VALUE 与注释跳过', () => {
    const r = parseEnv(`# 注释\nFOO=bar\nBAZ=qux\n`)
    expect(r.ok).toBe(true)
    expect(r.ir).toEqual({ FOO: 'bar', BAZ: 'qux' })
  })

  it('2. 双引号转义 \\n \\t \\"', () => {
    const r = parseEnv(`MSG="line1\\nline2\\t\\"quoted\\""`)
    expect(r.ok).toBe(true)
    expect((r.ir as Record<string, string>).MSG).toBe('line1\nline2\t"quoted"')
  })

  it('3. 单引号字面量 + export 前缀', () => {
    const r = parseEnv(`export NAME='alice bob'\n`)
    expect(r.ok).toBe(true)
    expect((r.ir as Record<string, string>).NAME).toBe('alice bob')
  })

  it('4. 行尾 # 注释（无引号）', () => {
    const r = parseEnv(`PORT=8080 # default\nHOST=localhost`)
    expect(r.ok).toBe(true)
    expect(r.ir).toEqual({ PORT: '8080', HOST: 'localhost' })
  })
})

describe('serializeEnv', () => {
  it('5. 扁平对象正常输出', () => {
    const r = serializeEnv({ FOO: 'bar', PORT: '8080' })
    expect(r.ok).toBe(true)
    expect(r.output).toBe('FOO=bar\nPORT=8080\n')
    expect(r.warnings).toBeUndefined()
  })

  it('6. 嵌套对象按 . 路径展平 + warning', () => {
    const r = serializeEnv({ DB: { HOST: 'localhost', PORT: '5432' } })
    expect(r.ok).toBe(true)
    expect(r.warnings && r.warnings.length).toBeGreaterThan(0)
    // env 的 . 会被替换成 _，避免非法 KEY
    expect(r.output).toContain('DB_HOST=localhost')
    expect(r.output).toContain('DB_PORT=5432')
  })

  it('7. 含空格 / # 的值自动加引号转义', () => {
    const r = serializeEnv({ MSG: 'hello world #x' })
    expect(r.ok).toBe(true)
    expect(r.output).toBe('MSG="hello world #x"\n')
  })
})

describe('parseProperties', () => {
  it('8. 基础 = 与 : 分隔', () => {
    const r = parseProperties(`a=1\nb : 2\nc 3\n`)
    expect(r.ok).toBe(true)
    expect(r.ir).toEqual({ a: '1', b: '2', c: '3' })
  })

  it('9. 续行 \\ 合并下一行', () => {
    const r = parseProperties(`msg=hello \\\nworld`)
    expect(r.ok).toBe(true)
    expect((r.ir as Record<string, string>).msg).toBe('hello world')
  })

  it('10. # 与 ! 注释忽略', () => {
    const r = parseProperties(`# 注释1\n!注释2\nfoo=bar`)
    expect(r.ok).toBe(true)
    expect(r.ir).toEqual({ foo: 'bar' })
  })
})

describe('serializeProperties', () => {
  it('11. 嵌套对象保留 . 路径并发出 warning', () => {
    const r = serializeProperties({ db: { host: 'localhost', port: 5432 } })
    expect(r.ok).toBe(true)
    expect(r.warnings && r.warnings.length).toBeGreaterThan(0)
    expect(r.output).toContain('db.host=localhost')
    expect(r.output).toContain('db.port=5432')
  })

  it('12. 空格 / 转义字符', () => {
    const r = serializeProperties({ 'app.name': 'my app', path: 'a\nb' })
    expect(r.ok).toBe(true)
    expect(r.output).toContain('app.name=my app')
    expect(r.output).toContain('path=a\\nb')
  })
})
