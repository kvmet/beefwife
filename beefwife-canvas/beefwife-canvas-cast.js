/** Descriptor and cast loading for BeefwifeCanvas. */

const BeefwifeCanvasCast = (() => {
  const responseJson = async (url, signal) => {
    const response = await fetch(url, { cache: "no-cache", signal });
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    return response.json();
  };

  const weightedSource = (value, baseUrl, path) => {
    if (typeof value === "string")
      return { src: new URL(value, baseUrl).href, weight: 1 };
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new TypeError(`${path} must be a URL or source object`);
    for (const key of Object.keys(value)) {
      if (key !== "src" && key !== "weight")
        throw new TypeError(`${path}.${key} is unknown`);
    }
    if (typeof value.src !== "string" || !value.src)
      throw new TypeError(`${path}.src must be a URL`);
    const weight = value.weight ?? 1;
    if (!Number.isFinite(weight) || weight <= 0)
      throw new RangeError(`${path}.weight must be positive`);
    return { src: new URL(value.src, baseUrl).href, weight };
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
      throw new TypeError("manifest must be an object");
    for (const key of Object.keys(value)) {
      if (key !== "schemaVersion" && key !== "sources")
        throw new TypeError(`manifest.${key} is unknown`);
    }
    if (value.schemaVersion !== 1)
      throw new TypeError("manifest.schemaVersion must be 1");
    if (!Array.isArray(value.sources) || !value.sources.length)
      throw new TypeError("manifest.sources must be a nonempty array");
    return value.sources.map((source, index) =>
      weightedSource(source, baseUrl, `manifest.sources[${index}]`),
    );
  };

  const descriptorEntry = (value, path) => {
    let descriptor = value;
    let weight = 1;
    if (value?.descriptor !== undefined) {
      for (const key of Object.keys(value)) {
        if (key !== "descriptor" && key !== "weight")
          throw new TypeError(`${path}.${key} is unknown`);
      }
      descriptor = value.descriptor;
      weight = value.weight ?? 1;
    }
    if (!Number.isFinite(weight) || weight <= 0)
      throw new RangeError(`${path}.weight must be positive`);
    return { descriptor: BeefwifeDescriptor.read(descriptor), weight };
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
      sources.map(async ({ src, weight }) => ({
        descriptor: BeefwifeDescriptor.read(await responseJson(src, signal)),
        weight,
      })),
    );
    entries.push(...fetched);
    if (!entries.length)
      throw new TypeError("provide manifest, sources, or descriptors");
    const cast = Object.create(null);
    const castWeights = Object.create(null);
    for (const entry of entries) {
      const name = entry.descriptor.name;
      if (cast[name]) throw new TypeError(`duplicate beefwife name: ${name}`);
      cast[name] = entry.descriptor;
      castWeights[name] = entry.weight;
    }
    return { cast, castWeights };
  };

  return { loadCast };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = BeefwifeCanvasCast;
}
