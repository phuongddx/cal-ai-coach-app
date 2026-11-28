/**
 * Review (Ember frames 03-05): the confidence-badged, grams-editable meal review. Every kcal figure is recomputed
 * through KcalArithmetic from the CURRENT grams (the model selectors); the design components own the ED-safe
 * policy (`EdSafeCollapse` hides the kcal framing, `EdSafeNote` stands in for the total).
 *
 * One item is open at a time (the first, then the last one the person touched): open = typed grams field, −/+,
 * ruler. The others show their kcal line and a grams pill. An unresolved item always shows its explainer, the
 * report link and "Remove item"; Save names how many items still block it.
 */
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  ConfidenceBadge,
  darkColors,
  EdSafeCollapse,
  EdSafeNote,
  GramsField,
  GramsRuler,
  Icon,
  PrimaryButton,
  radius,
  Segment,
  SheetHeader,
  size,
  space,
  typography,
  useTokens,
  withAlpha,
} from '../../design';
import { CorrectionCaptureView } from './CorrectionCaptureView';
import { ScanThumb } from './ScanThumb';
import { mealName, MEAL_SEGMENT_OPTIONS } from './scanCopy';
import type { ScanModel } from './scanModel';
import type { MealSlot, ResultItem } from './scanTypes';
import { useScanState } from './useScanModel';

export type ReviewSheetViewProps = {
  model: ScanModel;
  onClose: () => void;
};

const RULER_MAX = 1000;

export function ReviewSheetView({ model, onClose }: ReviewSheetViewProps) {
  const { colors } = useTokens();
  const state = useScanState(model);
  const [correctionItemId, setCorrectionItemId] = useState<number | null>(null);
  const [touchedId, setTouchedId] = useState<number | null>(null);
  const items = state.result?.items ?? [];
  const correctionItem = items.find((item) => item.id === correctionItemId) ?? null;
  const expandedId = items.some((item) => item.id === touchedId) ? touchedId : (items[0]?.id ?? null);
  const blocked = model.unresolvedCount();
  const macros = model.mealMacros();

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={styles.headerPad}>
        <SheetHeader
          title="Review"
          onBack={() => model.retake()}
          backAccessibilityLabel="Back to camera"
          onClose={onClose}
          closeAccessibilityLabel="Close"
          testID="scan.header"
          backTestID="scan.retake"
          titleTestID="scan.review"
          closeTestID="scan.close"
        />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.header}>
          <ScanThumb thumb={state.captureThumb} size={72} cornerRadius={18} tone="review" />
          <View style={styles.titleColumn}>
            <View style={styles.titleRow}>
              <TextInput
                testID="scan.titleField"
                accessibilityLabel="Meal name"
                placeholder="Meal name"
                placeholderTextColor={colors.text3}
                value={state.mealTitle}
                onChangeText={(title) => model.setMealTitle(title)}
                numberOfLines={1}
                style={[styles.title, { color: colors.text }]}
              />
              <Icon name="pencil" size={16} color={colors.text3} />
            </View>
            {state.result ? (
              <View testID="scan.badge" style={styles.badgeRow}>
                <ConfidenceBadge confidence={state.result.scanConfidence} copy="confidence" />
              </View>
            ) : null}
          </View>
        </View>

        <EdSafeCollapse>
          <View style={[styles.total, { backgroundColor: colors.grouped }]}>
            <View style={styles.flex}>
              <Text style={[typography.footnote, { color: colors.text2 }]}>Total · AI estimate</Text>
              <View style={styles.totalRow}>
                <Text testID="scan.totalKcal" style={[styles.totalNumber, { color: colors.text }]}>
                  {model.mealKcal()}
                </Text>
                <Text style={[typography.headline, { color: colors.text2 }]}>kcal</Text>
              </View>
            </View>
            <View testID="scan.macros" style={styles.macros}>
              <MacroDot color={colors.protein} text={`P ${macros.proteinG} g`} />
              <MacroDot color={colors.carbs} text={`C ${macros.carbsG} g`} />
              <MacroDot color={colors.fat} text={`F ${macros.fatG} g`} />
            </View>
          </View>
        </EdSafeCollapse>
        <EdSafeNote
          icon="leaf"
          title="Numbers are hidden in ED-Safe mode."
          body="Grams stay, so you can still correct each item."
          testID="scan.edSafeNote"
        />

        {items.length > 0 ? (
          <Text style={[typography.footnote, styles.sectionHead, { color: colors.text2 }]}>
            {`${items.length} ${items.length === 1 ? 'item' : 'items'} · tap grams to type`}
          </Text>
        ) : null}
        {items.map((item) => (
          <ItemCard
            key={item.id}
            model={model}
            item={item}
            expanded={item.id === expandedId}
            onExpand={() => setTouchedId(item.id)}
            onReport={() => setCorrectionItemId(item.id)}
          />
        ))}
      </ScrollView>

      <View style={[styles.dock, { backgroundColor: colors.bg, borderTopColor: colors.border }]}>
        <Segment<MealSlot>
          variant="text"
          options={MEAL_SEGMENT_OPTIONS}
          value={state.mealSlot}
          onChange={(slot) => model.setMealSlot(slot)}
          accessibilityLabel="Meal"
          testID="scan.mealPicker"
        />
        <PrimaryButton
          title={blocked > 0 ? `Resolve ${blocked} ${blocked === 1 ? 'item' : 'items'} to save` : `Save to ${mealName(state.mealSlot)}`}
          testID="scan.save"
          disabled={!model.isSaveEnabled()}
          action={() => {
            void model.save();
          }}
        />
      </View>

      <Modal visible={correctionItem !== null} transparent animationType="slide" onRequestClose={() => setCorrectionItemId(null)}>
        <View style={[styles.backdrop, { backgroundColor: withAlpha(darkColors.bg, 0.4) }]}>
          {correctionItem ? <CorrectionCaptureView
              model={model}
              itemId={correctionItem.id}
              onDismiss={() => setCorrectionItemId(null)}
              onEditGrams={setTouchedId}
            /> : null}
        </View>
      </Modal>
    </View>
  );
}

