import { describe, it, expect } from 'vitest'
import { csvToJson, jsonToCsv, inferCellTypes } from '../transform'

describe('csvToJson', () => {
  it('基础逗号分隔 + 表头', async () => {
    const text = 'name,age\nAlice,18\nBob,22'
    const res = await csvToJson(text)
    expect(res.data).toEqual([
      { name: 'Alice', age: '18' },
      { name: 'Bob', age: '22' },
    ])
    expect(res.meta.delimiter).toBe(',')
    expect(res.meta.fields).toEqual(['name', 'age'])
  })

  it('自动识别分号分隔（欧洲常见）', async () => {
    const text = 'a;b;c\n1;2;3\n4;5;6'
    const res = await csvToJson(text)
    expect(res.meta.delimiter).toBe(';')
    expect(res.data).toHaveLength(2)
    expect(res.data[0]).toEqual({ a: '1', b: '2', c: '3' })
  })

  it('自动识别制表符分隔（TSV）', async () => {
    const text = 'a\tb\n1\t2\n3\t4'
    const res = await csvToJson(text)
    expect(res.meta.delimiter).toBe('\t')
    expect(res.data[1]).toEqual({ a: '3', b: '4' })
  })

  it('camelCase 选项把表头转驼峰', async () => {
    const text = 'first name,last_name,User-ID\nA,B,1'
    const res = await csvToJson(text, { camelCase: true })
    expect(res.meta.fields).toEqual(['firstName', 'lastName', 'userID'])
    expect(res.data[0]).toEqual({ firstName: 'A', lastName: 'B', userID: '1' })
  })

  it('header=false 时按列名 col1/col2 输出', async () => {
    const text = '1,2,3\n4,5,6'
    const res = await csvToJson(text, { header: false })
    expect(res.meta.fields).toEqual(['col1', 'col2', 'col3'])
    expect(res.data[0]).toEqual({ col1: '1', col2: '2', col3: '3' })
  })

  it('空值与含逗号引号字段保留', async () => {
    const text = 'a,b,c\n,"hello, world","line\nbreak"'
    const res = await csvToJson(text)
    expect(res.data[0]).toEqual({ a: '', b: 'hello, world', c: 'line\nbreak' })
  })

  it('skipEmptyLines 默认跳过纯空行', async () => {
    const text = 'a,b\n1,2\n\n3,4\n'
    const res = await csvToJson(text)
    expect(res.data).toHaveLength(2)
  })

  it('dynamicTyping 开启时数字转 number、布尔转 boolean', async () => {
    const text = 'a,b,c\n1,true,foo'
    const res = await csvToJson(text, { dynamicTyping: true })
    expect(res.data[0]).toEqual({ a: 1, b: true, c: 'foo' })
  })
})

describe('jsonToCsv', () => {
  it('对象数组直接序列化', async () => {
    const csv = await jsonToCsv([
      { name: 'A', age: 1 },
      { name: 'B', age: 2 },
    ])
    expect(csv).toBe('name,age\nA,1\nB,2')
  })

  it('嵌套对象按点路径展平为列', async () => {
    const csv = await jsonToCsv([{ id: 1, user: { name: 'Foo' } }])
    expect(csv).toBe('id,user.name\n1,Foo')
  })

  it('显式 delimiter 生效', async () => {
    const csv = await jsonToCsv([{ a: 1, b: 2 }], { delimiter: ';' })
    expect(csv).toBe('a;b\n1;2')
  })

  it('header=false 时不输出表头', async () => {
    const csv = await jsonToCsv([{ a: 1, b: 2 }], { header: false })
    expect(csv).toBe('1,2')
  })

  it('包含换行/逗号/双引号的字段被自动加引号转义', async () => {
    const csv = await jsonToCsv([{ a: 'hello, world', b: 'line\nbreak', c: 'has "q"' }])
    // papaparse 输出格式：含特殊字符的字段加双引号包裹，内部双引号转双双引号
    // 表头行后紧跟数据行，整体连缀（含真实 \n）；用 contain 断言更稳，避免被 split('\n') 误切
    expect(csv).toContain('"hello, world"')
    expect(csv).toContain('"line\nbreak"')
    expect(csv).toContain('"has ""q"""')
    expect(csv.startsWith('a,b,c\n')).toBe(true)
  })

  it('原始值数组（如 ["a","b","c"]）落到 value 列', async () => {
    const csv = await jsonToCsv(['x', 'y'])
    expect(csv).toBe('value\nx\ny')
  })

  it('键集合不一致的对象数组取并集列', async () => {
    const csv = await jsonToCsv([
      { a: 1 },
      { b: 2 },
      { a: 3, b: 4 },
    ])
    expect(csv).toBe('a,b\n1,\n,2\n3,4')
  })

  it('非数组输入直接抛错', async () => {
    await expect(jsonToCsv('not array' as unknown as unknown[])).rejects.toThrow(/必须是数组/)
  })
})

describe('inferCellTypes', () => {
  it('字符串数字转 number，true/false 转 boolean', () => {
    const out = inferCellTypes([{ a: '1', b: 'true', c: 'foo', d: '' }])
    expect(out[0]).toEqual({ a: 1, b: true, c: 'foo', d: '' })
  })

  it('保留 "01" 这种前导零字符串', () => {
    const out = inferCellTypes([{ id: '01' }])
    expect(out[0]).toEqual({ id: '01' })
  })
})
