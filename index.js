import { extension_settings, getContext } from '../../../extensions.js';

const MODULE_NAME = 'opencode-usage-badge';
const SETTINGS_KEY = 'opencodeUsageBadge';
const DEFAULT_SETTINGS = {
    enabled: true,
    showListPrice: true,
    costDisplay: 'both',
    showSummary: true,
    summaryPlacement: 'top-left',
    showCacheTimer: true,
    cacheTtlMinutes: 5,
    smartCacheTtl: true,
};

const PENDING_TTL_MS = 30000;
const MAX_PENDING = 20;
const pendingUsages = [];
let fetchHookInstalled = false;

const LOCALE_ALIASES = {
    en: 'en.json',
    'en-us': 'en.json',
    'en-gb': 'en.json',
    ru: 'ru.json',
    'ru-ru': 'ru.json',
    es: 'es.json',
    'es-es': 'es.json',
    'es-mx': 'es.json',
    fr: 'fr.json',
    'fr-fr': 'fr.json',
    de: 'de.json',
    'de-de': 'de.json',
    pt: 'pt-br.json',
    'pt-br': 'pt-br.json',
    'pt-pt': 'pt-br.json',
    it: 'it.json',
    'it-it': 'it.json',
    pl: 'pl.json',
    'pl-pl': 'pl.json',
    tr: 'tr.json',
    'tr-tr': 'tr.json',
    zh: 'zh-cn.json',
    'zh-cn': 'zh-cn.json',
    'zh-tw': 'zh-cn.json',
    ja: 'ja.json',
    'ja-jp': 'ja.json',
};

let localeData = {};
let fallbackLocaleData = {};

async function loadLocaleFile(file) {
    const response = await fetch(new URL(`./locales/${file}`, import.meta.url));
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
}

async function loadLocale() {
    const code = String(getContext().getCurrentLocale?.() || 'en').toLowerCase();
    const file = LOCALE_ALIASES[code] || LOCALE_ALIASES[code.split('-')[0]] || 'en.json';

    try {
        fallbackLocaleData = await loadLocaleFile('en.json');
    } catch (error) {
        console.debug(`[${MODULE_NAME}] Could not load English locale:`, error);
    }

    if (file === 'en.json') {
        localeData = fallbackLocaleData;
        return;
    }

    try {
        localeData = await loadLocaleFile(file);
    } catch (error) {
        console.debug(`[${MODULE_NAME}] Could not load locale ${file}:`, error);
        localeData = fallbackLocaleData;
    }
}

function tr(key, vars = {}) {
    const template = localeData[key] ?? fallbackLocaleData[key] ?? key;
    return String(template).replace(/\{(\w+)\}/g, (_, name) => {
        return vars[name] !== undefined ? String(vars[name]) : `{${name}}`;
    });
}

function getSettings() {
    if (!extension_settings[SETTINGS_KEY] || typeof extension_settings[SETTINGS_KEY] !== 'object') {
        extension_settings[SETTINGS_KEY] = { ...DEFAULT_SETTINGS };
    }
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
        if (!(key in extension_settings[SETTINGS_KEY])) {
            extension_settings[SETTINGS_KEY][key] = value;
        }
    }
    return extension_settings[SETTINGS_KEY];
}

function getCtx() {
    return getContext();
}

function numberOrNull(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function formatMoney(value) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
        return '—';
    }
    const number = Number(value);
    if (number === 0) return '$0';
    const absolute = Math.abs(number);
    if (absolute < 0.000001) return `$${number.toExponential(2)}`;
    if (absolute < 0.001) return `$${number.toFixed(6)}`;
    if (absolute < 0.01) return `$${number.toFixed(5)}`;
    if (absolute < 0.1) return `$${number.toFixed(4)}`;
    if (absolute < 1) return `$${number.toFixed(3)}`;
    return `$${number.toFixed(2)}`;
}

function rememberUsage(usage) {
    if (!usage || typeof usage !== 'object') return;
    pendingUsages.push({ usage, at: Date.now() });
    while (pendingUsages.length > MAX_PENDING) {
        pendingUsages.shift();
    }
}

function takeUsage() {
    const now = Date.now();
    while (pendingUsages.length && now - pendingUsages[0].at > PENDING_TTL_MS) {
        pendingUsages.shift();
    }
    return pendingUsages.shift()?.usage ?? null;
}

function peekUsage() {
    const now = Date.now();
    while (pendingUsages.length && now - pendingUsages[0].at > PENDING_TTL_MS) {
        pendingUsages.shift();
    }
    return pendingUsages[0]?.usage ?? null;
}

