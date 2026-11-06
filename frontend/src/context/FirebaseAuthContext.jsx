import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile as updateFirebaseProfile,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { setTokenGetter } from '../lib/api';

const FirebaseAuthContext = createContext(null);

function mapFirebaseUser(fbUser) {
  if (!fbUser) return null;
  const displayName = fbUser.displayName || '';
  const nameParts = displayName.trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  const email = fbUser.email || '';

  return {
    id: `firebase_${fbUser.uid}`,
    uid: fbUser.uid,
    firebaseUid: fbUser.uid,
    fullName: displayName || 'Campus Student',
    firstName,
    lastName,
    imageUrl: fbUser.photoURL || '',
    email,
    primaryEmailAddress: { emailAddress: email },
    emailAddresses: email ? [{ emailAddress: email }] : [],
    phoneNumbers: fbUser.phoneNumber ? [{ phoneNumber: fbUser.phoneNumber }] : [],
    primaryPhoneNumber: fbUser.phoneNumber ? { phoneNumber: fbUser.phoneNumber } : null,
    emailVerified: fbUser.emailVerified
  };
}

export function FirebaseAuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Bind token getter to Firebase Auth
  const getToken = useCallback(async () => {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken(false);
  }, []);

  useEffect(() => {
    setTokenGetter(getToken);
  }, [getToken]);

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        setUser(mapFirebaseUser(fbUser));
        setTokenGetter(() => fbUser.getIdToken(false));
      } else {
        setUser(null);
        setTokenGetter(() => Promise.resolve(null));
      }
      setIsLoaded(true);
    });

    return () => unsubscribe();
  }, []);

  // Google Sign-In
  const signInWithGoogle = useCallback(async () => {
    try {
      setAuthError(null);
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (err) {
      console.error('[FirebaseAuth] Google Sign-In error:', err);
      setAuthError(err.message);
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

  // Sign Out
  const signOutUser = useCallback(async () => {
    try {
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
    isSignedIn: Boolean(firebaseUser),
    userId: user?.id || null,
    getToken,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
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
  const { getToken, isSignedIn, isLoaded, userId } = useFirebaseAuth();
  return { getToken, isSignedIn, isLoaded, userId };
}

export function useClerk() {
  const { signOut } = useFirebaseAuth();
  return { signOut };
}

