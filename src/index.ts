import * as React from "react";
import {
  waitForSharedElementTransitionsReady,
  SharedElementTransitionsReadyResult,
} from "react-native-shared-element";

import SharedElementRendererContext from "./SharedElementRendererContext";
import SharedElementSceneContext from "./SharedElementSceneContext";

export * from "./types";

export { default as createSharedElementStackNavigator } from "./createSharedElementStackNavigator";

export { default as SharedElement } from "./SharedElement";
const CLOSE_SYNC_TIMEOUT_MS = 180;

export function useSharedElementCloseSync() {
  const rendererData = React.useContext(SharedElementRendererContext);

  return React.useCallback(
    async (): Promise<SharedElementTransitionsReadyResult> => {
      if (!rendererData) {
        return {
          ready: false,
          reason: "renderer-unavailable",
          waitedMs: 0,
          transitionCount: 0,
          results: [],
        };
      }
      const transitions = rendererData.primeClosingTransitionsPreview();
      const result = await waitForSharedElementTransitionsReady(
        transitions,
        {
          timeoutMs: CLOSE_SYNC_TIMEOUT_MS,
        }
      );
      if (!result.ready) {
        rendererData.clearClosingTransitionsPreview();
      }
      return result;
    },
    [rendererData]
  );
}

/** Captures the selected source elements before press feedback can transform them. */
export function useSharedElementPrePressSnapshot() {
  const rendererData = React.useContext(SharedElementRendererContext);
  const sceneData = React.useContext(SharedElementSceneContext);

  return React.useCallback(
    async (ids: string[]): Promise<void> => {
      if (!rendererData || !sceneData) return;
      await rendererData.prepareSceneSnapshots(sceneData, ids);
    },
    [rendererData, sceneData]
  );
}
