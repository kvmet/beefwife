/* Beefwife v0.1.0. Generated from beefwife/src; do not edit. */
var Beefwife = (function(pixi_js) {

//#region \0rolldown/runtime.js
	var __create = Object.create;
	var __defProp = Object.defineProperty;
	var __name = (target, value) => __defProp(target, "name", {
		value,
		configurable: true
	});
	var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
	var __getOwnPropNames = Object.getOwnPropertyNames;
	var __getProtoOf = Object.getPrototypeOf;
	var __hasOwnProp = Object.prototype.hasOwnProperty;
	var __exportAll = (all, no_symbols) => {
		let target = {};
		for (var name in all) {
			__defProp(target, name, {
				get: all[name],
				enumerable: true
			});
		}
		if (!no_symbols) {
			__defProp(target, Symbol.toStringTag, { value: "Module" });
		}
		return target;
	};
	var __copyProps = (to, from, except, desc) => {
		if (from && typeof from === "object" || typeof from === "function") {
			for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) {
					__defProp(to, key, {
						get: ((k) => from[k]).bind(null, key),
						enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
					});
				}
			}
		}
		return to;
	};
	var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
		value: mod,
		enumerable: true
	}) : target, mod));

//#endregion
pixi_js = __toESM(pixi_js, 1);

//#region src/pixi.mjs
/**
	* The renderer seam. Pixi is a peer, not a dependency: the module build imports
	* it and the classic-script build reads the page's global, which may be absent.
	* Every Pixi reference in the library arrives through here, so `available` is
	* the one place that decides whether a beefwife draws or only simulates.
	*/
	var PIXI = pixi_js;
	var available = typeof PIXI?.Container === "function";

//#endregion
//#region src/schema.mjs
/**
	* The v1 schema tree: every field a beefwife descriptor may hold, its kind,
	* and its bounds. Length-dimensioned fields carry `length`, the power of the
	* resize factor they scale by. Reading and resizing a descriptor against this
	* tree is beefwife-descriptor.js.
	*/
	var VERSION = 1;
	var SECTIONS = [
		"head",
		"trunk",
		"tail"
	];
	var ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
	var NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
	var LIMITS = Object.freeze({
		name: 64,
		definitions: 256,
		chunks: 256,
		placements: 512,
		instances: 512,
		path: 65536,
		pathTotal: 1048576
	});
	var number = (min, max, integer = false) => ({
		kind: "number",
		min,
		max,
		integer
	});
	var px = (min, max) => ({
		...number(min, max),
		length: 1
	});
	var perPx = (min, max) => ({
		...number(min, max),
		length: -1
	});
	var string = (minLength, maxLength, pattern = null) => ({
		kind: "string",
		minLength,
		maxLength,
		pattern
	});
	var choice = (...values) => ({
		kind: "choice",
		values
	});
	var literal = (value) => ({
		kind: "literal",
		value
	});
	var nullable = (item) => ({
		kind: "nullable",
		item
	});
	var object = (fields) => ({
		kind: "object",
		fields
	});
	var array = (item, maxLength) => ({
		kind: "array",
		item,
		maxLength
	});
	var record = (item, minLength = 0) => ({
		kind: "record",
		item,
		minLength,
		maxLength: LIMITS.definitions
	});
	var id = string(1, 64, ID_PATTERN);
	var ratio = number(0, 1);
	var pxScale = px(.001, 1e3);
	var ratioScale = number(.001, 100);
	var distance = px(1e-6, 1e4);
	var offset = px(-1e4, 1e4);
	var nonBlank = (node) => ({
		...node,
		blank: false
	});
	var colour = nullable(nonBlank(string(1, 256)));
	var material = object({
		velocityRetention: ratio,
		jointCorrection: ratio,
		linkCorrection: number(.001, 1),
		grip: object({
			forward: ratio,
			backward: ratio,
			lateral: ratio
		})
	});
	var shape = object({ path: nonBlank(string(1, LIMITS.path)) });
	var paint = object({
		fill: colour,
		stroke: nullable(object({
			colour: string(1, 256),
			width: px(0, 1e3)
		}))
	});
	var span = object({
		start: px(0, 1e3),
		end: px(0, 1e3)
	});
	var sectionOf = (minChunks) => object({
		chunks: number(minChunks, LIMITS.chunks, true),
		spacing: px(1e-6, 1e3),
		material: id,
		motionScale: object({
			bend: number(0, 4),
			thrust: number(0, 4),
			gather: number(0, 4),
			contact: number(0, 4)
		}),
		profile: object({
			ribbonWidth: span,
			plateScale: object({
				start: number(0, 100),
				end: number(0, 100)
			})
		})
	});
	var anchor = object({
		section: nullable(choice(...SECTIONS)),
		from: choice("head", "tail"),
		offset: number(0, LIMITS.chunks - 1, true)
	});
	var repeat = object({
		count: nullable(number(1, LIMITS.chunks, true)),
		step: number(1, LIMITS.chunks, true)
	});
	var plate = object({
		id,
		shape: id,
		paint: id,
		at: anchor,
		repeat,
		scale: pxScale
	});
	var ornament = object({
		id,
		shape: id,
		paint: id,
		at: anchor,
		repeat,
		side: choice("left", "right", "both"),
		layer: choice("under", "over"),
		offset: object({
			forward: offset,
			outward: offset
		}),
		angleDegrees: number(-180, 180),
		scale: pxScale,
		source: ratio,
		react: number(-4, 4),
		recover: number(0, 1e3),
		wobble: ratio
	});
	var schema = object({
		schemaVersion: literal(1),
		name: string(1, LIMITS.name, NAME_PATTERN),
		definitions: object({
			materials: record(material, 1),
			shapes: record(shape, 1),
			paints: record(paint, 1)
		}),
		gait: object({
			cyclesPerSecond: number(0, 100),
			phaseLagRadiansPerPixel: perPx(-1e3, 1e3),
			bend: object({
				amplitude: number(0, 10),
				harmonic: number(1, 8, true)
			}),
			thrust: object({
				acceleration: px(0, 1e6),
				harmonic: number(1, 8, true),
				phaseOffset: number(-Math.PI, Math.PI),
				dutyCycle: number(.01, 1)
			}),
			gather: object({
				amplitude: number(0, .95),
				harmonic: number(1, 8, true),
				phaseOffset: number(-Math.PI, Math.PI)
			}),
			contact: object({
				amplitude: ratio,
				harmonic: number(1, 8, true),
				phaseOffset: number(-Math.PI, Math.PI),
				dutyCycle: number(.01, 1)
			})
		}),
		chain: object({
			physics: object({
				autoLift: object({
					amount: ratio,
					share: ratio,
					rate: number(0, 1e3)
				}),
				steering: object({
					gain: number(0, 100),
					limit: number(0, Math.PI),
					rate: number(0, 1e3)
				})
			}),
			breathing: ratio,
			sections: object({
				head: sectionOf(1),
				trunk: sectionOf(1),
				tail: sectionOf(0)
			}),
			skin: object({
				loadScale: number(-1, 10),
				ribbon: object({ paint: id }),
				plates: array(plate, LIMITS.chunks),
				ornaments: array(ornament, LIMITS.placements)
			})
		}),
		legs: object({
			section: choice(...SECTIONS),
			pairs: number(0, 128, true),
			reach: distance,
			spread: number(0, 4),
			lead: ratio,
			fold: ratio,
			jointBend: number(-1, 1),
			jointLean: number(-1, 1),
			jointLeanCenter: number(-1, 1),
			sidePhase: ratio,
			liftThreshold: ratio,
			swingCycles: number(.001, 60),
			swingArc: number(0, 4),
			jitter: ratio,
			skin: object({
				limbPaint: id,
				limbWidth: px(0, 1e3),
				foot: object({
					shape: id,
					paint: id,
					scale: pxScale,
					plantedScale: ratioScale
				})
			})
		})
	});

//#endregion
//#region src/descriptor.mjs
/**
	* Canonical JSON contract for a beefwife. Definitions are descriptor-local:
	* sections link physical materials, while visual placements link shapes and
	* paints. `read` validates and returns an owned value in canonical key order.
	* `scale` resizes a creature by transforming every length-dimensioned field.
	* `bounds` reports what the schema enforces for one field.
	*/
	var descriptor_exports = /* @__PURE__ */ __exportAll({
		ID_PATTERN: () => ID_PATTERN,
		LIMITS: () => LIMITS,
		NAME_PATTERN: () => NAME_PATTERN,
		VERSION: () => 1,
		bounds: () => bounds,
		parse: () => parse,
		read: () => read,
		scale: () => scale,
		stringify: () => stringify
	});
	var fail = (path, message) => {
		throw new Error(`${path}: ${message}`);
	};
	var plainObject$1 = /* @__PURE__ */ __name((value, path) => {
		if (!value || typeof value !== "object" || Array.isArray(value)) fail(path, "must be an object");
		const prototype = Object.getPrototypeOf(value);
		if (prototype !== Object.prototype && prototype !== null) fail(path, "must be a plain JSON object");
	}, "plainObject");
	var ownKeys = (value, path) => {
		const keys = Reflect.ownKeys(value);
		if (keys.some((key) => typeof key !== "string")) fail(path, "must not contain symbol keys");
		keys.forEach((key) => {
			const descriptor = Object.getOwnPropertyDescriptor(value, key);
			if (!descriptor.enumerable || !("value" in descriptor)) fail(`${path}.${key}`, "must be an enumerable data property");
		});
		return keys;
	};
	var readNode = (node, value, path, ancestors) => {
		if (node.kind === "nullable") return value === null ? null : readNode(node.item, value, path, ancestors);
		if (node.kind === "literal") {
			if (value !== node.value) fail(path, `must equal ${node.value}`);
			return value;
		}
		if (node.kind === "choice") {
			if (!node.values.includes(value)) fail(path, `must be one of ${node.values.join(", ")}`);
			return value;
		}
		if (node.kind === "number") {
			if (typeof value !== "number" || !Number.isFinite(value)) fail(path, "must be a finite number");
			if (node.integer && !Number.isInteger(value)) fail(path, "must be an integer");
			if (value < node.min || value > node.max) fail(path, `must be between ${node.min} and ${node.max}`);
			return Object.is(value, -0) ? 0 : value;
		}
		if (node.kind === "string") {
			if (typeof value !== "string") fail(path, "must be a string");
			if (value.length < node.minLength || value.length > node.maxLength) fail(path, `must contain ${node.minLength} to ${node.maxLength} characters`);
			if (node.pattern && !node.pattern.test(value)) fail(path, "contains characters that are not allowed");
			return value;
		}
		if (node.kind === "array") {
			if (!Array.isArray(value)) fail(path, "must be an array");
		} else plainObject$1(value, path);
		if (ancestors.has(value)) fail(path, "must not contain a cycle");
		ancestors.add(value);
		try {
			if (node.kind === "array") {
				if (value.length > node.maxLength) fail(path, `must contain at most ${node.maxLength} entries`);
				const keys = Reflect.ownKeys(value).filter((key) => key !== "length");
				if (keys.some((key) => typeof key !== "string")) fail(path, "must not contain symbol keys");
				keys.forEach((key) => {
					const descriptor = Object.getOwnPropertyDescriptor(value, key);
					if (!descriptor.enumerable || !("value" in descriptor)) fail(`${path}.${String(key)}`, "must be an enumerable data property");
				});
				for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i)) fail(`${path}[${i}]`, "is missing");
				if (keys.some((key) => !/^(0|[1-9][0-9]*)$/.test(key))) fail(path, "must not contain named properties");
				return value.map((item, i) => readNode(node.item, item, `${path}[${i}]`, ancestors));
			}
			const keys = ownKeys(value, path);
			if (node.kind === "record") {
				if (keys.length < node.minLength || keys.length > node.maxLength) fail(path, `must contain ${node.minLength} to ${node.maxLength} definitions`);
				const out = {};
				keys.sort().forEach((key) => {
					if (!ID_PATTERN.test(key)) fail(`${path}.${key}`, "has an invalid id");
					out[key] = readNode(node.item, value[key], `${path}.${key}`, ancestors);
				});
				return out;
			}
			const expected = Object.keys(node.fields);
			keys.forEach((key) => {
				if (!Object.hasOwn(node.fields, key)) fail(`${path}.${key}`, "is unknown");
			});
			const out = {};
			expected.forEach((key) => {
				if (!Object.hasOwn(value, key)) fail(`${path}.${key}`, "is required");
				out[key] = readNode(node.fields[key], value[key], `${path}.${key}`, ancestors);
			});
			return out;
		} finally {
			ancestors.delete(value);
		}
	};
	var reference = (table, id, path) => {
		if (!Object.hasOwn(table, id)) fail(path, `references missing "${id}"`);
	};
	var resolvedChunks = (descriptor, placement, path) => {
		const sections = descriptor.chain.sections;
		const offsets = {
			head: 0,
			trunk: sections.head.chunks,
			tail: sections.head.chunks + sections.trunk.chunks
		};
		const section = placement.at.section;
		const length = section ? sections[section].chunks : SECTIONS.reduce((sum, name) => sum + sections[name].chunks, 0);
		if (!length) fail(`${path}.at`, "cannot address an empty scope");
		const offset = placement.at.offset;
		if (offset >= length) fail(`${path}.at.offset`, "falls outside its scope");
		const direction = placement.at.from === "head" ? 1 : -1;
		const localStart = direction > 0 ? offset : length - 1 - offset;
		const available = Math.floor((length - 1 - offset) / placement.repeat.step) + 1;
		const count = placement.repeat.count ?? available;
		if (count > available) fail(`${path}.repeat.count`, "runs outside its scope");
		const base = section ? offsets[section] : 0;
		return Array.from({ length: count }, (_, i) => base + localStart + direction * i * placement.repeat.step);
	};
	var validate = (descriptor) => {
		const { definitions, chain, legs } = descriptor;
		const sections = chain.sections;
		const total = SECTIONS.reduce((sum, name) => sum + sections[name].chunks, 0);
		if (total < 2 || total > LIMITS.chunks) fail("$.chain.sections", `must contain 2 to ${LIMITS.chunks} chunks`);
		SECTIONS.forEach((name) => reference(definitions.materials, sections[name].material, `$.chain.sections.${name}.material`));
		SECTIONS.forEach((name) => {
			const scale = sections[name].motionScale;
			if (descriptor.gait.gather.amplitude * scale.gather >= 1) fail(`$.chain.sections.${name}.motionScale.gather`, "makes the gathered link length zero or negative");
			if (descriptor.gait.contact.amplitude * scale.contact > 1) fail(`$.chain.sections.${name}.motionScale.contact`, "makes ground contact negative");
		});
		[
			[
				definitions.paints,
				chain.skin.ribbon.paint,
				"$.chain.skin.ribbon.paint"
			],
			[
				definitions.paints,
				legs.skin.limbPaint,
				"$.legs.skin.limbPaint"
			],
			[
				definitions.shapes,
				legs.skin.foot.shape,
				"$.legs.skin.foot.shape"
			],
			[
				definitions.paints,
				legs.skin.foot.paint,
				"$.legs.skin.foot.paint"
			]
		].forEach((args) => reference(...args));
		const placementIds = /* @__PURE__ */ new Set();
		const occupied = /* @__PURE__ */ new Map();
		chain.skin.plates.forEach((entry, i) => {
			const path = `$.chain.skin.plates[${i}]`;
			if (placementIds.has(entry.id)) fail(`${path}.id`, "must be unique");
			placementIds.add(entry.id);
			reference(definitions.shapes, entry.shape, `${path}.shape`);
			reference(definitions.paints, entry.paint, `${path}.paint`);
			resolvedChunks(descriptor, entry, path).forEach((chunk) => {
				if (occupied.has(chunk)) fail(`${path}.at`, `overlaps plate "${occupied.get(chunk)}" at chunk ${chunk}`);
				occupied.set(chunk, entry.id);
			});
		});
		let ornamentInstances = 0;
		chain.skin.ornaments.forEach((entry, i) => {
			const path = `$.chain.skin.ornaments[${i}]`;
			if (placementIds.has(entry.id)) fail(`${path}.id`, "must be unique");
			placementIds.add(entry.id);
			reference(definitions.shapes, entry.shape, `${path}.shape`);
			reference(definitions.paints, entry.paint, `${path}.paint`);
			ornamentInstances += resolvedChunks(descriptor, entry, path).length * (entry.side === "both" ? 2 : 1);
			if (ornamentInstances > LIMITS.instances) fail("$.chain.skin.ornaments", `must expand to at most ${LIMITS.instances} instances`);
		});
		if (legs.pairs && !sections[legs.section].chunks) fail("$.legs.section", "cannot attach legs to an empty section");
		Object.entries(definitions.paints).forEach(([name, entry]) => {
			if (entry.fill !== null && !entry.fill.trim()) fail(`$.definitions.paints.${name}.fill`, "must not be blank");
			if (entry.stroke !== null && !entry.stroke.colour.trim()) fail(`$.definitions.paints.${name}.stroke.colour`, "must not be blank");
			if (entry.fill === null && (entry.stroke === null || !entry.stroke.width)) fail(`$.definitions.paints.${name}`, "must draw a fill or visible stroke");
		});
		let pathTotal = 0;
		Object.entries(definitions.shapes).forEach(([name, entry]) => {
			if (!entry.path.trim()) fail(`$.definitions.shapes.${name}.path`, "must not be blank");
			pathTotal += entry.path.length;
		});
		if (pathTotal > LIMITS.pathTotal) fail("$.definitions.shapes", `paths must total at most ${LIMITS.pathTotal} characters`);
		return descriptor;
	};
	var read = (value) => validate(readNode(schema, value, "$", /* @__PURE__ */ new WeakSet()));
	var resolve = (segments) => {
		let node = schema;
		for (const segment of segments) {
			while (node.kind === "nullable") node = node.item;
			if (node.kind === "object" && Object.hasOwn(node.fields, segment)) node = node.fields[segment];
			else if (node.kind === "record" && segment === "*") node = node.item;
			else if (node.kind === "array" && segment === "[]") node = node.item;
			else return null;
		}
		const nullable = node.kind === "nullable";
		return {
			node: nullable ? node.item : node,
			nullable
		};
	};
	var shapeOf = (node) => {
		if (node.kind === "number") return {
			kind: "number",
			min: node.min,
			max: node.max,
			integer: node.integer
		};
		if (node.kind === "string") return {
			kind: "string",
			minLength: node.minLength,
			maxLength: node.maxLength,
			pattern: node.pattern && new RegExp(node.pattern.source, node.pattern.flags),
			blankAllowed: node.blank !== false
		};
		if (node.kind === "choice") return {
			kind: "choice",
			values: Object.freeze([...node.values])
		};
		if (node.kind === "literal") return {
			kind: "literal",
			value: node.value
		};
		if (node.kind === "object") return {
			kind: "object",
			fields: Object.freeze(Object.keys(node.fields))
		};
		if (node.kind === "record") return {
			kind: "record",
			minEntries: node.minLength,
			maxEntries: node.maxLength,
			keyPattern: new RegExp(ID_PATTERN.source, ID_PATTERN.flags)
		};
		return {
			kind: "array",
			maxLength: node.maxLength
		};
	};
	var bounds = (path) => {
		if (typeof path !== "string" || !path) fail("$", "bounds path must be a non-empty string");
		const found = resolve(path.replace(/\[\]/g, ".[]").split("."));
		if (!found) fail(`$.${path}`, "is not a field in this schema");
		return Object.freeze({
			...shapeOf(found.node),
			nullable: found.nullable
		});
	};
	var scaleNode = (node, value, factor) => {
		if (node.kind === "nullable") return value === null ? null : scaleNode(node.item, value, factor);
		if (node.kind === "number") return node.length ? value * factor ** node.length : value;
		if (node.kind === "object") {
			const out = {};
			Object.keys(node.fields).forEach((key) => {
				out[key] = scaleNode(node.fields[key], value[key], factor);
			});
			return out;
		}
		if (node.kind === "record") {
			const out = {};
			Object.keys(value).forEach((key) => {
				out[key] = scaleNode(node.item, value[key], factor);
			});
			return out;
		}
		if (node.kind === "array") return value.map((item) => scaleNode(node.item, item, factor));
		return value;
	};
	var scale = (descriptor, factor) => {
		if (typeof factor !== "number" || !Number.isFinite(factor) || factor <= 0) fail("$", "scale factor must be a finite number greater than 0");
		return read(scaleNode(schema, read(descriptor), factor));
	};
	var parse = (text) => {
		if (typeof text !== "string") fail("$", "JSON input must be a string");
		let value;
		try {
			value = JSON.parse(text);
		} catch (error) {
			fail("$", `invalid JSON: ${error.message}`);
		}
		return read(value);
	};
	var stringify = (value, space = 2) => {
		if (!Number.isInteger(space) || space < 0 || space > 10) fail("$", "indentation must be an integer from 0 to 10");
		return JSON.stringify(read(value), null, space);
	};

