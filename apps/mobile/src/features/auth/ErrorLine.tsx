/**
 * The one error line of the sign-in screen (frames 65 and 66): the `alert` icon and the message in the
 * error ink, unboxed, under the field group (e-mail step) or above the buttons (entry step).
 *
 * It is a `Text` with `accessibilityRole="alert"` and not a `BannerNote`: the banner draws a tinted box
 * the frames do not have and sets the role `text`, which would stop the alert being announced.
 */
import { StyleSheet, Text, View } from 'react-native';

import { Icon, space, textStyles, useTokens } from '../../design';

export function ErrorLine({ message }: { message: string }) {
  const { colors } = useTokens();
  return (
    <View style={styles.row}>
      <Icon name="alert" size={20} color={colors.errorInk} />
      <Text
        accessibilityRole="alert"
        style={{
          fontSize: textStyles.subheadline.fontSize,
          lineHeight: textStyles.subheadline.lineHeight,
          fontWeight: textStyles.subheadline.fontWeight,
          color: colors.errorInk,
          flex: 1,
        }}
      >
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, marginHorizontal: space.xs },
});