function MacroDot({ color, text }: { color: string; text: string }) {
  const { colors } = useTokens();
  return (
    <View style={styles.macroRow}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[typography.footnote, styles.macroText, { color: colors.text }]}>{text}</Text>
    </View>
  );
}

type ItemCardProps = {
  model: ScanModel;
  item: ResultItem;
  expanded: boolean;
  onExpand: () => void;
  onReport: () => void;
};

function ItemCard({ model, item, expanded, onExpand, onReport }: ItemCardProps) {
  const { colors } = useTokens();
  const lowConfidence = item.source.confidence < 0.5;
  const id = String(item.id);
  return (
    <View
      testID={`scan.item.${item.id}`}
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: item.isUnresolved ? colors.error : colors.border, borderWidth: item.isUnresolved ? 1.5 : 1 },
      ]}
    >
      <View style={styles.itemHead}>
        <View style={styles.flex}>
          <View style={styles.itemTitleRow}>
            <Text numberOfLines={1} style={[typography.headline, styles.shrink, { color: item.isUnresolved ? colors.errorInk : colors.text }]}>
              {item.source.label}
            </Text>
            {lowConfidence ? <ConfidenceBadge confidence={item.source.confidence} compact /> : null}
          </View>
          {item.isUnresolved ? (
            <Text testID={`scan.reviewNeeded.${item.id}`} style={[typography.caption, { color: colors.errorInk }]}>
              Review needed
            </Text>
          ) : item.correction ? (
            <Text style={[typography.caption, { color: colors.infoInk }]}>Report noted</Text>
          ) : null}
          <EdSafeCollapse>
            <Text testID={`scan.itemKcal.${item.id}`} style={[typography.subhead, styles.tabular, { color: colors.text2 }]}>
              {`${model.itemKcal(item.id)} kcal`}
            </Text>
            {item.source.hiddenFatLikely ? (
              <Text testID={`scan.hiddenFat.${item.id}`} style={[typography.footnote, { color: colors.cautionInk }]}>
                includes hidden fat
              </Text>
            ) : null}
          </EdSafeCollapse>
        </View>
        {!expanded ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.source.label}, ${item.grams} grams`}
            accessibilityHint="Edit grams"
            testID={`scan.grams.${item.id}`}
            onPress={onExpand}
            style={[styles.gramsPill, { backgroundColor: colors.fill }]}
          >
            <Text style={[typography.subhead, styles.gramsPillText, { color: colors.text }]}>{`${item.grams} g`}</Text>
          </Pressable>
        ) : null}
      </View>

      {item.isUnresolved ? (
        <Text style={[typography.footnote, { color: colors.text2 }]}>
          We couldn't tell what this is. Photo estimates often miss oils and sauces, so report a problem with it, or remove it to continue.
        </Text>
      ) : null}

      {expanded ? (
        <View style={styles.editor}>
          <GramsField id={id} value={item.grams} onValueChange={(grams) => model.setGrams(grams, item.id)} />
          <GramsRuler
            value={item.grams}
            onChange={(grams) => model.setGrams(grams, item.id)}
            min={0}
            max={Math.max(RULER_MAX, item.grams)}
            accessibilityLabel={`Grams of ${item.source.label}`}
            testID={`scan.grams.${item.id}.ruler`}
          />
        </View>
      ) : null}

      {expanded || item.isUnresolved ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Report a problem"
          testID={`scan.fixIssue.${item.id}`}
          onPress={onReport}
          style={styles.report}
        >
          <Text style={[typography.footnote, styles.underline, { color: colors.text2 }]}>Report a problem</Text>
        </Pressable>
      ) : null}

      {item.isUnresolved ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${item.source.label}`}
          testID={`scan.removeItem.${item.id}`}
          onPress={() => model.removeItem(item.id)}
          style={styles.remove}
        >
          <Text style={[typography.subhead, styles.removeText, { color: colors.errorInk }]}>Remove item</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
  headerPad: { paddingHorizontal: space.lg },
  body: { paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  titleColumn: { flex: 1, gap: space.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { flex: 1, fontSize: 22, fontWeight: '700', padding: 0 },
  badgeRow: { flexDirection: 'row' },
  total: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, padding: space.lg, gap: space.md },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
  totalNumber: { fontSize: 44, fontWeight: '700', fontVariant: ['tabular-nums'] },
  macros: { gap: space.sm },
  macroRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  macroText: { fontWeight: '600', fontVariant: ['tabular-nums'] },
  sectionHead: { fontWeight: '600', paddingTop: space.xs },
  card: { borderRadius: radius.lg, padding: space.lg, gap: space.md },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  gramsPill: { minHeight: size.tap, minWidth: size.tap, borderRadius: radius.md, paddingHorizontal: space.lg, alignItems: 'center', justifyContent: 'center' },
  gramsPillText: { fontWeight: '600', fontVariant: ['tabular-nums'] },
  editor: { gap: space.lg },
  report: { alignSelf: 'flex-start', minHeight: size.tap, justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
  remove: { alignSelf: 'flex-start', minHeight: size.tap, justifyContent: 'center' },
  removeText: { fontWeight: '600' },
  dock: { padding: space.lg, gap: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
});