//#endregion
//#region src/model.mjs
/**
	* Compiles a validated descriptor into immutable runtime topology. This is a
	* private seam: callers keep the descriptor while physics consumes resolved
	* chunks, links, sections, and visual placements.
	*/
	var SECTION_NAMES = [
		"head",
		"trunk",
		"tail"
	];
	var MAX_BREATHING_STRAIN = .1;
	var BREATHING_RATE_AT_16_CHUNKS = .15;
	var LATERAL_SPACINGS_PER_SECOND = 14;
	var MIN_SWING_RATE = .01;
	var freeze = (value) => {
		if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
		Object.values(value).forEach(freeze);
		return Object.freeze(value);
	};
	var lerp$1 = /* @__PURE__ */ __name((start, end, t) => start + (end - start) * t, "lerp");
	var clamp$1 = /* @__PURE__ */ __name((value, low, high) => Math.max(low, Math.min(high, value)), "clamp");
	var profileAt = (span, index, count) => count === 1 ? (span.start + span.end) / 2 : lerp$1(span.start, span.end, index / (count - 1));
	var spatialAngle = (gait, channel, distance) => channel.phaseOffset - channel.harmonic * distance * gait.phaseLagRadiansPerPixel;
	var breathingRateFor = (trunkChunks) => clamp$1(BREATHING_RATE_AT_16_CHUNKS * Math.sqrt(16 / trunkChunks), .1, .4);
	var placementChunks = (placement, sections, chunkCount) => {
		const section = placement.at.section;
		const scope = section ? sections[section] : {
			start: 0,
			count: chunkCount
		};
		const direction = placement.at.from === "head" ? 1 : -1;
		const localStart = direction > 0 ? placement.at.offset : scope.count - 1 - placement.at.offset;
		const available = Math.floor((scope.count - 1 - placement.at.offset) / placement.repeat.step) + 1;
		const count = placement.repeat.count ?? available;
		return Array.from({ length: count }, (_, index) => scope.start + localStart + direction * index * placement.repeat.step);
	};
	var normalizePaints = (paints) => {
		const out = {};
		Object.entries(paints).forEach(([paintId, paint]) => {
			out[paintId] = {
				fill: paint.fill,
				stroke: paint.stroke ? paint.stroke.colour : null,
				strokeWidth: paint.stroke ? paint.stroke.width : 0
			};
		});
		return out;
	};
	var compile = (value) => {
		const descriptor = read(value);
		const gait = {
			...descriptor.gait,
			bend: {
				...descriptor.gait.bend,
				phaseOffset: 0
			}
		};
		const sectionSpecs = descriptor.chain.sections;
		const sections = {};
		const chunks = [];
		SECTION_NAMES.forEach((name) => {
			const spec = sectionSpecs[name];
			const start = chunks.length;
			const material = descriptor.definitions.materials[spec.material];
			for (let localIndex = 0; localIndex < spec.chunks; localIndex++) chunks.push({
				index: chunks.length,
				section: name,
				localIndex,
				restDistance: 0,
				materialId: spec.material,
				material,
				motionScale: spec.motionScale,
				bendScale: 0,
				ribbonWidth: profileAt(spec.profile.ribbonWidth, localIndex, spec.chunks),
				plateScale: profileAt(spec.profile.plateScale, localIndex, spec.chunks)
			});
			sections[name] = {
				name,
				start,
				end: chunks.length,
				count: spec.chunks,
				spacing: spec.spacing,
				materialId: spec.material,
				material,
				motionScale: spec.motionScale,
				profile: spec.profile
			};
		});
		const breathing = {
			strain: descriptor.chain.breathing * MAX_BREATHING_STRAIN,
			cyclesPerSecond: breathingRateFor(sections.trunk.count)
		};
		const links = [];
		let restDistance = 0;
		for (let index = 0; index < chunks.length - 1; index++) {
			const before = chunks[index];
			const after = chunks[index + 1];
			const beforeSection = sections[before.section];
			const afterSection = sections[after.section];
			const restLength = before.section !== after.section ? (beforeSection.spacing + afterSection.spacing) / 2 : beforeSection.spacing;
			const linkCorrection = (before.material.linkCorrection + after.material.linkCorrection) / 2;
			restDistance += restLength;
			after.restDistance = restDistance;
			links.push({
				index,
				from: index,
				to: index + 1,
				restLength,
				phaseDistance: (before.restDistance + after.restDistance) / 2,
				linkCorrection,
				gatherScale: (before.motionScale.gather + after.motionScale.gather) / 2,
				breathingScale: before.section === "trunk" && after.section === "trunk" ? breathing.strain : 0
			});
		}
		for (let index = 1; index < chunks.length - 1; index++) chunks[index].bendScale = (links[index - 1].restLength + links[index].restLength) / 2 / sections.trunk.spacing;
		chunks.forEach((chunk) => {
			const angle = spatialAngle(gait, gait.bend, chunk.restDistance);
			chunk.bendPhaseSine = Math.sin(angle);
			chunk.bendPhaseCosine = Math.cos(angle);
		});
		links.forEach((link) => {
			const angle = spatialAngle(gait, gait.gather, link.phaseDistance);
			link.gatherPhaseSine = Math.sin(angle);
			link.gatherPhaseCosine = Math.cos(angle);
		});
		const shapes = descriptor.definitions.shapes;
		const paints = normalizePaints(descriptor.definitions.paints);
		const plates = descriptor.chain.skin.plates.flatMap((placement) => placementChunks(placement, sections, chunks.length).map((chunk) => ({
			id: placement.id,
			chunk,
			shape: shapes[placement.shape],
			paint: paints[placement.paint],
			scale: placement.scale
		})));
		const ornaments = descriptor.chain.skin.ornaments.flatMap((placement) => {
			const sides = placement.side === "both" ? ["left", "right"] : [placement.side];
			return placementChunks(placement, sections, chunks.length).flatMap((chunk) => sides.map((side) => {
				const sideSign = side === "left" ? -1 : 1;
				const angle = placement.angleDegrees * Math.PI * sideSign / 180;
				return {
					id: placement.id,
					chunk,
					side,
					sideSign,
					layer: placement.layer,
					shape: shapes[placement.shape],
					paint: paints[placement.paint],
					offset: placement.offset,
					angleDegrees: placement.angleDegrees,
					angleCosine: Math.cos(angle),
					angleSine: Math.sin(angle),
					scale: placement.scale,
					waveGain: placement.react * (1 - placement.source),
					physGain: placement.react * placement.source,
					recover: placement.recover,
					wobble: placement.wobble
				};
			}));
		});
		return freeze({
			descriptor,
			sections,
			chunks,
			links,
			restLength: restDistance,
			gait,
			paints,
			physics: descriptor.chain.physics,
			breathing,
			skin: {
				lateralRate: LATERAL_SPACINGS_PER_SECOND * sections.trunk.spacing,
				loadScale: descriptor.chain.skin.loadScale,
				hasRibbon: chunks.some((chunk) => chunk.ribbonWidth > 0),
				ribbonPaintId: descriptor.chain.skin.ribbon.paint,
				ribbonPaint: paints[descriptor.chain.skin.ribbon.paint],
				plates,
				platesTailFirst: [...plates].sort((before, after) => after.chunk - before.chunk),
				ornaments
			},
			legs: {
				...descriptor.legs,
				spread: descriptor.legs.spread * descriptor.legs.reach,
				swingArc: descriptor.legs.swingArc * descriptor.legs.reach,
				swingSeconds: descriptor.legs.swingCycles / Math.max(descriptor.gait.cyclesPerSecond, MIN_SWING_RATE),
				start: sections[descriptor.legs.section].start,
				end: sections[descriptor.legs.section].end,
				skin: {
					limbPaint: paints[descriptor.legs.skin.limbPaint],
					limbWidth: descriptor.legs.skin.limbWidth,
					foot: {
						shape: shapes[descriptor.legs.skin.foot.shape],
						paint: paints[descriptor.legs.skin.foot.paint],
						scale: descriptor.legs.skin.foot.scale,
						plantedScale: descriptor.legs.skin.foot.plantedScale
					}
				}
			}
		});
	};

