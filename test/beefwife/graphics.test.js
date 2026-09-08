/**
 * Does Beefwife own one retained Pixi scene with the promised overlap order?
 * A minimal Pixi implementation is the control. The shapes draw as particles
 * out of a baked atlas, so what is held here is the scene: the order of the
 * bands, which placement each particle answers to, and the transform written
 * onto it. What a frame is drawn from belongs to `atlas.test.js`. Fails if
 * feet cover limbs, meshes rebuild instead of updating, a replacement
 * discards a display object it could have kept, an invalid resource mutates
 * the instance, or destruction leaves owned display objects alive.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { PIXI, pointsOf } = require("./pixi.js");
const { Container, Mesh, ParticleContainer } = PIXI;
const { Beefwife, Descriptor } = require("../../beefwife/src/beefwife.mjs");
const Model = require("../../beefwife/src/model.mjs");
const source = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "..", "beefwife", "beefwife.example.json"),
    "utf8",
  ),
);
const copy = (value) => JSON.parse(JSON.stringify(value));
// The creature's own parts, which are one container down from the Beefwife.
const partsOf = (beefwife) => beefwife.children[0].children;
const bandsOf = (beefwife) =>
  new Map(
    partsOf(beefwife)
      .filter((child) => child instanceof ParticleContainer)
      .map((child) => [child.label, child]),
  );
const particlesOf = (beefwife, label) =>
  bandsOf(beefwife).get(label)?.particleChildren ?? [];
/* Baking is the only step that wants a GPU, and it rasterises what the plan
   already decided. Standing in for the renderer leaves the whole scene under
   test. */
