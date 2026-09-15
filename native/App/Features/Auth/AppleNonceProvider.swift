import CryptoKit
import Foundation

// RESEARCH Pattern 1: single-use nonce, SHA256-hashed via CryptoKit before it
// reaches Apple — never a custom digest. The raw value round-trips to GoTrue
// (`signInWithApple(idToken:nonce:)`); the hashed value goes on the request.
enum AppleNonceProvider {
  static func makeNonce() -> (raw: String, hashed: String) {
    var bytes = [UInt8](repeating: 0, count: 32)
    let status = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
    // A silent fallback here would sign in with an all-zero, fully
    // predictable nonce — defeating Sign in with Apple's replay protection.
    // Matches this codebase's existing crypto/init-failure convention
    // (fatalError, e.g. PersistenceBootstrap) rather than proceeding.
    guard status == errSecSuccess else {
      fatalError("SecRandomCopyBytes failed with status \(status)")
    }
    let raw = bytes.map { String(format: "%02x", $0) }.joined()
    let hashed = SHA256.hash(data: Data(raw.utf8)).map { String(format: "%02x", $0) }.joined()
    return (raw, hashed)
  }
}
