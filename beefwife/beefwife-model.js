/**
 * Compiles a validated descriptor into immutable runtime topology. This is a
 * private seam: callers keep the descriptor while physics consumes resolved
 * chunks, links, sections, and visual placements.
 */

const BeefwifeModel = (() => {
  const Descriptor =
    typeof BeefwifeDescriptor !== "undefined"
      ? BeefwifeDescriptor
      : typeof module !== "undefined" && module.exports
        ? require("./beefwife-descriptor.js")
        : null;
  if (!Descriptor)
    throw new Error("BeefwifeDescriptor must load before BeefwifeModel");
  const SECTION_NAMES = ["head", "trunk", "tail"];
  const MAX_BREATHING_STRAIN = 0.1;
  const BREATHING_RATE_AT_100_PX = 0.2;

  const freeze = (value) => {
    if (!value || typeof value !== "object" || Object.isFrozen(value))
      return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  };

  const lerp = (start, end, t) => start + (end - start) * t;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const profileAt = (span, index, count) =>
    count === 1
      ? (span.start + span.end) / 2
      : lerp(span.start, span.end, index / (count - 1));

  const spatialAngle = (gait, channel, distance) =>
    channel.phaseOffset -
    channel.harmonic * distance * gait.phaseLagRadiansPerPixel;

  const breathingRateFor = (trunkLength) =>
    clamp(BREATHING_RATE_AT_100_PX * Math.sqrt(100 / trunkLength), 0.1, 0.4);

  const placementChunks = (placement, sections, chunkCount) => {
    const section = placement.at.section;
    const scope = section ? sections[section] : { start: 0, count: chunkCount };
    const direction = placement.at.from === "head" ? 1 : -1;
    const localStart =
      direction > 0
        ? placement.at.offset
        : scope.count - 1 - placement.at.offset;
    const available =
      Math.floor(
        (scope.count - 1 - placement.at.offset) / placement.repeat.step,
      ) + 1;
    const count = placement.repeat.count ?? available;
    return Array.from(
      { length: count },
      (_, index) =>
        scope.start + localStart + direction * index * placement.repeat.step,
    );
  };

  const compile = (value) => {
    const descriptor = Descriptor.read(value);
    const sectionSpecs = descriptor.chain.sections;
    const sections = {};
    const chunks = [];

    SECTION_NAMES.forEach((name) => {
      const spec = sectionSpecs[name];
      const start = chunks.length;
      const material = descriptor.definitions.materials[spec.material];
      for (let localIndex = 0; localIndex < spec.chunks; localIndex++) {
        chunks.push({
          index: chunks.length,
          section: name,
          localIndex,
          restDistance: 0,
          materialId: spec.material,
          material,
          motionScale: spec.motionScale,
          bendScale: 0,
          ribbonWidth: profileAt(
            spec.profile.ribbonWidth,
            localIndex,
            spec.chunks,
          ),
          plateScale: profileAt(
            spec.profile.plateScale,
            localIndex,
            spec.chunks,
          ),
        });
      }
      sections[name] = {
        name,
        start,
        end: chunks.length,
        count: spec.chunks,
        spacing: spec.spacing,
        materialId: spec.material,
        material,
        motionScale: spec.motionScale,
        profile: spec.profile,
      };
    });

    const trunkLength =
      sections.trunk.spacing * Math.max(1, sections.trunk.count - 1);
    const breathing = {
      strain: descriptor.chain.breathing * MAX_BREATHING_STRAIN,
      cyclesPerSecond: breathingRateFor(trunkLength),
    };
    const links = [];
    let restDistance = 0;
    for (let index = 0; index < chunks.length - 1; index++) {
      const before = chunks[index];
      const after = chunks[index + 1];
      const beforeSection = sections[before.section];
      const afterSection = sections[after.section];
      const boundary = before.section !== after.section;
      const restLength = boundary
        ? (beforeSection.spacing + afterSection.spacing) / 2
        : beforeSection.spacing;
      const linkCorrection =
        (before.material.linkCorrection + after.material.linkCorrection) / 2;
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
        breathingScale:
          before.section === "trunk" && after.section === "trunk"
            ? breathing.strain
            : 0,
      });
    }
    for (let index = 1; index < chunks.length - 1; index++) {
      chunks[index].bendScale =
        (links[index - 1].restLength + links[index].restLength) /
        2 /
        sections.trunk.spacing;
    }
    chunks.forEach((chunk) => {
      const angle = spatialAngle(
        descriptor.gait,
        descriptor.gait.bend,
        chunk.restDistance,
      );
      chunk.bendPhaseSine = Math.sin(angle);
      chunk.bendPhaseCosine = Math.cos(angle);
    });
    links.forEach((link) => {
      const angle = spatialAngle(
        descriptor.gait,
        descriptor.gait.gather,
        link.phaseDistance,
      );
      link.gatherPhaseSine = Math.sin(angle);
      link.gatherPhaseCosine = Math.cos(angle);
    });

    const { shapes, paints } = descriptor.definitions;
    const plates = descriptor.chain.skin.plates.flatMap((placement) =>
      placementChunks(placement, sections, chunks.length).map((chunk) => ({
        id: placement.id,
        chunk,
        shape: shapes[placement.shape],
        paint: paints[placement.paint],
        scale: placement.scale,
      })),
    );
    const ornaments = descriptor.chain.skin.ornaments.flatMap((placement) => {
      const sides =
        placement.side === "both" ? ["left", "right"] : [placement.side];
      return placementChunks(placement, sections, chunks.length).flatMap(
        (chunk) =>
          sides.map((side) => {
            const sideSign = side === "left" ? -1 : 1;
            const angle = (placement.angleDegrees * Math.PI * sideSign) / 180;
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
              length: placement.length,
              sweep: placement.sweep,
              carry: 1 / (1 + placement.sweep),
              snapRate: placement.snapRate,
              dampingRate: placement.dampingRate,
            };
          }),
      );
    });

    return freeze({
      descriptor,
      sections,
      chunks,
      links,
      restLength: restDistance,
      gait: descriptor.gait,
      physics: descriptor.chain.physics,
      breathing,
      skin: {
        scale: descriptor.appearance.scale,
        loadScale: descriptor.chain.skin.loadScale,
        hasRibbon: chunks.some((chunk) => chunk.ribbonWidth > 0),
        ribbonPaintId: descriptor.chain.skin.ribbon.paint,
        ribbonPaint: paints[descriptor.chain.skin.ribbon.paint],
        plates,
        platesTailFirst: [...plates].sort(
          (before, after) => after.chunk - before.chunk,
        ),
        ornaments,
      },
      legs: {
        ...descriptor.legs,
        start: sections[descriptor.legs.section].start,
        end: sections[descriptor.legs.section].end,
        skin: {
          limbPaint: paints[descriptor.legs.skin.limbPaint],
          limbWidth: descriptor.legs.skin.limbWidth,
          foot: {
            shape: shapes[descriptor.legs.skin.foot.shape],
            paint: paints[descriptor.legs.skin.foot.paint],
            scale: descriptor.legs.skin.foot.scale,
            plantedScale: descriptor.legs.skin.foot.plantedScale,
          },
        },
      },
    });
  };

  return Object.freeze({ compile });
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = BeefwifeModel;
}
