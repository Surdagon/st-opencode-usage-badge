const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');

const ROOT = __dirname;
const CONFIG_PATH = path.join(ROOT, 'opencode-go-proxy.config.json');

let config;
try {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
} catch (error) {
    console.error(`Cannot read ${CONFIG_PATH}: ${error.message}`);
    process.exit(1);
}

const PORT = Number(config.port || 8790);
const HOST = String(config.host || '127.0.0.1');
const UPSTREAM = String(config.upstream || 'https://opencode.ai/inference/go/openai/v1').replace(/\/+$/, '');
const MODELS_URL = String(config.modelsUrl || `${UPSTREAM.replace(/\/openai\/v1$/, '')}/v1/models`).replace(/\/+$/, '');
const API_KEY = String(config.apiKey || '').trim();
const USER_AGENT = String(config.userAgent || 'sillytavern-opencode-proxy/1.0');

if (!API_KEY || !API_KEY.startsWith('oc_sk_')) {
    console.error('opencode-go-proxy: apiKey is missing or is not an oc_sk_ key');
    process.exit(1);
}

function cors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Api-Key, X-Opencode-Session');
}

function sendJson(res, status, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
    });
    res.end(body);
}

function readBody(req, limit = 64 * 1024 * 1024) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        req.on('data', chunk => {
            size += chunk.length;
            if (size > limit) {
                reject(new Error('Request body is too large'));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}

function getSessionId(body) {
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const firstUser = messages.find(message => message && message.role === 'user');
    const content = firstUser ? firstUser.content : '';
    const text = typeof content === 'string' ? content : JSON.stringify(content ?? '');
    const seed = `${body.user_name || ''}|${text}`;
    const hash = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 16);
    return `${config.sessionPrefix || 'st-openCode'}-${hash}`;
}

const DROP_FIELDS = new Set([
    'type',
    'chat_completion_source',
    'custom_url',
    'custom_include_body',
    'custom_exclude_body',
    'custom_include_headers',
    'custom_prompt_post_processing',
    'user_name',
    'char_name',
    'group_names',
    'include_reasoning',
    'enable_web_search',
    'request_images',
    'request_image_resolution',
    'request_image_aspect_ratio',
    'verbosity',
    'logprobs',
    'top_logprobs',
]);

function prepareBody(body) {
    for (const field of DROP_FIELDS) {
        delete body[field];
    }
    if (config.reasoningEffort && !body.reasoning_effort) {
        body.reasoning_effort = config.reasoningEffort;
    }
    if (body.stream) {
        body.stream_options = { ...(body.stream_options || {}), include_usage: true };
    }
    return body;
}

async function proxyModels(res) {
    try {
        const upstream = await fetch(MODELS_URL, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'User-Agent': USER_AGENT,
            },
        });
        const buffer = Buffer.from(await upstream.arrayBuffer());
        res.writeHead(upstream.status, {
            'Content-Type': upstream.headers.get('content-type') || 'application/json',
            'Content-Length': buffer.length,
        });
        res.end(buffer);
    } catch (error) {
        sendJson(res, 502, { error: { message: `Proxy models error: ${error.message}`, type: 'proxy_error' } });
    }
}

async function proxyChat(req, res, body) {
    const controller = new AbortController();
    res.on('close', () => {
        if (!res.writableEnded) {
            controller.abort();
        }
    });

    const started = Date.now();
    try {
        const upstream = await fetch(`${UPSTREAM}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
                'User-Agent': USER_AGENT,
                'x-opencode-session': getSessionId(body),
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });

        const contentType = upstream.headers.get('content-type') || 'application/json';
        const headers = { 'Content-Type': contentType };
        if (!body.stream) {
            headers['Content-Length'] = upstream.headers.get('content-length') || '';
            if (!headers['Content-Length']) {
                delete headers['Content-Length'];
            }
        } else {
            headers['Cache-Control'] = 'no-cache';
            headers['Connection'] = 'keep-alive';
        }
        res.writeHead(upstream.status, headers);

        let cacheRead = 0;
        let promptTokens = 0;
        let cost = null;
        let allowance = null;

        if (body.stream && upstream.body) {
            Readable.fromWeb(upstream.body).pipe(res);
        } else {
            const buffer = Buffer.from(await upstream.arrayBuffer());
            try {
                const data = JSON.parse(buffer.toString('utf8'));
                const usage = data?.usage;
                cacheRead = usage?.prompt_tokens_details?.cached_tokens ?? usage?.opencode?.tokens?.cache_read ?? 0;
                promptTokens = usage?.prompt_tokens ?? 0;
                cost = usage?.cost ?? null;
                allowance = usage?.opencode?.allowance ?? null;
            } catch {
                // Non-JSON response, leave the counters empty.
            }
            res.end(buffer);
        }

        const cacheRate = promptTokens > 0 ? `${Math.round((cacheRead / promptTokens) * 100)}%` : 'n/a';
        console.log(`${new Date().toISOString()} chat status=${upstream.status} model=${body.model} stream=${!!body.stream} ms=${Date.now() - started} cache=${cacheRead}/${promptTokens} (${cacheRate}) cost=${cost ?? '-'} allowance=${allowance ?? '-'}`);
    } catch (error) {
        if (controller.signal.aborted) {
            return;
        }
        console.error(`${new Date().toISOString()} chat error: ${error.message}`);
        if (!res.headersSent) {
            sendJson(res, 502, { error: { message: `Proxy error: ${error.message}`, type: 'proxy_error' } });
        } else {
            res.destroy();
        }
    }
}

const server = http.createServer(async (req, res) => {
    cors(res);

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (url.pathname === '/health') {
        sendJson(res, 200, { ok: true, upstream: UPSTREAM });
        return;
    }

    if (url.pathname === '/v1/models' && req.method === 'GET') {
        await proxyModels(res);
        return;
    }

    if (url.pathname === '/v1/chat/completions' && req.method === 'POST') {
        let body;
        try {
            body = prepareBody(JSON.parse(await readBody(req)));
        } catch (error) {
            sendJson(res, 400, { error: { message: `Invalid JSON: ${error.message}`, type: 'proxy_error' } });
            return;
        }
        await proxyChat(req, res, body);
        return;
    }

    sendJson(res, 404, { error: { message: 'Not found', type: 'proxy_error' } });
});

server.listen(PORT, HOST, () => {
    console.log(`OpenCode Go proxy listening on http://${HOST}:${PORT}/v1`);
    console.log(`Upstream: ${UPSTREAM}`);
});

process.on('uncaughtException', error => console.error('uncaughtException:', error));
process.on('unhandledRejection', error => console.error('unhandledRejection:', error));
