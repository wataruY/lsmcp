import { Button, ButtonProps } from "./src/ui/Button";
import type { ButtonProps as BtnProps } from "./src/ui/Button";

const props: ButtonProps = {
  label: "Click me",
  onClick: () => console.log("clicked")
};

const btn = Button(props);

export { Button } from "./src/ui/Button";