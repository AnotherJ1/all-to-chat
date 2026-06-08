/**
 * 文字转 ASCII 艺术横幅 —— 基于 figlet
 *
 * figlet 在浏览器端需要显式喂入字体数据（FLF 字符串）后才能 textSync。
 * 这里：
 *  - 用 Vite 的 import.meta.glob 把 figlet 自带的 importable-fonts 收集为按需加载模块
 *  - 仅暴露一组精选常用字体（避免 662 个字体污染下拉）
 *  - renderBanner 负责确保字体已注册，再同步生成横幅
 *
 * 注意：parseFont/textSync 是同步的，但字体数据加载是异步的，
 * 所以对外入口 renderBanner 是 async。
 */
import figlet from 'figlet'

/** 精选字体（兼顾经典与观感），value 需与 importable-fonts 文件名一致 */
export const FONTS: { value: string; label: string }[] = [
  { value: 'Standard', label: 'Standard（标准）' },
  { value: 'Big', label: 'Big（大号）' },
  { value: 'Slant', label: 'Slant（斜体）' },
  { value: 'Banner', label: 'Banner（旗帜）' },
  { value: 'Block', label: 'Block（方块）' },
  { value: 'Doom', label: 'Doom' },
  { value: 'Ghost', label: 'Ghost（幽灵）' },
  { value: 'Graffiti', label: 'Graffiti（涂鸦）' },
  { value: 'Isometric1', label: 'Isometric（立体）' },
  { value: 'Mini', label: 'Mini（迷你）' },
  { value: 'Shadow', label: 'Shadow（阴影）' },
  { value: 'Small', label: 'Small（小号）' },
  { value: 'Star Wars', label: 'Star Wars' },
  { value: '3-D', label: '3-D（三维）' },
]

export const DEFAULT_FONT = 'Standard'

/**
 * 显式按需加载器 —— 仅覆盖 FONTS 暴露的字体。
 * 之所以不用 import.meta.glob('.../*.js')：那会让 Vite 为全部 662 个字体各产出一个 chunk。
 * 这里每个字体仍是独立 dynamic import（按需拉取），但只生成 14 个 chunk。
 */
const fontLoaders: Record<string, () => Promise<{ default: string }>> = {
  Standard: () => import('figlet/importable-fonts/Standard.js'),
  Big: () => import('figlet/importable-fonts/Big.js'),
  Slant: () => import('figlet/importable-fonts/Slant.js'),
  Banner: () => import('figlet/importable-fonts/Banner.js'),
  Block: () => import('figlet/importable-fonts/Block.js'),
  Doom: () => import('figlet/importable-fonts/Doom.js'),
  Ghost: () => import('figlet/importable-fonts/Ghost.js'),
  Graffiti: () => import('figlet/importable-fonts/Graffiti.js'),
  Isometric1: () => import('figlet/importable-fonts/Isometric1.js'),
  Mini: () => import('figlet/importable-fonts/Mini.js'),
  Shadow: () => import('figlet/importable-fonts/Shadow.js'),
  Small: () => import('figlet/importable-fonts/Small.js'),
  'Star Wars': () => import('figlet/importable-fonts/Star Wars.js'),
  '3-D': () => import('figlet/importable-fonts/3-D.js'),
}

/** 记录已注册到 figlet 的字体，避免重复 parseFont */
const registered = new Set<string>()

/** 确保某字体已加载并注册到 figlet */
async function ensureFont(name: string): Promise<boolean> {
  if (registered.has(name)) return true
  const loader = fontLoaders[name]
  if (!loader) return false
  const mod = await loader()
  figlet.parseFont(name, mod.default)
  registered.add(name)
  return true
}

export interface BannerResult {
  ok: boolean
  text: string
  message?: string
}

/**
 * 生成 ASCII 横幅。
 * @param input 要转换的文字（建议 ASCII；非 ASCII 字符 figlet 会留空）
 * @param font 字体名（FONTS 中的 value）
 */
export async function renderBanner(input: string, font: string = DEFAULT_FONT): Promise<BannerResult> {
  const text = input ?? ''
  if (!text.trim()) return { ok: true, text: '' }

  try {
    const loaded = await ensureFont(font)
    if (!loaded) {
      // 回退到 Standard
      await ensureFont(DEFAULT_FONT)
      const out = figlet.textSync(text, { font: DEFAULT_FONT as figlet.Fonts })
      return { ok: true, text: out, message: `字体 ${font} 不可用，已回退 Standard` }
    }
    const out = figlet.textSync(text, { font: font as figlet.Fonts })
    return { ok: true, text: out }
  } catch (err) {
    const message = err instanceof Error ? err.message : '横幅生成失败'
    return { ok: false, text: '', message }
  }
}
