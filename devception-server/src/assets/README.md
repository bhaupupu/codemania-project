# Puzzle Lock image assets

`puzzle-images.json` contains four images supplied for Puzzle Lock, in this order:

1. `20251110_221710-COLLAGE.jpg`
2. `575829115_1503875194019048_3452257758466103554_n.jpg`
3. `575474331_2327774334341510_8705896962650799025_n.jpg`
4. `WhatsApp Image 2025-11-08 at 20.51.22_820051ba.jpg`

Each photo was center-cropped to its largest square, divided into a 4×4 grid,
and resized to sixteen 128×128 JPEG tiles using bicubic interpolation. No
images were generated. The JSON is an array of four arrays of sixteen JPEG
data URLs in row-major order. Keep this file server-only: the service assigns
fresh random tile IDs and shuffles the tiles before sending them to a target.

Puzzle state follows the existing in-memory live-game lifetime. Reconnects to
that game restore the last server-accepted arrangement. Server restarts do not
persist live puzzles. The 20-second countdown is a target, not an automatic
unlock: solving all sixteen positions is required until the game ends.

Validation tests (from `devception-server`):

```sh
node --import tsx --test --test-force-exit src/tests/puzzleSabotage.test.ts
```

The force-exit flag is needed because importing the existing game service
starts its background cleanup interval.