//#endregion
//#region src/drive.mjs
/** Schema-v1 gait clock and spatial channels. Private to the Beefwife runtime. */
	var TAU$2 = Math.PI * 2;
	var positiveModulo = (value, divisor) => (value % divisor + divisor) % divisor;
	var Gait = class {
		constructor(gait, phase = 0) {
			this.gait = gait;
			this.phase = positiveModulo(phase, TAU$2);
		}
		advance(dt, throttle) {
			this.phase = positiveModulo(this.phase + TAU$2 * this.gait.cyclesPerSecond * throttle * dt, TAU$2);
		}
		_phaseAt(distance, channel, phaseOffset = 0) {
			return channel.harmonic * (this.phase - distance * this.gait.phaseLagRadiansPerPixel) + channel.phaseOffset + phaseOffset;
		}
		_pulseAt(distance, channel, phaseOffset = 0) {
			const cycle = positiveModulo(this._phaseAt(distance, channel, phaseOffset), TAU$2) / TAU$2;
			if (cycle >= channel.dutyCycle) return 0;
			return Math.sin(Math.PI * cycle / channel.dutyCycle);
		}
		bendAt(distance, throttle, scale) {
			const channel = this.gait.bend;
			return channel.amplitude * scale * throttle * Math.sin(this._phaseAt(distance, channel));
		}
		thrustAt(distance, throttle, scale) {
			const channel = this.gait.thrust;
			return channel.acceleration * scale * throttle * this._pulseAt(distance, channel);
		}
		restAt(distance, throttle, scale) {
			const channel = this.gait.gather;
			return 1 + channel.amplitude * scale * throttle * Math.cos(this._phaseAt(distance, channel));
		}
		contactAt(distance, throttle, scale, phaseOffset = 0) {
			const channel = this.gait.contact;
			return 1 - channel.amplitude * scale * throttle * this._pulseAt(distance, channel, phaseOffset);
		}
	};

//#endregion
//#region src/tables.mjs
/**
	* The model, flattened for the solver. Every per-chunk and per-link constant
	* a substep reads, unpacked from the model's nested records into parallel
	* typed arrays: the substep runs over every chunk many times a second, and a
	* frozen `spec.material.grip.forward` is four loads where an array index is
	* one. Nothing here is state; rebuilding it from the same model, gait and
	* substep gives the same numbers.
	*/
	var REFERENCE_SUBSTEP_RATE = 60;
	var REFERENCE_LINK_SOLVE_RATE = 480;
	var shareAtRate = (share, rate, referenceRate) => {
		if (rate === referenceRate) return share;
		if (!(share > 0)) return 0;
		if (share >= 1) return 1;
		return 1 - Math.pow(1 - share, referenceRate / rate);
	};
	var ChainTables = class {
		constructor(model, gait, substep, relaxPasses) {
			const count = model.chunks.length;
			const linkCount = model.links.length;
			this.retention = new Float64Array(count);
			this.gripForward = new Float64Array(count);
			this.gripBackward = new Float64Array(count);
			this.gripLateral = new Float64Array(count);
			this.motionThrust = new Float64Array(count);
			this.motionContact = new Float64Array(count);
			this.motionBend = new Float64Array(count);
			this.bendScale = new Float64Array(count);
			this.bendPhaseSine = new Float64Array(count);
			this.bendPhaseCosine = new Float64Array(count);
			this.jointCorrectionHalf = new Float64Array(count);
			this.phaseLag = new Float64Array(count);
			this.linkRestLength = new Float64Array(linkCount);
			this.linkCorrectionHalf = new Float64Array(linkCount);
			this.gatherScale = new Float64Array(linkCount);
			this.gatherPhaseSine = new Float64Array(linkCount);
			this.gatherPhaseCosine = new Float64Array(linkCount);
			this.linkBreathes = new Uint8Array(linkCount);
			this.refresh(model, gait, substep, relaxPasses);
		}
		refresh(model, gait, substep, relaxPasses) {
			const lag = gait.phaseLagRadiansPerPixel;
			const substepRate = 1 / substep;
			const linkSolveRate = relaxPasses / substep;
			const perSubstep = (share) => shareAtRate(share, substepRate, REFERENCE_SUBSTEP_RATE);
			for (let index = 0; index < model.chunks.length; index++) {
				const spec = model.chunks[index];
				const grip = spec.material.grip;
				this.retention[index] = Math.pow(spec.material.velocityRetention, substep);
				this.gripForward[index] = perSubstep(grip.forward);
				this.gripBackward[index] = perSubstep(grip.backward);
				this.gripLateral[index] = perSubstep(grip.lateral);
				this.motionThrust[index] = spec.motionScale.thrust;
				this.motionContact[index] = spec.motionScale.contact;
				this.motionBend[index] = spec.motionScale.bend;
				this.bendScale[index] = spec.bendScale;
				this.bendPhaseSine[index] = spec.bendPhaseSine;
				this.bendPhaseCosine[index] = spec.bendPhaseCosine;
				this.jointCorrectionHalf[index] = perSubstep(spec.material.jointCorrection) * .5;
				this.phaseLag[index] = spec.restDistance * lag;
			}
			for (let index = 0; index < model.links.length; index++) {
				const link = model.links[index];
				this.linkRestLength[index] = link.restLength;
				this.linkCorrectionHalf[index] = shareAtRate(link.linkCorrection, linkSolveRate, REFERENCE_LINK_SOLVE_RATE) * .5;
				this.gatherScale[index] = link.gatherScale;
				this.gatherPhaseSine[index] = link.gatherPhaseSine;
				this.gatherPhaseCosine[index] = link.gatherPhaseCosine;
				this.linkBreathes[index] = link.breathingScale ? 1 : 0;
			}
		}
	};

//#endregion
//#region src/carry.mjs
/**
	* Moving chunk state onto a chain whose section counts changed. A chunk the
	* descriptor still names keeps its position and velocity; an added one is
	* seeded from its neighbours. The creature settles from where it was rather
	* than snapping straight, and since head always holds a chunk the new chain
	* always has something to carry from.
	*/
	var nameOf = (spec) => `${spec.section}:${spec.localIndex}`;
	var carryChunks = (chunks, model, previousChunks, previousModel) => {
		const source = /* @__PURE__ */ new Map();
		previousModel.chunks.forEach((spec, index) => source.set(nameOf(spec), previousChunks[index]));
		const carried = model.chunks.map((spec, index) => {
			const from = source.get(nameOf(spec));
			if (!from) return false;
			const chunk = chunks[index];
			chunk.x = from.x;
			chunk.y = from.y;
			chunk.px = from.px;
			chunk.py = from.py;
			chunk.dx = from.dx;
			chunk.dy = from.dy;
			chunk.idle = from.idle;
			chunk.gain = from.gain;
			return true;
		});
		for (let index = 0; index < chunks.length; index++) {
			if (carried[index]) continue;
			let before = index - 1;
			while (before >= 0 && !carried[before]) before--;
			let after = index + 1;
			while (after < chunks.length && !carried[after]) after++;
			const chunk = chunks[index];
			if (before >= 0 && after < chunks.length) {
				const start = chunks[before];
				const end = chunks[after];
				const along = (index - before) / (after - before);
				chunk.x = start.x + (end.x - start.x) * along;
				chunk.y = start.y + (end.y - start.y) * along;
				chunk.px = start.px + (end.px - start.px) * along;
				chunk.py = start.py + (end.py - start.py) * along;
				chunk.dx = start.dx;
				chunk.dy = start.dy;
			} else {
				const anchorIndex = before >= 0 ? before : after;
				const anchor = chunks[anchorIndex];
				const heading = before >= 0 ? -1 : 1;
				const link = model.links[before >= 0 ? index - 1 : index];
				const reach = (link ? link.restLength : 0) * Math.abs(index - anchorIndex);
				chunk.x = anchor.x + anchor.dx * heading * reach;
				chunk.y = anchor.y + anchor.dy * heading * reach;
				chunk.px = chunk.x;
				chunk.py = chunk.y;
				chunk.dx = anchor.dx;
				chunk.dy = anchor.dy;
			}
			chunk.idle = 0;
			chunk.gain = 0;
		}
	};

//#endregion
//#region src/bend.mjs
/**
	* The chain's angular constraint. One joint on its own reaches the turn it is
	* asked for exactly, but a chain of them barely bends: each joint pushes its
	* outer chunks one way and its middle the other, so a smooth run of targets
	* makes a smooth displacement field, and a joint angle is the second
	* difference of that field. Sweeping wider spans first gives the solver a
	* curvature a single joint cannot see, and the single joints then finish.
	*
	* Nothing here is state between substeps. The arrays are scratch, sized once
	* so a substep allocates nothing.
	*/
	var MAX_BEND_SPAN = 2;
	var Bend = class {
		constructor(count) {
			this.targets = new Float64Array(count);
			this.wantedX = new Float64Array(count);
			this.wantedY = new Float64Array(count);
			this.spanX = new Float64Array(count);
			this.spanY = new Float64Array(count);
		}
		update(model, gait, tables, restLengths, throttle, bias) {
			const channel = model.gait.bend;
			const phase = channel.harmonic * gait.phase;
			const phaseSine = Math.sin(phase);
			const phaseCosine = Math.cos(phase);
			const amplitude = channel.amplitude;
			const biasThrottle = bias * throttle;
			const { motionBend, bendPhaseSine, bendPhaseCosine, bendScale } = tables;
			const targets = this.targets;
			const wantedX = this.wantedX;
			const wantedY = this.wantedY;
			const last = targets.length - 1;
			let heading = 0;
			wantedX[0] = 0;
			wantedY[0] = 0;
			for (let index = 0; index < last; index++) {
				if (index > 0) {
					const bend = amplitude * motionBend[index] * throttle * (phaseSine * bendPhaseCosine[index] + phaseCosine * bendPhaseSine[index]);
					targets[index] = (bend + biasThrottle) * bendScale[index];
					heading += targets[index];
				}
				wantedX[index + 1] = wantedX[index] + Math.cos(heading) * restLengths[index];
				wantedY[index + 1] = wantedY[index] + Math.sin(heading) * restLengths[index];
			}
		}
		relax(chunks, jointCorrectionHalf) {
			for (let span = Math.min(2, chunks.length >> 2); span >= 1; span >>= 1) this.relaxSpan(chunks, jointCorrectionHalf, span);
		}
		relaxSpan(chunks, jointCorrectionHalf, span) {
			const count = chunks.length;
			const wantedX = this.wantedX;
			const wantedY = this.wantedY;
			const nextX = this.spanX;
			const nextY = this.spanY;
			for (let pivot = span; pivot + span < count; pivot += span) {
				const from = pivot - span;
				const to = pivot + span;
				const chunk = chunks[pivot];
				const before = chunks[from];
				const after = chunks[to];
				const ax = chunk.x - before.x;
				const ay = chunk.y - before.y;
				const bx = after.x - chunk.x;
				const by = after.y - chunk.y;
				const turn = Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
				const wx = wantedX[pivot] - wantedX[from];
				const wy = wantedY[pivot] - wantedY[from];
				const vx = wantedX[to] - wantedX[pivot];
				const vy = wantedY[to] - wantedY[pivot];
				const correction = (Math.atan2(wx * vy - wy * vx, wx * vx + wy * vy) - turn) * jointCorrectionHalf[pivot];
				const cosine = Math.cos(correction);
				const sine = Math.sin(correction);
				for (let index = from; index <= to; index++) {
					const x = chunks[index].x - chunk.x;
					const y = chunks[index].y - chunk.y;
					const away = index < pivot ? -sine : sine;
					nextX[index] = chunk.x + x * cosine - y * away;
					nextY[index] = chunk.y + x * away + y * cosine;
				}
				const width = to - from + 1;
				let driftX = 0;
				let driftY = 0;
				let centerX = 0;
				let centerY = 0;
				for (let index = from; index <= to; index++) {
					driftX += nextX[index] - chunks[index].x;
					driftY += nextY[index] - chunks[index].y;
					centerX += chunks[index].x;
					centerY += chunks[index].y;
				}
				driftX /= width;
				driftY /= width;
				centerX /= width;
				centerY /= width;
				let moment = 0;
				let inertia = 0;
				for (let index = from; index <= to; index++) {
					const rx = chunks[index].x - centerX;
					const ry = chunks[index].y - centerY;
					moment += rx * (nextY[index] - chunks[index].y - driftY) - ry * (nextX[index] - chunks[index].x - driftX);
					inertia += rx * rx + ry * ry;
				}
				const spin = inertia > 1e-12 ? moment / inertia : 0;
				for (let index = from; index <= to; index++) {
					const rx = chunks[index].x - centerX;
					const ry = chunks[index].y - centerY;
					chunks[index].x = nextX[index] - driftX + spin * ry;
					chunks[index].y = nextY[index] - driftY - spin * rx;
				}
			}
		}
		response(chunks, into = []) {
			const targets = this.targets;
			into.length = 0;
			for (let index = 1; index < chunks.length - 1; index++) {
				const before = chunks[index - 1];
				const chunk = chunks[index];
				const after = chunks[index + 1];
				const ax = chunk.x - before.x;
				const ay = chunk.y - before.y;
				const bx = after.x - chunk.x;
				const by = after.y - chunk.y;
				into.push({
					joint: index,
					commanded: targets[index],
					delivered: Math.atan2(ax * by - ay * bx, ax * bx + ay * by)
				});
			}
			return into;
		}
	};

