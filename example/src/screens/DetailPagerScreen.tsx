import * as React from "react";
import { StyleSheet, View } from "react-native";
import PagerView, {
  PagerViewOnPageSelectedEvent,
} from "react-native-pager-view";
import { ParamListBase, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { SharedElementsComponentConfig } from "react-navigation-shared-element";

import { Item, items } from "../data";
import { DetailComponent } from "./DetailComponent";
import { getDetailSharedElements } from "./getDetailSharedElements";

type ItemRouteParams = {
  item?: Item;
};

type ItemParamList = Record<string, ItemRouteParams | undefined>;

type Props = {
  navigation: StackNavigationProp<ParamListBase>;
  route: RouteProp<ItemParamList, string>;
};

export class DetailPagerScreen extends React.Component<Props> {
  static sharedElements: SharedElementsComponentConfig =
    getDetailSharedElements;

  render() {
    const { navigation, route } = this.props;
    const params = route?.params;
    const initialItem = params?.item;
    const initialIndex = initialItem ? items.indexOf(initialItem) : 0;
    return (
      <PagerView
        style={styles.container}
        initialPage={initialIndex}
        onPageSelected={this.onPageSelected}
      >
        {items.map((item) => this.renderItem(item))}
      </PagerView>
    );
  }

  private renderItem(item: Item) {
    return (
      <View key={item.id} style={styles.container}>
        <DetailComponent
          item={item}
          navigation={this.props.navigation}
          modal="none"
        />
      </View>
    );
  }

  private onPageSelected = (e: PagerViewOnPageSelectedEvent) => {
    const { position } = e.nativeEvent;
    const { navigation } = this.props;
    navigation.setParams({
      item: items[position],
    });
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
