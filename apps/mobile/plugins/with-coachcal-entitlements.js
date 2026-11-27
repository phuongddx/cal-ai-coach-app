// @ts-check
const { withEntitlementsPlist } = require('expo/config-plugins');

/** Entitlements the production app has always carried (native/App/CoachCal/SupportingFiles/CoachCal.entitlements). */
const APP_GROUP = 'group.com.nextlabs.coachcal';

/**
 * Makes sure the three entitlements the SwiftUI app shipped with are in the generated
 * `CoachCal.entitlements`, whatever the other plugins do: HealthKit, HealthKit background delivery
 * and the App Group shared with the widget. It only adds or unions; it never removes a key or a
 * group another plugin wrote (Sign in with Apple and `aps-environment` come from their own plugins).
 *
 * @type {import('expo/config-plugins').ConfigPlugin}
 */
const withCoachCalEntitlements = (config) =>
  withEntitlementsPlist(config, (mod) => {
    const entitlements = mod.modResults;
    entitlements['com.apple.developer.healthkit'] = true;
    entitlements['com.apple.developer.healthkit.background-delivery'] = true;

    const groups = Array.isArray(entitlements['com.apple.security.application-groups'])
      ? entitlements['com.apple.security.application-groups']
      : [];
    if (!groups.includes(APP_GROUP)) groups.push(APP_GROUP);
    entitlements['com.apple.security.application-groups'] = groups;
    return mod;
  });

module.exports = withCoachCalEntitlements;
module.exports.APP_GROUP = APP_GROUP;
