// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const exclusionList =
  require("metro-config/private/defaults/exclusionList").default;
const path = require("path");

const defaultConfig = getDefaultConfig(__dirname);

const resolvers = {
  "react-navigation-shared-element": "..",
  react: "./node_modules",
  "react-native": "./node_modules",
  "react-native-shared-element": "./node_modules",
  "react-native-reanimated": "./node_modules",
  "react-native-worklets": "./node_modules",
  "@react-navigation/core": "./node_modules",
  "@react-navigation/native": "./node_modules",
  "@react-navigation/elements": "./node_modules",
  "@react-navigation/stack": "./node_modules",
  "@react-navigation/routers": "./node_modules",
  "@react-navigation/bottom-tabs": "./node_modules",
  "@react-navigation/material-top-tabs": "./node_modules",
};

// Add custom resolver and watch-folders because
// Metro doesn't work well with the link to the library.
defaultConfig.resolver.extraNodeModules = new Proxy(
  {},
  {
    get: (_, name) => path.resolve(resolvers[name] || "./node_modules", name),
  }
);

// Metro will also traverse parent folders because of watchFolders. That can
// pull in duplicate copies of React / React Navigation from linked packages.
// Use absolute paths here because exclusionList anchors to the path ending.
defaultConfig.resolver.blockList = exclusionList([
  path.resolve(__dirname, "../node_modules"),
  path.resolve(__dirname, "../../react-native-shared-element/node_modules"),
]);

defaultConfig.watchFolders.push(path.resolve("./node_modules"));
defaultConfig.watchFolders.push(path.resolve(".."));

module.exports = defaultConfig;
