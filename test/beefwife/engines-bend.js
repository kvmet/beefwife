/**
 * One chunk-state layout for the bend solver, timed on whichever JavaScript
 * engine runs this file.
 *
 * The span sweep is the most access-heavy loop in a substep and, since it
 * became one, the most expensive, so it gets its own file rather than
 * crowding `engines-layout.js` past what a reader can hold. `engines.js` asks
 * about the solver's trigonometry, `engines-layout.js` about the loops that
 * sweep the chain once. None can import the others and still run under jsc.
 *
 * It times one named case per process because the cases share helpers and
 * share Math. Run together, an earlier case warms the code a later one calls,
 * and the later case reads faster than it would in a library that only ever
 * contains one of them. A fresh process per case is what shipping looks like.
 *
 *   node test/beefwife/engines-bend.js bend-typed
 *   jsc test/beefwife/engines-bend.js -- bend-typed
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

/* Only x and y are needed here: the span sweep reads and writes positions and
   nothing else. A restore every RESET_EVERY passes keeps the chain in the
   range it was built in, written as the same indexed loop in both layouts. */

var CHUNKS = 49;
var RESET_EVERY = 64;
var restLength = new Float64Array(CHUNKS - 1);
var jointCorrectionHalf = new Float64Array(CHUNKS);
var pristineX = new Float64Array(CHUNKS);
var pristineY = new Float64Array(CHUNKS);
for (var c = 0; c < CHUNKS; c++) {
  var spread = c * 0.37;
  if (c < CHUNKS - 1) restLength[c] = 12 + 0.01 * c;
  jointCorrectionHalf[c] = 0.2;
  pristineX[c] = Math.cos(spread * 0.04) * (c * 12);
  pristineY[c] = Math.sin(spread * 0.04) * (c * 12);
}

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
for (var q = 0; q < CHUNKS; q++) {
  chunkX[q] = pristineX[q];
  chunkY[q] = pristineY[q];
}

var resetRecords = function () {
  for (var i = 0; i < CHUNKS; i++) {
    records[i].x = pristineX[i];
    records[i].y = pristineY[i];
  }
};
var resetArrays = function () {
  for (var i = 0; i < CHUNKS; i++) {
    chunkX[i] = pristineX[i];
    chunkY[i] = pristineY[i];
  }
};

/* ---- Bend solver ------------------------------------------------------ */

/* The span sweep from bend.mjs: spans of two, then single joints. Each pivot
   rotates a five-chunk window and then walks it three more times to take the
   drift and spin back out, so this is the most access-heavy loop in a substep
   and the one a layout change has the most to move. `update` is not timed:
   it writes only the wanted pose, which is a typed array either way. */
var MAX_BEND_SPAN = 2;
var wantedX = new Float64Array(CHUNKS);
var wantedY = new Float64Array(CHUNKS);
var spanNextX = new Float64Array(CHUNKS);
var spanNextY = new Float64Array(CHUNKS);
var bendHeading = 0;
for (var b = 0; b < CHUNKS - 1; b++) {
  if (b > 0) bendHeading += 0.3 * Math.sin(b * 0.5);
  wantedX[b + 1] = wantedX[b] + Math.cos(bendHeading) * restLength[b];
  wantedY[b + 1] = wantedY[b] + Math.sin(bendHeading) * restLength[b];
}

