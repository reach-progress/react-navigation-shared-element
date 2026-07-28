import {
  SharedElementNode,
  SharedElementEventSubscription,
  SharedElementRoute,
  SharedElementSceneComponent,
  SharedElementsComponentConfig,
} from "./types";

export type SharedElementSceneUpdateHandlerEventType =
  | "ancestor"
  | "add"
  | "remove";

export type SharedElementSceneUpdateHandler = (
  eventType: SharedElementSceneUpdateHandlerEventType,
  node: SharedElementNode | undefined,
  id: string
) => any;

export type SharedElementSceneEventType =
  | "willFocus"
  | "didFocus"
  | "willBlur"
  | "didBlur";

export default class SharedElementSceneData {
  private updateSubscribers = new Set<SharedElementSceneUpdateHandler>();
  private ancestorNode?: SharedElementNode = undefined;
  private nodes: {
    [key: string]: SharedElementNode[];
  } = {};
  public readonly getSharedElements: () => SharedElementsComponentConfig | void;
  public readonly name: string;
  public readonly navigatorId: string;
  public readonly nestingDepth: number;
  public readonly debug: boolean;
  public readonly route: SharedElementRoute;

  constructor(
    Component: SharedElementSceneComponent,
    getSharedElements: () => SharedElementsComponentConfig | void,
    route: SharedElementRoute,
    navigatorId: string,
    nestingDepth: number,
    debug: boolean
  ) {
    this.getSharedElements = getSharedElements;
    this.route = route;
    this.navigatorId = navigatorId;
    this.nestingDepth = nestingDepth;
    this.debug = debug;
    this.name =
      Component.displayName ||
      Component.name ||
      (Component.constructor ? Component.constructor.name : undefined) ||
      "";
  }

  public updateRoute(route: SharedElementRoute) {
    if (route.key !== this.route.key) {
      throw new Error(
        "SharedElementNavigation: Integrity error, route key should never change"
      );
    }
    // @ts-ignore
    this.route = route;
  }

  getAncestor(): SharedElementNode | undefined {
    return this.ancestorNode;
  }

  setAncestor(ancestorNode: SharedElementNode | null) {
    // console.log('SharedElementSceneData.setAncestor');
    if (this.ancestorNode === ancestorNode) return;
    this.ancestorNode = ancestorNode || undefined;
    if (this.debug) {
      console.debug(
        `[${this.navigatorId}]setAncestor scene="${this.name}"`
      );
    }
    this.emitUpdateEvent("ancestor", this.ancestorNode, "");
  }

  addNode(id: string, node: SharedElementNode): void {
    // console.log('SharedElementSceneData.addNode: ', id);
    // Nested routes can stay mounted inside one outer scene and register the
    // same ID. Keep both so removing the top route restores its source node.
    const nodes = this.nodes[id] || [];
    const existingIndex = nodes.indexOf(node);
    if (existingIndex >= 0) {
      nodes.splice(existingIndex, 1);
    }
    nodes.push(node);
    this.nodes[id] = nodes;
    if (this.debug) {
      console.debug(
        `[${this.navigatorId}]addNode scene="${this.name}" id="${id}"`
      );
    }
    this.emitUpdateEvent("add", node, id);
  }

  removeNode(id: string, node: SharedElementNode): void {
    // console.log('SharedElementSceneData.removeNode: ', id);
    const nodes = this.nodes[id];
    if (!nodes) return;
    const nodeIndex = nodes.indexOf(node);
    if (nodeIndex < 0) return;
    nodes.splice(nodeIndex, 1);
    if (!nodes.length) {
      delete this.nodes[id];
    }
    if (this.debug) {
      console.debug(
        `[${this.navigatorId}]removeNode scene="${this.name}" id="${id}"`
      );
    }
    this.emitUpdateEvent("remove", node, id);
  }

  getNode(id: string): SharedElementNode | undefined {
    const nodes = this.nodes[id];
    return nodes?.[nodes.length - 1];
  }

  getNodes(): Array<{ id: string; node: SharedElementNode }> {
    return Object.entries(this.nodes).map(([id, nodes]) => ({
      id,
      node: nodes[nodes.length - 1],
    }));
  }

  addUpdateListener(
    handler: SharedElementSceneUpdateHandler
  ): SharedElementEventSubscription {
    this.updateSubscribers.add(handler);
    return () => this.updateSubscribers.delete(handler);
  }

  private emitUpdateEvent(
    eventType: SharedElementSceneUpdateHandlerEventType,
    node: SharedElementNode | undefined,
    id: string
  ): void {
    this.updateSubscribers.forEach((handler) => handler(eventType, node, id));
  }
}
