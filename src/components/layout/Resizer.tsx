export function Resizer({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return <div className="resizer" onMouseDown={onMouseDown} />;
}
