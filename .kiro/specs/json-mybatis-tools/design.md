# 设计：JSON格式化工具 + MyBatis日志转SQL工具

## 架构概览

两个工具遵循现有项目模式：
- 在 `toolRegistry` 注册新工具
- 各自独立页面组件（懒加载）
- 使用 zustand store 管理历史记录（持久化到 localStorage）
- 复用现有主题系统和 BackToHome 导航

## 文件结构

```
src/
├── pages/
│   ├── JsonFormatterPage.tsx      # JSON格式化页面
│   └── MybatisLogPage.tsx         # MyBatis日志转SQL页面
├── components/
│   ├── json/
│   │   ├── JsonEditor.tsx         # 左侧输入编辑器
│   │   ├── JsonPreview.tsx        # 右侧预览（高亮）
│   │   └── JsonHistory.tsx        # 历史记录面板
│   └── mybatis/
│       ├── MybatisInput.tsx       # 日志输入区
│       ├── MybatisResult.tsx      # 解析结果展示
│       └── MybatisHistory.tsx     # 历史记录面板
├── stores/
│   ├── jsonHistoryStore.ts        # JSON历史记录store
│   └── mybatisHistoryStore.ts     # MyBatis历史记录store
├── lib/
│   └── mybatis-parser.ts          # MyBatis日志解析核心逻辑
└── workers/
    └── json-formatter.worker.ts   # JSON格式化Web Worker
```

## 技术方案

### JSON格式化 - 性能优化
- 小JSON（<100KB）：主线程直接 `JSON.parse` + `JSON.stringify(obj, null, 2)`
- 大JSON（>=100KB）：使用 Web Worker 异步处理，避免阻塞UI
- 显示区使用虚拟滚动或限制显示行数（超过5000行折叠）
- 语法高亮使用已有的 highlight.js

### MyBatis日志解析算法
1. 按行分割输入文本
2. 匹配 `Preparing:` 行提取SQL模板
3. 匹配下一行 `Parameters:` 提取参数列表
4. 按类型标注（String, Integer, Long等）决定是否加引号
5. 依次替换 `?` 占位符

### 数据持久化
- zustand + localStorage 中间件
- JSON历史：保存 `{ id, input, output, timestamp }`
- MyBatis历史：保存 `{ id, rawLog, parsedSql, timestamp }`
- 最多保存50条记录，超出自动清理最旧的

## UI布局

### JSON格式化页面
```
┌─────────────────────────────────────────────┐
│ [← 返回]        JSON 格式化工具              │
├──────────────┬──────┬───────────────────────┤
│              │ 格式化│                        │
│   输入框     │ 压缩  │     结果预览           │
│  (textarea)  │ 复制  │   (高亮显示)           │
│              │ 保存  │                        │
│              │ 清空  │                        │
├──────────────┴──────┴───────────────────────┤
│            历史记录（可折叠）                  │
└─────────────────────────────────────────────┘
```

### MyBatis日志转SQL页面
```
┌─────────────────────────────────────────────┐
│ [← 返回]     MyBatis 日志转 SQL              │
├─────────────────────────────────────────────┤
│   日志输入框（粘贴后自动解析）                │
├─────────────────────────────────────────────┤
│   解析结果（高亮SQL + 复制按钮）             │
├─────────────────────────────────────────────┤
│   历史记录列表                               │
└─────────────────────────────────────────────┘
```
