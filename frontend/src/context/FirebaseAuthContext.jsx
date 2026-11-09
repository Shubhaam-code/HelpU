import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile as updateFirebaseProfile,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithCredential
} from 'firebase/auth';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { Capacitor } from '@capacitor/core';
import { auth, googleProvider } from '../lib/firebase';
import { setTokenGetter } from '../lib/api';
import { setActiveAuthUser } from '../mobile/pushNotifications';
import { clearUserCache } from '../lib/queryClient';

const FirebaseAuthContext = createContext(null);

function mapFirebaseUser(fbUser) {
  if (!fbUser) return null;
  const displayName = fbUser.displayName || '';
  const nameParts = displayName.trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  const email = fbUser.email || '';
  const photo = fbUser.photoURL || fbUser.photoUrl || '';
  const phone = fbUser.phoneNumber || '';

  return {
    id: `firebase_${fbUser.uid}`,
    uid: fbUser.uid,
    firebaseUid: fbUser.uid,
    fullName: displayName || 'Campus Student',
    firstName,
    lastName,
    imageUrl: photo,
    email,
    primaryEmailAddress: { emailAddress: email },
    emailAddresses: email ? [{ emailAddress: email }] : [],
    phoneNumbers: phone ? [{ phoneNumber: phone }] : [],
    primaryPhoneNumber: phone ? { phoneNumber: phone } : null,
    emailVerified: fbUser.emailVerified
  };
}

