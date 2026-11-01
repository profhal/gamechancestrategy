# The Arcade — reusable CSS edition

This is a static GitHub Pages site. No build system, package manager, or framework is required.

## Files

- `index.html`, `nim.html`, `tictactoe.html`, `mancala.html`, `reversi.html`, `potion-commotion.html`: unchanged public page URLs, with original JavaScript preserved.
- `css/arcade.css`: **shared styling** for interface elements repeated in at least three original pages, plus a small documented palette of default custom properties.
- `css/pages/<name>.css`: **page-specific styling**, including individual board/piece visuals and rules not yet common enough to centralize.
- `game-template.html`: a starter page for building a new game; intentionally not linked from the homepage.
- `css/pages/template.css`: starter page styling.

## Editing a game

The HTML loads the common CSS first and the page-specific CSS second. Edit `css/arcade.css` for shared UI; edit the page stylesheet for unique visuals. CSS selectors in a page stylesheet can override common rules. Some original pages intentionally have distinct themes; this refactor preserves them rather than forcibly unifying their appearance.

## Starting a new game

1. Copy `game-template.html` to `new-game.html`.
2. Copy `css/pages/template.css` to `css/pages/new-game.css`.
3. Change the second stylesheet reference in `new-game.html` to `css/pages/new-game.css`.
4. Add game rules, board markup, JavaScript mechanics, and agent strategies.
5. Link the new game from `index.html` when ready.

## Deployment

Upload the files to the same GitHub Pages root. **Keep the `css/` directory**; pages will otherwise be unstyled. The original HTML filenames and navigation links have not moved.

## Notes

This is a conservative CSS extraction, not a redesign. Original scripts and game markup are retained byte-for-byte except for the replacement of inline `<style>` blocks with stylesheet links. Common CSS rules were moved out of the page files where the original declarations matched exactly; unique declarations remain local. Test the pages after deploying, especially interactive hover/focus states, because CSS cascade order can occasionally matter when shared rules are moved.
