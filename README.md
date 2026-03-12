# Reach Progress Fork <!-- omit in toc -->

This repository is a Reach Progress fork of [IjzerenHein/react-navigation-shared-element](https://github.com/IjzerenHein/react-navigation-shared-element). It has been updated to work with React Native's New Architecture together with the Reach Progress `react-native-shared-element` fork.

Major changes in this fork:

- Updated the package for current React Navigation, React Native, and Expo module tooling.
- Removed the legacy React Navigation 4 implementation and related docs/example cases.
- Fixed shared-element renderer lifecycle handling for reopen, unmount, and nested/tab navigation edge cases under the new architecture.
- Refreshed the example app for the current Expo-generated native project structure.

## Local development with Reach frontend

For Reach Progress app development, keep these repositories as siblings:

```text
code/
  frontend/
  react-native-shared-element/
  react-navigation-shared-element/
```

From `frontend`, switch the app to the local checkouts with:

```bash
pnpm shared-elements:use-local
pnpm install
```

That rewrites the frontend app dependencies to `file:../react-native-shared-element` and `file:../react-navigation-shared-element`.

After native code changes in either shared-element package, rebuild the app from `frontend` with `pnpm ios` or `pnpm android`.

When you want tarball snapshots instead of live local paths:

```bash
pnpm shared-elements:tar
pnpm shared-elements:use-tar
pnpm install
```

The helper script lives at `frontend/scripts/shared-element-deps.mjs`. By default it assumes these repos are siblings of `frontend`, but you can override that with `REACT_NATIVE_SHARED_ELEMENT_PATH` and `REACT_NAVIGATION_SHARED_ELEMENT_PATH`.

# React Navigation Shared Element <!-- omit in toc -->

React Navigation bindings for [react-native-shared-element](https://github.com/IjzerenHein/react-native-shared-element) 💫

![react-navigation-shared-element-gif-iOS](rnse-ios.gif)
![react-navigation-shared-element-gif-Android](rnse-android.gif)

## Documentation

- [Shared element for the React Navigation 5/6 API](./docs/API.md)
- [Migration guide](./docs/Migration.md)

## Compatibility <!-- omit in toc -->

The following versions of React Navigation and the stack navigator are supported.

| Version | React-Navigation |
| ------- | ---------------- |
| 3.x     | 5 & 6            |

## Things to know

- `react-navigation-shared-element` uses the [JS based Stack Navigator](https://reactnavigation.org/docs/stack-navigator). The [Native Stack Navigator](https://reactnavigation.org/docs/native-stack-navigator) is currently [under development here](https://github.com/IjzerenHein/react-navigation-shared-element/tree/native-stack). Also see [this issue](https://github.com/IjzerenHein/react-navigation-shared-element/issues/14).
- [React Navigation 6 `Group` components](https://reactnavigation.org/docs/group/) are not yet supported.
- On [detaching inactive screens](https://reactnavigation.org/docs/stack-navigator/#detachinactivescreens) a blink may occur on Android. Because of this `detachInactiveScreens` is set to `false` by default on Android.

## Demo App

- [./example](./example)

## Videos

- [Snapchat Shared Transitions - “Can it be done in React Native?” (with react-navigation v5)](https://www.youtube.com/watch?v=NJZfRXs7nZs)

## Sponsors

This library is made possible by these wonderful people and companies.

[![](https://github.com/expo.png?size=50)](https://github.com/expo)
[![](https://github.com/react-navigation.png?size=50)](https://github.com/react-navigation)
[![](https://github.com/Open-Source-Collective.png?size=50)](https://github.com/Open-Source-Collective)
[![](https://github.com/haibert.png?size=50)](https://github.com/haibert)
[![](https://github.com/Hirbod.png?size=50)](https://github.com/Hirbod)
[![](https://github.com/github.png?size=50)](https://github.com/gustavo-nramires)
[![](https://github.com/nandorojo.png?size=50)](https://github.com/nandorojo)
[![](https://github.com/beatgig.png?size=50)](https://github.com/beatgig)
[![](https://github.com/nuwave.png?size=50)](https://github.com/nuwave)
[![](https://github.com/calendee.png?size=50)](https://github.com/calendee)
[![](https://github.com/wibb36.png?size=50)](https://github.com/wibb36)
[![](https://github.com/hannojg.png?size=50)](https://github.com/hannojg)
[![](https://github.com/davitykale.png?size=50)](https://github.com/davitykale)
[![](https://github.com/nightstomp.png?size=50)](https://github.com/nightstomp)
[![](https://github.com/SteveGreenley.png?size=50)](https://github.com/SteveGreenley)

<!--
Todo, find and add the github profile for these nice ppl that also sponsoredL
- Ahmed Tajelsir Ali Ahmed
- Salvatore Aiello
- Einzel Firma?
- Kavyar
- dave sim
-->

## License

React navigation shared element library is licensed under [The MIT License](./LICENSE.md).
