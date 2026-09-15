import CryptoKit
import Foundation

// RESEARCH Pattern 1: single-use nonce, SHA256-hashed via CryptoKit before it
// reaches Apple — never a custom digest. The raw value round-trips to GoTrue
// (`signInWithApple(idToken:nonce:)`); the hashed value goes on the request.
enum AppleNonceProvider {
  static func makeNonce() -> (raw: String, hashed: String) {
    var bytes = [UInt8](repeating: 0, count: 32)
    _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
    let raw = bytes.map { String(format: "%02x", $0) }.joined()
    let hashed = SHA256.hash(data: Data(raw.utf8)).map { String(format: "%02x", $0) }.joined()
    return (raw, hashed)
  }
}
