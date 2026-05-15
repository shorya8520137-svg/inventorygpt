/**
 * Optional live context from Giftgala InventoryGPT HTTP data feed.
 * Configure with INVENTORYGPT_DATA_FEED_TOKEN (igpt_...) and optionally
 * INVENTORYGPT_DATA_FEED_BASE_URL (default https://api.giftgala.in).
 */

const DEFAULT_BASE = 'https://api.giftgala.in';
const TIMEOUT_MS = 20000;

function isEnabled() {
    return Boolean(process.env.INVENTORYGPT_DATA_FEED_TOKEN?.trim());
}

function summarizeEndpoint(result) {
    if (!result) return null;
    if (result.networkError) {
        return { ok: false, error: result.networkError };
    }
    const { ok, status, body } = result;
    if (ok) return { ok: true, status, data: body };
    const msg = body && (body.error || body.message)
        ? String(body.error || body.message)
        : 'request failed';
    return { ok: false, status, error: msg };
}

async function fetchEndpoint(baseUrl, token, path) {
    const url = `${baseUrl.replace(/\/$/, '')}${path}`;
    try {
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        const text = await res.text();
        let body;
        try {
            body = JSON.parse(text);
        } catch {
            body = { parseError: true, raw: text.slice(0, 500) };
        }
        return { ok: res.ok, status: res.status, body };
    } catch (e) {
        return { networkError: e.message };
    }
}

/**
 * @returns {Promise<null | object>} Compact feed snapshot for LLM context, or null if disabled.
 */
async function fetchFeedSnapshotForAgents() {
    const token = process.env.INVENTORYGPT_DATA_FEED_TOKEN?.trim();
    if (!token) return null;

    const baseUrl = (process.env.INVENTORYGPT_DATA_FEED_BASE_URL || DEFAULT_BASE).trim();

    const [health, inventoryState, warehouseMetrics, regionalDemand] = await Promise.all([
        fetchEndpoint(baseUrl, token, '/api/inventorygpt'),
        fetchEndpoint(baseUrl, token, '/api/inventorygpt/inventory-state'),
        fetchEndpoint(baseUrl, token, '/api/inventorygpt/warehouse-metrics'),
        fetchEndpoint(baseUrl, token, '/api/inventorygpt/regional-demand'),
    ]);

    return {
        source: 'inventorygpt_data_feed',
        base_url: baseUrl,
        fetched_at: new Date().toISOString(),
        health: summarizeEndpoint(health),
        inventory_state: summarizeEndpoint(inventoryState),
        warehouse_metrics: summarizeEndpoint(warehouseMetrics),
        regional_demand: summarizeEndpoint(regionalDemand),
    };
}

/**
 * Merges live feed into context when enabled. No-op if feed disabled.
 * @param {object} contextData
 * @returns {Promise<object>}
 */
async function attachDataFeedToContext(contextData) {
    if (!isEnabled()) return contextData;
    try {
        const snapshot = await fetchFeedSnapshotForAgents();
        if (snapshot) {
            contextData.external_inventory_feed = snapshot;
        }
    } catch (e) {
        console.warn('[inventorygpt-data-feed] attach failed:', e.message);
    }
    return contextData;
}

module.exports = {
    isEnabled,
    attachDataFeedToContext,
    fetchFeedSnapshotForAgents,
};
