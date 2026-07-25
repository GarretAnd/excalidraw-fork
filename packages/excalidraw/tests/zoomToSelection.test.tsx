import React from "react";

import { CODES } from "@excalidraw/common";

import { Excalidraw } from "../index";
import {
  actionZoomToFitSelection,
  actionZoomToSelection,
} from "../actions/actionCanvas";
import { getNormalizedZoom } from "../scene";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import {
  act,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  waitFor,
} from "./test-utils";

import type { Action } from "../actions/types";

const { h } = window;

const VIEWPORT = { width: 1000, height: 800 };

const SELECTION = { x: 1000, y: 1000, width: 400, height: 400 };

const viewportState = () => ({
  scrollX: h.state.scrollX,
  scrollY: h.state.scrollY,
  zoom: h.state.zoom.value,
});

const resetViewport = () => {
  act(() => {
    h.setState({
      scrollX: 0,
      scrollY: 0,
      zoom: { value: getNormalizedZoom(1) },
    });
  });
};

const executeAction = (action: Action) => {
  act(() => {
    h.app.actionManager.executeAction(action, "ui");
  });
};

const pressShortcut = () => {
  Keyboard.withModifierKeys({ shift: true }, () => {
    Keyboard.codePress(CODES.FOUR);
  });
};

describe("actionZoomToSelection", () => {
  beforeEach(async () => {
    mockBoundingClientRect(VIEWPORT);
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    await waitFor(() => expect(h.state.width).toBe(VIEWPORT.width));
  });

  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
  });

  const createSelectedRect = () => {
    const rect = API.createElement({ type: "rectangle", ...SELECTION });
    API.setElements([rect]);
    API.setSelectedElements([rect]);
    return rect;
  };

  it("is disabled without a selection", () => {
    API.setElements([API.createElement({ type: "rectangle", ...SELECTION })]);

    expect(h.app.actionManager.isActionEnabled(actionZoomToSelection)).toBe(
      false,
    );
  });

  it("is enabled with a selection", () => {
    createSelectedRect();

    expect(h.app.actionManager.isActionEnabled(actionZoomToSelection)).toBe(
      true,
    );
  });

  it("zooms and scrolls so the selection fits the viewport", () => {
    createSelectedRect();

    expect(viewportState()).toEqual({ scrollX: 0, scrollY: 0, zoom: 1 });

    // the fit for a selection matches what zoom-to-fit-selection produces
    executeAction(actionZoomToFitSelection);
    const expected = viewportState();
    resetViewport();

    executeAction(actionZoomToSelection);

    expect(viewportState()).toEqual(expected);
    expect(h.state.zoom.value).not.toBe(1);
    expect(h.state.scrollX).not.toBe(0);
    expect(h.state.scrollY).not.toBe(0);
  });

  it("zooms to the selection on shift+4", () => {
    createSelectedRect();

    executeAction(actionZoomToSelection);
    const expected = viewportState();
    resetViewport();

    pressShortcut();

    expect(viewportState()).toEqual(expected);
  });

  it("does nothing on shift+4 without a selection", () => {
    API.setElements([API.createElement({ type: "rectangle", ...SELECTION })]);

    pressShortcut();

    expect(viewportState()).toEqual({ scrollX: 0, scrollY: 0, zoom: 1 });
  });
});
