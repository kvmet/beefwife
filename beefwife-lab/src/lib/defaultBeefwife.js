import reticulating from "../../../test/fixtures/beefwives/reticulating.json";

// The preview is not color graded or post-processed. Its look comes entirely
// from this initial descriptor, which will eventually be replaced by the
// document assembled by the editor controls.
export const rustWalker = structuredClone(reticulating);

rustWalker.name = "rust-walker";
rustWalker.appearance.scale = 2.1;
rustWalker.chain.sections.head.chunks = 2;
rustWalker.chain.sections.trunk.chunks = 7;
rustWalker.chain.sections.tail.chunks = 3;
rustWalker.chain.sections.tail.spacing = 10;
rustWalker.chain.skin.plates[1].repeat.count = 10;
rustWalker.legs.pairs = 3;
rustWalker.definitions.paints.ribbon.fill = "#7c2f35";
rustWalker.definitions.paints.ribbon.stroke = "#a8444a";
rustWalker.definitions.paints.shell.fill = "#a8444a";
rustWalker.definitions.paints.shell.stroke = "#da7175";
rustWalker.definitions.paints.leg.fill = "#8d2b32";
rustWalker.definitions.paints.foot.fill = "#51252a";
rustWalker.definitions.paints.foot.stroke = "#8d2b32";
rustWalker.definitions.paints["ornament-1"].fill = "#f2d58f";
rustWalker.definitions.paints["ornament-1"].stroke = "#17191d";
