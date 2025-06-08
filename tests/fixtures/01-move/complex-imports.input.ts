// @move: src/components/Button.tsx -> src/ui/Button.tsx
export interface ButtonProps {
  label: string;
  onClick: () => void;
}

export const Button = ({ label, onClick }: ButtonProps) => {
  return { label, onClick };
};