var bendSpanRecords = function (span) {
  for (var pivot = span; pivot + span < CHUNKS; pivot += span) {
    var from = pivot - span;
    var to = pivot + span;
    var pivotX = records[pivot].x;
    var pivotY = records[pivot].y;
    var ax = pivotX - records[from].x;
    var ay = pivotY - records[from].y;
    var bx = records[to].x - pivotX;
    var by = records[to].y - pivotY;
    var turn = Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
    var wx = wantedX[pivot] - wantedX[from];
    var wy = wantedY[pivot] - wantedY[from];
    var vx = wantedX[to] - wantedX[pivot];
    var vy = wantedY[to] - wantedY[pivot];
    var target = Math.atan2(wx * vy - wy * vx, wx * vx + wy * vy);
    var correction = (target - turn) * jointCorrectionHalf[pivot];
    var cosine = Math.cos(correction);
    var sine = Math.sin(correction);
    var index;
    for (index = from; index <= to; index++) {
      var x = records[index].x - pivotX;
      var y = records[index].y - pivotY;
      var away = index < pivot ? -sine : sine;
      spanNextX[index] = pivotX + x * cosine - y * away;
      spanNextY[index] = pivotY + x * away + y * cosine;
    }
    var width = to - from + 1;
    var driftX = 0;
    var driftY = 0;
    var centerX = 0;
    var centerY = 0;
    for (index = from; index <= to; index++) {
      driftX += spanNextX[index] - records[index].x;
      driftY += spanNextY[index] - records[index].y;
      centerX += records[index].x;
      centerY += records[index].y;
    }
    driftX /= width;
    driftY /= width;
    centerX /= width;
    centerY /= width;
    var moment = 0;
    var inertia = 0;
    for (index = from; index <= to; index++) {
      var rx = records[index].x - centerX;
      var ry = records[index].y - centerY;
      moment +=
        rx * (spanNextY[index] - records[index].y - driftY) -
        ry * (spanNextX[index] - records[index].x - driftX);
      inertia += rx * rx + ry * ry;
    }
    var spin = inertia > 1e-12 ? moment / inertia : 0;
    for (index = from; index <= to; index++) {
      var sx = records[index].x - centerX;
      var sy = records[index].y - centerY;
      records[index].x = spanNextX[index] - driftX + spin * sy;
      records[index].y = spanNextY[index] - driftY - spin * sx;
    }
    sink += records[pivot].x;
  }
};
var bendSpanArrays = function (span) {
  for (var pivot = span; pivot + span < CHUNKS; pivot += span) {
    var from = pivot - span;
    var to = pivot + span;
    var pivotX = chunkX[pivot];
    var pivotY = chunkY[pivot];
    var ax = pivotX - chunkX[from];
    var ay = pivotY - chunkY[from];
    var bx = chunkX[to] - pivotX;
    var by = chunkY[to] - pivotY;
    var turn = Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
    var wx = wantedX[pivot] - wantedX[from];
    var wy = wantedY[pivot] - wantedY[from];
    var vx = wantedX[to] - wantedX[pivot];
    var vy = wantedY[to] - wantedY[pivot];
    var target = Math.atan2(wx * vy - wy * vx, wx * vx + wy * vy);
    var correction = (target - turn) * jointCorrectionHalf[pivot];
    var cosine = Math.cos(correction);
    var sine = Math.sin(correction);
    var index;
    for (index = from; index <= to; index++) {
      var x = chunkX[index] - pivotX;
      var y = chunkY[index] - pivotY;
      var away = index < pivot ? -sine : sine;
      spanNextX[index] = pivotX + x * cosine - y * away;
      spanNextY[index] = pivotY + x * away + y * cosine;
    }
    var width = to - from + 1;
    var driftX = 0;
    var driftY = 0;
    var centerX = 0;
    var centerY = 0;
    for (index = from; index <= to; index++) {
      driftX += spanNextX[index] - chunkX[index];
      driftY += spanNextY[index] - chunkY[index];
      centerX += chunkX[index];
      centerY += chunkY[index];
    }
    driftX /= width;
    driftY /= width;
    centerX /= width;
    centerY /= width;
    var moment = 0;
    var inertia = 0;
    for (index = from; index <= to; index++) {
      var rx = chunkX[index] - centerX;
      var ry = chunkY[index] - centerY;
      moment +=
        rx * (spanNextY[index] - chunkY[index] - driftY) -
        ry * (spanNextX[index] - chunkX[index] - driftX);
      inertia += rx * rx + ry * ry;
    }
    var spin = inertia > 1e-12 ? moment / inertia : 0;
    for (index = from; index <= to; index++) {
      var sx = chunkX[index] - centerX;
      var sy = chunkY[index] - centerY;
      chunkX[index] = spanNextX[index] - driftX + spin * sy;
      chunkY[index] = spanNextY[index] - driftY - spin * sx;
    }
    sink += chunkX[pivot];
  }
};
var bendRecordsPass = function () {
  for (var span = Math.min(MAX_BEND_SPAN, CHUNKS >> 2); span >= 1; span >>= 1)
    bendSpanRecords(span);
};
var bendArraysPass = function () {
  for (var span = Math.min(MAX_BEND_SPAN, CHUNKS >> 2); span >= 1; span >>= 1)
    bendSpanArrays(span);
};

/* A run is one restore and RESET_EVERY sweeps, so the chain never leaves the
   range it was built in and the restore is a sixty-fourth of what is timed. */
var repeating = function (reset, pass) {
  return function () {
    reset();
    for (var i = 0; i < RESET_EVERY; i++) pass();
  };
};

/* Each reports nanoseconds for the unit named in `per`, so the driver can
   put two cases in one column without knowing what either one does. */
var CASES = {
  "bend-objects": {
    run: repeating(resetRecords, bendRecordsPass),
    per: RESET_EVERY,
  },
  "bend-typed": {
    run: repeating(resetArrays, bendArraysPass),
    per: RESET_EVERY,
  },
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
  say("usage: engines-bend.js <case>   cases: " + names.join(" "));
  if (typeof process !== "undefined") process.exit(1);
  throw new Error("no case named " + chosen);
}
var nanoseconds = measure(selected.run) / selected.per;
if (!isFinite(sink)) throw new Error("case " + chosen + " produced no result");
say(nanoseconds.toFixed(2));
