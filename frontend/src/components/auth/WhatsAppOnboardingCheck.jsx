import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { getProfile } from '../../lib/api';

/**
 * WhatsAppOnboardingCheck
 * 
 * Checks if authenticated user has a WhatsApp number.
 * If missing, redirects to /whatsapp-setup.
 */
export function WhatsAppOnboardingCheck() {
  const { isSignedIn, isLoaded } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    // Wait for Clerk to load and user to be signed in
    if (!isLoaded || !isSignedIn) {
      return;
    }

    // Skip check if already on WhatsApp setup page or auth pages
    const currentPath = location.pathname;
    const isAuthPage = 
      currentPath === '/' ||
      currentPath === '/auth' ||
      currentPath.startsWith('/sign-in') ||
      currentPath.startsWith('/sign-up') ||
      currentPath === '/login' ||
      currentPath === '/signup' ||
      currentPath === '/whatsapp-setup';

    if (isAuthPage) {
      return;
    }

    // Only check once per session
    if (hasChecked) {
      return;
    }

    // Check if user has WhatsApp number
    const checkWhatsAppNumber = async () => {
      try {
        console.log('🔍 Checking WhatsApp number...');
        const response = await getProfile();
        const profile = response.data?.data;

        console.log('📱 Profile data:', profile);
        console.log('📞 WhatsApp number:', profile?.whatsappNumber);

        // If profile exists but no WhatsApp number, redirect to setup
        if (profile && !profile.whatsappNumber) {
          console.log('✅ No WhatsApp number found, redirecting to setup...');
          navigate('/whatsapp-setup', { replace: true });
        } else if (profile && profile.whatsappNumber) {
          console.log('✅ WhatsApp number exists:', profile.whatsappNumber);
        } else {
          console.log('⚠️ No profile data found');
        }
      } catch (error) {
        console.error('❌ Error checking WhatsApp number:', error);
        // Don't block the user if API fails
      } finally {
        setHasChecked(true);
      }
    };

    // Run check with small delay to ensure profile API is ready
    const timer = setTimeout(() => {
      checkWhatsAppNumber();
    }, 500);

    return () => clearTimeout(timer);
  }, [isLoaded, isSignedIn, location.pathname, navigate, hasChecked]);

  return null;
}