function parseRequestType(init) {
    try {
        if (typeof init?.body === 'string') {
            return JSON.parse(init.body)?.type ?? null;
        }
    } catch {
        // Ignore malformed request bodies.
    }
    return null;
}

async function captureUsage(response) {
    try {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('text/event-stream')) {
            const text = await response.text();
            for (const line of text.split(/\r?\n/)) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data:')) continue;
                const payload = trimmed.slice(5).trim();
                if (!payload || payload === '[DONE]') continue;
                try {
                    const parsed = JSON.parse(payload);
                    if (parsed?.usage) rememberUsage(parsed.usage);
                } catch {
                    // Ignore non-JSON SSE lines.
                }
            }
        } else {
            const data = await response.json();
            if (data?.usage) rememberUsage(data.usage);
        }
    } catch (error) {
        console.debug(`[${MODULE_NAME}] Failed to capture usage:`, error);
    }
}

function installFetchHook() {
    if (fetchHookInstalled || window.fetch?.__opencodeUsageWrapped) return;

    const originalFetch = window.fetch.bind(window);
    const wrappedFetch = async function (input, init) {
        const response = await originalFetch(input, init);
        try {
            const url = typeof input === 'string' ? input : (input?.url || '');
            if (url.includes('/api/backends/chat-completions/generate')) {
                const requestType = parseRequestType(init);
                if (requestType !== 'quiet' && requestType !== 'dry_run') {
                    captureUsage(response.clone());
                }
            }
        } catch (error) {
            console.debug(`[${MODULE_NAME}] Fetch hook error:`, error);
        }
        return response;
    };

    wrappedFetch.__opencodeUsageWrapped = true;
    window.fetch = wrappedFetch;
    fetchHookInstalled = true;
}

function getUsageForMessage(message) {
    if (!message) return null;
    const swipeId = Number.isInteger(message.swipe_id) ? message.swipe_id : 0;
    const swipeInfo = Array.isArray(message.swipe_info) ? message.swipe_info[swipeId] : null;
    if (swipeInfo) {
        return swipeInfo.extra?.opencode_usage
            || swipeInfo.extra?.api_usage
            || null;
    }
    return message.extra?.opencode_usage
        || message.extra?.opencode_usage_by_swipe?.[swipeId]
        || message.extra?.api_usage
        || null;
}

function buildBadgeData(usage) {
    const prompt = numberOrNull(usage.prompt_tokens ?? usage.input_tokens);
    const cached = numberOrNull(
        usage.prompt_tokens_details?.cached_tokens
        ?? usage.cache_read_input_tokens
        ?? usage.prompt_cache_hit_tokens
        ?? usage.opencode?.tokens?.cache_read,
    );
    const output = numberOrNull(usage.completion_tokens ?? usage.output_tokens);
    const reasoning = numberOrNull(
        usage.completion_tokens_details?.reasoning_tokens
        ?? usage.opencode?.tokens?.reasoning,
    );
    const opencode = usage.opencode && typeof usage.opencode === 'object' ? usage.opencode : {};
    const billingSource = String(opencode.billing_source ?? '');
    const cost = numberOrNull(usage.cost ?? usage.cost_details?.upstream_inference_cost);
    const listCost = numberOrNull(opencode.list_cost ?? opencode.listCost);
    const allowance = numberOrNull(opencode.allowance);

    const hasGo = billingSource === 'go' && allowance !== null;
    const hasList = listCost !== null;
    const hasCost = cost !== null;

    const mode = getSettings().costDisplay || 'auto';
    let primary = null;
    let primaryLabel = 'Cost';
    let secondary = null;
    let secondaryLabel = null;

    if (mode === 'both') {
        if (hasGo) {
            primary = allowance;
            primaryLabel = 'Go allowance';
            secondary = hasList ? listCost : (hasCost ? cost : null);
            secondaryLabel = hasList ? 'List price' : (hasCost ? 'Cost' : null);
        } else if (hasCost) {
            primary = cost;
            primaryLabel = 'Cost';
            secondary = hasList ? listCost : null;
            secondaryLabel = hasList ? 'List price' : null;
        } else if (hasList) {
            primary = listCost;
            primaryLabel = 'List price';
        } else {
            primary = 0;
            primaryLabel = 'Cost';
        }
    } else if (mode === 'go') {
        if (hasGo) {
            primary = allowance;
            primaryLabel = 'Go allowance';
        } else if (hasList) {
            primary = listCost;
            primaryLabel = 'List price';
        } else if (hasCost) {
            primary = cost;
            primaryLabel = 'Cost';
        } else {
            primary = 0;
            primaryLabel = 'Cost';
        }
    } else if (mode === 'list') {
        if (hasList) {
            primary = listCost;
            primaryLabel = 'List price';
        } else if (hasCost) {
            primary = cost;
            primaryLabel = 'Cost';
        } else if (hasGo) {
            primary = allowance;
            primaryLabel = 'Go allowance';
        } else {
            primary = 0;
            primaryLabel = 'Cost';
        }
    } else if (hasGo) {
        primary = allowance;
        primaryLabel = 'Go allowance';
    } else if (hasCost && cost > 0) {
        primary = cost;
        primaryLabel = 'Cost';
    } else if (hasList) {
        primary = listCost;
        primaryLabel = 'List price';
    } else if (hasCost) {
        primary = cost;
        primaryLabel = 'Cost';
    } else {
        primary = 0;
        primaryLabel = 'Cost';
    }

    const cacheRate = prompt !== null && prompt > 0 && cached !== null
        ? cached / prompt
        : null;

    return {
        prompt,
        cached,
        output,
        reasoning,
        billingSource,
        cost,
        allowance,
        primary,
        primaryLabel,
        secondary,
        secondaryLabel,
        listCost,
        cacheRate,
    };
}

