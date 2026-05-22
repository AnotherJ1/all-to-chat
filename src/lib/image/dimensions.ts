/**
 * 图片压缩 — 等比缩放尺寸计算
 *
 * 设计原则：
 * - 输入合法宽高（正整数）和最大边长 maxDim
 * - 取较长边按 maxDim 等比缩放，较短边同比例缩放并四舍五入到整数
 * - 当原图较长边 ≤ maxDim 时不放大，原样返回（避免无意义放大造成模糊与体积膨胀）
 * - 异常输入（≤0 / NaN）抛错，由调用方决定降级策略
 */

/** 缩放结果 */
export interface ResizedDims {
  /** 缩放后宽度（整数 px） */
  width: number
  /** 缩放后高度（整数 px） */
  height: number
  /** 实际缩放比例（≤1，1 代表未缩放） */
  scale: number
  /** 是否触发缩放（false 表示原图较长边 ≤ maxDim） */
  resized: boolean
}

/**
 * 等比缩放计算
 *
 * @param srcW   原图宽（>0）
 * @param srcH   原图高（>0）
 * @param maxDim 最大边长（>0）
 * @throws 当任意输入非正整数 / NaN 时抛错
 */
export function calcResizedDims(srcW: number, srcH: number, maxDim: number): ResizedDims {
  // 入参防御：保留显式异常，禁止默默吞错
  if (!Number.isFinite(srcW) || srcW <= 0) {
    throw new Error(`invalid srcW: ${srcW}`)
  }
  if (!Number.isFinite(srcH) || srcH <= 0) {
    throw new Error(`invalid srcH: ${srcH}`)
  }
  if (!Number.isFinite(maxDim) || maxDim <= 0) {
    throw new Error(`invalid maxDim: ${maxDim}`)
  }

  // 较长边
  const longest = Math.max(srcW, srcH)

  // 不放大：较长边已经 ≤ maxDim，原样返回
  if (longest <= maxDim) {
    // 注意：调用方可能用整数像素作 canvas 尺寸，这里强制 round 一次保险
    return {
      width: Math.round(srcW),
      height: Math.round(srcH),
      scale: 1,
      resized: false,
    }
  }

  // 等比缩放：scale = maxDim / longest（必然 < 1）
  const scale = maxDim / longest
  // 较长边精确等于 maxDim；较短边按 round 取整避免子像素裁切
  const width = srcW >= srcH ? maxDim : Math.max(1, Math.round(srcW * scale))
  const height = srcH > srcW ? maxDim : Math.max(1, Math.round(srcH * scale))

  return { width, height, scale, resized: true }
}
