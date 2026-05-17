/* global Liferay */
/*
 * AI Benchmark Fragment - main.js
 * Liferay-provided globals: fragmentElement, configuration, layoutMode
 *
 * Architecture:
 *   storage   -> localStorage adapter (keys, custom APIs, runs)
 *   providers -> built-in registry + custom drivers (OpenAI-compatible by default)
 *   runner    -> executes a benchmark run with streaming + timing
 *   ui        -> wires tabs, controls, live cards, charts, history table
 */
(function () {
	'use strict';

	if (fragmentElement.dataset.aibenchInit === '1') return;
	fragmentElement.dataset.aibenchInit = '1';

	var root = fragmentElement.querySelector('[data-aibench-root]') || fragmentElement;
	var $ = function (sel, ctx) { return (ctx || root).querySelector(sel); };
	var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || root).querySelectorAll(sel)); };
	var iconsPath = root.dataset.icons || '/o/classic-theme/images/clay/icons.svg';
	function lexiconIcon(name, cls) {
		return '<svg class="lexicon-icon lexicon-icon-' + name + (cls ? ' ' + cls : '') + '" focusable="false" role="presentation">' +
			'<use href="' + iconsPath + '#' + name + '"></use></svg>';
	}

	// ----------------------------------------------------------------------
	// Built-in providers
	// ----------------------------------------------------------------------
	var BUILTIN_PROVIDERS = [
		{
			id: 'openai',
			name: 'OpenAI',
			driver: 'openai',
			baseUrl: 'https://api.openai.com/v1/chat/completions',
			authHeader: 'Authorization',
			authPrefix: 'Bearer ',
			models: [
				{ id: 'gpt-4o',        label: 'GPT-4o',        cap: {text:1,vision:1,audio:1,functions:1,json:1,streaming:1}, ctx: 128000, priceIn: 2.50,  priceOut: 10.00 },
				{ id: 'gpt-4o-mini',   label: 'GPT-4o mini',   cap: {text:1,vision:1,audio:0,functions:1,json:1,streaming:1}, ctx: 128000, priceIn: 0.15,  priceOut: 0.60 },
				{ id: 'gpt-4-turbo',   label: 'GPT-4 Turbo',   cap: {text:1,vision:1,audio:0,functions:1,json:1,streaming:1}, ctx: 128000, priceIn: 10.00, priceOut: 30.00 },
				{ id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', cap: {text:1,vision:0,audio:0,functions:1,json:1,streaming:1}, ctx: 16385,  priceIn: 0.50,  priceOut: 1.50 }
			]
		},
		{
			id: 'anthropic',
			name: 'Anthropic',
			driver: 'anthropic',
			baseUrl: 'https://api.anthropic.com/v1/messages',
			authHeader: 'x-api-key',
			authPrefix: '',
			models: [
				{ id: 'claude-opus-4-7',      label: 'Claude Opus 4.7',     cap: {text:1,vision:1,audio:0,functions:1,json:1,streaming:1}, ctx: 200000, priceIn: 15.00, priceOut: 75.00 },
				{ id: 'claude-sonnet-4-6',    label: 'Claude Sonnet 4.6',   cap: {text:1,vision:1,audio:0,functions:1,json:1,streaming:1}, ctx: 200000, priceIn: 3.00,  priceOut: 15.00 },
				{ id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', cap: {text:1,vision:1,audio:0,functions:1,json:1,streaming:1}, ctx: 200000, priceIn: 1.00,  priceOut: 5.00 }
			]
		},
		{
			id: 'google',
			name: 'Google Gemini',
			driver: 'gemini',
			baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
			authHeader: null,
			authPrefix: '',
			models: [
				{ id: 'gemini-1.5-pro',   label: 'Gemini 1.5 Pro',   cap: {text:1,vision:1,audio:1,functions:1,json:1,streaming:1}, ctx: 2000000, priceIn: 1.25,  priceOut: 5.00 },
				{ id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', cap: {text:1,vision:1,audio:1,functions:1,json:1,streaming:1}, ctx: 1000000, priceIn: 0.075, priceOut: 0.30 },
				{ id: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash (exp)', cap: {text:1,vision:1,audio:1,functions:1,json:1,streaming:1}, ctx: 1000000, priceIn: 0.075, priceOut: 0.30 }
			]
		},
		{
			id: 'mistral',
			name: 'Mistral',
			driver: 'openai',
			baseUrl: 'https://api.mistral.ai/v1/chat/completions',
			authHeader: 'Authorization',
			authPrefix: 'Bearer ',
			models: [
				{ id: 'mistral-large-latest', label: 'Mistral Large', cap: {text:1,vision:0,audio:0,functions:1,json:1,streaming:1}, ctx: 128000, priceIn: 2.00, priceOut: 6.00 },
				{ id: 'mistral-small-latest', label: 'Mistral Small', cap: {text:1,vision:0,audio:0,functions:1,json:1,streaming:1}, ctx: 32000,  priceIn: 0.20, priceOut: 0.60 }
			]
		},
		{
			id: 'groq',
			name: 'Groq',
			driver: 'openai',
			baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
			authHeader: 'Authorization',
			authPrefix: 'Bearer ',
			models: [
				{ id: 'llama-3.3-70b-versatile', label: 'LLaMA 3.3 70B', cap: {text:1,vision:0,audio:0,functions:1,json:1,streaming:1}, ctx: 128000, priceIn: 0.59, priceOut: 0.79 },
				{ id: 'llama-3.1-8b-instant',    label: 'LLaMA 3.1 8B',  cap: {text:1,vision:0,audio:0,functions:1,json:1,streaming:1}, ctx: 128000, priceIn: 0.05, priceOut: 0.08 },
				{ id: 'mixtral-8x7b-32768',      label: 'Mixtral 8x7B',  cap: {text:1,vision:0,audio:0,functions:1,json:1,streaming:1}, ctx: 32768,  priceIn: 0.24, priceOut: 0.24 }
			]
		},
		{
			id: 'deepseek',
			name: 'DeepSeek',
			driver: 'openai',
			baseUrl: 'https://api.deepseek.com/v1/chat/completions',
			authHeader: 'Authorization',
			authPrefix: 'Bearer ',
			models: [
				{ id: 'deepseek-chat',     label: 'DeepSeek Chat',     cap: {text:1,vision:0,audio:0,functions:1,json:1,streaming:1}, ctx: 64000, priceIn: 0.27, priceOut: 1.10 },
				{ id: 'deepseek-reasoner', label: 'DeepSeek Reasoner', cap: {text:1,vision:0,audio:0,functions:0,json:0,streaming:1}, ctx: 64000, priceIn: 0.55, priceOut: 2.19 }
			]
		},
		{
			id: 'xai',
			name: 'xAI',
			driver: 'openai',
			baseUrl: 'https://api.x.ai/v1/chat/completions',
			authHeader: 'Authorization',
			authPrefix: 'Bearer ',
			models: [
				{ id: 'grok-2-latest',        label: 'Grok 2',        cap: {text:1,vision:0,audio:0,functions:1,json:1,streaming:1}, ctx: 131072, priceIn: 2.00, priceOut: 10.00 },
				{ id: 'grok-2-vision-latest', label: 'Grok 2 Vision', cap: {text:1,vision:1,audio:0,functions:1,json:1,streaming:1}, ctx: 32768,  priceIn: 2.00, priceOut: 10.00 }
			]
		},
		{
			id: 'cohere',
			name: 'Cohere',
			driver: 'cohere',
			baseUrl: 'https://api.cohere.com/v1/chat',
			authHeader: 'Authorization',
			authPrefix: 'Bearer ',
			models: [
				{ id: 'command-r-plus', label: 'Command R+', cap: {text:1,vision:0,audio:0,functions:1,json:1,streaming:1}, ctx: 128000, priceIn: 2.50, priceOut: 10.00 },
				{ id: 'command-r',      label: 'Command R',  cap: {text:1,vision:0,audio:0,functions:1,json:1,streaming:1}, ctx: 128000, priceIn: 0.15, priceOut: 0.60 }
			]
		},
		{
			id: 'openrouter',
			name: 'OpenRouter',
			driver: 'openai',
			baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
			authHeader: 'Authorization',
			authPrefix: 'Bearer ',
			models: [
				{ id: 'meta-llama/llama-3.2-3b-instruct:free',    label: 'LLaMA 3.2 3B (FREE)',    cap: {text:1,vision:0,audio:0,functions:0,json:0,streaming:1}, ctx: 131072, priceIn: 0, priceOut: 0 },
				{ id: 'meta-llama/llama-3.1-8b-instruct:free',    label: 'LLaMA 3.1 8B (FREE)',    cap: {text:1,vision:0,audio:0,functions:0,json:0,streaming:1}, ctx: 131072, priceIn: 0, priceOut: 0 },
				{ id: 'mistralai/mistral-7b-instruct:free',        label: 'Mistral 7B (FREE)',      cap: {text:1,vision:0,audio:0,functions:0,json:0,streaming:1}, ctx: 32768,  priceIn: 0, priceOut: 0 },
				{ id: 'qwen/qwen-2.5-7b-instruct:free',           label: 'Qwen 2.5 7B (FREE)',     cap: {text:1,vision:0,audio:0,functions:0,json:0,streaming:1}, ctx: 32768,  priceIn: 0, priceOut: 0 },
				{ id: 'google/gemma-3-1b-it:free',                 label: 'Gemma 3 1B (FREE)',      cap: {text:1,vision:1,audio:0,functions:0,json:0,streaming:1}, ctx: 32768,  priceIn: 0, priceOut: 0 },
				{ id: 'deepseek/deepseek-r1:free',                 label: 'DeepSeek R1 (FREE)',     cap: {text:1,vision:0,audio:0,functions:0,json:0,streaming:1}, ctx: 64000,  priceIn: 0, priceOut: 0 },
				{ id: 'meta-llama/llama-4-scout:free',             label: 'LLaMA 4 Scout (FREE)',   cap: {text:1,vision:1,audio:0,functions:0,json:0,streaming:1}, ctx: 512000, priceIn: 0, priceOut: 0 },
				{ id: 'anthropic/claude-3.5-haiku',                label: 'Claude 3.5 Haiku',       cap: {text:1,vision:1,audio:0,functions:1,json:1,streaming:1}, ctx: 200000, priceIn: 1.00, priceOut: 5.00 },
				{ id: 'openai/gpt-4o-mini',                        label: 'GPT-4o mini',            cap: {text:1,vision:1,audio:0,functions:1,json:1,streaming:1}, ctx: 128000, priceIn: 0.15, priceOut: 0.60 }
			]
		},
		{
			id: 'together',
			name: 'Together AI',
			driver: 'openai',
			baseUrl: 'https://api.together.xyz/v1/chat/completions',
			authHeader: 'Authorization',
			authPrefix: 'Bearer ',
			models: [
				{ id: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',  label: 'LLaMA 3.1 8B Turbo',  cap: {text:1,vision:0,audio:0,functions:0,json:1,streaming:1}, ctx: 128000, priceIn: 0.18, priceOut: 0.18 },
				{ id: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', label: 'LLaMA 3.1 70B Turbo', cap: {text:1,vision:0,audio:0,functions:0,json:1,streaming:1}, ctx: 128000, priceIn: 0.88, priceOut: 0.88 },
				{ id: 'mistralai/Mixtral-8x7B-Instruct-v0.1',         label: 'Mixtral 8x7B',         cap: {text:1,vision:0,audio:0,functions:0,json:1,streaming:1}, ctx: 32768,  priceIn: 0.60, priceOut: 0.60 },
				{ id: 'Qwen/Qwen2.5-72B-Instruct-Turbo',              label: 'Qwen 2.5 72B Turbo',   cap: {text:1,vision:0,audio:0,functions:1,json:1,streaming:1}, ctx: 32768,  priceIn: 1.20, priceOut: 1.20 }
			]
		},
		{
			id: 'huggingface',
			name: 'HuggingFace',
			driver: 'openai',
			baseUrl: 'https://router.huggingface.co/v1/chat/completions',
			authHeader: 'Authorization',
			authPrefix: 'Bearer ',
			models: [
				{ id: 'meta-llama/Meta-Llama-3.1-8B-Instruct',       label: 'LLaMA 3.1 8B',         cap: {text:1,vision:0,audio:0,functions:0,json:0,streaming:1}, ctx: 128000, priceIn: 0, priceOut: 0 },
				{ id: 'Qwen/Qwen2.5-72B-Instruct',                    label: 'Qwen 2.5 72B',          cap: {text:1,vision:0,audio:0,functions:0,json:0,streaming:1}, ctx: 32768,  priceIn: 0, priceOut: 0 },
				{ id: 'mistralai/Mistral-7B-Instruct-v0.3',           label: 'Mistral 7B v0.3',       cap: {text:1,vision:0,audio:0,functions:0,json:0,streaming:1}, ctx: 32768,  priceIn: 0, priceOut: 0 }
			]
		},
		{
			id: 'ollama',
			name: 'Ollama (local)',
			driver: 'openai',
			baseUrl: 'http://192.168.40.33:11434/v1/chat/completions',
			authHeader: 'Authorization',
			authPrefix: 'Bearer ',
			models: [
				{ id: 'mistral:7b',           label: 'Mistral 7B',          cap: {text:1,vision:0,audio:0,functions:0,json:0,streaming:1}, ctx: 32768,  priceIn: 0, priceOut: 0 },
				{ id: 'deepseek-coder:6.7b',  label: 'DeepSeek Coder 6.7B', cap: {text:1,vision:0,audio:0,functions:0,json:0,streaming:1}, ctx: 16384,  priceIn: 0, priceOut: 0 },
				{ id: 'qwen2.5-coder:latest', label: 'Qwen2.5 Coder 7B',    cap: {text:1,vision:0,audio:0,functions:0,json:0,streaming:1}, ctx: 32768,  priceIn: 0, priceOut: 0 },
				{ id: 'gemma4:e4b',           label: 'Gemma4 E4B (8B)',      cap: {text:1,vision:0,audio:0,functions:0,json:0,streaming:1}, ctx: 128000, priceIn: 0, priceOut: 0 },
				{ id: 'gemma:2b',             label: 'Gemma 2B',             cap: {text:1,vision:0,audio:0,functions:0,json:0,streaming:1}, ctx: 8192,   priceIn: 0, priceOut: 0 },
				{ id: 'qwen2:1.5b',           label: 'Qwen2 1.5B',           cap: {text:1,vision:0,audio:0,functions:0,json:0,streaming:1}, ctx: 32768,  priceIn: 0, priceOut: 0 },
				{ id: 'phi3:latest',          label: 'Phi3 3.8B',            cap: {text:1,vision:0,audio:0,functions:0,json:0,streaming:1}, ctx: 128000, priceIn: 0, priceOut: 0 },
				{ id: 'llama3:latest',        label: 'LLaMA3 8B',            cap: {text:1,vision:0,audio:0,functions:0,json:0,streaming:1}, ctx: 8192,   priceIn: 0, priceOut: 0 }
			]
		}
	];

	// ----------------------------------------------------------------------
	// Storage adapter
	// ----------------------------------------------------------------------
	var STORAGE_KEY = (configuration.storageKey || 'liferay-ai-benchmark');
	var MAX_HISTORY = parseInt(configuration.maxHistoryRows || '50', 10);

	var storage = {
		read: function () {
			try {
				var raw = window.localStorage.getItem(STORAGE_KEY);
				if (!raw) return { keys: {}, customApis: [], runs: [] };
				var data = JSON.parse(raw);
				data.keys = data.keys || {};
				data.customApis = data.customApis || [];
				data.runs = data.runs || [];
				return data;
			} catch (e) {
				console.warn('[aibench] storage read failed', e);
				return { keys: {}, customApis: [], runs: [] };
			}
		},
		write: function (data) {
			try {
				if (data.runs.length > MAX_HISTORY) {
					data.runs = data.runs.slice(-MAX_HISTORY);
				}
				window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
			} catch (e) {
				console.warn('[aibench] storage write failed', e);
			}
		}
	};

	var state = storage.read();

	// ----------------------------------------------------------------------
	// Utilities
	// ----------------------------------------------------------------------
	function uid() {
		return 'r_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
	}

	function escapeHtml(s) {
		return String(s == null ? '' : s)
			.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
	}

	function fmt(n, digits) {
		if (n == null || isNaN(n)) return '-';
		return Number(n).toFixed(digits == null ? 0 : digits);
	}

	function fmtDate(ts) {
		var d = new Date(ts);
		return d.toLocaleString();
	}

	function estimateTokens(text) {
		// Rough heuristic ~ 4 chars per token
		if (!text) return 0;
		return Math.max(1, Math.round(text.length / 4));
	}

	function findProvider(providerId) {
		var custom = state.customApis.find(function (c) { return 'custom:' + c.id === providerId; });
		if (custom) {
			return {
				id: 'custom:' + custom.id,
				name: custom.name,
				driver: 'openai',
				baseUrl: custom.url,
				authHeader: custom.key ? 'Authorization' : null,
				authPrefix: 'Bearer ',
				_isCustom: true,
				_custom: custom,
				models: [{
					id: custom.model,
					label: custom.model,
					cap: { text: 1, vision: 0, audio: 0, functions: 0, json: 0, streaming: 1 },
					ctx: 0,
					priceIn: custom.priceIn || 0,
					priceOut: custom.priceOut || 0
				}]
			};
		}
		return BUILTIN_PROVIDERS.find(function (p) { return p.id === providerId; });
	}

	function findModel(providerId, modelId) {
		var p = findProvider(providerId);
		if (!p) return null;
		return p.models.find(function (m) { return m.id === modelId; });
	}

	function getApiKey(providerId) {
		if (providerId.indexOf('custom:') === 0) {
			var p = findProvider(providerId);
			return p && p._custom ? p._custom.key : '';
		}
		return state.keys[providerId] || '';
	}

	function toast(message, type) {
		if (window.Liferay && Liferay.Util && typeof Liferay.Util.openToast === 'function') {
			Liferay.Util.openToast({ message: message, type: type || 'info' });
		} else {
			console.log('[aibench]', type || 'info', message);
		}
	}

	// ----------------------------------------------------------------------
	// Drivers - one per protocol
	// Each driver returns: { request: {url, headers, body}, parseStreamChunk(rawLine) -> {delta?, done?, usage?} }
	// ----------------------------------------------------------------------
	var drivers = {
		openai: {
			buildRequest: function (provider, model, prompt, system, opts) {
				var messages = [];
				if (system) messages.push({ role: 'system', content: system });
				messages.push({ role: 'user', content: prompt });
				var headers = { 'Content-Type': 'application/json' };
				var key = getApiKey(provider.id);
				if (provider.authHeader && key) headers[provider.authHeader] = provider.authPrefix + key;
				return {
					url: provider.baseUrl,
					headers: headers,
					body: JSON.stringify({
						model: model.id,
						messages: messages,
						stream: true,
						stream_options: { include_usage: true },
						max_tokens: opts.maxTokens,
						temperature: opts.temperature
					})
				};
			},
			parseLine: function (line) {
				if (!line || line.indexOf('data:') !== 0) return null;
				var payload = line.slice(5).trim();
				if (payload === '[DONE]') return { done: true };
				try {
					var json = JSON.parse(payload);
					var delta = json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content;
					var usage = json.usage || null;
					return { delta: delta || '', usage: usage };
				} catch (e) { return null; }
			}
		},
		anthropic: {
			buildRequest: function (provider, model, prompt, system, opts) {
				var headers = {
					'Content-Type': 'application/json',
					'anthropic-version': '2023-06-01',
					'anthropic-dangerous-direct-browser-access': 'true'
				};
				var key = getApiKey(provider.id);
				if (key) headers[provider.authHeader] = key;
				var body = {
					model: model.id,
					max_tokens: opts.maxTokens,
					temperature: opts.temperature,
					stream: true,
					messages: [{ role: 'user', content: prompt }]
				};
				if (system) body.system = system;
				return { url: provider.baseUrl, headers: headers, body: JSON.stringify(body) };
			},
			parseLine: function (line) {
				if (!line || line.indexOf('data:') !== 0) return null;
				var payload = line.slice(5).trim();
				if (!payload) return null;
				try {
					var json = JSON.parse(payload);
					if (json.type === 'content_block_delta' && json.delta && json.delta.text) {
						return { delta: json.delta.text };
					}
					if (json.type === 'message_delta' && json.usage) {
						return { usage: { prompt_tokens: 0, completion_tokens: json.usage.output_tokens } };
					}
					if (json.type === 'message_stop') return { done: true };
					return null;
				} catch (e) { return null; }
			}
		},
		gemini: {
			buildRequest: function (provider, model, prompt, system, opts) {
				var key = getApiKey(provider.id);
				var url = provider.baseUrl + '/' + encodeURIComponent(model.id) + ':streamGenerateContent?alt=sse&key=' + encodeURIComponent(key);
				var body = {
					contents: [{ role: 'user', parts: [{ text: prompt }] }],
					generationConfig: { maxOutputTokens: opts.maxTokens, temperature: opts.temperature }
				};
				if (system) body.systemInstruction = { parts: [{ text: system }] };
				return { url: url, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
			},
			parseLine: function (line) {
				if (!line || line.indexOf('data:') !== 0) return null;
				var payload = line.slice(5).trim();
				if (!payload) return null;
				try {
					var json = JSON.parse(payload);
					var delta = '';
					if (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts) {
						delta = json.candidates[0].content.parts.map(function (p) { return p.text || ''; }).join('');
					}
					var usage = null;
					if (json.usageMetadata) {
						usage = { prompt_tokens: json.usageMetadata.promptTokenCount, completion_tokens: json.usageMetadata.candidatesTokenCount };
					}
					return { delta: delta, usage: usage };
				} catch (e) { return null; }
			}
		},
		cohere: {
			buildRequest: function (provider, model, prompt, system, opts) {
				var headers = { 'Content-Type': 'application/json' };
				var key = getApiKey(provider.id);
				if (key) headers[provider.authHeader] = provider.authPrefix + key;
				return {
					url: provider.baseUrl,
					headers: headers,
					body: JSON.stringify({
						model: model.id,
						message: prompt,
						preamble: system || undefined,
						stream: true,
						temperature: opts.temperature,
						max_tokens: opts.maxTokens
					})
				};
			},
			parseLine: function (line) {
				// Cohere uses newline-delimited JSON, not SSE
				if (!line) return null;
				try {
					var json = JSON.parse(line);
					if (json.event_type === 'text-generation') return { delta: json.text || '' };
					if (json.event_type === 'stream-end') {
						var u = json.response && json.response.meta && json.response.meta.billed_units;
						return { done: true, usage: u ? { prompt_tokens: u.input_tokens, completion_tokens: u.output_tokens } : null };
					}
					return null;
				} catch (e) { return null; }
			}
		}
	};

	// ----------------------------------------------------------------------
	// Runner - executes one benchmark and emits progress events
	// ----------------------------------------------------------------------
	function runBenchmark(providerId, modelId, prompt, system, opts, onProgress) {
		var provider = findProvider(providerId);
		var model = findModel(providerId, modelId);
		if (!provider || !model) return Promise.reject(new Error('Unknown provider/model'));

		var driverName = provider.driver || 'openai';
		var driver = drivers[driverName];
		if (!driver) return Promise.reject(new Error('No driver for ' + driverName));

		var simulate = !!opts.simulation || !getApiKey(provider.id) && !provider._isCustom;
		// If a custom API has no key and was set as no-auth, it's still real.
		if (provider._isCustom && !getApiKey(provider.id)) simulate = !!opts.simulation;

		var run = {
			id: uid(),
			ts: Date.now(),
			providerId: provider.id,
			providerName: provider.name,
			model: model.id,
			modelLabel: model.label,
			prompt: prompt,
			system: system || '',
			ttft: null,
			total: null,
			inputTokens: null,
			outputTokens: null,
			tokensPerSec: null,
			cost: null,
			status: 'running',
			error: null,
			response: '',
			simulated: simulate,
			cap: model.cap,
			ctx: model.ctx,
			priceIn: model.priceIn,
			priceOut: model.priceOut
		};

		onProgress({ type: 'start', run: run });

		if (simulate) return simulateRun(run, model, prompt, opts, onProgress);
		return realRun(run, provider, model, driver, prompt, system, opts, onProgress);
	}

	function finalize(run, onProgress) {
		var inT = run.inputTokens || estimateTokens(run.prompt + (run.system || ''));
		var outT = run.outputTokens || estimateTokens(run.response);
		run.inputTokens = inT;
		run.outputTokens = outT;
		var secs = (run.total || 1) / 1000;
		var genSecs = ((run.total || 1) - (run.ttft || 0)) / 1000;
		run.tokensPerSec = genSecs > 0 ? outT / genSecs : 0;
		run.cost = (inT / 1e6) * (run.priceIn || 0) + (outT / 1e6) * (run.priceOut || 0);
		state.runs.push(run);
		storage.write(state);
		onProgress({ type: 'done', run: run });
		return run;
	}

	function simulateRun(run, model, prompt, opts, onProgress) {
		// Realistic numbers per provider — order of magnitude only
		var profile = {
			openai:   { ttft: [350, 900],  tps: [60, 120] },
			anthropic:{ ttft: [500, 1400], tps: [40, 90]  },
			google:   { ttft: [400, 1100], tps: [60, 140] },
			mistral:  { ttft: [400, 900],  tps: [60, 110] },
			groq:     { ttft: [80, 250],   tps: [300, 700] },
			deepseek: { ttft: [600, 1500], tps: [30, 70]  },
			xai:      { ttft: [500, 1200], tps: [40, 90]  },
			cohere:   { ttft: [400, 1000], tps: [50, 100] }
		}[run.providerId] || { ttft: [500, 1500], tps: [40, 100] };

		var ttft = profile.ttft[0] + Math.random() * (profile.ttft[1] - profile.ttft[0]);
		var tps = profile.tps[0] + Math.random() * (profile.tps[1] - profile.tps[0]);
		var targetTokens = Math.min(opts.maxTokens, 40 + Math.floor(Math.random() * 120));
		var words = ('Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ' +
			'Ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat ' +
			'(simulated response based on prompt: ' + prompt.slice(0, 60) + '...) ').split(' ');

		var t0 = performance.now();
		run.startedAt = t0;

		return new Promise(function (resolve) {
			setTimeout(function () {
				run.ttft = performance.now() - t0;
				onProgress({ type: 'first-token', run: run });

				var produced = 0;
				var tickMs = 1000 / Math.max(10, tps);
				var iv = setInterval(function () {
					var word = words[produced % words.length];
					run.response += (run.response ? ' ' : '') + word;
					produced++;
					onProgress({ type: 'delta', run: run });
					if (produced >= targetTokens) {
						clearInterval(iv);
						run.total = performance.now() - t0;
						run.status = 'ok';
						run.inputTokens = estimateTokens(prompt + (run.system || ''));
						run.outputTokens = produced;
						resolve(finalize(run, onProgress));
					}
				}, tickMs);
			}, ttft);
		});
	}

	function realRun(run, provider, model, driver, prompt, system, opts, onProgress) {
		var req = driver.buildRequest(provider, model, prompt, system, opts);
		var t0 = performance.now();
		run.startedAt = t0;

		return fetch(req.url, { method: 'POST', headers: req.headers, body: req.body })
			.then(function (resp) {
				if (!resp.ok || !resp.body) {
					return resp.text().then(function (txt) {
						throw new Error('HTTP ' + resp.status + ' ' + (txt || '').slice(0, 200));
					});
				}
				var reader = resp.body.getReader();
				var decoder = new TextDecoder();
				var buffer = '';
				var firstToken = false;

				function pump() {
					return reader.read().then(function (r) {
						if (r.done) {
							run.total = performance.now() - t0;
							run.status = 'ok';
							return finalize(run, onProgress);
						}
						buffer += decoder.decode(r.value, { stream: true });
						var lines = buffer.split('\n');
						buffer = lines.pop();
						lines.forEach(function (rawLine) {
							var line = rawLine.replace(/\r$/, '');
							var parsed = driver.parseLine(line);
							if (!parsed) return;
							if (parsed.delta) {
								if (!firstToken) {
									firstToken = true;
									run.ttft = performance.now() - t0;
									onProgress({ type: 'first-token', run: run });
								}
								run.response += parsed.delta;
								onProgress({ type: 'delta', run: run });
							}
							if (parsed.usage) {
								if (parsed.usage.prompt_tokens != null) run.inputTokens = parsed.usage.prompt_tokens;
								if (parsed.usage.completion_tokens != null) run.outputTokens = parsed.usage.completion_tokens;
							}
						});
						return pump();
					});
				}
				return pump();
			})
			.catch(function (err) {
				run.total = performance.now() - t0;
				run.status = 'error';
				run.error = err.message || String(err);
				finalize(run, onProgress);
				throw err;
			});
	}

	// ----------------------------------------------------------------------
	// UI - selected models for run
	// ----------------------------------------------------------------------
	var ui = {
		selectedModels: [],  // [{providerId, modelId}]
		activeTab: 'run',
		compareSelection: []
	};

	function allProviders() {
		var custom = state.customApis.map(function (c) {
			return {
				id: 'custom:' + c.id,
				name: c.name + ' (custom)',
				_isCustom: true,
				models: [{ id: c.model, label: c.model, cap:{text:1}, priceIn:c.priceIn||0, priceOut:c.priceOut||0 }]
			};
		});
		return BUILTIN_PROVIDERS.concat(custom);
	}

	function refreshModelOptions() {
		var pSel = $('[data-control="provider-select"]');
		var mSel = $('[data-control="model-select"]');
		var p = findProvider(pSel.value);
		mSel.innerHTML = (p ? p.models : []).map(function (m) {
			return '<option value="' + escapeHtml(m.id) + '">' + escapeHtml(m.label) + '</option>';
		}).join('');
	}

	function renderProviderDropdowns() {
		var pSel = $('[data-control="provider-select"]');
		pSel.innerHTML = allProviders().map(function (p) {
			return '<option value="' + escapeHtml(p.id) + '">' + escapeHtml(p.name) + '</option>';
		}).join('');
		refreshModelOptions();
	}

	function renderSelectedModels() {
		var box = $('[data-control="selected-models"]');
		if (!ui.selectedModels.length) {
			box.innerHTML = '<span class="text-secondary small">No models selected yet.</span>';
			return;
		}
		box.innerHTML = ui.selectedModels.map(function (sel, idx) {
			var p = findProvider(sel.providerId);
			var m = findModel(sel.providerId, sel.modelId);
			var label = (p ? p.name : sel.providerId) + ' · ' + (m ? m.label : sel.modelId);
			return '<span class="aibench__chip" data-chip-idx="' + idx + '">' +
				escapeHtml(label) +
				'<span class="aibench__chip-remove" data-action="remove-selected" data-idx="' + idx + '" aria-label="Remove">' +
				'<svg width="12" height="12" viewBox="0 0 512 512" fill="currentColor"><path d="M64 64l384 384M448 64L64 448" stroke="currentColor" stroke-width="48" stroke-linecap="round"/></svg>' +
				'</span></span>';
		}).join('');
	}

	function addSelectedModel(providerId, modelId) {
		var exists = ui.selectedModels.some(function (s) { return s.providerId === providerId && s.modelId === modelId; });
		if (exists) { toast('Already added', 'warning'); return; }
		ui.selectedModels.push({ providerId: providerId, modelId: modelId });
		renderSelectedModels();
	}

	// ----------------------------------------------------------------------
	function fmtCost(v) {
		if (v == null) return '—';
		if (v === 0) return '$0';
		return '$' + fmt(v, 5);
	}

	// UI - live result cards
	// ----------------------------------------------------------------------
	var TT = {
		TTFT:  'Time to First Token — ms from request start to first streamed token',
		tps:   'Tokens per second — output tokens generated after the first token',
		cost:  'Estimated cost in USD based on provider pricing per 1M tokens',
		total: 'Total response time — ms from request start to stream end',
		tok:   'Input tokens / Output tokens reported by the provider'
	};

	function tt(label, key) {
		return '<span data-toggle="tooltip" data-placement="top" title="' + escapeHtml(TT[key] || label) + '">' + label + '</span>';
	}

	function makeLiveCard(run) {
		var card = document.createElement('div');
		card.className = 'aibench__live-card border rounded p-3';
		card.dataset.runId = run.id;
		card.innerHTML =
			'<div class="aibench__live-header">' +
				'<div class="aibench__live-title" title="' + escapeHtml(run.providerName + ' · ' + run.modelLabel) + '">' +
					escapeHtml(run.providerName) + ' · ' + escapeHtml(run.modelLabel) +
				'</div>' +
				'<span class="aibench__pill aibench__pill--run"><span class="aibench__spinner mr-1"></span>Running</span>' +
			'</div>' +
			'<div class="aibench__live-metrics">' +
				'<div class="aibench__metric"><span class="aibench__metric-label">' + tt('TTFT', 'TTFT') + '</span><span class="aibench__metric-value" data-m="ttft">—</span></div>' +
				'<div class="aibench__metric"><span class="aibench__metric-label">' + tt('Total', 'total') + '</span><span class="aibench__metric-value" data-m="total">—</span></div>' +
				'<div class="aibench__metric"><span class="aibench__metric-label">' + tt('Tokens', 'tok') + '</span><span class="aibench__metric-value" data-m="tokens">—</span></div>' +
				'<div class="aibench__metric"><span class="aibench__metric-label">' + tt('tok/s', 'tps') + '</span><span class="aibench__metric-value" data-m="tps">—</span></div>' +
				'<div class="aibench__metric"><span class="aibench__metric-label">' + tt('$ est.', 'cost') + '</span><span class="aibench__metric-value" data-m="cost">—</span></div>' +
				'<div class="aibench__metric"><span class="aibench__metric-label">Mode</span><span class="aibench__metric-value">' + (run.simulated ? 'Simulated' : 'Live') + '</span></div>' +
			'</div>' +
			'<div class="aibench__live-output" data-output></div>';
		return card;
	}

	function updateLiveCard(card, run) {
		var set = function (key, val) {
			var el = card.querySelector('[data-m="' + key + '"]');
			if (el) el.textContent = val;
		};
		set('ttft', run.ttft != null ? fmt(run.ttft) + ' ms' : '—');
		set('total', run.total != null ? fmt(run.total) + ' ms' : '—');
		set('tokens', (run.outputTokens || '?') + ' out');
		set('tps', run.tokensPerSec ? fmt(run.tokensPerSec, 1) : '—');
		set('cost', fmtCost(run.cost));
		var out = card.querySelector('[data-output]');
		if (out) out.textContent = run.response;
		if (run.status === 'ok') {
			card.classList.add('border-success');
			var pill = card.querySelector('.aibench__pill');
			pill.className = 'aibench__pill aibench__pill--ok';
			pill.textContent = 'Done';
		} else if (run.status === 'error') {
			card.classList.add('border-danger');
			var pill2 = card.querySelector('.aibench__pill');
			pill2.className = 'aibench__pill aibench__pill--err';
			pill2.textContent = 'Error';
			var out2 = card.querySelector('[data-output]');
			if (out2 && run.error) out2.textContent = 'Error: ' + run.error;
		}
	}

	// ----------------------------------------------------------------------
	// UI - Run button
	// ----------------------------------------------------------------------
	function onRunClick() {
		if (!ui.selectedModels.length) { toast('Add at least one model first.', 'warning'); return; }
		var prompt = $('[data-control="prompt"]').value.trim();
		if (!prompt) { toast('Prompt cannot be empty.', 'warning'); return; }
		var opts = {
			maxTokens: parseInt($('[data-control="max-tokens"]').value, 10) || 256,
			temperature: parseFloat($('[data-control="temperature"]').value) || 0.7,
			simulation: $('[data-control="simulation"]').checked
		};
		var system = $('[data-control="system"]').value.trim();
		var runs = parseInt($('[data-control="runs"]').value, 10) || 1;

		var liveArea = $('[data-control="live-results"]');
		liveArea.innerHTML = '';

		var tasks = [];
		ui.selectedModels.forEach(function (sel) {
			for (var i = 0; i < runs; i++) {
				tasks.push(sel);
			}
		});

		var btn = $('[data-action="run"]');
		btn.disabled = true;
		var promises = tasks.map(function (sel) {
			var card;
			return runBenchmark(sel.providerId, sel.modelId, prompt, system, opts, function (evt) {
				if (evt.type === 'start') {
					card = makeLiveCard(evt.run);
					liveArea.appendChild(card);
				} else if (card) {
					updateLiveCard(card, evt.run);
				}
			}).catch(function () { /* swallow per-task errors */ });
		});

		Promise.all(promises).then(function () {
			btn.disabled = false;
			refreshHistory();
			refreshComparePool();
			toast('Benchmark complete.', 'success');
		});
	}

	// ----------------------------------------------------------------------
	// UI - History table
	// ----------------------------------------------------------------------
	function refreshHistory() {
		var body = $('[data-control="history-body"]');
		$('[data-history-count]').textContent = state.runs.length;
		var filter = ($('[data-control="history-filter"]').value || '').toLowerCase();
		var rows = state.runs.slice().reverse().filter(function (r) {
			if (!filter) return true;
			return (r.modelLabel + ' ' + r.providerName + ' ' + r.prompt).toLowerCase().indexOf(filter) >= 0;
		});

		if (!rows.length) {
			body.innerHTML = '<tr><td colspan="11" class="text-center text-secondary py-4">No runs match.</td></tr>';
			return;
		}

		body.innerHTML = rows.map(function (r) {
			var statusPill = r.status === 'ok'
				? '<span class="aibench__pill aibench__pill--ok">OK</span>'
				: '<span class="aibench__pill aibench__pill--err" title="' + escapeHtml(r.error || '') + '">ERR</span>';
			return '<tr>' +
				'<td>' + escapeHtml(fmtDate(r.ts)) + '</td>' +
				'<td>' + escapeHtml(r.providerName) + '</td>' +
				'<td>' + escapeHtml(r.modelLabel) + '</td>' +
				'<td class="aibench__prompt-cell" title="' + escapeHtml(r.prompt) + '">' + escapeHtml(r.prompt) + '</td>' +
				'<td class="text-right">' + (r.ttft != null ? fmt(r.ttft) : '—') + '</td>' +
				'<td class="text-right">' + (r.total != null ? fmt(r.total) : '—') + '</td>' +
				'<td class="text-right">' + ((r.inputTokens || 0) + ' / ' + (r.outputTokens || 0)) + '</td>' +
				'<td class="text-right">' + (r.tokensPerSec ? fmt(r.tokensPerSec, 1) : '—') + '</td>' +
				'<td class="text-right">' + fmtCost(r.cost) + '</td>' +
				'<td>' + statusPill + (r.simulated ? ' <span class="text-secondary small">sim</span>' : '') + '</td>' +
				'<td><button class="btn btn-sm btn-unstyled" data-action="delete-run" data-id="' + r.id + '" title="Delete">' +
					lexiconIcon('trash') +
				'</button></td>' +
				'</tr>';
		}).join('');
	}

	// ----------------------------------------------------------------------
	// UI - APIs tab (built-in keys + custom)
	// ----------------------------------------------------------------------
	function renderProviderList() {
		var list = $('[data-control="provider-list"]');
		list.innerHTML = BUILTIN_PROVIDERS.map(function (p) {
			return '<div class="aibench__provider-row">' +
				'<span class="aibench__provider-name">' + escapeHtml(p.name) + '</span>' +
				'<input type="password" class="form-control form-control-sm" placeholder="API key" autocomplete="off" ' +
					'data-control="api-key" data-provider="' + escapeHtml(p.id) + '" value="' + escapeHtml(state.keys[p.id] || '') + '"/>' +
				'<button class="btn btn-sm btn-secondary" data-action="save-key" data-provider="' + escapeHtml(p.id) + '">Save</button>' +
			'</div>';
		}).join('');
	}

	function renderCustomList() {
		var list = $('[data-control="custom-list"]');
		if (!state.customApis.length) {
			list.innerHTML = '<span class="text-secondary small">None registered yet.</span>';
			return;
		}
		list.innerHTML = state.customApis.map(function (c) {
			return '<div class="aibench__provider-row">' +
				'<span class="aibench__provider-name">' + escapeHtml(c.name) + '</span>' +
				'<span class="text-secondary small">' + escapeHtml(c.model) + ' @ ' + escapeHtml(c.url) + '</span>' +
				'<button class="btn btn-sm btn-secondary" data-action="remove-custom" data-id="' + escapeHtml(c.id) + '">Remove</button>' +
			'</div>';
		}).join('');
	}

	// ----------------------------------------------------------------------
	// UI - Compare tab
	// ----------------------------------------------------------------------
	function uniqueModelsFromRuns() {
		var map = {};
		state.runs.forEach(function (r) {
			var k = r.providerId + '::' + r.model;
			if (!map[k]) map[k] = { key: k, providerId: r.providerId, providerName: r.providerName, model: r.model, modelLabel: r.modelLabel, runs: [] };
			map[k].runs.push(r);
		});
		return Object.keys(map).map(function (k) { return map[k]; });
	}

	function refreshComparePool() {
		var pool = $('[data-control="compare-pool"]');
		var models = uniqueModelsFromRuns();
		if (!models.length) {
			pool.innerHTML = '<span class="text-secondary small">Run at least one benchmark to populate this list.</span>';
			renderCompareCharts([]);
			return;
		}
		pool.innerHTML = models.map(function (m) {
			var selected = ui.compareSelection.indexOf(m.key) >= 0;
			return '<span class="aibench__chip ' + (selected ? 'is-selected' : '') + '" data-action="toggle-compare" data-key="' + escapeHtml(m.key) + '">' +
				escapeHtml(m.providerName + ' · ' + m.modelLabel) +
				' <small class="ml-1 opacity-75">(' + m.runs.length + ')</small>' +
			'</span>';
		}).join('');
		renderCompareCharts(models.filter(function (m) { return ui.compareSelection.indexOf(m.key) >= 0; }));
	}

	function avg(arr) {
		var valid = arr.filter(function (v) { return v != null && isFinite(v); });
		if (!valid.length) return null;
		var s = 0;
		for (var i = 0; i < valid.length; i++) s += valid[i];
		return s / valid.length;
	}

	function renderBarChart(title, data, unit, digits, lowerIsBetter, valueFmt) {
		var sorted = data.slice().sort(function (a, b) {
			if (a.value == null && b.value == null) return 0;
			if (a.value == null) return 1;
			if (b.value == null) return -1;
			return lowerIsBetter ? a.value - b.value : b.value - a.value;
		});
		var validData = sorted.filter(function (d) { return d.value != null; });
		var max = validData.length ? Math.max.apply(null, validData.map(function (d) { return d.value; })) : 1;
		if (!isFinite(max) || max <= 0) max = 1;
		var rowH = 24, gap = 8, padL = 160, padR = 60, padT = 8, padB = 8;
		var h = padT + padB + sorted.length * (rowH + gap) - gap;
		var w = 520;
		var bars = sorted.map(function (d, i) {
			var y = padT + i * (rowH + gap);
			var hasValue = d.value != null;
			var isBest = hasValue && i === 0;
			var barW = hasValue ? Math.max(2, (d.value / max) * (w - padL - padR)) : 0;
			var valueLabel = hasValue ? (valueFmt ? valueFmt(d.value) : fmt(d.value, digits) + ' ' + unit) : 'N/A';
			var valueX = hasValue ? padL + barW + 6 : padL + 6;
			var barClass = isBest ? 'aibench__chart-bar aibench__chart-bar--best' : 'aibench__chart-bar';
			var labelClass = isBest ? 'aibench__chart-label aibench__chart-label--best' : 'aibench__chart-label';
			return '' +
				'<text class="' + labelClass + '" x="' + (padL - 6) + '" y="' + (y + rowH / 2 + 4) + '" text-anchor="end">' + escapeHtml(d.label) + '</text>' +
				(hasValue ? '<rect class="' + barClass + '" x="' + padL + '" y="' + y + '" width="' + barW + '" height="' + rowH + '" rx="3"/>' : '') +
				'<text class="aibench__chart-value" x="' + valueX + '" y="' + (y + rowH / 2 + 4) + '">' + valueLabel + (isBest ? ' ★' : '') + '</text>';
		}).join('');
		return '<div class="aibench__chart">' +
			'<div class="aibench__chart-title">' + escapeHtml(title) + '</div>' +
			'<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMinYMin meet">' + bars + '</svg>' +
			'</div>';
	}

	function renderChampions(metrics) {
		var cards = metrics.map(function (m) {
			var valid = m.data.filter(function (d) { return d.value != null; });
			if (!valid.length) return '';
			var winner = valid.slice().sort(function (a, b) {
				return m.lowerIsBetter ? a.value - b.value : b.value - a.value;
			})[0];
			var formatted = m.digits === 5
				? fmtCost(winner.value)
				: fmt(winner.value, m.digits) + ' ' + m.unit;
			return '<div class="aibench__champion">' +
				'<div class="aibench__champion-tag">' + escapeHtml(m.tag) + '</div>' +
				'<div class="aibench__champion-model" title="' + escapeHtml(winner.label) + '">' + escapeHtml(winner.label) + '</div>' +
				'<div class="aibench__champion-value">' + formatted + '</div>' +
			'</div>';
		}).join('');
		return '<div class="aibench__champions mb-4">' + cards + '</div>';
	}

	function renderCompareCharts(models) {
		var box = $('[data-control="compare-charts"]');
		var capCard = $('[data-control="capability-card"]');
		if (!models.length) {
			box.innerHTML = '<div class="text-secondary text-center py-5">Select two or more models above.</div>';
			capCard.hidden = true;
			return;
		}
		function okRuns(m) { return m.runs.filter(function (r) { return r.status === 'ok'; }); }
		var ttft  = models.map(function (m) { return { label: m.modelLabel, value: avg(okRuns(m).map(function(r){return r.ttft;})) }; });
		var total = models.map(function (m) { return { label: m.modelLabel, value: avg(okRuns(m).map(function(r){return r.total;})) }; });
		var tps   = models.map(function (m) { return { label: m.modelLabel, value: avg(okRuns(m).map(function(r){return r.tokensPerSec;})) }; });
		var cost  = models.map(function (m) { return { label: m.modelLabel, value: avg(okRuns(m).map(function(r){return r.cost;})) }; });

		box.innerHTML =
			renderChampions([
				{ tag: 'Fastest response',    data: ttft,  lowerIsBetter: true,  unit: 'ms',    digits: 0 },
				{ tag: 'Best throughput',     data: tps,   lowerIsBetter: false, unit: 'tok/s', digits: 1 },
				{ tag: 'Fastest total time',  data: total, lowerIsBetter: true,  unit: 'ms',    digits: 0 },
				{ tag: 'Most cost-efficient', data: cost,  lowerIsBetter: true,  unit: 'USD',   digits: 5 }
			]) +
			renderBarChart('Time to First Token (avg)', ttft, 'ms', 0, true) +
			renderBarChart('Total Response Time (avg)', total, 'ms', 0, true) +
			renderBarChart('Throughput (avg tokens/sec)', tps, 'tok/s', 1, false) +
			renderBarChart('Estimated Cost (avg per run)', cost, 'USD', 5, true, fmtCost);

		var capBody = $('[data-control="capability-body"]');
		capBody.innerHTML = models.map(function (m) {
			var cap = (m.runs[m.runs.length - 1].cap) || {};
			var ctx = m.runs[m.runs.length - 1].ctx;
			var pi = m.runs[m.runs.length - 1].priceIn;
			var po = m.runs[m.runs.length - 1].priceOut;
			var yn = function (v) { return v ? '<span class="aibench__cap-yes">YES</span>' : '<span class="aibench__cap-no">—</span>'; };
			return '<tr>' +
				'<td>' + escapeHtml(m.providerName + ' · ' + m.modelLabel) + '</td>' +
				'<td>' + yn(cap.text) + '</td>' +
				'<td>' + yn(cap.vision) + '</td>' +
				'<td>' + yn(cap.audio) + '</td>' +
				'<td>' + yn(cap.functions) + '</td>' +
				'<td>' + yn(cap.json) + '</td>' +
				'<td>' + yn(cap.streaming) + '</td>' +
				'<td class="text-right">' + (ctx ? ctx.toLocaleString() : '—') + '</td>' +
				'<td class="text-right">' + (pi ? '$' + fmt(pi, 2) : '—') + '</td>' +
				'<td class="text-right">' + (po ? '$' + fmt(po, 2) : '—') + '</td>' +
			'</tr>';
		}).join('');
		capCard.hidden = false;
	}

	// ----------------------------------------------------------------------
	// UI - Tabs
	// ----------------------------------------------------------------------
	function switchTab(tab) {
		ui.activeTab = tab;
		$$('[data-tab]').forEach(function (el) {
			var isActive = el.dataset.tab === tab;
			el.classList.toggle('active', isActive);
			el.setAttribute('aria-selected', isActive ? 'true' : 'false');
			if (isActive) {
				el.setAttribute('aria-current', 'page');
			} else {
				el.removeAttribute('aria-current');
			}
		});
		$$('[data-panel]').forEach(function (el) {
			el.classList.toggle('d-none', el.dataset.panel !== tab);
		});
		if (tab === 'history') refreshHistory();
		if (tab === 'compare') refreshComparePool();
		if (tab === 'apis') { renderProviderList(); renderCustomList(); }
	}

	// ----------------------------------------------------------------------
	// UI - export/clear
	// ----------------------------------------------------------------------
	function exportHistory() {
		var blob = new Blob([JSON.stringify(state.runs, null, 2)], { type: 'application/json' });
		var url = URL.createObjectURL(blob);
		var a = document.createElement('a');
		a.href = url;
		a.download = 'ai-benchmark-' + new Date().toISOString().slice(0, 10) + '.json';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	function clearHistory() {
		if (!confirm('Delete all benchmark history? This cannot be undone.')) return;
		state.runs = [];
		storage.write(state);
		refreshHistory();
		refreshComparePool();
		toast('History cleared.', 'success');
	}

	// ----------------------------------------------------------------------
	// Collapse (replaces Bootstrap data-toggle="collapse" which doesn't
	// auto-init inside Liferay fragment scope)
	// ----------------------------------------------------------------------
	root.addEventListener('click', function (e) {
		var toggle = e.target.closest('[data-toggle="collapse"]');
		if (toggle) {
			var targetSel = toggle.getAttribute('data-target');
			var panel = targetSel && root.querySelector(targetSel);
			if (panel) {
				var opening = !panel.classList.contains('show');
				panel.classList.toggle('show', opening);
				toggle.classList.toggle('collapsed', !opening);
				toggle.setAttribute('aria-expanded', opening ? 'true' : 'false');
			}
		}
	});

	// ----------------------------------------------------------------------
	// Event delegation
	// ----------------------------------------------------------------------
	root.addEventListener('click', function (e) {
		var t = e.target.closest('[data-action], [data-tab]');
		if (!t) return;

		if (t.dataset.tab) { switchTab(t.dataset.tab); return; }

		var action = t.dataset.action;
		if (action === 'run') return onRunClick();
		if (action === 'add-model') {
			return addSelectedModel($('[data-control="provider-select"]').value, $('[data-control="model-select"]').value);
		}
		if (action === 'remove-selected') {
			var idx = parseInt(t.dataset.idx, 10);
			ui.selectedModels.splice(idx, 1);
			renderSelectedModels();
			return;
		}
		if (action === 'export') return exportHistory();
		if (action === 'clear') return clearHistory();
		if (action === 'delete-run') {
			state.runs = state.runs.filter(function (r) { return r.id !== t.dataset.id; });
			storage.write(state);
			refreshHistory();
			refreshComparePool();
			return;
		}
		if (action === 'save-key') {
			var inp = $('[data-control="api-key"][data-provider="' + t.dataset.provider + '"]');
			state.keys[t.dataset.provider] = inp.value.trim();
			storage.write(state);
			toast('API key saved locally.', 'success');
			return;
		}
		if (action === 'add-custom-api') {
			var c = {
				id: uid(),
				name: $('[data-control="custom-name"]').value.trim() || 'Custom API',
				url: $('[data-control="custom-url"]').value.trim(),
				model: $('[data-control="custom-model"]').value.trim() || 'default',
				key: $('[data-control="custom-key"]').value,
				priceIn: parseFloat($('[data-control="custom-price-in"]').value) || 0,
				priceOut: parseFloat($('[data-control="custom-price-out"]').value) || 0
			};
			if (!c.url) { toast('Endpoint URL is required.', 'warning'); return; }
			state.customApis.push(c);
			storage.write(state);
			renderCustomList();
			renderProviderDropdowns();
			toast('Custom API added.', 'success');
			$('[data-control="custom-name"]').value = '';
			$('[data-control="custom-url"]').value = '';
			$('[data-control="custom-model"]').value = '';
			$('[data-control="custom-key"]').value = '';
			return;
		}
		if (action === 'remove-custom') {
			state.customApis = state.customApis.filter(function (c) { return c.id !== t.dataset.id; });
			storage.write(state);
			renderCustomList();
			renderProviderDropdowns();
			return;
		}
		if (action === 'toggle-compare') {
			var key = t.dataset.key;
			var i = ui.compareSelection.indexOf(key);
			if (i >= 0) ui.compareSelection.splice(i, 1); else ui.compareSelection.push(key);
			refreshComparePool();
			return;
		}
	});

	root.addEventListener('input', function (e) {
		if (e.target.matches && e.target.matches('[data-control="history-filter"]')) refreshHistory();
	});

	root.addEventListener('change', function (e) {
		if (e.target.matches && e.target.matches('[data-control="provider-select"]')) refreshModelOptions();
	});

	// ----------------------------------------------------------------------
	// Init
	// ----------------------------------------------------------------------
	function init() {
		// Hide custom API section if disabled
		if (configuration.allowCustomApis === false || configuration.allowCustomApis === 'false') {
			var cs = $('[data-control="custom-api-section"]');
			if (cs) cs.hidden = true;
		}
		// Default simulation toggle — off by default, unless explicitly enabled in config
		var simCb = $('[data-control="simulation"]');
		if (simCb) simCb.checked = (configuration.simulationMode === true || configuration.simulationMode === 'true');

		renderProviderDropdowns();
		renderSelectedModels();
		renderProviderList();
		renderCustomList();
		refreshHistory();
		refreshComparePool();
	}

	init();
})();
