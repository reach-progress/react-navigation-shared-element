import * as React from "react";

import { Icon } from "./Icon";

type Props = {
  color?: string;
};

export function TabBarIcon(props: Props) {
  return <Icon size={20} name="apps" color={props.color} />;
}