//#endregion
//#region src/body.mjs
/** Schema-v1 Verlet chain. Private state is owned by one Beefwife instance. */
	var TAU$1 = Math.PI * 2;
	var PHYSICS_STEP = 1 / 60;
	var RELAX_PASSES = 8;
	var AXIS_RATE = 1.5;
	var MAX_LINK_STRETCH = 3;
	var magnitude$2 = /* @__PURE__ */ __name((x, y) => Math.sqrt(x * x + y * y), "magnitude");
	var compareGain = (chunks, before, after) => chunks[before].gain - chunks[after].gain || before - after;
	var selectLowest = (order, chunks, count) => {
		if (count <= 0 || count >= order.length) return;
		const target = count - 1;
		let left = 0;
		let right = order.length - 1;
		while (left < right) {
			const pivot = order[left + right >> 1];
			let lower = left;
			let upper = right;
			while (lower <= upper) {
				while (lower <= right && compareGain(chunks, order[lower], pivot) < 0) lower++;
				while (upper >= left && compareGain(chunks, pivot, order[upper]) < 0) upper--;
				if (lower <= upper) {
					const swap = order[lower];
					order[lower++] = order[upper];
					order[upper--] = swap;
				}
			}
			if (target <= upper) right = upper;
			else if (target >= lower) left = lower;
			else return;
		}
	};
	var Body = class {
		constructor(model, gait, breathingPhase = gait.phase) {
			this.model = model;
			this.gait = gait;
			this.breathingPhase = breathingPhase;
			this.breathingScale = 0;
			this.accumulator = 0;
			this.axis = {
				x: 1,
				y: 0
			};
			this.steeringBias = 0;
			this.chunks = model.chunks.map(() => ({
				x: 0,
				y: 0,
				px: 0,
				py: 0,
				dx: 1,
				dy: 0,
				idle: 0,
				gain: 0,
				gaitContact: 1,
				contact: 1
			}));
			this.linkTargets = new Float64Array(model.links.length);
			this.bend = new Bend(model.chunks.length);
			this.breathingShiftX = new Float64Array(model.chunks.length);
			this.breathingShiftY = new Float64Array(model.chunks.length);
			this.liftOrder = model.chunks.map((_, index) => index);
			this.liftTargets = new Float64Array(model.chunks.length);
			this.correction = {
				x: 0,
				y: 0
			};
			this.tables = new ChainTables(model, model.gait, PHYSICS_STEP, RELAX_PASSES);
		}
		reconfigure(model, gait, throttle = 1, breathingPhase = this.breathingPhase) {
			if (model.chunks.length !== this.chunks.length) throw new Error("cannot reconfigure a different chunk count");
			this.model = model;
			this.gait = gait;
			this.breathingPhase = breathingPhase;
			this.tables.refresh(model, model.gait, PHYSICS_STEP, RELAX_PASSES);
			this.refreshContacts(throttle);
		}
		place(position, direction) {
			this.chunks.forEach((chunk, index) => {
				const distance = this.model.chunks[index].restDistance;
				chunk.x = position.x - direction.x * distance;
				chunk.y = position.y - direction.y * distance;
				chunk.px = chunk.x;
				chunk.py = chunk.y;
				chunk.dx = direction.x;
				chunk.dy = direction.y;
				chunk.idle = 0;
				chunk.gain = 0;
			});
			this.axis = { ...direction };
			this.steeringBias = 0;
			this.accumulator = 0;
			this.breathingScale = 0;
			this.refreshContacts(1);
		}
		adopt(previous) {
			carryChunks(this.chunks, this.model, previous.chunks, previous.model);
			this.axis = { ...previous.axis };
			this.steeringBias = previous.steeringBias;
			this.accumulator = previous.accumulator;
			this.breathingScale = previous.breathingScale;
		}
		refreshContacts(throttle) {
			const autoLift = this.model.physics.autoLift;
			for (let index = 0; index < this.chunks.length; index++) {
				const chunk = this.chunks[index];
				const spec = this.model.chunks[index];
				chunk.gaitContact = this.gait.contactAt(spec.restDistance, throttle, spec.motionScale.contact);
				chunk.contact = Math.max(0, Math.min(1, chunk.gaitContact * (1 - autoLift.amount * chunk.idle * throttle)));
			}
		}
		translate(offset) {
			this.chunks.forEach((chunk) => {
				chunk.x += offset.x;
				chunk.y += offset.y;
				chunk.px += offset.x;
				chunk.py += offset.y;
			});
		}
		fitsTranslation(offset, limit) {
			return this.chunks.every((chunk) => [
				"x",
				"y",
				"px",
				"py"
			].every((key) => {
				const axisOffset = key.endsWith("x") ? offset.x : offset.y;
				const next = chunk[key] + axisOffset;
				return Number.isFinite(next) && Math.abs(next) <= limit;
			}));
		}
		worldCorrection(limit) {
			let minimumX = Infinity;
			let maximumX = -Infinity;
			let minimumY = Infinity;
			let maximumY = -Infinity;
			for (let index = 0; index < this.chunks.length; index++) {
				const chunk = this.chunks[index];
				minimumX = Math.min(minimumX, chunk.x, chunk.px);
				maximumX = Math.max(maximumX, chunk.x, chunk.px);
				minimumY = Math.min(minimumY, chunk.y, chunk.py);
				maximumY = Math.max(maximumY, chunk.y, chunk.py);
			}
			const correction = (minimum, maximum) => {
				if (maximum > limit) return limit - maximum;
				if (minimum < -limit) return -limit - minimum;
				return 0;
			};
			this.correction.x = correction(minimumX, maximumX);
			this.correction.y = correction(minimumY, maximumY);
			return this.correction;
		}
		step(dt, throttle, direction, afterSubstep) {
			this.accumulator += dt;
			let stepped = false;
			while (this.accumulator >= PHYSICS_STEP) {
				this.accumulator -= PHYSICS_STEP;
				this._substep(PHYSICS_STEP, throttle, direction);
				if (afterSubstep) afterSubstep(PHYSICS_STEP);
				stepped = true;
			}
			return stepped;
		}
		_substep(dt, throttle, direction) {
			this.gait.advance(dt, throttle);
			this.breathingPhase = (this.breathingPhase + TAU$1 * this.model.breathing.cyclesPerSecond * dt) % TAU$1;
			this._updateTangentsAndAxis(dt);
			this._applyBreathing();
			this._integrate(dt, throttle);
			this._updateLinkTargets(throttle);
			this.bend.update(this.model, this.gait, this.tables, this.linkTargets, throttle, this._steer(direction, dt));
			this.bend.relax(this.chunks, this.tables.jointCorrectionHalf);
			for (let pass = 0; pass < RELAX_PASSES; pass++) this._relaxLinks();
			this._clampLinks();
			this._applyAutoLift(dt, throttle);
		}
		_applyBreathing() {
			const nextScale = this.model.breathing.strain * Math.sin(this.breathingPhase);
			const scaleChange = nextScale - this.breathingScale;
			this.breathingScale = nextScale;
			if (Math.abs(scaleChange) < 1e-15) return;
			const { start, end, count, spacing } = this.model.sections.trunk;
			const middle = (count - 1) / 2;
			const front = this.chunks[start];
			const rear = this.chunks[end - 1];
			let meanX = 0;
			let meanY = 0;
			for (let index = 0; index < this.chunks.length; index++) {
				const chunk = this.chunks[index];
				const position = index < start ? middle : index >= end ? -middle : middle - (index - start);
				const tangent = index < start ? front : index >= end ? rear : chunk;
				const distance = position * spacing * scaleChange;
				const x = tangent.dx * distance;
				const y = tangent.dy * distance;
				this.breathingShiftX[index] = x;
				this.breathingShiftY[index] = y;
				meanX += x / this.chunks.length;
				meanY += y / this.chunks.length;
			}
			for (let index = 0; index < this.chunks.length; index++) {
				const chunk = this.chunks[index];
				const x = this.breathingShiftX[index] - meanX;
				const y = this.breathingShiftY[index] - meanY;
				chunk.x += x;
				chunk.y += y;
				chunk.px += x;
				chunk.py += y;
			}
		}
		_updateTangentsAndAxis(dt) {
			const chunks = this.chunks;
			const count = chunks.length;
			const last = count - 1;
			let axisX = 0;
			let axisY = 0;
			for (let index = 0; index < count; index++) {
				const chunk = chunks[index];
				const ahead = chunks[index === 0 ? 0 : index - 1];
				const behind = chunks[index === last ? last : index + 1];
				const x = ahead.x - behind.x;
				const y = ahead.y - behind.y;
				const tangentLength = Math.sqrt(x * x + y * y);
				if (tangentLength >= 1e-9) {
					chunk.dx = x / tangentLength;
					chunk.dy = y / tangentLength;
				}
				axisX += chunk.x - chunk.px;
				axisY += chunk.y - chunk.py;
			}
			const axisLength = Math.sqrt(axisX * axisX + axisY * axisY);
			if (axisLength < 1e-9) return;
			const amount = Math.min(1, dt * AXIS_RATE);
			this.axis.x += (axisX / axisLength - this.axis.x) * amount;
			this.axis.y += (axisY / axisLength - this.axis.y) * amount;
			const length = magnitude$2(this.axis.x, this.axis.y) || 1;
			this.axis.x /= length;
			this.axis.y /= length;
		}
		_integrate(dt, throttle) {
			const dtSquared = dt * dt;
			const chunks = this.chunks;
			const count = chunks.length;
			const gait = this.gait.gait;
			const phase = this.gait.phase;
			const contact = gait.contact;
			const thrust = gait.thrust;
			const contactHarmonic = contact.harmonic;
			const thrustHarmonic = thrust.harmonic;
			const contactPhaseOffset = contact.phaseOffset;
			const thrustPhaseOffset = thrust.phaseOffset;
			const contactDuty = contact.dutyCycle;
			const thrustDuty = thrust.dutyCycle;
			const contactAmplitude = contact.amplitude;
			const thrustAcceleration = thrust.acceleration;
			const autoLift = this.model.physics.autoLift.amount;
			const axisX = this.axis.x;
			const axisY = this.axis.y;
			const { retention, gripForward, gripBackward, gripLateral, motionContact, motionThrust, phaseLag } = this.tables;
			for (let index = 0; index < count; index++) {
				const chunk = chunks[index];
				const hold = retention[index];
				const velocityX = (chunk.x - chunk.px) * hold;
				const velocityY = (chunk.y - chunk.py) * hold;
				chunk.px = chunk.x;
				chunk.py = chunk.y;
				chunk.x += velocityX;
				chunk.y += velocityY;
				const dx = chunk.dx;
				const dy = chunk.dy;
				const x = chunk.x - chunk.px;
				const y = chunk.y - chunk.py;
				const along = x * dx + y * dy;
				const lateral = x * -dy + y * dx;
				const lagged = phase - phaseLag[index];
				const contactCycle = positiveModulo(contactHarmonic * lagged + contactPhaseOffset, TAU$1) / TAU$1;
				const gaitContact = contactCycle >= contactDuty ? 1 : 1 - contactAmplitude * motionContact[index] * throttle * Math.sin(Math.PI * contactCycle / contactDuty);
				chunk.gaitContact = gaitContact;
				const grounded = Math.max(0, Math.min(1, gaitContact * (1 - autoLift * chunk.idle * throttle)));
				chunk.contact = grounded;
				const retainedAlong = along * (1 - grounded * (along < 0 ? gripBackward[index] : gripForward[index]));
				const retainedLateral = lateral * (1 - grounded * gripLateral[index]);
				chunk.x = chunk.px + dx * retainedAlong - dy * retainedLateral;
				chunk.y = chunk.py + dy * retainedAlong + dx * retainedLateral;
				chunk.gain = -((along - retainedAlong) * (dx * axisX + dy * axisY) + (lateral - retainedLateral) * (-dy * axisX + dx * axisY));
				const thrustCycle = positiveModulo(thrustHarmonic * lagged + thrustPhaseOffset, TAU$1) / TAU$1;
				const acceleration = thrustCycle >= thrustDuty ? 0 : thrustAcceleration * motionThrust[index] * throttle * Math.sin(Math.PI * thrustCycle / thrustDuty);
				chunk.x += dx * acceleration * dtSquared;
				chunk.y += dy * acceleration * dtSquared;
			}
		}
		_steer(direction, dt) {
			const steering = this.model.physics.steering;
			const head = this.chunks[0];
			const error = Math.atan2(head.dx * direction.y - head.dy * direction.x, head.dx * direction.x + head.dy * direction.y);
			const wanted = -Math.max(-steering.limit, Math.min(steering.limit, error * steering.gain));
			this.steeringBias += (wanted - this.steeringBias) * Math.min(1, dt * steering.rate);
			return this.steeringBias;
		}
		_updateLinkTargets(throttle) {
			const channel = this.model.gait.gather;
			const phase = channel.harmonic * this.gait.phase;
			const phaseSine = Math.sin(phase);
			const phaseCosine = Math.cos(phase);
			const amplitude = channel.amplitude;
			const breathing = this.breathingScale;
			const targets = this.linkTargets;
			const { linkRestLength, gatherScale, gatherPhaseSine, gatherPhaseCosine, linkBreathes } = this.tables;
			for (let index = 0; index < targets.length; index++) {
				const wave = phaseCosine * gatherPhaseCosine[index] - phaseSine * gatherPhaseSine[index];
				const gather = 1 + amplitude * gatherScale[index] * throttle * wave;
				targets[index] = linkRestLength[index] * gather * (linkBreathes[index] ? 1 + breathing : 1);
			}
		}
		_relaxLinks() {
			const chunks = this.chunks;
			const targets = this.linkTargets;
			const correctionHalf = this.tables.linkCorrectionHalf;
			const count = targets.length;
			let before = chunks[0];
			for (let index = 0; index < count; index++) {
				const after = chunks[index + 1];
				const x = after.x - before.x;
				const y = after.y - before.y;
				const distance = Math.sqrt(x * x + y * y) || .001;
				const shift = (distance - targets[index]) / distance * correctionHalf[index];
				before.x += x * shift;
				before.y += y * shift;
				after.x -= x * shift;
				after.y -= y * shift;
				before = after;
			}
		}
		_clampLinks() {
			const chunks = this.chunks;
			const targets = this.linkTargets;
			const count = targets.length;
			let before = chunks[0];
			for (let index = 0; index < count; index++) {
				const after = chunks[index + 1];
				const limit = targets[index] * 3;
				const x = after.x - before.x;
				const y = after.y - before.y;
				const distance = Math.sqrt(x * x + y * y);
				if (distance > limit) {
					const scale = limit / distance;
					after.x = before.x + x * scale;
					after.y = before.y + y * scale;
				}
				before = after;
			}
		}
		_applyAutoLift(dt, throttle) {
			const autoLift = this.model.physics.autoLift;
			if (!autoLift.amount) return;
			const lifted = Math.round(autoLift.share * this.chunks.length);
			selectLowest(this.liftOrder, this.chunks, lifted);
			this.liftTargets.fill(0);
			for (let index = 0; index < lifted; index++) this.liftTargets[this.liftOrder[index]] = throttle;
			const amount = Math.min(1, dt * autoLift.rate);
			for (let index = 0; index < this.chunks.length; index++) {
				const chunk = this.chunks[index];
				chunk.idle += (this.liftTargets[index] - chunk.idle) * amount;
				chunk.contact = Math.max(0, Math.min(1, chunk.gaitContact * (1 - autoLift.amount * chunk.idle * throttle)));
			}
		}
		getPose(pose) {
			const head = this.chunks[0];
			const behind = this.chunks[1];
			const dx = head.x - behind.x;
			const dy = head.y - behind.y;
			const distance = magnitude$2(dx, dy);
			if (distance < 1e-9) {
				pose.direction.x = head.dx;
				pose.direction.y = head.dy;
			} else {
				pose.direction.x = dx / distance;
				pose.direction.y = dy / distance;
			}
			let centerX = 0;
			let centerY = 0;
			for (let index = 0; index < this.chunks.length; index++) {
				const chunk = this.chunks[index];
				centerX += chunk.x / this.chunks.length;
				centerY += chunk.y / this.chunks.length;
			}
			pose.head.x = head.x;
			pose.head.y = head.y;
			pose.center.x = centerX;
			pose.center.y = centerY;
			return pose;
		}
	};

