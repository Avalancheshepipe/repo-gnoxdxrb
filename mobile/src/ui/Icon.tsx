import { createElement } from "react";
import Svg, {
  Circle,
  Ellipse,
  G,
  Line,
  Path,
  Polygon,
  Polyline,
  Rect,
} from "react-native-svg";

/**
 * A single Hugeicons primitive: `[tagName, attributes]`. The free-icons package
 * ships each glyph as an array of these tuples (camelCased SVG attributes),
 * which we render natively with react-native-svg — no extra runtime dependency,
 * and the exact same icon data the web app uses.
 */
export type IconNode = [string, Record<string, string | number>];
export type IconSvgElement = IconNode[];

const TAGS: Record<string, React.ComponentType<Record<string, unknown>>> = {
  path: Path,
  circle: Circle,
  rect: Rect,
  line: Line,
  polyline: Polyline,
  polygon: Polygon,
  ellipse: Ellipse,
  g: G,
};

type IconProps = {
  icon: IconSvgElement;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function Icon({
  icon,
  size = 22,
  color = "#000",
  strokeWidth,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {icon.map(([tag, attrs], index) => {
        const Component = TAGS[tag];
        if (!Component) return null;

        const next: Record<string, unknown> = { ...attrs };
        // Hugeicons encode color as `currentColor`; resolve it to the theme tint.
        if (next.stroke === "currentColor") next.stroke = color;
        if (next.fill === "currentColor") next.fill = color;
        if (strokeWidth != null && next.stroke != null) {
          next.strokeWidth = strokeWidth;
        }
        next.key = String(attrs.key ?? index);

        return createElement(Component, next);
      })}
    </Svg>
  );
}
