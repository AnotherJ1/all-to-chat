import { describe, it, expect } from 'vitest'
import { parseCurl, tokenizeShell } from '../parser'

describe('tokenizeShell', () => {
  it('处理普通空白分隔', () => {
    expect(tokenizeShell('curl -X POST https://example.com')).toEqual([
      'curl', '-X', 'POST', 'https://example.com',
    ])
  })

  it('单引号内保留所有字符', () => {
    expect(tokenizeShell(`curl -H 'Content-Type: application/json'`)).toEqual([
      'curl', '-H', 'Content-Type: application/json',
    ])
  })

  it('双引号内反斜杠仅转义特殊字符', () => {
    expect(tokenizeShell(`curl "a\\"b" "c\\\\d"`)).toEqual([
      'curl', 'a"b', 'c\\d',
    ])
  })

  it('反斜杠续行视为同一行', () => {
    expect(tokenizeShell(`curl -X POST \\\n https://x.com`)).toEqual([
      'curl', '-X', 'POST', 'https://x.com',
    ])
  })
})

describe('parseCurl', () => {
  it('1. 解析最简 GET', () => {
    const cmd = parseCurl(`curl https://api.example.com/users`)
    expect(cmd.method).toBe('GET')
    expect(cmd.url).toBe('https://api.example.com/users')
    expect(cmd.headers).toEqual({})
    expect(cmd.body.type).toBe('none')
  })

  it('2. URL 中的 query 自动分离', () => {
    const cmd = parseCurl(`curl 'https://api.example.com/search?q=hello&page=2'`)
    expect(cmd.url).toBe('https://api.example.com/search')
    expect(cmd.query).toEqual({ q: 'hello', page: '2' })
  })

  it('3. POST + JSON body 自动识别', () => {
    const cmd = parseCurl(
      `curl -X POST https://api.example.com/login -H 'Content-Type: application/json' -d '{"user":"alice","pwd":"123"}'`
    )
    expect(cmd.method).toBe('POST')
    expect(cmd.body.type).toBe('json')
    expect(cmd.body.content).toBe('{"user":"alice","pwd":"123"}')
    expect(cmd.headers['Content-Type']).toBe('application/json')
  })

  it('4. 多个 -H 全部收集', () => {
    const cmd = parseCurl(
      `curl https://api.example.com -H 'Accept: */*' -H 'X-Token: abc'`
    )
    expect(cmd.headers).toEqual({
      'Accept': '*/*',
      'X-Token': 'abc',
    })
  })

  it('5. 多行反斜杠续行', () => {
    const raw = `curl -X POST https://api.example.com/api \\\n  -H 'Content-Type: application/json' \\\n  -d '{"a":1}'`
    const cmd = parseCurl(raw)
    expect(cmd.method).toBe('POST')
    expect(cmd.url).toBe('https://api.example.com/api')
    expect(cmd.body.type).toBe('json')
    expect(cmd.body.content).toBe('{"a":1}')
  })

  it('6. Cookie + Basic Auth', () => {
    const cmd = parseCurl(
      `curl https://api.example.com -u admin:secret -b 'sid=abc; theme=dark'`
    )
    expect(cmd.auth).toEqual({ type: 'basic', user: 'admin', password: 'secret' })
    expect(cmd.cookies).toEqual({ sid: 'abc', theme: 'dark' })
  })

  it('7. -F 表单字段聚合为 form 类型', () => {
    const cmd = parseCurl(
      `curl -X POST https://api.example.com/upload -F 'name=foo' -F 'role=admin'`
    )
    expect(cmd.body.type).toBe('form')
    expect(cmd.body.content).toBe('name=foo&role=admin')
  })

  it('8. -d 默认按 urlencoded 处理', () => {
    const cmd = parseCurl(
      `curl -X POST https://api.example.com/form -d 'a=1&b=2'`
    )
    expect(cmd.body.type).toBe('urlencoded')
    expect(cmd.body.content).toBe('a=1&b=2')
  })

  it('9. -XPOST 紧贴形式', () => {
    const cmd = parseCurl(`curl -XPOST https://x.com -d 'k=v'`)
    expect(cmd.method).toBe('POST')
  })

  it('10. Cookie header 自动并入 cookies', () => {
    const cmd = parseCurl(
      `curl https://api.example.com -H 'Cookie: a=1; b=2'`
    )
    expect(cmd.cookies).toEqual({ a: '1', b: '2' })
    // 不应保留在 headers 中重复
    expect(cmd.headers['Cookie']).toBeUndefined()
  })

  it('11. 空命令抛错', () => {
    expect(() => parseCurl('')).toThrow()
  })

  it('12. 缺 URL 抛错', () => {
    expect(() => parseCurl(`curl -X POST -H 'X: 1'`)).toThrow()
  })

  it('13. --data-raw 保持原样不强制 JSON 化', () => {
    const cmd = parseCurl(
      `curl -X POST https://api.example.com --data-raw 'rawbinary'`
    )
    expect(cmd.body.type).toBe('raw')
    expect(cmd.body.content).toBe('rawbinary')
  })
})
