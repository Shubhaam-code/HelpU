import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useUser, useAuth } from './FirebaseAuthContext';
import { getProfile, saveProfile, setTokenGetter } from '../lib/api';
import { getProfileDraft, clearProfileDraft } from '../utils/guestDraft';

const AuthProfileContext = createContext(null);

export function AuthProfileProvider({ children }) {
  const { getToken } = useAuth();
  const { isLoaded, isSignedIn, user } = useUser();

  // Track latest profile data via ref to avoid stale closure bugs in fetchProfile
  const profileRef = useRef(null);

  // Restore cached profile immediately to prevent flashing or unnecessary onboarding redirects
  const [profile, setProfile] = useState(() => {
    try {
      const raw = localStorage.getItem('helpu_active_profile');
      const parsed = raw ? JSON.parse(raw) : null;
      profileRef.current = parsed;
      return parsed;
    } catch {
      return null;
    }
  });

  // Keep ref in sync with state
  const setProfileAndRef = useCallback((updaterOrValue) => {
    setProfile((prev) => {
      const next = typeof updaterOrValue === 'function' ? updaterOrValue(prev) : updaterOrValue;
      profileRef.current = next;
      return next;
    });
  }, []);

  const [isProfileLoading, setIsProfileLoading] = useState(() => !profileRef.current);

  // Sync profile from user-specific localStorage whenever user ID is established
  useEffect(() => {
    if (user?.id) {
      try {
        const userSpecific = localStorage.getItem(`helpu_profile_${user.id}`);
        if (userSpecific) {
          const parsed = JSON.parse(userSpecific);
          setProfileAndRef(parsed);
        }
      } catch (e) {
        // ignore
      }
    }
  }, [user?.id, setProfileAndRef]);

  // Always ensure token getter is registered with apiClient
  useEffect(() => {
    if (getToken) {
      setTokenGetter(getToken);
    }
  }, [getToken]);

  // fetchProfile: uses profileRef (not profile state) to avoid stale dependency and infinite loops
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
        setProfileAndRef(p);
        try {
          localStorage.setItem(`helpu_profile_${user.id}`, JSON.stringify(p));
          localStorage.setItem('helpu_active_profile', JSON.stringify(p));
        } catch (e) {
          // ignore
        }

        // Auto-sync profile image ONLY if user already has onboarding complete (has whatsapp)
        // This prevents an image-sync saveProfile from briefly setting hasWhatsApp and redirecting
        // a user who is mid-way through filling the onboarding form.
        const hasCompletedOnboarding = Boolean(p?.whatsappNumber?.trim() || p?.phone?.trim());
        if (hasCompletedOnboarding) {
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
                setProfileAndRef(savedRes.data.data);
                try {
                  localStorage.setItem(`helpu_profile_${user.id}`, JSON.stringify(savedRes.data.data));
                } catch (e) {}
              }
            }).catch((err) => console.warn('[ProfileProvider] Auto-sync image warning:', err?.message));
          }
        }

        return p;
      } else {
        // Backend returned null data (user genuinely not created in DB yet)
        setProfileAndRef((prev) => {
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
      // Keep existing cached profile so an existing user is NEVER falsely redirected to onboarding
      return profileRef.current;
    } finally {
      setIsProfileLoading(false);
    }
  // ⚠️ Intentionally omit `profile` from deps — use profileRef.current instead to prevent
  // infinite fetch-on-profile-update loops that caused the premature onboarding redirect.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, user, setProfileAndRef]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setProfileAndRef(null);
      setIsProfileLoading(false);
      try {
        localStorage.removeItem('helpu_active_profile');
      } catch (e) {}
      return;
    }
    fetchProfile();
  }, [isLoaded, isSignedIn, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const setWhatsAppNumber = useCallback((number) => {
    setProfileAndRef((prev) => {
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
  }, [user?.id, setProfileAndRef]);

  const setProfileData = useCallback((nextProfile) => {
    if (!nextProfile) return;
    setProfileAndRef((prev) => {
      const merged = { ...(prev || {}), ...nextProfile };
      try {
        if (user?.id) {
          localStorage.setItem(`helpu_profile_${user.id}`, JSON.stringify(merged));
        }
        localStorage.setItem('helpu_active_profile', JSON.stringify(merged));
      } catch (e) {}
      return merged;
    });
  }, [user?.id, setProfileAndRef]);

  const value = {
    profile,
    isProfileLoading,
    hasWhatsApp: Boolean(profile?.whatsappNumber?.trim() || profile?.phone?.trim()),
    setWhatsAppNumber,
    setProfileData,
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