function buildTooltip(data) {
    const lines = [];
    lines.push(data.billingSource === 'go' ? 'OpenCode Go' : tr('tooltip_api_usage'));

    if (data.cacheRate !== null) {
        lines.push(tr('tooltip_cache', {
            cached: data.cached,
            prompt: data.prompt,
            percent: Math.round(data.cacheRate * 100),
        }));
    }
    if (data.prompt !== null) {
        const uncached = Math.max(0, data.prompt - (data.cached ?? 0));
        lines.push(tr('tooltip_input', { uncached, cached: data.cached ?? 0 }));
    }
    if (data.output !== null) {
        lines.push(data.reasoning
            ? tr('tooltip_output_reasoning', { output: data.output, reasoning: data.reasoning })
            : tr('tooltip_output', { output: data.output }));
    }
    if (data.allowance !== null) {
        let ratio = null;
        if (data.listCost !== null && data.listCost > 0) {
            const value = data.allowance / data.listCost;
            if (Math.abs(value - 1) > 0.01) {
                ratio = value.toFixed(2);
            }
        }
        lines.push(ratio
            ? tr('tooltip_go_allowance_ratio', { cost: formatMoney(data.allowance), ratio })
            : tr('tooltip_go_allowance', { cost: formatMoney(data.allowance) }));
    }
    if (data.cost !== null && data.billingSource !== 'go') {
        lines.push(tr('tooltip_cost', { cost: formatMoney(data.cost) }));
    }
    if (getSettings().showListPrice && data.listCost !== null
        && (data.cost === null || data.billingSource === 'go' || Math.abs(data.listCost - data.cost) > 1e-12)) {
        lines.push(tr('tooltip_list', { cost: formatMoney(data.listCost) }));
    }

    return lines.join('\n');
}

function removeBadge(container) {
    container?.querySelectorAll(':scope > .opencode-usage-badge').forEach(element => element.remove());
}

function formatBadgeCost(data) {
    if (!data || data.primary === null || data.primary === undefined) return '';
    let text = data.billingSource === 'go' && data.primaryLabel === 'Go allowance'
        ? `Go ${formatMoney(data.primary)}`
        : formatMoney(data.primary);
    if (data.secondary !== null && data.secondary !== undefined) {
        text += ` / ${formatMoney(data.secondary)}`;
    }
    return text;
}

function renderBadge(index) {
    const context = getCtx();
    const message = context.chat?.[index];
    if (!message || message.is_user) return;

    const messageElement = document.querySelector(`.mes[mesid="${index}"]`);
    if (!messageElement) return;

    const block = messageElement.querySelector('.mes_block');
    if (!block) return;

    removeBadge(block);

    if (!getSettings().enabled) return;

    const usage = getUsageForMessage(message);
    if (!usage) return;

    const data = buildBadgeData(usage);
    if (data.cacheRate === null && data.primary === null) return;

    const badge = document.createElement('div');
    badge.className = 'opencode-usage-badge';
    badge.title = message.extra?.model
        ? `${message.extra.model}\n${buildTooltip(data)}`
        : buildTooltip(data);

    const cache = document.createElement('span');
    cache.className = 'oc-cache';
    cache.textContent = data.cacheRate === null
        ? '⚡ —'
        : `⚡ ${Math.round(data.cacheRate * 100)}%`;
    badge.appendChild(cache);

    const costText = formatBadgeCost(data);
    if (costText) {
        const cost = document.createElement('span');
        cost.className = 'oc-cost';
        cost.textContent = ` · ${costText}`;
        badge.appendChild(cost);
    }

    const text = block.querySelector('.mes_text');
    if (text) {
        text.insertAdjacentElement('afterend', badge);
    } else {
        block.appendChild(badge);
    }
}

