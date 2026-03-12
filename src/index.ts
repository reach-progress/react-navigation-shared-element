import * as React from "react";
import {
  waitForSharedElementTransitionsReady,
  SharedElementTransitionsReadyResult,
} from "react-native-shared-element";

import SharedElementRendererContext from "./SharedElementRendererContext";

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
export const __RNSE_BUILD_ID__ =
  "rnse-nav-native-only-2026-02-26-close-sync-timeout-defaults-v5";
