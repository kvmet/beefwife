/**
 * Classic-script entry. A page gets one global, `Beefwife`, and reaches the
 * JSON half through `Beefwife.descriptor`. Module consumers import both by
 * name, so the namespace is attached only here.
 */

import { Beefwife, descriptor } from "./beefwife.mjs";

Object.defineProperty(Beefwife, "descriptor", {
  value: descriptor,
  enumerable: true,
});

export default Beefwife;
