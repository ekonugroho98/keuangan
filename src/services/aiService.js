// ─── AI Service — UI Constants Only ─────────────────────────────
// Heavy logic (tool calling, API proxying, prompt building) moved to
// Supabase Edge Function: ai-chat
// This file only exports provider/model definitions for the Settings UI.

import { APP_AI_NAME } from "../config/app";

export const AI_PROVIDERS = {
  openai: {
    label: "OpenAI", icon: "\u{1F916}", badge: "",
    models: [
      { id: "gpt-4o",        label: "GPT-4o",       note: "Terbaik" },
      { id: "gpt-4o-mini",   label: "GPT-4o Mini",  note: "Hemat" },
      { id: "gpt-3.5-turbo", label: "GPT-3.5 Turbo",note: "Ekonomis" },
    ],
    docsUrl: "https://platform.openai.com/api-keys", docsLabel: "platform.openai.com",
    keyHint: "sk-proj-...", supportsTools: true,
  },
  anthropic: {
    label: "Anthropic", icon: "\u{1F9E0}", badge: "",
    models: [
      { id: "claude-opus-4-5",              label: "Claude Opus 4.5",   note: "Terbaru" },
      { id: "claude-sonnet-4-5",            label: "Claude Sonnet 4.5", note: "Seimbang" },
      { id: "claude-3-5-haiku-20241022",    label: "Claude 3.5 Haiku",  note: "Cepat & hemat" },
    ],
    docsUrl: "https://console.anthropic.com/keys", docsLabel: "console.anthropic.com",
    keyHint: "sk-ant-...", supportsTools: true,
  },
  google: {
    label: "Google Gemini", icon: "\u2728", badge: "",
    models: [
      { id: "gemini-2.0-flash",  label: "Gemini 2.0 Flash", note: "Terbaru & cepat" },
      { id: "gemini-1.5-pro",    label: "Gemini 1.5 Pro",   note: "Powerful" },
      { id: "gemini-1.5-flash",  label: "Gemini 1.5 Flash", note: "Hemat" },
    ],
    docsUrl: "https://aistudio.google.com/app/apikey", docsLabel: "aistudio.google.com",
    keyHint: "AIzaSy...", supportsTools: true,
  },
  groq: {
    label: "Groq", icon: "\u26A1", badge: "GRATIS",
    models: [
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B",  note: "Terbaik" },
      { id: "llama-3.1-8b-instant",    label: "Llama 3.1 8B",   note: "Ultra cepat" },
      { id: "mixtral-8x7b-32768",      label: "Mixtral 8x7B",   note: "Context panjang" },
      { id: "gemma2-9b-it",            label: "Gemma 2 9B",     note: "Google open" },
    ],
    docsUrl: "https://console.groq.com/keys", docsLabel: "console.groq.com",
    keyHint: "gsk_...", supportsTools: true,
    baseUrl: "https://api.groq.com/openai/v1",
  },
  mistral: {
    label: "Mistral AI", icon: "\u{1F32A}\uFE0F", badge: "",
    models: [
      { id: "mistral-large-latest", label: "Mistral Large", note: "Terbaik" },
      { id: "mistral-small-latest", label: "Mistral Small", note: "Hemat" },
      { id: "open-mistral-nemo",    label: "Mistral Nemo",  note: "Gratis tier" },
    ],
    docsUrl: "https://console.mistral.ai/api-keys/", docsLabel: "console.mistral.ai",
    keyHint: "...", supportsTools: true,
    baseUrl: "https://api.mistral.ai/v1",
  },
  xai: {
    label: "xAI (Grok)", icon: "\u{1D54F}", badge: "",
    models: [
      { id: "grok-3",           label: "Grok 3",           note: "Terbaik" },
      { id: "grok-3-fast",      label: "Grok 3 Fast",      note: "Cepat" },
      { id: "grok-3-mini",      label: "Grok 3 Mini",      note: "Hemat" },
      { id: "grok-3-mini-fast", label: "Grok 3 Mini Fast", note: "Ultra hemat" },
    ],
    docsUrl: "https://console.x.ai/", docsLabel: "console.x.ai",
    keyHint: "xai-...", supportsTools: true,
    baseUrl: "https://api.x.ai/v1",
  },
  deepseek: {
    label: "DeepSeek", icon: "\u{1F40B}", badge: "MURAH",
    models: [
      { id: "deepseek-chat",     label: "DeepSeek V3", note: "Terbaik" },
      { id: "deepseek-reasoner", label: "DeepSeek R1", note: "Reasoning" },
    ],
    docsUrl: "https://platform.deepseek.com/api_keys", docsLabel: "platform.deepseek.com",
    keyHint: "sk-...", supportsTools: true,
    baseUrl: "https://api.deepseek.com/v1",
  },
  kimi: {
    label: "Kimi (Moonshot)", icon: "\u{1F319}", badge: "",
    models: [
      { id: "moonshot-v1-8k",   label: "Moonshot 8K",   note: "Hemat" },
      { id: "moonshot-v1-32k",  label: "Moonshot 32K",  note: "Context panjang" },
      { id: "moonshot-v1-128k", label: "Moonshot 128K", note: "Sangat panjang" },
    ],
    docsUrl: "https://platform.moonshot.cn/console/api-keys", docsLabel: "platform.moonshot.cn",
    keyHint: "sk-...", supportsTools: false,
    baseUrl: "https://api.moonshot.cn/v1",
  },
};

export const PROVIDER_ORDER = ["groq", "deepseek", "openai", "anthropic", "google", "mistral", "xai", "kimi"];

export const DEFAULT_MODEL = {
  openai:    "gpt-4o-mini",
  anthropic: "claude-sonnet-4-5",
  google:    "gemini-1.5-flash",
  groq:      "llama-3.3-70b-versatile",
  mistral:   "mistral-small-latest",
  xai:       "grok-3-fast",
  deepseek:  "deepseek-chat",
  kimi:      "moonshot-v1-32k",
};

// Legacy exports for backwards compat (no longer used for AI calls)
export function buildSystemPrompt(userName) {
  return `Kamu adalah ${APP_AI_NAME}, asisten keuangan untuk ${userName}.`;
}

export async function sendAiMessage() {
  throw new Error("AI calls now handled by ai-chat edge function. Use callEdge('ai-chat', { messages }) instead.");
}

export function buildFinanceSystemPrompt({ userName }) {
  return buildSystemPrompt(userName);
}