//#endregion
//#region src/legs.mjs
/** Schema-v1 planted-foot state. Private to one Beefwife instance. */
	var lerp = (start, end, amount) => start + (end - start) * amount;
	var clamp = (value, low, high) => Math.max(low, Math.min(high, value));
	var magnitude$1 = /* @__PURE__ */ __name((x, y) => Math.sqrt(x * x + y * y), "magnitude");
	var limbLength = (reach, scale, fold) => {
		const amount = fold <= .5 ? lerp(.9, 1.35, fold * 2) : lerp(1.35, 1.72, (fold - .5) * 2);
		return reach * scale * amount;
	};
	var Legs = class {
		constructor(model, body, gait, random) {
			this.model = model;
			this.body = body;
			this.gait = gait;
			this.random = random;
			this.legs = [];
			this._build();
		}
		reconfigure(model, body, gait) {
			this.model = model;
			this.body = body;
			this.gait = gait;
			const anchors = this._anchors();
			this.legs.forEach((leg) => leg.anchor = anchors[leg.pair]);
		}
		_signedRandom() {
			return this.random() * 2 - 1;
		}
		_vary(amount) {
			return 1 + amount * this._signedRandom();
		}
		_anchors() {
			const { pairs, start, end } = this.model.legs;
			if (!pairs) return [];
			const firstDistance = this.model.chunks[start].restDistance;
			const lastDistance = this.model.chunks[end - 1].restDistance;
			return Array.from({ length: pairs }, (_, pair) => {
				const amount = pairs === 1 ? .5 : pair / (pairs - 1);
				const target = lerp(firstDistance, lastDistance, amount);
				let nearest = start;
				for (let index = start + 1; index < end; index++) if (Math.abs(this.model.chunks[index].restDistance - target) < Math.abs(this.model.chunks[nearest].restDistance - target)) nearest = index;
				return nearest;
			});
		}
		_build() {
			const options = this.model.legs;
			this._anchors().forEach((anchor, pair) => {
				[["left", -1], ["right", 1]].forEach(([side, sideSign]) => {
					const leg = {
						pair,
						anchor,
						side,
						sideSign,
						character: this._signedRandom(),
						reachScale: this._vary(options.jitter * .28),
						spreadScale: this._vary(options.jitter * .3),
						leadScale: this._vary(options.jitter * .45),
						dragScale: 1,
						swingScale: 1,
						liftAt: options.liftThreshold,
						scatter: {
							x: 0,
							y: 0
						},
						plantSpan: 0,
						progress: 1,
						contactLow: false,
						foot: {
							x: 0,
							y: 0
						},
						hold: {
							x: 0,
							y: 0
						},
						from: {
							x: 0,
							y: 0
						}
					};
					this._rollStep(leg);
					const planted = this._plantAt(leg);
					Object.assign(leg.foot, planted);
					Object.assign(leg.hold, planted);
					Object.assign(leg.from, planted);
					leg.plantSpan = magnitude$1(planted.x - this.body.chunks[anchor].x, planted.y - this.body.chunks[anchor].y);
					this.legs.push(leg);
				});
			});
		}
		_rollStep(leg) {
			const jitter = this.model.legs.jitter;
			leg.dragScale = this._vary(jitter * .4) * (1 + jitter * .35 * leg.character);
			leg.swingScale = this._vary(jitter * .3);
			leg.liftAt = clamp(this.model.legs.liftThreshold + jitter * .2 * leg.character, 0, 1);
			const scatterRadius = Math.max(this.model.legs.reach, this.model.legs.spread) * jitter * .1;
			leg.scatter = {
				x: scatterRadius * this._signedRandom(),
				y: scatterRadius * this._signedRandom()
			};
		}
		_plantAt(leg) {
			const options = this.model.legs;
			const hip = this.body.chunks[leg.anchor];
			const ahead = options.reach * leg.reachScale * (.5 + options.lead * .5) * leg.leadScale;
			const outward = options.spread * leg.spreadScale * leg.sideSign;
			return {
				x: hip.x + hip.dx * ahead - hip.dy * outward,
				y: hip.y + hip.dy * ahead + hip.dx * outward
			};
		}
		contactFor(leg, throttle) {
			const chunk = this.model.chunks[leg.anchor];
			const phaseOffset = leg.side === "right" ? Math.PI * this.model.legs.sidePhase : 0;
			return clamp(this.gait.contactAt(chunk.restDistance, throttle, chunk.motionScale.contact, phaseOffset) * (1 - this.model.physics.autoLift.amount * this.body.chunks[leg.anchor].idle * throttle), 0, 1);
		}
		update(dt, throttle) {
			const options = this.model.legs;
			for (let index = 0; index < this.legs.length; index++) {
				const leg = this.legs[index];
				const hip = this.body.chunks[leg.anchor];
				const low = this.contactFor(leg, throttle) < leg.liftAt;
				const released = low && !leg.contactLow;
				leg.contactLow = low;
				if (leg.progress < 1) {
					const seconds = options.swingSeconds * leg.swingScale;
					leg.progress = Math.min(1, leg.progress + dt / seconds);
					const arc = Math.sin(Math.PI * leg.progress) * options.swingArc;
					leg.foot.x = lerp(leg.from.x, leg.hold.x, leg.progress) - hip.dy * arc * leg.sideSign;
					leg.foot.y = lerp(leg.from.y, leg.hold.y, leg.progress) + hip.dx * arc * leg.sideSign;
					continue;
				}
				Object.assign(leg.foot, leg.hold);
				const footX = leg.foot.x - hip.x;
				const footY = leg.foot.y - hip.y;
				const forward = footX * hip.dx + footY * hip.dy;
				const reach = options.reach * leg.reachScale;
				const trailed = forward < -(reach * (.5 - options.lead * .5)) * leg.dragScale;
				const nominalSpan = magnitude$1(reach, options.spread * leg.spreadScale);
				const overextended = magnitude$1(footX, footY) > Math.max(nominalSpan, leg.plantSpan) * 1.55;
				if (released || trailed || overextended) {
					Object.assign(leg.from, leg.foot);
					const planted = this._plantAt(leg);
					leg.hold.x = planted.x + leg.scatter.x;
					leg.hold.y = planted.y + leg.scatter.y;
					leg.plantSpan = magnitude$1(leg.hold.x - hip.x, leg.hold.y - hip.y);
					leg.progress = 0;
					this._rollStep(leg);
					leg.contactLow = this.contactFor(leg, throttle) < leg.liftAt;
				}
			}
		}
		translate(offset) {
			this.legs.forEach((leg) => {
				[
					leg.foot,
					leg.hold,
					leg.from
				].forEach((point) => {
					point.x += offset.x;
					point.y += offset.y;
				});
			});
		}
		armLength(leg) {
			return limbLength(this.model.legs.reach, leg.reachScale, this.model.legs.fold);
		}
	};

//#endregion
//#region src/skin.mjs
/** Schema-v1 ornament motion and renderer snapshots. */
	var RENDER_LAYOUT = Object.freeze({
		chunkStride: 4,
		legStride: 11,
		ornamentStride: 6,
		plateStride: 5
	});
	var RADIAN_TURN_RATE = 13;
	var MAX_DEFLECTION = Math.PI / 2;
	var magnitude = (x, y) => Math.sqrt(x * x + y * y);
	var springCoefficients = (ornament, rate, zeta, dt) => {
		const angularDt = rate * dt;
		if (angularDt < 1e-9) {
			ornament.positionPosition = 1;
			ornament.positionVelocity = dt;
			ornament.velocityPosition = 0;
			ornament.velocityVelocity = 1;
			return;
		}
		const decay = Math.exp(-zeta * angularDt);
		if (zeta >= 1 - 1e-8) {
			ornament.positionPosition = decay * (1 + angularDt);
			ornament.positionVelocity = decay * dt;
			ornament.velocityPosition = -decay * rate * angularDt;
			ornament.velocityVelocity = decay * (1 - angularDt);
			return;
		}
		const ringRate = rate * Math.sqrt(1 - zeta * zeta);
		const cosine = Math.cos(ringRate * dt);
		const sine = Math.sin(ringRate * dt);
		const lean = zeta * rate / ringRate;
		ornament.positionPosition = decay * (cosine + lean * sine);
		ornament.positionVelocity = decay * sine / ringRate;
		ornament.velocityPosition = -decay * rate * rate * sine / ringRate;
		ornament.velocityVelocity = decay * (cosine - lean * sine);
	};
	var rootFor = (ornament, body, root) => {
		const chunk = body.chunks[ornament.chunk];
		root.x = chunk.x + chunk.dx * ornament.offset.forward - chunk.dy * ornament.offset.outward * ornament.sideSign;
		root.y = chunk.y + chunk.dy * ornament.offset.forward + chunk.dx * ornament.offset.outward * ornament.sideSign;
		root.dx = chunk.dx * ornament.angleCosine - chunk.dy * ornament.angleSine;
		root.dy = chunk.dy * ornament.angleCosine + chunk.dx * ornament.angleSine;
		return root;
	};
	var jointFor = (hip, foot, arm, bow, joint) => {
		const x = foot.x - hip.x;
		const y = foot.y - hip.y;
		const distance = magnitude(x, y);
		const normalX = distance > .001 ? -y / distance : -hip.dy;
		const normalY = distance > .001 ? x / distance : hip.dx;
		const halfBone = arm / 2;
		const halfSpan = Math.min(distance, arm) / 2;
		const bend = Math.sqrt(Math.max(0, halfBone ** 2 - halfSpan ** 2));
		joint.x = hip.x + x / 2 + normalX * bend * bow;
		joint.y = hip.y + y / 2 + normalY * bend * bow;
		return joint;
	};
	var Skin = class {
		constructor(model, body, legs) {
			this.model = model;
			this.body = body;
			this.legs = legs;
			this.joint = {
				x: 0,
				y: 0
			};
			this.ornaments = [];
			this._buildOrnaments();
		}
		reconfigure(model, body, legs) {
			this.model = model;
			this.body = body;
			this.legs = legs;
			this.ornaments.forEach((ornament, index) => {
				ornament.spec = model.skin.ornaments[index];
				ornament.coefficientDt = null;
			});
		}
		_buildOrnaments() {
			this.ornaments = this.model.skin.ornaments.map((spec) => {
				const root = rootFor(spec, this.body, {});
				return {
					spec,
					root,
					nextRoot: { ...root },
					angle: 0,
					velocity: 0,
					directionX: root.dx,
					directionY: root.dy,
					coefficientDt: null,
					positionPosition: 1,
					positionVelocity: 0,
					velocityPosition: 0,
					velocityVelocity: 1
				};
			});
		}
		_fitRenderState(state) {
			if (!state) state = { layout: RENDER_LAYOUT };
			state.model = this.model;
			const lengths = {
				chunks: this.body.chunks.length * RENDER_LAYOUT.chunkStride,
				legs: this.legs.legs.length * RENDER_LAYOUT.legStride,
				ornaments: this.ornaments.length * RENDER_LAYOUT.ornamentStride,
				plates: this.model.skin.platesTailFirst.length * RENDER_LAYOUT.plateStride
			};
			for (const [band, length] of Object.entries(lengths)) if (!state[band] || state[band].length !== length) state[band] = new Float64Array(length);
			return state;
		}
		writeRenderState(state) {
			state = this._fitRenderState(state);
			const chunkStride = RENDER_LAYOUT.chunkStride;
			for (let index = 0; index < this.body.chunks.length; index++) {
				const chunk = this.body.chunks[index];
				const offset = index * chunkStride;
				state.chunks[offset] = chunk.x;
				state.chunks[offset + 1] = chunk.y;
				state.chunks[offset + 2] = chunk.dx;
				state.chunks[offset + 3] = chunk.dy;
			}
			const foot = this.model.legs.skin.foot;
			const legStride = RENDER_LAYOUT.legStride;
			const sectionStart = this.legs.legs.length ? this.model.chunks[this.model.legs.start].restDistance : 0;
			const sectionSpan = this.legs.legs.length ? this.model.chunks[this.model.legs.end - 1].restDistance - sectionStart : 0;
			const { jointBend, jointLeanCenter } = this.model.legs;
			for (let index = 0; index < this.legs.legs.length; index++) {
				const leg = this.legs.legs[index];
				const hip = this.body.chunks[leg.anchor];
				const arm = this.legs.armLength(leg);
				const joint = jointFor(hip, leg.foot, arm, leg.sideSign * jointBend, this.joint);
				const chainPosition = sectionSpan ? 2 * (this.model.chunks[leg.anchor].restDistance - sectionStart) / sectionSpan - 1 : 0;
				const offset = index * legStride;
				state.legs[offset] = hip.x;
				state.legs[offset + 1] = hip.y;
				state.legs[offset + 2] = joint.x;
				state.legs[offset + 3] = joint.y;
				state.legs[offset + 4] = leg.foot.x;
				state.legs[offset + 5] = leg.foot.y;
				state.legs[offset + 6] = hip.dx;
				state.legs[offset + 7] = hip.dy;
				state.legs[offset + 8] = foot.scale * (leg.progress < 1 ? 1 : foot.plantedScale);
				state.legs[offset + 9] = leg.sideSign;
				state.legs[offset + 10] = (chainPosition - jointLeanCenter) * arm;
			}
			const ornamentStride = RENDER_LAYOUT.ornamentStride;
			for (let index = 0; index < this.ornaments.length; index++) {
				const ornament = this.ornaments[index];
				const offset = index * ornamentStride;
				state.ornaments[offset] = ornament.root.x;
				state.ornaments[offset + 1] = ornament.root.y;
				state.ornaments[offset + 2] = ornament.directionX;
				state.ornaments[offset + 3] = ornament.directionY;
				state.ornaments[offset + 4] = ornament.spec.scale;
				state.ornaments[offset + 5] = ornament.spec.sideSign;
			}
			const plates = this.model.skin.platesTailFirst;
			const plateStride = RENDER_LAYOUT.plateStride;
			for (let index = 0; index < plates.length; index++) {
				const plate = plates[index];
				const chunk = this.body.chunks[plate.chunk];
				const offset = index * plateStride;
				state.plates[offset] = chunk.x;
				state.plates[offset + 1] = chunk.y;
				state.plates[offset + 2] = chunk.dx;
				state.plates[offset + 3] = chunk.dy;
				state.plates[offset + 4] = plate.scale * this.model.chunks[plate.chunk].plateScale * (1 + this.model.skin.loadScale * this.body.chunks[plate.chunk].contact);
			}
			return state;
		}
		update(dt) {
			for (let index = 0; index < this.ornaments.length; index++) {
				const ornament = this.ornaments[index];
				const { spec } = ornament;
				const previousRoot = ornament.root;
				const root = rootFor(spec, this.body, ornament.nextRoot);
				if (ornament.coefficientDt !== dt) {
					ornament.coefficientDt = dt;
					springCoefficients(ornament, spec.recover, 1 - spec.wobble * .98, dt);
				}
				const turnRate = Math.atan2(previousRoot.dx * root.dy - previousRoot.dy * root.dx, previousRoot.dx * root.dx + previousRoot.dy * root.dy) / dt;
				const lateralRate = ((root.x - previousRoot.x) * -root.dy + (root.y - previousRoot.y) * root.dx) / dt;
				const target = Math.min(MAX_DEFLECTION, Math.max(-MAX_DEFLECTION, spec.waveGain * -turnRate / RADIAN_TURN_RATE + spec.physGain * -lateralRate / this.model.skin.lateralRate));
				const deviation = ornament.angle - target;
				let angle = target + deviation * ornament.positionPosition + ornament.velocity * ornament.positionVelocity;
				let velocity = deviation * ornament.velocityPosition + ornament.velocity * ornament.velocityVelocity;
				if (angle > MAX_DEFLECTION) {
					angle = MAX_DEFLECTION;
					velocity = 0;
				} else if (angle < -MAX_DEFLECTION) {
					angle = -MAX_DEFLECTION;
					velocity = 0;
				}
				ornament.angle = angle;
				ornament.velocity = velocity;
				const cosine = Math.cos(angle);
				const sine = Math.sin(angle);
				ornament.directionX = root.dx * cosine - root.dy * sine;
				ornament.directionY = root.dy * cosine + root.dx * sine;
				ornament.root = root;
				ornament.nextRoot = previousRoot;
			}
		}
		translate(offset) {
			this.ornaments.forEach((ornament) => {
				ornament.root.x += offset.x;
				ornament.root.y += offset.y;
			});
		}
	};

