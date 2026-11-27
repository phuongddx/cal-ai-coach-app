import { useRouter } from 'expo-router';

import { SignInScreen } from '../features/auth/SignInScreen';

/** AU-01: the sign-in route. The session is already stored by the time `onSignedIn` runs. */
export default function SignInRoute() {
  const router = useRouter();
  return <SignInScreen onSignedIn={() => router.replace('/')} />;
}
