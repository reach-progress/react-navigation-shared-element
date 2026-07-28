import { ISharedElementRendererData } from "./SharedElementRendererData";
import SharedElementSceneData, {
  SharedElementSceneEventType,
} from "./SharedElementSceneData";
import { SharedElementTransitionProps } from "./types";

export class SharedElementRendererProxy implements ISharedElementRendererData {
  private data: ISharedElementRendererData | null = null;

  startTransition(closing: boolean, navigatorId: string, nestingDepth: number) {
    if (!this.data) {
      console.warn(
        "SharedElementRendererProxy.startTransition called before Proxy was initialized"
      );
      return;
    }
    return this.data.startTransition(closing, navigatorId, nestingDepth);
  }

  endTransition(
    closing: boolean | undefined,
    navigatorId: string,
    nestingDepth: number
  ) {
    if (!this.data) {
      console.warn(
        "SharedElementRendererProxy.endTransition called before Proxy was initialized"
      );
      return;
    }
    return this.data.endTransition(closing, navigatorId, nestingDepth);
  }

  updateSceneState(
    scene: SharedElementSceneData,
    eventType: SharedElementSceneEventType
  ) {
    if (!this.data) {
      console.warn(
        "SharedElementRendererProxy.updateSceneState called before Proxy was initialized"
      );
      return;
    }
    return this.data.updateSceneState(scene, eventType);
  }

  removeScene(scene: SharedElementSceneData): void {
    if (!this.data) {
      return;
    }
    this.data.removeScene(scene);
  }

  primeClosingTransitionsPreview(): SharedElementTransitionProps[] {
    if (!this.data) {
      return [];
    }
    return this.data.primeClosingTransitionsPreview();
  }

  activateClosingTransitionsPreview(): boolean {
    if (!this.data) {
      return false;
    }
    return this.data.activateClosingTransitionsPreview();
  }

  clearClosingTransitionsPreview(): void {
    if (!this.data) {
      return;
    }
    this.data.clearClosingTransitionsPreview();
  }

  prepareSceneSnapshots(
    scene: SharedElementSceneData,
    ids: string[]
  ): Promise<void> {
    if (!this.data) {
      return Promise.resolve();
    }
    return this.data.prepareSceneSnapshots(scene, ids);
  }

  get source(): ISharedElementRendererData | null {
    return this.data;
  }

  set source(data: ISharedElementRendererData | null) {
    this.data = data;
  }

  get nestingDepth(): number {
    if (!this.data) {
      console.warn(
        "SharedElementRendererProxy.nestingDepth called before Proxy was initialized"
      );
      return 0;
    }
    return this.data.nestingDepth + 1;
  }

  addDebugRef(): number {
    if (!this.data) {
      console.warn(
        "SharedElementRendererProxy.addDebugRef called before Proxy was initialized"
      );
      return 0;
    }
    return this.data.addDebugRef();
  }

  releaseDebugRef(): number {
    if (!this.data) {
      console.warn(
        "SharedElementRendererProxy.relaseDebugRef called before Proxy was initialized"
      );
      return 0;
    }
    return this.data.releaseDebugRef();
  }
}
