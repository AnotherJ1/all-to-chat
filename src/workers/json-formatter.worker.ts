// JSON 格式化 Web Worker
// 用于处理大型 JSON 数据的格式化和压缩，避免阻塞主线程

/** Worker 接收的消息类型 */
interface WorkerRequest {
  type: 'format' | 'minify'
  data: string
}

/** Worker 返回的成功响应 */
interface WorkerSuccessResponse {
  success: true
  result: string
}

/** Worker 返回的错误响应 */
interface WorkerErrorResponse {
  success: false
  error: string
  position?: number
}

type WorkerResponse = WorkerSuccessResponse | WorkerErrorResponse

/**
 * 从 JSON.parse 错误消息中提取位置信息
 * 不同浏览器的错误消息格式不同：
 * - Chrome: "... at position 42"
 * - Firefox: "... at line 3 column 5"
 * - Safari: "... at character 42"
 */
function extractErrorPosition(errorMessage: string): number | undefined {
  // Chrome/V8: "at position X"
  const positionMatch = errorMessage.match(/at position (\d+)/)
  if (positionMatch) {
    return parseInt(positionMatch[1], 10)
  }

  // Firefox: "at line X column Y" - 转换为大致字符位置
  const lineColMatch = errorMessage.match(/at line (\d+) column (\d+)/)
  if (lineColMatch) {
    return parseInt(lineColMatch[2], 10)
  }

  // Safari: "at character X"
  const characterMatch = errorMessage.match(/at character (\d+)/)
  if (characterMatch) {
    return parseInt(characterMatch[1], 10)
  }

  return undefined
}

/**
 * 处理格式化请求
 */
function handleFormat(data: string): WorkerResponse {
  try {
    const parsed = JSON.parse(data)
    const result = JSON.stringify(parsed, null, 2)
    return { success: true, result }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    const position = extractErrorPosition(error)
    return { success: false, error, position }
  }
}

/**
 * 处理压缩请求
 */
function handleMinify(data: string): WorkerResponse {
  try {
    const parsed = JSON.parse(data)
    const result = JSON.stringify(parsed)
    return { success: true, result }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    const position = extractErrorPosition(error)
    return { success: false, error, position }
  }
}

// 监听主线程消息
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { type, data } = event.data

  let response: WorkerResponse

  switch (type) {
    case 'format':
      response = handleFormat(data)
      break
    case 'minify':
      response = handleMinify(data)
      break
    default:
      response = { success: false, error: `未知操作类型: ${type}` }
  }

  self.postMessage(response)
}
