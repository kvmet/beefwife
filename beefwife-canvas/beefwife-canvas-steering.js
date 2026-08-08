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

const BEEFWIFE_CANVAS_ROUTE_DEFAULTS = {
  // Corner tolerance may be generous without making final targets imprecise.
  // Both must clear the 1 px that bearingTo calls arrival, or a creature
  // closing head on can run out of bearing just short of the point.
  waypointRadius: 10, // px from an intermediate waypoint that spends it
  arrivalRadius: 10, // px from the final target that satisfies the route
  ease: 4, // per s that the throttle closes on what the route asks for
  // Both are the same stall: seconds without clearing a waypoint. A creature
  // walking a legal path clears them and neither limit is ever reached.
  patience: 120, // s stalled in bounds before giving up on the plan
  replan: 7, // s stalled out of bounds before drawing a way back in
};

const near = (p, head, r) => Math.hypot(p.x - head.x, p.y - head.y) < r;

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
const passed = (from, p, head) =>
  (head.x - p.x) * (p.x - from.x) + (head.y - p.y) * (p.y - from.y) > 0;

/**
 * The unit vector from the head to `p`, or null when it is already there.
 *
 * `off` is Terrain's additive correction for where the head is standing. Its
 * direction is added as a second unit vector. In bounds it is zero and the
 * bearing is the waypoint alone. Outside, the two blend, which walks a creature
 * off a widget along the plan it already has instead of drawing another one.
 */
const bearingTo = (p, head, off, result = {}) => {
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
  // The waypoint is straight back through the widget, so the way out wins.
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
const newRoute = () => ({
  path: [],
  from: null,
  age: 0,
  nowhere: false,
  satisfied: false,
});

/**
 * Advances a route by `dt`, written in place. Reports the way to steer, and the
 * waypoint it is aiming at, both null with no waypoint left, which stops a
 * creature that has nowhere to go rather than walking it somewhere arbitrary.
 */
const stepRoute = (route, router, head, dt, roam, result) => {
  if (router.advance) router.advance(dt);
  route.age += dt;
  // One reading of the ground under the head, on the hot path: it decides both
  // how long this creature may stall and which way it leans while it walks.
  const off = router.terrain.offset(head.x, head.y, result?.field);

  // Crossing the incoming plane spends an intermediate waypoint so a chain
  // with momentum does not circle back. The final target requires proximity;
  // its independent radius can therefore be precise without tightening turns.
  while (route.path.length) {
    const point = route.path[0];
    const final = route.path.length === 1;
    const done =
      near(point, head, final ? roam.arrivalRadius : roam.waypointRadius) ||
      (!final && passed(route.from, point, head));
    if (!done) break;
    route.from = point;
    route.path.shift();
    // Clearing one is the only thing that counts as progress, so a long run is
    // never given up on halfway and a stalled creature is caught wherever it
    // stopped.
    route.age = 0;
  }

  if (
    route.from !== null &&
    !route.path.length &&
    !route.nowhere &&
    !route.satisfied
  ) {
    route.satisfied = true;
    route.age = 0;
    if (router.satisfy) router.satisfy();
  }

  // A widget can appear over a creature, and the plan it is walking was drawn
  // for a page that no longer holds it. Out of bounds it is given far less
  // time to stop making progress, since the way back in is the one plan it
  // cannot be left without.
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
    route.from = { x: head.x, y: head.y };
    route.age = 0;
  }

  const target = route.path[0] || null;
  if (!result)
    return { target, bearing: target && bearingTo(target, head, off) };
  result.target = target;
  result.bearing = target
    ? bearingTo(target, head, off, result.direction)
    : null;
  return result;
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { BEEFWIFE_CANVAS_ROUTE_DEFAULTS, newRoute, stepRoute };
}
