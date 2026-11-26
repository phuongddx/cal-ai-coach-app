import { Gauge, HStack, ProgressView, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  gaugeStyle,
  progressViewStyle,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

/**
 * Props pushed by the app through `WidgetSnapshotPublisher`. `date` is the local day key
 * (`YYYY-MM-DD`); an empty string means "no snapshot yet" and renders the placeholder.
 */
export type CaloriesWidgetProps = {
  date: string;
  consumedKcal: number;
  goalKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  proteinGoalG: number;
  carbsGoalG: number;
  fatGoalG: number;
};

/** Props the gallery and the first render use until the app publishes a snapshot. */
export const placeholderProps: CaloriesWidgetProps = {
  date: '',
  consumedKcal: 0,
  goalKcal: 2000,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  proteinGoalG: 130,
  carbsGoalG: 210,
  fatGoalG: 70,
};

// The function below is serialized to a string and evaluated in the widget's own JS runtime.
// It may only use its two arguments and the `@expo/ui/swift-ui` components and modifiers that are
// rewritten to globals. No hooks, no async, no imports, no module-scope values: every token is
// declared inside the function body.
const CaloriesWidget = (props: CaloriesWidgetProps, environment: WidgetEnvironment) => {
  'widget';

  // Ember tokens (docs/reference/ember-widgets.png).
  const dark = environment.colorScheme !== 'light';
  const surface = dark ? '#141210' : '#F7F5F2';
  const glow = dark ? 'rgba(255, 106, 0, 0.30)' : 'rgba(255, 106, 0, 0.14)';
  const textPrimary = dark ? '#F7F5F2' : '#141210';
  const textSecondary = dark ? '#ABA6A0' : '#6B665F';
  const accent = '#FF6A00';
  const track = dark ? '#3A342F' : '#E4DFD8';
  const protein = '#6EA8FF';
  const carbs = '#3CCFBE';
  const fat = '#B794FF';

  const background = containerBackground(
    {
      type: 'radialGradient',
      colors: [glow, surface],
      center: { x: 0.9, y: 0.05 },
      startRadius: 0,
      endRadius: 160,
    },
    'widget'
  );

  if (props.date === '') {
    return (
      <VStack spacing={4} modifiers={[background]}>
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(accent)]}>
          CoachCal
        </Text>
        <Text
          modifiers={[
            font({ size: 15, weight: 'semibold', design: 'rounded' }),
            foregroundStyle(textPrimary),
          ]}>
          Open CoachCal Spike
        </Text>
      </VStack>
    );
  }

  const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
  const consumed = Math.max(0, props.consumedKcal);
  const remaining = Math.max(0, Math.round(props.goalKcal - consumed));
  const consumedFraction = props.goalKcal > 0 ? clamp01(consumed / props.goalKcal) : 0;
  const rounded = (value: number) => Math.max(0, Math.round(value));

  const ring = (size: number, numberSize: number) => (
    <Gauge
      value={consumedFraction}
      currentValueLabel={
        <VStack spacing={0}>
          <Text
            modifiers={[
              font({ size: numberSize, weight: 'bold', design: 'rounded' }),
              foregroundStyle(textPrimary),
            ]}>
            {String(remaining)}
          </Text>
          <Text modifiers={[font({ size: 11, weight: 'regular' }), foregroundStyle(textSecondary)]}>
            kcal left
          </Text>
        </VStack>
      }
      modifiers={[gaugeStyle('circularCapacity'), tint(accent), frame({ width: size, height: size })]}>
      <Text>kcal</Text>
    </Gauge>
  );

  const macroRow = (label: string, grams: number, goal: number, color: string) => (
    <VStack spacing={3}>
      <HStack>
        <Text modifiers={[font({ size: 12, weight: 'regular' }), foregroundStyle(textSecondary)]}>
          {label}
        </Text>
        <Spacer />
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(textPrimary)]}>
          {`${rounded(grams)}/${rounded(goal)} g`}
        </Text>
      </HStack>
      <ProgressView
        value={goal > 0 ? clamp01(grams / goal) : 0}
        modifiers={[progressViewStyle('linear'), tint(color)]}
      />
    </VStack>
  );

  if (environment.widgetFamily === 'systemMedium') {
    return (
      <HStack spacing={16} modifiers={[background]}>
        {ring(104, 30)}
        <VStack spacing={8}>
          {macroRow('Protein', props.proteinG, props.proteinGoalG, protein)}
          {macroRow('Carbs', props.carbsG, props.carbsGoalG, carbs)}
          {macroRow('Fat', props.fatG, props.fatGoalG, fat)}
        </VStack>
      </HStack>
    );
  }

  // systemSmall, and the fallback for any other family.
  return (
    <ZStack modifiers={[background]}>
      <VStack spacing={6}>
        <HStack>
          <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(accent)]}>
            CoachCal
          </Text>
          <Spacer />
        </HStack>
        {ring(96, 28)}
      </VStack>
    </ZStack>
  );
};

// The name must equal `name` of the widget entry in app.config.ts (expo-widgets plugin).
export default createWidget('CaloriesWidget', CaloriesWidget, placeholderProps);
