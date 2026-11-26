import { Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

/**
 * Skeleton placeholder: replaced by the real widget in plan task T2.
 *
 * `'widget'` rules (docs: versions/latest/sdk/widgets): no hooks, no async, no imports at runtime,
 * nothing from module scope inside the function. All data arrives through props pushed by the app.
 */
export type CaloriesWidgetProps = {
  date: string;
  consumedKcal: number;
  goalKcal: number;
};

const CaloriesWidget = (props: CaloriesWidgetProps, _environment: WidgetEnvironment) => {
  'widget';
  const remaining = Math.max(0, props.goalKcal - props.consumedKcal);
  return (
    <VStack modifiers={[containerBackground('#141210', 'widget')]}>
      <Text modifiers={[font({ size: 28, weight: 'bold', design: 'rounded' })]}>{remaining}</Text>
    </VStack>
  );
};

export default createWidget('CaloriesWidget', CaloriesWidget, { date: '', consumedKcal: 0, goalKcal: 2000 });
