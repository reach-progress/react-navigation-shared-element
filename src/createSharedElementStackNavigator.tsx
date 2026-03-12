import {
  useNavigationBuilder,
  createNavigatorFactory,
  StackRouter,
  StackRouterOptions,
  StackNavigationState,
  StackActionHelpers,
  ParamListBase,
  StackActions,
  EventArg,
} from "@react-navigation/native";
import {
  CardAnimationContext,
  StackView,
  StackNavigationEventMap,
  StackNavigationOptions,
  createStackNavigator,
} from "@react-navigation/stack";
import * as React from "react";
import { Platform } from "react-native";

import { useSharedElementFocusEvents } from "./SharedElementFocusEvents";
import SharedElementRendererContext from "./SharedElementRendererContext";
import SharedElementRendererData from "./SharedElementRendererData";
import { SharedElementRendererProxy } from "./SharedElementRendererProxy";
import SharedElementRendererView from "./SharedElementRendererView";
import createSharedElementScene from "./createSharedElementScene";
import {
  SharedElementSceneComponent,
  SharedElementsComponentConfig,
} from "./types";
import { EventEmitter } from "./utils/EventEmitter";

let _navigatorId = 1;

export default function createSharedElementStackNavigator<
  ParamList extends ParamListBase
>(options?: {
  name?: string;
  debug?: boolean;
  nativeDuration?: number;
  nativeDelay?: number;
}) {
  const navigatorId =
    options && options.name ? options.name : `stack${_navigatorId}`;
  _navigatorId++;
  const debug = options?.debug || false;
  const nativeDuration = options?.nativeDuration;
  const nativeDelay = options?.nativeDelay;

  const rendererDataProxy = new SharedElementRendererProxy();

  const emitter = new EventEmitter();

  type Props = React.ComponentProps<
    ReturnType<typeof createStackNavigator>["Navigator"]
  > &
    StackRouterOptions &
    Record<string, any>;

  function SharedElementStackNavigator({
    initialRouteName,
    children,
    screenOptions,
    ...rest
  }: Props) {
    const defaultOptions = {
      gestureEnabled: Platform.OS === "ios",
      animationEnabled: Platform.OS !== "web",
    };
    const { state, descriptors, navigation, NavigationContent } =
      useNavigationBuilder<
        StackNavigationState<ParamListBase>,
        StackRouterOptions,
        StackActionHelpers<ParamListBase>,
        StackNavigationOptions,
        StackNavigationEventMap
      >(StackRouter, {
        id: (rest as any).id ?? navigatorId,
        initialRouteName,
        children,
        screenOptions:
          typeof screenOptions === "function"
            ? (...args) => ({
                ...defaultOptions,
                ...screenOptions(...args),
              })
            : {
                ...defaultOptions,
                ...screenOptions,
              },
      });

    const rendererDataRef = React.useRef<SharedElementRendererData | null>(
      null
    );

    React.useEffect(
      () =>
        (navigation as any).addListener?.("tabPress", (e: EventArg<"tabPress", true>) => {
          const isFocused = navigation.isFocused();

          // Run the operation in the next frame so we're sure all listeners have been run
          // This is necessary to know if preventDefault() has been called
          requestAnimationFrame(() => {
            if (
              state.index > 0 &&
              isFocused &&
              !e.defaultPrevented
            ) {
              // When user taps on already focused tab and we're inside the tab,
              // reset the stack to replicate native behaviour
              navigation.dispatch({
                ...StackActions.popToTop(),
                target: state.key,
              });
            }
          });
        }),
      [navigation, state.index, state.key]
    );

    if (debug) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      React.useLayoutEffect(() => {
        rendererDataProxy.addDebugRef();
        return function cleanup() {
          rendererDataProxy.releaseDebugRef();
        };
      }, []);
    }

    useSharedElementFocusEvents({ state, emitter });

    return (
      <SharedElementRendererContext.Consumer>
        {(rendererData) => {
          // In case a renderer is already present higher up in the chain
          // then don't bother creating a renderer here, but use that one instead
          if (!rendererData) {
            rendererDataRef.current =
              rendererDataRef.current ||
              new SharedElementRendererData({
                nativeDuration,
                nativeDelay,
              });
            rendererDataProxy.source = rendererDataRef.current;
          } else {
            rendererDataProxy.source = rendererData;
          }
          return (
            <SharedElementRendererContext.Provider value={rendererDataProxy}>
              <NavigationContent>
                <StackView
                  detachInactiveScreens={Platform.OS !== "android"}
                  {...rest}
                  state={state}
                  descriptors={descriptors}
                  navigation={navigation}
                />
                {rendererDataRef.current ? (
                  <SharedElementRendererView
                    rendererData={rendererDataRef.current}
                  />
                ) : undefined}
              </NavigationContent>
            </SharedElementRendererContext.Provider>
          );
        }}
      </SharedElementRendererContext.Consumer>
    );
  }

  const navigatorFactory = createNavigatorFactory(
    SharedElementStackNavigator as React.ComponentType<any>
  );

  const { Navigator, Screen } = navigatorFactory();

  type ScreenProps<RouteName extends keyof ParamList> = {
    name: RouteName;
    component: SharedElementSceneComponent<any>;
    sharedElements?: SharedElementsComponentConfig;
    [key: string]: any;

    /**
     * @deprecated
     * The `sharedElementsConfig` prop has been renamed, use `sharedElements` instead.
     */
    sharedElementsConfig?: SharedElementsComponentConfig;
  };

  // Wrapping Screen to explicitly statically type a "Shared Element" Screen.
  function wrapScreen<RouteName extends keyof ParamList>(
    _: ScreenProps<RouteName>
  ) {
    return null;
  }

  type NavigatorProps = React.ComponentProps<typeof Navigator>;

  function getSharedElementsChildrenProps(children: React.ReactNode) {
    return React.Children.toArray(children).reduce<any[]>((acc, child) => {
      if (React.isValidElement(child)) {
        const element = child as React.ReactElement<any>;
        if (element.type === wrapScreen) {
          acc.push(element.props);
        }

        if (element.type === React.Fragment) {
          acc.push(
            ...getSharedElementsChildrenProps((element.props as any).children)
          );
        }
      }
      return acc;
    }, []);
  }

  // react-navigation only allows the Screen component as direct children
  // of Navigator, this is why we need to wrap the Navigator
  function WrapNavigator(props: NavigatorProps) {
    const { children, ...restProps } = props;
    const wrappedComponentsCache = React.useRef<Map<string, any>>(new Map());
    const screenChildrenProps = getSharedElementsChildrenProps(children);

    return (
      <Navigator {...restProps}>
        {screenChildrenProps.map(
          ({
            component,
            name,
            sharedElements,
            sharedElementsConfig,
            ...restChildrenProps
          }) => {
            sharedElements = sharedElements || sharedElementsConfig;

            // Show warning when deprecated `sharedElementsConfig` prop was used
            if (sharedElementsConfig) {
              console.warn(
                "The `sharedElementsConfig` prop has been renamed, use `sharedElements` instead."
              );
            }

            // Check whether this component was previously already wrapped
            let wrappedComponent = wrappedComponentsCache.current.get(name);
            if (
              !wrappedComponent ||
              wrappedComponent.config.Component !== component
            ) {
              // Wrap the component
              wrappedComponent = createSharedElementScene(
                component,
                sharedElements,
                rendererDataProxy,
                emitter,
                CardAnimationContext,
                navigatorId,
                debug
              );
              wrappedComponentsCache.current.set(name, wrappedComponent);
            } else {
              // Shared elements function might have been changed, so update it
              wrappedComponent.config.sharedElements = sharedElements;
            }

            return (
              <Screen
                key={name}
                name={name}
                component={wrappedComponent}
                {...restChildrenProps}
              />
            );
          }
        )}
      </Navigator>
    );
  }

  return {
    Navigator: WrapNavigator,
    Screen: wrapScreen,
  };
}
