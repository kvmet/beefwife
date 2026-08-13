/**
 * One chunk-state layout, timed on whichever JavaScript engine runs this file.
 *
 * The chain's mutable state can be one record per chunk or one typed array per
 * field, and the engines disagree about which is cheaper: object property
 * access is worse on JavaScriptCore, which every browser on iOS uses, while
 * typed arrays are better. So this is plain script with no imports, and runs
 * anywhere.
 *
 * Its companion `engines.js` asks the same question about the bend solver's
 * transcendentals. Two files because one grew past what a reader can hold, and
 * neither can import the other and still run under jsc.
 *
 * It times one named case per process because the cases share helpers and
 * share Math. Run together, an earlier case warms the code a later one calls,
 * and the later case reads faster than it would in a library that only ever
 * contains one of them. A fresh process per case is what shipping looks like.
 *
 *   node test/beefwife/engines-layout.js relax-typed
 *   jsc test/beefwife/engines-layout.js -- relax-typed
 *
 * `bb beefwife-engines` runs every case on every engine it finds.
 */
var now =
  typeof performance !== "undefined" && performance.now
    ? function () {
        return performance.now();
      }
    : typeof preciseTime !== "undefined"
      ? function () {
          return preciseTime() * 1000;
        }
      : function () {
          return Date.now();
        };
var say = typeof print !== "undefined" ? print : console.log;

/* Two timed runs, keeping the faster. A collection or a stolen slice inflates
   a run and never deflates one, so the minimum is the honest estimate and the
   mean is not. */
var WARM_MS = 250;
var RUN_MS = 500;
var measure = function (run) {
  var lap = function (milliseconds) {
    var started = now();
    var laps = 0;
    var elapsed;
    do {
      run();
      laps++;
      elapsed = now() - started;
    } while (elapsed < milliseconds);
    return (elapsed * 1e6) / laps;
  };
  lap(WARM_MS);
  var first = lap(RUN_MS);
  var second = lap(RUN_MS);
  return first < second ? first : second;
};

var sink = 0;

/* ---- Chain state: objects against typed arrays ------------------------ */

/* The four substep loops that read or write chunk state, each written twice
   over the same arithmetic. Only the layout differs, so a pair's ratio is the
   layout's price on this engine and nothing else.
 *
 * Relaxation and the tangent update are stable under repetition: the first
 * converges, the second never moves a position. Bend and integrate do move
 * positions with nothing pulling back, and a chain left to run reaches
 * non-finite in about a thousand passes, so those two restore a pristine
 * copy every RESET_EVERY passes. The restore is the same indexed loop in both
 * layouts and is diluted to about a sixty-fourth of the measurement. */

var CHUNKS = 49;
var LINKS = CHUNKS - 1;
var RESET_EVERY = 64;
var TAU = Math.PI * 2;

var restLength = new Float64Array(LINKS);
var linkCorrection = new Float64Array(LINKS);
for (var k = 0; k < LINKS; k++) {
  restLength[k] = 12 + 0.01 * k;
  linkCorrection[k] = 0.35;
}

var retention = new Float64Array(CHUNKS);
var gripForward = new Float64Array(CHUNKS);
var gripBackward = new Float64Array(CHUNKS);
var gripLateral = new Float64Array(CHUNKS);
var motionContact = new Float64Array(CHUNKS);
var motionThrust = new Float64Array(CHUNKS);
var motionBend = new Float64Array(CHUNKS);
var bendScale = new Float64Array(CHUNKS);
var bendPhaseSine = new Float64Array(CHUNKS);
var bendPhaseCosine = new Float64Array(CHUNKS);
var jointCorrectionHalf = new Float64Array(CHUNKS);
var phaseLag = new Float64Array(CHUNKS);
var pristineX = new Float64Array(CHUNKS);
var pristineY = new Float64Array(CHUNKS);
for (var c = 0; c < CHUNKS; c++) {
  var spread = c * 0.37;
  retention[c] = 0.86;
  gripForward[c] = 0.4;
  gripBackward[c] = 0.75;
  gripLateral[c] = 0.6;
  motionContact[c] = 1;
  motionThrust[c] = 1;
  motionBend[c] = 1;
  bendScale[c] = 1;
  bendPhaseSine[c] = Math.sin(spread);
  bendPhaseCosine[c] = Math.cos(spread);
  jointCorrectionHalf[c] = 0.2;
  phaseLag[c] = c * 0.11;
  /* A slight arc, so the bend solver turns real joints rather than the
     degenerate zero-angle ones a straight chain would hand it. */
  pristineX[c] = Math.cos(spread * 0.04) * (c * 12);
  pristineY[c] = Math.sin(spread * 0.04) * (c * 12);
}

