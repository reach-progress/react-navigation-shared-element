import {
  captureSharedElementSnapshots,
  clearSharedElementSnapshots,
  supportsSharedElementSnapshots,
} from "react-native-shared-element";

import { SharedElementCompatRouteProxy } from "./SharedElementCompatRouteProxy";
import SharedElementSceneData, {
  SharedElementSceneEventType,
} from "./SharedElementSceneData";
import {
  SharedElementEventSubscription,
  SharedElementsStrictConfig,
  SharedElementTransitionProps,
  SharedElementRoute,
} from "./types";
import { normalizeSharedElementsConfig } from "./utils";

export type SharedElementRendererUpdateHandler = () => any;

export interface ISharedElementRendererData {
  startTransition(
    closing: boolean,
    navigatorId: string,
    nestingDepth: number
  ): void;
  endTransition(
    closing: boolean | undefined,
    navigatorId: string,
    nestingDepth: number
  ): void;
  updateSceneState(
    scene: SharedElementSceneData,
    eventType: SharedElementSceneEventType
  ): void;
  removeScene(scene: SharedElementSceneData): void;
  primeClosingTransitionsPreview(): SharedElementTransitionProps[];
  activateClosingTransitionsPreview(): boolean;
  clearClosingTransitionsPreview(): void;
  prepareSceneSnapshots(
    scene: SharedElementSceneData,
    ids: string[]
  ): Promise<void>;
  readonly nestingDepth: number;
  addDebugRef(): number;
  releaseDebugRef(): number;
}

function getSharedElements(
  scene: SharedElementSceneData,
  otherScene: SharedElementSceneData,
  showing: boolean
): SharedElementsStrictConfig | null {
  const sharedElements = scene.getSharedElements();
  if (!sharedElements) return null;
  return normalizeSharedElementsConfig(
    sharedElements(
      new SharedElementCompatRouteProxy(scene.route),
      new SharedElementCompatRouteProxy(otherScene.route),
      showing
    )
  );
}

const NO_SHARED_ELEMENTS: any[] = [];

const getSnapshotKey = (routeKey: string, id: string) => `${routeKey}:${id}`;

type SceneRoute = {
  scene: SharedElementSceneData;
  subscription: SharedElementEventSubscription | null;
};

/**
 * TODO
 * - [ ] Not all lifecycle events not emitted by stack when using gestures (close modal)
 */

