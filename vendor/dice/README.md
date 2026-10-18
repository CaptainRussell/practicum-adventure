# Dice graphics

Built locally from `@3d-dice/dice-box-threejs` 0.0.12 using
`tools/dice-renderer.js`. Run `npm ci` and `npm run build:dice` to rebuild.

Upstream: https://github.com/3d-dice/dice-box-threejs

This bundle includes Three.js and Cannon ES. Their MIT license notices and
the Dice Box ThreeJS MIT license are in this directory. No upstream image,
audio or third-party theme assets are used; face textures are generated.

The adapter adds cleanup for graphics resources, cancels playback when its
overlay closes, and uses upstream's predetermined-outcome notation. It also
clears the D4's cached simulation result so it reports the visible throw.
It does not alter the game's random results or rotate dice to a target at
the end.