/* One gait sample, held fixed: the loops under test read these as scalars and
   the substep rate is not what this measures. */
var PHASE = 1.7;
var THROTTLE = 0.8;
var DT = 1 / 60;
var DT_SQUARED = DT * DT;
var AUTO_LIFT = 0.3;
var AXIS_X = 1;
var AXIS_Y = 0;
var CONTACT_HARMONIC = 1;
var THRUST_HARMONIC = 1;
var CONTACT_PHASE_OFFSET = 0.4;
var THRUST_PHASE_OFFSET = 0.9;
var CONTACT_DUTY = 0.5;
var THRUST_DUTY = 0.6;
var CONTACT_AMPLITUDE = 0.7;
var THRUST_ACCELERATION = 900;
var BEND_AMPLITUDE = 0.5;
var BEND_PHASE_SINE = Math.sin(PHASE);
var BEND_PHASE_COSINE = Math.cos(PHASE);
var BIAS_THROTTLE = 0.05;

var positiveModulo = function (value, divisor) {
  return ((value % divisor) + divisor) % divisor;
};

var records = [];
for (var r = 0; r < CHUNKS; r++)
  records.push({
    x: pristineX[r],
    y: pristineY[r],
    px: pristineX[r],
    py: pristineY[r],
    dx: 1,
    dy: 0,
    idle: 0,
    gain: 0,
    gaitContact: 1,
    contact: 1,
  });

var chunkX = new Float64Array(CHUNKS);
var chunkY = new Float64Array(CHUNKS);
var chunkPX = new Float64Array(CHUNKS);
var chunkPY = new Float64Array(CHUNKS);
var chunkDX = new Float64Array(CHUNKS);
var chunkDY = new Float64Array(CHUNKS);
var chunkIdle = new Float64Array(CHUNKS);
var chunkGain = new Float64Array(CHUNKS);
var chunkGaitContact = new Float64Array(CHUNKS);
var chunkContact = new Float64Array(CHUNKS);
for (var q = 0; q < CHUNKS; q++) {
  chunkX[q] = pristineX[q];
  chunkY[q] = pristineY[q];
  chunkPX[q] = pristineX[q];
  chunkPY[q] = pristineY[q];
  chunkDX[q] = 1;
  chunkGaitContact[q] = 1;
  chunkContact[q] = 1;
}

var resetRecords = function () {
  for (var i = 0; i < CHUNKS; i++) {
    var chunk = records[i];
    chunk.x = pristineX[i];
    chunk.y = pristineY[i];
    chunk.px = pristineX[i];
    chunk.py = pristineY[i];
  }
};
var resetArrays = function () {
  for (var i = 0; i < CHUNKS; i++) {
    chunkX[i] = pristineX[i];
    chunkY[i] = pristineY[i];
    chunkPX[i] = pristineX[i];
    chunkPY[i] = pristineY[i];
  }
};

/* ---- Link relaxation -------------------------------------------------- */

var relaxRecords = function () {
  var before = records[0];
  for (var i = 0; i < LINKS; i++) {
    var after = records[i + 1];
    var x = after.x - before.x;
    var y = after.y - before.y;
    var distance = Math.sqrt(x * x + y * y) || 0.001;
    var shift = ((distance - restLength[i]) / distance) * linkCorrection[i];
    before.x += x * shift;
    before.y += y * shift;
    after.x -= x * shift;
    after.y -= y * shift;
    before = after;
  }
  sink += before.x;
};
var relaxArrays = function () {
  var beforeX = chunkX[0];
  var beforeY = chunkY[0];
  for (var i = 0; i < LINKS; i++) {
    var afterX = chunkX[i + 1];
    var afterY = chunkY[i + 1];
    var x = afterX - beforeX;
    var y = afterY - beforeY;
    var distance = Math.sqrt(x * x + y * y) || 0.001;
    var shift = ((distance - restLength[i]) / distance) * linkCorrection[i];
    chunkX[i] = beforeX + x * shift;
    chunkY[i] = beforeY + y * shift;
    beforeX = afterX - x * shift;
    beforeY = afterY - y * shift;
  }
  chunkX[LINKS] = beforeX;
  chunkY[LINKS] = beforeY;
  sink += beforeX;
};

