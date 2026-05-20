import { describe, it, expect } from 'vitest'
import { parseMybatisLog } from './mybatis-parser'

describe('parseMybatisLog', () => {
  it('解析基本的 Preparing + Parameters 日志', () => {
    const input = `==>  Preparing: SELECT * FROM user WHERE id = ? AND name = ?
==> Parameters: 1(Integer), John(String)`

    const results = parseMybatisLog(input)

    expect(results).toHaveLength(1)
    expect(results[0].sql).toBe("SELECT * FROM user WHERE id = 1 AND name = 'John'")
    expect(results[0].params).toEqual(['1(Integer)', 'John(String)'])
  })

  it('String 类型参数加单引号', () => {
    const input = `==>  Preparing: SELECT * FROM user WHERE name = ?
==> Parameters: Alice(String)`

    const results = parseMybatisLog(input)
    expect(results[0].sql).toBe("SELECT * FROM user WHERE name = 'Alice'")
  })

  it('Integer 类型参数不加引号', () => {
    const input = `==>  Preparing: SELECT * FROM user WHERE id = ?
==> Parameters: 42(Integer)`

    const results = parseMybatisLog(input)
    expect(results[0].sql).toBe('SELECT * FROM user WHERE id = 42')
  })

  it('Long 类型参数不加引号', () => {
    const input = `==>  Preparing: SELECT * FROM order WHERE id = ?
==> Parameters: 9999999999(Long)`

    const results = parseMybatisLog(input)
    expect(results[0].sql).toBe('SELECT * FROM order WHERE id = 9999999999')
  })

  it('Double 类型参数不加引号', () => {
    const input = `==>  Preparing: SELECT * FROM product WHERE price > ?
==> Parameters: 19.99(Double)`

    const results = parseMybatisLog(input)
    expect(results[0].sql).toBe('SELECT * FROM product WHERE price > 19.99')
  })

  it('Float 类型参数不加引号', () => {
    const input = `==>  Preparing: SELECT * FROM product WHERE weight = ?
==> Parameters: 3.14(Float)`

    const results = parseMybatisLog(input)
    expect(results[0].sql).toBe('SELECT * FROM product WHERE weight = 3.14')
  })

  it('BigDecimal 类型参数不加引号', () => {
    const input = `==>  Preparing: SELECT * FROM account WHERE balance = ?
==> Parameters: 100000.50(BigDecimal)`

    const results = parseMybatisLog(input)
    expect(results[0].sql).toBe('SELECT * FROM account WHERE balance = 100000.50')
  })

  it('Boolean 类型参数不加引号', () => {
    const input = `==>  Preparing: SELECT * FROM user WHERE active = ?
==> Parameters: true(Boolean)`

    const results = parseMybatisLog(input)
    expect(results[0].sql).toBe('SELECT * FROM user WHERE active = true')
  })

  it('Date 类型参数加单引号', () => {
    const input = `==>  Preparing: SELECT * FROM order WHERE created_at > ?
==> Parameters: 2024-01-15(Date)`

    const results = parseMybatisLog(input)
    expect(results[0].sql).toBe("SELECT * FROM order WHERE created_at > '2024-01-15'")
  })

  it('Timestamp 类型参数加单引号', () => {
    const input = `==>  Preparing: SELECT * FROM log WHERE ts = ?
==> Parameters: 2024-01-15 10:30:00.0(Timestamp)`

    const results = parseMybatisLog(input)
    expect(results[0].sql).toBe("SELECT * FROM log WHERE ts = '2024-01-15 10:30:00.0'")
  })


  it('null 参数替换为 NULL', () => {
    const input = `==>  Preparing: INSERT INTO user (name, email) VALUES (?, ?)
==> Parameters: null, test@example.com(String)`

    const results = parseMybatisLog(input)
    expect(results[0].sql).toBe("INSERT INTO user (name, email) VALUES (NULL, 'test@example.com')")
    expect(results[0].params).toEqual(['null', 'test@example.com(String)'])
  })

  it('支持批量解析多组 Preparing + Parameters', () => {
    const input = `==>  Preparing: SELECT * FROM user WHERE id = ?
==> Parameters: 1(Integer)
==>  Preparing: UPDATE user SET name = ? WHERE id = ?
==> Parameters: Bob(String), 1(Integer)`

    const results = parseMybatisLog(input)

    expect(results).toHaveLength(2)
    expect(results[0].sql).toBe('SELECT * FROM user WHERE id = 1')
    expect(results[1].sql).toBe("UPDATE user SET name = 'Bob' WHERE id = 1")
  })

  it('支持带时间戳前缀的日志', () => {
    const input = `2024-01-15 10:30:00.123 DEBUG c.m.mapper.UserMapper - ==>  Preparing: SELECT * FROM user WHERE id = ?
2024-01-15 10:30:00.124 DEBUG c.m.mapper.UserMapper - ==> Parameters: 1(Integer)`

    const results = parseMybatisLog(input)

    expect(results).toHaveLength(1)
    expect(results[0].sql).toBe('SELECT * FROM user WHERE id = 1')
  })

  it('支持带类名前缀的日志', () => {
    const input = `com.example.mapper.UserMapper.selectById - ==>  Preparing: SELECT * FROM user WHERE id = ?
com.example.mapper.UserMapper.selectById - ==> Parameters: 5(Integer)`

    const results = parseMybatisLog(input)

    expect(results).toHaveLength(1)
    expect(results[0].sql).toBe('SELECT * FROM user WHERE id = 5')
  })

  it('空参数列表', () => {
    const input = `==>  Preparing: SELECT COUNT(*) FROM user
==> Parameters: `

    const results = parseMybatisLog(input)

    expect(results).toHaveLength(1)
    expect(results[0].sql).toBe('SELECT COUNT(*) FROM user')
    expect(results[0].params).toEqual([])
  })

  it('只有 Preparing 没有 Parameters 行', () => {
    const input = `==>  Preparing: SELECT 1`

    const results = parseMybatisLog(input)

    expect(results).toHaveLength(1)
    expect(results[0].sql).toBe('SELECT 1')
    expect(results[0].params).toEqual([])
    expect(results[0].rawParameters).toBe('')
  })

  it('保留原始行信息', () => {
    const input = `==>  Preparing: SELECT * FROM user WHERE id = ?
==> Parameters: 1(Integer)`

    const results = parseMybatisLog(input)

    expect(results[0].rawPreparing).toBe('==>  Preparing: SELECT * FROM user WHERE id = ?')
    expect(results[0].rawParameters).toBe('==> Parameters: 1(Integer)')
  })

  it('空输入返回空数组', () => {
    expect(parseMybatisLog('')).toEqual([])
  })

  it('无关文本返回空数组', () => {
    const input = `Some random log line
Another line without SQL
DEBUG: application started`

    expect(parseMybatisLog(input)).toEqual([])
  })

  it('混合有效和无效行', () => {
    const input = `INFO: Starting application
==>  Preparing: SELECT * FROM user WHERE id = ?
==> Parameters: 1(Integer)
INFO: Query completed
==>  Preparing: DELETE FROM session WHERE expired = ?
==> Parameters: true(Boolean)`

    const results = parseMybatisLog(input)

    expect(results).toHaveLength(2)
    expect(results[0].sql).toBe('SELECT * FROM user WHERE id = 1')
    expect(results[1].sql).toBe('DELETE FROM session WHERE expired = true')
  })

  it('支持纯SQL行+带复杂前缀的Parameters行格式', () => {
    const input = `select id, strategy_no, name from scp_execution_strategy WHERE strategy_no in( ? , ? ) and deleted = 0 order by update_time desc
2026-05-14 17:16:36.823|[XNIO-2 task-5]|5abeff9fe2f90e0d72eb2be221eb1cd3|6156|0|DEBUG|c.c.s.p.d.m.S.executionStrategyList[debug,137]|[0]==> Parameters: JHCL-26040800034(String), JHCL-26040800023(String)`

    const results = parseMybatisLog(input)

    expect(results).toHaveLength(1)
    expect(results[0].sql).toBe("select id, strategy_no, name from scp_execution_strategy WHERE strategy_no in( 'JHCL-26040800034' , 'JHCL-26040800023' ) and deleted = 0 order by update_time desc")
  })

  it('支持纯SQL行（以SQL关键字开头）+标准Parameters行', () => {
    const input = `SELECT * FROM user WHERE id = ? AND status = ?
==> Parameters: 42(Integer), active(String)`

    const results = parseMybatisLog(input)

    expect(results).toHaveLength(1)
    expect(results[0].sql).toBe("SELECT * FROM user WHERE id = 42 AND status = 'active'")
  })

  it('LocalDateTime 类型参数加单引号', () => {
    const input = `==>  Preparing: SELECT * FROM scp_purchase_task WHERE generated_time < ?
==> Parameters: 2026-05-11T17:48:15.015991(LocalDateTime)`

    const results = parseMybatisLog(input)
    expect(results[0].sql).toBe("SELECT * FROM scp_purchase_task WHERE generated_time < '2026-05-11T17:48:15.015991'")
  })

  it('LocalDate / LocalTime 类型参数加单引号', () => {
    const input = `==>  Preparing: SELECT * FROM t WHERE d = ? AND t = ?
==> Parameters: 2026-05-11(LocalDate), 17:48:15(LocalTime)`

    const results = parseMybatisLog(input)
    expect(results[0].sql).toBe("SELECT * FROM t WHERE d = '2026-05-11' AND t = '17:48:15'")
  })

  it('OffsetDateTime / ZonedDateTime / Instant 类型参数加单引号', () => {
    const input = `==>  Preparing: SELECT * FROM t WHERE a = ? AND b = ? AND c = ?
==> Parameters: 2026-05-11T17:48:15+08:00(OffsetDateTime), 2026-05-11T17:48:15+08:00[Asia/Shanghai](ZonedDateTime), 2026-05-11T09:48:15Z(Instant)`

    const results = parseMybatisLog(input)
    expect(results[0].sql).toBe(
      "SELECT * FROM t WHERE a = '2026-05-11T17:48:15+08:00' AND b = '2026-05-11T17:48:15+08:00[Asia/Shanghai]' AND c = '2026-05-11T09:48:15Z'"
    )
  })

  it('UUID 类型参数加单引号', () => {
    const input = `==>  Preparing: SELECT * FROM t WHERE id = ?
==> Parameters: 550e8400-e29b-41d4-a716-446655440000(UUID)`

    const results = parseMybatisLog(input)
    expect(results[0].sql).toBe("SELECT * FROM t WHERE id = '550e8400-e29b-41d4-a716-446655440000'")
  })

  it('Short / Byte / BigInteger 类型参数不加引号', () => {
    const input = `==>  Preparing: SELECT * FROM t WHERE a = ? AND b = ? AND c = ?
==> Parameters: 1(Short), 2(Byte), 99999999999999(BigInteger)`

    const results = parseMybatisLog(input)
    expect(results[0].sql).toBe('SELECT * FROM t WHERE a = 1 AND b = 2 AND c = 99999999999999')
  })

  it('字符串值中的单引号需要被转义', () => {
    const input = `==>  Preparing: SELECT * FROM user WHERE name = ?
==> Parameters: O'Brien(String)`

    const results = parseMybatisLog(input)
    expect(results[0].sql).toBe("SELECT * FROM user WHERE name = 'O''Brien'")
  })

  it('未知类型按字符串处理（兜底策略）', () => {
    const input = `==>  Preparing: SELECT * FROM t WHERE col = ?
==> Parameters: hello-world(SomeCustomType)`

    const results = parseMybatisLog(input)
    expect(results[0].sql).toBe("SELECT * FROM t WHERE col = 'hello-world'")
  })

  it('未知类型但值为纯数字时不加引号', () => {
    const input = `==>  Preparing: SELECT * FROM t WHERE col = ?
==> Parameters: 123.45(MysteryNumeric)`

    const results = parseMybatisLog(input)
    expect(results[0].sql).toBe('SELECT * FROM t WHERE col = 123.45')
  })

  it('真实场景：scp_purchase_task 多个 LocalDateTime 参数', () => {
    const input = `==>  Preparing: SELECT \`status\`,\`generated_time\` FROM \`scp_purchase_task\` WHERE ( ( \`status\` = ? and \`generated_time\` < ? ) or ( \`status\` = ? and \`claimed_time\` < ? ) or ( \`status\` = ? and \`completed_time\` > ? ) )
==> Parameters: 10(Integer), 2026-05-11T17:48:15.015991(LocalDateTime), 20(Integer), 2026-05-10T17:48:15.015991(LocalDateTime), 50(Integer), 2026-05-13T16:48:15.015991(LocalDateTime)`

    const results = parseMybatisLog(input)
    expect(results).toHaveLength(1)
    expect(results[0].sql).toBe(
      "SELECT `status`,`generated_time` FROM `scp_purchase_task` WHERE ( ( `status` = 10 and `generated_time` < '2026-05-11T17:48:15.015991' ) or ( `status` = 20 and `claimed_time` < '2026-05-10T17:48:15.015991' ) or ( `status` = 50 and `completed_time` > '2026-05-13T16:48:15.015991' ) )"
    )
  })
})