//#endregion
//#region src/geometry.mjs
/** Vertex math and pixel snapping for a Beefwife's meshes and outlines. */
	var KNEE_SEGMENTS = 4;
	var KNEE_POINTS = 5;
	var LIMB_VERTICES = 14;
	var LIMB_FLOATS = 28;
	var limbIndicesFor = (legCount) => {
		const quads = 6;
		const indices = new Uint32Array(legCount * quads * 6);
		let at = 0;
		for (let leg = 0; leg < legCount; leg++) {
			const first = leg * LIMB_VERTICES;
			const last = first + LIMB_VERTICES - 1;
			for (let step = 0; step < quads; step++) {
				const down = first + step;
				const back = last - step;
				indices.set([
					down,
					back,
					down + 1,
					down + 1,
					back,
					back - 1
				], at);
				at += 6;
			}
		}
		return indices;
	};
	var CAP_SEGMENTS = 12;
	var CAP_VERTICES = 14;
	var CAP_COSINE = /* @__PURE__ */ new Float64Array(13);
	var CAP_SINE = /* @__PURE__ */ new Float64Array(13);
	for (let step = 0; step <= 12; step++) {
		const angle = Math.PI * step / 12;
		CAP_COSINE[step] = Math.cos(angle);
		CAP_SINE[step] = Math.sin(angle);
	}
	var ribbonPositionsFor = (chunkCount) => new Float32Array((chunkCount * 2 + 28) * 2);
	var ribbonIndicesFor = (chunkCount) => {
		const quads = Math.max(0, chunkCount - 1);
		const indices = new Uint32Array(quads * 6 + 72);
		let at = 0;
		for (let chunk = 0; chunk < quads; chunk++) {
			const vertex = chunk * 2;
			indices.set([
				vertex,
				vertex + 1,
				vertex + 2,
				vertex + 2,
				vertex + 1,
				vertex + 3
			], at);
			at += 6;
		}
		for (const hub of [chunkCount * 2, chunkCount * 2 + 14]) for (let step = 0; step < 12; step++) {
			indices.set([
				hub,
				hub + 1 + step,
				hub + 2 + step
			], at);
			at += 3;
		}
		return indices;
	};
	var snapCoordinate = (value, pixelResolution, inversePixelResolution) => pixelResolution === 1 ? Math.round(value) : pixelResolution > 0 ? Math.round(value * pixelResolution) * inversePixelResolution : value;
	var snapPositions = (positions, start, end, pixelResolution, inversePixelResolution) => {
		if (pixelResolution === 1) for (let index = start; index < end; index++) positions[index] = Math.round(positions[index]);
		else if (pixelResolution > 0) for (let index = start; index < end; index++) positions[index] = Math.round(positions[index] * pixelResolution) * inversePixelResolution;
	};
	var writeCap = (positions, offset, x, y, radius, fromX, fromY, overX, overY, pixelResolution, inversePixelResolution) => {
		positions[offset] = x;
		positions[offset + 1] = y;
		for (let step = 0; step <= 12; step++) {
			const at = offset + 2 + step * 2;
			const cosine = CAP_COSINE[step];
			const sine = CAP_SINE[step];
			positions[at] = x + radius * (cosine * fromX + sine * overX);
			positions[at + 1] = y + radius * (cosine * fromY + sine * overY);
		}
		snapPositions(positions, offset, offset + 28, pixelResolution, inversePixelResolution);
	};
	var writeLimb = (positions, offset, hipX, hipY, kneeX, kneeY, footX, footY, width, pixelResolution = 0, inversePixelResolution = 0) => {
		const half = width * .5;
		const thighX = kneeX - hipX;
		const thighY = kneeY - hipY;
		const thighLength = Math.hypot(thighX, thighY) || 1;
		const shinX = footX - kneeX;
		const shinY = footY - kneeY;
		const shinLength = Math.hypot(shinX, shinY) || 1;
		const thighNormalX = -thighY / thighLength;
		const thighNormalY = thighX / thighLength;
		const shinNormalX = -shinY / shinLength;
		const shinNormalY = shinX / shinLength;
		const spread = 1 + thighNormalX * shinNormalX + thighNormalY * shinNormalY;
		let cornerX = thighNormalX;
		let cornerY = thighNormalY;
		if (spread > 1e-6) {
			cornerX = (thighNormalX + shinNormalX) / spread;
			cornerY = (thighNormalY + shinNormalY) / spread;
			const along = Math.abs((cornerX * thighX + cornerY * thighY) / thighLength * half);
			const bone = Math.min(thighLength, shinLength);
			if (along > bone) {
				cornerX = cornerX * bone / along;
				cornerY = cornerY * bone / along;
			}
		}
		const sweep = Math.atan2(thighNormalX * shinNormalY - thighNormalY * shinNormalX, thighNormalX * shinNormalX + thighNormalY * shinNormalY);
		const stepCosine = Math.cos(sweep / KNEE_SEGMENTS);
		const stepSine = Math.sin(sweep / KNEE_SEGMENTS);
		const arcLeads = sweep <= 0;
		let arcX = thighNormalX;
		let arcY = thighNormalY;
		const footAt = offset + 12;
		const heelAt = offset + 28 - 2;
		positions[offset] = hipX + thighNormalX * half;
		positions[offset + 1] = hipY + thighNormalY * half;
		positions[footAt] = footX + shinNormalX * half;
		positions[footAt + 1] = footY + shinNormalY * half;
		positions[footAt + 2] = footX - shinNormalX * half;
		positions[footAt + 3] = footY - shinNormalY * half;
		positions[heelAt] = hipX - thighNormalX * half;
		positions[heelAt + 1] = hipY - thighNormalY * half;
		for (let step = 0; step < 5; step++) {
			const leadX = arcLeads ? arcX : cornerX;
			const leadY = arcLeads ? arcY : cornerY;
			const trailX = arcLeads ? cornerX : arcX;
			const trailY = arcLeads ? cornerY : arcY;
			const leadAt = offset + (1 + step) * 2;
			const trailAt = offset + (12 - step) * 2;
			positions[leadAt] = kneeX + leadX * half;
			positions[leadAt + 1] = kneeY + leadY * half;
			positions[trailAt] = kneeX - trailX * half;
			positions[trailAt + 1] = kneeY - trailY * half;
			const turnedX = arcX * stepCosine - arcY * stepSine;
			arcY = arcX * stepSine + arcY * stepCosine;
			arcX = turnedX;
		}
		snapPositions(positions, offset, offset + 28, pixelResolution, inversePixelResolution);
	};

//#endregion
//#region src/display.mjs
/** Pixi resource lifetime and construction for the parts a Beefwife draws. */
	var discard = (parent, child) => {
		if (child.parent === parent) parent.removeChild(child);
		const geometry = child.geometry ?? null;
		child.destroy();
		if (geometry) geometry.destroy();
	};
	var contextFor = (shape, paint, scale) => {
		const path = new PIXI.GraphicsPath(shape.path).transform(new PIXI.Matrix(scale, 0, 0, scale, 0, 0));
		const context = new PIXI.GraphicsContext().path(path);
		if (paint.fill !== null) context.fill(paint.fill);
		if (paint.stroke !== null && paint.strokeWidth > 0) context.stroke({
			color: paint.stroke,
			width: paint.strokeWidth * scale,
			cap: "butt",
			join: "miter"
		});
		return context;
	};
	var meshFor = (positions, indices, color) => {
		const geometry = new PIXI.MeshGeometry({
			positions,
			uvs: new Float32Array(positions.length),
			indices,
			shrinkBuffersToFit: false
		});
		const mesh = new PIXI.Mesh({
			geometry,
			texture: PIXI.Texture.WHITE,
			roundPixels: false
		});
		mesh.tint = color;
		mesh.dynamicPositions = positions;
		mesh.positionBuffer = geometry.getBuffer("aPosition");
		return mesh;
	};

//#endregion
//#region src/atlas.mjs
/**
	* One texture holding every shape a Beefwife places, so its feet, plates and
	* ornaments draw as particles out of a shared frame instead of a Graphics
	* apiece. Planning is separable from baking: the plan names the frames, sizes
	* them and packs them without a renderer, and only the bake needs a GPU.
	*/
	var BAKE_SUPERSAMPLE = 4;
	var PAD_STROKES = 1;
	var MIN_PAD_TEXELS = 1;
	var ATLAS_TEXEL_LIMIT = 2048;
	var frameKeyFor = (shape, paint, scale) => `${shape.path}|${paint.fill}|${paint.stroke}|${paint.strokeWidth}|${scale}`;
	var baked = /* @__PURE__ */ new Map();
	var planAtlas = (model, renderResolution) => {
		const resolution = renderResolution * 4;
		const entries = /* @__PURE__ */ new Map();
		const claim = (shape, paint, scale) => {
			if (!(scale > 0)) return null;
			const key = frameKeyFor(shape, paint, scale);
			if (entries.has(key)) return key;
			const context = contextFor(shape, paint, scale);
			const bounds = context.bounds;
			const pad = Math.max(MIN_PAD_TEXELS, Math.ceil(paint.strokeWidth * scale * PAD_STROKES * resolution));
			entries.set(key, {
				key,
				shape,
				paint,
				scale,
				context,
				pad,
				originX: pad + Math.ceil(-bounds.minX * resolution),
				originY: pad + Math.ceil(-bounds.minY * resolution),
				width: Math.ceil(bounds.width * resolution) + pad * 2,
				height: Math.ceil(bounds.height * resolution) + pad * 2
			});
			return key;
		};
		const foot = model.legs.skin.foot;
		const feet = model.legs.pairs ? claim(foot.shape, foot.paint, foot.scale * Math.max(1, foot.plantedScale)) : null;
		const load = 1 + Math.max(0, model.skin.loadScale);
		const plates = model.skin.platesTailFirst.map((plate) => claim(plate.shape, plate.paint, plate.scale * model.chunks[plate.chunk].plateScale * load));
		const ornaments = model.skin.ornaments.map((ornament) => claim(ornament.shape, ornament.paint, ornament.scale));
		const packed = [...entries.values()].sort((a, b) => b.height - a.height);
		let shelfX = 0;
		let shelfY = 0;
		let shelfHeight = 0;
		let width = 0;
		for (const entry of packed) {
			if (shelfX > 0 && shelfX + entry.width > ATLAS_TEXEL_LIMIT) {
				shelfX = 0;
				shelfY += shelfHeight;
				shelfHeight = 0;
			}
			entry.x = shelfX;
			entry.y = shelfY;
			shelfX += entry.width;
			shelfHeight = Math.max(shelfHeight, entry.height);
			width = Math.max(width, shelfX);
		}
		return {
			key: `${resolution}\n${packed.map((entry) => entry.key).join("\n")}`,
			resolution,
			width,
			height: shelfY + shelfHeight,
			entries: packed,
			feet,
			plates,
			ornaments
		};
	};
	var bakeAtlas = (plan, renderer) => {
		const texel = 1 / plan.resolution;
		const target = PIXI.RenderTexture.create({
			width: plan.width * texel,
			height: plan.height * texel,
			resolution: plan.resolution,
			antialias: false,
			scaleMode: "nearest"
		});
		const frames = /* @__PURE__ */ new Map();
		let clear = true;
		for (const entry of plan.entries) {
			const graphics = new PIXI.Graphics(entry.context);
			renderer.render({
				container: graphics,
				target,
				clear,
				transform: new PIXI.Matrix(1, 0, 0, 1, (entry.x + entry.originX) * texel, (entry.y + entry.originY) * texel)
			});
			clear = false;
			graphics.destroy();
			frames.set(entry.key, {
				texture: new PIXI.Texture({
					source: target.source,
					frame: new PIXI.Rectangle(entry.x * texel, entry.y * texel, entry.width * texel, entry.height * texel)
				}),
				scale: entry.scale,
				anchorX: entry.originX / entry.width,
				anchorY: entry.originY / entry.height
			});
		}
		return {
			key: plan.key,
			target,
			frames
		};
	};
	/**
	* Hands back the atlas a plan names, baking it the first time anyone asks.
	* Populations share one descriptor's frames, and a live edit that abandons a
	* set of frames takes the texture with it.
	*/
	var acquireAtlas = (plan, renderer) => {
		let held = baked.get(plan.key);
		if (!held && plan.entries.length) {
			held = {
				atlas: bakeAtlas(plan, renderer),
				uses: 0
			};
			baked.set(plan.key, held);
		}
		for (const entry of plan.entries) entry.context.destroy();
		if (!held) return null;
		held.uses++;
		return held.atlas;
	};
	var releaseAtlas = (atlas) => {
		const held = atlas && baked.get(atlas.key);
		if (!held || --held.uses > 0) return;
		baked.delete(atlas.key);
		for (const frame of atlas.frames.values()) frame.texture.destroy();
		atlas.target.destroy(true);
	};

