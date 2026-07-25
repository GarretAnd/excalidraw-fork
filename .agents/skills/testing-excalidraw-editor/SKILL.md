---
name: testing-excalidraw-editor
description: How to run and UI-test the Excalidraw fork locally (dev server, drawing shapes, selection, zoom shortcuts, command palette).
---

# Testing the Excalidraw fork locally

## Running the app
- `yarn start` from the repo root starts the excalidraw-app Vite dev server. It prefers port 3000 but
  **falls back to 3001+ if 3000 is taken** — always read the "Local: http://localhost:PORT/" line from the
  dev server output instead of assuming 3000.
- No login, secrets, or backend are needed for editor-level features; scenes persist in localStorage.
- HMR works for `packages/excalidraw/**`, so you can temporarily comment out a line (e.g. a command-palette
  registration) to A/B a behaviour against the base implementation without restarting or checking out a
  second worktree. Revert the edit and verify with `git status` before finishing.

## Interacting with the canvas
- Draw a shape: press the tool key (`r` rectangle, `d` diamond, `o` ellipse) then **drag with
  `left_mouse_down` → several `mouse_move` steps → `left_mouse_up`**. A single fast `left_click_drag`
  is unreliable and often creates nothing.
- Shapes default to **transparent background**, so clicking inside a shape does NOT select it — click
  exactly on its stroke/border. Shift+click a second shape's border to extend the selection.
- When anything is selected, the left properties panel covers roughly x < 140px; keep test shapes to the
  right of that so they remain visible in screenshots.
- The zoom percentage is the button in the bottom-left footer (`aria-label="Reset zoom"`); read it via a
  `zoom` action on the region around (0,690)-(300,740) to assert zoom changes precisely.

## Shortcuts worth knowing
- `Shift+1` zoom to fit all, `Shift+2` fit selection in viewport (scale-down), `Shift+3` fit selection
  (contain). Digit keys without Shift switch tools (`1` selection, `2` rectangle, `3` diamond, `4` ellipse …),
  so a new `Shift+<digit>` action should always be regression-checked against the plain digit tool key.
- Command palette: **Ctrl+/** or **Ctrl+Shift+P** (`CommandPalette.tsx: isCommandPaletteToggleShortcut`).

## Gotchas when adding new actions
- The command palette renders rows with `key={command.label}`. If a new action's translated label duplicates
  an existing action's label (e.g. `buttons.zoomToSelection` vs `helpDialog.zoomToSelection`, both
  "Zoom to selection"), the palette shows duplicated rows and logs React "two children with the same key"
  errors. Always search the palette for the new label and check the browser console.
- Shortcut hints in the palette come from `actionShortcuts` in `packages/excalidraw/actions/shortcuts.ts`;
  an action missing there renders with no shortcut badge even though the keyTest works.
- Also watch the console for `Canceling as multiple actions match this shortcut` — it indicates two actions
  claim the same key combo.

## Devin Secrets Needed
- None.
