/**
 * One bend-solver trigonometry choice, timed on whichever JavaScript engine
 * runs this file.
 *
 * Beefwife ships to other people's browsers, and the engines disagree: the
 * built-in trigonometry that wins on V8 loses on JavaScriptCore, which every
 * browser on iOS uses. So this is plain script with no imports, and runs
 * anywhere.
 *
 * Its companion `engines-layout.js` asks the same question about how chunk
 * state is laid out. Two files because one grew past what a reader can hold,
 * and neither can import the other and still run under jsc.
 *
 * It times one named case per process because the cases share helpers and
 * share Math. Run together, an earlier case warms the code a later one calls,
 * and the later case reads faster than it would in a library that only ever
 * contains one of them. A fresh process per case is what shipping looks like.
 *
 *   node test/beefwife/engines.js poly9
 *   jsc test/beefwife/engines.js -- poly9
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

/* ---- The bend solver's three transcendentals per joint ---------------- */

var HALF_PI = Math.PI / 2;
// Max error 7.6e-9 radians for the degree 9 fit, 1.1e-5 for the degree 5.
var atanUnit9 = function (r) {
  var z = r * r;
  return (
    r *
    (0.9999999981420099 +
      z *
        (-0.33333292795886499 +
          z *
            (0.19998532554294682 +
              z *
                (-0.14264892177069868 +
                  z *
                    (0.10958362659176075 +
                      z *
                        (-0.084276310890655209 +
                          z *
                            (0.058457844477306606 +
                              z *
                                (-0.031750552334960963 +
                                  z *
                                    (0.011257636025560234 +
                                      z * -0.001877562055476015)))))))))
  );
};
var atanUnit5 = function (r) {
  var z = r * r;
  return (
    r *
    (0.99999661993596134 +
      z *
        (-0.33305310408504885 +
          z *
            (0.19617204791614898 +
              z *
                (-0.12292207675502674 +
                  z * (0.059600178457926971 + z * -0.014406472476031862)))))
  );
};
var atan9 = function (y, x) {
  var ay = Math.abs(y);
  var ax = Math.abs(x);
  var high = ax > ay ? ax : ay;
  if (high === 0) return 0;
  var angle = atanUnit9((ax > ay ? ay : ax) / high);
  if (ay > ax) angle = HALF_PI - angle;
  if (x < 0) angle = Math.PI - angle;
  return y < 0 ? -angle : angle;
};
var atan5 = function (y, x) {
  var ay = Math.abs(y);
  var ax = Math.abs(x);
  var high = ax > ay ? ax : ay;
  if (high === 0) return 0;
  var angle = atanUnit5((ax > ay ? ay : ax) / high);
  if (ay > ax) angle = HALF_PI - angle;
  if (x < 0) angle = Math.PI - angle;
  return y < 0 ? -angle : angle;
};
// Max error 8.3e-11 and 2.5e-12 radians over the correction's whole range.
var sine = function (a) {
  var z = a * a;
  return (
    a *
    (0.99999999998806655 +
      z *
        (-0.16666666628895724 +
          z *
            (0.0083333314170601133 +
              z *
                (-0.00019840917005072524 +
                  z * (2.7528104057379974e-6 + z * -2.3939056638138682e-8)))))
  );
};
var cosine = function (a) {
  var z = a * a;
  return (
    0.9999999999994772 +
    z *
      (-0.49999999997756756 +
        z *
          (0.041666666511980741 +
            z *
              (-0.0013888884913393475 +
                z *
                  (2.4801102960207748e-5 +
                    z * (-2.7527115459109406e-7 + z * 1.994282533000705e-9)))))
  );
};

var JOINTS = 47 * 64;
var jointAX = new Float64Array(JOINTS);
var jointAY = new Float64Array(JOINTS);
var jointBX = new Float64Array(JOINTS);
var jointBY = new Float64Array(JOINTS);
for (var j = 0; j < JOINTS; j++) {
  var spread = j * 0.37;
  jointAX[j] = Math.cos(spread) * 12;
  jointAY[j] = Math.sin(spread) * 12;
  jointBX[j] = Math.cos(spread + 0.3) * 12;
  jointBY[j] = Math.sin(spread + 0.3) * 12;
}
/* One loop per case with the call written in. Routing the choice through a
   parameter makes a single polymorphic call site and charges every case for
   the others, which measures the harness rather than the arithmetic. */
var bendBuiltin = function () {
  for (var i = 0; i < JOINTS; i++) {
    var turn = Math.atan2(
      jointAX[i] * jointBY[i] - jointAY[i] * jointBX[i],
      jointAX[i] * jointBX[i] + jointAY[i] * jointBY[i],
    );
    var correction = (0.3 - turn) * 0.4;
    sink += Math.cos(correction) + Math.sin(correction);
  }
};
var bendPolyTrig = function () {
  for (var i = 0; i < JOINTS; i++) {
    var turn = Math.atan2(
      jointAX[i] * jointBY[i] - jointAY[i] * jointBX[i],
      jointAX[i] * jointBX[i] + jointAY[i] * jointBY[i],
    );
    var correction = (0.3 - turn) * 0.4;
    sink += cosine(correction) + sine(correction);
  }
};
var bendPoly9 = function () {
  for (var i = 0; i < JOINTS; i++) {
    var turn = atan9(
      jointAX[i] * jointBY[i] - jointAY[i] * jointBX[i],
      jointAX[i] * jointBX[i] + jointAY[i] * jointBY[i],
    );
    var correction = (0.3 - turn) * 0.4;
    sink += Math.cos(correction) + Math.sin(correction);
  }
};
var bendPoly5 = function () {
  for (var i = 0; i < JOINTS; i++) {
    var turn = atan5(
      jointAX[i] * jointBY[i] - jointAY[i] * jointBX[i],
      jointAX[i] * jointBX[i] + jointAY[i] * jointBY[i],
    );
    var correction = (0.3 - turn) * 0.4;
    sink += Math.cos(correction) + Math.sin(correction);
  }
};
var bendAllPoly = function () {
  for (var i = 0; i < JOINTS; i++) {
    var turn = atan9(
      jointAX[i] * jointBY[i] - jointAY[i] * jointBX[i],
      jointAX[i] * jointBX[i] + jointAY[i] * jointBY[i],
    );
    var correction = (0.3 - turn) * 0.4;
    sink += cosine(correction) + sine(correction);
  }
};

/* Each reports nanoseconds for the unit named in `per`, so the driver can
   put two cases in one column without knowing what either one does. */
var CASES = {
  builtin: { run: bendBuiltin, per: JOINTS },
  "poly-trig": { run: bendPolyTrig, per: JOINTS },
  poly9: { run: bendPoly9, per: JOINTS },
  poly5: { run: bendPoly5, per: JOINTS },
  "all-poly": { run: bendAllPoly, per: JOINTS },
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
  say("usage: engines.js <case>   cases: " + names.join(" "));
  if (typeof process !== "undefined") process.exit(1);
  throw new Error("no case named " + chosen);
}
var nanoseconds = measure(selected.run) / selected.per;
if (!isFinite(sink)) throw new Error("case " + chosen + " produced no result");
say(nanoseconds.toFixed(2));
