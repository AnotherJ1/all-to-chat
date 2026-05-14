# Requirements Document

## Introduction

将现有 AI 聊天单页应用重构为多工具平台网站（Tool Hub）。平台首页展示可用工具列表，每个工具拥有独立 URL 路由和全屏页面。初始工具包含 AI 聊天和图片生成。整体 UI 采用现代简约深色主题设计，部署于 Cloudflare Pages 纯前端环境。

## Glossary

- **Platform**: 重构后的多工具平台网站整体应用
- **HomePage**: 平台首页，展示所有可用工具的卡片列表
- **ToolCard**: 首页中展示单个工具信息的卡片组件
- **ToolPage**: 工具的全屏独立页面，承载具体工具功能
- **Router**: 基于 React Router 的客户端路由系统
- **AIChatTool**: AI 聊天工具，支持 OpenAI/Anthropic/Gemini 协议
- **ImageGenTool**: 图片生成工具，支持 DALL-E/Imagen/Flux 提供商
- **ToolRegistry**: 工具注册表，维护所有可用工具的元数据

## Requirements

### Requirement 1: 平台路由系统

**User Story:** As a user, I want each tool to have its own URL, so that I can use browser navigation (forward/back) and share direct links to specific tools.

#### Acceptance Criteria

1. THE Platform SHALL use React Router as the client-side routing library.
2. WHEN the user navigates to the root path `/`, THE Router SHALL render the HomePage.
3. WHEN the user navigates to `/chat`, THE Router SHALL render the AIChatTool page.
4. WHEN the user navigates to `/image`, THE Router SHALL render the ImageGenTool page.
5. WHEN the user clicks the browser back button, THE Router SHALL navigate to the previous route without full page reload.
6. WHEN the user clicks the browser forward button, THE Router SHALL navigate to the next route in history without full page reload.
7. IF the user navigates to an undefined route, THEN THE Router SHALL redirect to the HomePage.
8. THE Platform SHALL use `BrowserRouter` with Cloudflare Pages SPA fallback configuration.

### Requirement 2: 首页工具列表

**User Story:** As a user, I want to see all available tools on the homepage, so that I can quickly find and access the tool I need.

#### Acceptance Criteria

1. THE HomePage SHALL display a grid of ToolCard components representing all registered tools.
2. THE HomePage SHALL retrieve tool metadata from the ToolRegistry.
3. WHEN the user clicks a ToolCard, THE Platform SHALL navigate to the corresponding tool's route.
4. THE ToolCard SHALL display the tool name, a brief description, and a representative icon.
5. WHEN the user hovers over a ToolCard, THE ToolCard SHALL display a visual hover state with smooth transition.
6. THE HomePage SHALL display a platform title and a brief tagline above the tool grid.

### Requirement 3: 工具注册表

**User Story:** As a developer, I want a centralized tool registry, so that adding new tools requires minimal code changes.

#### Acceptance Criteria

1. THE ToolRegistry SHALL maintain a list of tool metadata objects containing: id, name, description, icon, and route path.
2. THE ToolRegistry SHALL include an entry for AIChatTool with route `/chat`.
3. THE ToolRegistry SHALL include an entry for ImageGenTool with route `/image`.
4. THE ToolRegistry SHALL export a typed array accessible to both the HomePage and Router configuration.

### Requirement 4: 工具页面全屏布局

**User Story:** As a user, I want each tool to occupy the full screen when I'm using it, so that I have maximum workspace without distractions.

#### Acceptance Criteria

1. WHEN the user enters a ToolPage, THE ToolPage SHALL occupy the full viewport height and width.
2. THE ToolPage SHALL provide a navigation element to return to the HomePage.
3. WHEN the user clicks the back-to-home navigation element, THE Platform SHALL navigate to the HomePage.
4. THE ToolPage SHALL not display the HomePage header or tool grid while active.

### Requirement 5: 现代深色主题 UI 设计

**User Story:** As a user, I want a clean, modern dark-themed interface, so that the platform feels professional and visually comfortable.

#### Acceptance Criteria

1. THE Platform SHALL use a dark color scheme as the default theme.
2. THE Platform SHALL apply subtle gradient accents for visual depth on key UI elements.
3. THE Platform SHALL use consistent spacing, border-radius, and typography scale across all pages.
4. THE HomePage SHALL use a centered layout with appropriate max-width constraint.
5. THE ToolCard SHALL use a glass-morphism or subtle elevated card style with border and background blur.
6. THE Platform SHALL apply smooth transitions (150ms to 300ms duration) for all interactive state changes.
7. THE Platform SHALL use an SVG icon set (not emoji) for all tool and UI icons.

### Requirement 6: 响应式布局

**User Story:** As a user, I want the platform to work well on different screen sizes, so that I can access tools from any device.

#### Acceptance Criteria

1. THE HomePage tool grid SHALL adapt column count based on viewport width: 1 column below 640px, 2 columns between 640px and 1024px, 3 or more columns above 1024px.
2. THE ToolPage SHALL adapt its internal layout to the available viewport width.
3. THE Platform SHALL not produce horizontal scrollbar at any viewport width from 375px to 1920px.

### Requirement 7: Cloudflare Pages 部署兼容

**User Story:** As a developer, I want the application to deploy correctly on Cloudflare Pages, so that all routes work without a backend server.

#### Acceptance Criteria

1. THE Platform SHALL function as a pure client-side single-page application with no server-side rendering dependency.
2. THE Platform SHALL include SPA fallback configuration so that direct URL access to any route serves the `index.html` file.
3. THE Platform SHALL use Vite as the build tool with output compatible with Cloudflare Pages static hosting.

### Requirement 8: 现有功能保留

**User Story:** As a user, I want all existing AI chat and image generation features to continue working after the redesign, so that I don't lose any functionality.

#### Acceptance Criteria

1. THE AIChatTool SHALL retain all existing chat functionality including multi-provider support (OpenAI, Anthropic, Gemini), session management, and message streaming.
2. THE ImageGenTool SHALL retain all existing image generation functionality including provider selection (DALL-E, Imagen, Flux), model fetching, and generation history.
3. THE Platform SHALL preserve all existing Zustand stores (configStore, sessionStore, imageHistoryStore, multiModelStore, toastStore) and their persisted data.
4. WHEN the user accesses the AIChatTool after migration, THE AIChatTool SHALL load previously saved sessions from local storage.
5. WHEN the user accesses the ImageGenTool after migration, THE ImageGenTool SHALL load previously saved generation history from local storage.
