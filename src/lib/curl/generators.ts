/**
 * cURL → 多语言代码生成器
 * 支持目标：fetch / axios / node-http / python-requests / go-net-http / php-curl / java-okhttp
 */

import type { CurlCommand } from './parser'

/** 目标语言/库 */
export type CurlTarget =
  | 'fetch'
  | 'axios'
  | 'node-http'
  | 'python-requests'
  | 'go-net-http'
  | 'php-curl'
  | 'java-okhttp'

/** 语言下拉显示名 */
export const TARGET_LABELS: Record<CurlTarget, string> = {
  'fetch': 'JavaScript - fetch',
  'axios': 'JavaScript - axios',
  'node-http': 'Node.js - http',
  'python-requests': 'Python - requests',
  'go-net-http': 'Go - net/http',
  'php-curl': 'PHP - curl',
  'java-okhttp': 'Java - OkHttp',
}

/** 转 JS 字符串字面量（单引号） */
function jsStr(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`
}

/** 转 Python 字符串字面量（单引号） */
function pyStr(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`
}

/** 转 Go 字符串（双引号） */
function goStr(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')}"`
}

/** 转 PHP 字符串字面量（单引号） */
function phpStr(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

/** 转 Java 字符串（双引号） */
function javaStr(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')}"`
}

/** 把 query 字典拼回 URL */
function buildUrlWithQuery(cmd: CurlCommand): string {
  const keys = Object.keys(cmd.query)
  if (keys.length === 0) return cmd.url
  const qs = keys
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(cmd.query[k])}`)
    .join('&')
  return `${cmd.url}?${qs}`
}

/** 把 cookies 字典拼为 Cookie 头字符串 */
function cookieHeader(cmd: CurlCommand): string {
  return Object.entries(cmd.cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
}

/** 合并 headers + auth + cookie，返回最终 header 表 */
function finalHeaders(cmd: CurlCommand): Record<string, string> {
  const out: Record<string, string> = { ...cmd.headers }
  if (cmd.auth) {
    // base64 仅在浏览器/Node 调用方处理；这里输出占位由生成器自身渲染
    // 各语言生成器各自处理 auth，本函数仅包含显式 headers
  }
  const ck = cookieHeader(cmd)
  if (ck && !out['Cookie'] && !out['cookie']) out['Cookie'] = ck
  return out
}

// ============ fetch ============
function genFetch(cmd: CurlCommand): string {
  const url = buildUrlWithQuery(cmd)
  const headers = finalHeaders(cmd)
  const headerLines = Object.entries(headers).map(([k, v]) => `    ${jsStr(k)}: ${jsStr(v)},`)
  if (cmd.auth) {
    // 浏览器使用 btoa 编码 Basic
    headerLines.push(`    'Authorization': 'Basic ' + btoa(${jsStr(`${cmd.auth.user}:${cmd.auth.password}`)}),`)
  }

  const opts: string[] = [`  method: ${jsStr(cmd.method)},`]
  if (headerLines.length > 0) {
    opts.push(`  headers: {\n${headerLines.join('\n')}\n  },`)
  }
  if (cmd.body.type === 'json') {
    opts.push(`  body: JSON.stringify(${cmd.body.content || '{}'}),`)
  } else if (cmd.body.type === 'urlencoded' || cmd.body.type === 'form') {
    opts.push(`  body: ${jsStr(cmd.body.content)},`)
  } else if (cmd.body.type === 'raw') {
    opts.push(`  body: ${jsStr(cmd.body.content)},`)
  }

  return `// fetch 请求
const response = await fetch(${jsStr(url)}, {
${opts.join('\n')}
})
const data = await response.json()
console.log(data)
`
}

// ============ axios ============
function genAxios(cmd: CurlCommand): string {
  const url = buildUrlWithQuery(cmd)
  const headers = finalHeaders(cmd)
  const headerLines = Object.entries(headers).map(([k, v]) => `    ${jsStr(k)}: ${jsStr(v)},`)
  if (cmd.auth) {
    headerLines.push(`    'Authorization': 'Basic ' + btoa(${jsStr(`${cmd.auth.user}:${cmd.auth.password}`)}),`)
  }

  const opts: string[] = [
    `  method: ${jsStr(cmd.method.toLowerCase())},`,
    `  url: ${jsStr(url)},`,
  ]
  if (headerLines.length > 0) {
    opts.push(`  headers: {\n${headerLines.join('\n')}\n  },`)
  }
  if (cmd.body.type === 'json') {
    opts.push(`  data: ${cmd.body.content || '{}'},`)
  } else if (cmd.body.type !== 'none') {
    opts.push(`  data: ${jsStr(cmd.body.content)},`)
  }

  return `// axios 请求
import axios from 'axios'

const response = await axios({
${opts.join('\n')}
})
console.log(response.data)
`
}

// ============ Node http ============
function genNodeHttp(cmd: CurlCommand): string {
  const url = buildUrlWithQuery(cmd)
  const headers = finalHeaders(cmd)
  const headerLines = Object.entries(headers).map(([k, v]) => `    ${jsStr(k)}: ${jsStr(v)},`)
  if (cmd.auth) {
    headerLines.push(
      `    'Authorization': 'Basic ' + Buffer.from(${jsStr(`${cmd.auth.user}:${cmd.auth.password}`)}).toString('base64'),`
    )
  }
  const isHttps = /^https:\/\//i.test(url)
  const lib = isHttps ? 'https' : 'http'

  let bodyLine = ''
  if (cmd.body.type === 'json') {
    bodyLine = `req.write(JSON.stringify(${cmd.body.content || '{}'}))`
  } else if (cmd.body.type !== 'none') {
    bodyLine = `req.write(${jsStr(cmd.body.content)})`
  }

  return `// Node ${lib} 请求
import ${lib} from '${lib}'
import { URL } from 'url'

const target = new URL(${jsStr(url)})
const options = {
  hostname: target.hostname,
  port: target.port || (target.protocol === 'https:' ? 443 : 80),
  path: target.pathname + target.search,
  method: ${jsStr(cmd.method)},
  headers: {
${headerLines.join('\n')}
  },
}

const req = ${lib}.request(options, (res) => {
  let data = ''
  res.on('data', (chunk) => { data += chunk })
  res.on('end', () => { console.log(data) })
})
req.on('error', (err) => { console.error(err) })
${bodyLine ? bodyLine + '\n' : ''}req.end()
`
}

// ============ Python requests ============
function genPythonRequests(cmd: CurlCommand): string {
  const url = buildUrlWithQuery(cmd)
  const headers = finalHeaders(cmd)
  const headerLines = Object.entries(headers).map(([k, v]) => `    ${pyStr(k)}: ${pyStr(v)},`)

  const kw: string[] = [`headers={\n${headerLines.join('\n')}\n}`]
  if (cmd.auth) {
    kw.push(`auth=(${pyStr(cmd.auth.user)}, ${pyStr(cmd.auth.password)})`)
  }
  if (cmd.body.type === 'json') {
    kw.push(`json=${cmd.body.content || '{}'}`)
  } else if (cmd.body.type === 'urlencoded' || cmd.body.type === 'form') {
    kw.push(`data=${pyStr(cmd.body.content)}`)
  } else if (cmd.body.type === 'raw') {
    kw.push(`data=${pyStr(cmd.body.content)}`)
  }

  return `# Python requests 请求
import requests

response = requests.${cmd.method.toLowerCase()}(
    ${pyStr(url)},
    ${kw.join(',\n    ')},
)
print(response.text)
`
}

// ============ Go net/http ============
function genGoNetHttp(cmd: CurlCommand): string {
  const url = buildUrlWithQuery(cmd)
  const headers = finalHeaders(cmd)
  const lines: string[] = []
  lines.push('// Go net/http 请求')
  lines.push('package main')
  lines.push('')
  lines.push('import (')
  lines.push('\t"fmt"')
  lines.push('\t"io"')
  lines.push('\t"net/http"')
  if (cmd.body.type !== 'none') lines.push('\t"strings"')
  lines.push(')')
  lines.push('')
  lines.push('func main() {')
  if (cmd.body.type !== 'none') {
    lines.push(`\tbody := strings.NewReader(${goStr(cmd.body.content)})`)
    lines.push(`\treq, err := http.NewRequest(${goStr(cmd.method)}, ${goStr(url)}, body)`)
  } else {
    lines.push(`\treq, err := http.NewRequest(${goStr(cmd.method)}, ${goStr(url)}, nil)`)
  }
  lines.push('\tif err != nil { panic(err) }')
  for (const [k, v] of Object.entries(headers)) {
    lines.push(`\treq.Header.Set(${goStr(k)}, ${goStr(v)})`)
  }
  if (cmd.auth) {
    lines.push(`\treq.SetBasicAuth(${goStr(cmd.auth.user)}, ${goStr(cmd.auth.password)})`)
  }
  lines.push('\tresp, err := http.DefaultClient.Do(req)')
  lines.push('\tif err != nil { panic(err) }')
  lines.push('\tdefer resp.Body.Close()')
  lines.push('\tdata, _ := io.ReadAll(resp.Body)')
  lines.push('\tfmt.Println(string(data))')
  lines.push('}')
  return lines.join('\n') + '\n'
}

// ============ PHP curl ============
function genPhpCurl(cmd: CurlCommand): string {
  const url = buildUrlWithQuery(cmd)
  const headers = finalHeaders(cmd)
  const lines: string[] = []
  lines.push('<?php')
  lines.push('// PHP curl 请求')
  lines.push('$ch = curl_init();')
  lines.push(`curl_setopt($ch, CURLOPT_URL, ${phpStr(url)});`)
  lines.push('curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);')
  lines.push(`curl_setopt($ch, CURLOPT_CUSTOMREQUEST, ${phpStr(cmd.method)});`)
  const headerArr = Object.entries(headers).map(([k, v]) => `    ${phpStr(`${k}: ${v}`)}`)
  if (headerArr.length > 0) {
    lines.push('curl_setopt($ch, CURLOPT_HTTPHEADER, [')
    lines.push(headerArr.join(',\n') + ',')
    lines.push(']);')
  }
  if (cmd.auth) {
    lines.push(`curl_setopt($ch, CURLOPT_USERPWD, ${phpStr(`${cmd.auth.user}:${cmd.auth.password}`)});`)
  }
  if (cmd.body.type !== 'none') {
    lines.push(`curl_setopt($ch, CURLOPT_POSTFIELDS, ${phpStr(cmd.body.content)});`)
  }
  lines.push('$response = curl_exec($ch);')
  lines.push('curl_close($ch);')
  lines.push('echo $response;')
  return lines.join('\n') + '\n'
}

// ============ Java OkHttp ============
function genJavaOkHttp(cmd: CurlCommand): string {
  const url = buildUrlWithQuery(cmd)
  const headers = finalHeaders(cmd)
  const lines: string[] = []
  lines.push('// Java OkHttp 请求')
  lines.push('import okhttp3.*;')
  lines.push('')
  lines.push('OkHttpClient client = new OkHttpClient();')
  if (cmd.body.type === 'json') {
    lines.push('MediaType JSON = MediaType.parse("application/json; charset=utf-8");')
    lines.push(`RequestBody body = RequestBody.create(${javaStr(cmd.body.content)}, JSON);`)
  } else if (cmd.body.type !== 'none') {
    lines.push('MediaType TEXT = MediaType.parse("text/plain; charset=utf-8");')
    lines.push(`RequestBody body = RequestBody.create(${javaStr(cmd.body.content)}, TEXT);`)
  }
  lines.push('Request.Builder builder = new Request.Builder()')
  lines.push(`    .url(${javaStr(url)})`)
  const m = cmd.method.toUpperCase()
  if (cmd.body.type === 'none') {
    if (m === 'GET') lines.push('    .get()')
    else if (m === 'DELETE') lines.push('    .delete()')
    else if (m === 'HEAD') lines.push('    .head()')
    else lines.push(`    .method(${javaStr(m)}, null)`)
  } else {
    if (m === 'POST') lines.push('    .post(body)')
    else if (m === 'PUT') lines.push('    .put(body)')
    else if (m === 'PATCH') lines.push('    .patch(body)')
    else if (m === 'DELETE') lines.push('    .delete(body)')
    else lines.push(`    .method(${javaStr(m)}, body)`)
  }
  lines.push('    ;')
  for (const [k, v] of Object.entries(headers)) {
    lines.push(`builder.addHeader(${javaStr(k)}, ${javaStr(v)});`)
  }
  if (cmd.auth) {
    lines.push(`builder.addHeader("Authorization", Credentials.basic(${javaStr(cmd.auth.user)}, ${javaStr(cmd.auth.password)}));`)
  }
  lines.push('Request request = builder.build();')
  lines.push('try (Response response = client.newCall(request).execute()) {')
  lines.push('    System.out.println(response.body().string());')
  lines.push('}')
  return lines.join('\n') + '\n'
}

/** 生成器分发 */
export function generateCode(cmd: CurlCommand, target: CurlTarget): string {
  switch (target) {
    case 'fetch': return genFetch(cmd)
    case 'axios': return genAxios(cmd)
    case 'node-http': return genNodeHttp(cmd)
    case 'python-requests': return genPythonRequests(cmd)
    case 'go-net-http': return genGoNetHttp(cmd)
    case 'php-curl': return genPhpCurl(cmd)
    case 'java-okhttp': return genJavaOkHttp(cmd)
    default: throw new Error(`未知目标: ${target as string}`)
  }
}

/** 把结构化 cURL 反向生成为 curl 命令字符串（供 builder 使用） */
export function generateCurlString(cmd: CurlCommand): string {
  const url = buildUrlWithQuery(cmd)
  const parts: string[] = ['curl']
  // 方法（仅在非默认时输出）
  const m = cmd.method.toUpperCase()
  const hasBody = cmd.body.type !== 'none'
  if ((hasBody && m !== 'POST') || (!hasBody && m !== 'GET')) {
    parts.push(`-X ${m}`)
  }
  // headers
  for (const [k, v] of Object.entries(cmd.headers)) {
    parts.push(`-H ${shellQuote(`${k}: ${v}`)}`)
  }
  // cookies
  const ck = cookieHeader(cmd)
  if (ck && !cmd.headers['Cookie'] && !cmd.headers['cookie']) {
    parts.push(`-b ${shellQuote(ck)}`)
  }
  // auth
  if (cmd.auth) {
    parts.push(`-u ${shellQuote(`${cmd.auth.user}:${cmd.auth.password}`)}`)
  }
  // body
  if (cmd.body.type === 'json') {
    parts.push(`--data-raw ${shellQuote(cmd.body.content)}`)
  } else if (cmd.body.type === 'urlencoded') {
    parts.push(`-d ${shellQuote(cmd.body.content)}`)
  } else if (cmd.body.type === 'form') {
    // 表单按 -F 分项输出（拆 a=b&c=d）
    for (const seg of cmd.body.content.split('&')) {
      if (seg) parts.push(`-F ${shellQuote(seg)}`)
    }
  } else if (cmd.body.type === 'raw') {
    parts.push(`--data-raw ${shellQuote(cmd.body.content)}`)
  }
  parts.push(shellQuote(url))
  return parts.join(' ')
}

/** 简易 shell 引号包裹：含特殊字符则单引号转义 */
function shellQuote(s: string): string {
  if (s === '') return "''"
  if (/^[A-Za-z0-9_./:?=&%-]+$/.test(s)) return s
  return `'${s.replace(/'/g, `'\\''`)}'`
}
