/**
 * Does each supplied target produce one finite route, and does an actor spend
 * it through the public Beefwife lifecycle? Real schema-v1 descriptors are the
 * control. Fails on invalid cast entries, repeated directed plans, early
 * wander plans, timing drift, or lost spawns.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

global.window = { innerWidth: 800, innerHeight: 600 };

const { Beefwife } = require("../../beefwife/src/beefwife.mjs");
const {
  BEEFWIFE_CANVAS_ROUTE_DEFAULTS,
} = require("../../beefwife-canvas/src/steering.mjs");
const { BeefwifeCanvasActor } = require("../../beefwife-canvas/src/actor.mjs");
const { BeefwifeCanvasRouter } = require("../../beefwife-canvas/src/path.mjs");
const {
  BeefwifeCanvasTargetPolicy,
} = require("../../beefwife-canvas/src/targeting.mjs");
const {
  newRoute: newSteerRoute,
  stepRoute: steerRoute,
} = require("../../beefwife-canvas/src/steering.mjs");
const descriptor = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "fixtures", "beefwives", "undulating.json"),
    "utf8",
  ),
);
let checks = 0;

const policyRouter = {
  terrain: { offset: () => ({ distance: 0, dx: 0, dy: 0 }) },
  randomPoint: () => ({ x: 300, y: 200 }),
  planTo: (_head, goal) => [{ ...goal }],
};
const directed = new BeefwifeCanvasTargetPolicy(policyRouter, "manual");
assert.throws(
  () => directed.setTarget({ x: 1, y: 2, z: 3 }),
  /target\.z is unknown/,
);
assert.throws(
  () => directed.setTarget(Object.assign([], { x: 1, y: 2 })),
  /target must be an object/,
);
directed.setTarget({ x: 12, y: 14 });
assert.deepEqual(directed.plan({ x: 0, y: 0 }), [{ x: 12, y: 14 }]);
directed.satisfy();
assert.equal(directed.readyToPlan, false);
assert.equal(directed.plan({ x: 12, y: 14 }), null);
const wandering = new BeefwifeCanvasTargetPolicy(policyRouter, "wander", {
  random: () => 0.5,
  wanderDelay: 8,
});
assert.equal(wandering.readyToPlan, true);
wandering.plan({ x: 0, y: 0 });
wandering.satisfy();
assert.equal(wandering.readyToPlan, false);
wandering.advance(3.99);
assert.equal(wandering.readyToPlan, false);
wandering.advance(0.01);
assert.equal(wandering.readyToPlan, true);
checks += 10;

let directedPlans = 0;
const finiteRouter = {
  terrain: policyRouter.terrain,
  randomPoint: policyRouter.randomPoint,
  planTo: (_head, goal) => {
    directedPlans++;
    return [{ ...goal }];
  },
};
const finitePolicy = new BeefwifeCanvasTargetPolicy(finiteRouter, "manual");
finitePolicy.setTarget({ x: 12, y: 14 });
const finiteRoute = newSteerRoute();
steerRoute(
  finiteRoute,
  finitePolicy,
  { x: 0, y: 0 },
  1 / 60,
  BEEFWIFE_CANVAS_ROUTE_DEFAULTS,
);
assert.equal(directedPlans, 1);
steerRoute(
  finiteRoute,
  finitePolicy,
  { x: 12, y: 14 },
  1 / 60,
  BEEFWIFE_CANVAS_ROUTE_DEFAULTS,
);
assert.equal(finiteRoute.satisfied, true);
steerRoute(
  finiteRoute,
  finitePolicy,
  { x: 12, y: 14 },
  1,
  BEEFWIFE_CANVAS_ROUTE_DEFAULTS,
);
assert.equal(directedPlans, 1);

let wanderPlans = 0;
const delayedRouter = {
  terrain: policyRouter.terrain,
  randomPoint: () => ({ x: 20 + wanderPlans, y: 0 }),
  planTo: (_head, goal) => {
    wanderPlans++;
    return [{ ...goal }];
  },
};
const delayedPolicy = new BeefwifeCanvasTargetPolicy(delayedRouter, "wander", {
  random: () => 0.5,
  wanderDelay: 8,
});
const delayedRoute = newSteerRoute();
steerRoute(
  delayedRoute,
  delayedPolicy,
  { x: 0, y: 0 },
  0,
  BEEFWIFE_CANVAS_ROUTE_DEFAULTS,
);
steerRoute(
  delayedRoute,
  delayedPolicy,
  { x: 20, y: 0 },
  0,
  BEEFWIFE_CANVAS_ROUTE_DEFAULTS,
);
steerRoute(
  delayedRoute,
  delayedPolicy,
  { x: 20, y: 0 },
  3.99,
  BEEFWIFE_CANVAS_ROUTE_DEFAULTS,
);
assert.equal(wanderPlans, 1);
steerRoute(
  delayedRoute,
  delayedPolicy,
  { x: 20, y: 0 },
  0.01,
  BEEFWIFE_CANVAS_ROUTE_DEFAULTS,
);
assert.equal(wanderPlans, 2);
checks += 5;

const toleranceRoute = newSteerRoute();
toleranceRoute.from = { x: 0, y: 0 };
toleranceRoute.path = [
  { x: 10, y: 0 },
  { x: 20, y: 0 },
];
const passivePolicy = {
  readyToPlan: false,
  terrain: policyRouter.terrain,
};
const splitTolerance = {
  ...BEEFWIFE_CANVAS_ROUTE_DEFAULTS,
  arrivalRadius: 2,
  waypointRadius: 2,
};
steerRoute(toleranceRoute, passivePolicy, { x: 11, y: 0 }, 0, splitTolerance);
assert.deepEqual(toleranceRoute.path, [{ x: 20, y: 0 }]);
steerRoute(toleranceRoute, passivePolicy, { x: 23, y: 0 }, 0, splitTolerance);
assert.deepEqual(toleranceRoute.path, [{ x: 20, y: 0 }]);
steerRoute(toleranceRoute, passivePolicy, { x: 21, y: 0 }, 0, splitTolerance);
assert.equal(toleranceRoute.satisfied, true);
checks += 3;

const landingRouter = new BeefwifeCanvasRouter(
  {
    ready: true,
    nearest: (x, y) => ({ x: x + 3, y: y - 4, distance: 5 }),
  },
  () => ({ width: 100, height: 80 }),
  { random: () => 0.5 },
);
assert.deepEqual(landingRouter.randomPoint(), { x: 53, y: 36 });

const escapingRoute = newSteerRoute();
escapingRoute.from = { x: 0, y: 0 };
escapingRoute.path = [{ x: 10, y: 0 }];
const escapingPolicy = {
  readyToPlan: false,
  terrain: {
    offset: (_x, _y, result = {}) =>
      Object.assign(result, { dx: 0, dy: 4, distance: 4 }),
  },
};
const escaping = steerRoute(
  escapingRoute,
  escapingPolicy,
  { x: 0, y: 0 },
  0,
  BEEFWIFE_CANVAS_ROUTE_DEFAULTS,
);
assert.ok(Math.abs(escaping.bearing.x - Math.SQRT1_2) < 1e-12);
assert.ok(Math.abs(escaping.bearing.y - Math.SQRT1_2) < 1e-12);
checks += 3;

const terrain = { x0: 0, y0: 0, x1: 800, y1: 600 };
/* The goal sits due east of every spawn below, so an eased heading converges on
   +x and the assertions read the actor's own steering rather than a stub's. */