export function FirebaseAuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Bind token getter to Firebase Auth (supports Web and native Android)
  const getToken = useCallback(async () => {
    // 1. Try Firebase JS SDK current user
    if (auth?.currentUser) {
      try {
        const token = await auth.currentUser.getIdToken(false);
        if (token) return token;
      } catch (err) {
        console.warn('[FirebaseAuth] Web SDK getIdToken warning:', err);
      }
    }
    // 2. Try native Android Firebase Auth if on native platform
    if (Capacitor.isNativePlatform()) {
      try {
        const res = await FirebaseAuthentication.getIdToken({ forceRefresh: false });
        if (res?.token) return res.token;
      } catch (err) {
        console.warn('[FirebaseAuth] Native getIdToken warning:', err);
      }
    }
    return null;
  }, []);

  useEffect(() => {
    setTokenGetter(getToken);
  }, [getToken]);

  // Synchronize authenticated user state with Native Push Notifications (FCM)
  useEffect(() => {
    setActiveAuthUser(user);
  }, [user]);

  // Listen to Firebase JS auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        setUser(mapFirebaseUser(fbUser));
      } else {
        // If not authenticated in JS SDK, verify whether native user is logged in
        if (Capacitor.isNativePlatform()) {
          try {
            const { user: nativeUser } = await FirebaseAuthentication.getCurrentUser();
            if (nativeUser) {
              setUser(mapFirebaseUser(nativeUser));
              setFirebaseUser(nativeUser);
              setIsLoaded(true);
              return;
            }
          } catch (e) {
            // ignore
          }
        }
        setUser(null);
      }
      setIsLoaded(true);
    });

    return () => unsubscribe();
  }, []);

  // Listen to native Android auth state changes when on native platform
  useEffect(() => {
    let nativeListener = null;

    if (Capacitor.isNativePlatform()) {
      FirebaseAuthentication.getCurrentUser().then(async ({ user: nativeUser }) => {
        if (nativeUser && !auth.currentUser) {
          try {
            setUser(mapFirebaseUser(nativeUser));
            setFirebaseUser(nativeUser);
            setIsLoaded(true);
          } catch (e) {
            console.warn('[FirebaseAuth] Failed restoring native session:', e);
          }
        }
      }).catch(err => {
        console.warn('[FirebaseAuth] getCurrentUser error:', err);
      });

      FirebaseAuthentication.addListener('authStateChange', async ({ user: nUser }) => {
        if (nUser) {
          setUser(mapFirebaseUser(nUser));
          setFirebaseUser(nUser);
        } else if (!auth.currentUser) {
          setUser(null);
          setFirebaseUser(null);
        }
      }).then(handle => {
        nativeListener = handle;
      });
    }

    return () => {
      if (nativeListener?.remove) {
        nativeListener.remove();
      }
    };
  }, []);

  // Google Sign-In (Web popup vs. Native Android Google Account selector)
  const signInWithGoogle = useCallback(async () => {
    try {
      setAuthError(null);

      if (Capacitor.isNativePlatform()) {
        // Native Android Google Account selection dialog (no browser, no redirect)
        const result = await FirebaseAuthentication.signInWithGoogle();

        // Bridge native credential into Firebase JS SDK so both native & web state stay unified
        if (result?.credential?.idToken) {
          const credential = GoogleAuthProvider.credential(result.credential.idToken);
          const userCredential = await signInWithCredential(auth, credential);
          return userCredential.user;
        }

        if (result?.user) {
          const mapped = mapFirebaseUser(result.user);
          setUser(mapped);
          setFirebaseUser(result.user);
          return result.user;
        }

        throw new Error('Native Google sign-in completed without user credentials.');
      } else {
        // Web standard Google Sign-In popup
        const result = await signInWithPopup(auth, googleProvider);
        return result.user;
      }
    } catch (err) {
      console.error('[FirebaseAuth] Google Sign-In error:', err);
      const isCancelled =
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request' ||
        err?.message?.toLowerCase().includes('cancel') ||
        err?.message?.includes('16: Cannot find a matching credential');
      if (!isCancelled) {
        setAuthError(err.message);
      }
      throw err;
    }
  }, []);

  // Email & Password Sign-In
  const signInWithEmail = useCallback(async (email, password) => {
    try {
      setAuthError(null);
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      return result.user;
    } catch (err) {
      console.error('[FirebaseAuth] Email Sign-In error:', err);
      setAuthError(err.message);
      throw err;
    }
  }, []);

  // Email & Password Sign-Up
  const signUpWithEmail = useCallback(async (email, password, displayName = '') => {
    try {
      setAuthError(null);
      const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (displayName.trim()) {
        await updateFirebaseProfile(result.user, { displayName: displayName.trim() });
      }
      return result.user;
    } catch (err) {
      console.error('[FirebaseAuth] Email Sign-Up error:', err);
      setAuthError(err.message);
      throw err;
    }
  }, []);

  // Password Reset Email
  const resetPassword = useCallback(async (email) => {
    try {
      setAuthError(null);
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err) {
      console.error('[FirebaseAuth] Password reset error:', err);
      setAuthError(err.message);
      throw err;
    }
  }, []);

  // Sign Out (Native Android + Web Firebase)
  const signOutUser = useCallback(async () => {
    try {
      clearUserCache();
      if (Capacitor.isNativePlatform()) {
        try {
          await FirebaseAuthentication.signOut();
        } catch (err) {
          console.warn('[FirebaseAuth] Native signOut warning:', err);
        }
      }
      await firebaseSignOut(auth);
      setFirebaseUser(null);
      setUser(null);
    } catch (err) {
      console.error('[FirebaseAuth] Sign-out error:', err);
      throw err;
    }
  }, []);

  const value = {
    user,
    firebaseUser,
    isLoaded,
    isSignedIn: Boolean(firebaseUser || user),
    userId: user?.id || null,
    getToken,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    signOut: signOutUser,
    authError,
    setAuthError
  };

  return (
    <FirebaseAuthContext.Provider value={value}>
      {children}
    </FirebaseAuthContext.Provider>
  );
}

export function useFirebaseAuth() {
  const context = useContext(FirebaseAuthContext);
  if (!context) {
    throw new Error('useFirebaseAuth must be used within a FirebaseAuthProvider');
  }
  return context;
}

// Seamless backward-compatible hooks mapping to Firebase Authentication
export function useUser() {
  const { user, isLoaded, isSignedIn } = useFirebaseAuth();
  return { user, isLoaded, isSignedIn };
}

export function useAuth() {
  const { isSignedIn, userId, getToken } = useFirebaseAuth();
  return { isSignedIn, userId, getToken };
}

export function useClerk() {
  const { signOut } = useFirebaseAuth();
  return { signOut };
}
