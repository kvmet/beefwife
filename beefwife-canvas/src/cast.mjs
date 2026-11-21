/** Descriptor and cast loading for BeefwifeCanvas. */

import { Descriptor } from "../../beefwife/src/beefwife.mjs";

const responseJson = async (url, signal) => {
  const response = await fetch(url, { cache: "no-cache", signal });
  if (!response.ok) {
    // HTTP/2 responses carry no status text.
    const status = [response.status, response.statusText].filter(Boolean);
    throw new Error(`cast: could not fetch ${url} (HTTP ${status.join(" ")})`);
  }
  return response.json();
};

const weightOf = (value, path) => {
  const weight = value ?? 1;
  if (!Number.isFinite(weight) || weight <= 0)
    throw new RangeError(
      `${path}.weight: must be a finite number greater than 0 (got ${weight})`,
    );
  return weight;
};

const guaranteedOf = (value, path) => {
  const guaranteed = value ?? true;
  if (typeof guaranteed !== "boolean")
    throw new TypeError(`${path}.guaranteed: must be true or false`);
  return guaranteed;
};

const weightedSource = (value, baseUrl, path) => {
  if (typeof value === "string")
    return { src: new URL(value, baseUrl).href, weight: 1, guaranteed: true };
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new TypeError(
      `${path}: must be a URL string or a { src, weight, guaranteed } object`,
    );
  for (const key of Object.keys(value)) {
    if (!["src", "weight", "guaranteed"].includes(key))
      throw new TypeError(`${path}.${key}: is not a known field`);
  }
  if (typeof value.src !== "string" || !value.src)
    throw new TypeError(`${path}.src: must be a non-empty URL string`);
  return {
    src: new URL(value.src, baseUrl).href,
    weight: weightOf(value.weight, path),
    guaranteed: guaranteedOf(value.guaranteed, path),
  };
};

const manifestSources = async (manifest, signal) => {
  let value = manifest;
  let baseUrl = document.baseURI;
  if (typeof manifest === "string") {
    const url = new URL(manifest, document.baseURI).href;
    value = await responseJson(url, signal);
    baseUrl = url;
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new TypeError("manifest: must be an object");
  for (const key of Object.keys(value)) {
    if (key !== "schemaVersion" && key !== "sources")
      throw new TypeError(`manifest.${key}: is not a known field`);
  }
  if (value.schemaVersion !== 1)
    throw new TypeError(
      `manifest.schemaVersion: must be 1 (got ${JSON.stringify(value.schemaVersion)})`,
    );
  if (!Array.isArray(value.sources) || !value.sources.length)
    throw new TypeError(
      "manifest.sources: must be an array with at least one source",
    );
  return value.sources.map((source, index) =>
    weightedSource(source, baseUrl, `manifest.sources[${index}]`),
  );
};

const descriptorEntry = (value, path) => {
  if (value?.descriptor === undefined)
    return { descriptor: Descriptor.read(value), weight: 1, guaranteed: true };
  for (const key of Object.keys(value)) {
    if (!["descriptor", "weight", "guaranteed"].includes(key))
      throw new TypeError(`${path}.${key}: is not a known field`);
  }
  return {
    descriptor: Descriptor.read(value.descriptor),
    weight: weightOf(value.weight, path),
    guaranteed: guaranteedOf(value.guaranteed, path),
  };
};

const loadCast = async (options, signal) => {
  const sources = [];
  if (options.manifest)
    sources.push(...(await manifestSources(options.manifest, signal)));
  if (options.sources) {
    const list = Array.isArray(options.sources)
      ? options.sources
      : [options.sources];
    list.forEach((source, index) =>
      sources.push(
        weightedSource(source, document.baseURI, `options.sources[${index}]`),
      ),
    );
  }
  const entries = [];
  if (options.descriptors) {
    const list = Array.isArray(options.descriptors)
      ? options.descriptors
      : [options.descriptors];
    list.forEach((descriptor, index) =>
      entries.push(
        descriptorEntry(descriptor, `options.descriptors[${index}]`),
      ),
    );
  }
  const fetched = await Promise.all(
    sources.map(async ({ src, weight, guaranteed }) => ({
      descriptor: Descriptor.read(await responseJson(src, signal)),
      weight,
      guaranteed,
    })),
  );
  entries.push(...fetched);
  if (!entries.length)
    throw new TypeError("cast: needs a manifest, sources, or descriptors");
  const cast = Object.create(null);
  const castWeights = Object.create(null);
  const castGuaranteed = Object.create(null);
  for (const entry of entries) {
    const name = entry.descriptor.name;
    if (cast[name])
      throw new TypeError(
        `cast: two descriptors are named ${JSON.stringify(name)}; names must be unique`,
      );
    cast[name] = entry.descriptor;
    castWeights[name] = entry.weight;
    castGuaranteed[name] = entry.guaranteed;
  }
  return { cast, castWeights, castGuaranteed };
};

export { loadCast };
