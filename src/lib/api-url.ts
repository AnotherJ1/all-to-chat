/**
 * API Base URL 归一化
 *
 * 各调用处会在 base 之后拼接 `/v1/...`（如 `/v1/models`、`/v1/images/generations`、
 * `/v1/chat/completions`）。但很多兼容代理给出的 Base URL 本身就以 `/v1` 结尾，
 * 直接拼接会得到 `/v1/v1/...` 导致 404（表现为「获取模型失败」「生成失败」）。
 *
 * 该函数移除末尾空白、末尾斜杠，以及末尾一个独立的 `/v1` 段；
 * 注意只精确匹配 `/v1`，不会误伤 Gemini 的 `/v1beta`。
 */
export function normalizeApiBase(baseUrl: string): string {
  return baseUrl
    .trim()
    .replace(/\/+$/, '') // 去掉末尾斜杠
    .replace(/\/v1$/, '') // 去掉末尾独立的 /v1 段（不匹配 /v1beta）
    .replace(/\/+$/, '') // 再次清理（极端情况 `.../v1/`）
}
