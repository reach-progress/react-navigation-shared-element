import * as React from "react";
import { Platform, StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import DefaultStack from "./tests/DefaultStack";

if (Platform.OS === "android") {
  StatusBar.setTranslucent(true);
  StatusBar.setBackgroundColor("transparent");
}

export default () => (
  <SafeAreaProvider>
    <DefaultStack />
  </SafeAreaProvider>
);
