import { useState, useCallback, useEffect } from 'react'
import BackToHome from '../components/common/BackToHome'
import { toast } from '../stores/toastStore'
import {
  useQrGenerator,
  useQrParser,
  QrCodeContext,
  isValidHexColor,
  getContrastRatio,
  safeOpenUrl,
  CameraScanner,
  TemplateBuilder,
  ParsedTemplateView,
  StyledQrPanel,
  SizePresetButtons,
  QrMetadataView,
  HistoryPanel,
  BatchPanel,
  ThemeHintBar,
  useQrHistory,
  useQrUrlSync,
} from './qrcode'

/**
 * QrCodePage 主壳
 * 仅负责组合 Hook + UI 编排，所有业务逻辑都在 useQrGenerator / useQrParser。
 */
export default function QrCodePage() {
  const generator = useQrGenerator()
  const parser = useQrParser()
  const history = useQrHistory()

  // URL 状态同步（generator 字段变化 → URL）
  useQrUrlSync(generator)

  // 拖拽视觉反馈（Bug #12）
  const [isDragging, setIsDragging] = useState(false)
  // 颜色输入暂存（用户可能正在输入未完成的 hex）
  const [fgInput, setFgInput] = useState(generator.fgColor)
  const [bgInput, setBgInput] = useState(generator.bgColor)

  const {
    text, size, fgColor, bgColor, errorLevel, logoDataUrl, svgString,
    setText, setSize, setFgColor, setBgColor, setErrorLevel,
    canvasRef, setLogoFile, clearLogo,
    downloadPng, downloadSvg, copyImageToClipboard, copyBase64,
  } = generator

  const {
    parseResult, parseError, previewUrl,
    fileInputRef, onFileChange, onDrop, onPaste,
  } = parser

  // 历史记录持久化（防抖 1.5s，文本/选项稳定后写入）
  useEffect(() => {
    if (!text || !text.trim()) return
    const timer = setTimeout(() => {
      history.addItem(text, { text, size, fgColor, bgColor, errorLevel })
    }, 1500)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, size, fgColor, bgColor, errorLevel])

  // ====== 颜色输入失焦校验（Bug #9） ======
  const commitFgColor = useCallback(() => {
    if (isValidHexColor(fgInput)) {
      setFgColor(fgInput.trim())
    } else {
      toast.error('前景色格式无效，已恢复上一次取值')
      setFgInput(fgColor)
    }
  }, [fgInput, fgColor, setFgColor])

  const commitBgColor = useCallback(() => {
    if (isValidHexColor(bgInput)) {
      setBgColor(bgInput.trim())
    } else {
      toast.error('背景色格式无效，已恢复上一次取值')
      setBgInput(bgColor)
    }
  }, [bgInput, bgColor, setBgColor])

  // ====== 对比度警告（Bug #10） ======
  const contrast = getContrastRatio(fgColor, bgColor)
  const showContrastWarning = contrast < 2

  // ====== 拖拽视觉反馈（Bug #12） ======
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!isDragging) setIsDragging(true)
  }
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }
  const handleDragLeave = (e: React.DragEvent) => {
    // 仅当离开整个拖拽容器才取消
    if (e.currentTarget === e.target) setIsDragging(false)
  }
  const handleDrop = (e: React.DragEvent) => {
    setIsDragging(false)
    onDrop(e)
  }

  // ====== 拖拽区键盘可访问（Bug #15） ======
  const handleDropZoneKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      fileInputRef.current?.click()
    }
  }

  // ====== Logo 上传 ======
  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      await setLogoFile(file)
    }
    // Bug #1：同样要清空 input.value
    e.target.value = ''
  }

  // ====== 解析结果操作 ======
  const isLink = /^https?:\/\//i.test(parseResult.trim())
  const copyParsedText = async () => {
    if (!parseResult) return
    try {
      await navigator.clipboard.writeText(parseResult)
      toast.success('已复制到剪切板')
    } catch {
      toast.error('复制失败')
    }
  }

  const handleOpenLink = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // 拦截非 http(s) URL，防止 javascript: 等协议
    if (!safeOpenUrl(parseResult.trim())) {
      e.preventDefault()
      toast.error('该链接不是合法的 http(s) 地址，已阻止打开')
    }
  }

  return (
    <QrCodeContext.Provider value={{ generator, parser }}>
      <div
        className="min-h-screen w-full pb-12"
        style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
      >
        <BackToHome />

        <header className="text-center pt-16 pb-8 px-4">
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
            二维码生成与解析
          </h1>
          <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
            支持二维码实时生成（含颜色与Logo定制）及本地图片的二维码解析提取
          </p>
        </header>

        <main
          className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-4"
          style={{ maxWidth: '1200px', margin: '0 auto' }}
          onPaste={onPaste}
        >
          {/* ===== 左侧：二维码生成 ===== */}
          <section className="theme-card flex flex-col p-6 cursor-default" style={{ height: 'fit-content' }}>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ fontFamily: 'var(--font-heading)' }}>
              <span style={{ color: 'var(--accent-1)' }}>●</span> 二维码生成
            </h2>

            {/* worker-3 模板生成器挂载点 */}
            <TemplateBuilder />

            <div className="flex flex-col gap-4">
              {/* 输入文本 */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    二维码内容（文本或链接）
                  </label>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {text.length} 字符
                  </span>
                </div>
                <textarea
                  className="theme-input"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="请输入您要转换的文本或 URL 地址..."
                  style={{ minHeight: '80px', fontSize: '13px', resize: 'vertical' }}
                  spellCheck={false}
                />
              </div>

              {/* 设置项 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 前景色 */}
                <div>
                  <label className="text-sm font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                    前景色 (Dark Color)
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={fgColor}
                      onChange={(e) => { setFgColor(e.target.value); setFgInput(e.target.value) }}
                      style={{
                        width: '40px', height: '38px',
                        border: 'var(--border-width) solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)', background: 'none',
                        cursor: 'pointer', padding: '0',
                      }}
                      aria-label="前景色"
                    />
                    <input
                      type="text"
                      className="theme-input"
                      value={fgInput}
                      onChange={(e) => setFgInput(e.target.value)}
                      onBlur={commitFgColor}
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', padding: '6px 12px' }}
                      aria-label="前景色 Hex"
                    />
                  </div>
                </div>

                {/* 背景色 */}
                <div>
                  <label className="text-sm font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                    背景色 (Light Color)
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={bgColor}
                      onChange={(e) => { setBgColor(e.target.value); setBgInput(e.target.value) }}
                      style={{
                        width: '40px', height: '38px',
                        border: 'var(--border-width) solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)', background: 'none',
                        cursor: 'pointer', padding: '0',
                      }}
                      aria-label="背景色"
                    />
                    <input
                      type="text"
                      className="theme-input"
                      value={bgInput}
                      onChange={(e) => setBgInput(e.target.value)}
                      onBlur={commitBgColor}
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', padding: '6px 12px' }}
                      aria-label="背景色 Hex"
                    />
                  </div>
                </div>

                {/* 尺寸大小 */}
                <div>
                  <label className="text-sm font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                    二维码大小: {size}px
                  </label>
                  <input
                    type="range"
                    min="128"
                    max="512"
                    step="8"
                    value={size}
                    onChange={(e) => setSize(Number(e.target.value))}
                    style={{
                      width: '100%', accentColor: 'var(--accent-1)',
                      height: '6px', borderRadius: '3px',
                      background: 'var(--bg-secondary)', cursor: 'pointer',
                    }}
                    aria-label="二维码大小"
                  />
                  {/* worker-4 尺寸预设按钮挂载点 */}
                  <SizePresetButtons />
                  {/* worker-4 容量元数据 */}
                  <QrMetadataView />
                </div>

                {/* 容错等级 */}
                <div>
                  <label className="text-sm font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                    容错等级 (Error Correction)
                  </label>
                  <select
                    className="theme-select w-full"
                    value={errorLevel}
                    onChange={(e) => setErrorLevel(e.target.value as 'L' | 'M' | 'Q' | 'H')}
                    style={{ padding: '8px 36px 8px 12px' }}
                    aria-label="容错等级"
                  >
                    <option value="L">L - 低 (7%)</option>
                    <option value="M">M - 中 (15%)</option>
                    <option value="Q">Q - 高 (25%)</option>
                    <option value="H">H - 极高 (30%)</option>
                  </select>
                </div>
              </div>

              {/* 对比度警告（Bug #10） */}
              {showContrastWarning && (
                <div
                  data-testid="contrast-warning"
                  role="alert"
                  className="p-3 rounded-lg text-sm flex items-center gap-2"
                  style={{
                    background: 'color-mix(in srgb, var(--color-warning) 12%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--color-warning) 35%, transparent)',
                    color: 'var(--color-warning)',
                  }}
                >
                  <span>⚠</span>
                  <span>
                    前景色与背景色对比度过低（{contrast.toFixed(2)}），二维码可能难以扫描，建议调整颜色。
                  </span>
                </div>
              )}

              {/* worker-4 风格化面板挂载点 */}
              <StyledQrPanel />

              {/* Logo 嵌入 */}
              <div>
                <label className="text-sm font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                  嵌入 Logo 图标（可选，建议使用高容错等级）
                </label>
                <div className="flex gap-4 items-center">
                  <label
                    className="theme-btn text-center cursor-pointer"
                    style={{ fontSize: '13px', padding: '8px 16px' }}
                  >
                    选择 Logo 图片
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="hidden"
                    />
                  </label>
                  {logoDataUrl && (
                    <div className="flex items-center gap-3">
                      <img
                        src={logoDataUrl}
                        alt="Logo预览"
                        className="w-10 h-10 object-contain rounded border"
                        style={{ borderColor: 'var(--border-color)' }}
                      />
                      <button
                        className="theme-btn"
                        onClick={clearLogo}
                        style={{ padding: '4px 10px', fontSize: '12px', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                      >
                        移除
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 二维码预览及下载区域 */}
              <div
                className="flex flex-col items-center mt-4 p-6 rounded-lg"
                style={{
                  background: 'var(--bg-secondary)',
                  border: 'var(--border-width) solid var(--border-color)',
                }}
              >
                <div
                  className="p-3"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: bgColor,
                    borderRadius: 'var(--radius-sm)',
                    boxShadow: 'var(--shadow-inset)',
                  }}
                >
                  <canvas ref={canvasRef} style={{ maxWidth: '100%', height: 'auto' }} />
                </div>

                {/* 暗主题 + 浅背景提示 */}
                <ThemeHintBar />

                <div className="flex gap-4 mt-6 w-full justify-center flex-wrap">
                  <button className="theme-btn theme-btn-primary" onClick={downloadPng} style={{ padding: '8px 20px', fontSize: '13px' }}>
                    下载 PNG 图片
                  </button>
                  <button
                    className="theme-btn"
                    onClick={downloadSvg}
                    disabled={!svgString}
                    style={{ padding: '8px 20px', fontSize: '13px' }}
                    title={svgString ? '导出矢量 SVG' : '当前无可导出 SVG'}
                  >
                    下载 SVG
                  </button>
                  <button className="theme-btn" onClick={copyImageToClipboard} style={{ padding: '8px 20px', fontSize: '13px' }}>
                    复制图片
                  </button>
                  <button className="theme-btn" onClick={copyBase64} style={{ padding: '8px 20px', fontSize: '13px' }}>
                    复制 Base64
                  </button>
                </div>
              </div>
            </div>

            {/* worker-5 历史记录挂载点 */}
            <HistoryPanel />
            {/* worker-5 批量面板挂载点 */}
            <BatchPanel />
          </section>

          {/* ===== 右侧：二维码解析 ===== */}
          <section className="theme-card flex flex-col p-6 cursor-default" style={{ height: 'fit-content' }}>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ fontFamily: 'var(--font-heading)' }}>
              <span style={{ color: 'var(--accent-2)' }}>●</span> 二维码解析
            </h2>

            {/* worker-2 摄像头扫码挂载点 */}
            <CameraScanner />

            <div className="flex flex-col gap-4">
              {/* 拖拽 / 上传区（Bug #12 视觉反馈、Bug #15 键盘可访问） */}
              <div
                role="button"
                tabIndex={0}
                aria-label="拖拽或点击上传二维码图片进行解析"
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={handleDropZoneKey}
                data-testid="qr-dropzone"
                className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors"
                style={{
                  borderColor: isDragging ? 'var(--accent-1)' : 'var(--border-color)',
                  background: isDragging ? 'color-mix(in srgb, var(--accent-1) 10%, transparent)' : 'var(--bg-secondary)',
                  borderRadius: 'var(--radius)',
                  outline: 'none',
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={onFileChange}
                  className="hidden"
                />
                <div className="text-4xl mb-2" style={{ color: 'var(--accent-1)' }}>📥</div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {isDragging ? '松开鼠标以解析图片' : '拖拽图片到这里，或者点击此处上传'}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  支持常用图片格式（PNG、JPG、WEBP 等），最大边将自动降采样到 1600px
                </p>
                <p
                  className="text-xs mt-3 px-3 py-1 rounded inline-block"
                  style={{
                    background: 'color-mix(in srgb, var(--accent-1) 12%, transparent)',
                    color: 'var(--accent-1)',
                    border: '1px solid color-mix(in srgb, var(--accent-1) 25%, transparent)',
                  }}
                >
                  提示：支持在当前页面直接 Ctrl + V 粘贴二维码截图解析
                </p>
              </div>

              {/* 上传图片预览 */}
              {previewUrl && (
                <div
                  className="flex flex-col items-center justify-center p-4 rounded-lg border"
                  style={{ borderColor: 'var(--border-color)', background: 'var(--bg-surface)' }}
                >
                  <span className="text-xs font-semibold mb-2 self-start" style={{ color: 'var(--text-secondary)' }}>
                    图片预览:
                  </span>
                  <img
                    src={previewUrl}
                    alt="二维码解析预览"
                    className="max-h-48 object-contain rounded shadow-sm"
                  />
                </div>
              )}

              {/* 解析结果 */}
              {parseResult && (
                <div
                  className="p-4 rounded-lg flex flex-col gap-3"
                  style={{
                    background: 'var(--bg-secondary)',
                    border: 'var(--border-width) solid var(--border-color)',
                  }}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-success)' }}>
                      ✓ 解析成功
                    </span>
                    <div className="flex gap-2">
                      <button
                        className="theme-btn"
                        onClick={copyParsedText}
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                      >
                        复制结果
                      </button>
                      {isLink && (
                        <a
                          href={parseResult}
                          target="_blank"
                          rel="noreferrer noopener"
                          onClick={handleOpenLink}
                          className="theme-btn theme-btn-primary"
                          style={{ padding: '4px 10px', fontSize: '12px', textDecoration: 'none' }}
                        >
                          打开链接 ↗
                        </a>
                      )}
                    </div>
                  </div>
                  <div
                    className="p-3 rounded font-mono text-sm break-all select-all"
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {parseResult}
                  </div>
                  {/* 结构化模板视图（识别为 wifi/vcard/sms/email/geo 时显示） */}
                  <ParsedTemplateView raw={parseResult} />
                </div>
              )}

              {parseError && (
                <div
                  className="p-4 rounded-lg flex items-center gap-2 text-sm font-medium"
                  style={{
                    background: 'color-mix(in srgb, var(--color-danger) 12%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--color-danger) 25%, transparent)',
                    color: 'var(--color-danger)',
                  }}
                  role="alert"
                >
                  <span>⚠</span> {parseError}
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </QrCodeContext.Provider>
  )
}
