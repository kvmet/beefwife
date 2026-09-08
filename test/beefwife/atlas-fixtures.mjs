/** Distinct shape and paint pairs exhaust atlas area without large body bounds. */
export const crowdedDescriptor = (source) => {
  const crowded = structuredClone(source);
  crowded.legs.pairs = 2;
  const ornament = crowded.chain.skin.ornaments[0];
  crowded.chain.skin.ornaments = [];
  const shapeIds = Object.keys(crowded.definitions.shapes);
  for (let paint = 0; paint < 128; paint++) {
    const id = `colour${paint}`;
    crowded.definitions.paints[id] = {
      fill: `#${(0x100000 + paint * 1024).toString(16)}`,
      stroke: { colour: "#ffffff", width: 0.5 },
    };
    for (let shape = 0; shape < 4; shape++)
      crowded.chain.skin.ornaments.push({
        ...structuredClone(ornament),
        id: `part${paint}_${shape}`,
        shape: shapeIds[shape],
        paint: id,
        side: paint % 2 ? "left" : "right",
        layer: shape % 2 ? "under" : "over",
        scale: 100,
        repeat: { count: 1, step: 1 },
      });
  }
  return crowded;
};
