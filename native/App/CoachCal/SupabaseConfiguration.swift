import Foundation

struct SupabaseConfiguration {
  let url: URL
  let anonKey: String

  init(bundle: Bundle = .main) throws {
    guard let rawURL = bundle.object(
      forInfoDictionaryKey: "SUPABASE_URL"
    ) as? String, let url = URL(string: rawURL) else {
      throw SupabaseConfigurationError.missingURL
    }
    guard let anonKey = bundle.object(
      forInfoDictionaryKey: "SUPABASE_ANON_KEY"
    ) as? String, !anonKey.isEmpty else {
      throw SupabaseConfigurationError.missingAnonKey
    }
    self.url = url
    self.anonKey = anonKey
  }
}

enum SupabaseConfigurationError: Error {
  case missingURL
  case missingAnonKey
}