const router = {
  plan: (head) => [{ x: head.x + 1e5, y: head.y }],
  randomPoint: () => ({ x: 90, y: 70 }),
  terrain: { offset: () => ({ distance: 0, dx: 0, dy: 0 }) },
  viewport: () => ({ width: 800, height: 600 }),
};
const actor = new BeefwifeCanvasActor(terrain, router, descriptor);
assert.ok(actor.beefwife instanceof Beefwife);
const firstBeefwife = actor.beefwife;
actor.spawn({ x: 25, y: 35 }, { x: 0, y: 1 });
assert.equal(firstBeefwife.destroyed, true);
assert.deepEqual(actor.beefwife.getPose().head, { x: 25, y: 35 });
const stoppedPose = JSON.parse(JSON.stringify(actor.beefwife.getPose()));
actor.update(1 / 60, 0);
assert.deepEqual(actor.beefwife.getPose(), stoppedPose);
assert.throws(() => actor.update(1 / 60, Infinity), /timeScale/);
assert.throws(() => actor.update(1, 1), /dt/);
actor.update(1 / 60, 1);
assert.deepEqual(actor.heading, { x: 1, y: 0 });
checks += 8;

/* A chain longer than the viewport keeps its centroid far from its head, so
   the lost check has to carry the rest length or it recycles the creature
   every frame and nothing ever walks. */
const longDescriptor = JSON.parse(JSON.stringify(descriptor));
longDescriptor.chain.sections.trunk.chunks = 200;
const longActor = new BeefwifeCanvasActor(terrain, router, longDescriptor);
longActor.spawn({ x: 400, y: 300 }, { x: 1, y: 0 });
assert.ok(longActor.beefwife.restLength > 800);
const longBeefwife = longActor.beefwife;
for (let frame = 0; frame < 240; frame++) longActor.update(1 / 60, 1);
assert.equal(longActor.beefwife, longBeefwife);
longActor.spawn({ x: 1e6, y: 1e6 }, { x: 1, y: 0 });
const strayBeefwife = longActor.beefwife;
longActor.update(1 / 60, 1);
assert.notEqual(longActor.beefwife, strayBeefwife);
checks += 4;

console.log(`BeefwifeCanvas routing: ${checks} route and actor checks passed`);
