import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useUser, useAuth } from './FirebaseAuthContext';
import { getProfile, saveProfile, setTokenGetter } from '../lib/api';

const AuthProfileContext = createContext(null);

export function AuthProfileProvider({ children }) {
  const { getToken } = useAuth();
  const { isLoaded, isSignedIn, user } = useUser();
  const [profile, setProfile] = useState(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  // Always ensure token getter is registered with apiClient
  useEffect(() => {
    if (getToken) {
      setTokenGetter(getToken);
    }
  }, [getToken]);

  const fetchProfile = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !user) {
      setIsProfileLoading(false);
      return null;
    }

    try {
      const res = await getProfile();
      const p = res?.data?.data || null;
      setProfile(p);

      // Auto-sync basic Clerk image/name if missing
      const currentImg = user.imageUrl || '';
      const email = p?.email || user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress || '';
      const name = p?.name || user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || 'Campus Student';
      const phone = p?.phone || p?.whatsappNumber || user.primaryPhoneNumber?.phoneNumber || user.phoneNumbers?.[0]?.phoneNumber || '';

      if ((!p || !p.imageUrl || (currentImg && p.imageUrl !== currentImg)) && email) {
        const syncPayload = {
          name,
          email,
          college: p?.college || 'VIT, Bhopal',
          imageUrl: currentImg
        };
        // Never pass blank phone numbers during background image sync
        if (phone) {
          syncPayload.phone = phone;
          syncPayload.whatsappNumber = phone;
        }
        saveProfile(syncPayload).then((savedRes) => {
          if (savedRes?.data?.data) {
            setProfile(savedRes.data.data);
          }
        }).catch((err) => console.warn('[ProfileProvider] Auto-sync image warning:', err?.message));
      }

      return p;
    } catch (err) {
      console.warn('[ProfileProvider] Profile fetch warning:', err?.message);
      return null;
    } finally {
      setIsProfileLoading(false);
    }
  }, [isLoaded, isSignedIn, user]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setProfile(null);
      setIsProfileLoading(false);
      return;
    }
    fetchProfile();
  }, [isLoaded, isSignedIn, fetchProfile]);

  const setWhatsAppNumber = useCallback((number) => {
    setProfile((prev) => ({
      ...(prev || {}),
      whatsappNumber: number,
      phone: prev?.phone || number
    }));
  }, []);

  const value = {
    profile,
    isProfileLoading,
    hasWhatsApp: Boolean(profile?.whatsappNumber?.trim() || profile?.phone?.trim()),
    setWhatsAppNumber,
    refreshProfile: fetchProfile
  };

  return (
    <AuthProfileContext.Provider value={value}>
      {children}
    </AuthProfileContext.Provider>
  );
}

export function useAuthProfile() {
  const context = useContext(AuthProfileContext);
  if (!context) {
    throw new Error('useAuthProfile must be used within an AuthProfileProvider');
  }
  return context;
}