(async () => {
  const stubRenderer = { render() {} };
  /* The bake waits for the pass to end, so a draw is not finished until the
     microtask it books has run. */
  const draw = async (beefwife) => {
    beefwife.onRender(stubRenderer);
    await Promise.resolve();
  };
  let checks = 0;

  const oversized = copy(source);
  oversized.chain.skin.plates[1].scale = 100;
  assert.throws(() => new Beefwife(oversized), /past the 2048 limit/);
  const unchanged = new Beefwife(copy(source), { random: () => 0.5 });
  await draw(unchanged);
  const originalDescriptor = unchanged.descriptor;
  const originalParts = [...partsOf(unchanged)];
  assert.throws(
    () => unchanged.setDescriptor(oversized),
    /past the 2048 limit/,
  );
  assert.equal(unchanged.descriptor, originalDescriptor);
  assert.deepEqual(partsOf(unchanged), originalParts);
  await draw(unchanged);
  assert.deepEqual(partsOf(unchanged), originalParts);
  unchanged.destroy();
  checks += 5;

  const centipede = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../../beefwife/samples/chevron-guy.json"),
      "utf8",
    ),
  );
  const growing = new Beefwife(copy(centipede), {
    random: () => 0.5,
    render: { pixelResolution: 0.5 },
  });
  let enlarged = centipede;
  for (let click = 0; click < 6; click++) {
    enlarged = Descriptor.scale(enlarged, 1.25);
    growing.setDescriptor(enlarged);
    await draw(growing);
    const plates = particlesOf(growing, "plates");
    assert.equal(
      plates.length,
      Model.compile(enlarged).skin.platesTailFirst.length,
    );
    assert.ok(plates.every((particle) => particle.scaleX <= 1 + 1e-9));
    const beforeMove = plates.map(({ x }) => x);
    growing.translate({ x: 100, y: 0 });
    await draw(growing);
    assert.ok(
      plates.every(
        (particle, index) =>
          Math.abs(particle.x - beforeMove[index] - 100) < 1e-8,
      ),
    );
    checks += 3;
  }
  const firstSource = particlesOf(growing, "plates")[0].texture.source;
  const secondRenderer = { render() {} };
  const oldBands = [...bandsOf(growing).values()];
  growing.onRender(secondRenderer);
  assert.ok(oldBands.every((band) => !band.visible && !band.destroyed));
  await Promise.resolve();
  assert.notEqual(
    particlesOf(growing, "plates")[0].texture.source,
    firstSource,
  );
  assert.equal(firstSource.destroyed, true);
  assert.ok([...bandsOf(growing).values()].every((band) => band.visible));
  checks += 2;
  growing.destroy();
  checks += 2;

  const failing = new Beefwife(copy(source));
  const bakeFailure = new Error("texture render failed");
  const reported = [];
  failing.on("error", (error) => reported.push(error));
  let attempted = 0;
  let failedTarget;
  let failedContext;
  const failingRenderer = {
    render({ target, container }) {
      attempted++;
      failedTarget = target.source;
      failedContext = container.context;
      throw bakeFailure;
    },
  };
  failing.onRender(failingRenderer);
  await Promise.resolve();
  assert.deepEqual(reported, [bakeFailure]);
  assert.equal(failedTarget.destroyed, true);
  assert.equal(failedContext.destroyed, true);
  failing.onRender(failingRenderer);
  await Promise.resolve();
  assert.equal(attempted, 1, "failed atlas retried every frame");
  await draw(failing);
  assert.ok(particlesOf(failing, "plates").length > 0);
  failing.destroy();
  checks += 5;

  const legged = copy(source);
  legged.legs.pairs = 3;
  const beefwife = new Beefwife(legged, { random: () => 0.5 });
  assert.ok(beefwife instanceof Container);
  assert.equal(beefwife.label, legged.name);
  assert.equal(typeof beefwife.onRender, "function");
  checks += 3;

  /* Frames come from a renderer, and the first one arrives with Pixi's own
     render callback, so a creature that has never been drawn holds its meshes
     and no shapes at all. */
  assert.equal(bandsOf(beefwife).size, 0);
  assert.equal(
    partsOf(beefwife).filter((child) => child instanceof Mesh).length,
    2,
  );
  await draw(beefwife);
  checks += 2;

  const footCount = legged.legs.pairs * 2;
  const skinOf = (descriptor) => Model.compile(descriptor).skin;
  assert.equal(particlesOf(beefwife, "feet").length, footCount);
  assert.equal(
    particlesOf(beefwife, "plates").length,
    skinOf(legged).platesTailFirst.length,
  );
  const meshIndexes = partsOf(beefwife)
    .map((child, index) => (child instanceof Mesh ? index : -1))
    .filter((index) => index >= 0);
  // One band of feet stands ahead of the limb mesh, whatever the pair count.
  assert.equal(meshIndexes[0], 1);
  assert.equal(meshIndexes.length, 2);
  assert.ok(meshIndexes[1] > meshIndexes[0]);
  checks += 4;

  const meshes = partsOf(beefwife).filter((child) => child instanceof Mesh);
  const buffers = meshes.map((mesh) => mesh.positionBuffer);
  /* Pixi counts buffer uploads in `_updateID`. Exactly one per render pass says
     the vertices reach the GPU once, neither skipped nor written twice. */
  const uploads = buffers.map((buffer) => buffer._updateID);
  const children = [...partsOf(beefwife)];
  beefwife.step(1 / 60);
  await draw(beefwife);
  assert.deepEqual(partsOf(beefwife), children);
  assert.deepEqual(
    buffers.map((buffer) => buffer._updateID),
    uploads.map((id) => id + 1),
  );
  checks += 2;

  /* A foot plants at `plantedScale` and swings at 1, and its frame is baked at
     the larger, so the particle scales down to draw and never up. Mirroring is
     the sign on the vertical, as it was on the child's own scale. */
  const feet = particlesOf(beefwife, "feet");
  assert.ok(feet.every((foot) => Math.abs(foot.scaleX) <= 1 + 1e-9));
  assert.ok(feet.every((foot) => Math.abs(foot.scaleY) === foot.scaleX));
  assert.ok(feet.some((foot) => foot.scaleY < 0));
  assert.ok(feet.every((foot) => Number.isFinite(foot.rotation)));
  checks += 4;

  const invalidPaint = copy(legged);
  invalidPaint.definitions.paints.shell.fill = "notacolor";
  assert.throws(() => beefwife.setDescriptor(invalidPaint), /shell\.fill/);
  assert.equal(
    beefwife.descriptor.definitions.paints.shell.fill,
    legged.definitions.paints.shell.fill,
  );
  checks += 2;

  /* Colour is baked into a frame rather than tinted onto a particle, because one
     tint cannot recolour a fill and an outline apart. Repainting therefore
     re-bakes, and what has to survive is the body: the meshes stay, and so does
     every particle's placement. */
  const recolored = copy(legged);
  recolored.definitions.paints.shell.fill = "#123456";
  beefwife.setDescriptor(recolored);
  await draw(beefwife);
  assert.equal(beefwife.descriptor.definitions.paints.shell.fill, "#123456");
  assert.ok(meshes.every((mesh) => !mesh.destroyed));
  assert.equal(particlesOf(beefwife, "feet").length, footCount);
  assert.equal(
    particlesOf(beefwife, "plates").length,
    skinOf(recolored).platesTailFirst.length,
  );
  checks += 4;

  /* Changing what the scene is made of keeps every part that still fits, so a
     chunk count edit replaces the ribbon mesh and leaves the limbs. */
  const meshesOf = () =>
    partsOf(beefwife).filter((child) => child instanceof Mesh);
  const restructured = copy(recolored);
  restructured.chain.sections.tail.chunks += 1;
  restructured.chain.skin.plates[1].repeat.count = null;
  beefwife.setDescriptor(restructured);
  await draw(beefwife);
  assert.equal(meshesOf()[0], meshes[0]);
  assert.ok(meshes[1].destroyed);
  assert.equal(partsOf(beefwife).indexOf(meshes[1]), -1);
  assert.ok(partsOf(beefwife).every((child) => !child.destroyed));
  checks += 4;

  /* A leg pair is one strip of the limb mesh, so adding one replaces that mesh
     and the ribbon it draws over survives. The feet follow the pair count. */
  const morePairs = copy(restructured);
  morePairs.legs.pairs += 1;
  const keptRibbon = meshesOf()[1];
  beefwife.setDescriptor(morePairs);
  await draw(beefwife);
  assert.ok(!keptRibbon.destroyed);
  assert.equal(meshesOf()[1], keptRibbon);
  assert.ok(meshes[0].destroyed);
  assert.equal(particlesOf(beefwife, "feet").length, morePairs.legs.pairs * 2);
  checks += 4;

  /* The bake stands its new particles where the state it was booked from had
     them. It runs between frames, so a cast left for the next sync to place
     draws at the origin whenever an edit lands first, which is every frame of
     a dragged slider. */
  const rescaled = copy(morePairs);
  rescaled.legs.skin.foot.scale *= 2;
  beefwife.setDescriptor(rescaled);
  await draw(beefwife);
  const placed = particlesOf(beefwife, "feet").map(({ x, y }) => [x, y]);
  assert.ok(placed.some(([x, y]) => x !== 0 || y !== 0));
  await draw(beefwife);
  assert.deepEqual(
    particlesOf(beefwife, "feet").map(({ x, y }) => [x, y]),
    placed,
    "the bake left its particles for a later sync to place",
  );
  checks += 2;

  /* Overlap order is the whole promise of the retained scene, and half of it is
     invisible in a scene with no stroke and no under-layer ornament. This one
     carries every kind at once, so a swap anywhere in `_arrange` moves a band
     and fails. */
  const layered = copy(source);
  layered.legs.pairs = 2;
  layered.definitions.paints.leg.stroke = { colour: "#aa0001", width: 1 };
  layered.definitions.paints.ribbon.stroke = { colour: "#aa0002", width: 1 };
  layered.definitions.paints.under = { fill: "#c00001", stroke: null };
  layered.definitions.paints.over = { fill: "#c00002", stroke: null };
  layered.definitions.paints.plate = { fill: "#c00003", stroke: null };
  layered.chain.skin.plates = [
    {
      ...source.chain.skin.plates[0],
      paint: "plate",
      repeat: { count: 1, step: 1 },
    },
  ];
  const oneOrnament = { ...source.chain.skin.ornaments[0], side: "left" };
  layered.chain.skin.ornaments = [
    { ...oneOrnament, id: "beneath", paint: "under", layer: "under" },
    { ...oneOrnament, id: "above", paint: "over", layer: "over" },
  ];
  const stack = new Beefwife(layered, { random: () => 0.5 });
  stack.step(1 / 60);
  await draw(stack);
  const kindOf = (child) =>
    child instanceof Mesh
      ? "mesh"
      : child instanceof ParticleContainer
        ? child.label
        : pointsOf(child).length
          ? "path"
          : "?";
  const ORDER = [
    "feet",
    "mesh",
    "path",
    "ornaments-under",
    "mesh",
    "path",
    "plates",
    "ornaments-over",
  ];
  assert.deepEqual(partsOf(stack).map(kindOf), ORDER);
  assert.equal(particlesOf(stack, "ornaments-under").length, 1);
  assert.equal(particlesOf(stack, "ornaments-over").length, 1);
  checks += 3;

  /* The order has to survive an edit that changes the cast, not just the first
     build: `_arrange` runs again and must put everything back. */
  const restacked = copy(layered);
  restacked.legs.pairs = 3;
  stack.setDescriptor(restacked);
  await draw(stack);
  assert.deepEqual(partsOf(stack).map(kindOf), ORDER);
  assert.equal(particlesOf(stack, "feet").length, 6);
  checks += 2;

  /* Moving an ornament between layers changes the order without changing the
     cast, so an emptied band has to go rather than linger as a broken batch. */
  const flipped = copy(restacked);
  flipped.chain.skin.ornaments[0].layer = "over";
  stack.setDescriptor(flipped);
  await draw(stack);
  assert.deepEqual(partsOf(stack).map(kindOf), [
    "feet",
    "mesh",
    "path",
    "mesh",
    "path",
    "plates",
    "ornaments-over",
  ]);
  assert.equal(particlesOf(stack, "ornaments-over").length, 2);
  checks += 2;

  /* A dropped band must be destroyed, not merely unparented: the scene is
     retained, so anything left alive is a leak nothing will ever collect. It
     must survive the pass that asked for the replacement, though, because
     that pass is still drawing it; freeing it there strands the rest of the
     frame on a texture with no source. */
  const fewer = copy(flipped);
  fewer.chain.skin.ornaments = [];
  const before = [...partsOf(stack)];
  stack.setDescriptor(fewer);
  stack.onRender(stubRenderer);
  assert.ok(
    before.every((child) => !child.destroyed),
    "a replaced band was destroyed inside the pass still drawing it",
  );
  await Promise.resolve();
  const dropped = before.filter((child) => !partsOf(stack).includes(child));
  assert.ok(dropped.length > 0);
  assert.ok(
    dropped.every((child) => child.destroyed),
    "a replaced band outlived the pass that held it",
  );
  assert.equal(bandsOf(stack).has("ornaments-over"), false);
  checks += 4;

  /* A host may add its own children to a Beefwife, and settling the parts' draw
     order re-adds every one of them, which would move each past a marker that
     was already there. The parts hold a container of their own so that the
     marker keeps the place the host gave it. */
  const marker = stack.addChild(new Container());
  const markerIndex = stack.children.indexOf(marker);
  const recast = copy(fewer);
  recast.legs.pairs = 4;
  stack.setDescriptor(recast);
  await draw(stack);
  assert.equal(stack.children.indexOf(marker), markerIndex);
  assert.equal(marker.parent, stack);
  checks += 2;
  stack.destroy();

  /* A mesh rebuilt for a new vertex count must take its geometry with it: Pixi
     drops the reference without destroying it, and the renderer holds the
     buffers until an idle sweep. */
  const regeometried = copy(morePairs);
  regeometried.chain.sections.tail.chunks += 2;
  const oldGeometry = partsOf(beefwife)
    .filter((child) => child instanceof Mesh)
    .at(-1).geometry;
  const oldBuffers = [...oldGeometry.buffers];
  assert.ok(oldGeometry);
  beefwife.setDescriptor(regeometried);
  // Geometry carries no destroyed flag; a destroyed one has dropped its buffers.
  assert.equal(
    oldGeometry.buffers,
    null,
    "a replaced mesh left its geometry behind",
  );
  assert.ok(oldBuffers.every((buffer) => buffer.destroyed));
  checks += 3;

  /* The last creature drawing a set of frames takes the texture with it, which
     is what keeps a lab session editing a descriptor from stacking up sheets. */
  await draw(beefwife);
  const sheet =
    bandsOf(beefwife).get("feet").particleChildren[0].texture.source;
  assert.equal(sheet.destroyed, false);
  const owned = [...partsOf(beefwife)];
  const ownedBuffers = owned.flatMap(
    (child) => child.geometry?.buffers || [],
  );
  beefwife.destroy();
  assert.ok(ownedBuffers.every((buffer) => buffer.destroyed));
  checks++;
  assert.equal(beefwife.destroyed, true);
  assert.ok(owned.every((child) => child.destroyed));
  assert.equal(
    sheet.destroyed,
    true,
    "the last creature left its atlas behind",
  );
  checks += 4;

  /* A destroyed beefwife has no scene to keep in step with, and setDescriptor
     would build a second one under the dead container. */
  for (const [act, reason] of [
    [() => beefwife.step(1 / 60), /destroyed beefwife/],
    [() => beefwife.setDescriptor(source), /destroyed beefwife/],
    [() => beefwife.reset(), /destroyed beefwife/],
    [() => beefwife.translate({ x: 1, y: 0 }), /destroyed beefwife/],
  ]) {
    assert.throws(act, reason);
    checks++;
  }
  assert.equal(beefwife.children.length, 0);
  checks++;

  /* Pixi runs the render callback whatever the container's visibility, so a
     hidden creature is the library's to skip. Geometry stops moving, because
     nobody can see it move. */
  const hidden = new Beefwife(copy(legged), { random: () => 0.5 });
  await draw(hidden);
  const feetOf = (creature) =>
    particlesOf(creature, "feet").map((particle) => particle.x);
  const meshOf = (creature) =>
    Array.from(
      partsOf(creature).find((child) => child instanceof Mesh).positionBuffer
        .data,
    );
  for (let tick = 0; tick < 30; tick++) hidden.step(1 / 60);
  await draw(hidden);
  const movedFeet = feetOf(hidden);
  const movedMesh = meshOf(hidden);
  hidden.visible = false;
  for (let tick = 0; tick < 30; tick++) hidden.step(1 / 60);
  await draw(hidden);
  assert.deepEqual(
    feetOf(hidden),
    movedFeet,
    "a hidden creature placed particles",
  );
  assert.deepEqual(
    meshOf(hidden),
    movedMesh,
    "a hidden creature rebuilt a mesh",
  );
  checks += 2;

  /* But the atlas is not the creature's to skip. A hidden creature still has to
     retire what a rebake replaced and follow the renderer's resolution, or it
     comes back holding frames baked for a resolution that has gone. */
  const bands = bandsOf(hidden).size;
  hidden.setDescriptor(copy(legged));
  await draw(hidden);
  assert.equal(
    bandsOf(hidden).size,
    bands,
    "a hidden creature stopped tending its atlas",
  );
  hidden.visible = true;
  for (let tick = 0; tick < 30; tick++) hidden.step(1 / 60);
  await draw(hidden);
  assert.notDeepEqual(
    feetOf(hidden),
    movedFeet,
    "a creature shown again did not resume drawing",
  );
  checks += 2;
  hidden.destroy();

  // At 37 chunks the ribbon leaves Pixi's batch; an empty limb would remain
  // as a zero-count batch, which WebGL draws using the previous buffer size.
  const legless = copy(source);
  legless.legs.pairs = 0;
  legless.definitions.paints.leg.stroke = { colour: "#123456", width: 1 };
  const resizing = new Beefwife(legless, { random: () => 0.5 });
  for (const trunkCount of [25, 26, 1, 70, 25]) {
    const next = copy(legless);
    next.chain.sections.trunk.chunks = trunkCount;
    resizing.setDescriptor(next);
    await draw(resizing);
    const fills = partsOf(resizing).filter(
      (child) => child instanceof Mesh,
    );
    assert.equal(
      fills.length,
      1,
      "a legless creature retained a limb mesh",
    );
    assert.ok(fills[0].geometry.indices.length > 0);
    assert.equal(fills[0].batched, trunkCount <= 25);
    assert.equal(
      partsOf(resizing).some((child) => child instanceof PIXI.Graphics),
      false,
      "a legless creature retained a limb stroke",
    );
    checks += 4;
  }
  const withLegs = copy(legless);
  withLegs.legs.pairs = 1;
  for (let edit = 0; edit < 2; edit++) {
    resizing.setDescriptor(withLegs);
    await draw(resizing);
    const limbs = partsOf(resizing).filter(
      (child) => child instanceof Mesh || child instanceof PIXI.Graphics,
    );
    assert.equal(limbs.length, 3);
    assert.ok(limbs[0].batched, "limb batching was disabled");
    assert.equal(particlesOf(resizing, "feet").length, 2);
    resizing.setDescriptor(legless);
    await draw(resizing);
    assert.ok(limbs[0].destroyed, "the removed limb mesh survived");
    assert.ok(limbs[1].destroyed, "the removed limb stroke survived");
    assert.equal(particlesOf(resizing, "feet").length, 0);
    checks += 6;
  }
  resizing.destroy();

  console.log(`beefwife graphics: ${checks} retained-scene checks passed`);
})();