//#endregion
//#region src/graphics.mjs
/** Pixi display ownership for one Beefwife. */
	var BAND_LABELS = [
		"feet",
		"ornaments-under",
		"plates",
		"ornaments-over"
	];
	var PARTICLE_PROPERTIES = {
		position: true,
		vertex: true,
		rotation: true,
		uvs: false,
		color: false
	};
	var HeadlessGraphics = class {
		static available = false;
		static prepare() {}
	};
	var MAX_KNEE_OFFSET = 2e9;
	var Graphics = class {
		static available = true;
		static prepare(model) {
			for (const [id, shape] of Object.entries(model.descriptor.definitions.shapes)) try {
				new PIXI.GraphicsPath(shape.path);
			} catch (error) {
				throw new Error(`$.definitions.shapes.${id}.path: ${error.message}`);
			}
			for (const [id, paint] of Object.entries(model.paints)) for (const key of ["fill", "stroke"]) {
				if (paint[key] === null) continue;
				try {
					new PIXI.Color(paint[key]);
				} catch (error) {
					throw new Error(`$.definitions.paints.${id}.${key === "stroke" ? "stroke.colour" : key}: ${error.message}`);
				}
			}
		}
		constructor(host, state, options = null) {
			this.parent = host.addChild(new PIXI.Container());
			this.model = state.model;
			this.options = options || {};
			this.footParticles = [];
			this.ornamentParticles = [];
			this.plateParticles = [];
			this.shapeContainers = [];
			this.atlas = null;
			this.atlasResolution = 0;
			this.plan = null;
			this.legCount = 0;
			this.limbPositions = null;
			this.limbFill = null;
			this.limbStroke = null;
			this.limbCount = -1;
			this.ribbonPositions = null;
			this.ribbonFill = null;
			this.ribbonStroke = null;
			this.ribbonCount = -1;
			this.adopt(state);
		}
		adopt(state) {
			this.model = state.model;
			this.legCount = state.legs.length / state.layout.legStride;
			this.plan = null;
			let changed = this._syncLimbParts(this.legCount);
			changed = this._syncRibbonParts() || changed;
			if (changed) this._arrange();
			this.sync(state);
		}
		_drop(child) {
			discard(this.parent, child);
		}
		_syncLimbParts(legCount) {
			const paint = this.model.legs.skin.limbPaint;
			const wantFill = paint.fill !== null;
			const wantStroke = paint.stroke !== null && paint.strokeWidth > 0;
			const resized = legCount !== this.limbCount;
			let changed = false;
			if (resized) {
				this.limbCount = legCount;
				this.limbPositions = new Float32Array(legCount * 28);
			}
			if (this.limbFill && (resized || !wantFill)) {
				this._drop(this.limbFill);
				this.limbFill = null;
				changed = true;
			}
			if (wantFill && !this.limbFill) {
				this.limbFill = meshFor(this.limbPositions, limbIndicesFor(legCount), paint.fill);
				changed = true;
			} else if (this.limbFill) this.limbFill.tint = paint.fill;
			if (this.limbStroke && !wantStroke) {
				this._drop(this.limbStroke);
				this.limbStroke = null;
				changed = true;
			} else if (wantStroke && !this.limbStroke) {
				this.limbStroke = new PIXI.Graphics();
				changed = true;
			}
			return changed;
		}
		_syncRibbonParts() {
			const paint = this.model.skin.ribbonPaint;
			const chunkCount = this.model.chunks.length;
			const wantFill = paint.fill !== null;
			const wantStroke = paint.stroke !== null && paint.strokeWidth > 0;
			const resized = chunkCount !== this.ribbonCount;
			let changed = false;
			if (resized) {
				this.ribbonCount = chunkCount;
				this.ribbonPositions = ribbonPositionsFor(chunkCount);
			}
			if (this.ribbonFill && (resized || !wantFill)) {
				this._drop(this.ribbonFill);
				this.ribbonFill = null;
				changed = true;
			}
			if (wantFill && !this.ribbonFill) {
				this.ribbonFill = meshFor(this.ribbonPositions, ribbonIndicesFor(chunkCount), paint.fill);
				changed = true;
			} else if (this.ribbonFill) this.ribbonFill.tint = paint.fill;
			if (this.ribbonStroke && !wantStroke) {
				this._drop(this.ribbonStroke);
				this.ribbonStroke = null;
				changed = true;
			} else if (wantStroke && !this.ribbonStroke) {
				this.ribbonStroke = new PIXI.Graphics();
				changed = true;
			}
			return changed;
		}
		_arrange() {
			const [feet, under, plates, over] = this.shapeContainers;
			for (const child of [
				feet,
				this.limbFill,
				this.limbStroke,
				under,
				this.ribbonFill,
				this.ribbonStroke,
				plates,
				over
			]) if (child) this.parent.addChild(child);
		}
		_buildParticles(plan) {
			for (const container of this.shapeContainers) if (container) discard(this.parent, container);
			const bands = [
				null,
				null,
				null,
				null
			];
			const bandFor = (index) => {
				if (!bands[index]) bands[index] = new PIXI.ParticleContainer({
					label: BAND_LABELS[index],
					dynamicProperties: PARTICLE_PROPERTIES
				});
				return bands[index];
			};
			const place = (index, key) => {
				const frame = key === null ? null : this.atlas.frames.get(key);
				if (!frame) return null;
				const particle = new PIXI.Particle({
					texture: frame.texture,
					anchorX: frame.anchorX,
					anchorY: frame.anchorY
				});
				particle.bakeScale = frame.scale;
				bandFor(index).addParticle(particle);
				return particle;
			};
			this.footParticles = Array.from({ length: this.legCount }, () => place(0, plan.feet));
			this.ornamentParticles = plan.ornaments.map((key, index) => place(this.model.skin.ornaments[index].layer === "under" ? 1 : 3, key));
			this.plateParticles = plan.plates.map((key) => place(2, key));
			this.shapeContainers = bands;
			this._arrange();
		}
		_syncAtlas(renderer) {
			const resolution = this.options.pixelResolution ?? 1;
			if (this.plan && this.atlasResolution === resolution) return;
			if (!renderer) return;
			const plan = planAtlas(this.model, resolution);
			const atlas = acquireAtlas(plan, renderer);
			releaseAtlas(this.atlas);
			this.atlas = atlas;
			this.atlasResolution = resolution;
			this.plan = plan;
			this._buildParticles(plan);
		}
		_place(particle, x, y, directionX, directionY, scale, mirror, pixelResolution, inversePixelResolution) {
			if (!particle) return;
			particle.x = snapCoordinate(x, pixelResolution, inversePixelResolution);
			particle.y = snapCoordinate(y, pixelResolution, inversePixelResolution);
			particle.rotation = Math.atan2(directionY, directionX);
			const drawn = scale / particle.bakeScale;
			particle.scaleX = drawn;
			particle.scaleY = drawn * mirror;
		}
		_syncLimbs(state, pixelResolution, inversePixelResolution) {
			const legs = state.legs;
			const width = this.model.legs.skin.limbWidth;
			const positions = this.limbPositions;
			if (this.limbStroke) this.limbStroke.clear();
			if (width <= 0) {
				positions.fill(0);
				if (this.limbFill) this.limbFill.positionBuffer.update();
				return;
			}
			const stride = state.layout.legStride;
			const projection = this.options.kneeProjection ?? null;
			const jointLean = this.model.legs.jointLean;
			for (let offset = 0; offset < legs.length; offset += stride) {
				const vertexOffset = offset / stride * 28;
				let kneeX = legs[offset + 2];
				let kneeY = legs[offset + 3];
				if (projection) {
					if (Number.isFinite(projection.perspective) && projection.perspective >= 0 && Number.isFinite(projection.centerX) && Number.isFinite(projection.centerY)) {
						const viewDistance = Math.hypot(kneeX - projection.centerX, kneeY - projection.centerY);
						if (viewDistance > 0 && projection.perspective > 0) {
							const elbowHeight = Math.hypot(kneeX - (legs[offset] + legs[offset + 4]) / 2, kneeY - (legs[offset + 1] + legs[offset + 5]) / 2);
							const maxOffset = Number.isFinite(projection.maxOffset) ? Math.max(0, projection.maxOffset) : MAX_KNEE_OFFSET;
							const radialOffset = Math.min(maxOffset, viewDistance * elbowHeight * projection.perspective);
							kneeX += (kneeX - projection.centerX) / viewDistance * radialOffset;
							kneeY += (kneeY - projection.centerY) / viewDistance * radialOffset;
						}
					}
				}
				if (jointLean !== 0) {
					const leanOffset = legs[offset + 10] * jointLean;
					kneeX += legs[offset + 6] * leanOffset;
					kneeY += legs[offset + 7] * leanOffset;
				}
				writeLimb(positions, vertexOffset, legs[offset], legs[offset + 1], kneeX, kneeY, legs[offset + 4], legs[offset + 5], width, pixelResolution, inversePixelResolution);
			}
			if (this.limbFill) this.limbFill.positionBuffer.update();
			if (!this.limbStroke) return;
			for (let base = 0; base < positions.length; base += 28) {
				let lastX = positions[base];
				let lastY = positions[base + 1];
				this.limbStroke.moveTo(lastX, lastY);
				for (let vertex = 2; vertex < 28; vertex += 2) {
					const x = positions[base + vertex];
					const y = positions[base + vertex + 1];
					if (x === lastX && y === lastY) continue;
					this.limbStroke.lineTo(x, y);
					lastX = x;
					lastY = y;
				}
				this.limbStroke.closePath();
			}
			const legPaint = this.model.legs.skin.limbPaint;
			this.limbStroke.stroke({
				color: legPaint.stroke,
				width: legPaint.strokeWidth,
				cap: "butt",
				join: "bevel"
			});
		}
		_syncRibbon(state, pixelResolution, inversePixelResolution) {
			const chunks = state.chunks;
			const stride = state.layout.chunkStride;
			const count = this.model.chunks.length;
			const lastIndex = count - 1;
			const positions = this.ribbonPositions;
			for (let index = 0; index < count; index++) {
				const chunkOffset = index * stride;
				const vertexOffset = index * 4;
				const width = this.model.chunks[index].ribbonWidth;
				positions[vertexOffset] = chunks[chunkOffset] - chunks[chunkOffset + 3] * width;
				positions[vertexOffset + 1] = chunks[chunkOffset + 1] + chunks[chunkOffset + 2] * width;
				positions[vertexOffset + 2] = chunks[chunkOffset] + chunks[chunkOffset + 3] * width;
				positions[vertexOffset + 3] = chunks[chunkOffset + 1] - chunks[chunkOffset + 2] * width;
				snapPositions(positions, vertexOffset, vertexOffset + 4, pixelResolution, inversePixelResolution);
			}
			const tailOffset = lastIndex * stride;
			const tailX = chunks[tailOffset + 2];
			const tailY = chunks[tailOffset + 3];
			writeCap(positions, count * 4, chunks[tailOffset], chunks[tailOffset + 1], this.model.chunks[lastIndex].ribbonWidth, -tailY, tailX, -tailX, -tailY, pixelResolution, inversePixelResolution);
			const headX = chunks[2];
			const headY = chunks[3];
			writeCap(positions, count * 4 + 14 * 2, chunks[0], chunks[1], this.model.chunks[0].ribbonWidth, headY, -headX, headX, headY, pixelResolution, inversePixelResolution);
			if (this.ribbonFill) this.ribbonFill.positionBuffer.update();
			if (!this.ribbonStroke) return;
			this.ribbonStroke.clear();
			if (!this.model.skin.hasRibbon) return;
			const tailRim = count * 4 + 2;
			const headRim = count * 4 + 14 * 2 + 2;
			this.ribbonStroke.moveTo(positions[0], positions[1]);
			for (let index = 1; index < count; index++) this.ribbonStroke.lineTo(positions[index * 4], positions[index * 4 + 1]);
			for (let step = 1; step < 12; step++) this.ribbonStroke.lineTo(positions[tailRim + step * 2], positions[tailRim + step * 2 + 1]);
			for (let index = lastIndex; index >= 0; index--) this.ribbonStroke.lineTo(positions[index * 4 + 2], positions[index * 4 + 3]);
			for (let step = 1; step < 12; step++) this.ribbonStroke.lineTo(positions[headRim + step * 2], positions[headRim + step * 2 + 1]);
			this.ribbonStroke.closePath();
			const paint = this.model.skin.ribbonPaint;
			this.ribbonStroke.stroke({
				color: paint.stroke,
				width: paint.strokeWidth
			});
		}
		sync(state, renderer = null) {
			if (state.model !== this.model) throw new Error("render state model does not match Beefwife graphics");
			const pixelResolution = this.options.roundVertices === true ? this.options.pixelResolution ?? 1 : 0;
			const inversePixelResolution = pixelResolution > 0 ? 1 / pixelResolution : 0;
			this._syncLimbs(state, pixelResolution, inversePixelResolution);
			this._syncRibbon(state, pixelResolution, inversePixelResolution);
			this._syncAtlas(renderer);
			const legs = state.legs;
			for (let index = 0; index < this.footParticles.length; index++) {
				const offset = index * state.layout.legStride;
				this._place(this.footParticles[index], legs[offset + 4], legs[offset + 5], legs[offset + 6], legs[offset + 7], legs[offset + 8], legs[offset + 9], pixelResolution, inversePixelResolution);
			}
			const ornaments = state.ornaments;
			for (let index = 0; index < this.ornamentParticles.length; index++) {
				const offset = index * state.layout.ornamentStride;
				this._place(this.ornamentParticles[index], ornaments[offset], ornaments[offset + 1], ornaments[offset + 2], ornaments[offset + 3], ornaments[offset + 4], ornaments[offset + 5], pixelResolution, inversePixelResolution);
			}
			const plates = state.plates;
			for (let index = 0; index < this.plateParticles.length; index++) {
				const offset = index * state.layout.plateStride;
				this._place(this.plateParticles[index], plates[offset], plates[offset + 1], plates[offset + 2], plates[offset + 3], plates[offset + 4], 1, pixelResolution, inversePixelResolution);
			}
		}
		destroy() {
			const children = [
				...this.shapeContainers,
				this.limbFill,
				this.limbStroke,
				this.ribbonFill,
				this.ribbonStroke
			];
			for (const child of children) if (child) discard(this.parent, child);
			releaseAtlas(this.atlas);
			this.atlas = null;
			this.parent.destroy();
		}
	};
	var graphics_default = available ? Graphics : HeadlessGraphics;