/* ---- Tangent and axis update ------------------------------------------ */

var tangentsRecords = function () {
  var last = CHUNKS - 1;
  var axisX = 0;
  var axisY = 0;
  for (var i = 0; i < CHUNKS; i++) {
    var chunk = records[i];
    var ahead = records[i === 0 ? 0 : i - 1];
    var behind = records[i === last ? last : i + 1];
    var x = ahead.x - behind.x;
    var y = ahead.y - behind.y;
    var length = Math.sqrt(x * x + y * y);
    if (length >= 1e-9) {
      chunk.dx = x / length;
      chunk.dy = y / length;
    }
    axisX += chunk.x - chunk.px;
    axisY += chunk.y - chunk.py;
  }
  sink += axisX + axisY;
};
var tangentsArrays = function () {
  var last = CHUNKS - 1;
  var axisX = 0;
  var axisY = 0;
  for (var i = 0; i < CHUNKS; i++) {
    var ahead = i === 0 ? 0 : i - 1;
    var behind = i === last ? last : i + 1;
    var x = chunkX[ahead] - chunkX[behind];
    var y = chunkY[ahead] - chunkY[behind];
    var length = Math.sqrt(x * x + y * y);
    if (length >= 1e-9) {
      chunkDX[i] = x / length;
      chunkDY[i] = y / length;
    }
    axisX += chunkX[i] - chunkPX[i];
    axisY += chunkY[i] - chunkPY[i];
  }
  sink += axisX + axisY;
};

/* ---- Integrate -------------------------------------------------------- */

