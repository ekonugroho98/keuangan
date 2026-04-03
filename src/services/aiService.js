// ─── AI Service — Multi-Provider ──────────────────────────────────────────
// Mendukung: OpenAI, Anthropic, Google Gemini, Groq, Mistral, xAI, DeepSeek, Kimi
// Semua via fetch langsung — tidak perlu library tambahan

export const AI_PROVIDERS = {
  openai: {
    label: "OpenAI",
    icon: "🤖",
    badge: "",
    models: [
      { id: "gpt-4o",            label: "GPT-4o",               note: "Terbaik, mahal" },
      { id: "gpt-4o-mini",       label: "GPT-4o Mini",          note: "Cepat & hemat ✨" },
      { id: "gpt-3.5-turbo",     label: "GPT-3.5 Turbo",        note: "Ekonomis" },
    ],
    docsUrl:  "https://platform.openai.com/api-keys",
    docsLabel: "platform.openai.com",
    keyPrefix: "sk-",
    keyHint:  "sk-proj-...",
  },
  anthropic: {
    label: "Anthropic",
    icon: "🧠",
    badge: "",
    models: [
      { id: "claude-opus-4-5",       label: "Claude Opus 4.5",          note: "Terbaru" },
      { id: "claude-sonnet-4-5",     label: "Claude Sonnet 4.5",        note: "Seimbang ✨" },
      { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku",     note: "Cepat & hemat" },
    ],
    docsUrl:  "https://console.anthropic.com/keys",
    docsLabel: "console.anthropic.com",
    keyPrefix: "sk-ant-",
    keyHint:  "sk-ant-...",
  },
  google: {
    label: "Google Gemini",
    icon: "✨",
    badge: "",
    models: [
      { id: "gemini-2.0-flash",       label: "Gemini 2.0 Flash",        note: "Terbaru & cepat" },
      { id: "gemini-1.5-pro",         label: "Gemini 1.5 Pro",          note: "Powerful" },
      { id: "gemini-1.5-flash",       label: "Gemini 1.5 Flash",        note: "Hemat ✨" },
    ],
    docsUrl:  "https://aistudio.google.com/app/apikey",
    docsLabel: "aistudio.google.com",
    keyPrefix: "AIza",
    keyHint:  "AIzaSy...",
  },
  groq: {
    label: "Groq",
    icon: "⚡",
    badge: "GRATIS",
    models: [
      { id: "llama-3.3-70b-versatile",   label: "Llama 3.3 70B",        note: "Terbaik ✨" },
      { id: "llama-3.1-8b-instant",      label: "Llama 3.1 8B",         note: "Ultra cepat" },
      { id: "mixtral-8x7b-32768",        label: "Mixtral 8x7B",         note: "Context panjang" },
      { id: "gemma2-9b-it",              label: "Gemma 2 9B",           note: "Google open" },
    ],
    docsUrl:  "https://console.groq.com/keys",
    docsLabel: "console.groq.com",
    keyPrefix: "gsk_",
    keyHint:  "gsk_...",
  },
  mistral: {
    label: "Mistral AI",
    icon: "🌪️",
    badge: "",
    models: [
      { id: "mistral-large-latest",   label: "Mistral Large",           note: "Terbaik" },
      { id: "mistral-small-latest",   label: "Mistral Small",           note: "Hemat ✨" },
      { id: "open-mistral-nemo",      label: "Mistral Nemo",            note: "Gratis tier" },
    ],
    docsUrl:  "https://console.mistral.ai/api-keys/",
    docsLabel: "console.mistral.ai",
    keyPrefix: "",
    keyHint:  "...",
  },
  xai: {
    label: "xAI (Grok)",
    icon: "𝕏",
    badge: "",
    models: [
      { id: "grok-3",            label: "Grok 3",            note: "Terbaik" },
      { id: "grok-3-fast",       label: "Grok 3 Fast",       note: "Cepat ✨" },
      { id: "grok-3-mini",       label: "Grok 3 Mini",       note: "Hemat" },
      { id: "grok-3-mini-fast",  label: "Grok 3 Mini Fast",  note: "Ultra hemat" },
    ],
    docsUrl:  "https://console.x.ai/",
    docsLabel: "console.x.ai",
    keyPrefix: "xai-",
    keyHint:  "xai-...",
  },
  deepseek: {
    label: "DeepSeek",
    icon: "🐋",
    badge: "MURAH",
    models: [
      { id: "deepseek-chat",     label: "DeepSeek V3",       note: "Terbaik ✨" },
      { id: "deepseek-reasoner", label: "DeepSeek R1",       note: "Reasoning model" },
    ],
    docsUrl:  "https://platform.deepseek.com/api_keys",
    docsLabel: "platform.deepseek.com",
    keyPrefix: "sk-",
    keyHint:  "sk-...",
  },
  kimi: {
    label: "Kimi (Moonshot)",
    icon: "🌙",
    badge: "",
    models: [
      { id: "moonshot-v1-8k",    label: "Moonshot v1 8K",    note: "Hemat" },
      { id: "moonshot-v1-32k",   label: "Moonshot v1 32K",   note: "Context panjang ✨" },
      { id: "moonshot-v1-128k",  label: "Moonshot v1 128K",  note: "Sangat panjang" },
    ],
    docsUrl:  "https://platform.moonshot.cn/console/api-keys",
    docsLabel: "platform.moonshot.cn",
    keyPrefix: "sk-",
    keyHint:  "sk-...",
  },
};

export const PROVIDER_ORDER = ["groq", "deepseek", "openai", "anthropic", "google", "mistral", "xai", "kimi"];

// ── Default model per provider ──
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

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

async function callOpenAI({ apiKey, model, messages, systemPrompt }) {
  const body = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map(m => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text })),
    ],
    temperature: 0.7,
    max_tokens: 800,
  };
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI error ${res.status}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

