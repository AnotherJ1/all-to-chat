import { describe, it, expect } from 'vitest'
import { parseCurl } from '../parser'
import { generateCode, generateCurlString } from '../generators'

const SAMPLE_GET = parseCurl(`curl 'https://api.example.com/users?page=1' -H 'Accept: application/json'`)
const SAMPLE_POST_JSON = parseCurl(
  `curl -X POST https://api.example.com/login -H 'Content-Type: application/json' -d '{"user":"alice","pwd":"123"}'`
)
const SAMPLE_AUTH = parseCurl(
  `curl https://api.example.com/me -u admin:s3cret -H 'Accept: application/json'`
)

describe('generateCode - fetch', () => {
  it('GET snapshot', () => {
    expect(generateCode(SAMPLE_GET, 'fetch')).toMatchSnapshot()
  })
  it('POST JSON snapshot', () => {
    expect(generateCode(SAMPLE_POST_JSON, 'fetch')).toMatchSnapshot()
  })
  it('GET with Basic auth includes btoa', () => {
    const code = generateCode(SAMPLE_AUTH, 'fetch')
    expect(code).toContain('btoa')
    expect(code).toContain('admin:s3cret')
  })
})

describe('generateCode - axios', () => {
  it('POST JSON snapshot', () => {
    expect(generateCode(SAMPLE_POST_JSON, 'axios')).toMatchSnapshot()
  })
})

describe('generateCode - node-http', () => {
  it('GET snapshot', () => {
    expect(generateCode(SAMPLE_GET, 'node-http')).toMatchSnapshot()
  })
  it('uses https for https URL', () => {
    const code = generateCode(SAMPLE_GET, 'node-http')
    expect(code).toContain("import https from 'https'")
  })
})

describe('generateCode - python-requests', () => {
  it('POST JSON snapshot', () => {
    expect(generateCode(SAMPLE_POST_JSON, 'python-requests')).toMatchSnapshot()
  })
  it('Basic auth uses tuple', () => {
    const code = generateCode(SAMPLE_AUTH, 'python-requests')
    expect(code).toContain("auth=('admin', 's3cret')")
  })
})

describe('generateCode - go-net-http', () => {
  it('POST JSON snapshot', () => {
    expect(generateCode(SAMPLE_POST_JSON, 'go-net-http')).toMatchSnapshot()
  })
})

describe('generateCode - php-curl', () => {
  it('POST JSON snapshot', () => {
    expect(generateCode(SAMPLE_POST_JSON, 'php-curl')).toMatchSnapshot()
  })
})

describe('generateCode - java-okhttp', () => {
  it('POST JSON snapshot', () => {
    expect(generateCode(SAMPLE_POST_JSON, 'java-okhttp')).toMatchSnapshot()
  })
})

describe('generateCurlString', () => {
  it('round-trip 简单 GET', () => {
    const s = generateCurlString(SAMPLE_GET)
    expect(s).toContain('curl')
    expect(s).toContain('https://api.example.com/users?page=1')
  })

  it('round-trip POST JSON 包含 Content-Type 与 body', () => {
    const s = generateCurlString(SAMPLE_POST_JSON)
    expect(s).toContain("-H 'Content-Type: application/json'")
    expect(s).toContain('"user":"alice"')
  })
})
