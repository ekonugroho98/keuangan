import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../api/client";

/**
 * GET /v1/me/settings tidak pernah mengembalikan ai_config.apiKey asli (hanya has_api_key boolean)
 * karena key dibaca server-side saja sejak Fase 4 (dulu disimpan & dipakai langsung di browser).
 * Supaya Sidebar.jsx (yang mengecek `aiConfig?.apiKey` untuk status "sudah diatur") tidak perlu
 * diubah, kita isi field apiKey dengan sentinel placeholder saat key memang sudah ada di server.
 * saveAiConfig() mengenali sentinel ini dan TIDAK mengirim ulang api_key kalau user tidak
 * mengubahnya — mencegah placeholder tertimpa jadi "key" yang salah.
 */
export const AI_KEY_SENTINEL = "••••••••••••";

export function useSettings() {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ["settings"],
        queryFn: async () => unwrap(await api.GET("/v1/me/settings")),
    });

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["settings"] });

    const userSettings = query.data
        ? { ...query.data, ai_config: { ...query.data.ai_config, apiKey: query.data.ai_config?.has_api_key ? AI_KEY_SENTINEL : "" } }
        : null;
    const aiConfig = userSettings?.ai_config ?? null;

    const saveSettings = async (patch) => {
        await unwrap(await api.PATCH("/v1/me/settings", { body: patch }));
        invalidate();
    };

    const saveAiConfig = async (cfg) => {
        const ai_config = { provider: cfg.provider, model: cfg.model, disabled: cfg.disabled };
        if (cfg.apiKey !== AI_KEY_SENTINEL) ai_config.api_key = cfg.apiKey;
        await unwrap(await api.PATCH("/v1/me/settings", { body: { ai_config } }));
        invalidate();
    };

    return { userSettings, aiConfig, settingsLoading: query.isLoading, saveSettings, saveAiConfig };
}