async function callAnthropic({ apiKey, model, messages, systemPrompt }) {
  const body = {
    model,
    system: systemPrompt,
    messages: messages.map(m => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text })),
    max_tokens: 800,
  };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-allow-browser": "true",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Anthropic error ${res.status}`);
  }
  const data = await res.json();
  return data.content[0].text;
}

async function callGoogle({ apiKey, model, messages, systemPrompt }) {
  const contents = messages.map(m => ({
    role: m.role === "ai" ? "model" : "user",
    parts: [{ text: m.text }],
  }));
  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: { temperature: 0.7, maxOutputTokens: 800 },
  };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini error ${res.status}`);
  }
  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
}

async function callOpenAICompatible({ apiKey, model, messages, systemPrompt, baseUrl }) {
  const body = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map(m => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text })),
    ],
    temperature: 0.7,
    max_tokens: 800,
  };
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${res.status}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kirim pesan ke AI provider yang dipilih user.
 * @param {object} aiConfig  - { provider, model, apiKey }
 * @param {Array}  messages  - [ { role: "user"|"ai", text: "..." }, ... ]
 * @param {string} systemPrompt
 * @returns {Promise<string>} - reply text
 */
export async function sendAiMessage({ aiConfig, messages, systemPrompt }) {
  const { provider, model, apiKey } = aiConfig;

  if (!apiKey) throw new Error("API key belum diatur. Atur di Settings → AI Coach.");

  switch (provider) {
    case "openai":
      return callOpenAI({ apiKey, model, messages, systemPrompt });
    case "anthropic":
      return callAnthropic({ apiKey, model, messages, systemPrompt });
    case "google":
      return callGoogle({ apiKey, model, messages, systemPrompt });
    case "groq":
      return callOpenAICompatible({ apiKey, model, messages, systemPrompt, baseUrl: "https://api.groq.com/openai/v1" });
    case "mistral":
      return callOpenAICompatible({ apiKey, model, messages, systemPrompt, baseUrl: "https://api.mistral.ai/v1" });
    case "xai":
      return callOpenAICompatible({ apiKey, model, messages, systemPrompt, baseUrl: "https://api.x.ai/v1" });
    case "deepseek":
      return callOpenAICompatible({ apiKey, model, messages, systemPrompt, baseUrl: "https://api.deepseek.com/v1" });
    case "kimi":
      return callOpenAICompatible({ apiKey, model, messages, systemPrompt, baseUrl: "https://api.moonshot.cn/v1" });
    default:
      throw new Error(`Provider tidak dikenal: ${provider}`);
  }
}

/**
 * Buat system prompt berdasarkan data keuangan user.
 */
export function buildFinanceSystemPrompt({ userName, accounts, transactions, goals, debts, investments }) {
  const totalBalance = accounts.reduce((a, acc) => a + acc.balance, 0);
  const now = new Date();
  const thisMonth = transactions.filter(tx => {
    const d = new Date(tx.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const income  = thisMonth.filter(t => t.type === "income").reduce((a, t) => a + t.amount, 0);
  const expense = thisMonth.filter(t => t.type === "expense").reduce((a, t) => a + t.amount, 0);
  const savingRate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;

  const topCats = Object.entries(
    thisMonth.filter(t => t.type === "expense").reduce((a, t) => {
      a[t.category] = (a[t.category] || 0) + t.amount; return a;
    }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const totalDebt = debts.reduce((a, d) => a + d.remaining, 0);
  const totalInvest = investments.reduce((a, i) => a + i.current_value, 0);

  return `Kamu adalah Karaya AI, asisten keuangan pribadi yang ramah, cerdas, dan berbahasa Indonesia.
Bantu user bernama ${userName} menganalisis keuangan mereka. Jawab singkat, padat, dan actionable (max 3-4 kalimat kecuali diminta detail).

DATA KEUANGAN USER (real-time):
- Total saldo semua rekening: Rp ${totalBalance.toLocaleString("id-ID")}
- Bulan ini: Pemasukan Rp ${income.toLocaleString("id-ID")} | Pengeluaran Rp ${expense.toLocaleString("id-ID")} | Saving rate ${savingRate}%
- Top pengeluaran: ${topCats.map(([c, v]) => `${c} Rp ${v.toLocaleString("id-ID")}`).join(", ") || "belum ada data"}
- Total hutang: Rp ${totalDebt.toLocaleString("id-ID")} (${debts.length} cicilan)
- Total investasi: Rp ${totalInvest.toLocaleString("id-ID")} (${investments.length} aset)
- Target finansial: ${goals.length} goal aktif

Berikan saran yang personal, spesifik, dan motivatif. Gunakan angka nyata dari data di atas.`;
}
