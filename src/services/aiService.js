// ─── AI Service — Multi-Provider + Tool Calling ───────────────────────────
// Flow: AI minta data yang dibutuhkan via tools → sistem fetch → AI jawab
// Tidak dump semua data sekaligus. Data selalu akurat, tidak ngaco.

export const AI_PROVIDERS = {
  openai: {
    label: "OpenAI", icon: "🤖", badge: "",
    models: [
      { id: "gpt-4o",        label: "GPT-4o",       note: "Terbaik" },
      { id: "gpt-4o-mini",   label: "GPT-4o Mini",  note: "Hemat ✨" },
      { id: "gpt-3.5-turbo", label: "GPT-3.5 Turbo",note: "Ekonomis" },
    ],
    docsUrl: "https://platform.openai.com/api-keys", docsLabel: "platform.openai.com",
    keyHint: "sk-proj-...", supportsTools: true,
  },
  anthropic: {
    label: "Anthropic", icon: "🧠", badge: "",
    models: [
      { id: "claude-opus-4-5",              label: "Claude Opus 4.5",   note: "Terbaru" },
      { id: "claude-sonnet-4-5",            label: "Claude Sonnet 4.5", note: "Seimbang ✨" },
      { id: "claude-3-5-haiku-20241022",    label: "Claude 3.5 Haiku",  note: "Cepat & hemat" },
    ],
    docsUrl: "https://console.anthropic.com/keys", docsLabel: "console.anthropic.com",
    keyHint: "sk-ant-...", supportsTools: true,
  },
  google: {
    label: "Google Gemini", icon: "✨", badge: "",
    models: [
      { id: "gemini-2.0-flash",  label: "Gemini 2.0 Flash", note: "Terbaru & cepat" },
      { id: "gemini-1.5-pro",    label: "Gemini 1.5 Pro",   note: "Powerful" },
      { id: "gemini-1.5-flash",  label: "Gemini 1.5 Flash", note: "Hemat ✨" },
    ],
    docsUrl: "https://aistudio.google.com/app/apikey", docsLabel: "aistudio.google.com",
    keyHint: "AIzaSy...", supportsTools: true,
  },
  groq: {
    label: "Groq", icon: "⚡", badge: "GRATIS",
    models: [
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B",  note: "Terbaik ✨" },
      { id: "llama-3.1-8b-instant",    label: "Llama 3.1 8B",   note: "Ultra cepat" },
      { id: "mixtral-8x7b-32768",      label: "Mixtral 8x7B",   note: "Context panjang" },
      { id: "gemma2-9b-it",            label: "Gemma 2 9B",     note: "Google open" },
    ],
    docsUrl: "https://console.groq.com/keys", docsLabel: "console.groq.com",
    keyHint: "gsk_...", supportsTools: true,
    baseUrl: "https://api.groq.com/openai/v1",
  },
  mistral: {
    label: "Mistral AI", icon: "🌪️", badge: "",
    models: [
      { id: "mistral-large-latest", label: "Mistral Large", note: "Terbaik" },
      { id: "mistral-small-latest", label: "Mistral Small", note: "Hemat ✨" },
      { id: "open-mistral-nemo",    label: "Mistral Nemo",  note: "Gratis tier" },
    ],
    docsUrl: "https://console.mistral.ai/api-keys/", docsLabel: "console.mistral.ai",
    keyHint: "...", supportsTools: true,
    baseUrl: "https://api.mistral.ai/v1",
  },
  xai: {
    label: "xAI (Grok)", icon: "𝕏", badge: "",
    models: [
      { id: "grok-3",           label: "Grok 3",           note: "Terbaik" },
      { id: "grok-3-fast",      label: "Grok 3 Fast",      note: "Cepat ✨" },
      { id: "grok-3-mini",      label: "Grok 3 Mini",      note: "Hemat" },
      { id: "grok-3-mini-fast", label: "Grok 3 Mini Fast", note: "Ultra hemat" },
    ],
    docsUrl: "https://console.x.ai/", docsLabel: "console.x.ai",
    keyHint: "xai-...", supportsTools: true,
    baseUrl: "https://api.x.ai/v1",
  },
  deepseek: {
    label: "DeepSeek", icon: "🐋", badge: "MURAH",
    models: [
      { id: "deepseek-chat",     label: "DeepSeek V3", note: "Terbaik ✨" },
      { id: "deepseek-reasoner", label: "DeepSeek R1", note: "Reasoning" },
    ],
    docsUrl: "https://platform.deepseek.com/api_keys", docsLabel: "platform.deepseek.com",
    keyHint: "sk-...", supportsTools: true,
    baseUrl: "https://api.deepseek.com/v1",
  },
  kimi: {
    label: "Kimi (Moonshot)", icon: "🌙", badge: "",
    models: [
      { id: "moonshot-v1-8k",   label: "Moonshot 8K",   note: "Hemat" },
      { id: "moonshot-v1-32k",  label: "Moonshot 32K",  note: "Context panjang ✨" },
      { id: "moonshot-v1-128k", label: "Moonshot 128K", note: "Sangat panjang" },
    ],
    docsUrl: "https://platform.moonshot.cn/console/api-keys", docsLabel: "platform.moonshot.cn",
    keyHint: "sk-...", supportsTools: false, // Kimi tidak support tool calling via browser (CORS)
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

// ─────────────────────────────────────────────────────────────────────────────
// TOOL DEFINITIONS — Fungsi yang bisa dipanggil AI
// ─────────────────────────────────────────────────────────────────────────────
const TOOL_DEFS = [
  {
    name: "get_transactions",
    description: "Ambil transaksi berdasarkan rentang tanggal dan filter opsional. Gunakan ini saat user tanya tentang pengeluaran/pemasukan hari tertentu, minggu, atau bulan.",
    parameters: {
      type: "object",
      properties: {
        start_date: { type: "string", description: "Tanggal mulai format YYYY-MM-DD" },
        end_date:   { type: "string", description: "Tanggal akhir format YYYY-MM-DD" },
        type:       { type: "string", enum: ["income","expense","transfer","all"], description: "Filter tipe transaksi, default all" },
        category:   { type: "string", description: "Filter kategori tertentu (opsional)" },
      },
      required: ["start_date","end_date"],
    },
  },
  {
    name: "get_summary",
    description: "Ambil ringkasan keuangan (total pemasukan, pengeluaran, saving rate, top kategori) untuk periode tertentu.",
    parameters: {
      type: "object",
      properties: {
        period: {
          type: "string",
          enum: ["today","yesterday","this_week","last_week","this_month","last_month","this_year"],
          description: "Periode yang ingin diringkas",
        },
      },
      required: ["period"],
    },
  },
  {
    name: "get_accounts",
    description: "Ambil semua akun (bank, e-wallet, cash, tabungan, dll) beserta saldo terkini.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_debts",
    description: "Ambil semua hutang dan cicilan beserta sisa tagihan dan jatuh tempo.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_goals",
    description: "Ambil semua target finansial (goals) beserta progress tabungan.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_investments",
    description: "Ambil semua aset investasi (emas, saham, reksa dana, crypto, dll) beserta nilai sekarang.",
    parameters: { type: "object", properties: {} },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// TOOL EXECUTOR — Jalankan tool call dengan data lokal
// ─────────────────────────────────────────────────────────────────────────────
function executeTool(name, args, data) {
  const { accounts = [], transactions = [], goals = [], debts = [], investments = [], recurrings = [] } = data;
  const fmtRp = n => `Rp ${Number(n || 0).toLocaleString("id-ID")}`;
  const now = new Date();

  const getPeriodDates = (period) => {
    const today = new Date(); today.setHours(0,0,0,0);
    const todayStr = today.toISOString().slice(0,10);
    switch (period) {
      case "today":
        return { start: todayStr, end: todayStr };
      case "yesterday": {
        const y = new Date(today); y.setDate(y.getDate() - 1);
        const ys = y.toISOString().slice(0,10); return { start: ys, end: ys };
      }
      case "this_week": {
        const w = new Date(today); w.setDate(w.getDate() - 6);
        return { start: w.toISOString().slice(0,10), end: todayStr };
      }
      case "last_week": {
        const le = new Date(today); le.setDate(le.getDate() - 7);
        const ls = new Date(today); ls.setDate(ls.getDate() - 13);
        return { start: ls.toISOString().slice(0,10), end: le.toISOString().slice(0,10) };
      }
      case "this_month": {
        const ms = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start: ms.toISOString().slice(0,10), end: todayStr };
      }
      case "last_month": {
        const lms = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lme = new Date(now.getFullYear(), now.getMonth(), 0);
        return { start: lms.toISOString().slice(0,10), end: lme.toISOString().slice(0,10) };
      }
      case "this_year": {
        return { start: `${now.getFullYear()}-01-01`, end: todayStr };
      }
      default:
        return { start: todayStr, end: todayStr };
    }
  };

  if (name === "get_transactions") {
    const { start_date, end_date, type = "all", category } = args;
    let filtered = transactions.filter(tx => tx.date >= start_date && tx.date <= end_date);
    if (type !== "all") filtered = filtered.filter(tx => tx.type === type);
    if (category) filtered = filtered.filter(tx => tx.category?.toLowerCase().includes(category.toLowerCase()));
    filtered.sort((a,b) => new Date(b.date) - new Date(a.date));
    if (!filtered.length) return `Tidak ada transaksi dari ${start_date} sampai ${end_date}${type !== "all" ? ` (tipe: ${type})` : ""}${category ? ` (kategori: ${category})` : ""}.`;
    const rows = filtered.map(t =>
      `${t.date} | ${t.type === "income" ? "Pemasukan" : t.type === "transfer" ? "Transfer" : "Pengeluaran"} | ${fmtRp(t.amount)} | ${t.category} | ${t.note || "-"} | ${t.account_name}`
    ).join("\n");
    return `Transaksi ${start_date} s/d ${end_date} (${filtered.length} item):\n${rows}`;
  }

  if (name === "get_summary") {
    const { start, end } = getPeriodDates(args.period);
    const filtered = transactions.filter(tx => tx.date >= start && tx.date <= end);
    const income  = filtered.filter(t => t.type === "income").reduce((a,t) => a + t.amount, 0);
    const expense = filtered.filter(t => t.type === "expense").reduce((a,t) => a + t.amount, 0);
    const saving  = income - expense;
    const rate    = income > 0 ? Math.round((saving / income) * 100) : 0;
    const cats    = Object.entries(
      filtered.filter(t => t.type === "expense").reduce((a,t) => { a[t.category] = (a[t.category]||0) + t.amount; return a; }, {})
    ).sort((a,b) => b[1]-a[1]).slice(0,10).map(([c,v]) => `  ${c}: ${fmtRp(v)}`).join("\n");
    return `Ringkasan ${args.period} (${start} s/d ${end}):
Pemasukan : ${fmtRp(income)}
Pengeluaran: ${fmtRp(expense)}
Sisa/Nabung: ${fmtRp(saving)}
Saving rate: ${rate}%
Jumlah transaksi: ${filtered.length}
Top pengeluaran:
${cats || "  (tidak ada pengeluaran)"}`;
  }

  if (name === "get_accounts") {
    const total = accounts.reduce((a,acc) => a + acc.balance, 0);
    const rows = accounts.map(a => `  ${a.icon||"💳"} ${a.name} (${a.type}): ${fmtRp(a.balance)}`).join("\n");
    return `Akun keuangan (total saldo: ${fmtRp(total)}):\n${rows || "  (belum ada akun)"}`;
  }

  if (name === "get_debts") {
    if (!debts.length) return "Tidak ada hutang yang tercatat.";
    const total = debts.reduce((a,d) => a + d.remaining, 0);
    const rows = debts.map(d =>
      `  ${d.icon||"📋"} ${d.name}: sisa ${fmtRp(d.remaining)} dari ${fmtRp(d.total)} | cicilan ${fmtRp(d.monthly)}/bln | jatuh tempo: ${d.due_date}`
    ).join("\n");
    return `Hutang & cicilan (total sisa: ${fmtRp(total)}):\n${rows}`;
  }

  if (name === "get_goals") {
    if (!goals.length) return "Belum ada target finansial yang dibuat.";
    const rows = goals.map(g => {
      const pct = g.target > 0 ? Math.round((g.current/g.target)*100) : 0;
      return `  ${g.icon||"🎯"} ${g.name}: ${fmtRp(g.current)} / ${fmtRp(g.target)} (${pct}%)`;
    }).join("\n");
    return `Target finansial (${goals.length} goal):\n${rows}`;
  }

  if (name === "get_investments") {
    if (!investments.length) return "Belum ada aset investasi yang tercatat.";
    const totalModal = investments.reduce((a,i) => a + i.buy_price, 0);
    const totalNilai = investments.reduce((a,i) => a + i.current_value, 0);
    const rows = investments.map(i => {
      const gain = i.current_value - i.buy_price;
      const pct  = i.buy_price > 0 ? ((gain/i.buy_price)*100).toFixed(1) : 0;
      return `  ${i.icon||"📊"} ${i.name} (${i.type}${i.brand ? ` · ${i.brand}` : ""}): modal ${fmtRp(i.buy_price)}, nilai ${fmtRp(i.current_value)}, ${gain >= 0 ? "+" : ""}${fmtRp(gain)} (${pct}%)${i.quantity ? ` | ${i.quantity} ${i.unit||""}` : ""}`;
    }).join("\n");
    return `Investasi & Aset (${investments.length} aset):\nTotal modal: ${fmtRp(totalModal)} | Total nilai: ${fmtRp(totalNilai)}\n${rows}`;
  }

  return `Tool "${name}" tidak dikenal.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT — Minimal (untuk provider yang support tool calling)
// ─────────────────────────────────────────────────────────────────────────────
export function buildSystemPrompt(userName) {
  const today = new Date().toLocaleDateString("id-ID", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
  return `Kamu adalah Karaya AI, asisten keuangan pribadi untuk ${userName}. Hari ini: ${today}.

ATURAN PENTING:
1. SELALU gunakan tools untuk mengambil data sebelum menjawab pertanyaan tentang keuangan.
2. JANGAN mengarang atau menebak angka. Jika tidak tahu, panggil tool yang relevan.
3. Jawab dalam Bahasa Indonesia, ramah, singkat dan langsung ke intinya.
4. Gunakan angka nyata dari hasil tool, bukan estimasi.
5. Jika pertanyaan tidak butuh data (misal: tips umum), jawab langsung tanpa tool.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ENRICHED SYSTEM PROMPT — Embed semua data langsung (fallback tanpa tools)
// ─────────────────────────────────────────────────────────────────────────────
function buildEnrichedSystemPrompt(userName, financialData) {
  const { accounts = [], transactions = [], goals = [], debts = [], investments = [], recurrings = [] } = financialData || {};
  const today = new Date();
  const todayStr = today.toISOString().slice(0,10);
  const todayLabel = today.toLocaleDateString("id-ID", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
  const fmtRp = n => `Rp ${Number(n||0).toLocaleString("id-ID")}`;

  // Hitung periode
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0,10);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth()-1, 1).toISOString().slice(0,10);
  const lastMonthEnd   = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().slice(0,10);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate()-1);
  const yesterdayStr = yesterday.toISOString().slice(0,10);
  const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate()-6);
  const weekAgoStr = weekAgo.toISOString().slice(0,10);

  const txMonth    = transactions.filter(t => t.date >= thisMonthStart && t.date <= todayStr);
  const txLastMonth= transactions.filter(t => t.date >= lastMonthStart && t.date <= lastMonthEnd);
  const txToday    = transactions.filter(t => t.date === todayStr);
  const txYesterday= transactions.filter(t => t.date === yesterdayStr);
  const txWeek     = transactions.filter(t => t.date >= weekAgoStr && t.date <= todayStr);

  const sumTx = (list, type) => list.filter(t => t.type === type).reduce((a,t) => a+t.amount, 0);
  const fmtTxList = (list) => list.length
    ? list.map(t => `  ${t.date} | ${t.type==="income"?"Masuk":t.type==="transfer"?"Transfer":"Keluar"} | ${fmtRp(t.amount)} | ${t.category} | ${t.note||"-"}`).join("\n")
    : "  (tidak ada)";

  const topCats = (list) => {
    const cats = Object.entries(list.filter(t=>t.type==="expense").reduce((a,t)=>{a[t.category]=(a[t.category]||0)+t.amount;return a;},{}))
      .sort((a,b)=>b[1]-a[1]).slice(0,8);
    return cats.length ? cats.map(([c,v])=>`  ${c}: ${fmtRp(v)}`).join("\n") : "  (tidak ada)";
  };

  const sections = [];

  // Akun
  const totalSaldo = accounts.reduce((a,acc)=>a+acc.balance,0);
  sections.push(`## AKUN (total: ${fmtRp(totalSaldo)})
${accounts.map(a=>`  ${a.icon||"💳"} ${a.name} (${a.type}): ${fmtRp(a.balance)}`).join("\n")||"  (belum ada)"}`);

  // Bulan ini
  sections.push(`## BULAN INI (${thisMonthStart} s/d ${todayStr})
Pemasukan : ${fmtRp(sumTx(txMonth,"income"))}
Pengeluaran: ${fmtRp(sumTx(txMonth,"expense"))}
Saving rate: ${sumTx(txMonth,"income")>0?Math.round(((sumTx(txMonth,"income")-sumTx(txMonth,"expense"))/sumTx(txMonth,"income"))*100):0}%
Top pengeluaran:
${topCats(txMonth)}`);

  // Bulan lalu
  sections.push(`## BULAN LALU (${lastMonthStart} s/d ${lastMonthEnd})
Pemasukan : ${fmtRp(sumTx(txLastMonth,"income"))}
Pengeluaran: ${fmtRp(sumTx(txLastMonth,"expense"))}`);

  // Hari ini & kemarin
  sections.push(`## HARI INI (${todayStr})
${fmtTxList(txToday)}

## KEMARIN (${yesterdayStr})
${fmtTxList(txYesterday)}

## 7 HARI TERAKHIR (${weekAgoStr} s/d ${todayStr})
Pengeluaran: ${fmtRp(sumTx(txWeek,"expense"))} | Pemasukan: ${fmtRp(sumTx(txWeek,"income"))}
${fmtTxList(txWeek)}`);

  // Hutang
  if (debts.length) {
    const totalHutang = debts.reduce((a,d)=>a+d.remaining,0);
    sections.push(`## HUTANG & CICILAN (total sisa: ${fmtRp(totalHutang)})
${debts.map(d=>`  ${d.name}: sisa ${fmtRp(d.remaining)} dari ${fmtRp(d.total)} | cicilan ${fmtRp(d.monthly)}/bln`).join("\n")}`);
  }

  // Goals
  if (goals.length) {
    sections.push(`## TARGET FINANSIAL
${goals.map(g=>{const pct=g.target>0?Math.round((g.current/g.target)*100):0;return `  ${g.icon||"🎯"} ${g.name}: ${fmtRp(g.current)} / ${fmtRp(g.target)} (${pct}%)`;}).join("\n")}`);
  }

  // Investasi
  if (investments.length) {
    const totalModal = investments.reduce((a,i)=>a+i.buy_price,0);
    const totalNilai = investments.reduce((a,i)=>a+i.current_value,0);
    sections.push(`## INVESTASI & ASET
Total modal: ${fmtRp(totalModal)} | Total nilai: ${fmtRp(totalNilai)}
${investments.map(i=>{const g=i.current_value-i.buy_price;return `  ${i.name} (${i.type}): modal ${fmtRp(i.buy_price)}, nilai ${fmtRp(i.current_value)}, ${g>=0?"+":""}${fmtRp(g)}`;}).join("\n")}`);
  }

  return `Kamu adalah Karaya AI, asisten keuangan pribadi untuk ${userName}. Hari ini: ${todayLabel}.

ATURAN: Jawab dalam Bahasa Indonesia, gunakan HANYA data di bawah ini, jangan mengarang angka.
Jika data tidak ada, katakan jujur belum ada data yang tercatat.

${sections.join("\n\n")}`;
}

// Provider yang tool calling-nya tidak reliable (Llama di Groq)
const UNRELIABLE_TOOLS_MODELS = ["llama-3.3-70b-versatile","llama-3.1-8b-instant","llama3-70b-8192","llama3-8b-8192","gemma2-9b-it","mixtral-8x7b-32768"];
function isToolsUnreliable(provider, model) {
  if (provider === "groq") return true; // Semua Groq Llama/Mixtral sering gagal tool calling
  return UNRELIABLE_TOOLS_MODELS.includes(model);
}

// Deteksi apakah response adalah kegagalan tool calling
function isToolCallFailure(content) {
  if (!content || typeof content !== "string") return false;
  return content.includes("failed_generation") || content.includes("Failed to call a function") || content.includes("tool call failed");
}

// ─────────────────────────────────────────────────────────────────────────────
// API CALLERS
// ─────────────────────────────────────────────────────────────────────────────

// OpenAI-compatible (OpenAI, Groq, Mistral, xAI, DeepSeek, Kimi)
async function* streamOpenAICompatible({ apiKey, model, messages, systemPrompt, baseUrl = "https://api.openai.com/v1", tools }) {
  const body = {
    model,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    temperature: 0.3,
    max_tokens: 1024,
    ...(tools?.length ? { tools: tools.map(t => ({ type:"function", function: t })), tool_choice: "auto" } : {}),
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
  yield data.choices[0].message;
}

// Anthropic
async function* streamAnthropic({ apiKey, model, messages, systemPrompt, tools }) {
  const anthropicTools = tools?.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));
  const body = {
    model,
    system: systemPrompt,
    messages,
    max_tokens: 1024,
    ...(anthropicTools?.length ? { tools: anthropicTools } : {}),
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
  yield { _anthropic: true, content: data.content, stop_reason: data.stop_reason };
}

// Google Gemini
async function* streamGoogle({ apiKey, model, messages, systemPrompt, tools }) {
  const contents = messages.map(m => ({
    role: m.role === "assistant" ? "model" : m.role,
    parts: Array.isArray(m.content)
      ? m.content.map(c => c.type === "tool_result" ? { text: String(c.content) } : { text: c })
      : [{ text: String(m.content || "") }],
  }));
  const googleTools = tools?.length ? [{
    function_declarations: tools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }))
  }] : [];
  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
    ...(googleTools.length ? { tools: googleTools } : {}),
  };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini error ${res.status}`);
  }
  const data = await res.json();
  yield { _google: true, candidates: data.candidates };
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENTIC LOOP — AI ↔ Tools, max 6 iterasi
// Jika provider/model tidak reliable untuk tool calling → langsung pakai enriched prompt
// ─────────────────────────────────────────────────────────────────────────────
export async function sendAiMessage({ aiConfig, messages, systemPrompt, financialData, onThinking, userName = "Kamu" }) {
  const { provider, model, apiKey } = aiConfig;
  if (!apiKey) throw new Error("API key belum diatur. Buka Settings → AI Coach.");

  const prov = AI_PROVIDERS[provider];
  const provSupportsTools = prov?.supportsTools !== false;

  // Provider/model yang tool calling-nya tidak reliable → skip tools, pakai enriched prompt
  const useEnrichedFallback = !provSupportsTools || isToolsUnreliable(provider, model);
  const activeSystemPrompt = useEnrichedFallback && financialData
    ? buildEnrichedSystemPrompt(userName, financialData)
    : systemPrompt;
  const tools = useEnrichedFallback ? [] : (provSupportsTools ? TOOL_DEFS : []);

  // Convert chat history ke format API
  const apiMessages = messages
    .filter(m => m.role !== "thinking") // strip thinking bubbles
    .map(m => ({
      role: m.role === "ai" ? "assistant" : m.role === "error" ? "assistant" : "user",
      content: m.text,
    }));

  const MAX_ITER = 6;

  // ── Anthropic ──
  if (provider === "anthropic") {
    let anthropicMsgs = [...apiMessages];
    for (let i = 0; i < MAX_ITER; i++) {
      const gen = streamAnthropic({ apiKey, model, messages: anthropicMsgs, systemPrompt: activeSystemPrompt, tools });
      const { value: resp } = await gen.next();
      const { content, stop_reason } = resp;

      if (stop_reason === "tool_use") {
        const assistantBlock = { role: "assistant", content };
        anthropicMsgs.push(assistantBlock);
        const toolResults = [];
        for (const block of content) {
          if (block.type === "tool_use") {
            onThinking?.(`🔍 Mengambil data: ${block.name}...`);
            const result = executeTool(block.name, block.input || {}, financialData);
            toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
          }
        }
        anthropicMsgs.push({ role: "user", content: toolResults });
        continue;
      }
      const textBlock = content.find(b => b.type === "text");
      return textBlock?.text || "(Tidak ada jawaban)";
    }
    return "Maaf, terlalu banyak iterasi. Coba tanya lebih spesifik.";
  }

  // ── Google Gemini ──
  if (provider === "google") {
    let googleMsgs = [...apiMessages];
    for (let i = 0; i < MAX_ITER; i++) {
      const gen = streamGoogle({ apiKey, model, messages: googleMsgs, systemPrompt: activeSystemPrompt, tools });
      const { value: resp } = await gen.next();
      const candidate = resp.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      const fnCalls = parts.filter(p => p.functionCall);
      if (fnCalls.length) {
        googleMsgs.push({ role: "model", parts });
        const fnResponses = [];
        for (const p of fnCalls) {
          onThinking?.(`🔍 Mengambil data: ${p.functionCall.name}...`);
          const result = executeTool(p.functionCall.name, p.functionCall.args || {}, financialData);
          fnResponses.push({ functionResponse: { name: p.functionCall.name, response: { result } } });
        }
        googleMsgs.push({ role: "user", parts: fnResponses });
        continue;
      }
      return parts.map(p => p.text).join("") || "(Tidak ada jawaban)";
    }
    return "Maaf, terlalu banyak iterasi. Coba tanya lebih spesifik.";
  }

  // ── OpenAI-compatible (OpenAI, Groq, Mistral, xAI, DeepSeek, Kimi) ──
  const baseUrl = prov?.baseUrl || "https://api.openai.com/v1";
  let oaiMsgs = [...apiMessages];
  let activeTools = tools;
  let activePrompt = activeSystemPrompt;

  for (let i = 0; i < MAX_ITER; i++) {
    const gen = streamOpenAICompatible({ apiKey, model, messages: oaiMsgs, systemPrompt: activePrompt, baseUrl, tools: activeTools });
    const { value: msg } = await gen.next();

    // Deteksi kegagalan tool calling → fallback ke enriched prompt tanpa tools
    if (isToolCallFailure(msg.content) && activeTools.length > 0 && financialData) {
      onThinking?.("⚡ Beralih ke mode langsung...");
      activeTools = [];
      activePrompt = buildEnrichedSystemPrompt(userName, financialData);
      oaiMsgs = [...apiMessages]; // reset conversation
      continue;
    }

    // Tool calls sukses
    if (msg.tool_calls?.length) {
      oaiMsgs.push({ role: "assistant", content: msg.content || null, tool_calls: msg.tool_calls });
      for (const tc of msg.tool_calls) {
        onThinking?.(`🔍 Mengambil data: ${tc.function.name}...`);
        let args = {};
        try { args = JSON.parse(tc.function.arguments || "{}"); } catch (_) {}
        const result = executeTool(tc.function.name, args, financialData);
        oaiMsgs.push({ role: "tool", tool_call_id: tc.id, content: result });
      }
      continue;
    }

    return msg.content || "(Tidak ada jawaban)";
  }

  return "Maaf, terlalu banyak iterasi. Coba tanya lebih spesifik.";
}

// Legacy export agar tidak break import lama
export function buildFinanceSystemPrompt({ userName }) {
  return buildSystemPrompt(userName);
}