function renderAll() {
    const chat = getCtx().chat ?? [];
    for (let index = 0; index < chat.length; index++) {
        renderBadge(index);
    }
    updateSummary();
}

function scheduleRenderAll(delay = 200) {
    setTimeout(renderAll, delay);
}

function summarizeChat() {
    const chat = getCtx().chat ?? [];
    const summary = {
        generations: 0,
        prompt: 0,
        cached: 0,
        output: 0,
        go: 0,
        list: 0,
        cost: 0,
        cacheRate: null,
        lastData: null,
    };

    const addUsage = usage => {
        const data = buildBadgeData(usage);
        if (data.cacheRate !== null) {
            summary.prompt += data.prompt ?? 0;
            summary.cached += data.cached ?? 0;
        }
        summary.output += data.output ?? 0;
        if (data.allowance !== null) summary.go += data.allowance;
        if (data.listCost !== null) summary.list += data.listCost;
        if (data.cost !== null) summary.cost += data.cost;
        summary.generations += 1;
        summary.lastData = data;
    };

    for (const message of chat) {
        if (!message || message.is_user) continue;
        let added = false;
        if (Array.isArray(message.swipe_info) && message.swipe_info.length > 0) {
            for (const swipe of message.swipe_info) {
                if (swipe?.extra?.opencode_usage) {
                    addUsage(swipe.extra.opencode_usage);
                    added = true;
                }
            }
        }
        if (!added && message.extra?.opencode_usage) {
            addUsage(message.extra.opencode_usage);
        }
    }

    summary.cacheRate = summary.prompt > 0 ? summary.cached / summary.prompt : null;
    const lastMessage = chat.at(-1);
    const lastUsage = lastMessage ? getUsageForMessage(lastMessage) : null;
    summary.lastData = lastUsage ? buildBadgeData(lastUsage) : null;
    return summary;
}

