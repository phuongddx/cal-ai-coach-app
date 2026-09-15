import AuthenticationServices
import CoachCalDesignSystem
import SwiftUI

// RESEARCH Patterns 1-3: three sign-in entry points, all funneling into the
// Task 1 AuthSessionStore methods. Each path calls environment.handleSignIn
// on success, which binds the SyncEngine to the real owner.
struct SignInView: View {
  @Environment(AppEnvironment.self) private var environment

  @State private var appleNonce: String?
  @State private var email = ""
  @State private var otpCode = ""
  @State private var otpSent = false
  @State private var isBusy = false
  @State private var errorMessage: String?

  private static let redirectURL = URL(string: "coachcal://login-callback")!

  var body: some View {
    ZStack {
      Color.ccBackground.ignoresSafeArea()
      VStack(spacing: 24) {
        Text("Sign in to CoachCal")
          .font(.title2.bold())

        SignInWithAppleButton(.signIn) { request in
          let nonce = AppleNonceProvider.makeNonce()
          appleNonce = nonce.raw
          request.nonce = nonce.hashed
        } onCompletion: { result in
          handleAppleCompletion(result)
        }
        .signInWithAppleButtonStyle(.black)
        .frame(height: 44)
        .accessibilityIdentifier("auth.signInApple")

        Button {
          Task { await signInWithGoogle() }
        } label: {
          Text("Continue with Google")
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.bordered)
        .accessibilityIdentifier("auth.signInGoogle")

        VStack(spacing: 12) {
          TextField("Email", text: $email)
            .textContentType(.emailAddress)
            .keyboardType(.emailAddress)
            .textInputAutocapitalization(.never)
            .accessibilityIdentifier("auth.emailField")

          if otpSent {
            TextField("6-digit code", text: $otpCode)
              .keyboardType(.numberPad)
              .accessibilityIdentifier("auth.otpField")

            Button("Verify") {
              Task { await verifyCode() }
            }
            .accessibilityIdentifier("auth.verifyCode")
          } else {
            Button("Send code") {
              Task { await sendCode() }
            }
            .disabled(email.isEmpty)
            .accessibilityIdentifier("auth.sendCode")
          }
        }

        if let errorMessage {
          Text(errorMessage)
            .foregroundStyle(.red)
            .font(.footnote)
        }
      }
      .padding(24)
      .disabled(isBusy)
    }
  }

  private func handleAppleCompletion(_ result: Result<ASAuthorization, Error>) {
    Task {
      switch result {
      case .failure(let error):
        errorMessage = error.localizedDescription
      case .success(let authorization):
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
          let idTokenData = credential.identityToken,
          let idToken = String(data: idTokenData, encoding: .utf8),
          let nonce = appleNonce
        else {
          errorMessage = "Apple sign-in did not return a usable credential."
          return
        }
        isBusy = true
        defer { isBusy = false }
        do {
          let session = try await environment.authSessionStore.signInWithApple(
            idToken: idToken, nonce: nonce
          )
          await environment.handleSignIn(session)
        } catch {
          errorMessage = error.localizedDescription
        }
      }
    }
  }

  private func signInWithGoogle() async {
    isBusy = true
    defer { isBusy = false }
    do {
      let session = try await environment.authSessionStore.signInWithGoogle(
        redirectTo: Self.redirectURL
      )
      await environment.handleSignIn(session)
    } catch {
      errorMessage = error.localizedDescription
    }
  }

  private func sendCode() async {
    isBusy = true
    defer { isBusy = false }
    do {
      try await environment.authSessionStore.signInWithOTP(email: email, redirectTo: Self.redirectURL)
      otpSent = true
    } catch {
      errorMessage = error.localizedDescription
    }
  }

  private func verifyCode() async {
    isBusy = true
    defer { isBusy = false }
    do {
      let session = try await environment.authSessionStore.verifyOTP(email: email, token: otpCode)
      await environment.handleSignIn(session)
    } catch {
      errorMessage = error.localizedDescription
    }
  }
}
