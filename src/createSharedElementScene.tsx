import { Route, NavigationState } from "@react-navigation/native";
import {
  StackNavigationProp,
  StackCardInterpolationProps,
} from "@react-navigation/stack";
import hoistNonReactStatics from "hoist-non-react-statics";
import * as React from "react";
import {
  View,
  StyleSheet,
  InteractionManager,
  Platform,
} from "react-native";
import { nodeFromRef } from "react-native-shared-element";

import { ISharedElementRendererData } from "./SharedElementRendererData";
import SharedElementSceneContext from "./SharedElementSceneContext";
import SharedElementSceneData from "./SharedElementSceneData";
import {
  SharedElementEventSubscription,
  SharedElementSceneComponent,
  SharedElementRoute,
  SharedElementsComponentConfig,
} from "./types";
import { EventEmitter } from "./utils/EventEmitter";

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

type PropsType = {
  navigation: StackNavigationProp<any>;
  route: SharedElementRoute;
};

function isValidNavigationState(
  state: Partial<NavigationState>
): state is NavigationState {
  return "index" in state && "routes" in state;
}

// Gets the current screen from navigation state
function getActiveRoute(state: NavigationState): Route<any> {
  const route = state.routes[state.index];
  const routeState = route.state as Partial<NavigationState>;
  return route.state && isValidNavigationState(routeState)
    ? getActiveRoute(routeState) // Dive into nested navigators
    : route;
}

function isActiveRoute(
  navigation: StackNavigationProp<any>,
  route: Route<any>
): boolean {
  // @ts-ignore: getState is supported by navigation 6
  const state: NavigationState = navigation.getState
    ? // @ts-ignore: getState is supported by navigation 6
      navigation.getState()
    : // @ts-ignore: dangerouslyGetState is provided for navigation 5 compatibility
      navigation.dangerouslyGetState();
  const activeRoute = getActiveRoute(state);
  return route.name === activeRoute.name;
}

function createSharedElementScene(
  Component: SharedElementSceneComponent,
  sharedElements: SharedElementsComponentConfig | void,
  rendererData: ISharedElementRendererData,
  emitter: EventEmitter,
  AnimationContext: React.Context<StackCardInterpolationProps | undefined>,
  navigatorId: string,
  verbose: boolean
): React.ComponentType<any> {
  const config = {
    Component,
    sharedElements,
    rendererData,
    AnimationContext,
    navigatorId,
    verbose,
  };

  class SharedElementSceneView extends React.PureComponent<PropsType> {
    private subscriptions: {
      [key: string]: SharedElementEventSubscription;
    } = {};
    private sceneData: SharedElementSceneData = new SharedElementSceneData(
      Component,
      () => config.sharedElements || Component.sharedElements,
      this.props.route,
      navigatorId,
      rendererData.nestingDepth,
      verbose
    );
    private lastTransitionClosing: boolean | undefined;
    private sceneRef: View | null = null;

    static readonly config = config;

    componentDidMount() {
      const { navigation } = this.props;
      this.subscriptions = {
        willFocus: emitter.addListener("focus", this.onWillFocus),
        willBlur: emitter.addListener("blur", this.onWillBlur),
        transitionStart: navigation.addListener(
          "transitionStart",
          this.onTransitionStart
        ),
        transitionEnd: navigation.addListener(
          "transitionEnd",
          this.onTransitionEnd
        ),
      };
    }

    private onTransitionStart = (event: any) => {
      const closing = Boolean(event?.data?.closing);
      this.lastTransitionClosing = closing;
      if (verbose) {
        console.debug("[SE] onTransitionStart", {
          closing,
          route: this.props.route?.name,
        });
      }
      rendererData.startTransition(
        closing,
        navigatorId,
        rendererData.nestingDepth
      );
      rendererData.updateSceneState(
        this.sceneData,
        closing ? "willBlur" : "willFocus"
      );
    };

    private onTransitionEnd = (event: any) => {
      const closingFromEvent = event?.data?.closing;
      const closing =
        typeof closingFromEvent === "boolean"
          ? closingFromEvent
          : this.lastTransitionClosing;
      if (closing && Platform.OS === "android") {
        // React Navigation can briefly reset the closing card's progress while
        // removing it. Latch its contents off after the real transition ends
        // so that teardown frame cannot flash over the destination screen.
        this.sceneRef?.setNativeProps({ style: { opacity: 0 } });
      }
      rendererData.endTransition(
        closing,
        navigatorId,
        rendererData.nestingDepth
      );
      this.lastTransitionClosing = undefined;
    };

    componentWillUnmount() {
      Object.values(this.subscriptions).forEach((unsubscribe) => unsubscribe());
      rendererData.removeScene(this.sceneData);
    }

    render() {
      // console.log('SharedElementSceneView.render');
      return (
        <SharedElementSceneContext.Provider value={this.sceneData}>
          <View
            style={styles.container}
            collapsable={false}
            ref={this.onSetRef}
          >
            <Component {...this.props} />
          </View>
        </SharedElementSceneContext.Provider>
      );
    }

    componentDidUpdate() {
      this.sceneData.updateRoute(this.props.route);
    }

    private onSetRef = (ref: View | null) => {
      this.sceneRef = ref;
      this.sceneData.setAncestor(nodeFromRef(ref));
    };

    private onWillFocus = (key?: string) => {
      const { navigation, route } = this.props;
      if (verbose) {
        console.debug("[SE] onWillFocus", {
          route: route?.name,
          isTransitionStarted: (rendererData as any).isTransitionStarted,
        });
      }

      if (key && key !== route.key) {
        return;
      }

      // Focus events are keyed and can arrive just before the navigation state
      // reports the new active route. Trust the key when present to avoid
      // missing close transitions (especially on iOS tab stacks).
      const isFocusedRoute = key ? key === route.key : isActiveRoute(navigation, route);
      if (!isFocusedRoute) {
        return;
      }

      this.sceneData.updateRoute(route);
      rendererData.updateSceneState(this.sceneData, "willFocus");
      InteractionManager.runAfterInteractions(() => {
        //console.log("onDidFocus: ", this.props.route);
        this.sceneData.updateRoute(this.props.route);
        rendererData.updateSceneState(this.sceneData, "didFocus");
      });
    };

    private onWillBlur = (key?: string) => {
      const { route } = this.props;

      if (key && key !== route.key) {
        return;
      }

      //console.log("onWillBlur: ", route);
      this.sceneData.updateRoute(route);
      rendererData.updateSceneState(this.sceneData, "willBlur");
    };
  }

  hoistNonReactStatics(SharedElementSceneView, Component);
  return SharedElementSceneView;
}

export default createSharedElementScene;
