import { extension_settings, getContext } from '../../../extensions.js';

const MODULE_NAME = 'opencode-usage-badge';
const SETTINGS_KEY = 'opencodeUsageBadge';
const DEFAULT_SETTINGS = {
    enabled: true,
    showListPrice: true,
    costDisplay: 'auto',
    showSummary: true,
    summaryPlacement: 'top-left',
};

const PENDING_TTL_MS = 30000;
const MAX_PENDING = 20;
const pendingUsages = [];
let fetchHookInstalled = false;

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
            primaryLabel = 'Go limit';
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
            primaryLabel = 'Go limit';
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
            primaryLabel = 'Go limit';
        } else {
            primary = 0;
            primaryLabel = 'Cost';
        }
    } else if (hasGo) {
        primary = allowance;
        primaryLabel = 'Go limit';
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
    lines.push(data.billingSource === 'go' ? 'OpenCode Go' : 'API usage');

    if (data.cacheRate !== null) {
        lines.push(`Cache: ${data.cached} / ${data.prompt} input tokens (${Math.round(data.cacheRate * 100)}%)`);
    }
    if (data.prompt !== null) {
        const uncached = Math.max(0, data.prompt - (data.cached ?? 0));
        lines.push(`Input: ${uncached} new + ${data.cached ?? 0} cached`);
    }
    if (data.output !== null) {
        lines.push(`Output: ${data.output}${data.reasoning ? ` (reasoning ${data.reasoning})` : ''}`);
    }
    if (data.allowance !== null) {
        lines.push(`Go limit: ${formatMoney(data.allowance)}`);
    }
    if (data.cost !== null && data.billingSource !== 'go') {
        lines.push(`Cost: ${formatMoney(data.cost)}`);
    }
    if (getSettings().showListPrice && data.listCost !== null
        && (data.cost === null || data.billingSource === 'go' || Math.abs(data.listCost - data.cost) > 1e-12)) {
        lines.push(`List price: ${formatMoney(data.listCost)}`);
    }

    return lines.join('\n');
}

function removeBadge(container) {
    container?.querySelectorAll(':scope > .opencode-usage-badge').forEach(element => element.remove());
}

function formatBadgeCost(data) {
    if (!data || data.primary === null || data.primary === undefined) return '';
    let text = data.billingSource === 'go' && data.primaryLabel === 'Go limit'
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

function formatSummary() {
    const summary = summarizeChat();
    if (summary.generations === 0) return 'Chat total: no usage yet.';

    const parts = [];
    if (summary.go > 0) parts.push(`Go ${formatMoney(summary.go)}`);
    if (summary.cost > 0) parts.push(`cost ${formatMoney(summary.cost)}`);
    if (summary.list > 0 && getSettings().showListPrice && (summary.go > 0 || summary.cost === 0)) {
        parts.push(`list ${formatMoney(summary.list)}`);
    }
    if (summary.cacheRate !== null) parts.push(`cache ${Math.round(summary.cacheRate * 100)}%`);
    parts.push(`${summary.generations} gen${summary.generations === 1 ? '' : 's'}`);
    if (summary.lastData?.primary !== null && summary.lastData?.primary !== undefined) {
        const label = summary.lastData.primaryLabel === 'Go limit' ? 'Go ' : '';
        parts.push(`last ${label}${formatMoney(summary.lastData.primary)}`);
    }
    return `Chat total: ${parts.join(' · ')}`;
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
    if (total) parts.push(`total ${total}`);
    const last = summary.lastData ? formatBadgeCost(summary.lastData) : '';
    if (last) parts.push(`last ${last}`);
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
    bar.title = formatSummary();
    bar.style.display = text ? '' : 'none';
    bar.classList.toggle('align-right', placement === 'top-right');
    bar.classList.toggle('align-center', placement === 'top-center');
}

function attachUsage(index, message, usage) {
    if (!message || !usage) return;

    const swipeId = Number.isInteger(message.swipe_id) ? message.swipe_id : 0;
    message.extra = message.extra || {};
    message.extra.opencode_usage = usage;

    if (Array.isArray(message.swipe_info) && message.swipe_info[swipeId]) {
        message.swipe_info[swipeId].extra = message.swipe_info[swipeId].extra || {};
        message.swipe_info[swipeId].extra.opencode_usage = usage;
    }

    if (message.extra.api_usage === undefined) {
        message.extra.api_usage = {
            prompt_tokens: usage.prompt_tokens,
            completion_tokens: usage.completion_tokens,
            total_tokens: usage.total_tokens,
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

function addSettingsUi() {
    const container = document.getElementById('extensions_settings');
    if (!container || document.getElementById('opencode_usage_settings')) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'opencode_usage_settings';
    wrapper.className = 'opencode-usage-settings';
    wrapper.innerHTML = `
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>OpenCode Usage Badge</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <label class="checkbox_label">
                    <input type="checkbox" id="opencode_usage_enabled">
                    <span>Show cache rate and cost on messages</span>
                </label>
                <div class="opencode-usage-setting-row">
                    <span>Badge cost</span>
                    <select id="opencode_usage_cost_display" class="text_pole">
                        <option value="auto">Auto (Go limit / actual cost)</option>
                        <option value="go">Go limit</option>
                        <option value="list">List price</option>
                        <option value="both">Both</option>
                    </select>
                </div>
                <div class="opencode-usage-setting-row">
                    <span>Summary placement</span>
                    <select id="opencode_usage_placement" class="text_pole">
                        <option value="top-left">Above chat, left</option>
                        <option value="top-right">Above chat, right</option>
                        <option value="top-center">Above chat, center</option>
                        <option value="off">Off</option>
                    </select>
                </div>
                <label class="checkbox_label">
                    <input type="checkbox" id="opencode_usage_show_summary">
                    <span>Show chat summary</span>
                </label>
                <label class="checkbox_label">
                    <input type="checkbox" id="opencode_usage_list_price">
                    <span>Show list price in tooltip</span>
                </label>
                <div id="opencode_usage_summary" class="opencode-usage-summary">Chat total: no usage yet.</div>
                <small>Data comes from the usage object in the chat completion response.</small>
            </div>
        </div>`;
    container.appendChild(wrapper);

    const enabled = wrapper.querySelector('#opencode_usage_enabled');
    const listPrice = wrapper.querySelector('#opencode_usage_list_price');
    const costDisplay = wrapper.querySelector('#opencode_usage_cost_display');
    const showSummary = wrapper.querySelector('#opencode_usage_show_summary');
    const placement = wrapper.querySelector('#opencode_usage_placement');
    enabled.checked = getSettings().enabled;
    listPrice.checked = getSettings().showListPrice;
    costDisplay.value = getSettings().costDisplay;
    showSummary.checked = getSettings().showSummary;
    placement.value = getSettings().summaryPlacement;

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
        addSettingsUi();
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

(function init() {
    getSettings();
    installFetchHook();
    addSettingsUi();
    registerEvents();
    scheduleRenderAll(1000);
})();
