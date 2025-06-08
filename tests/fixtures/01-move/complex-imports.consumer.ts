import { Button, ButtonProps } from "./src/components/Button";
import type { ButtonProps as BtnProps } from "./src/components/Button";

const props: ButtonProps = {
  label: "Click me",
  onClick: () => console.log("clicked")
};

const btn = Button(props);

export { Button } from "./src/components/Button";