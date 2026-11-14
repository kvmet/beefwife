const MAX_WORLD_COORDINATE = 1e9;
const MIN_PIXEL_RESOLUTION = 1e-6;
const MAX_PIXEL_RESOLUTION = 1e6;
const MAX_PERSPECTIVE = 1e6;
const PHYSICS_STEP = 1 / 60;
/* The gait is sampled once per physics step. Below four steps a cycle a
   channel reads as flicker, and past two it aliases into a slower or
   reversed wave. */
const MIN_STEPS_PER_CYCLE = 4;
const MAX_CHANNEL_RATE = 1 / PHYSICS_STEP / MIN_STEPS_PER_CYCLE;

export {
  MAX_WORLD_COORDINATE,
  MIN_PIXEL_RESOLUTION,
  MAX_PIXEL_RESOLUTION,
  MAX_PERSPECTIVE,
  PHYSICS_STEP,
  MAX_CHANNEL_RATE,
};
