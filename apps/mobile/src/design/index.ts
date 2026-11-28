/**
 * Barrel of the CoachCal design system (the port of CoachCalDesignSystem).
 * Feature units build screens from these exports only; `src/app` routes and
 * `src/features` never reimplement a component or an ED-safe branch.
 */

export {
  colorsWithoutEmberCounterpart,
  darkColors,
  fontFamily,
  getTokens,
  highContrastDarkColors,
  highContrastLightColors,
  legacyColorAliases,
  lightColors,
  radius,
  scaledNumberSize,
  size,
  space,
  textStyles,
  typography,
  typographyRoleSource,
  colorsByMode,
  useTokens,
  withAlpha,
  type ColorMode,
  type Colors,
  type EmberColors,
  type LegacyColorKey,
  type Scheme,
  type TokenOptions,
  type ScaledNumberRole,
  type EmberTextStyle,
  type TextStyleName,
  type Tokens,
  type TypographyRole,
  type TypographyStyle,
} from './tokens';

export { useHighContrast } from './highContrast';

export {
  edSafeHidden,
  edSafeMode,
  setEdSafeMode,
  useEdSafeHidden,
  useEdSafeMode,
} from './edSafe';

export {
  PrimaryButton,
  primaryButtonLabelColor,
  primaryButtonStyle,
  type PrimaryButtonProps,
} from './components/PrimaryButton';
export {
  DestructiveButton,
  destructiveButtonStyle,
  type DestructiveButtonProps,
} from './components/DestructiveButton';
export { EmberCard, emberGlowOpacity, type EmberCardProps } from './components/EmberCard';
export {
  GramsField,
  parseGramsInput,
  type GramsFieldProps,
  type GramsServing,
} from './components/GramsField';
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
export {
  InsightCard,
  type InsightCardAction,
  type InsightCardProps,
  type InsightVariant,
} from './components/InsightCard';
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
  settingsValueColor,
  type SettingsRowProps,
  type SettingsValueTint,
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
  confidenceBadgeHeight,
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
export {
  carriesCalorieFigure,
  toastVisibleKcalText,
  toastVisibleMessage,
  Toast,
  type ToastProps,
} from './components/Toast';
export { FoldGroup, foldGroupA11yHint, type FoldGroupProps } from './components/FoldGroup';
export {
  TrendChart,
  trendAxis,
  trendChartHeight,
  trendDateLabel,
  trendDateLabelIndexes,
  trendTickLabel,
  trendTime,
  type TrendAxis,
  type TrendChartProps,
  type TrendPoint,
} from './components/TrendChart';
export {
  Sheet,
  sheetDetentFraction,
  sheetDetentHeight,
  sheetGrabberSize,
  type SheetDetent,
  type SheetProps,
} from './components/Sheet';
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
  optionCardBackground,
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
  remainingNumberProps,
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
export {
  fitWidthMinimumFontScale,
  ScaledNumber,
  type ScaledNumberProps,
} from './components/ScaledNumber';
export { EdSafeCollapse } from './components/EdSafeCollapse';
export { EdSafeAlternate, type EdSafeAlternateProps } from './components/EdSafeAlternate';
export {
  Icon,
  iconStrokeWidth,
  type IconProps,
} from './components/Icon';
export { iconNames, iconShapes, type IconName, type IconShape } from './components/iconShapes';
export {
  GlassIconButton,
  glassIconButtonColors,
  type GlassIconButtonProps,
  type GlassTone,
} from './components/GlassIconButton';
export { SheetHeader, type SheetHeaderProps } from './components/SheetHeader';
export {
  Segment,
  segmentChipHeight,
  segmentPillHeight,
  type SegmentOption,
  type SegmentProps,
} from './components/Segment';
export { EdSafeNote, type EdSafeNoteProps } from './components/EdSafeNote';
export {
  FillField,
  fieldDigitWidth,
  fieldRingWidth,
  type FillFieldProps,
} from './components/FillField';
export { CodeField, codeFieldDigits, codeLength, type CodeFieldProps } from './components/CodeField';
export {
  GramsRuler,
  rulerHeight,
  rulerMinorEvery,
  rulerPointsPerUnit,
  rulerTickOpacity,
  rulerTicks,
  rulerValueAfterDrag,
  snapRulerValue,
  type GramsRulerProps,
} from './components/GramsRuler';