var integrateRecordsPass = function () {
  for (var i = 0; i < CHUNKS; i++) {
    var chunk = records[i];
    var hold = retention[i];
    var velocityX = (chunk.x - chunk.px) * hold;
    var velocityY = (chunk.y - chunk.py) * hold;
    chunk.px = chunk.x;
    chunk.py = chunk.y;
    chunk.x += velocityX;
    chunk.y += velocityY;

    var dx = chunk.dx;
    var dy = chunk.dy;
    var x = chunk.x - chunk.px;
    var y = chunk.y - chunk.py;
    var along = x * dx + y * dy;
    var lateral = x * -dy + y * dx;

    var lagged = PHASE - phaseLag[i];
    var contactCycle =
      positiveModulo(CONTACT_HARMONIC * lagged + CONTACT_PHASE_OFFSET, TAU) /
      TAU;
    var gaitContact =
      contactCycle >= CONTACT_DUTY
        ? 1
        : 1 -
          CONTACT_AMPLITUDE *
            motionContact[i] *
            THROTTLE *
            Math.sin((Math.PI * contactCycle) / CONTACT_DUTY);
    chunk.gaitContact = gaitContact;
    var grounded = Math.max(
      0,
      Math.min(1, gaitContact * (1 - AUTO_LIFT * chunk.idle * THROTTLE)),
    );
    chunk.contact = grounded;

    var retainedAlong =
      along * (1 - grounded * (along < 0 ? gripBackward[i] : gripForward[i]));
    var retainedLateral = lateral * (1 - grounded * gripLateral[i]);
    chunk.x = chunk.px + dx * retainedAlong - dy * retainedLateral;
    chunk.y = chunk.py + dy * retainedAlong + dx * retainedLateral;
    chunk.gain = -(
      (along - retainedAlong) * (dx * AXIS_X + dy * AXIS_Y) +
      (lateral - retainedLateral) * (-dy * AXIS_X + dx * AXIS_Y)
    );

    var thrustCycle =
      positiveModulo(THRUST_HARMONIC * lagged + THRUST_PHASE_OFFSET, TAU) / TAU;
    var acceleration =
      thrustCycle >= THRUST_DUTY
        ? 0
        : THRUST_ACCELERATION *
          motionThrust[i] *
          THROTTLE *
          Math.sin((Math.PI * thrustCycle) / THRUST_DUTY);
    chunk.x += dx * acceleration * DT_SQUARED;
    chunk.y += dy * acceleration * DT_SQUARED;
    sink += chunk.gain;
  }
};
var integrateArraysPass = function () {
  for (var i = 0; i < CHUNKS; i++) {
    var hold = retention[i];
    var startX = chunkX[i];
    var startY = chunkY[i];
    var velocityX = (startX - chunkPX[i]) * hold;
    var velocityY = (startY - chunkPY[i]) * hold;
    chunkPX[i] = startX;
    chunkPY[i] = startY;
    var movedX = startX + velocityX;
    var movedY = startY + velocityY;

    var dx = chunkDX[i];
    var dy = chunkDY[i];
    var x = movedX - startX;
    var y = movedY - startY;
    var along = x * dx + y * dy;
    var lateral = x * -dy + y * dx;

    var lagged = PHASE - phaseLag[i];
    var contactCycle =
      positiveModulo(CONTACT_HARMONIC * lagged + CONTACT_PHASE_OFFSET, TAU) /
      TAU;
    var gaitContact =
      contactCycle >= CONTACT_DUTY
        ? 1
        : 1 -
          CONTACT_AMPLITUDE *
            motionContact[i] *
            THROTTLE *
            Math.sin((Math.PI * contactCycle) / CONTACT_DUTY);
    chunkGaitContact[i] = gaitContact;
    var grounded = Math.max(
      0,
      Math.min(1, gaitContact * (1 - AUTO_LIFT * chunkIdle[i] * THROTTLE)),
    );
    chunkContact[i] = grounded;

    var retainedAlong =
      along * (1 - grounded * (along < 0 ? gripBackward[i] : gripForward[i]));
    var retainedLateral = lateral * (1 - grounded * gripLateral[i]);
    var heldX = startX + dx * retainedAlong - dy * retainedLateral;
    var heldY = startY + dy * retainedAlong + dx * retainedLateral;
    chunkGain[i] = -(
      (along - retainedAlong) * (dx * AXIS_X + dy * AXIS_Y) +
      (lateral - retainedLateral) * (-dy * AXIS_X + dx * AXIS_Y)
    );

    var thrustCycle =
      positiveModulo(THRUST_HARMONIC * lagged + THRUST_PHASE_OFFSET, TAU) / TAU;
    var acceleration =
      thrustCycle >= THRUST_DUTY
        ? 0
        : THRUST_ACCELERATION *
          motionThrust[i] *
          THROTTLE *
          Math.sin((Math.PI * thrustCycle) / THRUST_DUTY);
    chunkX[i] = heldX + dx * acceleration * DT_SQUARED;
    chunkY[i] = heldY + dy * acceleration * DT_SQUARED;
    sink += chunkGain[i];
  }
};

/* A run is one restore and RESET_EVERY passes, so the chain never leaves the
   range it was built in and the restore is a sixty-fourth of what is timed. */
var repeating = function (reset, pass) {
  return function () {
    reset();
    for (var i = 0; i < RESET_EVERY; i++) pass();
  };
};
var integrateRecords = repeating(resetRecords, integrateRecordsPass);
var integrateArrays = repeating(resetArrays, integrateArraysPass);

/* ---- Cases ------------------------------------------------------------ */

/* Each reports nanoseconds for the unit named in `per`, so the driver can
   put two cases in one column without knowing what either one does. */
var CASES = {
  "relax-objects": { run: relaxRecords, per: 1 },
  "relax-typed": { run: relaxArrays, per: 1 },
  "tangents-objects": { run: tangentsRecords, per: 1 },
  "tangents-typed": { run: tangentsArrays, per: 1 },
  "integrate-objects": { run: integrateRecords, per: RESET_EVERY },
  "integrate-typed": { run: integrateArrays, per: RESET_EVERY },
};
var argv =
  typeof process !== "undefined" && process.argv
    ? process.argv.slice(2)
    : typeof arguments !== "undefined"
      ? Array.prototype.slice.call(arguments)
      : [];
var chosen = argv[0];
var selected = CASES[chosen];
if (!selected) {
  var names = [];
  for (var name in CASES) names.push(name);
  say("usage: engines-layout.js <case>   cases: " + names.join(" "));
  if (typeof process !== "undefined") process.exit(1);
  throw new Error("no case named " + chosen);
}
var nanoseconds = measure(selected.run) / selected.per;
if (!isFinite(sink)) throw new Error("case " + chosen + " produced no result");
say(nanoseconds.toFixed(2));
