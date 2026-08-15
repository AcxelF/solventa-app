import { readableOn } from "../../utils/color.js";

export default function IconBadge({ color, icon: Icon, size = 36 }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{
        backgroundColor: color,
        color: readableOn(color),
        width: size,
        height: size,
      }}
    >
      <Icon size={Math.round(size * 0.45)} strokeWidth={1.8} />
    </span>
  );
}
