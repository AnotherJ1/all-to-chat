# Implementation Plan: JSON格式化工具 + MyBatis日志转SQL工具

## Overview

为 Tool Hub 平台新增两个开发者工具：JSON格式化/压缩工具（含Web Worker性能优化）和 MyBatis日志转SQL工具。遵循现有工具注册模式，使用 zustand + localStorage 持久化历史记录。

## Tasks

- [x] 1. 基础设施：注册工具和创建图标
  - [x] 1.1 在 Icons.tsx 添加新图标组件
    - 在 `src/components/common/Icons.tsx` 添加 `IconJson` 图标（花括号样式SVG）
    - 在 `src/components/common/Icons.tsx` 添加 `IconDatabase` 图标（数据库/SQL样式SVG）
    - 确保图标组件接受 `className` 和 `style` props，与现有图标一致
  - [x] 1.2 在工具注册表注册两个新工具
    - 在 `src/registry/tools.ts` 添加 JSON格式化工具条目（id: 'json-formatter', route: '/json'）
    - 在 `src/registry/tools.ts` 添加 MyBatis日志转SQL工具条目（id: 'mybatis-log', route: '/mybatis'）
    - 使用 `lazy(() => import(...))` 懒加载对应页面组件

- [x] 2. JSON格式化工具
  - [x] 2.1 创建 JSON 格式化 Web Worker
    - 创建 `src/workers/json-formatter.worker.ts`
    - Worker 接收消息 `{ type: 'format' | 'minify', data: string }`
    - 返回 `{ success: true, result: string }` 或 `{ success: false, error: string, position?: number }`
    - 格式化使用 `JSON.stringify(JSON.parse(data), null, 2)`
    - 压缩使用 `JSON.stringify(JSON.parse(data))`
  - [x] 2.2 创建 JSON 历史记录 Store
    - 创建 `src/stores/jsonHistoryStore.ts`
    - 使用 zustand + persist 中间件，key 为 'json-history'
    - 接口：`{ id: string, input: string, output: string, timestamp: number }`
    - 方法：addRecord, removeRecord, clearAll
    - 最多保存50条，超出自动删除最旧记录
    - input/output 超过10KB时截断存储（避免 localStorage 溢出）
  - [x] 2.3 创建 JSON 格式化页面组件
    - 创建 `src/pages/JsonFormatterPage.tsx`
    - 三栏布局：左侧textarea输入 | 中间操作按钮列 | 右侧pre预览区
    - 操作按钮：格式化、压缩、复制结果、保存记录、清空
    - 小JSON(<100KB)主线程处理，大JSON(>=100KB)使用Web Worker
    - 错误时显示红色提示及错误信息
    - 预览区使用 highlight.js 做JSON语法高亮
    - 底部可折叠历史记录面板
    - 响应式：移动端改为上下布局
    - 包含 BackToHome 返回按钮
    - 使用现有主题系统 CSS 变量

- [x] 3. MyBatis日志转SQL工具
  - [x] 3.1 创建 MyBatis 日志解析器
    - 创建 `src/lib/mybatis-parser.ts`
    - 导出函数 `parseMybatisLog(input: string): ParseResult[]`
    - ParseResult 接口：`{ sql: string, params: string[], rawPreparing: string, rawParameters: string }`
    - 解析逻辑：按行扫描，匹配 `==>  Preparing:` 提取SQL模板
    - 匹配 `==> Parameters:` 提取参数（格式如 `value(Type), value(Type)`）
    - 根据类型决定引号：String/Date/Timestamp 加单引号，数字类型不加
    - 支持 null 参数（替换为 NULL）
    - 支持批量：一次输入包含多组 Preparing+Parameters
  - [x] 3.2 创建 MyBatis 历史记录 Store
    - 创建 `src/stores/mybatisHistoryStore.ts`
    - 使用 zustand + persist 中间件，key 为 'mybatis-history'
    - 接口：`{ id: string, rawLog: string, parsedSqls: string[], timestamp: number }`
    - 方法：addRecord, removeRecord, clearAll
    - 最多保存50条记录
  - [x] 3.3 创建 MyBatis 日志转SQL页面组件
    - 创建 `src/pages/MybatisLogPage.tsx`
    - 上方：日志输入textarea（粘贴后自动触发解析）
    - 中间：解析结果区域，每条SQL独立卡片展示（高亮 + 复制按钮）
    - 下方：历史记录列表（时间、SQL预览、查看/删除操作）
    - 解析完成自动保存到 store
    - 使用 highlight.js 做SQL语法高亮
    - 包含 BackToHome 返回按钮
    - 使用现有主题系统 CSS 变量

## Notes

- Web Worker 使用 Vite 原生支持的 `new Worker(new URL(...), { type: 'module' })` 方式
- highlight.js 已在项目依赖中，直接使用 `hljs.highlight(code, { language: 'json' | 'sql' })`
- 所有新组件复用现有主题 CSS 变量（--bg-primary, --text-primary 等）
- 历史记录使用 zustand persist 中间件，与现有 store 模式一致

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "2.2", "3.1", "3.2"] },
    { "id": 3, "tasks": ["2.3", "3.3"] }
  ]
}
```
