import React from "react";

import { CODES } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { Keyboard } from "./helpers/ui";
import { render } from "./test-utils";

describe("ruler mode", () => {
  it("should toggle ruler mode from the action manager", async () => {
    await render(<Excalidraw handleKeyboardGlobally />);

    expect(window.h.state.rulerModeEnabled).toBe(false);

    Keyboard.withModifierKeys({ shift: true }, () => {
      Keyboard.codePress(CODES.R);
    });

    expect(window.h.state.rulerModeEnabled).toBe(true);

    Keyboard.withModifierKeys({ shift: true }, () => {
      Keyboard.codePress(CODES.R);
    });

    expect(window.h.state.rulerModeEnabled).toBe(false);
  });

  it("should disable the keyboard shortcut when the prop is controlled", async () => {
    await render(<Excalidraw rulerModeEnabled handleKeyboardGlobally />);

    expect(window.h.state.rulerModeEnabled).toBe(true);

    Keyboard.withModifierKeys({ shift: true }, () => {
      Keyboard.codePress(CODES.R);
    });

    expect(window.h.state.rulerModeEnabled).toBe(true);
  });

  it("should toggle ruler mode via executeAction", async () => {
    await render(<Excalidraw />);

    expect(window.h.state.rulerModeEnabled).toBe(false);

    React.act(() => {
      window.h.app.actionManager.executeAction(
        window.h.app.actionManager.actions.ruler,
        "ui",
      );
    });

    expect(window.h.state.rulerModeEnabled).toBe(true);
  });
});