function formatClock(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getUsageTimestamp(usage, message, swipe = null) {
    const finished = swipe?.gen_finished
        ?? swipe?.send_date
        ?? message?.gen_finished
        ?? message?.send_date;
    const parsed = typeof finished === 'number' ? finished : Date.parse(String(finished || ''));
    return Number(usage?._at) || (Number.isFinite(parsed) ? parsed : 0);
}

function getObservedUsages() {
    const chat = getCtx().chat ?? [];
    const observations = [];

    for (const message of chat) {
        if (!message) continue;
        const usages = [];
        if (Array.isArray(message.swipe_info) && message.swipe_info.length > 0) {
            for (const swipe of message.swipe_info) {
                if (swipe?.extra?.opencode_usage) {
                    usages.push({ usage: swipe.extra.opencode_usage, swipe });
                }
            }
        } else if (message.extra?.opencode_usage) {
            usages.push({ usage: message.extra.opencode_usage, swipe: null });
        }

        for (const { usage, swipe } of usages) {
            const at = getUsageTimestamp(usage, message, swipe);
            if (!at) continue;

            const cached = numberOrNull(
                usage.prompt_tokens_details?.cached_tokens
                ?? usage.opencode?.tokens?.cache_read,
            );
            observations.push({
                at,
                cached: cached ?? 0,
                prompt: numberOrNull(usage.prompt_tokens),
                model: String(message.extra?.model || ''),
            });
        }
    }

    observations.sort((a, b) => a.at - b.at);
    return observations.slice(-80);
}

function estimateSmartTtl() {
    const observations = getObservedUsages();
    const manualTtl = Math.max(1, Number(getSettings().cacheTtlMinutes) || 5) * 60000;

    if (!observations.length) {
        return { ttl: manualTtl, smart: false, lower: null, upper: null, observations: 0 };
    }

    const lastModel = observations[observations.length - 1].model;
    const filtered = lastModel
        ? observations.filter(observation => !observation.model || observation.model === lastModel)
        : observations;

    let lower = null;
    let upper = null;
    let lowerCount = 0;
    let upperCount = 0;
    let lastHit = null;

    for (const observation of filtered) {
        if (observation.cached > 0) {
            if (lastHit) {
                const gap = observation.at - lastHit.at;
                if (gap > 1000) {
                    lower = Math.max(lower ?? 0, gap);
                    lowerCount += 1;
                }
            }
            lastHit = observation;
        } else if (lastHit) {
            const gap = observation.at - lastHit.at;
            const promptOk = observation.prompt === null
                || lastHit.prompt === null
                || observation.prompt >= lastHit.prompt - 100;
            if (gap >= 30000 && gap <= 24 * 60 * 60 * 1000 && promptOk) {
                upper = Math.min(upper ?? Infinity, gap);
                upperCount += 1;
            }
            lastHit = null;
        }
    }

    let ttl = manualTtl;
    let smart = false;

    if (lower !== null && upper !== null) {
        const midpoint = (lower + upper) / 2;
        ttl = Math.max(lower + 15000, Math.min(upper - 15000, midpoint));
        smart = true;
    } else if (upper !== null) {
        ttl = Math.min(manualTtl, upper - 15000);
        smart = true;
    } else if (lower !== null) {
        ttl = Math.max(manualTtl, lower);
        smart = true;
    }

    ttl = Math.max(60000, Math.min(ttl, 24 * 60 * 60 * 1000));
    return {
        ttl,
        smart,
        lower,
        upper,
        lowerCount,
        upperCount,
        observations: filtered.length,
    };
}

function getCacheTimer() {
    const chat = getCtx().chat ?? [];
    let latest = null;

    for (const message of chat) {
        if (!message) continue;
        const usages = [];
        if (Array.isArray(message.swipe_info) && message.swipe_info.length > 0) {
            for (const swipe of message.swipe_info) {
                if (swipe?.extra?.opencode_usage) {
                    usages.push({ usage: swipe.extra.opencode_usage, swipe });
                }
            }
        } else if (message.extra?.opencode_usage) {
            usages.push({ usage: message.extra.opencode_usage, swipe: null });
        }

        for (const { usage, swipe } of usages) {
            const cached = numberOrNull(
                usage.prompt_tokens_details?.cached_tokens
                ?? usage.opencode?.tokens?.cache_read,
            );
            if (!cached || cached <= 0) continue;

            const at = getUsageTimestamp(usage, message, swipe);
            if (!at) continue;

            if (!latest || at > latest.at) {
                latest = { at, usage };
            }
        }
    }

    if (!latest) return null;

    const estimate = getSettings().smartCacheTtl
        ? estimateSmartTtl()
        : {
            ttl: Math.max(1, Number(getSettings().cacheTtlMinutes) || 5) * 60000,
            smart: false,
            observations: 0,
        };
    const ttlMs = estimate.ttl;
    const age = Date.now() - latest.at;
    return {
        at: latest.at,
        age,
        ttlMs,
        remaining: ttlMs - age,
        lastUsage: latest.usage,
        smart: estimate.smart,
        estimate,
    };
}

function formatCacheTimer() {
    if (!getSettings().showCacheTimer) return '';
    const timer = getCacheTimer();
    if (!timer) return tr('cache_timer_cold');
    if (timer.remaining <= 0) return tr('cache_timer_expired');
    return timer.smart
        ? tr('cache_timer_remaining_estimate', { time: formatClock(timer.remaining) })
        : tr('cache_timer_remaining', { time: formatClock(timer.remaining) });
}

function formatCacheTimerTooltip() {
    if (!getSettings().showCacheTimer) return '';
    const timer = getCacheTimer();
    if (!timer) return tr('cache_timer_tooltip_none');
    if (timer.smart) {
        return tr('cache_timer_tooltip_smart', {
            age: formatClock(timer.age),
            ttl: formatClock(timer.ttlMs),
            count: timer.estimate?.observations ?? 0,
        });
    }
    return tr('cache_timer_tooltip', {
        age: formatClock(timer.age),
        ttl: Math.round(timer.ttlMs / 60000),
    });
}

function formatSummary() {
    const summary = summarizeChat();
    if (summary.generations === 0) return tr('summary_no_usage');

    const parts = [];
    if (summary.go > 0) parts.push(tr('summary_go', { cost: formatMoney(summary.go) }));
    if (summary.cost > 0) parts.push(tr('summary_cost', { cost: formatMoney(summary.cost) }));
    if (summary.list > 0 && getSettings().showListPrice && (summary.go > 0 || summary.cost === 0)) {
        parts.push(tr('summary_list', { cost: formatMoney(summary.list) }));
    }
    if (summary.cacheRate !== null) {
        parts.push(tr('summary_cache', { percent: Math.round(summary.cacheRate * 100) }));
    }
    parts.push(tr('summary_gens', { count: summary.generations }));
    if (summary.lastData?.primary !== null && summary.lastData?.primary !== undefined) {
        const label = summary.lastData.primaryLabel === 'Go allowance' ? 'Go ' : '';
        parts.push(tr('summary_last', { cost: `${label}${formatMoney(summary.lastData.primary)}` }));
    }
    return tr('summary_total', { parts: parts.join(' · ') });
}

function formatSummaryCost(summary) {
    const mode = getSettings().costDisplay || 'auto';
    const go = summary.go > 0 ? summary.go : null;
    const cost = summary.cost > 0 ? summary.cost : (summary.cost === 0 && summary.go === 0 ? 0 : null);
    const list = summary.list > 0 ? summary.list : null;

    const pair = (primary, secondary) => secondary !== null
        ? `${primary} / ${formatMoney(secondary)}`
        : primary;

    if (mode === 'both') {
        if (go !== null) return pair(`Go ${formatMoney(go)}`, list);
        if (cost !== null) return pair(formatMoney(cost), list);
        if (list !== null) return formatMoney(list);
    }
    if (mode === 'go') {
        if (go !== null) return `Go ${formatMoney(go)}`;
        if (cost !== null) return formatMoney(cost);
        if (list !== null) return formatMoney(list);
    }
    if (mode === 'list') {
        if (list !== null) return formatMoney(list);
        if (cost !== null) return formatMoney(cost);
        if (go !== null) return `Go ${formatMoney(go)}`;
    }
    if (go !== null) return `Go ${formatMoney(go)}`;
    if (cost !== null) return formatMoney(cost);
    if (list !== null) return formatMoney(list);
    return '';
}

function formatTopBarSummary() {
    const summary = summarizeChat();
    if (summary.generations === 0) return '';

    const parts = [];
    if (summary.cacheRate !== null) {
        parts.push(`⚡ ${Math.round(summary.cacheRate * 100)}%`);
    }
    const total = formatSummaryCost(summary);
    if (total) parts.push(tr('topbar_total', { cost: total }));
    const last = summary.lastData ? formatBadgeCost(summary.lastData) : '';
    if (last) parts.push(tr('topbar_last', { cost: last }));
    const timer = formatCacheTimer();
    if (timer) parts.push(timer);
    return parts.join(' · ');
}

function ensureTopBar() {
    let bar = document.getElementById('opencode_usage_topbar');
    if (bar) return bar;

    const chat = document.getElementById('chat');
    const parent = chat?.parentElement;
    if (!parent) return null;

    bar = document.createElement('div');
    bar.id = 'opencode_usage_topbar';
    bar.className = 'opencode-usage-topbar';
    parent.insertBefore(bar, chat);
    return bar;
}

function updateSummary() {
    const element = document.getElementById('opencode_usage_summary');
    if (element) {
        element.style.display = getSettings().showSummary ? '' : 'none';
        element.textContent = formatSummary();
    }

    const bar = ensureTopBar();
    if (!bar) return;

    const placement = getSettings().summaryPlacement || 'top-left';
    const text = placement === 'off' ? '' : formatTopBarSummary();
    bar.textContent = text;
    bar.title = [formatSummary(), formatCacheTimerTooltip()].filter(Boolean).join('\n');
    bar.style.display = text ? '' : 'none';
    bar.classList.toggle('align-right', placement === 'top-right');
    bar.classList.toggle('align-center', placement === 'top-center');
}

function attachUsage(index, message, usage) {
    if (!message || !usage) return;

    const swipeId = Number.isInteger(message.swipe_id) ? message.swipe_id : 0;
    const storedUsage = { ...usage, _at: Date.now() };
    message.extra = message.extra || {};
    message.extra.opencode_usage = storedUsage;

    if (Array.isArray(message.swipe_info) && message.swipe_info[swipeId]) {
        message.swipe_info[swipeId].extra = message.swipe_info[swipeId].extra || {};
        message.swipe_info[swipeId].extra.opencode_usage = storedUsage;
    }

    if (message.extra.api_usage === undefined) {
        message.extra.api_usage = {
            prompt_tokens: storedUsage.prompt_tokens,
            completion_tokens: storedUsage.completion_tokens,
            total_tokens: storedUsage.total_tokens,
        };
    }

    try {
        getCtx().saveChat();
    } catch (error) {
        console.debug(`[${MODULE_NAME}] Could not save chat:`, error);
    }

    setTimeout(() => renderBadge(index), 50);
    setTimeout(() => renderBadge(index), 500);
    updateSummary();
}

function onMessageReceived(index, type) {
    if (type === 'first_message' || type === 'command' || type === 'quiet') {
        return;
    }

    const message = getCtx().chat?.[index];
    if (!message || message.is_user) return;

    const usage = takeUsage();
    if (!usage) {
        renderBadge(index);
        return;
    }

    attachUsage(index, message, usage);
}

function onCharacterMessageRendered(index) {
    renderBadge(index);
}

function onMessageSwiped(index) {
    renderBadge(index);
    setTimeout(() => renderBadge(index), 100);
    setTimeout(() => {
        renderBadge(index);
        updateSummary();
    }, 500);
}

function onMessageUpdated(index) {
    renderBadge(index);
}

function onChatChanged() {
    scheduleRenderAll(300);
}

function onMoreMessagesLoaded() {
    scheduleRenderAll(100);
}

function onGenerationStopped() {
    const chat = getCtx().chat ?? [];
    const lastIndex = chat.length - 1;
    const lastMessage = chat[lastIndex];
    if (!lastMessage || lastMessage.is_user) return;

    if (!getUsageForMessage(lastMessage)) {
        const usage = peekUsage();
        if (usage) {
            takeUsage();
            attachUsage(lastIndex, lastMessage, usage);
        }
    }

    setTimeout(() => renderBadge(lastIndex), 100);
}

function addSettingsUi(force = false) {
    const container = document.getElementById('extensions_settings');
    const existing = document.getElementById('opencode_usage_settings');
    if (existing && !force) return;
    existing?.remove();
    if (!container) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'opencode_usage_settings';
    wrapper.className = 'opencode-usage-settings';
    wrapper.innerHTML = `
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>${tr('settings_title')}</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <label class="checkbox_label">
                    <input type="checkbox" id="opencode_usage_enabled">
                    <span>${tr('settings_enabled')}</span>
                </label>
                <div class="opencode-usage-setting-row">
                    <span>${tr('settings_badge_cost')}</span>
                    <select id="opencode_usage_cost_display" class="text_pole">
                        <option value="auto">${tr('settings_auto')}</option>
                        <option value="go">${tr('settings_go')}</option>
                        <option value="list">${tr('settings_list')}</option>
                        <option value="both">${tr('settings_both')}</option>
                    </select>
                </div>
                <div class="opencode-usage-setting-row">
                    <span>${tr('settings_placement')}</span>
                    <select id="opencode_usage_placement" class="text_pole">
                        <option value="top-left">${tr('settings_top_left')}</option>
                        <option value="top-right">${tr('settings_top_right')}</option>
                        <option value="top-center">${tr('settings_top_center')}</option>
                        <option value="off">${tr('settings_off')}</option>
                    </select>
                </div>
                <label class="checkbox_label">
                    <input type="checkbox" id="opencode_usage_show_summary">
                    <span>${tr('settings_show_summary')}</span>
                </label>
                <label class="checkbox_label">
                    <input type="checkbox" id="opencode_usage_show_timer">
                    <span>${tr('settings_show_cache_timer')}</span>
                </label>
                <div class="opencode-usage-setting-row">
                    <span>${tr('settings_cache_ttl')}</span>
                    <input type="number" id="opencode_usage_cache_ttl" class="text_pole" min="1" max="1440" step="1">
                </div>
                <small>${tr('settings_cache_ttl_hint')}</small>
                <label class="checkbox_label">
                    <input type="checkbox" id="opencode_usage_smart_ttl">
                    <span>${tr('settings_smart_cache_ttl')}</span>
                </label>
                <small>${tr('settings_smart_cache_ttl_hint')}</small>
                <label class="checkbox_label">
                    <input type="checkbox" id="opencode_usage_list_price">
                    <span>${tr('settings_show_list')}</span>
                </label>
                <div id="opencode_usage_summary" class="opencode-usage-summary">${tr('summary_no_usage')}</div>
                <small>${tr('settings_hint')}</small>
            </div>
        </div>`;
    container.appendChild(wrapper);

    const enabled = wrapper.querySelector('#opencode_usage_enabled');
    const listPrice = wrapper.querySelector('#opencode_usage_list_price');
    const costDisplay = wrapper.querySelector('#opencode_usage_cost_display');
    const showSummary = wrapper.querySelector('#opencode_usage_show_summary');
    const placement = wrapper.querySelector('#opencode_usage_placement');
    const showTimer = wrapper.querySelector('#opencode_usage_show_timer');
    const cacheTtl = wrapper.querySelector('#opencode_usage_cache_ttl');
    const smartTtl = wrapper.querySelector('#opencode_usage_smart_ttl');
    enabled.checked = getSettings().enabled;
    listPrice.checked = getSettings().showListPrice;
    costDisplay.value = getSettings().costDisplay;
    showSummary.checked = getSettings().showSummary;
    placement.value = getSettings().summaryPlacement;
    showTimer.checked = getSettings().showCacheTimer;
    cacheTtl.value = getSettings().cacheTtlMinutes;
    smartTtl.checked = getSettings().smartCacheTtl;

    enabled.addEventListener('change', () => {
        getSettings().enabled = enabled.checked;
        getCtx().saveSettingsDebounced();
        renderAll();
    });
    listPrice.addEventListener('change', () => {
        getSettings().showListPrice = listPrice.checked;
        getCtx().saveSettingsDebounced();
        renderAll();
    });
    costDisplay.addEventListener('change', () => {
        getSettings().costDisplay = costDisplay.value;
        getCtx().saveSettingsDebounced();
        renderAll();
    });
    showSummary.addEventListener('change', () => {
        getSettings().showSummary = showSummary.checked;
        getCtx().saveSettingsDebounced();
        updateSummary();
    });
    placement.addEventListener('change', () => {
        getSettings().summaryPlacement = placement.value;
        getCtx().saveSettingsDebounced();
        updateSummary();
    });
    showTimer.addEventListener('change', () => {
        getSettings().showCacheTimer = showTimer.checked;
        getCtx().saveSettingsDebounced();
        updateSummary();
    });
    cacheTtl.addEventListener('change', () => {
        const value = Math.min(1440, Math.max(1, parseInt(cacheTtl.value, 10) || 5));
        getSettings().cacheTtlMinutes = value;
        cacheTtl.value = value;
        getCtx().saveSettingsDebounced();
        updateSummary();
    });
    smartTtl.addEventListener('change', () => {
        getSettings().smartCacheTtl = smartTtl.checked;
        getCtx().saveSettingsDebounced();
        updateSummary();
    });

    updateSummary();
}

function registerEvents() {
    const context = getCtx();
    const { eventSource, eventTypes } = context;

    eventSource.on(eventTypes.MESSAGE_RECEIVED, onMessageReceived);
    eventSource.on(eventTypes.CHARACTER_MESSAGE_RENDERED, onCharacterMessageRendered);
    eventSource.on(eventTypes.MESSAGE_SWIPED, onMessageSwiped);
    eventSource.on(eventTypes.MESSAGE_UPDATED, onMessageUpdated);
    eventSource.on(eventTypes.CHAT_CHANGED, onChatChanged);
    eventSource.on(eventTypes.MORE_MESSAGES_LOADED, onMoreMessagesLoaded);
    eventSource.on(eventTypes.GENERATION_STOPPED, onGenerationStopped);
    eventSource.on(eventTypes.APP_READY, () => {
        addSettingsUi(true);
        scheduleRenderAll(500);
    });

    document.addEventListener('click', event => {
        const target = event.target instanceof Element
            ? event.target.closest('.swipe_left, .swipe_right')
            : null;
        if (!target) return;
        const messageElement = target.closest('.mes');
        const index = Number(messageElement?.getAttribute('mesid'));
        if (!Number.isInteger(index)) return;
        setTimeout(() => {
            renderBadge(index);
            updateSummary();
        }, 700);
        setTimeout(() => {
            renderBadge(index);
            updateSummary();
        }, 1400);
    }, true);
}

(async function init() {
    await loadLocale();
    getSettings();
    installFetchHook();
    addSettingsUi(true);
    registerEvents();
    scheduleRenderAll(500);

    setInterval(() => {
        const bar = document.getElementById('opencode_usage_topbar');
        if (!bar || bar.style.display === 'none') return;
        bar.textContent = formatTopBarSummary();
        bar.title = [formatSummary(), formatCacheTimerTooltip()].filter(Boolean).join('\n');
    }, 1000);
})();
