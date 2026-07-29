import * as React from "react";
import { View, StyleSheet } from "react-native";
import { SharedElementTransition } from "react-native-shared-element";

import SharedElementRendererData from "./SharedElementRendererData";
import { SharedElementEventSubscription } from "./types";

type PropsType = {
  rendererData: SharedElementRendererData;
};

export default class SharedElementRendererView extends React.PureComponent<PropsType> {
  private subscription?: SharedElementEventSubscription;
  private transitionRefs = new Map<string, SharedElementTransition>();

  componentDidMount() {
    this.props.rendererData.setClosingTransitionStarter(
      this.startClosingTransitions
    );
    this.subscription = this.props.rendererData.addUpdateListener(() => {
      this.forceUpdate();
    });
  }

  componentWillUnmount() {
    this.props.rendererData.setClosingTransitionStarter(undefined);
    if (this.subscription) {
      this.subscription();
      this.subscription = undefined;
    }
  }

  private startClosingTransitions = () => {
    // These views were mounted by the close preview, so they can start without
    // waiting for another React render and Fabric commit.
    this.transitionRefs.forEach((transition) => {
      transition.startNativeAnimation();
    });
  };

  private setTransitionRef = (
    key: string,
    transition: SharedElementTransition | null
  ) => {
    if (transition) {
      this.transitionRefs.set(key, transition);
    } else {
      this.transitionRefs.delete(key);
    }
  };

  render() {
    const transitions = this.props.rendererData.getTransitions();
    // console.log('SharedElementRendererView.render: ', transitions);
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {transitions.map(
          (
            // @ts-ignore
            { key, ...props },
            index
          ) => {
            const transitionKey = `${key}:${index}`;
            return (
              <SharedElementTransition
                key={transitionKey}
                ref={(transition) =>
                  this.setTransitionRef(transitionKey, transition)
                }
                {...props}
              />
            );
          }
        )}
      </View>
    );
  }
}
