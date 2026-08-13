/* Beefwife Canvas v0.1.0. Generated from beefwife-canvas/src; do not edit.
   Bundles @kvmet/beefwife (MPL-2.0) and @kvmet/terrain (MIT, (c) Kristen Metcalfe). */
var BeefwifeCanvas = (function(pixi_js) {

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

//#region ../beefwife/src/pixi.mjs
/**
	* The renderer seam. Pixi is a peer, not a dependency: the module build imports
	* it and the classic-script build reads the page's global, which may be absent.
	* Every Pixi reference in the library arrives through here, so `available` is
	* the one place that decides whether a beefwife draws or only simulates.
	*/
	var PIXI = pixi_js;
	var available = typeof PIXI?.Container === "function";

//#endregion
//#region ../beefwife/src/schema.mjs
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
//#region ../beefwife/src/descriptor.mjs
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
//#region ../beefwife/src/model.mjs
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
//#region ../beefwife/src/drive.mjs
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
//#region ../beefwife/src/tables.mjs
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
//#region ../beefwife/src/carry.mjs
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
//#region ../beefwife/src/bend.mjs
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
//#region ../beefwife/src/body.mjs
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
//#region ../beefwife/src/legs.mjs
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
//#region ../beefwife/src/skin.mjs
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
//#region ../beefwife/src/geometry.mjs
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
//#region ../beefwife/src/display.mjs
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
//#region ../beefwife/src/atlas.mjs
/**
	* One texture holding every shape a Beefwife places, so its feet, plates and
	* ornaments draw as particles out of a shared frame instead of a Graphics
	* apiece. The work splits three ways: a plan names the frames from the
	* descriptor alone, packing measures and places them, and only the bake needs
	* a GPU. Naming is what a population repeats, so it is the step kept free of
	* the other two.
	*/
	var BAKE_SUPERSAMPLE = 4;
	var PAD_STROKES = 1;
	var MIN_PAD_TEXELS = 1;
	var ATLAS_TEXEL_LIMIT = 2048;
	var frameKeyFor = (shape, paint, scale) => `${shape.path}|${paint.fill}|${paint.stroke}|${paint.strokeWidth}|${scale}`;
	var baked = /* @__PURE__ */ new WeakMap();
	/**
	* Names the frames a model needs, and nothing else. Measuring a frame means
	* building its context, which is most of what an atlas costs, so a plan holds
	* none: a population plans once per creature but bakes once in total, and the
	* creatures that find the bake already done never pay for the measurement.
	*/
	var planAtlas = (model, renderResolution) => {
		const resolution = renderResolution * 4;
		const specs = /* @__PURE__ */ new Map();
		const claim = (shape, paint, scale) => {
			if (!(scale > 0)) return null;
			const key = frameKeyFor(shape, paint, scale);
			if (!specs.has(key)) specs.set(key, {
				key,
				shape,
				paint,
				scale
			});
			return key;
		};
		const foot = model.legs.skin.foot;
		const feet = model.legs.pairs ? claim(foot.shape, foot.paint, foot.scale * Math.max(1, foot.plantedScale)) : null;
		const load = 1 + Math.max(0, model.skin.loadScale);
		const plates = model.skin.platesTailFirst.map((plate) => claim(plate.shape, plate.paint, plate.scale * model.chunks[plate.chunk].plateScale * load));
		const ornaments = model.skin.ornaments.map((ornament) => claim(ornament.shape, ornament.paint, ornament.scale));
		return {
			key: `${resolution}\n${[...specs.keys()].sort().join("\n")}`,
			resolution,
			frames: [...specs.values()],
			feet,
			plates,
			ornaments
		};
	};
	/**
	* Measures each frame and lays the sheet out. The entries come back carrying
	* a live context apiece, which the bake draws and then destroys.
	*/
	var packAtlas = (plan) => {
		const resolution = plan.resolution;
		const entries = plan.frames.map(({ key, shape, paint, scale }) => {
			const context = contextFor(shape, paint, scale);
			const bounds = context.bounds;
			const pad = Math.max(MIN_PAD_TEXELS, Math.ceil(paint.strokeWidth * scale * PAD_STROKES * resolution));
			return {
				key,
				scale,
				context,
				pad,
				originX: pad + Math.ceil(-bounds.minX * resolution),
				originY: pad + Math.ceil(-bounds.minY * resolution),
				width: Math.ceil(bounds.width * resolution) + pad * 2,
				height: Math.ceil(bounds.height * resolution) + pad * 2
			};
		});
		entries.sort((a, b) => b.height - a.height);
		let shelfX = 0;
		let shelfY = 0;
		let shelfHeight = 0;
		let width = 0;
		for (const entry of entries) {
			if (shelfX > 0 && shelfX + entry.width > 2048) {
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
		const height = shelfY + shelfHeight;
		if (width > 2048 || height > 2048) {
			for (const entry of entries) entry.context.destroy();
			throw new RangeError(`atlas needs ${width} by ${height} texels at resolution ${resolution}, past the ${ATLAS_TEXEL_LIMIT} limit`);
		}
		return {
			resolution,
			width,
			height,
			entries
		};
	};
	var bakeAtlas = (plan, renderer) => {
		const sheet = packAtlas(plan);
		const texel = 1 / sheet.resolution;
		const target = PIXI.RenderTexture.create({
			width: sheet.width * texel,
			height: sheet.height * texel,
			resolution: sheet.resolution,
			antialias: false,
			scaleMode: "nearest"
		});
		const frames = /* @__PURE__ */ new Map();
		let clear = true;
		for (const entry of sheet.entries) {
			const graphics = new PIXI.Graphics(entry.context);
			renderer.render({
				container: graphics,
				target,
				clear,
				transform: new PIXI.Matrix(1, 0, 0, 1, (entry.x + entry.originX) * texel, (entry.y + entry.originY) * texel)
			});
			clear = false;
			graphics.destroy();
			entry.context.destroy();
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
			renderer,
			target,
			frames
		};
	};
	/**
	* Hands back the atlas a plan names, baking it the first time anyone asks.
	* Populations share one descriptor's frames, and a live edit that abandons a
	* set of frames takes the texture with it. Held per renderer, because a page
	* mounting two canvases gives each its own, and a texture belongs to the one
	* that made it.
	*/
	var acquireAtlas = (plan, renderer) => {
		if (!plan.frames.length) return null;
		let sheets = baked.get(renderer);
		if (!sheets) baked.set(renderer, sheets = /* @__PURE__ */ new Map());
		let held = sheets.get(plan.key);
		if (!held) {
			held = {
				atlas: bakeAtlas(plan, renderer),
				uses: 0
			};
			sheets.set(plan.key, held);
		}
		held.uses++;
		return held.atlas;
	};
	var releaseAtlas = (atlas) => {
		const sheets = atlas && baked.get(atlas.renderer);
		const held = sheets && sheets.get(atlas.key);
		if (!held || --held.uses > 0) return;
		sheets.delete(atlas.key);
		for (const frame of atlas.frames.values()) frame.texture.destroy();
		atlas.target.destroy(true);
	};

//#endregion
//#region ../beefwife/src/graphics.mjs
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
			this.retired = null;
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
		_retire(atlas, containers) {
			this._flushRetired();
			for (const container of containers) if (container && container.parent === this.parent) this.parent.removeChild(container);
			this.retired = {
				atlas,
				containers
			};
		}
		_flushRetired() {
			const retired = this.retired;
			if (!retired) return;
			this.retired = null;
			for (const container of retired.containers) if (container) container.destroy();
			releaseAtlas(retired.atlas);
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
			this._flushRetired();
			if (this.plan && this.atlasResolution === resolution) return;
			if (!renderer) return;
			const plan = planAtlas(this.model, resolution);
			const atlas = acquireAtlas(plan, renderer);
			if (this.atlas || this.shapeContainers.length) this._retire(this.atlas, this.shapeContainers);
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
			this._flushRetired();
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
//#region ../beefwife/src/beefwife.mjs
/** Public lifecycle for one schema-v1 beefwife. */
	var HeadlessContainer = class {
		destroy() {
			this.destroyed = true;
		}
	};
	var Container = available ? PIXI.Container : HeadlessContainer;
	var compiled = /* @__PURE__ */ new WeakMap();
	var modelFor = (descriptor) => {
		const held = compiled.get(descriptor);
		if (held) return held;
		const model = compile(descriptor);
		graphics_default.prepare(model);
		compiled.set(descriptor, model);
		return model;
	};
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
	var optionsOf$2 = /* @__PURE__ */ __name((value, allowed, path) => {
		if (value === void 0) return {};
		const options = plainObject(value, path);
		for (const key in options) if (!allowed.has(key)) throw new TypeError(`${path}.${key} is unknown`);
		return options;
	}, "optionsOf");
	var defaulted = (value, fallback) => value === void 0 ? fallback : value;
	var finite$1 = /* @__PURE__ */ __name((value, path) => {
		if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`${path} must be a finite number`);
		return value;
	}, "finite");
	var renderOptionsOf = (value) => {
		if (value === void 0) return null;
		const render = optionsOf$2(value, RENDER_KEYS, "options.render");
		if (render.roundVertices !== void 0 && typeof render.roundVertices !== "boolean") throw new TypeError("options.render.roundVertices must be a boolean");
		if (render.pixelResolution !== void 0) {
			const pixelResolution = finite$1(render.pixelResolution, "options.render.pixelResolution");
			if (pixelResolution <= 0) throw new RangeError("options.render.pixelResolution must be positive");
			if (pixelResolution < MIN_PIXEL_RESOLUTION || pixelResolution > MAX_PIXEL_RESOLUTION) throw new RangeError(`options.render.pixelResolution must be from ${MIN_PIXEL_RESOLUTION} to ${MAX_PIXEL_RESOLUTION}`);
		}
		const projection = render.kneeProjection;
		if (projection !== void 0 && projection !== null) {
			optionsOf$2(projection, KNEE_PROJECTION_KEYS, "options.render.kneeProjection");
			worldPoint({
				x: projection.centerX,
				y: projection.centerY
			}, null, "options.render.kneeProjection.center");
			const perspective = finite$1(projection.perspective, "options.render.kneeProjection.perspective");
			if (perspective < 0) throw new RangeError("options.render.kneeProjection.perspective must be nonnegative");
			if (perspective > MAX_PERSPECTIVE) throw new RangeError(`options.render.kneeProjection.perspective must be at most ${MAX_PERSPECTIVE}`);
			if (projection.maxOffset !== void 0) {
				const maxOffset = finite$1(projection.maxOffset, "options.render.kneeProjection.maxOffset");
				if (maxOffset < 0) throw new RangeError("options.render.kneeProjection.maxOffset must be nonnegative");
				if (maxOffset > MAX_WORLD_COORDINATE) throw new RangeError(`options.render.kneeProjection.maxOffset must be at most ${MAX_WORLD_COORDINATE}`);
			}
		}
		return render;
	};
	var point$1 = /* @__PURE__ */ __name((value, fallback, path) => {
		if (value === void 0) {
			if (fallback === null) throw new TypeError(`${path} is required`);
			return { ...fallback };
		}
		const input = plainObject(value, path);
		for (const key in input) if (key !== "x" && key !== "y") throw new TypeError(`${path}.${key} is unknown`);
		return {
			x: finite$1(input.x, `${path}.x`),
			y: finite$1(input.y, `${path}.y`)
		};
	}, "point");
	var worldPoint = (value, fallback, path) => {
		const result = point$1(value, fallback, path);
		if (Math.abs(result.x) > MAX_WORLD_COORDINATE || Math.abs(result.y) > MAX_WORLD_COORDINATE) throw new RangeError(`${path} coordinates must be from -1000000000 to ${MAX_WORLD_COORDINATE}`);
		return result;
	};
	var directionInto = (value, fallback, path, result) => {
		const input = value === void 0 ? fallback : plainObject(value, path);
		if (value !== void 0) {
			for (const key in input) if (key !== "x" && key !== "y") throw new TypeError(`${path}.${key} is unknown`);
		}
		const inputX = finite$1(input.x, `${path}.x`);
		const inputY = finite$1(input.y, `${path}.y`);
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
			const options = optionsOf$2(rawOptions, OPTION_KEYS, "options");
			const position = worldPoint(options.position, {
				x: 0,
				y: 0
			}, "options.position");
			const facing = direction(options.direction, {
				x: 1,
				y: 0
			}, "options.direction");
			const phase = finite$1(defaulted(options.phase, 0), "options.phase");
			if (options.random !== void 0 && typeof options.random !== "function") throw new TypeError("options.random must be a function");
			this.#random = options.random ?? Math.random;
			this.#renderOptions = renderOptionsOf(options.render);
			this.#requestedDirection = { ...facing };
			this.#model = modelFor(descriptor);
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
			const dt = finite$1(rawDt, "dt");
			if (dt < 0) throw new RangeError("dt must be nonnegative");
			const controls = optionsOf$2(rawControls, CONTROL_KEYS, "controls");
			const throttle = finite$1(defaulted(controls.throttle, 1), "controls.throttle");
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
			const nextModel = modelFor(descriptor);
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
			const options = optionsOf$2(rawOptions, RESET_KEYS, "options");
			const pose = this.#body.getPose(this.#pose);
			const position = worldPoint(options.position, pose.head, "options.position");
			const facing = direction(options.direction, pose.direction, "options.direction");
			const phase = finite$1(defaulted(options.phase, this.#gait.phase), "options.phase");
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
//#region src/cast.mjs
/** Descriptor and cast loading for BeefwifeCanvas. */
	var responseJson = async (url, signal) => {
		const response = await fetch(url, {
			cache: "no-cache",
			signal
		});
		if (!response.ok) throw new Error(`${url}: ${response.status}`);
		return response.json();
	};
	var weightedSource = (value, baseUrl, path) => {
		if (typeof value === "string") return {
			src: new URL(value, baseUrl).href,
			weight: 1
		};
		if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${path} must be a URL or source object`);
		for (const key of Object.keys(value)) if (key !== "src" && key !== "weight") throw new TypeError(`${path}.${key} is unknown`);
		if (typeof value.src !== "string" || !value.src) throw new TypeError(`${path}.src must be a URL`);
		const weight = value.weight ?? 1;
		if (!Number.isFinite(weight) || weight <= 0) throw new RangeError(`${path}.weight must be positive`);
		return {
			src: new URL(value.src, baseUrl).href,
			weight
		};
	};
	var manifestSources = async (manifest, signal) => {
		let value = manifest;
		let baseUrl = document.baseURI;
		if (typeof manifest === "string") {
			const url = new URL(manifest, document.baseURI).href;
			value = await responseJson(url, signal);
			baseUrl = url;
		}
		if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("manifest must be an object");
		for (const key of Object.keys(value)) if (key !== "schemaVersion" && key !== "sources") throw new TypeError(`manifest.${key} is unknown`);
		if (value.schemaVersion !== 1) throw new TypeError("manifest.schemaVersion must be 1");
		if (!Array.isArray(value.sources) || !value.sources.length) throw new TypeError("manifest.sources must be a nonempty array");
		return value.sources.map((source, index) => weightedSource(source, baseUrl, `manifest.sources[${index}]`));
	};
	var descriptorEntry = (value, path) => {
		let descriptor = value;
		let weight = 1;
		if (value?.descriptor !== void 0) {
			for (const key of Object.keys(value)) if (key !== "descriptor" && key !== "weight") throw new TypeError(`${path}.${key} is unknown`);
			descriptor = value.descriptor;
			weight = value.weight ?? 1;
		}
		if (!Number.isFinite(weight) || weight <= 0) throw new RangeError(`${path}.weight must be positive`);
		return {
			descriptor: read(descriptor),
			weight
		};
	};
	var loadCast = async (options, signal) => {
		const sources = [];
		if (options.manifest) sources.push(...await manifestSources(options.manifest, signal));
		if (options.sources) (Array.isArray(options.sources) ? options.sources : [options.sources]).forEach((source, index) => sources.push(weightedSource(source, document.baseURI, `options.sources[${index}]`)));
		const entries = [];
		if (options.descriptors) (Array.isArray(options.descriptors) ? options.descriptors : [options.descriptors]).forEach((descriptor, index) => entries.push(descriptorEntry(descriptor, `options.descriptors[${index}]`)));
		const fetched = await Promise.all(sources.map(async ({ src, weight }) => ({
			descriptor: read(await responseJson(src, signal)),
			weight
		})));
		entries.push(...fetched);
		if (!entries.length) throw new TypeError("provide manifest, sources, or descriptors");
		const cast = Object.create(null);
		const castWeights = Object.create(null);
		for (const entry of entries) {
			const name = entry.descriptor.name;
			if (cast[name]) throw new TypeError(`duplicate beefwife name: ${name}`);
			cast[name] = entry.descriptor;
			castWeights[name] = entry.weight;
		}
		return {
			cast,
			castWeights
		};
	};

//#endregion
//#region src/mount-options.mjs
/** Public mount-option and declarative-attribute validation. */
	var BOOLEAN = /* @__PURE__ */ new Set(["true", "false"]);
	var OPTIONS = {
		antialias: {
			type: "boolean",
			default: false
		},
		arrivalRadius: { type: "number" },
		autoStart: {
			type: "boolean",
			default: true
		},
		avoid: {
			type: "string",
			default: ".beefwife-avoid"
		},
		count: { type: "number" },
		debugRoutes: {
			type: "boolean",
			default: false
		},
		debugTargets: {
			type: "boolean",
			default: false
		},
		debugTerrain: {
			type: "boolean",
			default: false
		},
		descriptors: { attribute: false },
		drawFps: {
			type: "number",
			default: 24
		},
		edgeMargin: {
			type: "number",
			default: 25
		},
		escapeReplanSeconds: { type: "number" },
		filters: { attribute: false },
		imageRendering: {
			type: "string",
			default: "pixelated"
		},
		kneePerspective: {
			type: "number",
			default: .002
		},
		kneeProjectionCenter: { type: "string" },
		manifest: { type: "string" },
		maxKneeOffset: { type: "number" },
		maxPixelRatio: {
			type: "number",
			default: 2
		},
		obstaclePadding: {
			type: "number",
			default: 0
		},
		pauseHidden: {
			type: "boolean",
			default: true
		},
		pauseOffscreen: {
			type: "boolean",
			default: true
		},
		pointerInput: {
			type: "string",
			default: "none"
		},
		random: { attribute: false },
		resolutionScale: {
			type: "number",
			default: .25
		},
		roundVertices: {
			type: "boolean",
			default: true
		},
		simulationFps: {
			type: "number",
			default: 60
		},
		sources: { type: "sources" },
		stuckReplanSeconds: { type: "number" },
		targetMode: {
			type: "string",
			default: "wander"
		},
		throttleEase: { type: "number" },
		timeScale: { type: "number" },
		waypointRadius: { type: "number" },
		wanderDelay: { type: "number" }
	};
	var kebab = (key) => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
	var ATTRIBUTES = {};
	var DEFAULTS = {};
	for (const [key, rule] of Object.entries(OPTIONS)) {
		if (rule.attribute !== false) ATTRIBUTES[`data-beefwife-${kebab(key)}`] = [key, rule.type];
		if (rule.default !== void 0) DEFAULTS[key] = rule.default;
	}
	var parseAttribute = (value, type, name) => {
		if (type === "string") return value;
		if (type === "sources") return value.split(",").map((part) => part.trim()).filter(Boolean);
		if (type === "boolean") {
			if (!BOOLEAN.has(value)) throw new TypeError(`${name} must be true or false`);
			return value === "true";
		}
		const number = Number(value);
		if (!Number.isFinite(number)) throw new TypeError(`${name} must be a finite number`);
		return number;
	};
	var attributesOf = (canvas) => {
		const options = {};
		for (const attribute of canvas.attributes) {
			if (!attribute.name.startsWith("data-beefwife-")) continue;
			if (attribute.name === "data-beefwife-canvas" || attribute.name === "data-beefwife-state") continue;
			const rule = ATTRIBUTES[attribute.name];
			if (!rule) throw new TypeError(`${attribute.name} is unknown`);
			options[rule[0]] = parseAttribute(attribute.value, rule[1], attribute.name);
		}
		return options;
	};
	var optionsOf$1 = /* @__PURE__ */ __name((canvas, supplied) => {
		if (supplied === null || typeof supplied !== "object" || Array.isArray(supplied)) throw new TypeError("options must be an object");
		for (const key of Object.keys(supplied)) if (!OPTIONS[key]) throw new TypeError(`options.${key} is unknown`);
		const options = {
			...DEFAULTS,
			...attributesOf(canvas),
			...supplied
		};
		for (const [key, rule] of Object.entries(OPTIONS)) {
			const value = options[key];
			if (value === void 0) continue;
			if (rule.type === "boolean" && typeof value !== "boolean") throw new TypeError(`${key} must be true or false`);
			if (rule.type === "number" && !Number.isFinite(value)) throw new TypeError(`${key} must be a finite number`);
			if (key === "avoid" && typeof value !== "string") throw new TypeError("avoid must be a selector string");
		}
		if (options.count !== void 0 && !Number.isInteger(options.count)) throw new TypeError("count must be an integer");
		if (options.random !== void 0 && typeof options.random !== "function") throw new TypeError("random must be a function");
		if (options.filters !== void 0 && !Array.isArray(options.filters)) throw new TypeError("filters must be an array");
		if (!["auto", "pixelated"].includes(options.imageRendering)) throw new RangeError("imageRendering must be auto or pixelated");
		if (![
			"none",
			"click",
			"move"
		].includes(options.pointerInput)) throw new RangeError("pointerInput must be none, click, or move");
		if (!["wander", "manual"].includes(options.targetMode)) throw new RangeError("targetMode must be wander or manual");
		for (const key of [
			"edgeMargin",
			"escapeReplanSeconds",
			"kneePerspective",
			"maxKneeOffset",
			"obstaclePadding",
			"stuckReplanSeconds",
			"wanderDelay"
		]) if (options[key] < 0) throw new RangeError(`${key} must be nonnegative`);
		if (options.arrivalRadius !== void 0 && options.arrivalRadius <= 1) throw new RangeError("arrivalRadius must be greater than 1");
		if (options.waypointRadius !== void 0 && options.waypointRadius <= 1) throw new RangeError("waypointRadius must be greater than 1");
		if (options.throttleEase !== void 0 && options.throttleEase <= 0) throw new RangeError("throttleEase must be positive");
		return options;
	}, "optionsOf");
	var ROAM_KEYS = {
		arrivalRadius: "arrivalRadius",
		throttleEase: "ease",
		stuckReplanSeconds: "patience",
		escapeReplanSeconds: "replan",
		waypointRadius: "waypointRadius"
	};
	var roamOf = (options) => {
		const roam = {};
		for (const [option, key] of Object.entries(ROAM_KEYS)) if (options[option] !== void 0) roam[key] = options[option];
		return roam;
	};
	var TERRAIN_KEYS = [
		"avoid",
		"edgeMargin",
		"obstaclePadding"
	];
	var terrainOf = (options) => {
		const terrain = {};
		for (const key of TERRAIN_KEYS) if (options[key] !== void 0) terrain[key] = options[key];
		return terrain;
	};

//#endregion
//#region ../terrain/src/support.mjs
	var NEXT_VIEW = /* @__PURE__ */ new DataView(/* @__PURE__ */ new ArrayBuffer(8));
	var nextFloat = (value, up) => {
		if (value === 0) return up ? Number.MIN_VALUE : -Number.MIN_VALUE;
		NEXT_VIEW.setFloat64(0, value);
		let bits = NEXT_VIEW.getBigUint64(0);
		bits += value > 0 === up ? 1n : -1n;
		NEXT_VIEW.setBigUint64(0, bits);
		return NEXT_VIEW.getFloat64(0);
	};
	var outside = (value, up) => {
		for (let i = 0; i < 2; i++) value = nextFloat(value, up);
		return value;
	};
	var below = (value) => outside(value, false);
	var above = (value) => outside(value, true);
	var TERRAIN_CONFIG = Object.freeze({
		avoid: "[data-terrain-avoid]",
		edgeMargin: 0,
		obstaclePadding: 0,
		funnel: true
	});
	var TERRAIN_OPTIONS = /* @__PURE__ */ new Set([
		"avoid",
		"edgeMargin",
		"funnel",
		"obstaclePadding",
		"root",
		"viewport"
	]);
	var finite = (value, path) => {
		if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`${path} must be a finite number`);
		return value;
	};
	var point = (value, path) => {
		if (!value || typeof value !== "object") throw new TypeError(`${path} must contain finite x and y coordinates`);
		return {
			x: finite(value.x, `${path}.x`),
			y: finite(value.y, `${path}.y`)
		};
	};
	var optionsOf = (supplied) => {
		if (supplied === null || typeof supplied !== "object" || Array.isArray(supplied)) throw new TypeError("options must be an object");
		for (const key of Object.keys(supplied)) if (!TERRAIN_OPTIONS.has(key)) throw new TypeError(`options.${key} is unknown`);
		const options = {
			...TERRAIN_CONFIG,
			...supplied
		};
		for (const key of ["edgeMargin", "obstaclePadding"]) {
			finite(options[key], `options.${key}`);
			if (options[key] < 0) throw new RangeError(`options.${key} must be nonnegative`);
		}
		if (typeof options.funnel !== "boolean") throw new TypeError("options.funnel must be true or false");
		const avoidType = typeof options.avoid;
		if (avoidType !== "string" && avoidType !== "function" && !options.avoid?.[Symbol.iterator]) throw new TypeError("options.avoid must be a selector, iterable, or function");
		if (options.root !== void 0 && typeof options.root?.querySelectorAll !== "function") throw new TypeError("options.root must support querySelectorAll()");
		const viewportType = typeof options.viewport;
		if (options.viewport !== void 0 && viewportType !== "function" && (options.viewport === null || viewportType !== "object")) throw new TypeError("options.viewport must be a rectangle or function");
		return Object.freeze(options);
	};
	/** Twice the signed area of a triangle. Its sign selects a side of ab. */
	var cross2 = (a, b, c) => (c.x - a.x) * (b.y - a.y) - (b.x - a.x) * (c.y - a.y);
	var minHeapPush = (nodes, scores, node, score) => {
		let i = nodes.length;
		nodes.push(node);
		scores.push(score);
		while (i > 0) {
			const parent = i - 1 >> 1;
			if (scores[parent] <= score) break;
			nodes[i] = nodes[parent];
			scores[i] = scores[parent];
			i = parent;
		}
		nodes[i] = node;
		scores[i] = score;
	};
	var minHeapPop = (nodes, scores) => {
		const root = nodes[0];
		const node = nodes.pop();
		const score = scores.pop();
		if (!nodes.length) return root;
		let i = 0;
		while (true) {
			const left = 2 * i + 1;
			if (left >= nodes.length) break;
			const right = left + 1;
			const child = right < nodes.length && scores[right] < scores[left] ? right : left;
			if (scores[child] >= score) break;
			nodes[i] = nodes[child];
			scores[i] = scores[child];
			i = child;
		}
		nodes[i] = node;
		scores[i] = score;
		return root;
	};

//#endregion
//#region ../terrain/src/mesh.mjs
	var TerrainMesh = class {
		constructor(options = {}) {
			this.options = optionsOf(options);
			this._reset();
		}
		get ready() {
			return this._built && this.cells.length > 0;
		}
		build() {
			this._reset();
			const viewport = this._viewport();
			const margin = this.options.edgeMargin;
			this.viewport = viewport;
			this.width = viewport.width;
			this.height = viewport.height;
			this.x0 = Math.min(margin, this.width / 2);
			this.y0 = Math.min(margin, this.height / 2);
			this.x1 = this.width - this.x0;
			this.y1 = this.height - this.y0;
			this.rects = this._measure();
			this._buildSlabs();
			this._built = true;
			return this;
		}
		avoidElements() {
			let source = this.options.avoid;
			const supplied = typeof source === "function";
			if (supplied) source = source();
			if (typeof source === "string") {
				if (supplied) throw new TypeError("options.avoid() must return an iterable");
				const root = this.options.root || globalThis.document;
				if (typeof root?.querySelectorAll !== "function") throw new Error("a document or options.root is required for a selector");
				return Array.from(root.querySelectorAll(source));
			}
			if (!source?.[Symbol.iterator]) throw new TypeError("options.avoid() must return an iterable");
			return Array.from(source);
		}
		nearest(x, y, result = {}) {
			return this._nearest(x, y, result, true);
		}
		offset(x, y, result = {}) {
			return this._nearest(x, y, result, false);
		}
		_nearest(x, y, result, absolute, includeDistance = true) {
			finite(x, "x");
			finite(y, "y");
			if (!result || typeof result !== "object") throw new TypeError("result must be an object");
			if (!this.ready) return null;
			if (x >= this.x0 && x <= this.x1 && y >= this.y0 && y <= this.y1 && !this._covered(x, y)) {
				if (absolute) {
					result.x = x;
					result.y = y;
				} else {
					result.dx = 0;
					result.dy = 0;
				}
				if (includeDistance) result.distance = 0;
				return result;
			}
			let nearD = Infinity;
			let nearX = 0;
			let nearY = 0;
			for (const slab of this.slabs) {
				const cells = slab.cells;
				if (!cells.length) continue;
				const toX = Math.max(slab.left, Math.min(slab.right, x)) - x;
				if (Math.abs(toX) >= nearD) continue;
				let lo = 0;
				let hi = cells.length;
				while (lo < hi) {
					const mid = lo + hi >> 1;
					if (cells[mid].hi < y) lo = mid + 1;
					else hi = mid;
				}
				const first = Math.max(0, lo - 1);
				const last = Math.min(cells.length - 1, lo);
				for (let index = first; index <= last; index++) {
					const cell = cells[index];
					const toY = Math.max(cell.lo, Math.min(cell.hi, y)) - y;
					const d = Math.hypot(toX, toY);
					if (d < nearD) {
						nearD = d;
						nearX = toX;
						nearY = toY;
					}
				}
			}
			if (nearD === Infinity || nearD === 0) return null;
			const distance = above(nearD);
			const scale = distance / nearD;
			const dx = nearX * scale;
			const dy = nearY * scale;
			if (absolute) {
				result.x = x + dx;
				result.y = y + dy;
			} else {
				result.dx = dx;
				result.dy = dy;
			}
			if (includeDistance) result.distance = distance;
			return result;
		}
		_viewport() {
			const configured = this.options.viewport;
			if (configured !== void 0) {
				const viewport = typeof configured === "function" ? configured() : configured;
				if (!viewport || typeof viewport !== "object") throw new TypeError("viewport must be a rectangle");
				const { left = 0, top = 0, width, height } = viewport;
				finite(left, "viewport.left");
				finite(top, "viewport.top");
				finite(width, "viewport.width");
				finite(height, "viewport.height");
				if (width < 0 || height < 0) throw new RangeError("viewport width and height must be nonnegative");
				return {
					left,
					top,
					width,
					height
				};
			}
			const view = globalThis.window;
			if (!view) throw new Error("a window or options.viewport is required to build");
			const viewport = {
				left: 0,
				top: 0,
				width: finite(view.innerWidth, "window.innerWidth"),
				height: finite(view.innerHeight, "window.innerHeight")
			};
			if (viewport.width < 0 || viewport.height < 0) throw new RangeError("viewport width and height must be nonnegative");
			return viewport;
		}
		_reset() {
			this._built = false;
			this.rects = [];
			this.cells = [];
			this.slabs = [];
			this.gates = [];
			this.x0 = this.y0 = this.x1 = this.y1 = 0;
			this.width = this.height = 0;
			this.viewport = {
				left: 0,
				top: 0,
				width: 0,
				height: 0
			};
		}
		/** Snapshot DOMRects so queries never trigger layout. */
		_measure() {
			const out = [];
			const padding = this.options.obstaclePadding;
			const viewport = this.viewport;
			[...new Set(this.avoidElements())].forEach((el, index) => {
				if (typeof el?.getBoundingClientRect !== "function") throw new TypeError(`avoid[${index}] must support getBoundingClientRect()`);
				const r = el.getBoundingClientRect();
				if (!r || typeof r !== "object") throw new TypeError(`avoid[${index}] returned an invalid rectangle`);
				for (const side of [
					"left",
					"top",
					"right",
					"bottom"
				]) finite(r[side], `avoid[${index}].${side}`);
				if (r.right < r.left || r.bottom < r.top) throw new RangeError(`avoid[${index}] rectangle is inverted`);
				const rect = {
					left: r.left - viewport.left - padding,
					top: r.top - viewport.top - padding,
					right: r.right - viewport.left + padding,
					bottom: r.bottom - viewport.top + padding
				};
				for (const side of [
					"left",
					"top",
					"right",
					"bottom"
				]) finite(rect[side], `avoid[${index}].expanded.${side}`);
				if (rect.right < 0 || rect.bottom < 0 || rect.left > this.width || rect.top > this.height) return;
				out.push(rect);
			});
			return out;
		}
		_covered(x, y) {
			for (const r of this.rects) if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true;
			return false;
		}
		/** Open y spans on a line through the guarded obstacle mesh. */
		_open(c, out) {
			if (c < this.x0 || c > this.x1) return;
			let open = this.y0;
			const end = this.y1;
			if (open >= end) return;
			const blocked = [];
			for (const r of this.rects) if (c > below(r.left) && c < above(r.right)) blocked.push([below(r.top), above(r.bottom)]);
			blocked.sort((a, b) => a[0] - b[0]);
			for (const [from, to] of blocked) {
				if (from >= end) break;
				if (from > open) out.push({
					lo: open,
					hi: Math.min(from, end)
				});
				if (to > open) open = to;
				if (open >= end) return;
			}
			out.push({
				lo: open,
				hi: end
			});
		}
		/** Build the free-space slabs and their shared gates. */
		_buildSlabs() {
			const cuts = [this.x0, this.x1];
			for (const r of this.rects) for (const c of [below(r.left), above(r.right)]) if (c > this.x0 && c < this.x1) cuts.push(c);
			cuts.sort((a, b) => a - b);
			this.cells = [];
			this.slabs = [];
			this.gates = [];
			let behind = [];
			for (let i = 0; i < cuts.length - 1; i++) {
				const left = cuts[i];
				const right = cuts[i + 1];
				if (right <= left) continue;
				const spans = [];
				this._open(left / 2 + right / 2, spans);
				const slab = [];
				for (const s of spans) {
					const cell = {
						left,
						right,
						lo: s.lo,
						hi: s.hi,
						gates: []
					};
					this.cells.push(cell);
					slab.push(cell);
				}
				this.slabs.push({
					left,
					right,
					cells: slab
				});
				this._connect(behind, slab);
				behind = slab;
			}
		}
		_connect(left, right) {
			let i = 0;
			let j = 0;
			while (i < left.length && j < right.length) {
				const a = left[i];
				const b = right[j];
				this._gate(a, b);
				if (a.hi <= b.hi) i++;
				if (b.hi <= a.hi) j++;
			}
		}
		_gate(a, b) {
			const lo = Math.max(a.lo, b.lo);
			const hi = Math.min(a.hi, b.hi);
			if (hi <= lo) return;
			const x = a.right;
			const gate = {
				id: this.gates.length,
				x,
				lo,
				hi,
				low: {
					x,
					y: lo
				},
				high: {
					x,
					y: hi
				},
				mid: {
					x,
					y: lo / 2 + hi / 2
				},
				a,
				b
			};
			a.gates.push(gate);
			b.gates.push(gate);
			this.gates.push(gate);
		}
	};

//#endregion
//#region ../terrain/src/terrain.mjs
	var Terrain = class extends TerrainMesh {
		_land(p) {
			return this._nearest(p.x, p.y, p, true, false);
		}
		_seat(p) {
			for (const slab of this.slabs) {
				if (p.x < slab.left || p.x > slab.right) continue;
				let lo = 0;
				let hi = slab.cells.length;
				while (lo < hi) {
					const mid = lo + hi >> 1;
					if (slab.cells[mid].hi < p.y) lo = mid + 1;
					else hi = mid;
				}
				const cell = slab.cells[lo];
				if (cell && p.y >= cell.lo) return {
					cell,
					point: {
						x: p.x,
						y: p.y
					}
				};
			}
			let best = null;
			let bestD = Infinity;
			for (const cell of this.cells) {
				const x = Math.max(cell.left, Math.min(cell.right, p.x));
				const y = Math.max(cell.lo, Math.min(cell.hi, p.y));
				const d = (x - p.x) ** 2 + (y - p.y) ** 2;
				if (d === 0) return {
					cell,
					point: {
						x: p.x,
						y: p.y
					}
				};
				if (d >= bestD) continue;
				const point = {
					x,
					y
				};
				if (this._visible(p, point)) {
					bestD = d;
					best = {
						cell,
						point
					};
				}
			}
			return best;
		}
		_visible(a, b) {
			const dx = b.x - a.x;
			const dy = b.y - a.y;
			for (const r of this.rects) {
				if (Math.max(a.x, b.x) < r.left || Math.min(a.x, b.x) > r.right || Math.max(a.y, b.y) < r.top || Math.min(a.y, b.y) > r.bottom) continue;
				let enter = 0;
				let leave = 1;
				if (dx === 0) {
					if (a.x < r.left || a.x > r.right) continue;
				} else {
					const left = (r.left - a.x) / dx;
					const right = (r.right - a.x) / dx;
					enter = Math.max(enter, Math.min(left, right));
					leave = Math.min(leave, Math.max(left, right));
					if (enter > leave) continue;
				}
				if (dy === 0) {
					if (a.y < r.top || a.y > r.bottom) continue;
				} else {
					const top = (r.top - a.y) / dy;
					const bottom = (r.bottom - a.y) / dy;
					enter = Math.max(enter, Math.min(top, bottom));
					leave = Math.min(leave, Math.max(top, bottom));
					if (enter > leave) continue;
				}
				return false;
			}
			return true;
		}
		/** A* over directed gate crossings, using gate centers for graph costs. */
		_cross(from, start, to, goal) {
			const size = 2 * this.gates.length;
			const cost = new Float64Array(size).fill(Infinity);
			const prev = new Int32Array(size).fill(-1);
			const done = new Uint8Array(size);
			const heapNodes = [];
			const heapScores = [];
			for (const gate of from.gates) {
				const key = 2 * gate.id + (gate.a === from ? 1 : 0);
				const first = Math.hypot(gate.mid.x - start.x, gate.mid.y - start.y);
				cost[key] = first;
				minHeapPush(heapNodes, heapScores, key, first + Math.hypot(gate.mid.x - goal.x, gate.mid.y - goal.y));
			}
			while (heapNodes.length) {
				const key = minHeapPop(heapNodes, heapScores);
				if (done[key]) continue;
				done[key] = 1;
				const gate = this.gates[key >> 1];
				const cell = key & 1 ? gate.b : gate.a;
				if (cell === to) {
					const walk = [];
					for (let at = key; at >= 0; at = prev[at]) walk.push(at);
					walk.reverse();
					return walk.map((at) => ({
						gate: this.gates[at >> 1],
						forward: (at & 1) === 1
					}));
				}
				const low = cost[key];
				for (const next of cell.gates) {
					if (next === gate) continue;
					const nextKey = 2 * next.id + (next.a === cell ? 1 : 0);
					const step = low + Math.hypot(next.mid.x - gate.mid.x, next.mid.y - gate.mid.y);
					if (step >= cost[nextKey]) continue;
					cost[nextKey] = step;
					prev[nextKey] = key;
					minHeapPush(heapNodes, heapScores, nextKey, step + Math.hypot(next.mid.x - goal.x, next.mid.y - goal.y));
				}
			}
			return null;
		}
		/** Pull the selected gate corridor taut. */
		_taut(start, crossings, goal) {
			const out = [start];
			let apex = start;
			let left = start;
			let right = start;
			let apexAt = 0;
			let leftAt = 0;
			let rightAt = 0;
			for (let i = 0; i <= crossings.length; i++) {
				const crossing = crossings[i];
				const gateLeft = crossing ? crossing.forward ? crossing.gate.high : crossing.gate.low : goal;
				const gateRight = crossing ? crossing.forward ? crossing.gate.low : crossing.gate.high : goal;
				if (cross2(apex, right, gateRight) <= 0) if (right === apex || cross2(apex, left, gateRight) > 0) {
					right = gateRight;
					rightAt = i;
				} else {
					out.push({
						x: left.x,
						y: left.y
					});
					apex = left;
					apexAt = leftAt;
					left = apex;
					right = apex;
					leftAt = apexAt;
					rightAt = apexAt;
					i = apexAt;
					continue;
				}
				if (cross2(apex, left, gateLeft) >= 0) if (left === apex || cross2(apex, right, gateLeft) < 0) {
					left = gateLeft;
					leftAt = i;
				} else {
					out.push({
						x: right.x,
						y: right.y
					});
					apex = right;
					apexAt = rightAt;
					left = apex;
					right = apex;
					leftAt = apexAt;
					rightAt = apexAt;
					i = apexAt;
					continue;
				}
			}
			out.push(goal);
			return out;
		}
		_route(points, moved) {
			let length = 0;
			for (const point of points) {
				const previous = points[length - 1];
				if (previous && point.x === previous.x && point.y === previous.y) continue;
				points[length++] = point;
			}
			points.length = length;
			points.moved = moved;
			return points;
		}
		route(a, b) {
			const inputStart = point(a, "a");
			const inputGoal = point(b, "b");
			if (!this.ready) return null;
			const startX = inputStart.x;
			const startY = inputStart.y;
			const goalX = inputGoal.x;
			const goalY = inputGoal.y;
			const landedStart = this._land(inputStart);
			const landedGoal = this._land(inputGoal);
			if (!landedStart || !landedGoal) return null;
			const moved = landedStart.x !== startX || landedStart.y !== startY || landedGoal.x !== goalX || landedGoal.y !== goalY;
			if (this._visible(landedStart, landedGoal)) return this._route([landedStart, landedGoal], moved);
			const from = this._seat(landedStart);
			const to = this._seat(landedGoal);
			if (!from || !to) return null;
			const start = from.point;
			const goal = to.point;
			let points;
			if (from.cell === to.cell) points = [start, goal];
			else {
				const crossings = this._cross(from.cell, start, to.cell, goal);
				if (!crossings) return null;
				points = this.options.funnel ? this._taut(start, crossings, goal) : [
					start,
					...crossings.map((c) => ({ ...c.gate.mid })),
					goal
				];
			}
			return this._route([
				landedStart,
				...points,
				landedGoal
			], moved);
		}
	};
	Object.defineProperty(Terrain, "DEFAULTS", {
		value: TERRAIN_CONFIG,
		enumerable: true
	});

//#endregion
//#region src/steering.mjs
/**
	* Where a creature is trying to get to.
	*
	* A route is a list of waypoints, planned once and then spent: each comes off
	* the front as the head reaches it. The caller points the creature at whichever
	* is in front with unit(target - head), the way the lab does, and the beefwife's
	* own steering response does the smoothing.
	*
	* Finishing the last waypoint satisfies the route. The goal policy decides
	* when another plan is available. A route is otherwise redrawn only when a
	* creature stops clearing waypoints: one stall timer, read against a short
	* limit while it is out of bounds and a long one while it is not.
	*
	* Every call takes a `roam` object of the host-owned values below.
	*/
	var BEEFWIFE_CANVAS_ROUTE_DEFAULTS = {
		waypointRadius: 10,
		arrivalRadius: 10,
		ease: 4,
		patience: 120,
		replan: 7
	};
	var near = (p, head, r) => Math.hypot(p.x - head.x, p.y - head.y) < r;
	/**
	* Is the head past `p`, across the plane through it square to the leg it
	* walked in on?
	*
	* Measured on the leg in, never the leg out. On the leg out, spending one
	* waypoint puts the head far behind the next one along a bearing that already
	* points away from it, so anywhere the run turns more than a right angle the
	* next point is spent in the same frame. The corner is skipped, the path
	* empties, and the route is reported complete.
	*/
	var passed = (from, p, head) => (head.x - p.x) * (p.x - from.x) + (head.y - p.y) * (p.y - from.y) > 0;
	/**
	* The unit vector from the head to `p`, or null when it is already there.
	*
	* `off` is Terrain's additive correction for where the head is standing. Its
	* direction is added as a second unit vector. In bounds it is zero and the
	* bearing is the waypoint alone. Outside, the two blend, which walks a creature
	* off a widget along the plan it already has instead of drawing another one.
	*/
	var bearingTo = (p, head, off, result = {}) => {
		const dx = p.x - head.x;
		const dy = p.y - head.y;
		const m = Math.hypot(dx, dy);
		if (m < 1) return null;
		if (!off || off.distance === 0) {
			result.x = dx / m;
			result.y = dy / m;
			return result;
		}
		const bx = dx / m + off.dx / off.distance;
		const by = dy / m + off.dy / off.distance;
		const n = Math.hypot(bx, by);
		if (n < 1e-6) {
			result.x = off.dx / off.distance;
			result.y = off.dy / off.distance;
		} else {
			result.x = bx / n;
			result.y = by / n;
		}
		return result;
	};
	/**
	* A fresh route, with nowhere to be yet. `from` is where the leg to the front
	* waypoint starts, which is the last point spent or the head when the plan was
	* drawn. `age` is the seconds since a waypoint was last cleared, and `nowhere`
	* says the last plan came back empty. `satisfied` distinguishes a spent route
	* from one that has not been planned yet.
	*/
	var newRoute = () => ({
		path: [],
		from: null,
		age: 0,
		nowhere: false,
		satisfied: false
	});
	/**
	* Advances a route by `dt`, written in place. Reports the way to steer, and the
	* waypoint it is aiming at, both null with no waypoint left, which stops a
	* creature that has nowhere to go rather than walking it somewhere arbitrary.
	*/
	var stepRoute = (route, router, head, dt, roam, result) => {
		if (router.advance) router.advance(dt);
		route.age += dt;
		const off = router.terrain.offset(head.x, head.y, result?.field);
		while (route.path.length) {
			const point = route.path[0];
			const final = route.path.length === 1;
			if (!(near(point, head, final ? roam.arrivalRadius : roam.waypointRadius) || !final && passed(route.from, point, head))) break;
			route.from = point;
			route.path.shift();
			route.age = 0;
		}
		if (route.from !== null && !route.path.length && !route.nowhere && !route.satisfied) {
			route.satisfied = true;
			route.age = 0;
			if (router.satisfy) router.satisfy();
		}
		const limit = off.distance > 0 ? roam.replan : roam.patience;
		const policyReady = router.readyToPlan ?? true;
		const unplanned = route.from === null;
		const released = route.satisfied && policyReady;
		const stalled = !route.satisfied && route.age >= limit;
		if (policyReady && (unplanned || released || stalled)) {
			const path = router.plan(head);
			route.path = path || [];
			route.nowhere = !path;
			route.satisfied = false;
			route.from = {
				x: head.x,
				y: head.y
			};
			route.age = 0;
		}
		const target = route.path[0] || null;
		if (!result) return {
			target,
			bearing: target && bearingTo(target, head, off)
		};
		result.target = target;
		result.bearing = target ? bearingTo(target, head, off, result.direction) : null;
		return result;
	};

//#endregion
//#region src/path.mjs
/**
	* Where to go, and the way there.
	*
	* A target is supplied by the host or drawn uniformly over the viewport, then
	* moved to the nearest legal point. The run to it is terrain's, which already
	* holds the rectangles and the free space between them.
	*
	*   const router = new BeefwifeCanvasRouter(terrain, viewportOf, options);
	*   router.plan(head);  // [{x, y}, ...], last one the goal, or null
	*   router.planTo(head, target);
	*/
	var BeefwifeCanvasRouter = class {
		constructor(terrain, viewportOf, options = {}) {
			if (typeof viewportOf !== "function") throw new TypeError("viewportOf must be a function");
			const edgeMargin = options.edgeMargin ?? 0;
			if (!Number.isFinite(edgeMargin) || edgeMargin < 0) throw new RangeError("edgeMargin must be nonnegative");
			if (options.random !== void 0 && typeof options.random !== "function") throw new TypeError("random must be a function");
			this.terrain = terrain;
			this.viewportOf = viewportOf;
			this.edgeMargin = edgeMargin;
			this.random = options.random || Math.random;
		}
		get ready() {
			return this.terrain.ready;
		}
		viewport() {
			const viewport = this.viewportOf();
			if (!viewport || !Number.isFinite(viewport.width) || !Number.isFinite(viewport.height) || viewport.width < 0 || viewport.height < 0) throw new TypeError("viewport must have nonnegative finite dimensions");
			return viewport;
		}
		/** Somewhere legal to stand, for a creature being put on the page. */
		randomPoint() {
			return this.ready ? this._somewhere() : null;
		}
		plan(head) {
			if (!this.ready) return null;
			return this.planTo(head, this._somewhere());
		}
		planTo(head, target) {
			if (!this.ready) return null;
			if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) throw new TypeError("target must have finite x and y coordinates");
			const path = this.terrain.route(head, target);
			if (!path) return null;
			const lead = Math.hypot(path[0].x - head.x, path[0].y - head.y) < 1 ? 1 : 0;
			const waypoints = path.slice(lead);
			return waypoints.length ? waypoints : null;
		}
		_somewhere() {
			const { width, height } = this.viewport();
			const x0 = Math.min(this.edgeMargin, width / 2);
			const y0 = Math.min(this.edgeMargin, height / 2);
			const x = x0 + this.random() * (width - 2 * x0);
			const y = y0 + this.random() * (height - 2 * y0);
			const nearest = this.terrain.nearest(x, y);
			return nearest ? {
				x: nearest.x,
				y: nearest.y
			} : null;
		}
	};

//#endregion
//#region src/actor.mjs
/** Route following and Beefwife control for one host-owned plan. */
	var BEEFWIFE_CANVAS_ACTOR_LOST_MARGIN = 200;
	var actorRandomBetween = (random, a, b) => a + random() * (b - a);
	var BeefwifeCanvasActor = class BeefwifeCanvasActor {
		static MAX_DT = .05;
		static MAX_TIME_SCALE = 16;
		static timeScaleOf(value) {
			if (!Number.isFinite(value) || value < 0 || value > BeefwifeCanvasActor.MAX_TIME_SCALE) throw new RangeError(`timeScale must be from 0 to ${BeefwifeCanvasActor.MAX_TIME_SCALE}`);
			return value;
		}
		constructor(terrain, router, spec, options = {}) {
			this.terrain = terrain;
			this.router = router;
			this.spec = spec;
			this.name = spec.name;
			this.random = options.random || Math.random;
			this.roam = options.roam || BEEFWIFE_CANVAS_ROUTE_DEFAULTS;
			this.renderOptions = options.render || null;
			this.heading = {
				x: 1,
				y: 0
			};
			this.controls = {
				throttle: 1,
				direction: this.heading
			};
			this.routeStep = {
				target: null,
				bearing: null,
				direction: {
					x: 1,
					y: 0
				},
				field: {
					dx: 0,
					dy: 0,
					distance: 0
				}
			};
			this.route = newRoute();
			this.planner = options.planner || router;
			this.throttle = 1;
			this.renderSnapshot = {
				display: null,
				head: null,
				route: null,
				target: null
			};
			this.spawn();
		}
		/**
		* Somewhere in bounds along any bearing, out of step with its siblings, or
		* where the caller says. The body is rebuilt rather than moved, so its legs
		* and ornaments start settled.
		*/
		spawn(at, heading) {
			const viewport = this.router.viewport();
			const where = at || this.router.randomPoint() || {
				x: viewport.width / 2,
				y: viewport.height / 2
			};
			const angle = actorRandomBetween(this.random, 0, Math.PI * 2);
			const bearing = heading || {
				x: Math.cos(angle),
				y: Math.sin(angle)
			};
			this.heading.x = bearing.x;
			this.heading.y = bearing.y;
			const previous = this.beefwife;
			const beefwifeOptions = {
				position: where,
				direction: bearing,
				phase: actorRandomBetween(this.random, 0, Math.PI * 2),
				random: this.random
			};
			if (this.renderOptions) beefwifeOptions.render = this.renderOptions;
			this.beefwife = new Beefwife(this.spec, beefwifeOptions);
			this.route = newRoute();
			this.throttle = this.planner.readyToPlan === false ? 0 : 1;
			if (previous) previous.destroy();
		}
		/**
		* Reconfigures the live body and keeps the canonical copy as the spec, so a
		* later respawn rebuilds the creature as it is now, not as it was cast.
		*/
		setDescriptor(descriptor) {
			this.beefwife.setDescriptor(descriptor);
			this.spec = this.beefwife.descriptor;
			this.name = this.spec.name;
			return this;
		}
		/** A carried-off creature returns just inside a random viewport edge. */
		_reentry() {
			const { width, height } = this.router.viewport();
			const back = 24;
			const side = Math.floor(actorRandomBetween(this.random, 0, 4));
			if (side === 0) return {
				at: {
					x: -24,
					y: actorRandomBetween(this.random, 0, height)
				},
				to: {
					x: 1,
					y: 0
				}
			};
			if (side === 1) return {
				at: {
					x: width + back,
					y: actorRandomBetween(this.random, 0, height)
				},
				to: {
					x: -1,
					y: 0
				}
			};
			if (side === 2) return {
				at: {
					x: actorRandomBetween(this.random, 0, width),
					y: -24
				},
				to: {
					x: 0,
					y: 1
				}
			};
			return {
				at: {
					x: actorRandomBetween(this.random, 0, width),
					y: height + back
				},
				to: {
					x: 0,
					y: -1
				}
			};
		}
		/**
		* The centroid trails the head by up to the chain's rest length, so a long
		* creature walking in plain sight has a centroid far outside the viewport.
		* Carrying the whole rest length recycles one only once no part of it can
		* still be on screen.
		*/
		_lost(center) {
			const { width, height } = this.router.viewport();
			const margin = BEEFWIFE_CANVAS_ACTOR_LOST_MARGIN + this.beefwife.restLength;
			return center.x < -margin || center.y < -margin || center.x > width + margin || center.y > height + margin;
		}
		renderState() {
			this.renderSnapshot.display = this.beefwife;
			this.renderSnapshot.head = this.beefwife.getPose().head;
			this.renderSnapshot.route = this.route.path;
			this.renderSnapshot.target = this.planner?.goal || null;
			return this.renderSnapshot;
		}
		update(dt, timeScale) {
			if (!Number.isFinite(dt) || dt < 0 || dt > BeefwifeCanvasActor.MAX_DT) throw new RangeError(`dt must be from 0 to ${BeefwifeCanvasActor.MAX_DT}`);
			BeefwifeCanvasActor.timeScaleOf(timeScale);
			const scaledDt = dt * timeScale;
			const pose = this.beefwife.getPose();
			if (this._lost(pose.center)) {
				const back = this._reentry();
				this.spawn(back.at, back.to);
				return;
			}
			const { target, bearing } = stepRoute(this.route, this.planner, pose.head, scaledDt, this.roam, this.routeStep);
			const wanted = target ? 1 : 0;
			this.throttle += (wanted - this.throttle) * Math.min(1, scaledDt * this.roam.ease);
			if (bearing) {
				this.heading.x = bearing.x;
				this.heading.y = bearing.y;
			}
			this.controls.throttle = this.throttle;
			let remaining = scaledDt;
			while (remaining > 0) {
				const seconds = Math.min(remaining, Beefwife.MAX_STEP_SECONDS);
				this.beefwife.step(seconds, this.controls);
				remaining -= seconds;
			}
		}
	};

//#endregion
//#region src/options.mjs
/** Limits and scalar option validation for the BeefwifeCanvasRuntime frame host. */
	var DEBUG_KEYS = /* @__PURE__ */ new Set([
		"routes",
		"targets",
		"terrain"
	]);
	var config = {
		MAX_DT: BeefwifeCanvasActor.MAX_DT,
		MAX_COUNT: 1024,
		MAX_TIME_SCALE: BeefwifeCanvasActor.MAX_TIME_SCALE,
		REBUILD_DELAY: 150
	};
	var countOf = (value) => {
		if (!Number.isInteger(value) || value < 0 || value > config.MAX_COUNT) throw new RangeError(`count must be an integer from 0 to ${config.MAX_COUNT}`);
		return value;
	};
	var timeScaleOf = BeefwifeCanvasActor.timeScaleOf;
	var debugOf = (value, current) => {
		const result = current ? { ...current } : {
			routes: false,
			targets: false,
			terrain: false
		};
		if (value === void 0) return result;
		if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("debug must be an object");
		for (const [key, enabled] of Object.entries(value)) {
			if (!DEBUG_KEYS.has(key)) throw new TypeError(`debug.${key} is unknown`);
			if (typeof enabled !== "boolean") throw new TypeError(`debug.${key} must be a boolean`);
			result[key] = enabled;
		}
		return result;
	};
	var resolutionScaleOf = (value) => {
		if (!Number.isFinite(value) || value < .125 || value > 1) throw new RangeError("resolutionScale must be from 0.125 to 1");
		return value;
	};
	var imageRenderingOf = (value) => {
		if (!["auto", "pixelated"].includes(value)) throw new RangeError("imageRendering must be auto or pixelated");
		return value;
	};
	var renderFpsOf = (value) => {
		if (value === void 0 || value === 0) return 0;
		if (!Number.isFinite(value) || value < 1 || value > 240) throw new RangeError("renderFps must be 0 or from 1 to 240");
		return value;
	};
	var physicsFpsOf = (value) => {
		if (value === void 0 || value === 0) return 0;
		if (!Number.isFinite(value) || value < 1 || value > 240) throw new RangeError("physicsFps must be 0 or from 1 to 240");
		return value;
	};
	var chooseName = (cast, weights, random) => {
		const names = Object.keys(cast);
		if (!names.length) throw new Error("cast must contain at least one beefwife");
		const weighted = names.map((name) => {
			const weight = weights?.[name] ?? 1;
			if (!Number.isFinite(weight) || weight <= 0) throw new RangeError(`weight for ${name} must be positive`);
			return {
				name,
				weight
			};
		});
		const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
		let sample = random() * total;
		for (const entry of weighted) {
			sample -= entry.weight;
			if (sample < 0) return entry.name;
		}
		return weighted[weighted.length - 1].name;
	};

//#endregion
//#region src/render.mjs
/** Pixi scene synchronization and optional route debugging for BeefwifeCanvasRuntime. */
	var drawTerrain = (graphics, terrainView) => {
		for (const rectangle of terrainView.rectangles) graphics.rect(rectangle.left, rectangle.top, rectangle.right - rectangle.left, rectangle.bottom - rectangle.top);
		graphics.stroke({
			color: 5299360,
			alpha: .55,
			width: 1
		});
		const bounds = terrainView.bounds;
		graphics.rect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top).stroke({
			color: 5299360,
			alpha: .3,
			width: 1
		});
	};
	var drawRoute = (graphics, actor) => {
		const { head, route: path } = actor;
		if (!path.length) return;
		graphics.moveTo(head.x, head.y);
		path.forEach((point) => graphics.lineTo(point.x, point.y));
		graphics.stroke({
			color: 13153400,
			alpha: .5,
			width: 1
		});
		path.forEach((point) => {
			graphics.circle(point.x, point.y, 2.5).stroke({
				color: 13153400,
				alpha: .5,
				width: 1
			});
		});
	};
	var drawTarget = (graphics, actor) => {
		const target = actor.target;
		if (!target) return;
		graphics.circle(target.x, target.y, 5).stroke({
			color: 15756443,
			alpha: .9,
			width: 2
		});
		graphics.moveTo(target.x - 8, target.y).lineTo(target.x + 8, target.y).moveTo(target.x, target.y - 8).lineTo(target.x, target.y + 8).stroke({
			color: 15756443,
			alpha: .75,
			width: 1
		});
	};
	var draw = ({ actors, debug, scene, terrainView }) => {
		scene.syncDisplays(actors.map((actor) => actor.display));
		scene.debugUnderlay.clear();
		scene.debugOverlay.clear();
		if (debug.terrain) drawTerrain(scene.debugUnderlay, terrainView);
		if (debug.routes) for (const actor of actors) drawRoute(scene.debugOverlay, actor);
		if (debug.targets) for (const actor of actors) drawTarget(scene.debugOverlay, actor);
		scene.render();
	};

//#endregion
//#region src/scene.mjs
/** Pixi application, stage, canvas sizing, and display ownership. */
	var BeefwifeCanvasScene = class {
		constructor(options = {}) {
			this.ownsCanvas = !options.canvas;
			this.canvas = options.canvas || null;
			this.reusableApplication = options.application || null;
			this.antialias = options.antialias;
			this.filters = options.filters;
			this.imageRendering = options.imageRendering;
			this.maxPixelRatio = options.maxPixelRatio;
			this.resolutionScale = options.resolutionScale;
			this.zIndex = options.zIndex;
			this.kneeProjectionCenter = options.kneeProjectionCenter;
			this.renderOptions = options.renderOptions;
			this.application = null;
			this.debugUnderlay = null;
			this.debugOverlay = null;
			this.world = null;
			this.displayed = [];
			this.dpr = 1;
			this.viewport = this.viewportRect(this.canvas);
		}
		async initialize() {
			if (!available) throw new Error("PIXI must load first");
			this._syncPixelResolution();
			if (this.reusableApplication) {
				this.application = this.reusableApplication;
				if (this.application.canvas !== this.canvas) throw new Error("reusable Pixi application belongs to another canvas");
				this._buildStage();
				return this;
			}
			const canvas = this.canvas || document.createElement("canvas");
			if (this.ownsCanvas) {
				canvas.className = "beefwife-canvas-layer";
				Object.assign(canvas.style, {
					position: "fixed",
					left: "0",
					top: "0",
					width: "100%",
					height: "100%",
					pointerEvents: "none",
					zIndex: String(this.zIndex)
				});
			}
			const viewport = this.viewportRect(canvas);
			this.viewport = viewport;
			const application = new PIXI.Application();
			await application.init({
				canvas,
				preference: "webgl",
				backgroundAlpha: 0,
				antialias: this.antialias,
				autoDensity: this.ownsCanvas,
				autoStart: false,
				resolution: this.dpr,
				width: Math.max(1, viewport.width),
				height: Math.max(1, viewport.height)
			});
			this.application = application;
			this.canvas = application.canvas;
			this._buildStage();
			return this;
		}
		_buildStage() {
			this.debugUnderlay = new PIXI.Graphics();
			this.debugOverlay = new PIXI.Graphics();
			this.world = new PIXI.Container();
			this.world.filters = this.filters;
			this.application.stage.addChild(this.debugUnderlay, this.world, this.debugOverlay);
		}
		attach() {
			if (!this.application) throw new Error("Pixi renderer is not ready");
			if (this.ownsCanvas) document.body.appendChild(this.canvas);
		}
		viewportRect(canvas = this.canvas) {
			if (this.ownsCanvas || !canvas) return {
				left: 0,
				top: 0,
				width: window.innerWidth,
				height: window.innerHeight
			};
			const rect = canvas.getBoundingClientRect();
			return {
				left: rect.left,
				top: rect.top,
				width: rect.width,
				height: rect.height
			};
		}
		resize() {
			if (!this.application) return;
			const viewport = this.viewportRect();
			this.viewport = viewport;
			this._syncPixelResolution();
			this.canvas.style.imageRendering = this.imageRendering;
			const projection = this.renderOptions.kneeProjection;
			if (projection) if (this.kneeProjectionCenter === "viewport") {
				projection.centerX = window.innerWidth / 2 - viewport.left;
				projection.centerY = window.innerHeight / 2 - viewport.top;
			} else {
				projection.centerX = viewport.width / 2;
				projection.centerY = viewport.height / 2;
			}
			this.application.renderer.resolution = this.dpr;
			this.application.renderer.resize(viewport.width, viewport.height);
		}
		_syncPixelResolution() {
			this.dpr = Math.min(window.devicePixelRatio || 1, this.maxPixelRatio) * this.resolutionScale;
			this.renderOptions.pixelResolution = this.dpr;
		}
		syncDisplays(displays) {
			const currentSet = new Set(displays);
			for (const beefwife of this.displayed) if (!currentSet.has(beefwife) && !beefwife.destroyed) beefwife.destroy();
			for (let index = 0; index < displays.length; index++) this.world.addChildAt(displays[index], index);
			this.displayed = displays.slice();
		}
		render() {
			this.application.render();
		}
		release(preserveRenderer = false) {
			const application = this.application;
			this.displayed = [];
			if (preserveRenderer && application) {
				this.world.filters = [];
				this.debugUnderlay.destroy();
				this.world.destroy();
				this.debugOverlay.destroy();
			} else if (this.ownsCanvas && this.canvas) this.canvas.remove();
			if (application && !preserveRenderer) application.destroy({
				removeView: false,
				releaseGlobalResources: false
			});
			this.application = null;
			return preserveRenderer ? application : null;
		}
	};

//#endregion
//#region src/targeting.mjs
/** Destination ownership and satisfaction policy for routed runtime. */
	var pointOf = (value, path = "target") => {
		if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${path} must be an object`);
		const prototype = Object.getPrototypeOf(value);
		if (prototype !== Object.prototype && prototype !== null) throw new TypeError(`${path} must be a plain object`);
		for (const key of Object.keys(value)) if (key !== "x" && key !== "y") throw new TypeError(`${path}.${key} is unknown`);
		if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) throw new TypeError(`${path} must have finite x and y coordinates`);
		return {
			x: value.x,
			y: value.y
		};
	};
	var targetModeOf = (value) => {
		if (!["wander", "manual"].includes(value)) throw new RangeError("targetMode must be wander or manual");
		return value;
	};
	var wanderDelayOf = (value) => {
		if (!Number.isFinite(value) || value < 0) throw new RangeError("wanderDelay must be a nonnegative number");
		return value;
	};
	var BeefwifeCanvasTargetPolicy = class {
		constructor(router, targetMode, options = {}) {
			this.router = router;
			this.terrain = router.terrain;
			this.targetMode = targetModeOf(targetMode);
			this.random = options.random || Math.random;
			this.wanderDelay = wanderDelayOf(options.wanderDelay ?? 4);
			this.goal = null;
			this.delay = 0;
		}
		get readyToPlan() {
			return Boolean(this.goal) || this.targetMode === "wander" && this.delay <= 0;
		}
		advance(dt) {
			this.delay = Math.max(0, this.delay - dt);
		}
		plan(head) {
			if (!this.goal && this.targetMode === "wander") this.goal = this.router.randomPoint();
			return this.goal ? this.router.planTo(head, this.goal) : null;
		}
		satisfy() {
			this.goal = null;
			this.delay = this.targetMode === "wander" ? this.random() * this.wanderDelay : 0;
		}
		setTarget(target) {
			this.goal = pointOf(target);
			this.delay = 0;
		}
		clearTarget() {
			this.goal = null;
			this.delay = this.targetMode === "wander" ? this.random() * this.wanderDelay : 0;
		}
		setTargetMode(targetMode) {
			this.targetMode = targetModeOf(targetMode);
			this.goal = null;
			this.delay = 0;
		}
	};

//#endregion
//#region src/population.mjs
/** Actor collection, spawn queue, cast selection, and target-policy ownership. */
	var BeefwifeCanvasPopulation = class {
		constructor(terrain, router, options = {}) {
			this.terrain = terrain;
			this.router = router;
			this.cast = options.cast || null;
			this.castWeights = options.castWeights || null;
			this.random = options.random || Math.random;
			this.renderOptions = options.renderOptions || null;
			this.roam = options.roam;
			this.targetMode = targetModeOf(options.targetMode || "wander");
			this.wanderDelay = wanderDelayOf(options.wanderDelay ?? 4);
			this.actors = [];
			this.renderSnapshots = [];
			this.targetPolicies = /* @__PURE__ */ new Map();
			const count = options.count === void 0 ? 3 : countOf(options.count);
			this.pending = Array(count).fill(null);
		}
		add(name) {
			if (name !== void 0 && typeof name !== "string") throw new TypeError("name must be a string");
			if (this.actors.length + this.pending.length >= config.MAX_COUNT) throw new RangeError(`cannot add more than ${config.MAX_COUNT} beefwives`);
			if (!this.router.ready || !this.cast) {
				this.pending.push(name ?? null);
				return null;
			}
			return this._addNow(name);
		}
		_addNow(name) {
			const selectedName = name || chooseName(this.cast, this.castWeights, this.random);
			const spec = this.cast[selectedName];
			if (!spec) throw new Error(`no creature named ${name}`);
			const planner = new BeefwifeCanvasTargetPolicy(this.router, this.targetMode, {
				random: this.random,
				wanderDelay: this.wanderDelay
			});
			const actor = new BeefwifeCanvasActor(this.terrain, this.router, spec, {
				planner,
				random: this.random,
				render: this.renderOptions,
				roam: this.roam
			});
			this.actors.push(actor);
			this.targetPolicies.set(actor, planner);
			return actor;
		}
		spawnPending() {
			while (this.router.ready && this.cast && this.pending.length) {
				const name = this.pending.shift();
				this._addNow(name || void 0);
			}
		}
		remove() {
			if (this.pending.length) this.pending.pop();
			else {
				const actor = this.actors.pop();
				if (actor) {
					this.targetPolicies.delete(actor);
					actor.beefwife.destroy();
				}
			}
		}
		clear() {
			for (const actor of this.actors) actor.beefwife.destroy();
			this.actors = [];
			this.targetPolicies.clear();
			this.pending = [];
		}
		setCount(rawCount) {
			const count = countOf(rawCount);
			while (this.actors.length + this.pending.length > count) this.remove();
			while (this.actors.length + this.pending.length < count) this.add();
		}
		_targets(actor) {
			if (!actor) return this.actors;
			if (!this.targetPolicies.has(actor)) throw new Error("actor does not belong to this host");
			return [actor];
		}
		setTarget(target, actor = null) {
			const point = pointOf(target);
			for (const creature of this._targets(actor)) {
				this.targetPolicies.get(creature).setTarget(point);
				creature.route = newRoute();
			}
		}
		clearTarget(actor = null) {
			for (const creature of this._targets(actor)) {
				this.targetPolicies.get(creature).clearTarget();
				creature.route = newRoute();
			}
		}
		setTargetMode(targetMode, actor = null) {
			const mode = targetModeOf(targetMode);
			if (!actor) this.targetMode = mode;
			for (const creature of this._targets(actor)) {
				this.targetPolicies.get(creature).setTargetMode(mode);
				creature.route = newRoute();
			}
		}
		respawn(actor = null) {
			for (const creature of this._targets(actor)) creature.spawn();
		}
		update(dt, timeScale) {
			for (let index = 0; index < this.actors.length; index++) this.actors[index].update(dt, timeScale);
		}
		renderState() {
			this.renderSnapshots.length = this.actors.length;
			for (let index = 0; index < this.actors.length; index++) this.renderSnapshots[index] = this.actors[index].renderState();
			return this.renderSnapshots;
		}
		destroy() {
			this.clear();
		}
	};

//#endregion
//#region src/runtime.mjs
/** Coordinates scene, population, terrain observation, and frame timing. */
	var BeefwifeCanvasRuntime = class BeefwifeCanvasRuntime {
		static async create(options = {}) {
			const runtime = new BeefwifeCanvasRuntime(options);
			await runtime.scene.initialize();
			return runtime;
		}
		constructor(options = {}) {
			this.timeScale = timeScaleOf(options.timeScale ?? 1);
			if (options.random !== void 0 && typeof options.random !== "function") throw new TypeError("random must be a function");
			const random = options.random || Math.random;
			const resolutionScale = resolutionScaleOf(options.resolutionScale ?? 1);
			const imageRendering = imageRenderingOf(options.imageRendering ?? "auto");
			this.renderFps = renderFpsOf(options.renderFps);
			this.physicsFps = physicsFpsOf(options.physicsFps);
			if (this.physicsFps && (!this.renderFps || this.renderFps > this.physicsFps)) this.renderFps = this.physicsFps;
			this.renderInterval = this.renderFps ? 1e3 / this.renderFps : 0;
			this.physicsInterval = this.physicsFps ? 1e3 / this.physicsFps : 0;
			const maxPixelRatio = options.maxPixelRatio ?? Infinity;
			if (maxPixelRatio !== Infinity && (!Number.isFinite(maxPixelRatio) || maxPixelRatio <= 0)) throw new RangeError("maxPixelRatio must be positive");
			const roam = options.roam ? {
				...BEEFWIFE_CANVAS_ROUTE_DEFAULTS,
				...options.roam
			} : BEEFWIFE_CANVAS_ROUTE_DEFAULTS;
			const ownsProjection = options.kneePerspective !== void 0 || options.maxKneeOffset !== void 0 || options.kneeProjectionCenter !== void 0;
			const kneeProjectionCenter = options.kneeProjectionCenter || "canvas";
			const renderOptions = {
				roundVertices: options.roundVertices === true,
				pixelResolution: 1,
				kneeProjection: ownsProjection ? {
					centerX: 0,
					centerY: 0,
					perspective: options.kneePerspective ?? 0,
					maxOffset: options.maxKneeOffset ?? 256
				} : null
			};
			if (!["canvas", "viewport"].includes(kneeProjectionCenter)) throw new RangeError("kneeProjectionCenter must be canvas or viewport");
			this.scene = new BeefwifeCanvasScene({
				antialias: options.antialias ?? false,
				application: options.application || null,
				canvas: options.canvas || null,
				filters: options.filters ? Array.from(options.filters) : [],
				imageRendering,
				kneeProjectionCenter,
				maxPixelRatio,
				renderOptions,
				resolutionScale,
				zIndex: options.zIndex || 9e3
			});
			this.debug = debugOf(options.debug);
			const terrainOptions = {};
			for (const [key, value] of Object.entries(options.terrain || {})) if (value !== void 0) terrainOptions[key] = value;
			terrainOptions.viewport = () => this.scene.viewport;
			this.terrain = new Terrain(terrainOptions);
			this.terrainDebugOptions = {
				edgeMargin: terrainOptions.edgeMargin ?? Terrain.DEFAULTS.edgeMargin,
				obstaclePadding: terrainOptions.obstaclePadding ?? Terrain.DEFAULTS.obstaclePadding
			};
			this.terrainView = {
				bounds: {
					left: 0,
					top: 0,
					right: 0,
					bottom: 0
				},
				rectangles: []
			};
			this.router = new BeefwifeCanvasRouter(this.terrain, () => this.scene.viewport, {
				edgeMargin: this.terrainDebugOptions.edgeMargin,
				random
			});
			this.population = new BeefwifeCanvasPopulation(this.terrain, this.router, {
				cast: options.cast || null,
				castWeights: options.castWeights || null,
				count: options.count,
				random,
				renderOptions: this.scene.renderOptions,
				roam,
				targetMode: options.targetMode,
				wanderDelay: options.wanderDelay
			});
			this.observed = /* @__PURE__ */ new Set();
			this.observerConnected = false;
			this.running = false;
			this.destroyed = false;
			this.frameId = null;
			this.lastTime = 0;
			this.nextPhysicsTime = 0;
			this.nextDrawTime = 0;
			this.rebuildTimer = null;
			this._onResize = () => {
				if (!this.destroyed) this.scheduleRebuild();
			};
			this._onScroll = () => {
				if (!this.destroyed && this.scene.kneeProjectionCenter === "viewport") this.scheduleRebuild();
			};
			this.observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(this._onResize);
		}
		get actors() {
			return this.population.actors;
		}
		start() {
			this._assertActive();
			if (this.running) return this;
			this.scene.attach();
			this.scene.resize();
			if (!this.population.cast) throw new Error("BeefwifeCanvas runtime needs a cast");
			this.rebuild();
			window.addEventListener("resize", this._onResize);
			window.addEventListener("scroll", this._onScroll, { passive: true });
			this.running = true;
			this._resume();
			return this;
		}
		stop() {
			this.running = false;
			this._pause();
			clearTimeout(this.rebuildTimer);
			this.rebuildTimer = null;
			window.removeEventListener("resize", this._onResize);
			window.removeEventListener("scroll", this._onScroll);
			if (this.observer) {
				this.observer.disconnect();
				this.observed.clear();
				this.observerConnected = false;
			}
			return this;
		}
		destroy(options = {}) {
			if (this.destroyed) return null;
			this.stop();
			this.destroyed = true;
			clearTimeout(this.rebuildTimer);
			this.rebuildTimer = null;
			this.population.destroy();
			return this.scene.release(options.preserveRenderer === true);
		}
		add(name) {
			this._assertActive();
			return this.population.add(name);
		}
		remove() {
			this._assertActive();
			this.population.remove();
		}
		clear() {
			this._assertActive();
			this.population.clear();
		}
		setCount(rawCount) {
			this._assertActive();
			this.population.setCount(rawCount);
			return this;
		}
		setTimeScale(timeScale) {
			this._assertActive();
			this.timeScale = timeScaleOf(timeScale);
			return this;
		}
		setTarget(target, actor = null) {
			this._assertActive();
			this.population.setTarget(target, actor);
			return this;
		}
		clearTarget(actor = null) {
			this._assertActive();
			this.population.clearTarget(actor);
			return this;
		}
		setTargetMode(targetMode, actor = null) {
			this._assertActive();
			this.population.setTargetMode(targetMode, actor);
			return this;
		}
		respawn(actor = null) {
			this._assertActive();
			this.population.respawn(actor);
			return this;
		}
		setDebug(flags) {
			this._assertActive();
			const terrainWasVisible = this.debug.terrain;
			this.debug = debugOf(flags, this.debug);
			if (!terrainWasVisible && this.debug.terrain && this.terrain.ready) this._snapshotTerrain([...new Set(this.terrain.avoidElements())]);
			if (this.scene.application) this._draw();
			return this;
		}
		refreshTerrain() {
			this._assertActive();
			this.scene.resize();
			this.rebuild();
			return this;
		}
		scheduleRebuild() {
			this._assertActive();
			clearTimeout(this.rebuildTimer);
			this.rebuildTimer = setTimeout(() => {
				if (!this.running) return;
				this.scene.resize();
				this.rebuild();
			}, config.REBUILD_DELAY);
		}
		/**
		* The page has moved under the actors. It measures the new field and
		* nothing else: no creature is reseated and no plan is touched. A widget
		* appearing over one leaves it out of bounds, which its own steering replans
		* out of, on its own clock. Everything that redraws a plan is per creature,
		* so a page that changes cannot make the whole layer stall on one frame.
		*/
		rebuild() {
			this._assertActive();
			this.terrain.build();
			const elements = [...new Set(this.terrain.avoidElements())];
			if (this.debug.terrain) this._snapshotTerrain(elements);
			if (this.observer && (!this.observerConnected || this._elementsChanged(elements))) {
				this.observer.disconnect();
				if (!this.scene.ownsCanvas) this.observer.observe(this.scene.canvas);
				elements.forEach((el) => this.observer.observe(el));
				this.observed = new Set(elements);
				this.observerConnected = true;
			}
			this.population.spawnPending();
		}
		_elementsChanged(elements) {
			if (elements.length !== this.observed.size) return true;
			return elements.some((el) => !this.observed.has(el));
		}
		_snapshotTerrain(elements) {
			const viewport = this.scene.viewport;
			const margin = this.terrainDebugOptions.edgeMargin;
			const padding = this.terrainDebugOptions.obstaclePadding;
			const x0 = Math.min(margin, viewport.width / 2);
			const y0 = Math.min(margin, viewport.height / 2);
			this.terrainView.bounds = {
				left: x0,
				top: y0,
				right: viewport.width - x0,
				bottom: viewport.height - y0
			};
			this.terrainView.rectangles = elements.map((element) => {
				const rect = element.getBoundingClientRect();
				return {
					left: rect.left - viewport.left - padding,
					top: rect.top - viewport.top - padding,
					right: rect.right - viewport.left + padding,
					bottom: rect.bottom - viewport.top + padding
				};
			});
		}
		_assertActive() {
			if (this.destroyed) throw new Error("BeefwifeCanvasRuntime has been destroyed");
		}
		_resume() {
			if (this.frameId !== null) return;
			this.lastTime = 0;
			this.nextPhysicsTime = 0;
			this.nextDrawTime = 0;
			this.frameId = requestAnimationFrame(this._tick);
		}
		_pause() {
			if (this.frameId === null) return;
			cancelAnimationFrame(this.frameId);
			this.frameId = null;
			this.nextPhysicsTime = 0;
			this.nextDrawTime = 0;
		}
		_tick = (time) => {
			this.frameId = requestAnimationFrame(this._tick);
			let dt = 0;
			if (!this.physicsInterval) {
				dt = this.lastTime ? Math.min((time - this.lastTime) / 1e3, config.MAX_DT) : 0;
				this.lastTime = time;
			} else if (!this.nextPhysicsTime) this.nextPhysicsTime = time + this.physicsInterval;
			else if (time >= this.nextPhysicsTime - 1e-7) {
				const elapsedIntervals = Math.floor(Math.max(0, time - this.nextPhysicsTime) / this.physicsInterval) + 1;
				this.nextPhysicsTime += elapsedIntervals * this.physicsInterval;
				dt = Math.min(elapsedIntervals * this.physicsInterval / 1e3, config.MAX_DT);
			}
			if (this.terrain.ready && dt > 0) this.population.update(dt, this.timeScale);
			if (!this.renderInterval) this._draw();
			else if (!this.nextDrawTime || time >= this.nextDrawTime) {
				if (!this.nextDrawTime) this.nextDrawTime = time;
				const elapsedIntervals = Math.floor((time - this.nextDrawTime) / this.renderInterval) + 1;
				this.nextDrawTime += elapsedIntervals * this.renderInterval;
				this._draw();
			}
		};
		_draw = () => draw({
			actors: this.population.renderState(),
			debug: this.debug,
			scene: this.scene,
			terrainView: this.terrainView
		});
	};

//#endregion
//#region src/canvas.mjs
/** Declarative, author-placed canvas host for terrain-routed Beefwives. */
	var controllers = /* @__PURE__ */ new WeakMap();
	var renderers = /* @__PURE__ */ new WeakMap();
	var dispatch = (canvas, type, detail) => canvas.dispatchEvent(new CustomEvent(type, { detail }));
	var Controller = class {
		constructor(canvas, supplied) {
			if (!canvas || canvas.tagName !== "CANVAS") throw new TypeError("BeefwifeCanvas.mount needs a canvas element");
			this.canvas = canvas;
			this.supplied = supplied;
			this.options = null;
			this.host = null;
			this.destroyed = false;
			this.wantsToRun = false;
			this.inView = true;
			this.abortController = new AbortController();
			this.handles = /* @__PURE__ */ new Map();
			this.nextId = 1;
			this.originalImageRendering = canvas.style.imageRendering;
			this._onClick = (event) => {
				if (this.options?.pointerInput !== "click" || !this.host) return;
				this.setTarget(this._pointerPoint(event));
			};
			this._onPointerMove = (event) => {
				if (this.options?.pointerInput === "move" && this.host) this.setTarget(this._pointerPoint(event));
			};
			this._onVisibilityChange = () => this._syncRunning();
			this.resizeObserver = null;
			this.intersectionObserver = null;
			this._state("loading");
		}
		async initialize() {
			try {
				this.options = optionsOf$1(this.canvas, this.supplied);
				this.supplied = null;
				this.wantsToRun = this.options.autoStart;
				this._connectCanvas();
				const { cast, castWeights } = await loadCast(this.options, this.abortController.signal);
				if (this.destroyed) return this;
				const filters = [...this.options.filters || []];
				const count = this.options.count ?? Object.keys(cast).length;
				const reusable = renderers.get(this.canvas);
				if (reusable && reusable.antialias !== this.options.antialias) throw new Error("antialias cannot change when remounting one canvas");
				this.host = await BeefwifeCanvasRuntime.create({
					antialias: this.options.antialias,
					application: reusable?.application,
					canvas: this.canvas,
					cast,
					castWeights,
					count,
					debug: {
						routes: this.options.debugRoutes,
						targets: this.options.debugTargets,
						terrain: this.options.debugTerrain
					},
					filters,
					imageRendering: this.options.imageRendering,
					kneePerspective: this.options.kneePerspective,
					kneeProjectionCenter: this.options.kneeProjectionCenter,
					maxKneeOffset: this.options.maxKneeOffset,
					maxPixelRatio: this.options.maxPixelRatio,
					physicsFps: this.options.simulationFps,
					random: this.options.random,
					renderFps: this.options.drawFps,
					resolutionScale: this.options.resolutionScale,
					roam: roamOf(this.options),
					roundVertices: this.options.roundVertices,
					targetMode: this.options.targetMode,
					terrain: terrainOf(this.options),
					timeScale: this.options.timeScale,
					wanderDelay: this.options.wanderDelay
				});
				if (this.destroyed) {
					this._preserveHost();
					return this;
				}
				renderers.delete(this.canvas);
				this._state("ready");
				dispatch(this.canvas, "beefwifecanvasready", { controller: this.facade });
				this._syncRunning();
				return this;
			} catch (error) {
				if (this.destroyed || error.name === "AbortError") return this;
				this.destroy("error", () => dispatch(this.canvas, "beefwifecanvaserror", {
					controller: this.facade,
					error
				}));
				throw error;
			}
		}
		start() {
			this._assertActive();
			this.wantsToRun = true;
			this._syncRunning();
			return this;
		}
		stop() {
			this._assertActive();
			this.wantsToRun = false;
			this.host?.stop();
			if (this.host) this._state("stopped");
			return this;
		}
		setCount(count) {
			this._host().setCount(count);
			return this;
		}
		setTimeScale(timeScale) {
			this._host().setTimeScale(timeScale);
			return this;
		}
		setDebug(debug) {
			this._host().setDebug(debug);
			for (const [key, enabled] of Object.entries(debug)) {
				const option = `debug${key[0].toUpperCase()}${key.slice(1)}`;
				if (option in this.options) this.options[option] = enabled;
			}
			return this;
		}
		setTarget(target) {
			this._host().setTarget(target);
			return this;
		}
		clearTarget() {
			this._host().clearTarget();
			return this;
		}
		setTargetMode(targetMode) {
			this._host().setTargetMode(targetMode);
			this.options.targetMode = targetMode;
			return this;
		}
		setPointerInput(pointerInput) {
			if (![
				"none",
				"click",
				"move"
			].includes(pointerInput)) throw new RangeError("pointerInput must be none, click, or move");
			this.options.pointerInput = pointerInput;
			return this;
		}
		refreshTerrain() {
			this._host().refreshTerrain();
			return this;
		}
		respawn() {
			this._host().respawn();
			return this;
		}
		getActors() {
			const host = this._host();
			const active = new Set(host.actors);
			for (const actor of this.handles.keys()) if (!active.has(actor)) this.handles.delete(actor);
			return host.actors.map((actor) => {
				let handle = this.handles.get(actor);
				if (!handle) {
					const id = this.nextId++;
					handle = Object.freeze({
						id,
						name: actor.name,
						clearTarget: () => {
							this._host().clearTarget(actor);
							return handle;
						},
						getPose: () => {
							this._host();
							return actor.beefwife.getPose();
						},
						respawn: () => {
							this._host().respawn(actor);
							return handle;
						},
						setDescriptor: (descriptor) => {
							this._host();
							actor.setDescriptor(descriptor);
							return handle;
						},
						setTarget: (target) => {
							this._host().setTarget(target, actor);
							return handle;
						},
						setTargetMode: (targetMode) => {
							this._host().setTargetMode(targetMode, actor);
							return handle;
						}
					});
					this.handles.set(actor, handle);
				}
				return handle;
			});
		}
		destroy(finalState = "destroyed", beforeRelease) {
			if (this.destroyed) return;
			this.destroyed = true;
			this.abortController.abort();
			this.canvas.removeEventListener("click", this._onClick);
			this.canvas.removeEventListener("pointermove", this._onPointerMove);
			document.removeEventListener("visibilitychange", this._onVisibilityChange);
			this.resizeObserver?.disconnect();
			this.intersectionObserver?.disconnect();
			this._preserveHost();
			this.handles.clear();
			this.canvas.style.imageRendering = this.originalImageRendering;
			this._state(finalState);
			try {
				if (beforeRelease) beforeRelease();
			} finally {
				controllers.delete(this.canvas);
			}
		}
		_connectCanvas() {
			this.canvas.addEventListener("click", this._onClick);
			this.canvas.addEventListener("pointermove", this._onPointerMove);
			if (this.options.pauseHidden) document.addEventListener("visibilitychange", this._onVisibilityChange);
			this.resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => this._canvasResized());
			this.resizeObserver?.observe(this.canvas);
			this.intersectionObserver = this.options.pauseOffscreen && typeof IntersectionObserver !== "undefined" ? new IntersectionObserver((entries) => {
				this.inView = entries[0]?.isIntersecting ?? true;
				this._syncRunning();
			}) : null;
			this.intersectionObserver?.observe(this.canvas);
		}
		_canvasResized() {
			if (this.destroyed || !this.host) return;
			const rect = this.canvas.getBoundingClientRect();
			if (rect.width > 0 && rect.height > 0) this.host.scheduleRebuild();
			this._syncRunning();
		}
		_pointerPoint(event) {
			const rect = this.canvas.getBoundingClientRect();
			return {
				x: event.clientX - rect.left,
				y: event.clientY - rect.top
			};
		}
		_preserveHost() {
			if (!this.host) return;
			const application = this.host.destroy({ preserveRenderer: true });
			if (application) renderers.set(this.canvas, {
				antialias: this.options.antialias,
				application
			});
			this.host = null;
		}
		_syncRunning() {
			if (!this.host || this.destroyed) return;
			const rect = this.canvas.getBoundingClientRect();
			const visible = rect.width > 0 && rect.height > 0;
			if (!this.wantsToRun) {
				this.host.stop();
				this._state("stopped");
			} else if (this.options.pauseHidden && document.hidden) {
				this.host.stop();
				this._state("paused", "hidden");
			} else if (!visible) {
				this.host.stop();
				this._state("paused", "zero-size");
			} else if (!this.inView) {
				this.host.stop();
				this._state("paused", "offscreen");
			} else {
				this.host.start();
				this._state("running");
			}
		}
		_host() {
			this._assertActive();
			if (!this.host) throw new Error("BeefwifeCanvas is not ready");
			return this.host;
		}
		_assertActive() {
			if (this.destroyed) throw new Error("BeefwifeCanvas has been destroyed");
		}
		_state(state, pauseReason = null) {
			this.canvas.dataset.beefwifeState = state;
			if (pauseReason) this.canvas.dataset.beefwifePauseReason = pauseReason;
			else delete this.canvas.dataset.beefwifePauseReason;
		}
	};
	var facadeOf = (controller) => {
		const facade = Object.freeze({
			canvas: controller.canvas,
			get state() {
				return controller.canvas.dataset.beefwifeState;
			},
			get pauseReason() {
				return controller.canvas.dataset.beefwifePauseReason || null;
			},
			get ready() {
				return controller.ready;
			},
			start() {
				controller.start();
				return facade;
			},
			stop() {
				controller.stop();
				return facade;
			},
			destroy() {
				controller.destroy();
			},
			setCount(count) {
				controller.setCount(count);
				return facade;
			},
			setTimeScale(timeScale) {
				controller.setTimeScale(timeScale);
				return facade;
			},
			setDebug(debug) {
				controller.setDebug(debug);
				return facade;
			},
			setTarget(target) {
				controller.setTarget(target);
				return facade;
			},
			clearTarget() {
				controller.clearTarget();
				return facade;
			},
			setTargetMode(targetMode) {
				controller.setTargetMode(targetMode);
				return facade;
			},
			setPointerInput(pointerInput) {
				controller.setPointerInput(pointerInput);
				return facade;
			},
			refreshTerrain() {
				controller.refreshTerrain();
				return facade;
			},
			respawn() {
				controller.respawn();
				return facade;
			},
			getActors() {
				return controller.getActors();
			}
		});
		return facade;
	};
	var mount = (canvas, options = {}) => {
		if (controllers.has(canvas)) return Promise.reject(/* @__PURE__ */ new Error("canvas already has a BeefwifeCanvas"));
		let controller;
		try {
			controller = new Controller(canvas, options);
		} catch (error) {
			return Promise.reject(error);
		}
		controller.facade = facadeOf(controller);
		controllers.set(canvas, controller);
		controller.ready = controller.initialize().then(() => controller.facade);
		return controller.ready;
	};
	var autoMount = () => {
		document.querySelectorAll("canvas[data-beefwife-canvas]").forEach((canvas) => {
			if (!controllers.has(canvas)) mount(canvas).catch(() => {});
		});
	};
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoMount, { once: true });
	else queueMicrotask(autoMount);
	var BeefwifeCanvas = {
		Descriptor: descriptor_exports,
		get: (canvas) => controllers.get(canvas)?.facade || null,
		mount,
		scan: autoMount
	};

//#endregion
return BeefwifeCanvas;
})(globalThis.PIXI);
if (typeof module !== "undefined" && module.exports) module.exports = BeefwifeCanvas;