/**
 * Icon of the Ember canvas (`<symbol id="i-…">` of `docs/design/ember/index.html`, 51 of them).
 * 24 x 24 viewBox, 2 px round strokes, drawn with react-native-svg; the shapes are in
 * `iconShapes.ts`, copied verbatim and compared with the canvas by `Icon.test.tsx`.
 *
 * Accessibility: with an `accessibilityLabel` the icon is an image carrying that label; without one it
 * is decorative (`accessible={false}`) because the button or the row next to it carries the label.
 */

import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useTokens } from '../tokens';

import { iconShapes, type IconName, type IconShape } from './iconShapes';

export type IconProps = {
  name: IconName;
  /** Points, default 20 (the canvas `svg.i.md`). */
  size?: number;
  /** A token color. Default `colors.text`. */
  color?: string;
  accessibilityLabel?: string;
  testID?: string;
};

export const iconStrokeWidth = 2;

export function Icon({ name, size = 20, color, accessibilityLabel, testID }: IconProps) {
  const { colors } = useTokens();
  const ink = color ?? colors.text;
  const labelled = accessibilityLabel != null && accessibilityLabel.length > 0;
  const shapes: readonly IconShape[] = iconShapes[name];
  return (
    <Svg
      testID={testID ?? `icon:${name}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={ink}
      strokeWidth={iconStrokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessible={labelled}
      accessibilityRole={labelled ? 'image' : undefined}
      accessibilityLabel={labelled ? accessibilityLabel : undefined}
    >
      {shapes.map((shape, index) => {
        const key = `${shape.tag}-${index}`;
        if (shape.tag === 'path') {
          // The canvas fills the half disc of `moonsun` with `currentColor`.
          const fill = 'fill' in shape && shape.fill === 'currentColor' ? ink : undefined;
          return <Path key={key} d={shape.d} fill={fill} />;
        }
        if (shape.tag === 'circle') {
          return <Circle key={key} cx={shape.cx} cy={shape.cy} r={shape.r} />;
        }
        return (
          <Rect
            key={key}
            x={shape.x}
            y={shape.y}
            width={shape.width}
            height={shape.height}
            rx={'rx' in shape ? shape.rx : undefined}
          />
        );
      })}
    </Svg>
  );
}
