#!/usr/bin/env bash
# Owner tool: says which native module the mobile code needs is missing from a built app.
#
#   bash scripts/rn/check-native-modules.sh ["<path to the .app bundle>"]
#
# The default bundle is the development client under .worktrees/rn-native. A module counts as
# present when its marker string occurs in the executable code of the bundle: the main binary, the
# debug library of a development build, every framework and every app extension. A statically
# linked pod is in that code and not under Frameworks/, which is why listing Frameworks/ says
# nothing about it. Exits 1 and names what is missing, and names a dependency of apps/mobile that
# has no marker here yet.
set -u
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
root=$(cd "$here/../.." && pwd)
app=${1:-$root/../rn-native/apps/mobile/build-output/CoachCal-dev.app}
app=${app%/}

if [ ! -d "$app" ]; then echo "native-modules: no app bundle at $app" >&2; exit 1; fi

# package in apps/mobile/package.json | a string its native code contains
markers="
expo|ExpoModulesCore
expo-apple-authentication|AppleAuthentication
expo-background-task|ExpoTaskManager
expo-camera|ExpoCamera
expo-constants|EXConstants
expo-crypto|ExpoCrypto
expo-dev-client|ExpoDevLauncher
expo-file-system|ExpoFileSystem
expo-font|ExpoFont
expo-glass-effect|ExpoGlassEffect
expo-image-manipulator|ExpoImageManipulator
expo-image-picker|ExpoImagePicker
expo-linking|ExpoLinking
expo-notifications|ExpoNotifications
expo-secure-store|ExpoSecureStore
expo-sharing|ExpoSharing
expo-splash-screen|ExpoSplashScreen
expo-sqlite|ExpoSQLite
expo-status-bar|ExpoStatusBar
expo-symbols|ExpoSymbols
expo-system-ui|ExpoSystemUI
expo-updates|ExpoUpdates
expo-web-browser|ExpoWebBrowser
expo-widgets|ExpoWidgets
@expo/ui|ExpoUI
@kingstinct/react-native-healthkit|HealthKit
@react-native-community/netinfo|NetInfo
react-native|ReactNativeDependencies
react-native-gesture-handler|RNGestureHandler
react-native-nitro-modules|NitroModules
react-native-reanimated|Reanimated
react-native-safe-area-context|SafeAreaContext
react-native-screens|RNSScreen
react-native-svg|RNSVG
react-native-worklets|Worklets
"
# Packages of apps/mobile/package.json that carry no native code of their own.
js_only=" @coachcal/api-contract @coachcal/core @tanstack/react-query drizzle-orm expo-dev-launcher expo-dev-menu expo-router react react-dom zustand "

code=$(mktemp -t native-modules)
trap 'rm -f "$code"' EXIT
while IFS= read -r file; do strings -a "$file" 2>/dev/null; done < <(
  find -L "$app" -maxdepth 4 -type f -perm -u+x \
    ! -name '*.sh' ! -name '*.plist' ! -name '*.png' ! -name '*.car' ! -name '*.json' \
    ! -path '*/_CodeSignature/*' ! -path '*/SC_Info/*'
) > "$code"

deps=$(node -e 'const p=require(process.argv[1]+"/apps/mobile/package.json");console.log(Object.keys(p.dependencies||{}).join("\n"))' "$root")
missing=0
unknown=0
for dep in $deps; do
  marker=$(printf '%s\n' "$markers" | awk -F'|' -v d="$dep" '$1==d{print $2}')
  if [ -z "$marker" ]; then
    case "$js_only" in *" $dep "*) continue ;; esac
    echo "native-modules: no marker for $dep: add one to scripts/rn/check-native-modules.sh"
    unknown=$((unknown + 1))
    continue
  fi
  count=$(grep -c -- "$marker" "$code")
  if [ "$count" = "0" ]; then
    echo "native-modules: MISSING $dep (marker $marker) in $app"
    missing=$((missing + 1))
  else
    printf 'native-modules: ok      %-40s %s (%s lines)\n' "$dep" "$marker" "$count"
  fi
done
rm -f "$code"
echo "native-modules: $app: $missing missing, $unknown without a marker"
[ "$missing" -eq 0 ] && [ "$unknown" -eq 0 ]