//#endregion
//#region src/beefwife.mjs
/** Public lifecycle for one schema-v1 beefwife. */
	var HeadlessContainer = class {
		destroy() {
			this.destroyed = true;
		}
	};
	var Container = available ? PIXI.Container : HeadlessContainer;
	var MAX_STEP_SECONDS = .05;
	var MAX_WORLD_COORDINATE = 1e9;
	var MIN_PIXEL_RESOLUTION = 1e-6;
	var MAX_PIXEL_RESOLUTION = 1e6;
	var MAX_PERSPECTIVE = 1e6;
	var TAU = Math.PI * 2;
	var OPTION_KEYS = /* @__PURE__ */ new Set([
		"position",
		"direction",
		"phase",
		"random",
		"render"
	]);
	var RENDER_KEYS = /* @__PURE__ */ new Set([
		"roundVertices",
		"pixelResolution",
		"kneeProjection"
	]);
	var KNEE_PROJECTION_KEYS = /* @__PURE__ */ new Set([
		"centerX",
		"centerY",
		"perspective",
		"maxOffset"
	]);
	var RESET_KEYS = /* @__PURE__ */ new Set([
		"position",
		"direction",
		"phase"
	]);
	var CONTROL_KEYS = /* @__PURE__ */ new Set(["throttle", "direction"]);
	var plainObject = (value, path) => {
		if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${path} must be an object`);
		const prototype = Object.getPrototypeOf(value);
		if (prototype !== Object.prototype && prototype !== null) throw new TypeError(`${path} must be a plain object`);
		return value;
	};
	var optionsOf = (value, allowed, path) => {
		if (value === void 0) return {};
		const options = plainObject(value, path);
		for (const key in options) if (!allowed.has(key)) throw new TypeError(`${path}.${key} is unknown`);
		return options;
	};
	var defaulted = (value, fallback) => value === void 0 ? fallback : value;
	var finite = (value, path) => {
		if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`${path} must be a finite number`);
		return value;
	};
	var renderOptionsOf = (value) => {
		if (value === void 0) return null;
		const render = optionsOf(value, RENDER_KEYS, "options.render");
		if (render.roundVertices !== void 0 && typeof render.roundVertices !== "boolean") throw new TypeError("options.render.roundVertices must be a boolean");
		if (render.pixelResolution !== void 0) {
			const pixelResolution = finite(render.pixelResolution, "options.render.pixelResolution");
			if (pixelResolution <= 0) throw new RangeError("options.render.pixelResolution must be positive");
			if (pixelResolution < MIN_PIXEL_RESOLUTION || pixelResolution > MAX_PIXEL_RESOLUTION) throw new RangeError(`options.render.pixelResolution must be from ${MIN_PIXEL_RESOLUTION} to ${MAX_PIXEL_RESOLUTION}`);
		}
		const projection = render.kneeProjection;
		if (projection !== void 0 && projection !== null) {
			optionsOf(projection, KNEE_PROJECTION_KEYS, "options.render.kneeProjection");
			worldPoint({
				x: projection.centerX,
				y: projection.centerY
			}, null, "options.render.kneeProjection.center");
			const perspective = finite(projection.perspective, "options.render.kneeProjection.perspective");
			if (perspective < 0) throw new RangeError("options.render.kneeProjection.perspective must be nonnegative");
			if (perspective > MAX_PERSPECTIVE) throw new RangeError(`options.render.kneeProjection.perspective must be at most ${MAX_PERSPECTIVE}`);
			if (projection.maxOffset !== void 0) {
				const maxOffset = finite(projection.maxOffset, "options.render.kneeProjection.maxOffset");
				if (maxOffset < 0) throw new RangeError("options.render.kneeProjection.maxOffset must be nonnegative");
				if (maxOffset > MAX_WORLD_COORDINATE) throw new RangeError(`options.render.kneeProjection.maxOffset must be at most ${MAX_WORLD_COORDINATE}`);
			}
		}
		return render;
	};
	var point = (value, fallback, path) => {
		if (value === void 0) {
			if (fallback === null) throw new TypeError(`${path} is required`);
			return { ...fallback };
		}
		const input = plainObject(value, path);
		for (const key in input) if (key !== "x" && key !== "y") throw new TypeError(`${path}.${key} is unknown`);
		return {
			x: finite(input.x, `${path}.x`),
			y: finite(input.y, `${path}.y`)
		};
	};
	var worldPoint = (value, fallback, path) => {
		const result = point(value, fallback, path);
		if (Math.abs(result.x) > MAX_WORLD_COORDINATE || Math.abs(result.y) > MAX_WORLD_COORDINATE) throw new RangeError(`${path} coordinates must be from -1000000000 to ${MAX_WORLD_COORDINATE}`);
		return result;
	};
	var directionInto = (value, fallback, path, result) => {
		const input = value === void 0 ? fallback : plainObject(value, path);
		if (value !== void 0) {
			for (const key in input) if (key !== "x" && key !== "y") throw new TypeError(`${path}.${key} is unknown`);
		}
		const inputX = finite(input.x, `${path}.x`);
		const inputY = finite(input.y, `${path}.y`);
		const scale = Math.max(Math.abs(inputX), Math.abs(inputY));
		if (!scale) throw new RangeError(`${path} must be nonzero`);
		const x = inputX / scale;
		const y = inputY / scale;
		const magnitude = Math.hypot(x, y);
		result.x = x / magnitude;
		result.y = y / magnitude;
		return result;
	};
	var direction = (value, fallback, path) => directionInto(value, fallback, path, {});
	var newPose = () => ({
		head: {
			x: 0,
			y: 0
		},
		center: {
			x: 0,
			y: 0
		},
		direction: {
			x: 0,
			y: 0
		}
	});
	var bodyFitsWorld = (body) => body.fitsTranslation({
		x: 0,
		y: 0
	}, MAX_WORLD_COORDINATE);
	var sameTopology = (before, after) => [
		"head",
		"trunk",
		"tail"
	].every((name) => before.sections[name].count === after.sections[name].count);
	var legCountKey = (model) => model.descriptor.legs.pairs;
	var ornamentKey = (model) => model.skin.ornaments.map((ornament) => `${ornament.id}:${ornament.side}`).join("|");
	var Beefwife = class extends Container {
		#random;
		#requestedDirection;
		#model;
		#gait;
		#body;
		#legs;
		#skin;
		#graphics = null;
		#gone = false;
		#renderOptions = null;
		#renderState = null;
		#pose = newPose();
		#throttle;
		#stepThrottle;
		#updateDependents = (seconds) => {
			this.#throttle = this.#stepThrottle;
			this.#legs.update(seconds, this.#stepThrottle);
			this.#skin.update(seconds);
		};
		constructor(descriptor, rawOptions) {
			super();
			const options = optionsOf(rawOptions, OPTION_KEYS, "options");
			const position = worldPoint(options.position, {
				x: 0,
				y: 0
			}, "options.position");
			const facing = direction(options.direction, {
				x: 1,
				y: 0
			}, "options.direction");
			const phase = finite(defaulted(options.phase, 0), "options.phase");
			if (options.random !== void 0 && typeof options.random !== "function") throw new TypeError("options.random must be a function");
			this.#random = options.random ?? Math.random;
			this.#renderOptions = renderOptionsOf(options.render);
			this.#requestedDirection = { ...facing };
			this.#model = compile(descriptor);
			graphics_default.prepare(this.#model);
			this.#gait = new Gait(this.#model.gait, phase);
			const breathingPhase = this.#model.breathing.strain ? TAU * this.#sampleRandom() : this.#gait.phase;
			this.#body = new Body(this.#model, this.#gait, breathingPhase);
			this.#body.place(position, facing);
			if (!bodyFitsWorld(this.#body)) throw new RangeError("options.position places the body outside the world");
			this.#legs = new Legs(this.#model, this.#body, this.#gait, () => this.#sampleRandom());
			this.#throttle = 1;
			this.#stepThrottle = 1;
			this.#skin = new Skin(this.#model, this.#body, this.#legs);
			this.#refreshPose();
			this.label = this.#model.descriptor.name;
			this.onRender = graphics_default.available ? (renderer) => this.#syncGraphics(renderer) : null;
			this.#replaceGraphics();
		}
		get descriptor() {
			return this.#model.descriptor;
		}
		get restLength() {
			return this.#model.restLength;
		}
		step(rawDt, rawControls) {
			this.#live("step");
			const dt = finite(rawDt, "dt");
			if (dt < 0) throw new RangeError("dt must be nonnegative");
			const controls = optionsOf(rawControls, CONTROL_KEYS, "controls");
			const throttle = finite(defaulted(controls.throttle, 1), "controls.throttle");
			if (throttle < 0 || throttle > 1) throw new RangeError("controls.throttle must be from 0 to 1");
			const wanted = directionInto(controls.direction, this.#requestedDirection, "controls.direction", this.#requestedDirection);
			this.#stepThrottle = throttle;
			if (this.#body.step(Math.min(dt, MAX_STEP_SECONDS), throttle, wanted, this.#updateDependents)) {
				const correction = this.#body.worldCorrection(MAX_WORLD_COORDINATE);
				if (correction.x || correction.y) {
					this.#body.translate(correction);
					this.#legs.translate(correction);
					this.#skin.translate(correction);
				}
				this.#refreshPose();
			}
		}
		setDescriptor(descriptor) {
			this.#live("setDescriptor");
			const nextModel = compile(descriptor);
			graphics_default.prepare(nextModel);
			const nextGait = new Gait(nextModel.gait, this.#gait.phase);
			const breathingPhase = !this.#model.breathing.strain && nextModel.breathing.strain ? TAU * this.#sampleRandom() : this.#body.breathingPhase;
			const compatible = sameTopology(this.#model, nextModel);
			let body = this.#body;
			if (!compatible) {
				body = new Body(nextModel, nextGait, breathingPhase);
				body.adopt(this.#body);
				body.refreshContacts(this.#throttle);
				if (!bodyFitsWorld(body)) throw new RangeError("descriptor places the body outside the world");
			}
			const nextLegs = legCountKey(this.#model) === legCountKey(nextModel) ? null : new Legs(nextModel, body, nextGait, () => this.#sampleRandom());
			const nextSkin = ornamentKey(this.#model) === ornamentKey(nextModel) ? null : new Skin(nextModel, body, nextLegs || this.#legs);
			if (compatible) this.#body.reconfigure(nextModel, nextGait, this.#throttle, breathingPhase);
			else this.#body = body;
			if (nextLegs) this.#legs = nextLegs;
			else this.#legs.reconfigure(nextModel, this.#body, nextGait);
			if (nextSkin) this.#skin = nextSkin;
			else this.#skin.reconfigure(nextModel, this.#body, this.#legs);
			this.#model = nextModel;
			this.#gait = nextGait;
			this.#refreshPose();
			this.label = nextModel.descriptor.name;
			this.#replaceGraphics();
		}
		reset(rawOptions) {
			this.#live("reset");
			const options = optionsOf(rawOptions, RESET_KEYS, "options");
			const pose = this.#body.getPose(this.#pose);
			const position = worldPoint(options.position, pose.head, "options.position");
			const facing = direction(options.direction, pose.direction, "options.direction");
			const phase = finite(defaulted(options.phase, this.#gait.phase), "options.phase");
			const gait = new Gait(this.#model.gait, phase);
			const breathingPhase = this.#model.breathing.strain ? TAU * this.#sampleRandom() : gait.phase;
			const body = new Body(this.#model, gait, breathingPhase);
			body.place(position, facing);
			if (!bodyFitsWorld(body)) throw new RangeError("options.position places the body outside the world");
			const legs = new Legs(this.#model, body, gait, () => this.#sampleRandom());
			const skin = new Skin(this.#model, body, legs);
			if (options.direction !== void 0) this.#requestedDirection = { ...facing };
			this.#gait = gait;
			this.#body = body;
			this.#legs = legs;
			this.#skin = skin;
			this.#throttle = 1;
			this.#refreshPose();
			if (this.#graphics) this.#syncGraphics();
		}
		translate(rawOffset) {
			this.#live("translate");
			const offset = worldPoint(rawOffset, null, "offset");
			if (!this.#body.fitsTranslation(offset, MAX_WORLD_COORDINATE)) throw new RangeError("offset places the body outside the world");
			this.#body.translate(offset);
			this.#legs.translate(offset);
			this.#skin.translate(offset);
			this.#refreshPose();
		}
		getPose() {
			return this.#pose;
		}
		getBendResponse(into) {
			this.#live("getBendResponse");
			return this.#body.bend.response(this.#body.chunks, into);
		}
		destroy(options) {
			this.onRender = null;
			if (this.#graphics) {
				this.#graphics.destroy();
				this.#graphics = null;
			}
			this.#gone = true;
			super.destroy(options);
		}
		#live(method) {
			if (this.#gone) throw new Error(`${method} was called on a destroyed beefwife`);
		}
		#sampleRandom() {
			const sample = this.#random();
			if (typeof sample !== "number" || !Number.isFinite(sample)) throw new TypeError("random() must return a finite number");
			if (sample < 0 || sample >= 1) throw new RangeError("random() must return a number from 0 to 1");
			return sample;
		}
		#refreshPose() {
			this.#body.getPose(this.#pose);
		}
		#replaceGraphics() {
			this.#renderState = this.#skin.writeRenderState(this.#renderState);
			if (this.#graphics) this.#graphics.adopt(this.#renderState);
			else if (graphics_default.available) this.#graphics = new graphics_default(this, this.#renderState, this.#renderOptions);
		}
		#syncGraphics(renderer = null) {
			this.#renderState = this.#skin.writeRenderState(this.#renderState);
			this.#graphics.sync(this.#renderState, renderer);
		}
	};
	Object.defineProperty(Beefwife, "MAX_STEP_SECONDS", {
		value: MAX_STEP_SECONDS,
		enumerable: true
	});
	Object.defineProperty(Beefwife, "MAX_WORLD_COORDINATE", {
		value: MAX_WORLD_COORDINATE,
		enumerable: true
	});

//#endregion
//#region src/global.mjs
/**
	* Classic-script entry. A page gets one global, `Beefwife`, and reaches the
	* JSON half through `Beefwife.Descriptor`. Module consumers import both by
	* name, so the namespace is attached only here.
	*/
	Object.defineProperty(Beefwife, "Descriptor", {
		value: descriptor_exports,
		enumerable: true
	});
	var global_default = Beefwife;

//#endregion
return global_default;
})(globalThis.PIXI);
if (typeof module !== "undefined" && module.exports) module.exports = Beefwife;