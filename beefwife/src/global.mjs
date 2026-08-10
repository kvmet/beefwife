/**
 * Classic-script entry. A page gets one global, `Beefwife`, and reaches the
 * JSON half through `Beefwife.Descriptor`. Module consumers import both by
 * name, so the namespace is attached only here.
 */

import { Beefwife, Descriptor } from "./beefwife.mjs";

Object.defineProperty(Beefwife, "Descriptor", {
  value: Descriptor,
  enumerable: true,
});

export default Beefwife;
