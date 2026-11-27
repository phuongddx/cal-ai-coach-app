Pod::Spec.new do |s|
  s.name           = 'CoachCalLaunchArguments'
  s.version        = '0.0.1'
  s.summary        = 'Reads the process arguments of the app (the --cc* debug and fixture flags).'
  s.description    = 'Local Expo module of CoachCal. Replaces ProcessInfo.processInfo.arguments of the SwiftUI app.'
  s.license        = 'UNLICENSED'
  s.author         = 'ePost'
  s.homepage       = 'https://github.com/phuongddx/cal-ai-coach-app'
  s.platforms      = { :ios => '18.0' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/phuongddx/cal-ai-coach-app.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
