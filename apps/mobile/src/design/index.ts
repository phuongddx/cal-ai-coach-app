/**
 * Barrel of the CoachCal design system (the port of CoachCalDesignSystem).
 * Feature units build screens from these exports only; `src/app` routes and
 * `src/features` never reimplement a component or an ED-safe branch.
 */

export {
  darkColors,
  getTokens,
  lightColors,
  radius,
  scaledNumberSize,
  size,
  space,
  typography,
  useTokens,
  withAlpha,
  type Colors,
  type Scheme,
  type ScaledNumberRole,
  type Tokens,
  type TypographyRole,
  type TypographyStyle,
} from './tokens';

export {
  edSafeHidden,
  edSafeMode,
  setEdSafeMode,
  useEdSafeHidden,
  useEdSafeMode,
} from './edSafe';

export { PrimaryButton, primaryButtonStyle, type PrimaryButtonProps } from './components/PrimaryButton';
export {
  SecondaryButton,
  secondaryButtonStyle,
  type SecondaryButtonProps,
} from './components/SecondaryButton';
export { DashedAddButton, type DashedAddButtonProps } from './components/DashedAddButton';
export { Card, type CardProps } from './components/Card';
export {
  macroFillFraction,
  macroFillColor,
  MacroBar,
  type Macro,
  type MacroBarProps,
} from './components/MacroBar';
export { MacroMiniCard, macroLabels, type MacroMiniCardProps } from './components/MacroMiniCard';
export { InsightCard, type InsightCardProps, type InsightVariant } from './components/InsightCard';
export { BadgeTile, badgeA11yLabel, type BadgeTileProps } from './components/BadgeTile';
export {
  StreakCard,
  streakA11yLabel,
  streakChipText,
  type StreakCardProps,
} from './components/StreakCard';
export {
  SettingsRow,
  settingsA11yLabel,
  type SettingsRowProps,
} from './components/SettingsRow';
export { SettingsGroup, type SettingsGroupProps } from './components/SettingsGroup';
export {
  BannerNote,
  markdownSegments,
  type BannerNoteProps,
  type BannerVariant,
} from './components/BannerNote';
export { FoodRow, type FoodRowProps } from './components/FoodRow';
export { SectionHeader, type SectionHeaderProps } from './components/SectionHeader';
export {
  confidenceLabel,
  confidenceTier,
  ConfidenceBadge,
  type ConfidenceBadgeProps,
  type ConfidenceTier,
} from './components/ConfidenceBadge';
export {
  warningChipText,
  WarningChip,
  type WarningChipProps,
} from './components/WarningChip';
export { toastVisibleKcalText, Toast, type ToastProps } from './components/Toast';
export { Sheet, type SheetProps } from './components/Sheet';
export {
  ChartCard,
  formatChartValue,
  makeChartDescriptor,
  type ChartCardProps,
  type ChartDescriptor,
  type ChartPoint,
} from './components/ChartCard';
export { OfflineBadge, offlineBadgeLabel } from './components/OfflineBadge';
export {
  optionCardA11yLabel,
  optionCardBorder,
  optionCardIconColor,
  optionCardIconTile,
  OptionCard,
  type OptionCardProps,
} from './components/OptionCard';
export { ChipOption, type ChipOptionProps } from './components/ChipOption';
export {
  clampToUnitInterval,
  ProgressRail,
  progressA11yLabel,
  type ProgressRailProps,
} from './components/ProgressRail';
export {
  WHEEL_ROW_HEIGHT,
  WheelField,
  type WheelFieldProps,
} from './components/WheelField';
export { stepperNext, Stepper, type StepperProps } from './components/Stepper';
export { SearchField, type SearchFieldProps } from './components/SearchField';
export {
  QuickActionTile,
  type QuickActionTileProps,
} from './components/QuickActionTile';
export {
  calorieProgressFraction,
  calorieRingA11yLabel,
  CalorieRing,
  dayPercentText,
  defaultDayProgress,
  type CalorieRingProps,
  type RingVariant,
} from './components/CalorieRing';
export {
  kgValue,
  visibleStats,
  WeeklyReviewStats,
  type WeeklyReviewStatsProps,
  type WeeklyStat,
} from './components/WeeklyReviewStats';
export { ScaledNumber, type ScaledNumberProps } from './components/ScaledNumber';
export { EdSafeCollapse } from './components/EdSafeCollapse';
