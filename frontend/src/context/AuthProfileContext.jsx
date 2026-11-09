import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useUser, useAuth } from './FirebaseAuthContext';
import { getProfile, saveProfile, setTokenGetter } from '../lib/api';
import { getProfileDraft, clearProfileDraft } from '../utils/guestDraft';

const AuthProfileContext = createContext(null);

export function AuthProfileProvider({ children }) {
  const { getToken } = useAuth();
  const { isLoaded, isSignedIn, user } = useUser();

  const storageKey = useMemo(() => {
    return user?.id ? `helpu_profile_${user.id}` : 'helpu_active_profile';
  }, [user?.id]);

  // Restore cached profile immediately to prevent flashing or unnecessary onboarding redirects
  const [profile, setProfile] = useState(() => {
    try {
      const raw = localStorage.getItem('helpu_active_profile');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [isProfileLoading, setIsProfileLoading] = useState(true);

  // Sync profile from user-specific localStorage whenever user ID is established
  useEffect(() => {
    if (user?.id) {
      try {
        const userSpecific = localStorage.getItem(`helpu_profile_${user.id}`);
        if (userSpecific) {
          const parsed = JSON.parse(userSpecific);
          setProfile(parsed);
        }
      } catch (e) {
        // ignore
      }
    }
  }, [user?.id]);

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
      // Check if user filled out guest student profile draft before authenticating
      const guestDraft = getProfileDraft();
      const res = await getProfile();
      let p = res?.data?.data;

      if (guestDraft && guestDraft.data) {
        const d = guestDraft.data;
        const email = p?.email || user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress || user.email || '';
        const currentImg = user.imageUrl || p?.imageUrl || '';

        const payload = {
          name: d.name || user.fullName || p?.name || 'Campus Student',
          email,
          college: d.college || p?.college || 'VIT, Bhopal',
          registrationNumber: d.registrationNumber || p?.registrationNumber || '',
          branch: d.branch || p?.branch || '',
          year: d.year || p?.year || '',
          phone: d.phone || d.whatsappNumber || p?.phone || '',
          whatsappNumber: d.whatsappNumber || d.phone || p?.whatsappNumber || '',
          whatsappCountryCode: d.whatsappCountryCode || 'IN',
          imageUrl: currentImg
        };

        try {
          const savedRes = await saveProfile(payload);
          if (savedRes?.data?.data) {
            p = savedRes.data.data;
            clearProfileDraft();
          }
        } catch (saveErr) {
          console.warn('[ProfileProvider] Error syncing guest profile draft:', saveErr?.message);
        }
      }

      if (p) {
        setProfile(p);
        try {
          localStorage.setItem(`helpu_profile_${user.id}`, JSON.stringify(p));
          localStorage.setItem('helpu_active_profile', JSON.stringify(p));
        } catch (e) {
          // ignore
        }

        // Auto-sync basic auth image if missing from profile, without touching phone numbers
        const currentImg = user.imageUrl || '';
        const email = p.email || user.primaryEmailAddress?.emailAddress || '';
        const name = p.name || user.fullName || 'Campus Student';

        if ((!p.imageUrl || (currentImg && p.imageUrl !== currentImg)) && email && currentImg) {
          saveProfile({
            name,
            email,
            college: p.college || 'VIT, Bhopal',
            imageUrl: currentImg
          }).then((savedRes) => {
            if (savedRes?.data?.data) {
              setProfile(savedRes.data.data);
              try {
                localStorage.setItem(`helpu_profile_${user.id}`, JSON.stringify(savedRes.data.data));
              } catch (e) {}
            }
          }).catch((err) => console.warn('[ProfileProvider] Auto-sync image warning:', err?.message));
        }

        return p;
      } else {
        // Backend returned null data (user genuinely not created in DB yet)
        setProfile((prev) => {
          // If we had a locally cached profile with a verified WhatsApp number, preserve it
          if (prev?.whatsappNumber || prev?.phone) {
            return prev;
          }
          return null;
        });
        return null;
      }
    } catch (err) {
      console.warn('[ProfileProvider] Profile fetch warning (preserving cached profile):', err?.message);
      // Keep existing cached profile so an existing user is NEVER falsely redirected to onboarding on network error
      return profile;
    } finally {
      setIsProfileLoading(false);
    }
  }, [isLoaded, isSignedIn, user, profile]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setProfile(null);
      setIsProfileLoading(false);
      try {
        localStorage.removeItem('helpu_active_profile');
      } catch (e) {}
      return;
    }
    fetchProfile();
  }, [isLoaded, isSignedIn, user?.id]);

  const setWhatsAppNumber = useCallback((number) => {
    setProfile((prev) => {
      const updated = {
        ...(prev || {}),
        whatsappNumber: number,
        phone: prev?.phone || number
      };
      if (user?.id) {
        try {
          localStorage.setItem(`helpu_profile_${user.id}`, JSON.stringify(updated));
          localStorage.setItem('helpu_active_profile', JSON.stringify(updated));
        } catch (e) {}
      }
      return updated;
    });
  }, [user?.id]);

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
