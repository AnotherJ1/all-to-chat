# AI Chat Hub

> A modern multi-protocol AI chat interface with support for OpenAI, Anthropic, and Google Gemini.

[English](./README.md) | [中文](./README_zh.md)

## Features

- **Multi-Protocol Support** — OpenAI, Anthropic, Gemini with automatic URL suffix completion
- **Dynamic Model Selection** — Fetch model lists directly from your API provider
- **Configuration Management** — Save, load, and switch between multiple API configurations by protocol
- **Session Management** — Create, rename, and manage multiple chat sessions
- **System Prompt** — Customize AI behavior with per-protocol system prompts
- **Image Generation** — Generate images via DALL-E, Imagen, or Flux (when provider supports)
- **Multi-Model Comparison** — Compare responses from multiple models side by side
- **Aurora UI** — Gradient mesh backgrounds with glassmorphism effects
- **Theme Toggle** — Dark and light mode support
- **Persistent Storage** — Configurations and sessions saved to localStorage

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Configuration

1. Click the **Settings** button (⚙️) in the header
2. Select your **Protocol** (OpenAI / Anthropic / Gemini)
3. Enter your **Base URL** and **API Key**
4. (Optional) Enter or fetch your preferred **Model**
5. Click **Save Configuration** to persist for later use

### URL Auto-Completion

The app automatically appends the correct path suffix based on protocol:

| Protocol | Suffix |
|----------|--------|
| OpenAI | `/v1/chat/completions` |
| Anthropic | `/v1/messages` |
| Gemini | Uses query parameters |

### Saving Configurations

You can save multiple named configurations per protocol:

1. Fill in your API details
2. Click **+ Save Current Configuration**
3. Enter a name (e.g., "Work API", "Personal Key")
4. Switch to the **Saved Configurations** tab to load or delete saved configs

## Project Structure

```
src/
├── api/               # API clients (openai, anthropic, gemini)
├── components/        # React components
│   ├── Header.tsx         # Header with settings panel
│   ├── Sidebar.tsx        # Session list sidebar
│   ├── ChatView.tsx       # Main chat area
│   ├── ChatMessage.tsx     # Message bubble
│   ├── MessageInput.tsx   # Input area with streaming
│   ├── SystemPromptInput.tsx
│   ├── ImageGenerator.tsx
│   ├── ComparisonPanel.tsx
│   └── ...
├── stores/            # Zustand state management
│   ├── configStore.ts     # API configs & protocol settings
│   ├── sessionStore.ts    # Chat sessions
│   └── ...
├── types/             # TypeScript types
├── App.tsx
└── main.tsx
```

## Tech Stack

- **React 18** + TypeScript
- **Vite** — Fast build tool
- **Tailwind CSS** — Utility-first styling
- **Zustand** — Lightweight state management with persist middleware
- **React Markdown** — Markdown rendering in chat

## Development

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Lint
npm run lint

# Preview production build
npm run preview
```

## Supported API Providers

- OpenAI-compatible APIs (Azure OpenAI, local models, etc.)
- Anthropic APIs
- Google Gemini APIs
- NewAPI-compatible proxy services

> **Note:** Some API providers may block cross-origin requests from browsers. If you encounter CORS errors, consider using a backend proxy.

## License

MIT
