import { installSettingsSection, settingsNamespace } from "@deepseek-ai/dsh-settings";
import { appendFileSync, createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { Client } from "ssh2";
import { unlink } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { defineTool } from "@deepseek-ai/dsh-tools";
//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
//#endregion
//#region node_modules/.pnpm/cosmokit@1.8.1/node_modules/cosmokit/lib/index.cjs
var require_lib$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var __defProp = Object.defineProperty;
	var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
	var __getOwnPropNames = Object.getOwnPropertyNames;
	var __hasOwnProp = Object.prototype.hasOwnProperty;
	var __export = (target, all) => {
		for (var name in all) __defProp(target, name, {
			get: all[name],
			enumerable: true
		});
	};
	var __copyProps = (to, from, except, desc) => {
		if (from && typeof from === "object" || typeof from === "function") {
			for (let key of __getOwnPropNames(from)) if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
				get: () => from[key],
				enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
			});
		}
		return to;
	};
	var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
	var index_exports = {};
	__export(index_exports, {
		Binary: () => Binary,
		Time: () => Time,
		arrayBufferToBase64: () => arrayBufferToBase64,
		arrayBufferToHex: () => arrayBufferToHex,
		base64ToArrayBuffer: () => base64ToArrayBuffer,
		camelCase: () => camelCase,
		camelize: () => camelize,
		capitalize: () => capitalize,
		clone: () => clone,
		contain: () => contain,
		deduplicate: () => deduplicate,
		deepEqual: () => deepEqual,
		defineProperty: () => defineProperty,
		difference: () => difference,
		filterKeys: () => filterKeys,
		formatProperty: () => formatProperty,
		hexToArrayBuffer: () => hexToArrayBuffer,
		hyphenate: () => hyphenate,
		intersection: () => intersection,
		is: () => is,
		isNonNullable: () => isNonNullable,
		isNullable: () => isNullable,
		isPlainObject: () => isPlainObject,
		makeArray: () => makeArray,
		mapValues: () => mapValues,
		noop: () => noop,
		omit: () => omit,
		paramCase: () => paramCase,
		pick: () => pick,
		remove: () => remove,
		sanitize: () => sanitize,
		snakeCase: () => snakeCase,
		trimSlash: () => trimSlash,
		uncapitalize: () => uncapitalize,
		union: () => union,
		valueMap: () => mapValues
	});
	module.exports = __toCommonJS(index_exports);
	function noop() {}
	function isNullable(value) {
		return value === null || value === void 0;
	}
	function isNonNullable(value) {
		return !isNullable(value);
	}
	function isPlainObject(data) {
		return data && typeof data === "object" && !Array.isArray(data);
	}
	function filterKeys(object, filter) {
		return Object.fromEntries(Object.entries(object).filter(([key, value]) => filter(key, value)));
	}
	function mapValues(object, transform) {
		return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, transform(value, key)]));
	}
	function pick(source, keys, forced) {
		if (!keys) return { ...source };
		const result = {};
		for (const key of keys) if (forced || source[key] !== void 0) result[key] = source[key];
		return result;
	}
	function omit(source, keys) {
		if (!keys) return { ...source };
		const result = { ...source };
		for (const key of keys) Reflect.deleteProperty(result, key);
		return result;
	}
	function defineProperty(object, key, value) {
		return Object.defineProperty(object, key, {
			writable: true,
			value,
			enumerable: false
		});
	}
	function contain(array1, array2) {
		return array2.every((item) => array1.includes(item));
	}
	function intersection(array1, array2) {
		return array1.filter((item) => array2.includes(item));
	}
	function difference(array1, array2) {
		return array1.filter((item) => !array2.includes(item));
	}
	function union(array1, array2) {
		return Array.from(/* @__PURE__ */ new Set([...array1, ...array2]));
	}
	function deduplicate(array) {
		return [...new Set(array)];
	}
	function remove(list, item) {
		const index = list?.indexOf(item);
		if (index >= 0) {
			list.splice(index, 1);
			return true;
		} else return false;
	}
	function makeArray(source) {
		return Array.isArray(source) ? source : isNullable(source) ? [] : [source];
	}
	function is(type, value) {
		if (arguments.length === 1) return (value2) => is(type, value2);
		return type in globalThis && value instanceof globalThis[type] || Object.prototype.toString.call(value).slice(8, -1) === type;
	}
	function isArrayBufferLike(value) {
		return is("ArrayBuffer", value) || is("SharedArrayBuffer", value);
	}
	function isArrayBufferSource(value) {
		return isArrayBufferLike(value) || ArrayBuffer.isView(value);
	}
	var Binary;
	((Binary2) => {
		Binary2.is = isArrayBufferLike;
		Binary2.isSource = isArrayBufferSource;
		function fromSource(source) {
			if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
			else return source;
		}
		Binary2.fromSource = fromSource;
		function toBase64(source) {
			source = fromSource(source);
			if (typeof Buffer !== "undefined") return Buffer.from(source).toString("base64");
			let binary = "";
			const bytes = new Uint8Array(source);
			for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
			return btoa(binary);
		}
		Binary2.toBase64 = toBase64;
		function fromBase64(source) {
			if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "base64"));
			return Uint8Array.from(atob(source), (c) => c.charCodeAt(0));
		}
		Binary2.fromBase64 = fromBase64;
		function toHex(source) {
			source = fromSource(source);
			if (typeof Buffer !== "undefined") return Buffer.from(source).toString("hex");
			return Array.from(new Uint8Array(source), (byte) => byte.toString(16).padStart(2, "0")).join("");
		}
		Binary2.toHex = toHex;
		function fromHex(source) {
			if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "hex"));
			const hex = source.length % 2 === 0 ? source : source.slice(0, source.length - 1);
			const buffer = [];
			for (let i = 0; i < hex.length; i += 2) buffer.push(parseInt(`${hex[i]}${hex[i + 1]}`, 16));
			return Uint8Array.from(buffer).buffer;
		}
		Binary2.fromHex = fromHex;
	})(Binary || (Binary = {}));
	var base64ToArrayBuffer = Binary.fromBase64;
	var arrayBufferToBase64 = Binary.toBase64;
	var hexToArrayBuffer = Binary.fromHex;
	var arrayBufferToHex = Binary.toHex;
	function clone(source, refs = /* @__PURE__ */ new Map()) {
		if (!source || typeof source !== "object") return source;
		if (is("Date", source)) return new Date(source.valueOf());
		if (is("RegExp", source)) return new RegExp(source.source, source.flags);
		if (isArrayBufferLike(source)) return source.slice(0);
		if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
		const cached = refs.get(source);
		if (cached) return cached;
		if (Array.isArray(source)) {
			const result2 = [];
			refs.set(source, result2);
			source.forEach((value, index) => {
				result2[index] = Reflect.apply(clone, null, [value, refs]);
			});
			return result2;
		}
		const result = Object.create(Object.getPrototypeOf(source));
		refs.set(source, result);
		for (const key of Reflect.ownKeys(source)) {
			const descriptor = { ...Reflect.getOwnPropertyDescriptor(source, key) };
			if ("value" in descriptor) descriptor.value = Reflect.apply(clone, null, [descriptor.value, refs]);
			Reflect.defineProperty(result, key, descriptor);
		}
		return result;
	}
	function deepEqual(a, b, strict) {
		if (a === b) return true;
		if (!strict && isNullable(a) && isNullable(b)) return true;
		if (typeof a !== typeof b) return false;
		if (typeof a !== "object") return false;
		if (!a || !b) return false;
		function check(test, then) {
			return test(a) ? test(b) ? then(a, b) : false : test(b) ? false : void 0;
		}
		return check(Array.isArray, (a2, b2) => a2.length === b2.length && a2.every((item, index) => deepEqual(item, b2[index]))) ?? check(is("Date"), (a2, b2) => a2.valueOf() === b2.valueOf()) ?? check(is("RegExp"), (a2, b2) => a2.source === b2.source && a2.flags === b2.flags) ?? check(isArrayBufferLike, (a2, b2) => {
			if (a2.byteLength !== b2.byteLength) return false;
			const viewA = new Uint8Array(a2);
			const viewB = new Uint8Array(b2);
			for (let i = 0; i < viewA.length; i++) if (viewA[i] !== viewB[i]) return false;
			return true;
		}) ?? Object.keys({
			...a,
			...b
		}).every((key) => deepEqual(a[key], b[key], strict));
	}
	function capitalize(source) {
		return source.charAt(0).toUpperCase() + source.slice(1);
	}
	function uncapitalize(source) {
		return source.charAt(0).toLowerCase() + source.slice(1);
	}
	function camelCase(source) {
		return source.replace(/[_-][a-z]/g, (str) => str.slice(1).toUpperCase());
	}
	function tokenize(source, delimiters, delimiter) {
		const output = [];
		let state = 0;
		for (let i = 0; i < source.length; i++) {
			const code = source.charCodeAt(i);
			if (code >= 65 && code <= 90) {
				if (state === 1) {
					const next = source.charCodeAt(i + 1);
					if (next >= 97 && next <= 122) output.push(delimiter);
					output.push(code + 32);
				} else {
					if (state !== 0) output.push(delimiter);
					output.push(code + 32);
				}
				state = 1;
			} else if (code >= 97 && code <= 122) {
				output.push(code);
				state = 2;
			} else if (delimiters.includes(code)) {
				if (state !== 0) output.push(delimiter);
				state = 0;
			} else output.push(code);
		}
		return String.fromCharCode(...output);
	}
	function paramCase(source) {
		return tokenize(source, [45, 95], 45);
	}
	function snakeCase(source) {
		return tokenize(source, [45, 95], 95);
	}
	var camelize = camelCase;
	var hyphenate = paramCase;
	function formatProperty(key) {
		if (typeof key !== "string") return `[${key.toString()}]`;
		return /^[a-z_$][\w$]*$/i.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`;
	}
	function trimSlash(source) {
		return source.replace(/\/$/, "");
	}
	function sanitize(source) {
		if (!source.startsWith("/")) source = "/" + source;
		return trimSlash(source);
	}
	var Time;
	((Time2) => {
		Time2.millisecond = 1;
		Time2.second = 1e3;
		Time2.minute = Time2.second * 60;
		Time2.hour = Time2.minute * 60;
		Time2.day = Time2.hour * 24;
		Time2.week = Time2.day * 7;
		let timezoneOffset = (/* @__PURE__ */ new Date()).getTimezoneOffset();
		function setTimezoneOffset(offset) {
			timezoneOffset = offset;
		}
		Time2.setTimezoneOffset = setTimezoneOffset;
		function getTimezoneOffset() {
			return timezoneOffset;
		}
		Time2.getTimezoneOffset = getTimezoneOffset;
		function getDateNumber(date = /* @__PURE__ */ new Date(), offset) {
			if (typeof date === "number") date = new Date(date);
			if (offset === void 0) offset = timezoneOffset;
			return Math.floor((date.valueOf() / Time2.minute - offset) / 1440);
		}
		Time2.getDateNumber = getDateNumber;
		function fromDateNumber(value, offset) {
			const date = new Date(value * Time2.day);
			if (offset === void 0) offset = timezoneOffset;
			return new Date(+date + offset * Time2.minute);
		}
		Time2.fromDateNumber = fromDateNumber;
		const numeric = /\d+(?:\.\d+)?/.source;
		const timeRegExp = new RegExp(`^${[
			"w(?:eek(?:s)?)?",
			"d(?:ay(?:s)?)?",
			"h(?:our(?:s)?)?",
			"m(?:in(?:ute)?(?:s)?)?",
			"s(?:ec(?:ond)?(?:s)?)?"
		].map((unit) => `(${numeric}${unit})?`).join("")}$`);
		function parseTime(source) {
			const capture = timeRegExp.exec(source);
			if (!capture) return 0;
			return (parseFloat(capture[1]) * Time2.week || 0) + (parseFloat(capture[2]) * Time2.day || 0) + (parseFloat(capture[3]) * Time2.hour || 0) + (parseFloat(capture[4]) * Time2.minute || 0) + (parseFloat(capture[5]) * Time2.second || 0);
		}
		Time2.parseTime = parseTime;
		function parseDate(date) {
			const parsed = parseTime(date);
			if (parsed) date = Date.now() + parsed;
			else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).toLocaleDateString()}-${date}`;
			else if (/^\d{1,2}-\d{1,2}-\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).getFullYear()}-${date}`;
			return date ? new Date(date) : /* @__PURE__ */ new Date();
		}
		Time2.parseDate = parseDate;
		function format(ms) {
			const abs = Math.abs(ms);
			if (abs >= Time2.day - Time2.hour / 2) return Math.round(ms / Time2.day) + "d";
			else if (abs >= Time2.hour - Time2.minute / 2) return Math.round(ms / Time2.hour) + "h";
			else if (abs >= Time2.minute - Time2.second / 2) return Math.round(ms / Time2.minute) + "m";
			else if (abs >= Time2.second) return Math.round(ms / Time2.second) + "s";
			return ms + "ms";
		}
		Time2.format = format;
		function toDigits(source, length = 2) {
			return source.toString().padStart(length, "0");
		}
		Time2.toDigits = toDigits;
		function template(template2, time = /* @__PURE__ */ new Date()) {
			return template2.replace("yyyy", time.getFullYear().toString()).replace("yy", time.getFullYear().toString().slice(2)).replace("MM", toDigits(time.getMonth() + 1)).replace("dd", toDigits(time.getDate())).replace("hh", toDigits(time.getHours())).replace("mm", toDigits(time.getMinutes())).replace("ss", toDigits(time.getSeconds())).replace("SSS", toDigits(time.getMilliseconds(), 3));
		}
		Time2.template = template;
	})(Time || (Time = {}));
	0 && (module.exports = {
		Binary,
		Time,
		arrayBufferToBase64,
		arrayBufferToHex,
		base64ToArrayBuffer,
		camelCase,
		camelize,
		capitalize,
		clone,
		contain,
		deduplicate,
		deepEqual,
		defineProperty,
		difference,
		filterKeys,
		formatProperty,
		hexToArrayBuffer,
		hyphenate,
		intersection,
		is,
		isNonNullable,
		isNullable,
		isPlainObject,
		makeArray,
		mapValues,
		noop,
		omit,
		paramCase,
		pick,
		remove,
		sanitize,
		snakeCase,
		trimSlash,
		uncapitalize,
		union,
		valueMap
	});
}));
//#endregion
//#region src/store.ts
var import_lib = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports, module) => {
	var __defProp = Object.defineProperty;
	var __name = (target, value) => __defProp(target, "name", {
		value,
		configurable: true
	});
	var import_cosmokit = require_lib$1();
	var kSchema = Symbol.for("schemastery");
	var kValidationError = Symbol.for("ValidationError");
	globalThis.__schemastery_index__ ??= 0;
	globalThis.__schemastery_refs__ = void 0;
	var ValidationError = class extends TypeError {
		constructor(message, options) {
			let prefix = "$";
			for (const segment of options.path || []) if (typeof segment === "string") prefix += "." + segment;
			else if (typeof segment === "number") prefix += "[" + segment + "]";
			else if (typeof segment === "symbol") prefix += `[Symbol(${segment.toString()})]`;
			if (prefix.startsWith(".")) prefix = prefix.slice(1);
			super((prefix === "$" ? "" : `${prefix} `) + message);
			this.options = options;
		}
		static {
			__name(this, "ValidationError");
		}
		name = "ValidationError";
		static is(error) {
			return !!error?.[kValidationError];
		}
	};
	Object.defineProperty(ValidationError.prototype, kValidationError, { value: true });
	var Schema = /* @__PURE__ */ __name(function(options) {
		const schema = /* @__PURE__ */ __name(function(data, options2 = {}) {
			return Schema.resolve(data, schema, options2)[0];
		}, "schema");
		if (options.refs) {
			const refs = (0, import_cosmokit.valueMap)(options.refs, (options2) => new Schema(options2));
			const getRef = /* @__PURE__ */ __name((uid) => refs[uid], "getRef");
			for (const key in refs) {
				const options2 = refs[key];
				options2.sKey = getRef(options2.sKey);
				options2.inner = getRef(options2.inner);
				options2.list = options2.list && options2.list.map(getRef);
				options2.dict = options2.dict && (0, import_cosmokit.valueMap)(options2.dict, getRef);
			}
			return refs[options.uid];
		}
		Object.assign(schema, options);
		if (typeof schema.callback === "string") try {
			schema.callback = new Function("return " + schema.callback)();
		} catch {}
		Object.defineProperty(schema, "uid", { value: globalThis.__schemastery_index__++ });
		Object.setPrototypeOf(schema, Schema.prototype);
		schema.meta ||= {};
		schema.toString = schema.toString.bind(schema);
		return schema;
	}, "Schema");
	Schema.prototype = Object.create(Function.prototype);
	Schema.prototype[kSchema] = true;
	Object.defineProperty(Schema.prototype, "~standard", { get() {
		return {
			version: 1,
			vendor: "schemastery",
			validate: /* @__PURE__ */ __name((value) => {
				try {
					return { value: Schema.resolve(value, this, {})[0] };
				} catch (error) {
					if (ValidationError.is(error)) return { issues: [{
						message: error.message,
						path: error.options.path
					}] };
					throw error;
				}
			}, "validate")
		};
	} });
	Schema.ValidationError = ValidationError;
	Schema.prototype.toJSON = /* @__PURE__ */ __name(function toJSON() {
		if (globalThis.__schemastery_refs__) {
			globalThis.__schemastery_refs__[this.uid] ??= JSON.parse(JSON.stringify({ ...this }));
			return this.uid;
		}
		globalThis.__schemastery_refs__ = { [this.uid]: { ...this } };
		globalThis.__schemastery_refs__[this.uid] = JSON.parse(JSON.stringify({ ...this }));
		const result = {
			uid: this.uid,
			refs: globalThis.__schemastery_refs__
		};
		globalThis.__schemastery_refs__ = void 0;
		return result;
	}, "toJSON");
	Schema.prototype.set = /* @__PURE__ */ __name(function set(key, value) {
		this.dict[key] = value;
		return this;
	}, "set");
	Schema.prototype.push = /* @__PURE__ */ __name(function push(value) {
		this.list.push(value);
		return this;
	}, "push");
	function mergeDesc(original, messages) {
		const result = typeof original === "string" ? { "": original } : { ...original };
		for (const locale in messages) {
			const value = messages[locale];
			if (value?.$description || value?.$desc) result[locale] = value.$description || value.$desc;
			else if (typeof value === "string") result[locale] = value;
		}
		return result;
	}
	__name(mergeDesc, "mergeDesc");
	function getInner(value) {
		return value?.$value ?? value?.$inner;
	}
	__name(getInner, "getInner");
	function extractKeys(data) {
		return (0, import_cosmokit.filterKeys)(data ?? {}, (key) => !key.startsWith("$"));
	}
	__name(extractKeys, "extractKeys");
	Schema.prototype.i18n = /* @__PURE__ */ __name(function i18n(messages) {
		const schema = Schema(this);
		const desc = mergeDesc(schema.meta.description, messages);
		if (Object.keys(desc).length) schema.meta.description = desc;
		if (schema.dict) schema.dict = (0, import_cosmokit.valueMap)(schema.dict, (inner, key) => {
			return inner.i18n((0, import_cosmokit.valueMap)(messages, (data) => getInner(data)?.[key] ?? data?.[key]));
		});
		if (schema.list) schema.list = schema.list.map((inner, index) => {
			return inner.i18n((0, import_cosmokit.valueMap)(messages, (data = {}) => {
				if (Array.isArray(getInner(data))) return getInner(data)[index];
				if (Array.isArray(data)) return data[index];
				return extractKeys(data);
			}));
		});
		if (schema.inner) schema.inner = schema.inner.i18n((0, import_cosmokit.valueMap)(messages, (data) => {
			if (getInner(data)) return getInner(data);
			return extractKeys(data);
		}));
		if (schema.sKey) schema.sKey = schema.sKey.i18n((0, import_cosmokit.valueMap)(messages, (data) => data?.$key));
		return schema;
	}, "i18n");
	Schema.prototype.extra = /* @__PURE__ */ __name(function extra(key, value) {
		const schema = Schema(this);
		schema.meta = {
			...schema.meta,
			[key]: value
		};
		return schema;
	}, "extra");
	for (const key of [
		"required",
		"disabled",
		"collapse",
		"hidden",
		"loose"
	]) Object.assign(Schema.prototype, { [key](value = true) {
		const schema = Schema(this);
		schema.meta = {
			...schema.meta,
			[key]: value
		};
		return schema;
	} });
	Schema.prototype.deprecated = /* @__PURE__ */ __name(function deprecated() {
		const schema = Schema(this);
		schema.meta.badges ||= [];
		schema.meta.badges.push({
			text: "deprecated",
			type: "danger"
		});
		return schema;
	}, "deprecated");
	Schema.prototype.experimental = /* @__PURE__ */ __name(function experimental() {
		const schema = Schema(this);
		schema.meta.badges ||= [];
		schema.meta.badges.push({
			text: "experimental",
			type: "warning"
		});
		return schema;
	}, "experimental");
	Schema.prototype.pattern = /* @__PURE__ */ __name(function pattern(regexp) {
		const schema = Schema(this);
		const pattern2 = (0, import_cosmokit.pick)(regexp, ["source", "flags"]);
		schema.meta = {
			...schema.meta,
			pattern: pattern2
		};
		return schema;
	}, "pattern");
	Schema.prototype.simplify = /* @__PURE__ */ __name(function simplify(value) {
		if ((0, import_cosmokit.deepEqual)(value, this.meta.default, this.type === "dict")) return null;
		if ((0, import_cosmokit.isNullable)(value)) return value;
		if (this.type === "object" || this.type === "dict") {
			const result = {};
			for (const key in value) {
				const item = (this.type === "object" ? this.dict[key] : this.inner)?.simplify(value[key]);
				if (this.type === "dict" || !(0, import_cosmokit.isNullable)(item)) result[key] = item;
			}
			if ((0, import_cosmokit.deepEqual)(result, this.meta.default, this.type === "dict")) return null;
			return result;
		} else if (this.type === "array" || this.type === "tuple") {
			const result = [];
			value.forEach((value2, index) => {
				const schema = this.type === "array" ? this.inner : this.list[index];
				const item = schema ? schema.simplify(value2) : value2;
				result.push(item);
			});
			return result;
		} else if (this.type === "intersect") {
			const result = {};
			for (const item of this.list) Object.assign(result, item.simplify(value));
			return result;
		} else if (this.type === "union") for (const schema of this.list) try {
			Schema.resolve(value, schema, {});
			return schema.simplify(value);
		} catch {}
		return value;
	}, "simplify");
	Schema.prototype.toString = /* @__PURE__ */ __name(function toString(inline) {
		return formatters[this.type]?.(this, inline) ?? `Schema<${this.type}>`;
	}, "toString");
	Schema.prototype.role = /* @__PURE__ */ __name(function role(role, extra2) {
		const schema = Schema(this);
		schema.meta = {
			...schema.meta,
			role,
			extra: extra2
		};
		return schema;
	}, "role");
	for (const key of [
		"default",
		"link",
		"comment",
		"description",
		"max",
		"min",
		"step"
	]) Object.assign(Schema.prototype, { [key](value) {
		const schema = Schema(this);
		schema.meta = {
			...schema.meta,
			[key]: value
		};
		return schema;
	} });
	var resolvers = {};
	Schema.extend = /* @__PURE__ */ __name(function extend(type, resolve2) {
		resolvers[type] = resolve2;
	}, "extend");
	Schema.resolve = /* @__PURE__ */ __name(function resolve(data, schema, options = {}, strict = false) {
		if (!schema) return [data];
		if (options.ignore?.(data, schema)) return [data];
		if ((0, import_cosmokit.isNullable)(data) && schema.type !== "lazy") {
			if (schema.meta.required) throw new ValidationError(`missing required value`, options);
			let current = schema;
			let fallback = schema.meta.default;
			while (current?.type === "intersect" && (0, import_cosmokit.isNullable)(fallback)) {
				current = current.list[0];
				fallback = current?.meta.default;
			}
			if ((0, import_cosmokit.isNullable)(fallback)) return [data];
			data = (0, import_cosmokit.clone)(fallback);
		}
		const callback = resolvers[schema.type];
		if (!callback) throw new ValidationError(`unsupported type "${schema.type}"`, options);
		try {
			return callback(data, schema, options, strict);
		} catch (error) {
			if (!schema.meta.loose) throw error;
			return [schema.meta.default];
		}
	}, "resolve");
	Schema.from = /* @__PURE__ */ __name(function from(source) {
		if ((0, import_cosmokit.isNullable)(source)) return Schema.any();
		else if ([
			"string",
			"number",
			"boolean"
		].includes(typeof source)) return Schema.const(source).required();
		else if (source[kSchema]) return source;
		else if (typeof source === "function") switch (source) {
			case String: return Schema.string().required();
			case Number: return Schema.number().required();
			case Boolean: return Schema.boolean().required();
			case Function: return Schema.function().required();
			default: return Schema.is(source).required();
		}
		else throw new TypeError(`cannot infer schema from ${source}`);
	}, "from");
	Schema.lazy = /* @__PURE__ */ __name(function lazy(builder) {
		const schema = new Schema({
			type: "lazy",
			builder,
			inner: { toJSON: /* @__PURE__ */ __name(() => {
				if (!schema.inner[kSchema]) {
					schema.inner = schema.builder();
					schema.inner.meta = {
						...schema.meta,
						...schema.inner.meta
					};
				}
				return schema.inner.toJSON();
			}, "toJSON") }
		});
		return schema;
	}, "lazy");
	Schema.natural = /* @__PURE__ */ __name(function natural() {
		return Schema.number().step(1).min(0);
	}, "natural");
	Schema.percent = /* @__PURE__ */ __name(function percent() {
		return Schema.number().step(.01).min(0).max(1).role("slider");
	}, "percent");
	Schema.date = /* @__PURE__ */ __name(function date() {
		return Schema.union([Schema.is(Date), Schema.transform(Schema.string().role("datetime"), (value, options) => {
			const date2 = new Date(value);
			if (isNaN(+date2)) throw new ValidationError(`invalid date "${value}"`, options);
			return date2;
		}, true)]);
	}, "date");
	Schema.regExp = /* @__PURE__ */ __name(function regExp(flag = "") {
		return Schema.union([Schema.is(RegExp), Schema.transform(Schema.string().role("regexp", { flag }), (value, options) => {
			try {
				return new RegExp(value, flag);
			} catch (e) {
				throw new ValidationError(e.message, options);
			}
		}, true)]);
	}, "regExp");
	Schema.arrayBuffer = /* @__PURE__ */ __name(function arrayBuffer(encoding) {
		return Schema.union([
			Schema.is(ArrayBuffer),
			Schema.is(SharedArrayBuffer),
			Schema.transform(Schema.any(), (value, options) => {
				if (import_cosmokit.Binary.isSource(value)) return import_cosmokit.Binary.fromSource(value);
				throw new ValidationError(`expected ArrayBufferSource but got ${value}`, options);
			}, true),
			...encoding ? [Schema.transform(Schema.string(), (value, options) => {
				try {
					return encoding === "base64" ? import_cosmokit.Binary.fromBase64(value) : import_cosmokit.Binary.fromHex(value);
				} catch (e) {
					throw new ValidationError(e.message, options);
				}
			}, true)] : []
		]);
	}, "arrayBuffer");
	Schema.extend("lazy", (data, schema, options, strict) => {
		if (!schema.inner[kSchema]) {
			schema.inner = schema.builder();
			schema.inner.meta = {
				...schema.meta,
				...schema.inner.meta
			};
		}
		return Schema.resolve(data, schema.inner, options, strict);
	});
	Schema.extend("any", (data) => {
		return [data];
	});
	Schema.extend("never", (data, _, options) => {
		throw new ValidationError(`expected nullable but got ${data}`, options);
	});
	Schema.extend("const", (data, { value }, options) => {
		if ((0, import_cosmokit.deepEqual)(data, value)) return [value];
		throw new ValidationError(`expected ${value} but got ${data}`, options);
	});
	function checkWithinRange(data, meta, description, options, skipMin = false) {
		const { max = Infinity, min = -Infinity } = meta;
		if (data > max) throw new ValidationError(`expected ${description} <= ${max} but got ${data}`, options);
		if (data < min && !skipMin) throw new ValidationError(`expected ${description} >= ${min} but got ${data}`, options);
	}
	__name(checkWithinRange, "checkWithinRange");
	Schema.extend("string", (data, { meta }, options) => {
		if (typeof data !== "string") throw new ValidationError(`expected string but got ${data}`, options);
		if (meta.pattern) {
			const regexp = new RegExp(meta.pattern.source, meta.pattern.flags);
			if (!regexp.test(data)) throw new ValidationError(`expect string to match regexp ${regexp}`, options);
		}
		checkWithinRange(data.length, meta, "string length", options);
		return [data];
	});
	function decimalShift(data, digits) {
		const str = data.toString();
		if (str.includes("e")) return data * Math.pow(10, digits);
		const index = str.indexOf(".");
		if (index === -1) return data * Math.pow(10, digits);
		const frac = str.slice(index + 1);
		const integer = str.slice(0, index);
		if (frac.length <= digits) return +(integer + frac.padEnd(digits, "0"));
		return +(integer + frac.slice(0, digits) + "." + frac.slice(digits));
	}
	__name(decimalShift, "decimalShift");
	function isMultipleOf(data, min, step) {
		step = Math.abs(step);
		if (!/^\d+\.\d+$/.test(step.toString())) return (data - min) % step === 0;
		const index = step.toString().indexOf(".");
		const digits = step.toString().slice(index + 1).length;
		return Math.abs(decimalShift(data, digits) - decimalShift(min, digits)) % decimalShift(step, digits) === 0;
	}
	__name(isMultipleOf, "isMultipleOf");
	Schema.extend("number", (data, { meta }, options) => {
		if (typeof data !== "number") throw new ValidationError(`expected number but got ${data}`, options);
		checkWithinRange(data, meta, "number", options);
		const { step } = meta;
		if (step && !isMultipleOf(data, meta.min ?? 0, step)) throw new ValidationError(`expected number multiple of ${step} but got ${data}`, options);
		return [data];
	});
	Schema.extend("boolean", (data, _, options) => {
		if (typeof data === "boolean") return [data];
		throw new ValidationError(`expected boolean but got ${data}`, options);
	});
	Schema.extend("bitset", (data, { bits, meta }, options) => {
		let value = 0, keys = [];
		if (typeof data === "number") {
			value = data;
			for (const key in bits) if (data & bits[key]) keys.push(key);
		} else if (Array.isArray(data)) {
			keys = data;
			for (const key of keys) {
				if (typeof key !== "string") throw new ValidationError(`expected string but got ${key}`, options);
				if (key in bits) value |= bits[key];
			}
		} else throw new ValidationError(`expected number or array but got ${data}`, options);
		if (value === meta.default) return [value];
		return [value, keys];
	});
	Schema.extend("function", (data, _, options) => {
		if (typeof data === "function") return [data];
		throw new ValidationError(`expected function but got ${data}`, options);
	});
	Schema.extend("is", (data, { constructor }, options) => {
		if (typeof constructor === "function") {
			if (data instanceof constructor) return [data];
			throw new ValidationError(`expected ${constructor.name} but got ${data}`, options);
		} else {
			if ((0, import_cosmokit.isNullable)(data)) throw new ValidationError(`expected ${constructor} but got ${data}`, options);
			let prototype = Object.getPrototypeOf(data);
			while (prototype) {
				if (prototype.constructor?.name === constructor) return [data];
				prototype = Object.getPrototypeOf(prototype);
			}
			throw new ValidationError(`expected ${constructor} but got ${data}`, options);
		}
	});
	function property(data, key, schema, options) {
		try {
			const [value, adapted] = Schema.resolve(data[key], schema, {
				...options,
				path: [...options.path || [], key]
			});
			if (adapted !== void 0) data[key] = adapted;
			return value;
		} catch (e) {
			if (!options?.autofix) throw e;
			delete data[key];
			return schema.meta.default;
		}
	}
	__name(property, "property");
	Schema.extend("array", (data, { inner, meta }, options) => {
		if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
		checkWithinRange(data.length, meta, "array length", options, !(0, import_cosmokit.isNullable)(inner.meta.default));
		return [data.map((_, index) => property(data, index, inner, options))];
	});
	Schema.extend("dict", (data, { inner, sKey }, options, strict) => {
		if (!(0, import_cosmokit.isPlainObject)(data)) throw new ValidationError(`expected object but got ${data}`, options);
		const result = {};
		for (const key in data) {
			let rKey;
			try {
				rKey = Schema.resolve(key, sKey, options)[0];
			} catch (error) {
				if (strict) continue;
				throw error;
			}
			result[rKey] = property(data, key, inner, options);
			data[rKey] = data[key];
			if (key !== rKey) delete data[key];
		}
		return [result];
	});
	Schema.extend("tuple", (data, { list }, options, strict) => {
		if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
		const result = list.map((inner, index) => property(data, index, inner, options));
		if (strict) return [result];
		result.push(...data.slice(list.length));
		return [result];
	});
	function merge(result, data) {
		for (const key in data) {
			if (key in result) continue;
			result[key] = data[key];
		}
	}
	__name(merge, "merge");
	Schema.extend("object", (data, { dict }, options, strict) => {
		if (!(0, import_cosmokit.isPlainObject)(data)) throw new ValidationError(`expected object but got ${data}`, options);
		const result = {};
		for (const key in dict) {
			const value = property(data, key, dict[key], options);
			if (!(0, import_cosmokit.isNullable)(value) || key in data) result[key] = value;
		}
		if (!strict) merge(result, data);
		return [result];
	});
	Schema.extend("union", (data, { list, toString: toString2 }, options, strict) => {
		const messages = [];
		for (const inner of list) try {
			return Schema.resolve(data, inner, options, strict);
		} catch (error) {
			messages.push(error);
		}
		throw new ValidationError(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
	});
	Schema.extend("intersect", (data, { list, toString: toString2 }, options, strict) => {
		if (!list.length) return [data];
		let result;
		for (const inner of list) {
			const value = Schema.resolve(data, inner, options, true)[0];
			if ((0, import_cosmokit.isNullable)(value)) continue;
			if ((0, import_cosmokit.isNullable)(result)) result = value;
			else if (typeof result !== typeof value) throw new ValidationError(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
			else if (typeof value === "object") merge(result ??= {}, value);
			else if (result !== value) throw new ValidationError(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
		}
		if (!strict && (0, import_cosmokit.isPlainObject)(data)) merge(result, data);
		return [result];
	});
	Schema.extend("transform", (data, { inner, callback, preserve }, options) => {
		const [result, adapted = data] = Schema.resolve(data, inner, options, true);
		if (preserve) return [callback(result)];
		else return [callback(result), callback(adapted)];
	});
	var formatters = {};
	function defineMethod(name, keys, format) {
		formatters[name] = format;
		Object.assign(Schema, { [name](...args) {
			const schema = new Schema({ type: name });
			keys.forEach((key, index) => {
				switch (key) {
					case "sKey":
						schema.sKey = args[index] ?? Schema.string();
						break;
					case "inner":
						schema.inner = Schema.from(args[index]);
						break;
					case "list":
						schema.list = args[index].map(Schema.from);
						break;
					case "dict":
						schema.dict = (0, import_cosmokit.valueMap)(args[index], Schema.from);
						break;
					case "bits":
						schema.bits = {};
						for (const key2 in args[index]) {
							if (typeof args[index][key2] !== "number") continue;
							schema.bits[key2] = args[index][key2];
						}
						break;
					case "callback": {
						const callback = schema.callback = args[index];
						callback["toJSON"] ||= () => callback.toString();
						break;
					}
					case "constructor": {
						const constructor = schema.constructor = args[index];
						if (typeof constructor === "function") constructor["toJSON"] ||= () => constructor["name"];
						break;
					}
					default: schema[key] = args[index];
				}
			});
			if (name === "object" || name === "dict") schema.meta.default = {};
			else if (name === "array" || name === "tuple") schema.meta.default = [];
			else if (name === "bitset") schema.meta.default = 0;
			return schema;
		} });
	}
	__name(defineMethod, "defineMethod");
	defineMethod("is", ["constructor"], ({ constructor }) => {
		if (typeof constructor === "function") return constructor.name;
		else return constructor;
	});
	defineMethod("any", [], () => "any");
	defineMethod("never", [], () => "never");
	defineMethod("const", ["value"], ({ value }) => typeof value === "string" ? JSON.stringify(value) : value);
	defineMethod("string", [], () => "string");
	defineMethod("number", [], () => "number");
	defineMethod("boolean", [], () => "boolean");
	defineMethod("bitset", ["bits"], () => "bitset");
	defineMethod("function", [], () => "function");
	defineMethod("array", ["inner"], ({ inner }) => `${inner.toString(true)}[]`);
	defineMethod("dict", ["inner", "sKey"], ({ inner, sKey }) => `{ [key: ${sKey.toString()}]: ${inner.toString()} }`);
	defineMethod("tuple", ["list"], ({ list }) => `[${list.map((inner) => inner.toString()).join(", ")}]`);
	defineMethod("object", ["dict"], ({ dict }) => {
		if (Object.keys(dict).length === 0) return "{}";
		return `{ ${Object.entries(dict).map(([key, inner]) => {
			return `${key}${inner.meta.required ? "" : "?"}: ${inner.toString()}`;
		}).join(", ")} }`;
	});
	defineMethod("union", ["list"], ({ list }, inline) => {
		const result = list.map(({ toString: format }) => format()).join(" | ");
		return inline ? `(${result})` : result;
	});
	defineMethod("intersect", ["list"], ({ list }) => {
		return `${list.map((inner) => inner.toString(true)).join(" & ")}`;
	});
	defineMethod("transform", [
		"inner",
		"callback",
		"preserve"
	], ({ inner }, isInner) => inner.toString(isInner));
	module.exports = Schema;
})))(), 1);
/**
* Host config store: one JSON file (`~/.dsh/remote-ssh.json`) holding every
* SSH host entry plus the recent remote workspaces, written atomically
* (tmp + rename). Also parses the user's standard `~/.ssh/config` — both for
* the form's alias auto-fill (read-only) and for one-shot import.
*
* SECURITY: this file never contains secret material. Passwords and key
* passphrases live in DSH's official credential store (ctx.credentials →
* `~/.dsh/.credentials.yaml`, owner-only) and are resolved per connect.
*
* LEGACY: the marketplace dsh-ssh plugin kept its hosts in
* `~/.dsh/dsh-ssh.json` (with inline plaintext secrets in old versions).
* `extractLegacyStore()` lifts those entries — and their inline secrets —
* into this store once, so switching plugins loses nothing.
*/
/** File format version. */
const FORMAT_VERSION = 1;
/** Cap on remembered recent workspaces. */
const RECENTS_CAP = 20;
/** Store file location: <home>/.dsh/remote-ssh.json. */
function storePath() {
	return join(homedir(), ".dsh", "remote-ssh.json");
}
/** The legacy marketplace plugin's store location. */
function legacyStorePath() {
	return join(homedir(), ".dsh", "dsh-ssh.json");
}
/** The user's standard OpenSSH config path. */
function sshConfigPath() {
	return join(homedir(), ".ssh", "config");
}
/** Validate the wire shape of a host payload; returns a message or undefined. */
function validateHostPayload(payload) {
	if (typeof payload !== "object" || payload === null) return "body must be a JSON object";
	const p = payload;
	if (typeof p.host !== "string" || p.host.trim() === "") return "host is required";
	if (typeof p.user !== "string" || p.user.trim() === "") return "user is required";
	const auth = p.auth;
	if (auth !== void 0) {
		if (typeof auth !== "object" || auth === null) return "auth must be an object";
		if (auth.kind !== "key" && auth.kind !== "password") return "auth.kind must be key or password";
		if (auth.kind === "key" && (typeof auth.keyPath !== "string" || auth.keyPath.trim() === "")) return "auth.keyPath is required for key auth";
		if (auth.kind === "password" && auth.password !== void 0 && typeof auth.password !== "string") return "auth.password must be a string when provided";
	}
	if (p.port !== void 0 && (typeof p.port !== "number" || !Number.isInteger(p.port) || p.port < 1 || p.port > 65535)) return "port must be an integer in 1..65535";
	if (p.proxyJump !== void 0 && (!Array.isArray(p.proxyJump) || p.proxyJump.some((x) => typeof x !== "string" || x === ""))) return "proxyJump must be an array of alias strings";
	if (p.workspace !== void 0 && typeof p.workspace !== "string") return "workspace must be a string";
}
/** Alias grammar: letters/digits plus dots, hyphens, underscores (IP/domain aliases included). */
const ALIAS_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
/** Validate an alias for creation. */
function validateAlias(alias) {
	if (!ALIAS_RE.test(alias)) return "alias must be letters, digits, dots, hyphens or underscores";
}
/** Parse ~/.ssh/config into blocks (empty when the file is absent). */
function parseSshConfig(configPath) {
	if (!existsSync(configPath)) return [];
	const blocks = [];
	let current;
	for (const raw of readFileSync(configPath, "utf8").split(/\r?\n/)) {
		const line = raw.trim();
		if (line === "" || line.startsWith("#")) continue;
		const match = /^([A-Za-z0-9_\-]+)\s+(.+)$/.exec(line);
		if (match === null) continue;
		const key = match[1].toLowerCase();
		const value = match[2].trim();
		if (key === "host") {
			current = {
				pattern: value,
				props: {}
			};
			blocks.push(current);
		} else if (current !== void 0) current.props[key] = value;
	}
	return blocks;
}
/**
* The host store. Pure file I/O — no cordis dependency, unit-testable.
*/
var HostStore = class {
	/** The JSON file path. */
	path;
	/** Optional overrides for tests. */
	sshConfigOverride;
	legacyOverride;
	/**
	* @param path - store file path (defaults to the standard location).
	* @param overrides - ssh config / legacy store path overrides (tests only).
	*/
	constructor(path, overrides) {
		this.path = resolve(path ?? storePath());
		this.sshConfigOverride = overrides?.sshConfig;
		this.legacyOverride = overrides?.legacy;
	}
	/** Load all entries (empty store when the file is absent). */
	list() {
		return this.load().hosts;
	}
	/** Find one entry by alias. */
	find(alias) {
		return this.list().find((entry) => entry.alias === alias);
	}
	/** Secret-free projection for the browser and agent surfaces. */
	summarize(entry) {
		let keyReady = true;
		if (entry.auth.kind === "key" && entry.auth.keyPath) keyReady = existsSync(expandHome(entry.auth.keyPath));
		return {
			alias: entry.alias,
			host: entry.host,
			port: entry.port,
			user: entry.user,
			auth: entry.auth.kind,
			...entry.auth.kind === "key" && entry.auth.keyPath ? { keyPath: entry.auth.keyPath } : {},
			keyReady,
			proxyJump: [...entry.proxyJump],
			passwordConfigured: entry.auth.kind === "password" && entry.auth.passwordConfigured === true,
			passphraseConfigured: entry.auth.kind === "key" && entry.auth.passphraseConfigured === true,
			...entry.workspace !== void 0 && entry.workspace !== "" ? { workspace: entry.workspace } : {},
			...entry.description !== void 0 ? { description: entry.description } : {},
			createdAt: entry.createdAt,
			updatedAt: entry.updatedAt
		};
	}
	/** Create one entry. Throws on alias collision or invalid payload. */
	create(payload) {
		const alias = payload.alias?.trim();
		if (!alias) throw new Error("alias is required");
		const aliasError = validateAlias(alias);
		if (aliasError !== void 0) throw new Error(aliasError);
		const bodyError = validateHostPayload(payload);
		if (bodyError !== void 0) throw new Error(bodyError);
		if (payload.auth === void 0) throw new Error("auth is required");
		const file = this.load();
		if (file.hosts.some((entry) => entry.alias === alias)) throw new Error(`alias '${alias}' already exists`);
		const now = Date.now();
		const entry = {
			alias,
			host: payload.host.trim(),
			port: payload.port ?? 22,
			user: payload.user.trim(),
			auth: {
				kind: payload.auth.kind,
				keyPath: payload.auth.kind === "key" ? expandHome(payload.auth.keyPath?.trim() ?? "") : void 0,
				passwordConfigured: payload.auth.kind === "password" && hasValue(payload.auth.password),
				passphraseConfigured: payload.auth.kind === "key" && hasValue(payload.auth.passphrase)
			},
			workspace: payload.workspace?.trim() || void 0,
			proxyJump: [...payload.proxyJump ?? []],
			description: payload.description?.trim() || void 0,
			createdAt: now,
			updatedAt: now
		};
		file.hosts.push(entry);
		this.save(file);
		return entry;
	}
	/** Update the fields present in `patch`; unknown aliases throw. */
	update(alias, patch) {
		const file = this.load();
		const entry = file.hosts.find((candidate) => candidate.alias === alias);
		if (entry === void 0) throw new Error(`alias '${alias}' not found`);
		const bodyError = validateHostPayload({
			host: patch.host ?? entry.host,
			user: patch.user ?? entry.user,
			...patch
		});
		if (bodyError !== void 0) throw new Error(bodyError);
		if (patch.host !== void 0) entry.host = patch.host.trim();
		if (patch.port !== void 0) entry.port = patch.port;
		if (patch.user !== void 0) entry.user = patch.user.trim();
		if (patch.workspace !== void 0) entry.workspace = patch.workspace.trim() || void 0;
		if (patch.auth !== void 0) {
			const auth = patch.auth;
			const keyChanged = auth.kind === "key" && auth.keyPath !== void 0 && expandHome(auth.keyPath.trim()) !== entry.auth.keyPath;
			const keepPassphrase = auth.kind === "key" && auth.passphrase === void 0 && !keyChanged && entry.auth.passphraseConfigured === true;
			entry.auth = {
				kind: auth.kind,
				keyPath: auth.kind === "key" ? expandHome(auth.keyPath?.trim() ?? "") : void 0,
				passwordConfigured: auth.kind === "password" ? hasValue(auth.password) || auth.password === void 0 && entry.auth.passwordConfigured === true && auth.kind === entry.auth.kind : void 0,
				passphraseConfigured: auth.kind === "key" ? keepPassphrase || hasValue(auth.passphrase) : void 0
			};
		}
		if (patch.proxyJump !== void 0) entry.proxyJump = [...patch.proxyJump];
		if (patch.description !== void 0) entry.description = patch.description.trim() || void 0;
		entry.updatedAt = Date.now();
		this.save(file);
		return entry;
	}
	/** Remove one entry. */
	delete(alias) {
		const file = this.load();
		const index = file.hosts.findIndex((candidate) => candidate.alias === alias);
		if (index < 0) throw new Error(`alias '${alias}' not found`);
		file.hosts.splice(index, 1);
		file.recents = file.recents.filter((recent) => recent.alias !== alias);
		this.save(file);
	}
	/** Remember a workspace opening (ZCode-style recent list, newest first). */
	addRecent(alias, dir) {
		if (dir.trim() === "") return;
		const file = this.load();
		file.recents = file.recents.filter((recent) => !(recent.alias === alias && recent.dir === dir));
		file.recents.unshift({
			alias,
			dir,
			at: Date.now()
		});
		if (file.recents.length > RECENTS_CAP) file.recents.length = RECENTS_CAP;
		this.save(file);
	}
	/** The recent workspace list (newest first). */
	listRecents() {
		return [...this.load().recents];
	}
	/** The persisted remote-session bindings (sessionId → remote workspace). */
	loadBindings() {
		return this.load().bindings ?? {};
	}
	/** Persist the remote-session bindings map. */
	saveBindings(bindings) {
		const file = this.load();
		file.bindings = bindings;
		this.save(file);
	}
	/**
	* Read ~/.ssh/config Host blocks for the form's alias auto-fill — a pure
	* read, nothing is created. Non-wildcard blocks with a HostName qualify.
	*/
	listSshConfigAliases() {
		const blocks = parseSshConfig(this.sshConfigOverride ?? sshConfigPath());
		const aliases = [];
		for (const block of blocks) {
			const pattern = block.pattern.split(/\s+/)[0];
			if (pattern.includes("*") || pattern.includes("?")) continue;
			const hostName = block.props.hostname;
			if (hostName === void 0 || hostName === "") continue;
			aliases.push({
				alias: pattern,
				host: hostName,
				port: block.props.port !== void 0 ? Number.parseInt(block.props.port, 10) || 22 : 22,
				...block.props.user !== void 0 ? { user: block.props.user } : {},
				...block.props.identityfile !== void 0 ? { identityFile: block.props.identityfile } : {},
				...block.props.proxyjump !== void 0 ? { proxyJump: block.props.proxyjump } : {}
			});
		}
		return aliases;
	}
	/**
	* Import hosts from `~/.ssh/config`: Host blocks with a single non-wildcard
	* pattern and a HostName become entries (key auth via IdentityFile, jump
	* hosts via ProxyJump). Existing aliases are skipped.
	* @returns import statistics.
	*/
	importFromSshConfig() {
		const blocks = parseSshConfig(this.sshConfigOverride ?? sshConfigPath());
		const skippedNames = /* @__PURE__ */ new Set();
		let added = 0;
		for (const block of blocks) {
			const pattern = block.pattern.split(/\s+/)[0];
			if (pattern.includes("*") || pattern.includes("?")) {
				skippedNames.add(pattern);
				continue;
			}
			const hostName = block.props.hostname;
			if (hostName === void 0 || hostName === "") {
				skippedNames.add(pattern);
				continue;
			}
			if (this.list().some((entry) => entry.alias === pattern)) {
				skippedNames.add(pattern);
				continue;
			}
			const payload = {
				alias: pattern,
				host: hostName,
				port: block.props.port !== void 0 ? Number.parseInt(block.props.port, 10) || 22 : 22,
				user: block.props.user ?? process.env.USER ?? "root",
				auth: {
					kind: block.props.identityfile !== void 0 ? "key" : "password",
					keyPath: block.props.identityfile
				},
				proxyJump: block.props.proxyjump !== void 0 ? block.props.proxyjump.split(",").map((hop) => hop.trim()).filter((hop) => hop !== "") : [],
				description: "imported from ~/.ssh/config"
			};
			try {
				this.create(payload);
				added += 1;
			} catch {
				skippedNames.add(pattern);
			}
		}
		return {
			parsed: blocks.length,
			added,
			skipped: skippedNames.size,
			skippedNames: [...skippedNames]
		};
	}
	/**
	* Lift the marketplace dsh-ssh plugin's store (`~/.dsh/dsh-ssh.json`) into
	* this store once: every host whose alias does not already exist here is
	* created (including its inline plaintext secret, returned so the caller
	* can move it into the credential vault — this store never persists it).
	* The journal (`migrated`) keeps the operation idempotent.
	* @returns the lifted aliases with any inline secrets found.
	*/
	extractLegacyStore() {
		const file = this.load();
		const legacyPath = this.legacyOverride ?? legacyStorePath();
		if (!existsSync(legacyPath)) return [];
		let legacy;
		try {
			legacy = JSON.parse(readFileSync(legacyPath, "utf8"));
		} catch {
			return [];
		}
		if (!Array.isArray(legacy.hosts)) return [];
		const lifted = [];
		for (const raw of legacy.hosts) {
			if (typeof raw !== "object" || raw === null) continue;
			const entry = raw;
			const alias = typeof entry.alias === "string" ? entry.alias : "";
			if (alias === "" || !ALIAS_RE.test(alias)) continue;
			if (this.find(alias) !== void 0 || (file.migrated ?? []).includes(alias)) continue;
			const auth = typeof entry.auth === "object" && entry.auth !== null ? entry.auth : {};
			const kind = auth.kind === "key" ? "key" : "password";
			const password = typeof auth.password === "string" && auth.password !== "" ? auth.password : void 0;
			const passphrase = typeof auth.passphrase === "string" && auth.passphrase !== "" ? auth.passphrase : void 0;
			try {
				this.create({
					alias,
					host: typeof entry.host === "string" ? entry.host : "",
					port: typeof entry.port === "number" ? entry.port : 22,
					user: typeof entry.user === "string" ? entry.user : "root",
					auth: {
						kind,
						keyPath: typeof auth.keyPath === "string" ? auth.keyPath : void 0,
						password,
						passphrase
					},
					workspace: typeof entry.workspace === "string" ? entry.workspace : void 0,
					proxyJump: Array.isArray(entry.proxyJump) ? entry.proxyJump.filter((x) => typeof x === "string") : [],
					description: typeof entry.description === "string" ? entry.description : void 0
				});
				lifted.push({
					alias,
					...password !== void 0 ? { password } : {},
					...passphrase !== void 0 ? { passphrase } : {}
				});
				file.migrated = [...file.migrated ?? [], alias];
			} catch {}
		}
		if (lifted.length > 0) {
			const current = this.load();
			current.migrated = file.migrated;
			this.save(current);
		}
		return lifted;
	}
	load() {
		if (!existsSync(this.path)) return {
			version: FORMAT_VERSION,
			hosts: [],
			recents: []
		};
		try {
			const parsed = JSON.parse(readFileSync(this.path, "utf8"));
			if (typeof parsed !== "object" || parsed === null || !Array.isArray(parsed.hosts)) throw new Error("store file shape invalid");
			return {
				...parsed,
				recents: Array.isArray(parsed.recents) ? parsed.recents : []
			};
		} catch {
			try {
				renameSync(this.path, `${this.path}.corrupt-${Date.now()}`);
			} catch {}
			return {
				version: FORMAT_VERSION,
				hosts: [],
				recents: []
			};
		}
	}
	save(file) {
		const dir = dirname(this.path);
		if (!existsSync(dir)) mkdirSync(dir, {
			recursive: true,
			mode: 448
		});
		const tmp = this.path + ".tmp";
		const serialized = file.hosts.map((entry) => ({
			...entry,
			auth: {
				kind: entry.auth.kind,
				keyPath: entry.auth.keyPath,
				passwordConfigured: entry.auth.passwordConfigured === true,
				passphraseConfigured: entry.auth.passphraseConfigured === true
			}
		}));
		writeFileSync(tmp, JSON.stringify({
			...file,
			hosts: serialized
		}, null, 2) + "\n", {
			encoding: "utf8",
			mode: 384
		});
		renameSync(tmp, this.path);
	}
};
/** A non-empty string counts as a configured secret. */
function hasValue(value) {
	return typeof value === "string" && value !== "";
}
/** Expand a leading `~` in a filesystem path. */
function expandHome(path) {
	if (path === "~") return homedir();
	if (path.startsWith("~/")) return join(homedir(), path.slice(2));
	return path;
}
//#endregion
//#region src/engine.ts
/**
* The SSH engine: a per-alias persistent connection pool (ssh2) with jump
* support, command execution, PTY shells, SFTP file operations and
* transfers, a connect flow that streams step-by-step logs (the ZCode-style
* connection log), and per-host liveness status — all living in the host
* process.
*/
const DEFAULTS = {
	idleTimeoutMs: 30 * 6e4,
	connectTimeoutMs: 15e3,
	keepaliveIntervalMs: 15e3,
	maxOutputBytes: 2 * 1024 * 1024,
	defaultExecTimeoutMs: 6e4,
	sftpConcurrency: 8,
	maxFileBytes: 2 * 1024 * 1024
};
/** Build the ssh2 connect config for one entry (key read from disk). */
function buildConnectConfig(entry, sock, secrets, timeoutMs, keepaliveMs) {
	const config = {
		host: entry.host,
		port: entry.port,
		username: entry.user,
		readyTimeout: timeoutMs,
		keepaliveInterval: keepaliveMs,
		keepaliveCountMax: 3
	};
	if (sock !== void 0) config.sock = sock;
	if (entry.auth.kind === "password") {
		if (secrets.password !== void 0) config.password = secrets.password;
	} else {
		const keyPath = entry.auth.keyPath === void 0 ? void 0 : expandHome(entry.auth.keyPath);
		if (keyPath === void 0 || keyPath === "" || !existsSync(keyPath)) throw new Error(`private key not found: '${entry.auth.keyPath ?? "(unset)"}'`);
		config.privateKey = readFileSync(keyPath, "utf8");
		if (secrets.passphrase !== void 0 && secrets.passphrase !== "") config.passphrase = secrets.passphrase;
	}
	return config;
}
/** Connect one ssh2 client (resolve on ready, reject on error/close). */
function connectClient(config) {
	return new Promise((resolve, reject) => {
		const client = new Client();
		let settled = false;
		client.once("ready", () => {
			if (settled) return;
			settled = true;
			resolve(client);
		});
		client.once("error", (error) => {
			if (settled) return;
			settled = true;
			reject(error instanceof Error ? error : new Error(String(error)));
		});
		try {
			client.connect(config);
		} catch (error) {
			if (!settled) {
				settled = true;
				reject(error instanceof Error ? error : new Error(String(error)));
			}
		}
	});
}
/** Cap captured output at the byte budget (marks truncation). */
function appendOutput(target, chunk, maxBytes) {
	if (target.truncated) return;
	if (target.text.length + chunk.length > maxBytes) {
		let cut = chunk.toString("utf8").slice(0, maxBytes - target.text.length);
		if (/[\uD800-\uDBFF]$/.test(cut)) cut = cut.slice(0, -1);
		target.text += cut + "…[output truncated]";
		target.truncated = true;
		return;
	}
	target.text += chunk.toString("utf8");
}
/**
* Rebuild an over-budget capture keeping BOTH ends: for command output the
* tail (errors, exit summaries) is usually what matters most, so keep 60%
* head + 40% tail with a byte-count marker (mcp-ssh-manager-style output
* governance).
*/
function retainHeadTail(text, maxBytes) {
	if (text.length <= maxBytes) return text;
	const head = Math.floor(maxBytes * .6);
	const tail = Math.floor(maxBytes * .4);
	const dropped = text.length - head - tail;
	let headCut = text.slice(0, head);
	if (/[\uD800-\uDBFF]$/.test(headCut)) headCut = headCut.slice(0, -1);
	let tailCut = text.slice(text.length - tail);
	if (/[\uDC00-\uDFFF]/.test(tailCut[0] ?? "")) tailCut = tailCut.slice(1);
	return `${headCut}\n…[${dropped} bytes truncated]…\n${tailCut}`;
}
/** Finalize one output capture: keep both ends when it over-ran the budget. */
function finalizeOutput(target, maxBytes) {
	return target.truncated ? retainHeadTail(target.text, maxBytes) : target.text;
}
/** Walk a local directory, collecting relative paths of every file. */
function walkLocalDir(root) {
	const files = [];
	const visit = (dir) => {
		for (const name of readdirSync(dir)) {
			const full = join(dir, name);
			const stat = statSync(full);
			if (stat.isDirectory()) visit(full);
			else if (stat.isFile()) files.push(relative(root, full));
		}
	};
	visit(root);
	return files;
}
/** Best-effort binary sniff over a byte prefix. */
function looksBinary(buffer) {
	const probe = buffer.subarray(0, 8e3);
	if (probe.length === 0) return false;
	if (probe.includes(0)) return true;
	let controls = 0;
	for (const byte of probe) if (byte < 9 || byte > 13 && byte < 32) controls += 1;
	return controls / probe.length > .1;
}
/**
* Channel-level failures ("Channel open failure: open failed", channel
* errors) mean the pooled connection is unhealthy even though the ssh2
* client may not have emitted error/close yet (server-side MaxSessions
* exhaustion, half-dead TCP after network changes). Treat them as
* connection-fatal so the retry loop reconnects instead of reusing the
* same dead client three times.
*/
function isChannelFailure(error) {
	const message = error instanceof Error ? error.message : String(error);
	return message.includes("Channel open failure") || message.includes("No response from server") || message.includes("Channel closed") || message.includes("Connection lost");
}
/**
* Resolve the auth secrets for one entry from the vault, if present.
* Returns an empty object when no reader is wired.
*/
async function resolveEntrySecrets(reader, entry) {
	if (reader === void 0) return {};
	if (entry.auth.kind === "password") {
		const password = await reader.getPassword(entry.alias);
		return password !== void 0 ? { password } : {};
	}
	const passphrase = await reader.getPassphrase(entry.alias);
	return passphrase !== void 0 ? { passphrase } : {};
}
/**
* Append-only JSONL audit trail (~/.dsh/remote-ssh/audit.jsonl, rotated at
* 5 MB): every remote side effect logs {ts, kind, alias, detail, ok} —
* commands and paths, never file contents or secrets.
*/
var AuditLog = class {
	path;
	constructor() {
		const dir = join(homedir(), ".dsh", "remote-ssh");
		this.path = join(dir, "audit.jsonl");
		try {
			if (!existsSync(dir)) mkdirSync(dir, {
				recursive: true,
				mode: 448
			});
		} catch {}
	}
	record(kind, alias, detail, ok, extra) {
		try {
			if (existsSync(this.path) && statSync(this.path).size > 5 * 1024 * 1024) renameSync(this.path, this.path + ".1");
			appendFileSync(this.path, JSON.stringify({
				ts: (/* @__PURE__ */ new Date()).toISOString(),
				kind,
				alias,
				detail: detail.slice(0, 2e3),
				ok,
				...extra
			}) + "\n", {
				encoding: "utf8",
				mode: 384
			});
		} catch {}
	}
};
/**
* The engine. Owns the pool and all operations. One instance per plugin
* apply; dispose() closes every connection.
*/
var SshEngine = class {
	store;
	opts;
	secretReader;
	pool = /* @__PURE__ */ new Map();
	/** Per-alias last failure message (kept until the next success). */
	lastErrors = /* @__PURE__ */ new Map();
	/** Append-only audit trail of every remote side effect. */
	audit = new AuditLog();
	/** Per-alias remote command availability (probed once per process). */
	remoteCmds = /* @__PURE__ */ new Map();
	sweepTimer;
	/**
	* @param store - the host config store.
	* @param options - engine knobs (defaults applied).
	*/
	constructor(store, options) {
		this.store = store;
		this.opts = {
			...DEFAULTS,
			...options
		};
		this.secretReader = options?.secretReader;
		this.sweepTimer = setInterval(() => this.sweep(), Math.max(1e4, this.opts.idleTimeoutMs / 4));
		this.sweepTimer.unref?.();
	}
	/** Secret-free host list (filtered by the optional query). */
	list(query) {
		const needle = query?.trim().toLowerCase();
		return this.store.list().filter((entry) => needle === void 0 || needle === "" || entry.alias.toLowerCase().includes(needle) || (entry.description ?? "").toLowerCase().includes(needle) || entry.host.toLowerCase().includes(needle)).map((entry) => this.store.summarize(entry));
	}
	/** One host summary by alias. */
	find(alias) {
		const entry = this.store.find(alias);
		return entry === void 0 ? void 0 : this.store.summarize(entry);
	}
	/** Live connection status for every configured host. */
	status() {
		return this.store.list().map((entry) => {
			const record = this.pool.get(entry.alias);
			const connected = record !== void 0 && !record.broken;
			const lastError = this.lastErrors.get(entry.alias);
			return {
				alias: entry.alias,
				connected,
				...connected ? { since: record.since } : {},
				...lastError !== void 0 ? { lastError } : {}
			};
		});
	}
	/** Close one host's pooled connection (the disconnect route). */
	disconnect(alias) {
		const record = this.pool.get(alias);
		if (record === void 0) return false;
		this.disposeRecord(alias, record);
		return true;
	}
	/**
	* Run `fn` with a live client for `alias`, reconnecting (up to the
	* attempt budget) when the connection broke mid-flight. Channel-level
	* failures mark the record broken so the next attempt truly reconnects.
	*/
	async withClient(alias, fn, attempts = 3) {
		let lastError;
		for (let attempt = 1; attempt <= attempts; attempt += 1) {
			let record = this.pool.get(alias);
			if (record === void 0 || record.broken) {
				if (record !== void 0) this.disposeRecord(alias, record);
				record = await this.acquire(alias);
			}
			record.idleAt = Date.now();
			record.inFlight += 1;
			try {
				const result = await fn(record.client);
				record.idleAt = Date.now();
				return result;
			} catch (error) {
				lastError = error;
				if (isChannelFailure(error)) {
					record.broken = true;
					this.disposeRecord(alias, record);
				}
			} finally {
				record.inFlight -= 1;
			}
		}
		throw lastError instanceof Error ? lastError : new Error(String(lastError));
	}
	/**
	* Run `fn` with a fresh SFTP wrapper and ALWAYS close it: every sftp()
	* call opens a new session channel on the connection, and sshd's
	* MaxSessions (default 10) caps concurrently open ones — leaking them
	* exhausts the server and every later channel open fails with
	* "Channel open failure: open failed".
	*/
	async withSftp(alias, fn) {
		return this.withClient(alias, async (client) => {
			const sftp = await this.sftp(client);
			try {
				return await fn(sftp);
			} finally {
				try {
					sftp.end();
				} catch {}
			}
		});
	}
	/**
	* Build one full jump chain for an entry: hop clients connected through in
	* order, each forwarding a stream to the next destination, ending with the
	* target client. Shared by the pool and standalone shell sessions; every
	* step is narrated to `onLog` when provided.
	*/
	async connectChain(entry, onLog) {
		const hops = [];
		let sock;
		const chain = entry.proxyJump;
		onLog?.(`connecting to ${entry.host}:${entry.port} as ${entry.user} (${entry.auth.kind} auth)`);
		for (let index = 0; index < chain.length; index += 1) {
			const hopAlias = chain[index];
			const hop = this.store.find(hopAlias);
			if (hop === void 0) {
				for (const client of hops) client.end();
				throw new Error(`proxyJump alias '${hopAlias}' not found — create it first`);
			}
			onLog?.(`jump ${index + 1}/${chain.length}: through '${hopAlias}' (${hop.host}:${hop.port})`);
			const hopSecrets = await resolveEntrySecrets(this.secretReader, hop);
			const hopClient = await connectClient(buildConnectConfig(hop, sock, hopSecrets, this.opts.connectTimeoutMs, this.opts.keepaliveIntervalMs));
			hops.push(hopClient);
			const next = index + 1 < chain.length ? this.store.find(chain[index + 1]) : void 0;
			const nextHost = next !== void 0 ? next.host : entry.host;
			const nextPort = next !== void 0 ? next.port : entry.port;
			sock = await new Promise((resolve, reject) => {
				hopClient.forwardOut("127.0.0.1", 0, nextHost, nextPort, (error, stream) => {
					if (error !== void 0) {
						for (const client of hops) client.end();
						reject(error);
					} else resolve(stream);
				});
			});
		}
		try {
			const entrySecrets = await resolveEntrySecrets(this.secretReader, entry);
			const client = await connectClient(buildConnectConfig(entry, sock, entrySecrets, this.opts.connectTimeoutMs, this.opts.keepaliveIntervalMs));
			onLog?.("ssh session established");
			return {
				client,
				hops
			};
		} catch (error) {
			for (const client of hops) client.end();
			throw error;
		}
	}
	/** In-flight acquire promises, deduped per alias (concurrent first use). */
	acquireQueue = /* @__PURE__ */ new Map();
	/** Connect (or reuse) the pooled chain for one alias. */
	async acquire(alias, onLog) {
		const pending = this.acquireQueue.get(alias);
		if (pending !== void 0) return pending;
		const task = this.doAcquire(alias, onLog);
		this.acquireQueue.set(alias, task);
		try {
			return await task;
		} finally {
			if (this.acquireQueue.get(alias) === task) this.acquireQueue.delete(alias);
		}
	}
	async doAcquire(alias, onLog) {
		const entry = this.store.find(alias);
		if (entry === void 0) throw new Error(`alias '${alias}' not found — add it first`);
		const { client, hops } = await this.connectChain(entry, onLog);
		const record = {
			client,
			hops,
			idleAt: Date.now(),
			broken: false,
			inFlight: 0,
			since: Date.now()
		};
		client.on("error", () => {
			record.broken = true;
		});
		client.on("close", () => {
			record.broken = true;
		});
		this.pool.set(alias, record);
		this.lastErrors.delete(alias);
		return record;
	}
	/**
	* Tear down one alias's record. When `record` is given and no longer the
	* pooled record for the alias (a concurrent acquire replaced it), nothing
	* is torn down — the connection belongs to someone else now.
	*/
	disposeRecord(alias, record) {
		const current = this.pool.get(alias);
		if (record !== void 0 && current !== record) return;
		if (current === void 0) return;
		this.pool.delete(alias);
		try {
			current.client.end();
		} catch {}
		for (const hop of current.hops) try {
			hop.end();
		} catch {}
	}
	/** Close connections idle beyond the threshold (skips in-flight). */
	sweep() {
		const cutoff = Date.now() - this.opts.idleTimeoutMs;
		for (const [alias, record] of this.pool) if (record.inFlight === 0 && record.idleAt < cutoff) this.disposeRecord(alias, record);
	}
	/**
	* The ZCode-style connect flow: narrate every step to `onLog`, ensure a
	* live connection, probe it, and resolve the login home directory.
	*/
	async connectLogged(alias, onLog) {
		if (this.store.find(alias) === void 0) throw new Error(`alias '${alias}' not found — add it first`);
		const started = Date.now();
		const pooled = this.pool.get(alias);
		if (pooled !== void 0 && !pooled.broken) {
			onLog("reusing pooled connection");
			pooled.idleAt = Date.now();
		} else {
			if (pooled !== void 0) this.disposeRecord(alias, pooled);
			await this.acquire(alias, onLog);
		}
		onLog("probing remote shell");
		const probe = await this.exec(alias, "true", 1e4);
		if (!probe.success) {
			const error = `probe failed: ${probe.error ?? `exit code ${probe.exitCode}`}`;
			this.lastErrors.set(alias, error);
			throw new Error(error);
		}
		const home = await this.withSftp(alias, async (sftp) => {
			return await new Promise((resolve, reject) => {
				sftp.realpath(".", (error, absPath) => error !== void 0 ? reject(error) : resolve(absPath));
			});
		});
		const latencyMs = Date.now() - started;
		onLog(`connected — home directory ${home}`);
		this.audit.record("connect", alias, home, true, { latencyMs });
		return {
			latencyMs,
			home
		};
	}
	/**
	* Whether a command exists on the remote (probed once per alias per
	* process, cached). Lets callers prefer ripgrep and fall back to
	* find/grep on hosts without it.
	*/
	async hasCmd(alias, cmd) {
		let known = this.remoteCmds.get(alias);
		if (known === void 0) {
			known = /* @__PURE__ */ new Set();
			this.remoteCmds.set(alias, known);
		}
		if (known.has(cmd)) return true;
		const probe = await this.exec(alias, `command -v ${cmd}`, 1e4);
		if (probe.success && probe.stdout.trim() !== "") {
			known.add(cmd);
			return true;
		}
		return false;
	}
	/** Run one command on `alias` (reusing the pooled connection). */
	async exec(alias, command, timeoutMs) {
		const started = Date.now();
		const budget = timeoutMs !== void 0 && timeoutMs > 0 ? timeoutMs : this.opts.defaultExecTimeoutMs;
		try {
			const result = await this.withClient(alias, async (client) => {
				return await new Promise((resolve, reject) => {
					client.exec(command, (error, stream) => {
						if (error !== void 0) {
							reject(error);
							return;
						}
						const stdout = {
							text: "",
							truncated: false
						};
						const stderr = {
							text: "",
							truncated: false
						};
						let timedOut = false;
						let settled = false;
						const finish = () => {
							if (settled) return;
							settled = true;
							clearTimeout(timer);
							resolve({
								success: false,
								exitCode: null,
								timedOut,
								stdout: finalizeOutput(stdout, this.opts.maxOutputBytes),
								stderr: finalizeOutput(stderr, this.opts.maxOutputBytes),
								durationMs: Date.now() - started,
								error: timedOut ? `command timed out after ${budget} ms` : void 0
							});
						};
						const timer = setTimeout(() => {
							timedOut = true;
							try {
								stream.signal("KILL");
							} catch {}
							try {
								stream.close();
							} catch {}
							finish();
						}, budget);
						stream.on("data", (chunk) => appendOutput(stdout, chunk, this.opts.maxOutputBytes));
						stream.stderr.on("data", (chunk) => appendOutput(stderr, chunk, this.opts.maxOutputBytes));
						stream.on("close", (code) => {
							if (settled) return;
							settled = true;
							clearTimeout(timer);
							resolve({
								success: code === 0 && !timedOut,
								exitCode: code,
								timedOut,
								stdout: finalizeOutput(stdout, this.opts.maxOutputBytes),
								stderr: finalizeOutput(stderr, this.opts.maxOutputBytes),
								durationMs: Date.now() - started
							});
						});
						stream.on("error", (streamError) => {
							if (settled) return;
							settled = true;
							clearTimeout(timer);
							reject(streamError);
						});
					});
				});
			});
			this.audit.record("exec", alias, command, result.success, {
				exitCode: result.exitCode,
				durationMs: result.durationMs
			});
			return result;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.lastErrors.set(alias, message);
			this.audit.record("exec", alias, command, false, { error: message });
			return {
				success: false,
				exitCode: null,
				timedOut: false,
				stdout: "",
				stderr: "",
				durationMs: Date.now() - started,
				error: message
			};
		}
	}
	/** Open a PTY shell session for the web terminal (standalone connection). */
	async openShell(alias, size) {
		const entry = this.store.find(alias);
		if (entry === void 0) throw new Error(`alias '${alias}' not found — add it first`);
		const { client, hops } = await this.connectChain(entry);
		return await new Promise((resolve, reject) => {
			client.shell({
				term: "xterm-256color",
				cols: size.cols,
				rows: size.rows
			}, (error, stream) => {
				if (error !== void 0) {
					try {
						client.end();
					} catch {}
					for (const hop of hops) try {
						hop.end();
					} catch {}
					reject(error);
					return;
				}
				let tornDown = false;
				const teardown = () => {
					if (tornDown) return;
					tornDown = true;
					try {
						client.end();
					} catch {}
					for (const hop of hops) try {
						hop.end();
					} catch {}
				};
				const session = {
					send: (data) => {
						try {
							stream.write(data);
						} catch {}
					},
					resize: (cols, rows) => {
						try {
							stream.setWindow(rows, cols, rows, cols);
						} catch {}
					},
					close: () => {
						try {
							stream.close();
						} catch {}
						teardown();
					},
					pause: () => {
						try {
							stream.pause();
						} catch {}
					},
					resume: () => {
						try {
							stream.resume();
						} catch {}
					}
				};
				stream.on("data", (chunk) => {
					session.onData?.(chunk);
				});
				stream.on("close", (code) => {
					teardown();
					session.onExit?.(code);
				});
				stream.on("error", (streamError) => {
					teardown();
					session.onExit?.(null, streamError instanceof Error ? streamError.message : String(streamError));
				});
				resolve(session);
			});
		});
	}
	/** Upload one local file (or directory tree) to a remote path. */
	async upload(alias, localPath, remotePath, recursive, onProgress) {
		if (!remotePath.startsWith("/")) throw new Error(`remotePath must be an absolute path (got '${remotePath}')`);
		const local = resolve(localPath);
		if (!existsSync(local)) throw new Error(`local path not found: '${localPath}'`);
		return this.withSftp(alias, async (sftp) => {
			const stat = statSync(local);
			let files;
			if (stat.isDirectory()) {
				if (!recursive) throw new Error(`'${localPath}' is a directory — enable recursive upload`);
				files = walkLocalDir(local);
				await this.ensureRemoteDir(sftp, remotePath);
			} else {
				files = [""];
				await this.ensureRemoteDir(sftp, dirname(remotePath));
			}
			let bytes = 0;
			for (const rel of files) {
				const src = rel === "" ? local : join(local, rel);
				const remoteRel = rel.split(/[\\/]/).join("/");
				const dst = rel === "" ? remotePath : remotePath.replace(/\/$/, "") + "/" + remoteRel;
				await this.fastPut(sftp, src, dst, onProgress);
				bytes += statSync(src).size;
			}
			return {
				bytes,
				files: files.length
			};
		});
	}
	/** Download one remote file to a local path. */
	async download(alias, remotePath, localPath, onProgress) {
		return this.withSftp(alias, async (sftp) => {
			if ((await new Promise((resolve, reject) => {
				sftp.stat(remotePath, (error, stats) => error !== void 0 ? reject(error) : resolve(stats));
			})).isDirectory()) throw new Error(`'${remotePath}' is a directory — directory download is not supported yet (download individual files)`);
			const local = resolve(localPath);
			if (!existsSync(dirname(local))) mkdirSync(dirname(local), { recursive: true });
			await this.fastGet(sftp, remotePath, local, onProgress);
			return { bytes: statSync(local).size };
		});
	}
	/** List a remote directory (file browser). */
	async ls(alias, path) {
		return this.withSftp(alias, async (sftp) => {
			return await new Promise((resolve, reject) => {
				sftp.readdir(path, (error, list) => {
					if (error !== void 0) {
						reject(error);
						return;
					}
					const entries = list.map((item) => ({
						name: item.filename,
						type: item.attrs.isDirectory() ? "dir" : item.attrs.isFile() ? "file" : "other",
						size: item.attrs.size,
						mtimeMs: item.attrs.mtime * 1e3,
						mode: item.attrs.mode
					}));
					entries.sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1);
					resolve(entries);
				});
			});
		});
	}
	/** Read one remote file as text (byte-capped, binary-flagged). */
	async readFile(alias, path, maxBytes) {
		const budget = maxBytes !== void 0 && maxBytes > 0 ? Math.min(maxBytes, this.opts.maxFileBytes) : this.opts.maxFileBytes;
		return this.withSftp(alias, async (sftp) => {
			const stat = await new Promise((resolve, reject) => {
				sftp.stat(path, (error, stats) => error !== void 0 ? reject(error) : resolve({
					size: stats.size,
					isFile: () => stats.isFile()
				}));
			});
			if (!stat.isFile()) throw new Error(`'${path}' is not a regular file`);
			const read = Math.min(stat.size, budget);
			const chunks = [];
			let received = 0;
			await new Promise((resolve, reject) => {
				const stream = sftp.createReadStream(path, {
					start: 0,
					end: read - 1
				});
				stream.on("data", (chunk) => {
					chunks.push(chunk);
					received += chunk.length;
				});
				stream.on("error", reject);
				stream.on("close", resolve);
			});
			const buffer = Buffer.concat(chunks);
			return {
				path,
				content: buffer.toString("utf8"),
				bytes: stat.size,
				truncated: stat.size > read,
				binary: looksBinary(buffer)
			};
		});
	}
	/** Write text to one remote file (creates or truncates). */
	async writeFile(alias, path, content) {
		if (!path.startsWith("/")) throw new Error("remote path must be absolute");
		const payload = Buffer.from(content, "utf8");
		await this.withSftp(alias, async (sftp) => {
			await new Promise((resolve, reject) => {
				const stream = sftp.createWriteStream(path);
				stream.on("error", reject);
				stream.on("close", () => resolve());
				stream.end(payload);
			});
		});
		return { bytes: payload.length };
	}
	/** Create one remote directory (single level). */
	async mkdir(alias, path) {
		await this.withSftp(alias, async (sftp) => {
			await new Promise((resolve, reject) => {
				sftp.mkdir(path, (error) => error !== void 0 ? reject(error) : resolve());
			});
		});
	}
	/** Rename/move one remote path. */
	async rename(alias, fromPath, toPath) {
		await this.withSftp(alias, async (sftp) => {
			await new Promise((resolve, reject) => {
				const done = (error) => {
					if (error === void 0 || error === null) resolve();
					else reject(error);
				};
				if (typeof sftp.ext_openssh_rename === "function") sftp.ext_openssh_rename(fromPath, toPath, done);
				else sftp.rename(fromPath, toPath, done);
			});
		});
	}
	/** Delete one remote file or directory (recursive opt-in for directories). */
	async remove(alias, path, recursive) {
		if (recursive) {
			const safe = path.replaceAll("'", `'"'"'`);
			const result = await this.exec(alias, `rm -rf -- '${safe}'`);
			if (!result.success) throw new Error(`recursive delete failed: ${result.stderr || result.error || `exit code ${result.exitCode}`}`);
			this.audit.record("remove", alias, path, true, { recursive });
			return;
		}
		await this.withSftp(alias, async (sftp) => {
			if ((await new Promise((resolve, reject) => {
				sftp.stat(path, (error, stats) => error !== void 0 ? reject(error) : resolve(stats));
			})).isDirectory()) {
				await new Promise((resolve, reject) => {
					sftp.rmdir(path, (error) => error !== void 0 ? reject(new Error(String(error))) : resolve());
				});
				return;
			}
			await new Promise((resolve, reject) => {
				sftp.unlink(path, (error) => error !== void 0 ? reject(new Error(String(error))) : resolve());
			});
		});
		this.audit.record("remove", alias, path, true, { recursive });
	}
	/** Canonicalize a remote path ('.' → home). */
	async realpath(alias, path) {
		return this.withSftp(alias, async (sftp) => {
			return await new Promise((resolve, reject) => {
				sftp.realpath(path, (error, absPath) => error !== void 0 ? reject(error) : resolve(absPath));
			});
		});
	}
	sftp(client) {
		return new Promise((resolve, reject) => {
			client.sftp((error, sftp) => error !== void 0 ? reject(error) : resolve(sftp));
		});
	}
	/** Create a remote directory chain (stat-then-mkdir per segment). */
	ensureRemoteDir(sftp, remote) {
		return new Promise((resolve, reject) => {
			const segments = remote.replace(/^\/+/, "").split("/").filter((segment) => segment !== "");
			const walk = (index) => {
				if (index >= segments.length) {
					resolve();
					return;
				}
				const current = "/" + segments.slice(0, index + 1).join("/");
				sftp.stat(current, (statError) => {
					if (statError === void 0) {
						walk(index + 1);
						return;
					}
					sftp.mkdir(current, (mkdirError) => {
						if (mkdirError !== void 0) {
							reject(mkdirError);
							return;
						}
						walk(index + 1);
					});
				});
			};
			walk(0);
		});
	}
	fastPut(sftp, src, dst, onProgress) {
		return new Promise((resolve, reject) => {
			let last = 0;
			let lastEmit = 0;
			const started = Date.now();
			onProgress?.({
				phase: "transferring",
				file: dst,
				transferred: 0,
				total: statSync(src).size,
				percent: 0
			});
			sftp.fastPut(src, dst, {
				concurrency: this.opts.sftpConcurrency,
				step: (transferred, _chunk, total) => {
					const now = Date.now();
					if (now - lastEmit < 100 && transferred < total) return;
					lastEmit = now;
					const elapsed = (now - started) / 1e3;
					onProgress?.({
						phase: "transferring",
						file: dst,
						transferred,
						total,
						percent: total > 0 ? Math.round(transferred / total * 1e3) / 10 : 0,
						speedBps: elapsed > 0 ? Math.round((transferred - last) / elapsed) : void 0
					});
					last = transferred;
				}
			}, (error) => {
				if (error !== void 0) {
					onProgress?.({
						phase: "error",
						file: dst,
						transferred: 0,
						total: 0,
						percent: 0,
						error: String(error)
					});
					reject(error);
				} else {
					onProgress?.({
						phase: "done",
						file: dst,
						transferred: statSync(src).size,
						total: statSync(src).size,
						percent: 100
					});
					resolve();
				}
			});
		});
	}
	fastGet(sftp, src, dst, onProgress) {
		return new Promise((resolve, reject) => {
			let last = 0;
			let lastEmit = 0;
			const started = Date.now();
			sftp.fastGet(src, dst, {
				concurrency: this.opts.sftpConcurrency,
				step: (transferred, _chunk, total) => {
					const now = Date.now();
					if (now - lastEmit < 100 && transferred < total) return;
					lastEmit = now;
					const elapsed = (now - started) / 1e3;
					onProgress?.({
						phase: "transferring",
						file: src,
						transferred,
						total,
						percent: total > 0 ? Math.round(transferred / total * 1e3) / 10 : 0,
						speedBps: elapsed > 0 ? Math.round((transferred - last) / elapsed) : void 0
					});
					last = transferred;
				}
			}, (error) => {
				if (error !== void 0) {
					onProgress?.({
						phase: "error",
						file: src,
						transferred: 0,
						total: 0,
						percent: 0,
						error: String(error)
					});
					reject(error);
				} else {
					onProgress?.({
						phase: "done",
						file: src,
						transferred: statSync(dst).size,
						total: statSync(dst).size,
						percent: 100
					});
					resolve();
				}
			});
		});
	}
	/** Probe connectivity: connect, run `true`, close nothing (pooled). */
	async test(alias) {
		const started = Date.now();
		try {
			const result = await this.exec(alias, "true", 1e4);
			return result.success ? {
				ok: true,
				latencyMs: result.durationMs
			} : {
				ok: false,
				latencyMs: result.durationMs,
				error: `remote exit code ${result.exitCode}`
			};
		} catch (error) {
			return {
				ok: false,
				latencyMs: Date.now() - started,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}
	/** Close every pooled connection. */
	dispose() {
		if (this.sweepTimer !== void 0) clearInterval(this.sweepTimer);
		for (const alias of [...this.pool.keys()]) this.disposeRecord(alias);
	}
};
//#endregion
//#region src/protocol.ts
const SSH_API = {
	hosts: "/api/remote-ssh/hosts",
	sshAliases: "/api/remote-ssh/ssh-aliases",
	importSshConfig: "/api/remote-ssh/hosts/import-ssh-config",
	recents: "/api/remote-ssh/recents",
	status: "/api/remote-ssh/status",
	session: "/api/remote-ssh/session",
	workspace: "/api/remote-ssh/workspace",
	connect: "/api/remote-ssh/connect",
	disconnect: "/api/remote-ssh/disconnect",
	exec: "/api/remote-ssh/exec",
	ls: "/api/remote-ssh/ls",
	read: "/api/remote-ssh/read",
	write: "/api/remote-ssh/write",
	mkdir: "/api/remote-ssh/mkdir",
	rename: "/api/remote-ssh/rename",
	remove: "/api/remote-ssh/remove",
	upload: "/api/remote-ssh/upload",
	download: "/api/remote-ssh/download",
	terminal: "/api/remote-ssh/terminal"
};
/**
* Wrap a shell command so it runs inside a working directory. Single quotes
* are escaped POSIX-style; an empty cwd returns the command unchanged.
*/
function withCwd(command, cwd) {
	if (cwd === void 0 || cwd.trim() === "") return command;
	return `cd -- '${cwd.trim().replaceAll("'", `'"'"'`)}' && ( ${command} )`;
}
//#endregion
//#region src/workspace-marker.ts
/**
* Remote-workspace markers: a remote host directory is represented on the
* DSH host as a local marker directory under ~/.dsh/remote-ssh/ws/ carrying a
* marker.json ({alias, dir}). The marker directory is registered as a normal
* DSH workspace (renamed to "alias · dir"), so:
*   - the sidebar shows it like any workspace and sessions group inside it;
*   - a session created there has cwd = the marker directory, which the
*     tools/execute bridge resolves back to the remote (alias, dir) —
*     no manual binding step;
*   - the better-sidebar explorer bridge serves the REMOTE tree for any
*     path under the marker directory (nested paths map onto remote
*     subdirectories).
*/
/** Marker file name inside every marker workspace root. */
const MARKER_FILE = "marker.json";
/** The marker root: <home>/.dsh/remote-ssh/ws. */
function markerRoot() {
	return join(homedir(), ".dsh", "remote-ssh", "ws");
}
/** Slugify a remote directory into a filesystem-safe segment. */
function slugifyDir(dir) {
	const slug = dir.split("/").filter((part) => part !== "").map((part) => part.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "root").join("_");
	return (slug === "" ? "root" : slug).slice(0, 80);
}
/**
* Create (or reuse) the marker directory for one remote workspace.
* @returns the local marker directory path.
*/
function createMarkerWorkspace(alias, dir) {
	const path = join(markerRoot(), `${alias}_${slugifyDir(dir)}`);
	mkdirSync(path, {
		recursive: true,
		mode: 448
	});
	writeFileSync(join(path, MARKER_FILE), JSON.stringify({
		version: 1,
		alias,
		dir
	}, null, 2) + "\n", {
		encoding: "utf8",
		mode: 384
	});
	return path;
}
/** In-memory marker cache (marker files change only through this module). */
const cache = /* @__PURE__ */ new Map();
/** Load the marker of one marker-workspace segment (cached). */
function loadMarker(localRoot) {
	const cached = cache.get(localRoot);
	if (cached !== void 0) return cached;
	const file = join(localRoot, MARKER_FILE);
	if (!existsSync(file)) return void 0;
	try {
		const parsed = JSON.parse(readFileSync(file, "utf8"));
		if (typeof parsed.alias !== "string" || typeof parsed.dir !== "string") return void 0;
		const marker = {
			alias: parsed.alias,
			dir: parsed.dir,
			localRoot
		};
		cache.set(localRoot, marker);
		return marker;
	} catch {
		return;
	}
}
/**
* Resolve a local path against the marker tree.
* @returns the marker plus the REMOTE path this local path denotes, or
* undefined when the path is not under any marker workspace.
*/
function resolveMarkerPath(path) {
	if (typeof path !== "string" || path === "") return void 0;
	const root = markerRoot();
	if (path !== root && !path.startsWith(root + "/")) return void 0;
	const rest = path === root ? "" : path.slice(root.length + 1);
	if (rest === "") return void 0;
	const [segment, ...nested] = rest.split("/");
	const marker = loadMarker(join(root, segment));
	if (marker === void 0) return void 0;
	const rel = nested.filter((part) => part !== "").join("/");
	return {
		marker,
		remotePath: rel === "" ? marker.dir : `${marker.dir.replace(/\/$/, "")}/${rel}`
	};
}
//#endregion
//#region src/routes.ts
/**
* The /api/remote-ssh route family: host CRUD, ~/.ssh/config alias reading
* and import, recents, status, the NDJSON connect log stream, exec, remote
* file operations (ls / read / write / mkdir / rename / remove), SFTP
* transfer (NDJSON progress stream for uploads, binary stream for
* downloads), and the WebSocket PTY terminal upgrade. Every route carries a
* loopback-only trust fence (plus browser same-origin markers) — these
* endpoints operate remote servers, so LAN-exposed dsh web deployments must
* not serve them.
*/
/** Cap on JSON request bodies (host entries and exec payloads are small). */
const MAX_JSON_BODY_BYTES = 8 * 1024 * 1024;
/** Cap on declared upload bodies (staged to disk before SFTP). */
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024 * 1024;
/**
* One noServer WebSocket server for terminal upgrades: the browser half uses
* a standards-compliant WebSocket, so the host must speak real RFC 6455
* frames (the webserver hands us the raw upgraded socket).
*/
const terminalWss = new WebSocketServer({ noServer: true });
/** Pause the shell when the socket's send buffer exceeds this… */
const BACKPRESSURE_HIGH_WATER = 1024 * 1024;
/** …and resume once it drains below this. */
const BACKPRESSURE_LOW_WATER = 512 * 1024;
/** Loopback literal check plus browser same-origin markers. */
function isLoopbackRequest(request) {
	const address = request.socket.remoteAddress;
	if (address !== "127.0.0.1" && address !== "::1" && address !== "::ffff:127.0.0.1") return false;
	const host = request.headers.host;
	if (typeof host !== "string") return false;
	let hostUrl;
	try {
		hostUrl = new URL(`http://${host}`);
	} catch {
		return false;
	}
	if (hostUrl.hostname !== "127.0.0.1" && hostUrl.hostname !== "localhost" && hostUrl.hostname !== "[::1]") return false;
	if (request.headers["sec-fetch-site"] === "cross-site") return false;
	const origin = request.headers.origin;
	if (origin === void 0) return true;
	try {
		return new URL(origin).host === hostUrl.host;
	} catch {
		return false;
	}
}
/** One JSON response. */
function writeJson(res, status, body) {
	const payload = JSON.stringify(body);
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"referrer-policy": "no-referrer"
	});
	res.end(payload);
}
/** Read a JSON request body (undefined when too large or unparseable). */
async function readJsonBody(req) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		const buffer = chunk;
		size += buffer.length;
		if (size > MAX_JSON_BODY_BYTES) return void 0;
		chunks.push(buffer);
	}
	try {
		const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
		return typeof parsed === "object" && parsed !== null ? parsed : void 0;
	} catch {
		return;
	}
}
/** URL query helper (first value, decoded). */
function queryParam(url, name) {
	const value = url.searchParams.get(name);
	return value === null ? void 0 : value;
}
/**
* Build every /api/remote-ssh route (exact paths) plus the terminal upgrade.
* @param deps - store, engine, vault, staging dir.
* @returns routes and the upgrade route.
*/
function makeRoutes(deps) {
	const { store, engine, bindings, vault } = deps;
	const staging = deps.stagingDir ?? join(tmpdir(), "dsh-remote-ssh-uploads");
	mkdirSync(staging, { recursive: true });
	/** Guard helper: fence + method check. */
	const guard = (req, res, method) => {
		if (!isLoopbackRequest(req)) {
			writeJson(res, 403, { error: "forbidden: loopback-only" });
			return false;
		}
		if (req.method !== method) {
			writeJson(res, 405, { error: `method not allowed: ${req.method}` });
			return false;
		}
		return true;
	};
	return {
		routes: [
			{
				kind: "exact",
				path: SSH_API.hosts,
				handler: async (req, res) => {
					const method = req.method ?? "GET";
					if (!isLoopbackRequest(req)) {
						writeJson(res, 403, { error: "forbidden: loopback-only" });
						return;
					}
					const url = new URL(req.url ?? "/", "http://localhost");
					if (method === "GET") {
						writeJson(res, 200, { hosts: engine.list(queryParam(url, "query")) });
						return;
					}
					if (method === "POST") {
						const body = await readJsonBody(req);
						if (body === void 0) {
							writeJson(res, 400, { error: "invalid JSON body" });
							return;
						}
						try {
							const alias = typeof body.alias === "string" ? body.alias : "";
							const auth = body.auth;
							if (vault !== void 0 && auth !== void 0) {
								if (typeof auth.password === "string" && auth.password !== "") await vault.setPassword(alias, auth.password);
								if (typeof auth.passphrase === "string" && auth.passphrase !== "") await vault.setPassphrase(alias, auth.passphrase);
							}
							const entry = store.create(body);
							writeJson(res, 201, { host: store.summarize(entry) });
						} catch (error) {
							writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
						}
						return;
					}
					if (method !== "PATCH" && method !== "DELETE") {
						writeJson(res, 405, { error: `method not allowed: ${method}` });
						return;
					}
					const alias = queryParam(url, "alias");
					if (alias === void 0 || alias === "") {
						writeJson(res, 400, { error: "alias query parameter is required" });
						return;
					}
					if (method === "PATCH") {
						const body = await readJsonBody(req);
						if (body === void 0) {
							writeJson(res, 400, { error: "invalid JSON body" });
							return;
						}
						try {
							const auth = body.auth;
							if (vault !== void 0 && auth !== void 0) {
								if (typeof auth.password === "string" && auth.password !== "") await vault.setPassword(alias, auth.password);
								if (typeof auth.passphrase === "string" && auth.passphrase !== "") await vault.setPassphrase(alias, auth.passphrase);
							}
							const entry = store.update(alias, body);
							writeJson(res, 200, { host: store.summarize(entry) });
						} catch (error) {
							writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
						}
						return;
					}
					if (method === "DELETE") {
						try {
							engine.disconnect(alias);
							store.delete(alias);
							if (vault !== void 0) await vault.clear(alias);
							writeJson(res, 200, { ok: true });
						} catch (error) {
							writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
						}
						return;
					}
					writeJson(res, 405, { error: `method not allowed: ${method}` });
				}
			},
			{
				kind: "exact",
				path: SSH_API.sshAliases,
				handler: async (req, res) => {
					if (!guard(req, res, "GET")) return;
					writeJson(res, 200, { aliases: store.listSshConfigAliases() });
				}
			},
			{
				kind: "exact",
				path: SSH_API.importSshConfig,
				handler: async (req, res) => {
					if (!guard(req, res, "POST")) return;
					try {
						writeJson(res, 200, { result: store.importFromSshConfig() });
					} catch (error) {
						writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
					}
				}
			},
			{
				kind: "exact",
				path: SSH_API.recents,
				handler: async (req, res) => {
					const method = req.method ?? "GET";
					if (!isLoopbackRequest(req)) {
						writeJson(res, 403, { error: "forbidden: loopback-only" });
						return;
					}
					if (method === "GET") {
						writeJson(res, 200, { recents: store.listRecents() });
						return;
					}
					if (method !== "POST") {
						writeJson(res, 405, { error: `method not allowed: ${method}` });
						return;
					}
					const body = await readJsonBody(req);
					const alias = typeof body?.alias === "string" ? body.alias : "";
					const dir = typeof body?.dir === "string" ? body.dir : "";
					if (alias === "" || dir === "") {
						writeJson(res, 400, { error: "alias and dir are required" });
						return;
					}
					store.addRecent(alias, dir);
					writeJson(res, 200, { ok: true });
				}
			},
			{
				kind: "exact",
				path: SSH_API.status,
				handler: async (req, res) => {
					if (!guard(req, res, "GET")) return;
					writeJson(res, 200, { status: engine.status() });
				}
			},
			{
				kind: "exact",
				path: SSH_API.session,
				handler: async (req, res) => {
					if (!guard(req, res, "POST")) return;
					const body = await readJsonBody(req);
					const action = body?.action;
					if (action === "bind") {
						const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
						const alias = typeof body?.alias === "string" ? body.alias : "";
						const dir = typeof body?.dir === "string" ? body.dir : "";
						if (sessionId === "" || alias === "" || dir === "") {
							writeJson(res, 400, { error: "sessionId, alias and dir are required" });
							return;
						}
						if (store.find(alias) === void 0) {
							writeJson(res, 400, { error: `alias '${alias}' not found` });
							return;
						}
						bindings.bind(sessionId, alias, dir);
						writeJson(res, 200, {
							binding: {
								alias,
								dir
							},
							bindings: bindings.list()
						});
						return;
					}
					if (action === "unbind") {
						const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
						if (sessionId === "") {
							writeJson(res, 400, { error: "sessionId is required" });
							return;
						}
						bindings.unbind(sessionId);
						writeJson(res, 200, { bindings: bindings.list() });
						return;
					}
					if (action === "list") {
						writeJson(res, 200, { bindings: bindings.list() });
						return;
					}
					writeJson(res, 400, { error: `unknown action '${String(action)}'` });
				}
			},
			{
				kind: "exact",
				path: SSH_API.workspace,
				handler: async (req, res) => {
					if (!guard(req, res, "POST")) return;
					const body = await readJsonBody(req);
					const alias = typeof body?.alias === "string" ? body.alias : "";
					const dir = typeof body?.dir === "string" ? body.dir : "";
					if (alias === "" || dir === "" || !dir.startsWith("/")) {
						writeJson(res, 400, { error: "alias and an absolute dir are required" });
						return;
					}
					if (store.find(alias) === void 0) {
						writeJson(res, 400, { error: `alias '${alias}' not found` });
						return;
					}
					try {
						const probe = await engine.test(alias);
						if (!probe.ok) {
							writeJson(res, 400, { error: `cannot reach '${alias}': ${probe.error ?? "unreachable"}` });
							return;
						}
					} catch (error) {
						writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
						return;
					}
					writeJson(res, 200, {
						path: createMarkerWorkspace(alias, dir),
						title: `${alias} · ${dir}`
					});
				}
			},
			{
				kind: "exact",
				path: SSH_API.connect,
				handler: async (req, res) => {
					if (!guard(req, res, "POST")) return;
					const body = await readJsonBody(req);
					const alias = typeof body?.alias === "string" ? body.alias : "";
					if (alias === "") {
						writeJson(res, 400, { error: "alias is required" });
						return;
					}
					res.writeHead(200, {
						"content-type": "application/x-ndjson; charset=utf-8",
						"cache-control": "no-cache",
						"referrer-policy": "no-referrer"
					});
					const emit = (line) => {
						try {
							res.write(JSON.stringify(line) + "\n");
						} catch {}
					};
					try {
						const outcome = await engine.connectLogged(alias, (line) => emit({
							type: "log",
							line
						}));
						const entry = store.find(alias);
						if (entry !== void 0 && entry.workspace !== void 0 && entry.workspace !== "") store.addRecent(alias, entry.workspace);
						emit({
							type: "connected",
							alias,
							latencyMs: outcome.latencyMs,
							home: outcome.home,
							...entry?.workspace !== void 0 ? { workspace: entry.workspace } : {}
						});
					} catch (error) {
						emit({
							type: "failed",
							alias,
							error: error instanceof Error ? error.message : String(error)
						});
					} finally {
						try {
							res.end();
						} catch {}
					}
				}
			},
			{
				kind: "exact",
				path: SSH_API.disconnect,
				handler: async (req, res) => {
					if (!guard(req, res, "POST")) return;
					const body = await readJsonBody(req);
					const alias = typeof body?.alias === "string" ? body.alias : "";
					if (alias === "") {
						writeJson(res, 400, { error: "alias is required" });
						return;
					}
					writeJson(res, 200, { ok: engine.disconnect(alias) });
				}
			},
			{
				kind: "exact",
				path: SSH_API.exec,
				handler: async (req, res) => {
					if (!guard(req, res, "POST")) return;
					const body = await readJsonBody(req);
					const alias = typeof body?.alias === "string" ? body.alias : "";
					const command = typeof body?.command === "string" ? body.command : "";
					if (alias === "" || command === "") {
						writeJson(res, 400, { error: "alias and command are required" });
						return;
					}
					const cwd = typeof body?.cwd === "string" && body.cwd !== "" ? body.cwd : void 0;
					const timeoutMs = typeof body?.timeoutMs === "number" ? body.timeoutMs : void 0;
					try {
						writeJson(res, 200, { result: await engine.exec(alias, withCwd(command, cwd), timeoutMs) });
					} catch (error) {
						writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
					}
				}
			},
			{
				kind: "exact",
				path: SSH_API.ls,
				handler: async (req, res) => {
					if (!guard(req, res, "GET")) return;
					const url = new URL(req.url ?? "/", "http://localhost");
					const alias = queryParam(url, "alias");
					const path = queryParam(url, "path") ?? "/";
					if (alias === void 0 || alias === "") {
						writeJson(res, 400, { error: "alias query parameter is required" });
						return;
					}
					try {
						writeJson(res, 200, { entries: await engine.ls(alias, path) });
					} catch (error) {
						writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
					}
				}
			},
			{
				kind: "exact",
				path: SSH_API.read,
				handler: async (req, res) => {
					if (!guard(req, res, "GET")) return;
					const url = new URL(req.url ?? "/", "http://localhost");
					const alias = queryParam(url, "alias");
					const path = queryParam(url, "path");
					if (alias === void 0 || path === void 0) {
						writeJson(res, 400, { error: "alias and path query parameters are required" });
						return;
					}
					const maxBytesRaw = Number(queryParam(url, "maxBytes") ?? "");
					const maxBytes = Number.isFinite(maxBytesRaw) && maxBytesRaw > 0 ? maxBytesRaw : void 0;
					try {
						writeJson(res, 200, { file: await engine.readFile(alias, path, maxBytes) });
					} catch (error) {
						writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
					}
				}
			},
			{
				kind: "exact",
				path: SSH_API.write,
				handler: async (req, res) => {
					if (!guard(req, res, "POST")) return;
					const body = await readJsonBody(req);
					const alias = typeof body?.alias === "string" ? body.alias : "";
					const path = typeof body?.path === "string" ? body.path : "";
					const content = typeof body?.content === "string" ? body.content : "";
					if (alias === "" || path === "") {
						writeJson(res, 400, { error: "alias and path are required" });
						return;
					}
					try {
						writeJson(res, 200, await engine.writeFile(alias, path, content));
					} catch (error) {
						writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
					}
				}
			},
			{
				kind: "exact",
				path: SSH_API.mkdir,
				handler: async (req, res) => {
					if (!guard(req, res, "POST")) return;
					const body = await readJsonBody(req);
					const alias = typeof body?.alias === "string" ? body.alias : "";
					const path = typeof body?.path === "string" ? body.path : "";
					if (alias === "" || path === "") {
						writeJson(res, 400, { error: "alias and path are required" });
						return;
					}
					try {
						await engine.mkdir(alias, path);
						writeJson(res, 200, { ok: true });
					} catch (error) {
						writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
					}
				}
			},
			{
				kind: "exact",
				path: SSH_API.rename,
				handler: async (req, res) => {
					if (!guard(req, res, "POST")) return;
					const body = await readJsonBody(req);
					const alias = typeof body?.alias === "string" ? body.alias : "";
					const from = typeof body?.from === "string" ? body.from : "";
					const to = typeof body?.to === "string" ? body.to : "";
					if (alias === "" || from === "" || to === "") {
						writeJson(res, 400, { error: "alias, from and to are required" });
						return;
					}
					try {
						await engine.rename(alias, from, to);
						writeJson(res, 200, { ok: true });
					} catch (error) {
						writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
					}
				}
			},
			{
				kind: "exact",
				path: SSH_API.remove,
				handler: async (req, res) => {
					if (!guard(req, res, "POST")) return;
					const body = await readJsonBody(req);
					const alias = typeof body?.alias === "string" ? body.alias : "";
					const path = typeof body?.path === "string" ? body.path : "";
					const recursive = body?.recursive === true;
					if (alias === "" || path === "") {
						writeJson(res, 400, { error: "alias and path are required" });
						return;
					}
					try {
						await engine.remove(alias, path, recursive);
						writeJson(res, 200, { ok: true });
					} catch (error) {
						writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
					}
				}
			},
			{
				kind: "exact",
				path: SSH_API.upload,
				handler: async (req, res) => {
					if (!guard(req, res, "POST")) return;
					const url = new URL(req.url ?? "/", "http://localhost");
					const alias = queryParam(url, "alias");
					const remotePath = queryParam(url, "remotePath");
					if (alias === void 0 || remotePath === void 0) {
						writeJson(res, 400, { error: "alias and remotePath query parameters are required" });
						return;
					}
					const declared = Number(req.headers["content-length"]);
					if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES) {
						writeJson(res, 413, { error: "upload body too large" });
						return;
					}
					res.writeHead(200, {
						"content-type": "application/x-ndjson; charset=utf-8",
						"cache-control": "no-cache",
						"referrer-policy": "no-referrer"
					});
					const emit = (line) => {
						try {
							res.write(JSON.stringify(line) + "\n");
						} catch {}
					};
					const tmp = join(staging, `upload-${randomBytes(6).toString("hex")}`);
					const sink = createWriteStream(tmp);
					let settled = false;
					const fail = (error) => {
						if (settled) return;
						settled = true;
						emit({
							type: "result",
							ok: false,
							error: error instanceof Error ? error.message : String(error)
						});
						try {
							sink.destroy();
						} catch {}
						unlink(tmp).catch(() => void 0);
						try {
							res.end();
						} catch {}
					};
					const done = () => {
						if (settled) return;
						settled = true;
						try {
							res.end();
						} catch {}
					};
					sink.on("error", (error) => fail(error));
					req.on("error", (error) => fail(error));
					req.on("aborted", () => fail("upload aborted by the client"));
					res.on("error", () => fail("response stream closed"));
					res.on("close", () => {
						if (!res.writableEnded) fail("connection closed");
					});
					req.pipe(sink);
					sink.on("finish", async () => {
						if (settled) return;
						emit({
							type: "progress",
							progress: {
								phase: "connecting",
								file: remotePath,
								transferred: 0,
								total: 0,
								percent: 0
							}
						});
						try {
							const outcome = await engine.upload(alias, tmp, remotePath, false, (progress) => emit({
								type: "progress",
								progress
							}));
							emit({
								type: "result",
								ok: true,
								transferredBytes: outcome.bytes
							});
						} catch (error) {
							emit({
								type: "result",
								ok: false,
								error: error instanceof Error ? error.message : String(error)
							});
						} finally {
							await unlink(tmp).catch(() => void 0);
							done();
						}
					});
				}
			},
			{
				kind: "exact",
				path: SSH_API.download,
				handler: async (req, res) => {
					if (!guard(req, res, "GET")) return;
					const url = new URL(req.url ?? "/", "http://localhost");
					const alias = queryParam(url, "alias");
					const remotePath = queryParam(url, "remotePath");
					if (alias === void 0 || remotePath === void 0) {
						writeJson(res, 400, { error: "alias and remotePath query parameters are required" });
						return;
					}
					const tmp = join(staging, `download-${randomBytes(6).toString("hex")}`);
					try {
						const outcome = await engine.download(alias, remotePath, tmp);
						res.writeHead(200, {
							"content-type": "application/octet-stream",
							"content-length": String(outcome.bytes),
							"content-disposition": `attachment; filename="${basename(remotePath).replace(/"/g, "")}"`,
							"referrer-policy": "no-referrer"
						});
						await new Promise((resolve, reject) => {
							const source = createReadStream(tmp);
							source.on("error", reject);
							res.on("error", reject);
							source.pipe(res);
							source.on("end", resolve);
						});
					} catch (error) {
						if (!res.headersSent) writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
						else res.destroy();
					} finally {
						await unlink(tmp).catch(() => void 0);
					}
				}
			}
		],
		upgrade: {
			path: SSH_API.terminal,
			handler: (req, socket, head) => {
				if (!isLoopbackRequest(req)) {
					socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
					socket.destroy();
					return;
				}
				const url = new URL(req.url ?? "/", "http://localhost");
				const alias = queryParam(url, "alias");
				if (alias === void 0) {
					socket.write("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
					socket.destroy();
					return;
				}
				const cols = Number.parseInt(queryParam(url, "cols") ?? "80", 10);
				const rows = Number.parseInt(queryParam(url, "rows") ?? "24", 10);
				terminalWss.handleUpgrade(req, socket, head, (ws) => {
					let session;
					let closed = false;
					let paused = false;
					const resume = () => {
						if (paused && ws.bufferedAmount < BACKPRESSURE_LOW_WATER) {
							paused = false;
							session?.resume();
						}
					};
					const sendFrame = (frame) => {
						if (closed || ws.readyState !== WebSocket.OPEN) return;
						ws.send(JSON.stringify(frame), resume);
						if (!paused && ws.bufferedAmount > BACKPRESSURE_HIGH_WATER) {
							paused = true;
							session?.pause();
						}
					};
					const closeSession = () => {
						const opened = session;
						session = void 0;
						if (opened !== void 0) opened.close();
					};
					engine.openShell(alias, {
						cols: Number.isFinite(cols) ? cols : 80,
						rows: Number.isFinite(rows) ? rows : 24
					}).then((opened) => {
						if (ws.readyState !== WebSocket.OPEN) {
							opened.close();
							return;
						}
						session = opened;
						sendFrame({
							type: "ready",
							alias
						});
						opened.onData = (data) => sendFrame({
							type: "output",
							data: data.toString("utf8")
						});
						opened.onExit = (code, error) => {
							sendFrame({
								type: "exit",
								code,
								error
							});
							closed = true;
							try {
								ws.close(1e3);
							} catch {}
						};
					}).catch((error) => {
						sendFrame({
							type: "exit",
							code: null,
							error: error instanceof Error ? error.message : String(error)
						});
						closed = true;
						try {
							ws.close(1e3);
						} catch {}
					});
					ws.on("message", (data) => {
						let frame;
						try {
							frame = JSON.parse(String(data));
						} catch {
							return;
						}
						if (frame.type === "input") session?.send(frame.data);
						else if (frame.type === "resize") session?.resize(Math.max(2, frame.cols), Math.max(1, frame.rows));
					});
					ws.on("close", () => {
						closed = true;
						closeSession();
					});
					ws.on("error", () => {
						closed = true;
						closeSession();
					});
				});
			}
		}
	};
}
//#endregion
//#region src/secrets.ts
/** Credential ref prefix shared by every host's secrets. */
const REF_PREFIX = "DSH_REMOTE_SSH";
/**
* Build the set of credential refs for one host alias.
* @param alias - the stable host alias (letters/digits/dots/hyphens).
*/
function hostCredentialRefs(alias) {
	const stem = alias.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
	return {
		password: credentialRef(`${REF_PREFIX}_${stem}_PASSWORD`),
		passphrase: credentialRef(`${REF_PREFIX}_${stem}_PASSPHRASE`)
	};
}
/**
* Full adapter wrapping the official DSH credential service. The same
* instance serves both the engine (read at connect) and the routes (write on
* host create/update, clear on delete).
*/
var CredentialAdapter = class {
	credentials;
	constructor(credentials) {
		this.credentials = credentials;
	}
	async getPassword(alias) {
		return (await this.credentials.resolve(hostCredentialRefs(alias).password))?.value;
	}
	async getPassphrase(alias) {
		return (await this.credentials.resolve(hostCredentialRefs(alias).passphrase))?.value;
	}
	async setPassword(alias, value) {
		if (value) await this.credentials.set(hostCredentialRefs(alias).password, value);
	}
	async setPassphrase(alias, value) {
		if (value) await this.credentials.set(hostCredentialRefs(alias).passphrase, value);
	}
	async clear(alias) {
		const refs = hostCredentialRefs(alias);
		await this.credentials.unset(refs.password);
		await this.credentials.unset(refs.passphrase);
	}
};
//#endregion
//#region src/remote-session.ts
/** Cap on glob path results (mirrors the local tool's magnitude). */
const GLOB_CAP = 2e3;
/** Cap on grep matches returned to the model. */
const GREP_CAP = 500;
/** Default foreground bash budget in remote mode (ms). */
const DEFAULT_BASH_TIMEOUT_MS = 12e4;
/** Default read page size (lines), mirroring the local read tool. */
const READ_LIMIT_DEFAULT = 2e3;
/**
* SessionId → remote workspace. In-memory map with persistence callbacks
* owned by the host store (persisted in ~/.dsh/remote-ssh.json).
*/
var RemoteBindings = class {
	persist;
	bindings = /* @__PURE__ */ new Map();
	constructor(persist, seed) {
		this.persist = persist;
		if (seed !== void 0) {
			for (const [sessionId, binding] of Object.entries(seed)) if (typeof binding?.alias === "string" && typeof binding?.dir === "string") this.bindings.set(sessionId, {
				alias: binding.alias,
				dir: binding.dir
			});
		}
	}
	/** Bind (or rebind) one session to a remote directory. */
	bind(sessionId, alias, dir) {
		const binding = {
			alias,
			dir
		};
		this.bindings.set(sessionId, binding);
		this.persist(this.snapshot());
		return binding;
	}
	/** Remove one session's binding (no-op when absent). */
	unbind(sessionId) {
		const removed = this.bindings.delete(sessionId);
		if (removed) this.persist(this.snapshot());
		return removed;
	}
	/** One session's binding, when bound. */
	get(sessionId) {
		return this.bindings.get(sessionId);
	}
	/** Every live binding (status surface). */
	list() {
		return [...this.bindings.entries()].map(([sessionId, binding]) => ({
			sessionId,
			...binding
		}));
	}
	snapshot() {
		return Object.fromEntries(this.bindings.entries());
	}
};
/** A failure result the registry renders as the tool's error content. */
function errorResult(message) {
	return {
		isError: true,
		error: { message },
		content: [{
			type: "text",
			text: message
		}]
	};
}
/**
* A remote-satisfied success. The value is validated against the ORIGINAL
* tool's output schema by the registry (createSuccessResult), which also
* renders it with the tool's own output.render — so the cast only asserts
* what that validation enforces.
*/
function successResult(value) {
	return {
		isError: false,
		value,
		content: []
	};
}
/** Resolve a tool-supplied path against the remote workspace. */
function resolveRemotePath(binding, path) {
	const raw = (path ?? "").trim();
	if (raw === "") return binding.dir;
	if (raw.startsWith("/")) return raw;
	return `${binding.dir.endsWith("/") ? binding.dir.slice(0, -1) : binding.dir}/${raw}`;
}
/** Join a remote dir with a name (forward slashes only). */
function joinRemote(dir, name) {
	return `${dir.endsWith("/") ? dir.slice(0, -1) : dir}/${name}`;
}
/** POSIX single-quote escaping for remote command construction. */
function shQuote(value) {
	return `'${value.replaceAll("'", `'"'"'`)}'`;
}
/** Translate a glob pattern (with ** support) into a JS RegExp over `./rel` paths. */
function globToRegExp(pattern) {
	let source = "";
	for (let i = 0; i < pattern.length; i += 1) {
		const char = pattern[i];
		if (char === "*") if (pattern[i + 1] === "*") if (pattern[i + 2] === "/") {
			source += "(?:.*/)?";
			i += 2;
		} else {
			source += ".*";
			i += 1;
		}
		else source += "[^/]*";
		else if (char === "?") source += "[^/]";
		else if ("\\^$.|+()[]{}".includes(char)) source += "\\" + char;
		else source += char;
	}
	return new RegExp(`^\\./${source}$`);
}
/** Split text into lines (terminal newline ignored). */
function toLines(text) {
	const body = text.endsWith("\n") ? text.slice(0, -1) : text;
	return body === "" ? [] : body.split("\n");
}
/** Read one remote file, split and paged like the local read tool. */
async function remoteRead(engine, binding, args) {
	const path = resolveRemotePath(binding, args.file_path);
	const file = await engine.readFile(binding.alias, path);
	if (file.binary) throw new Error(`'${path}' looks like a binary file — the read tool is text-only`);
	const offset = typeof args.offset === "number" && args.offset >= 1 ? Math.floor(args.offset) : 1;
	const limit = typeof args.limit === "number" && args.limit >= 1 ? Math.floor(args.limit) : READ_LIMIT_DEFAULT;
	const all = toLines(file.content);
	return {
		path,
		offset,
		lines: all.slice(offset - 1, offset - 1 + limit).map((text, index) => ({
			number: offset + index,
			text
		})),
		totalLines: all.length
	};
}
/** Write one remote file, reporting create/update like the local write tool. */
async function remoteWrite(engine, binding, args) {
	if (typeof args.file_path !== "string" || args.file_path === "") throw new Error("file_path is required");
	if (typeof args.content !== "string") throw new Error("content is required");
	const path = resolveRemotePath(binding, args.file_path);
	let before = null;
	try {
		const existing = await engine.readFile(binding.alias, path);
		before = existing.binary ? null : existing.content;
	} catch {}
	await engine.writeFile(binding.alias, path, args.content);
	return {
		path,
		operation: before === null ? "create" : "update",
		before,
		after: args.content
	};
}
/** Apply a str_replace edit remotely (old_string unique unless replace_all). */
async function remoteEdit(engine, binding, args) {
	if (typeof args.file_path !== "string" || args.file_path === "") throw new Error("file_path is required");
	if (typeof args.old_string !== "string") throw new Error("old_string is required");
	if (typeof args.new_string !== "string") throw new Error("new_string is required");
	const path = resolveRemotePath(binding, args.file_path);
	const file = await engine.readFile(binding.alias, path);
	if (file.binary) throw new Error(`'${path}' looks like a binary file — refusing to edit`);
	const before = file.content;
	const first = before.indexOf(args.old_string);
	if (first < 0) throw new Error(`String to replace not found in ${path}`);
	if (args.replace_all !== true) {
		if (before.indexOf(args.old_string, first + 1) >= 0) throw new Error(`Found 2+ occurrences of the string in ${path} — make old_string unique or pass replace_all`);
	}
	const after = args.replace_all === true ? before.split(args.old_string).join(args.new_string) : before.slice(0, first) + args.new_string + before.slice(first + args.old_string.length);
	await engine.writeFile(binding.alias, path, after);
	return {
		path,
		before,
		after
	};
}
/** The command-shaped editor tool (view / create / str_replace / insert). */
async function remoteStrReplaceEditor(engine, binding, args) {
	const path = resolveRemotePath(binding, args.path);
	switch (args.command) {
		case "view": {
			const file = await engine.readFile(binding.alias, path);
			if (file.binary) return `[binary file ${path}, ${file.bytes} bytes]`;
			const lines = toLines(file.content);
			const start = args.view_range !== void 0 && args.view_range[0] >= 1 ? Math.floor(args.view_range[0]) : 1;
			const end = args.view_range !== void 0 && args.view_range[1] !== void 0 && args.view_range[1] !== -1 ? Math.min(Math.floor(args.view_range[1]), lines.length) : lines.length;
			const body = lines.slice(start - 1, end).map((text, index) => `${start + index}→${text}`).join("\n");
			return `${path} (lines ${start}-${end} of ${lines.length}):\n${body}`;
		}
		case "create":
			if (typeof args.file_text !== "string") throw new Error("file_text is required for create");
			await engine.writeFile(binding.alias, path, args.file_text);
			return `File created successfully at: ${path}`;
		case "str_replace": {
			if (typeof args.old_str !== "string") throw new Error("old_str is required for str_replace");
			const edit = await remoteEdit(engine, binding, {
				file_path: path,
				old_string: args.old_str,
				new_string: args.new_str ?? ""
			});
			return `The file ${path} has been edited (${edit.before.length} → ${edit.after.length} chars).`;
		}
		case "insert": {
			if (typeof args.insert_line !== "number") throw new Error("insert_line is required for insert");
			if (typeof args.new_str !== "string") throw new Error("new_str is required for insert");
			const file = await engine.readFile(binding.alias, path);
			if (file.binary) throw new Error(`'${path}' looks like a binary file — refusing to edit`);
			const lines = toLines(file.content);
			const at = Math.min(Math.max(Math.floor(args.insert_line), 0), lines.length);
			lines.splice(at, 0, ...toLines(args.new_str));
			await engine.writeFile(binding.alias, path, lines.join("\n") + (file.content.endsWith("\n") || lines.length === 0 ? "\n" : ""));
			return `Inserted after line ${at} of ${path}.`;
		}
		default: throw new Error(`unsupported str_replace_editor command: ${String(args.command)}`);
	}
}
/** Glob via one `find` on the remote, filtered in JS. */
async function remoteGlob(engine, binding, args) {
	if (typeof args.pattern !== "string" || args.pattern === "") throw new Error("pattern is required");
	const root = resolveRemotePath(binding, args.path ?? ".");
	const result = await engine.exec(binding.alias, `cd -- ${shQuote(root)} && find . -type f`, 3e4);
	if (!result.success) throw new Error(`glob failed: ${result.stderr || result.error || `exit code ${result.exitCode}`}`);
	const matcher = globToRegExp(args.pattern);
	const paths = [];
	for (const line of toLines(result.stdout)) {
		if (!matcher.test(line)) continue;
		paths.push(joinRemote(root, line.slice(2)));
		if (paths.length >= GLOB_CAP) break;
	}
	return {
		root,
		paths
	};
}
/** Grep via ripgrep when the host has it, recursive ERE grep otherwise. */
async function remoteGrep(engine, binding, args) {
	if (typeof args.pattern !== "string" || args.pattern === "") throw new Error("pattern is required");
	const root = resolveRemotePath(binding, args.path ?? ".");
	const include = typeof args.include === "string" && args.include !== "" ? ` --include=${shQuote(args.include)}` : "";
	const command = await engine.hasCmd(binding.alias, "rg") ? `cd -- ${shQuote(root)} && rg -n --no-heading --hidden -g '!/.git/'${include ? ` -g ${shQuote(args.include)}` : ""} -- ${shQuote(args.pattern)} . 2>/dev/null` : `cd -- ${shQuote(root)} && grep -rnIE${include} -- ${shQuote(args.pattern)} . 2>/dev/null`;
	const result = await engine.exec(binding.alias, command, 6e4);
	if (!result.success && result.exitCode !== 1) throw new Error(`grep failed: ${result.stderr || result.error || `exit code ${result.exitCode}`}`);
	const matches = [];
	for (const line of toLines(result.stdout)) {
		const parsed = /^(.*?):(\d+):(.*)$/.exec(line);
		if (parsed === null) continue;
		const rel = parsed[1].startsWith("./") ? parsed[1].slice(2) : parsed[1];
		matches.push({
			path: joinRemote(root, rel),
			lineNumber: Number.parseInt(parsed[2], 10),
			line: parsed[3]
		});
		if (matches.length >= GREP_CAP) break;
	}
	return { matches };
}
/** Bash forwarding: one remote exec in the session's remote workspace. */
async function remoteBash(engine, binding, args) {
	if (typeof args.command !== "string" || args.command === "") throw new Error("command is required");
	if (args.run_in_background === true) throw new Error("远程会话暂不支持 run_in_background，请直接前台执行（可加 timeoutMs）");
	if (args.sandbox_permissions !== void 0) throw new Error("远程会话没有本地沙箱分级，无需 sandbox_permissions");
	const timeoutMs = typeof args.timeoutMs === "number" && args.timeoutMs > 0 ? args.timeoutMs : DEFAULT_BASH_TIMEOUT_MS;
	const cwd = resolveRemotePath(binding, args.workdir);
	return await engine.exec(binding.alias, withCwd(args.command, cwd), timeoutMs);
}
/** Map an exec outcome onto the FOREGROUND bash value (dsh-tool-bash). */
function bashObjectValue(result, timeoutMs) {
	return {
		kind: "foreground",
		exitCode: result.exitCode,
		signal: null,
		timedOut: result.timedOut,
		aborted: false,
		timeoutMs,
		stdout: {
			text: result.stdout,
			truncated: false
		},
		stderr: {
			text: result.stderr,
			truncated: false
		}
	};
}
/**
* Map an exec outcome onto the STRING value dsh-tool-bash-persistent
* returns (its output schema is `{type: "string"}` — captured terminal
* text, with a timeout notice).
*/
function bashStringValue(result, timeoutMs) {
	if (result.timedOut) return `Your command timed out after ${Math.round(timeoutMs / 1e3)} seconds.\n${result.stdout}${result.stderr}`;
	const parts = [];
	if (result.stdout !== "") parts.push(result.stdout.replace(/\n$/, ""));
	if (result.stderr !== "") parts.push(result.stderr.replace(/\n$/, ""));
	if (parts.length === 0) return "";
	if (result.exitCode !== 0 && result.exitCode !== null) parts.push(`(exit code ${result.exitCode})`);
	return parts.join("\n");
}
/** Does this tool's output schema want a bare string (persistent bash)? */
function wantsStringValue(definition) {
	return (definition?.output?.schema)?.type === "string";
}
/**
* Build the `tools/execute` around-dispatch listener implementing remote
* session mode. A session is remote when it has an explicit binding OR its
* cwd lives inside a remote-workspace marker directory (sessions created in
* a remote workspace are remote automatically). Unbound sessions and
* non-intercepted tools pass through.
*/
function makeRemoteSessionListener(engine, bindings, resolveByCwd, getTool) {
	return async (exec, next) => {
		const agent = exec.agent;
		const sessionId = agent?.id;
		if (sessionId === void 0) return await next();
		const binding = bindings.get(sessionId) ?? (() => {
			const cwd = agent?.session?.header?.cwd;
			if (cwd === void 0 || resolveByCwd === void 0) return void 0;
			return resolveByCwd(cwd);
		})();
		if (binding === void 0) return await next();
		if (exec.signal.aborted) return await next();
		try {
			switch (exec.name) {
				case "bash": {
					const result = await remoteBash(engine, binding, exec.arguments);
					const timeoutMs = typeof exec.arguments.timeoutMs === "number" && exec.arguments.timeoutMs > 0 ? exec.arguments.timeoutMs : DEFAULT_BASH_TIMEOUT_MS;
					return successResult(wantsStringValue(getTool?.("bash", exec.agent)) ? bashStringValue(result, timeoutMs) : bashObjectValue(result, timeoutMs));
				}
				case "read": return successResult(await remoteRead(engine, binding, exec.arguments));
				case "write": return successResult(await remoteWrite(engine, binding, exec.arguments));
				case "edit": return successResult(await remoteEdit(engine, binding, exec.arguments));
				case "str_replace_editor": return successResult(await remoteStrReplaceEditor(engine, binding, exec.arguments));
				case "glob": return successResult(await remoteGlob(engine, binding, exec.arguments));
				case "grep": return successResult(await remoteGrep(engine, binding, exec.arguments));
				case "read_image": return errorResult(`远程会话（${binding.alias}:${binding.dir}）暂不支持 read_image，请用 read 读取文本`);
				default: return await next();
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return errorResult(`[remote ${binding.alias}] ${message}`);
		}
	};
}
//#endregion
//#region src/sidebar-bridge.ts
/** The global name the patch looks up (kept in sync with the patch script). */
const BRIDGE_GLOBAL = "__DSH_REMOTE_SSH_FS__";
/** One shared marker-local path join ('/' separators, as the explorer uses). */
function joinMarker(markerRootLocal, name) {
	return markerRootLocal.endsWith("/") ? markerRootLocal + name : `${markerRootLocal}/${name}`;
}
/** Extract the {sessionId?, cwd?, path?} payload shape better-sidebar sends. */
function payloadPaths(payload) {
	if (typeof payload !== "object" || payload === null) return {};
	const record = payload;
	return {
		...typeof record.cwd === "string" && record.cwd !== "" ? { cwd: record.cwd } : {},
		...typeof record.path === "string" && record.path !== "" ? { path: record.path } : {}
	};
}
/**
* Publish the bridge on globalThis. The patched better-sidebar (same host
* process) reads it per call; unavailable global → patch is a no-op.
* @returns disposer removing the global.
*/
function publishSidebarBridge(engine) {
	const target = globalThis;
	target[BRIDGE_GLOBAL] = {
		isRemote(path) {
			return resolveMarkerPath(path) !== void 0;
		},
		async tree(payload) {
			const { cwd, path } = payloadPaths(payload);
			const resolved = resolveMarkerPath(path ?? cwd ?? "");
			if (resolved === void 0) return null;
			const { marker, remotePath } = resolved;
			const mapped = (await engine.ls(marker.alias, remotePath)).map((entry) => ({
				name: entry.name,
				path: joinMarker(marker.localRoot, entry.name),
				isDir: entry.type === "dir",
				hidden: entry.name.startsWith(".")
			}));
			mapped.sort((a, b) => a.isDir !== b.isDir ? a.isDir ? -1 : 1 : a.name.localeCompare(b.name, void 0, { sensitivity: "base" }));
			return {
				path: path ?? cwd ?? marker.localRoot,
				entries: mapped,
				truncated: false
			};
		},
		async read(payload) {
			const { path } = payloadPaths(payload);
			if (path === void 0) return null;
			const resolved = resolveMarkerPath(path);
			if (resolved === void 0) return null;
			const file = await engine.readFile(resolved.marker.alias, resolved.remotePath);
			if (file.binary) return {
				kind: "binary",
				size: file.bytes,
				truncated: file.truncated,
				head: ""
			};
			return {
				kind: "text",
				content: file.content,
				truncated: file.truncated
			};
		},
		async write(payload) {
			const record = typeof payload === "object" && payload !== null ? payload : {};
			if (typeof record.path !== "string" || typeof record.content !== "string") return null;
			const resolved = resolveMarkerPath(record.path);
			if (resolved === void 0) return null;
			await engine.writeFile(resolved.marker.alias, resolved.remotePath, record.content);
			return { ok: true };
		}
	};
	return () => {
		delete target[BRIDGE_GLOBAL];
	};
}
//#endregion
//#region src/tools.ts
/**
* Agent tools: the remote-development surface. Every tool talks to the same
* engine the web UI uses, so a host configured in the GUI is immediately
* operable by any agent, and vice versa. Tools mirror the ZCode remote
* capability set: run commands (git included), read and write remote files,
* transfer files — all scoped by a per-host remote workspace when one is set.
*/
/** One text content block (the only render shape these tools emit). */
function text(value) {
	return [{
		type: "text",
		text: value
	}];
}
/** Host table render shared by list surfaces. */
function renderHosts(hosts) {
	if (hosts.length === 0) return "no hosts configured";
	return [
		"alias | target | auth | workspace | description",
		"--- | --- | --- | --- | ---",
		...hosts.map((host) => [
			host.alias,
			`${host.user}@${host.host}:${host.port}`,
			host.auth,
			host.workspace ?? "-",
			host.description ?? ""
		].join(" | "))
	].join("\n");
}
/** Render one exec result (mirrors the bash-tool exit-code convention). */
function renderExec(result) {
	const parts = [result.timedOut ? "[timed out]" : `[exit code: ${result.exitCode ?? "null"}]`];
	if (result.stdout !== "") parts.push("stdout:\n" + result.stdout);
	if (result.stderr !== "") parts.push("stderr:\n" + result.stderr);
	if (result.error !== void 0) parts.push("error: " + result.error);
	parts.push(`duration: ${result.durationMs} ms`);
	return parts.join("\n");
}
/** The host-list tool. */
function sshListTool(engine) {
	return defineTool({
		name: "ssh_list",
		description: "List configured SSH remote hosts (alias, user@host:port, auth, default remote workspace, description). Use the alias with ssh_exec / ssh_read_file / ssh_write_file / ssh_upload / ssh_download. Triggers: SSH, remote server, remote development, connect/login to server, deploy, remote files, remote git.",
		parameters: { query: {
			type: "string",
			description: "Optional fuzzy match against alias, description, and host."
		} },
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: { hosts: {
					type: "array",
					required: true,
					items: {
						type: "object",
						additionalProperties: false,
						properties: {
							alias: {
								type: "string",
								required: true
							},
							host: {
								type: "string",
								required: true
							},
							port: {
								type: "integer",
								required: true
							},
							user: {
								type: "string",
								required: true
							},
							auth: {
								type: "string",
								enum: ["key", "password"],
								required: true
							},
							keyPath: {
								type: "string",
								description: "Local private key path (key auth)."
							},
							keyReady: {
								type: "boolean",
								required: true
							},
							passwordConfigured: {
								type: "boolean",
								required: true,
								description: "Whether a password credential is currently stored for this host (password auth)."
							},
							passphraseConfigured: {
								type: "boolean",
								required: true,
								description: "Whether a key passphrase credential is stored (key auth)."
							},
							workspace: {
								type: "string",
								description: "Default remote working directory for ssh_exec (set in the GUI)."
							},
							proxyJump: {
								type: "array",
								items: { type: "string" },
								required: true
							},
							description: { type: "string" },
							createdAt: {
								type: "integer",
								required: true
							},
							updatedAt: {
								type: "integer",
								required: true
							}
						}
					}
				} }
			},
			render: (_args, value) => text(renderHosts(value.hosts ?? []))
		},
		async execute(args) {
			return { hosts: engine.list(args.query) };
		}
	});
}
/** The command-execution tool (remote development workhorse). */
function sshExecTool(engine) {
	return defineTool({
		name: "ssh_exec",
		description: "Execute a shell command on a remote SSH host by alias — the remote counterpart of the local bash tool: build, test, inspect logs, control services, and run git (status/diff/commit/log). By default the command runs in the host's configured remote workspace (when set); pass cwd to override. Prefer combining independent read-only queries into one command. Triggers: run on the server, remote build/test, deploy, service control, remote git, view remote logs.",
		parameters: {
			alias: {
				type: "string",
				required: true,
				description: "Host alias from ssh_list."
			},
			command: {
				type: "string",
				required: true,
				description: "The shell command to run remotely."
			},
			cwd: {
				type: "string",
				description: "Remote working directory (defaults to the host's configured workspace, else the login home)."
			},
			timeoutMs: {
				type: "integer",
				description: "Timeout in milliseconds (default 60000)."
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					success: {
						type: "boolean",
						required: true
					},
					exitCode: {
						oneOf: [{ type: "integer" }, { type: "null" }],
						required: true
					},
					timedOut: {
						type: "boolean",
						required: true
					},
					stdout: {
						type: "string",
						required: true
					},
					stderr: {
						type: "string",
						required: true
					},
					durationMs: {
						type: "integer",
						required: true
					},
					error: { type: "string" }
				}
			},
			render: (_args, value) => text(renderExec(value))
		},
		async execute(args) {
			const resolvedCwd = args.cwd ?? engine.find(args.alias)?.workspace;
			return await engine.exec(args.alias, withCwd(args.command, resolvedCwd), args.timeoutMs);
		}
	});
}
/** The remote file read tool. */
function sshReadFileTool(engine) {
	return defineTool({
		name: "ssh_read_file",
		description: "Read one remote file as text (up to 2 MB) — the remote counterpart of reading a file in the local workspace. Use it before ssh_write_file edits, to inspect configs, logs, and source files on the server. Triggers: read remote file, view server config, inspect remote source/log.",
		parameters: {
			alias: {
				type: "string",
				required: true,
				description: "Host alias from ssh_list."
			},
			path: {
				type: "string",
				required: true,
				description: "Absolute remote file path."
			},
			maxBytes: {
				type: "integer",
				description: "Read byte cap (default 2 MB)."
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					path: {
						type: "string",
						required: true
					},
					content: {
						type: "string",
						required: true
					},
					bytes: {
						type: "integer",
						required: true
					},
					truncated: {
						type: "boolean",
						required: true
					},
					binary: {
						type: "boolean",
						required: true,
						description: "True when the content looks binary (do not edit)."
					}
				}
			},
			render: (_args, value) => text(`${value.path} (${value.bytes} bytes${value.truncated ? ", truncated" : ""}${value.binary ? ", binary" : ""})\n` + (value.binary ? "[binary content not shown]" : value.content))
		},
		async execute(args) {
			return await engine.readFile(args.alias, args.path, args.maxBytes);
		}
	});
}
/** The remote directory listing tool (navigation companion of read/write). */
function sshListDirTool(engine) {
	return defineTool({
		name: "ssh_list_dir",
		description: "List one remote directory (name, type, size, mtime) — the remote counterpart of listing a local directory. Use it to navigate the remote filesystem before reading or writing files. Triggers: list remote directory, browse remote files, remote workspace contents.",
		parameters: {
			alias: {
				type: "string",
				required: true,
				description: "Host alias from ssh_list."
			},
			path: {
				type: "string",
				required: true,
				description: "Absolute remote directory path (\".\" resolves to the login home)."
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					path: {
						type: "string",
						required: true
					},
					entries: {
						type: "array",
						required: true,
						items: {
							type: "object",
							additionalProperties: false,
							properties: {
								name: {
									type: "string",
									required: true
								},
								type: {
									type: "string",
									enum: [
										"dir",
										"file",
										"other"
									],
									required: true
								},
								size: {
									type: "integer",
									required: true
								},
								mtimeMs: {
									type: "integer",
									required: true
								}
							}
						}
					}
				}
			},
			render: (_args, value) => text(value.entries.length === 0 ? `${value.path}: empty` : [`${value.path}:`, ...value.entries.map((entry) => `${entry.type === "dir" ? "d" : entry.type === "file" ? "-" : "?"} ${entry.name}${entry.type === "dir" ? "/" : ""} (${entry.size} B)`)].join("\n"))
		},
		async execute(args) {
			return {
				path: args.path,
				entries: await engine.ls(args.alias, args.path)
			};
		}
	});
}
/** The remote file write tool. */
function sshWriteFileTool(engine) {
	return defineTool({
		name: "ssh_write_file",
		description: "Write text content to one remote file (creates or overwrites) — the remote counterpart of editing a file in the local workspace. Read the file first (ssh_read_file) before overwriting; the parent directory must exist (ssh_exec mkdir -p). Triggers: edit remote file, write server config, fix remote source.",
		parameters: {
			alias: {
				type: "string",
				required: true,
				description: "Host alias from ssh_list."
			},
			path: {
				type: "string",
				required: true,
				description: "Absolute remote file path."
			},
			content: {
				type: "string",
				required: true,
				description: "Full file content to write."
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					ok: {
						type: "boolean",
						required: true
					},
					bytes: { type: "integer" },
					error: { type: "string" }
				}
			},
			render: (_args, value) => text(value.ok ? `wrote ${value.bytes ?? 0} bytes` : `write failed: ${value.error ?? "unknown error"}`)
		},
		async execute(args) {
			try {
				return {
					ok: true,
					...await engine.writeFile(args.alias, args.path, args.content)
				};
			} catch (error) {
				return {
					ok: false,
					error: error instanceof Error ? error.message : String(error)
				};
			}
		}
	});
}
/** The upload tool. */
function sshUploadTool(engine) {
	return defineTool({
		name: "ssh_upload",
		description: "Upload a local file to a remote SSH host. The local path is on THIS machine (the dsh host); the remote destination must be absolute (parent dirs are created). Triggers: upload file to server, deploy artifact, copy build output to server.",
		parameters: {
			alias: {
				type: "string",
				required: true,
				description: "Host alias from ssh_list."
			},
			localPath: {
				type: "string",
				required: true,
				description: "Absolute local file path on this machine."
			},
			remotePath: {
				type: "string",
				required: true,
				description: "Absolute destination path on the remote host."
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					ok: {
						type: "boolean",
						required: true
					},
					transferredBytes: { type: "integer" },
					files: { type: "integer" },
					error: { type: "string" }
				}
			},
			render: (_args, value) => text(value.ok ? `uploaded ${value.files ?? 1} file(s), ${value.transferredBytes ?? 0} bytes` : `upload failed: ${value.error ?? "unknown error"}`)
		},
		async execute(args) {
			try {
				const outcome = await engine.upload(args.alias, args.localPath, args.remotePath, false);
				return {
					ok: true,
					transferredBytes: outcome.bytes,
					files: outcome.files
				};
			} catch (error) {
				return {
					ok: false,
					error: error instanceof Error ? error.message : String(error)
				};
			}
		}
	});
}
/** The download tool. */
function sshDownloadTool(engine) {
	return defineTool({
		name: "ssh_download",
		description: "Download a remote FILE from an SSH host to a local path on this machine. Directory download is not supported — download files individually. Triggers: download file from server, fetch remote log/artifact.",
		parameters: {
			alias: {
				type: "string",
				required: true,
				description: "Host alias from ssh_list."
			},
			remotePath: {
				type: "string",
				required: true,
				description: "Remote file path."
			},
			localPath: {
				type: "string",
				required: true,
				description: "Absolute destination path on this machine."
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					ok: {
						type: "boolean",
						required: true
					},
					bytes: { type: "integer" },
					error: { type: "string" }
				}
			},
			render: (_args, value) => text(value.ok ? `downloaded ${value.bytes ?? 0} bytes` : `download failed: ${value.error ?? "unknown error"}`)
		},
		async execute(args) {
			try {
				return {
					ok: true,
					bytes: (await engine.download(args.alias, args.remotePath, args.localPath)).bytes
				};
			} catch (error) {
				return {
					ok: false,
					error: error instanceof Error ? error.message : String(error)
				};
			}
		}
	});
}
//#endregion
//#region src/index.ts
/** Stable cordis plugin name. */
const name = "ssh-bridge";
/** Services required before the SSH surfaces can mount. */
const inject = [
	"webServer",
	"tools",
	"systemPrompt",
	"credentials"
];
/**
* Settings namespace of the SSH capability — the section the web settings
* surface edits. Spelled here rather than imported: the browser half spells
* the same value and must not depend on a Host package.
*/
const SSH_SETTINGS_NAMESPACE = settingsNamespace("dsh-ssh-bridge");
const Config = import_lib.default.object({
	announceToAgent: import_lib.default.boolean().default(true),
	enabled: import_lib.default.boolean().default(true)
});
/** Schema default, re-read for hand-built test contexts (the loader applies them normally). */
const DEFAULT_ANNOUNCE = true;
/** Order of the announcement section within the tool-guidance band. */
const SECTION_ORDER = 150;
/** Model-facing announcement: plugin presence, capabilities, and limits. */
const SSH_GUIDANCE = "本机已安装 dsh-ssh-bridge 插件（远程开发，ZCode 风格）：侧边栏「远程 SSH」入口；主机配置存 ~/.dsh/remote-ssh.json（支持从 ~/.ssh/config 导入）。两种用法：① 远程会话（推荐）：用户在 GUI 面板把会话绑定到某主机的远程目录后，bash / read / write / edit / str_replace_editor / glob / grep 会在该远程目录透明执行（路径按远程解析，命令、git、构建、测试都在服务器上跑）——此时像平常一样使用这些工具即可，不要再用 ssh_* 工具操作同一目录。② 显式工具：ssh_list 列主机；ssh_exec 执行远程命令；ssh_list_dir 浏览远程目录；ssh_read_file / ssh_write_file 读写远程文件；ssh_upload / ssh_download 传输文件（适合未绑定会话的一次性操作）。支持密钥/密码认证、密钥口令与 ProxyJump 跳板。凭证安全：密码与密钥口令存于 DSH 官方凭证库，仅连接时读取。限制：远程会话中 read_image 与后台任务不可用；写文件为整体覆盖；断线重连可能重放非幂等命令；破坏性操作先确认。用户提到「SSH / 远程服务器 / 服务器上的项目 / 远程开发 / 部署」时即指本插件。";
/**
* Mount the SSH engine, routes, tools, and announcement.
* @param ctx - host plugin context carrying webServer/tools/systemPrompt/credentials.
* @param config - resolved plugin config (schema defaults applied by the loader).
*/
function apply(ctx, config) {
	let current = () => config ?? {};
	const resolve = () => {
		const value = current();
		return {
			announceToAgent: value.announceToAgent ?? DEFAULT_ANNOUNCE,
			enabled: value.enabled ?? true
		};
	};
	const store = new HostStore();
	const vault = typeof ctx.credentials?.resolve === "function" ? new CredentialAdapter(ctx.credentials) : void 0;
	if (vault !== void 0) migrateLegacyStore(store, vault).catch(() => void 0);
	const engine = new SshEngine(store, { secretReader: vault });
	ctx.effect(() => () => {
		engine.dispose();
	}, "dsh-ssh-bridge: engine");
	const bindings = new RemoteBindings((map) => {
		store.saveBindings(map);
	}, store.loadBindings());
	const bindingByCwd = (cwd) => {
		const resolved = resolveMarkerPath(cwd);
		return resolved === void 0 ? void 0 : {
			alias: resolved.marker.alias,
			dir: resolved.marker.dir
		};
	};
	const unpublishBridge = publishSidebarBridge(engine);
	ctx.effect(() => () => {
		unpublishBridge();
	}, "dsh-ssh-bridge: sidebar bridge");
	const { routes, upgrade } = makeRoutes({
		store,
		engine,
		bindings,
		vault
	});
	let disposeRoutes;
	const tools = [
		sshListTool(engine),
		sshExecTool(engine),
		sshListDirTool(engine),
		sshReadFileTool(engine),
		sshWriteFileTool(engine),
		sshUploadTool(engine),
		sshDownloadTool(engine)
	];
	let disposeTools;
	let disposeSection;
	const sync = () => {
		const value = resolve();
		if (disposeSection !== void 0) {
			disposeSection();
			disposeSection = void 0;
		}
		if (disposeRoutes !== void 0) {
			disposeRoutes();
			disposeRoutes = void 0;
		}
		if (disposeTools !== void 0) {
			disposeTools();
			disposeTools = void 0;
		}
		if (!value.enabled) return;
		if (value.announceToAgent) disposeSection = ctx.systemPrompt.section({
			name: "plugin:dsh-ssh-bridge",
			order: SECTION_ORDER,
			text: SSH_GUIDANCE
		});
		disposeRoutes = ctx.effect(() => {
			const disposers = routes.map((route) => ctx.webServer.register(route));
			const upgradeDisposer = ctx.webServer.registerUpgrade(upgrade);
			return () => {
				for (const dispose of disposers) dispose();
				upgradeDisposer();
			};
		}, "dsh-ssh-bridge: routes");
		disposeTools = ctx.effect(() => {
			const disposers = tools.map((tool) => ctx.tools.register(tool));
			const disposeListener = ctx.on("tools/execute", makeRemoteSessionListener(engine, bindings, bindingByCwd, (name, agent) => ctx.tools.get(name, agent)));
			return () => {
				disposeListener();
				for (const dispose of disposers) dispose();
			};
		}, "dsh-ssh-bridge: tools");
	};
	installSettingsSection(ctx, SSH_SETTINGS_NAMESPACE, Config, config ?? {}, {
		setSource: (source) => {
			current = source;
			sync();
		},
		onChange: sync
	});
	sync();
}
/**
* Lift the marketplace dsh-ssh plugin's hosts into this store once, moving
* any inline plaintext secrets into the DSH credential store.
* @returns the migration journal.
*/
async function migrateLegacyStore(store, vault) {
	const lifted = store.extractLegacyStore();
	const aliases = [];
	for (const found of lifted) {
		const pending = [];
		if (found.password !== void 0) pending.push(vault.setPassword(found.alias, found.password));
		if (found.passphrase !== void 0) pending.push(vault.setPassphrase(found.alias, found.passphrase));
		if (pending.length > 0) {
			await Promise.all(pending);
			aliases.push(found.alias);
		}
	}
	return {
		migrated: lifted.length,
		aliases
	};
}
//#endregion
export { Config, SSH_GUIDANCE, SSH_SETTINGS_NAMESPACE, apply, inject, migrateLegacyStore, name };
