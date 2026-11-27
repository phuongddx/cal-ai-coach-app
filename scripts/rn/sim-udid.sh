# Prints the UDID of this program's evidence Simulator: the first available "iPhone 17 Pro" on iOS 26.4.
#
# Nothing pins a UDID any more. The machine lost every Simulator on 2026-11-27 (a cleanup outside
# this program) and the device was recreated with a new one, which broke three scripts that had the
# old id written in them. Source this file and call `sim_udid`; SIM_UDID overrides the lookup at the
# call site: UDID="${SIM_UDID:-$(sim_udid)}".
#
# To recreate the device:
#   xcrun simctl create "iPhone 17 Pro" com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro \
#     com.apple.CoreSimulator.SimRuntime.iOS-26-4
sim_udid() {
  xcrun simctl list devices available \
    | awk '/^-- iOS 26\.4 --/ { on = 1; next } /^-- / { on = 0 } on && /iPhone 17 Pro \(/' \
    | grep -oE '[0-9A-F-]{36}' \
    | head -1
}