export default class SharedElementRendererData
  implements ISharedElementRendererData
{
  private closingTransitionStarter?: () => void;
  private nativeDriver: boolean;
  private nativeDuration?: number;
  private nativeDelay?: number;

  constructor(options?: {
    nativeDuration?: number;
    nativeDelay?: number;
  }) {
    this.nativeDriver = true;
    this.nativeDuration = options?.nativeDuration;
    this.nativeDelay = options?.nativeDelay;
  }

  private scenes: SceneRoute[] = [];
  private updateSubscribers = new Set<SharedElementRendererUpdateHandler>();
  private sharedElements: SharedElementsStrictConfig | null = null;
  private isShowing: boolean = true;

  private route: SharedElementRoute | null = null;
  private prevRoute: SharedElementRoute | null = null;

  private scene: SharedElementSceneData | null = null;
  private prevScene: SharedElementSceneData | null = null;

  private isTransitionStarted: boolean = false;
  private isTransitionClosing: boolean = false;
  private transitionNavigatorId: string = "";
  private transitionNestingDepth: number = -1;
  private nativeTransitionGroupSequence: number = 0;
  private nativeTransitionGroupId: string | null = null;
  private closePreviewPrevRouteKeyByRouteKey = new Map<string, string>();
  private capturedSnapshotRouteKeys = new Set<string>();
  private closeSyncPreviewTransitions: SharedElementTransitionProps[] | null =
    null;

  public debugRefCount: number = 0;

  startTransition(closing: boolean, navigatorId: string, nestingDepth: number) {
    if (this.debug)
      console.debug(
        `[${navigatorId}]startTransition, closing: ${closing}, nestingDepth: ${nestingDepth}`
      );

    // If the user re-opens a shared-element route before the prior close
    // transition has fully ended, ensure we transition from the current
    // visible route instead of stale close state.
    if (this.isTransitionStarted && this.isTransitionClosing && !closing) {
      this.prevRoute = this.route;
      this.clearClosingTransitionsPreview();
      if (this.debug) {
        console.debug(`[${navigatorId}]startTransition reopening-while-closing`, {
          route: this.route?.name,
          prevRoute: this.prevRoute?.name,
          nestingDepth,
        });
      }
    }

    if (!this.isTransitionStarted || this.route) {
      if (
        !this.prevRoute ||
        (this.route && this.prevRoute.key === this.route.key)
      ) {
        this.prevRoute = this.route;
      }

      const hasRoutePair =
        this.route &&
        this.prevRoute &&
        this.prevRoute.key !== this.route.key;
      if (!hasRoutePair) {
        this.route = null;
      }

      this.isTransitionStarted = true;
      this.isTransitionClosing = closing;
      if (!closing) {
        this.clearClosingTransitionsPreview();
      }
      this.transitionNavigatorId = navigatorId;
      this.transitionNestingDepth = nestingDepth;
      if (this.debug) {
        console.debug(`[${navigatorId}]transitionState`, {
          route: this.route?.name,
          prevRoute: this.prevRoute?.name,
          closing,
          nestingDepth,
        });
      }

    } else {
      // When navigators are nested, `startTransition` may be called multiple
      // times. In such as case, we want to use the most shallow navigator,
      // as that is the one doing the transition.
      if (nestingDepth < this.transitionNestingDepth) {
        this.transitionNavigatorId = navigatorId;
        this.transitionNestingDepth = nestingDepth;
      }
    }

    if (closing) {
      this.startClosingTransitionsPreview();
    }
  }

  endTransition(
    closingInput: boolean | undefined,
    navigatorId: string,
    nestingDepth: number
  ) {
    const closing =
      typeof closingInput === "boolean" ? closingInput : this.isTransitionClosing;
    if (this.debug)
      console.debug(
        `[${navigatorId}]endTransition, closing: ${closing}, nestingDepth: ${nestingDepth}`,
        {
          closingInput,
          transitionClosing: this.isTransitionClosing,
        }
      );

    if (
      !this.isTransitionStarted ||
      this.transitionNavigatorId !== navigatorId ||
      this.isTransitionClosing !== closing
    ) {
      return;
    }

    this.isTransitionStarted = false;
    if (closing) {
      this.clearClosingTransitionsPreview();
      this.clearCapturedSnapshots();
    }

    if (this.prevRoute != null) {
      this.prevRoute = null;
      this.updateSceneListeners();
      this.updateSharedElements();
    }
  }

  updateSceneState(
    scene: SharedElementSceneData,
    eventType: SharedElementSceneEventType
  ): void {
    switch (eventType) {
      case "willFocus":
        return this.willFocusScene(scene);
      case "didFocus":
        return this.didFocusScene(scene);
      case "willBlur":
        return this.willBlurScene(scene);
    }
  }

  removeScene(scene: SharedElementSceneData): void {
    const routeKey = scene.route.key;
    this.clearCapturedSnapshotsForRoute(routeKey);
    this.scenes = this.scenes.filter((sceneRoute) => {
      const match =
        sceneRoute.scene === scene || sceneRoute.scene.route.key === routeKey;
      if (!match) return true;
      sceneRoute.subscription?.();
      return false;
    });

    if (this.route?.key === routeKey) {
      this.route = null;
    }
    if (this.prevRoute?.key === routeKey) {
      this.prevRoute = null;
    }
    if (this.scene?.route.key === routeKey) {
      this.scene = null;
    }
    if (this.prevScene?.route.key === routeKey) {
      this.prevScene = null;
    }

    for (const [key, value] of this.closePreviewPrevRouteKeyByRouteKey) {
      if (key === routeKey || value === routeKey) {
        this.closePreviewPrevRouteKeyByRouteKey.delete(key);
      }
    }

    // If routes were unmounted during an in-flight transition and no route
    // pair remains, clear transition state so future transitions can start.
    if (this.isTransitionStarted && !this.route && !this.prevRoute) {
      this.isTransitionStarted = false;
      this.isTransitionClosing = false;
      this.transitionNavigatorId = "";
      this.transitionNestingDepth = -1;
      this.clearClosingTransitionsPreview();
    }

    this.updateSceneListeners();
    this.updateSharedElements();
  }

  addDebugRef(): number {
    return ++this.debugRefCount;
  }

  releaseDebugRef(): number {
    return --this.debugRefCount;
  }

  get debug() {
    return this.debugRefCount > 0;
  }

  willFocusScene(scene: SharedElementSceneData): void {
    if (this.debug)
      console.debug(
        `[${scene.navigatorId}]willFocus, scene: "${scene.name}", depth: ${scene.nestingDepth}, closing: ${this.isTransitionClosing}`
      );
    this.registerScene(scene);

    // In case of nested navigators, multiple scenes will become
    // activated. Make sure to use the scene that is nested most deeply,
    // as this will be the one visible to the user
    if (!this.route) {
      this.route = scene.route;
    } else {
      const routeScene = this.getScene(this.route);
      if (routeScene && routeScene.nestingDepth <= scene.nestingDepth) {
        this.route = scene.route;
      }
    }

    // Wait for a transition start, before starting any animations
    if (!this.isTransitionStarted) return;

    // Update transition
    if (this.prevRoute && this.route && this.nativeDriver) {
      if (this.debug) {
        console.debug(`[${scene.navigatorId}]willFocus->update`, {
          route: this.route?.name,
          prevRoute: this.prevRoute?.name,
          closing: this.isTransitionClosing,
        });
      }
      this.updateSceneListeners();
      this.updateSharedElements();
    }
  }

  didFocusScene(scene: SharedElementSceneData): void {
    if (this.debug)
      console.debug(
        `[${scene.navigatorId}]didFocus, scene: "${scene.name}", depth: ${scene.nestingDepth}`
      );

    if (!this.route || this.prevRoute) {
      this.route = scene.route;
    } else {
      const routeScene = this.getScene(this.route);
      if (routeScene && routeScene.nestingDepth <= scene.nestingDepth) {
        this.route = scene.route;
      }
    }
    this.registerScene(scene);
  }

  willBlurScene(scene: SharedElementSceneData): void {
    if (this.debug)
      console.debug(
        `[${scene.navigatorId}]willBlur, scene: "${scene.name}", depth: ${scene.nestingDepth}`
      );

    // Capture the previous route before focus changes overwrite it.
    if (!this.isTransitionStarted) {
      if (!this.prevRoute || this.prevRoute.key === scene.route.key) {
        this.prevRoute = scene.route;
      }
    }

    // Wait for a transition start, before starting any animations
    if (!this.isTransitionStarted) return;

    // Update transition
    if (this.prevRoute && this.route && this.nativeDriver) {
      if (this.debug) {
        console.debug(`[${scene.navigatorId}]willBlur->update`, {
          route: this.route?.name,
          prevRoute: this.prevRoute?.name,
          closing: this.isTransitionClosing,
        });
      }
      this.updateSceneListeners();
      this.updateSharedElements();
    }
  }

  private registerScene(scene: SharedElementSceneData) {
    const existingIndex = this.scenes.findIndex(
      (sceneRoute) => sceneRoute.scene.route.key === scene.route.key
    );
    if (existingIndex >= 0) {
      const existing = this.scenes[existingIndex];
      if (existing.scene !== scene) {
        existing.subscription?.();
        existing.subscription = null;
        existing.scene = scene;
      }
      this.scenes.splice(existingIndex, 1);
      this.scenes.push(existing);
    } else {
      this.scenes.push({
        scene,
        subscription: null,
      });
    }
    if (this.scenes.length > 10) {
      const { subscription } = this.scenes[0];
      this.scenes.splice(0, 1);
      subscription?.();
    }
    this.updateSceneListeners();
  }

  private updateSceneListeners() {
    this.scenes.forEach((sceneRoute) => {
      const { scene, subscription } = sceneRoute;
      const isActive =
        (this.route && this.route.key === scene.route.key) ||
        (this.prevRoute && this.prevRoute.key === scene.route.key);
      if (isActive && !subscription) {
        sceneRoute.subscription = scene.addUpdateListener(() => {
          // TODO: optimize?
          this.emitUpdateEvent();
        });
      } else if (!isActive && subscription) {
        sceneRoute.subscription = null;
        subscription();
      }
    });
  }

  private getScene(
    route: SharedElementRoute | null
  ): SharedElementSceneData | null {
    const sceneRoute = route
      ? this.scenes.find((sc) => sc.scene.route.key === route.key)
      : undefined;
    return sceneRoute ? sceneRoute.scene : null;
  }

  private captureSceneSnapshots(scene: SharedElementSceneData): void {
    if (!supportsSharedElementSnapshots()) return;
    const elements = scene.getNodes().map(({ id, node }) => ({
      key: getSnapshotKey(scene.route.key, id),
      node,
    }));
    if (!elements.length) return;
    this.capturedSnapshotRouteKeys.add(scene.route.key);
    // A pressed element may already have an unscaled snapshot. Preserve it
    // while filling the cache with the other visible elements on this route.
    void captureSharedElementSnapshots(scene.route.key, elements, {
      preserveExisting: true,
    }).catch(() => undefined);
  }

  public async prepareSceneSnapshots(
    scene: SharedElementSceneData,
    ids: string[]
  ): Promise<void> {
    if (!supportsSharedElementSnapshots()) return;
    const requestedIds = new Set(ids);
    const elements = scene
      .getNodes()
      .filter(({ id }) => requestedIds.has(id))
      .map(({ id, node }) => ({
        key: getSnapshotKey(scene.route.key, id),
        node,
      }));
    if (!elements.length) return;

    try {
      const result = await captureSharedElementSnapshots(
        scene.route.key,
        elements
      );
      if (result.captured > 0) {
        this.capturedSnapshotRouteKeys.add(scene.route.key);
      }
    } catch {
      // Snapshot capture is an enhancement; a failed capture should not block
      // the press interaction or the transition's normal live-node fallback.
    }
  }

  private clearCapturedSnapshotsForRoute(routeKey: string): void {
    if (!this.capturedSnapshotRouteKeys.delete(routeKey)) return;
    void clearSharedElementSnapshots(routeKey);
  }

  private clearCapturedSnapshots(): void {
    for (const routeKey of this.capturedSnapshotRouteKeys) {
      void clearSharedElementSnapshots(routeKey);
    }
    this.capturedSnapshotRouteKeys.clear();
  }

  private getSnapshotTarget(
    endpointScene: SharedElementSceneData,
    otherScene: SharedElementSceneData,
    id: string,
    closing: boolean
  ): SharedElementTransitionProps["start"]["snapshot"] {
    const sourceForEndpoint = this.closePreviewPrevRouteKeyByRouteKey.get(
      otherScene.route.key
    );
    if (sourceForEndpoint !== endpointScene.route.key) return undefined;
    if (!this.capturedSnapshotRouteKeys.has(endpointScene.route.key)) {
      return undefined;
    }
    return {
      key: getSnapshotKey(endpointScene.route.key, id),
      mode: closing ? "require" : "prefer",
    };
  }

  private updateSharedElements() {
    const { route, prevRoute } = this;
    const scene = this.getScene(route);
    const prevScene = this.getScene(prevRoute);
    if (this.debug) {
      console.debug("[SE] updateSharedElements", {
        hasRouteAnim: false,
        route: route?.name,
        prevRoute: prevRoute?.name,
        hasScene: !!scene,
        hasPrevScene: !!prevScene,
      });
    }

    // Update current scene & previous scene
    if (scene === this.scene && prevScene === this.prevScene)
      return;
    this.scene = scene;
    this.prevScene = prevScene;

    // Update shared elements
    let sharedElements: SharedElementsStrictConfig | null = null;
    let isShowing = true;
    if (this.nativeDriver && scene && prevScene && route && prevRoute) {
      sharedElements = getSharedElements(scene, prevScene, true);
      if (!sharedElements) {
        isShowing = false;
        sharedElements = getSharedElements(prevScene, scene, false);
      }
    }
    if (this.sharedElements !== sharedElements) {
      if (this.debug) {
        if (sharedElements) {
          console.debug(
            `Transition start: "${prevScene?.name}" -> "${
              scene?.name
            }", elements: ${JSON.stringify(sharedElements, undefined, 2)}`
          );
        } else {
          console.debug(`Transition end: "${scene?.name}"`);
        }
      }
      this.sharedElements = sharedElements;
      this.isShowing = isShowing;
      if (sharedElements && scene && prevScene) {
        this.nativeTransitionGroupId = this.createNativeTransitionGroupId(
          `${scene.route.key}:${prevScene.route.key}`
        );
      } else {
        this.nativeTransitionGroupId = null;
      }
      if (
        sharedElements &&
        scene &&
        prevScene &&
        !this.isTransitionClosing
      ) {
        this.closePreviewPrevRouteKeyByRouteKey.set(
          scene.route.key,
          prevScene.route.key
        );
        this.captureSceneSnapshots(prevScene);
      }
      /*console.log(
        'updateSharedElements: ',
        sharedElements,
        ' ,isShowing: ',
        isShowing,
        ', animValue: ',
        animValue
      );*/
      this.emitUpdateEvent();
    }
  }

  addUpdateListener(
    handler: SharedElementRendererUpdateHandler
  ): SharedElementEventSubscription {
    this.updateSubscribers.add(handler);
    return () => this.updateSubscribers.delete(handler);
  }

  private emitUpdateEvent(): void {
    this.updateSubscribers.forEach((handler) => handler());
  }

  private createNativeTransitionGroupId(label: string): string {
    this.nativeTransitionGroupSequence += 1;
    return `${label}:${this.nativeTransitionGroupSequence}`;
  }

  private buildTransitions(
    sharedElements: SharedElementsStrictConfig,
    prevScene: SharedElementSceneData,
    scene: SharedElementSceneData,
    isShowing: boolean,
    closing: boolean,
    nativeGroupId: string | null
  ): SharedElementTransitionProps[] {
    return sharedElements.map(({ id, otherId, ...other }) => {
      const startId = isShowing ? otherId || id : id;
      const endId = isShowing ? id : otherId || id;
      const startNode = (prevScene ? prevScene.getNode(startId) : undefined);
      const endNode = (scene ? scene.getNode(endId) : undefined);
      const startSnapshot = this.getSnapshotTarget(
        prevScene,
        scene,
        startId,
        closing
      );
      const endSnapshot = this.getSnapshotTarget(
        scene,
        prevScene,
        endId,
        closing
      );
      if (this.debug && (!startNode || !endNode)) {
        console.debug(
          `[${scene.navigatorId}]missing nodes for transition "${prevScene.name}" -> "${scene.name}"`,
          {
            startId,
            endId,
            hasStart: !!startNode,
            hasEnd: !!endNode,
            isShowing,
          }
        );
      }
      const nativeFrom = closing ? (isShowing ? 1 : 0) : 0;
      const nativeTo = closing ? (isShowing ? 0 : 1) : 1;
      return {
        key: scene.route.key,
        start: {
          ancestor: (prevScene ? prevScene.getAncestor() : undefined) || null,
          node: startNode || null,
          snapshot: startSnapshot,
        },
        end: {
          ancestor: (scene ? scene.getAncestor() : undefined) || null,
          node: endNode || null,
          snapshot: endSnapshot,
        },
        ...(this.nativeDriver
          ? {
              nativeDriver: true,
              nativeDuration: this.nativeDuration ?? 300,
              nativeDelay: this.nativeDelay,
              nativeFrom,
              nativeTo,
              nativeGroup: nativeGroupId || undefined,
              nativeGroupSize: nativeGroupId
                ? sharedElements.length
                : undefined,
              nativePreparing: false,
            }
          : null),
        ...other,
      };
    });
  }

  getTransitions(): SharedElementTransitionProps[] {
    const { sharedElements, prevScene, scene, isShowing } = this;

    // The close probe is already measured before navigation starts. Reuse that
    // native view until transitionEnd so the image animation stays aligned
    // with the card instead of mounting after the card has finished.
    if (this.closeSyncPreviewTransitions) {
      return this.closeSyncPreviewTransitions;
    }
    if (!sharedElements || !scene || !prevScene) {
      return this.closeSyncPreviewTransitions || NO_SHARED_ELEMENTS;
    }
    return this.buildTransitions(
      sharedElements,
      prevScene,
      scene,
      isShowing,
      this.isTransitionClosing,
      this.nativeTransitionGroupId
    );
  }

  private computeClosingTransitionsPreview(): SharedElementTransitionProps[] {
    if (!this.nativeDriver || !this.route) return NO_SHARED_ELEMENTS;
    const currentScene = this.getScene(this.route);
    if (!currentScene) return NO_SHARED_ELEMENTS;

    const mappedPrevRouteKey =
      this.closePreviewPrevRouteKeyByRouteKey.get(currentScene.route.key);
    let destinationScene: SharedElementSceneData | null = mappedPrevRouteKey
      ? this.getScene({ key: mappedPrevRouteKey } as SharedElementRoute)
      : null;

    // Find the most recently registered sibling scene in the same navigator,
    // which should correspond to the destination for a close/goBack action.
    if (!destinationScene) {
      for (let i = this.scenes.length - 1; i >= 0; i--) {
        const candidate = this.scenes[i].scene;
        if (candidate.route.key === currentScene.route.key) continue;
        if (candidate.navigatorId !== currentScene.navigatorId) continue;
        if (candidate.nestingDepth !== currentScene.nestingDepth) continue;
        destinationScene = candidate;
        break;
      }
    }
    if (!destinationScene) {
      return NO_SHARED_ELEMENTS;
    }

    // Build the preview using the same direction as the real close transition:
    // start=current screen, end=destination screen.
    let sharedElements = getSharedElements(
      currentScene,
      destinationScene,
      false
    );
    let isShowing = false;
    if (!sharedElements) {
      sharedElements = getSharedElements(currentScene, destinationScene, true);
    }
    if (!sharedElements) {
      isShowing = true;
      sharedElements = getSharedElements(
        destinationScene,
        currentScene,
        true
      );
    }
    if (!sharedElements) {
      return NO_SHARED_ELEMENTS;
    }

    return this.buildTransitions(
      sharedElements,
      currentScene,
      destinationScene,
      isShowing,
      true,
      this.createNativeTransitionGroupId(
        `preview:${currentScene.route.key}:${destinationScene.route.key}`
      )
    );
  }

  primeClosingTransitionsPreview(): SharedElementTransitionProps[] {
    const transitions = this.computeClosingTransitionsPreview();
    this.closeSyncPreviewTransitions = transitions.length
      ? transitions.map((transition) => ({
          ...transition,
          nativeDriver: false,
          // Reuse this measured view for the close animation. Retaining its
          // native timing lets transitionStart release the paused overlay and
          // card together instead of mounting a late replacement.
          nativePreparing: true,
        }))
      : null;
    this.emitUpdateEvent();
    return transitions;
  }

  activateClosingTransitionsPreview(): boolean {
    if (!this.closeSyncPreviewTransitions) return false;
    const hasPreparingTransition = this.closeSyncPreviewTransitions.some(
      (transition) => transition.nativePreparing
    );
    if (!hasPreparingTransition) return false;

    this.closeSyncPreviewTransitions = this.closeSyncPreviewTransitions.map(
      (transition) => ({
        ...transition,
        // Mount the measured overlay before navigation starts, but leave its
        // driver paused so it cannot outrun the card transition.
        nativeDriver: false,
        nativePreparing: false,
      })
    );
    this.emitUpdateEvent();
    return true;
  }

  private startClosingTransitionsPreview(): void {
    if (!this.closeSyncPreviewTransitions) return;
    const hasPausedTransition = this.closeSyncPreviewTransitions.some(
      (transition) =>
        !transition.nativePreparing && !transition.nativeDriver
    );
    if (!hasPausedTransition) return;

    // The prepared native views already exist, so start them imperatively with
    // the card instead of waiting for Fabric to commit another render.
    this.closingTransitionStarter?.();
    this.closeSyncPreviewTransitions = this.closeSyncPreviewTransitions.map(
      (transition) => ({
        ...transition,
        nativeDriver: true,
      })
    );
    this.emitUpdateEvent();
  }

  setClosingTransitionStarter(starter?: () => void): void {
    this.closingTransitionStarter = starter;
  }

  clearClosingTransitionsPreview(): void {
    if (!this.closeSyncPreviewTransitions) return;
    this.closeSyncPreviewTransitions = null;
    this.emitUpdateEvent();
  }

  get nestingDepth(): number {
    return 0;
  }
}
