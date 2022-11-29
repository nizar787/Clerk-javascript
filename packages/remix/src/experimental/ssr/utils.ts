import { LIB_VERSION } from '@clerk/clerk-react/dist/info';
import { json } from '@remix-run/server-runtime';
import cookie from 'cookie';

import { AuthState, clerk } from '../clerk';
import { LoaderFunctionArgs, LoaderFunctionArgsWithAuth } from './types';

/**
 * Inject `auth`, `user` and `session` properties into `request`
 * @internal
 */
export function injectAuthIntoRequest(args: LoaderFunctionArgs, authState: AuthState): LoaderFunctionArgsWithAuth {
  const { user, session, userId, sessionId, getToken, sessionClaims } = authState;
  (args.request as any).auth = {
    userId,
    sessionId,
    getToken,
    actor: sessionClaims?.act || null,
  };
  (args.request as any).user = user;
  (args.request as any).session = session;
  return args as LoaderFunctionArgsWithAuth;
}

/**
 * See `packages/nextjs/src/middleware/utils/sanitizeAuthData.ts`
 * TODO: Make a shared function
 *
 * @internal
 */
export function sanitizeAuthData(authState: AuthState): any {
  if (!authState.isSignedIn) {
    return authState;
  }

  const user = authState.user ? { ...authState.user } : authState.user;
  const organization = authState.user ? { ...authState.user } : authState.user;
  clerk.toSSRResource(user);
  clerk.toSSRResource(organization);

  return { ...authState, user, organization };
}

/**
 * @internal
 */
export function isResponse(value: any): value is Response {
  return (
    value != null &&
    typeof value.status === 'number' &&
    typeof value.statusText === 'string' &&
    typeof value.headers === 'object' &&
    typeof value.body !== 'undefined'
  );
}

/**
 * @internal
 */
export function isRedirect(res: Response): boolean {
  return res.status >= 300 && res.status < 400;
}

/**
 * @internal
 */
export const parseCookies = (req: Request) => {
  return cookie.parse(req.headers.get('cookie') || '');
};

/**
 * @internal
 */
export function assertObject(val: any, error?: string): asserts val is Record<string, unknown> {
  if (!val || typeof val !== 'object' || Array.isArray(val)) {
    throw new Error(error || '');
  }
}

/**
 * @internal
 */
export const throwInterstitialJsonResponse = (authState: AuthState) => {
  throw json(
    wrapWithClerkState({
      __clerk_ssr_interstitial_html: clerk.localInterstitial({
        debugData: clerk.debugAuthState(authState),
        frontendApi: authState.frontendApi,
        pkgVersion: LIB_VERSION,
      }),
    }),
    { status: 401 },
  );
};

/**
 * @internal
 */
export const returnLoaderResultJsonResponse = (opts: { authState: AuthState; callbackResult?: any }) => {
  const { reason, message, isSignedIn, isInterstitial, ...rest } = opts.authState;
  return json({
    ...(opts.callbackResult || {}),
    ...wrapWithClerkState({
      __clerk_ssr_state: rest,
      __frontendApi: opts.authState.frontendApi,
      __clerk_debug: clerk.debugAuthState(opts.authState),
    }),
  });
};

/**
 * Wraps obscured clerk internals with a readable `clerkState` key.
 * This is intended to be passed by the user into <ClerkProvider>
 *
 * @internal
 */
export const wrapWithClerkState = (data: any) => {
  return { clerkState: { __internal_clerk_state: { ...data } } };
};