/**
 * The entry step of sign-in (frames 61 and 62): the tile, the title, the subtitle and the privacy line
 * at the top; at the bottom, above the home indicator, Sign in with Apple, Continue with Google, the
 * "or" divider and Continue with email.
 *
 * Not drawn, on purpose (findings/U-77b.md, "Deviations"): the back button (nothing is behind the first
 * screen of a signed-out session), the lock line about training models, the Terms and Privacy footnote,
 * the G mark of Google. Adding the lock line later is one `PrivacyLine` row in `PRIVACY_LINES`.
 */
import * as AppleAuthentication from 'expo-apple-authentication';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  Icon,
  radius,
  SecondaryButton,
  size,
  space,
  textStyles,
  typography,
  useTokens,
  type IconName,
} from '../../design';
import { ErrorLine } from './ErrorLine';
import { textStyle } from './textStyle';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- a bundler asset, the same form as scanCapture.ts
const EMBER_RING: number = require('../../../assets/brand/ember-ring.png');

/** The tile: 64 pt, corners of 14 pt (`radius.md`, the frame's `round(64 * .225)`). */
const TILE = 64;

type PrivacyLine = { icon: IconName; text: string };

/** Every line here was checked against the repository (findings/U-77b.md, "What was checked"). */
const PRIVACY_LINES: readonly PrivacyLine[] = [{ icon: 'shield', text: 'We never post anywhere or read your contacts.' }];

export type EntryStepProps = {
  appleAvailable: boolean;
  isBusy: boolean;
  errorMessage: string | null;
  onApple: () => void;
  onGoogle: () => void;
  onEmail: () => void;
};

export function EntryStep({ appleAvailable, isBusy, errorMessage, onApple, onGoogle, onEmail }: EntryStepProps) {
  const { colors, isDark, type } = useTokens();
  return (
    <>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Image testID="auth.tile" source={EMBER_RING} accessible={false} style={styles.tile} />
        <Text
          accessibilityRole="header"
          style={{
            fontSize: typography.title.fontSize,
            fontWeight: typography.title.fontWeight,
            lineHeight: textStyles.largeTitle.lineHeight,
            color: colors.text,
            marginTop: space.xl2,
          }}
        >
          Sign in to keep your diary safe
        </Text>
        <Text
          style={{
            fontSize: typography.body.fontSize,
            fontWeight: typography.body.fontWeight,
            lineHeight: textStyles.body.lineHeight,
            color: colors.text2,
            marginTop: space.sm,
          }}
        >
          Your meals, weight and streaks are backed up and stay in sync on your other devices.
        </Text>
        <View style={styles.privacy}>
          {PRIVACY_LINES.map((line) => (
            <View key={line.icon} style={styles.privacyRow}>
              <Icon name={line.icon} size={20} color={colors.accentInk} />
              <Text
                style={{
                  flex: 1,
                  fontSize: typography.subhead.fontSize,
                  fontWeight: typography.subhead.fontWeight,
                  lineHeight: textStyles.subheadline.lineHeight,
                  color: colors.text,
                }}
              >
                {line.text}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.buttons}>
        {errorMessage !== null ? <ErrorLine message={errorMessage} /> : null}

        {appleAvailable ? (
          <AppleAuthentication.AppleAuthenticationButton
            testID="auth.signInApple"
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={
              isDark
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={radius.md}
            style={styles.apple}
            onPress={onApple}
          />
        ) : null}

        <View testID="auth.signInGoogle">
          <SecondaryButton title="Continue with Google" bordered action={onGoogle} />
        </View>

        <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.divider}>
          <View style={[styles.rule, { backgroundColor: colors.separator }]} />
          <Text style={{ ...textStyle(type.footnote), color: colors.text2 }}>or</Text>
          <View style={[styles.rule, { backgroundColor: colors.separator }]} />
        </View>

        <SecondaryButton
          testID="auth.signInEmail"
          title="Continue with email"
          leading="mail"
          action={onEmail}
          disabled={isBusy}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: space.xl2, paddingTop: space.xl3, paddingBottom: space.xl2 },
  tile: { width: TILE, height: TILE, borderRadius: radius.md },
  privacy: { gap: space.md, marginTop: space.xl2 + space.xs },
  privacyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  buttons: { paddingHorizontal: space.xl2, paddingBottom: space.lg, gap: space.md },
  apple: { height: size.btn, width: '100%' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
});
