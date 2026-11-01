import { useState, useEffect, useCallback } from 'react';
import { SignedIn, SignedOut, SignIn, UserButton, useUser, useAuth } from '@clerk/clerk-react';
import './App.css';

function App() {
  const { user } = useUser();
  const { getToken, signOut } = useAuth();

  // Profile states
  const [profile, setProfile] = useState(null);
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    college: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState('');
  const [formError, setFormError] = useState('');

  // Backend verification test states
  const [apiResponse, setApiResponse] = useState(null);
  const [apiStatus, setApiStatus] = useState(null);
  const [isLoadingTest, setIsLoadingTest] = useState(false);
  const [testError, setTestError] = useState('');

  const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  // 1. Fetch profile to check if already completed
  const fetchProfile = useCallback(async () => {
    if (!user) return;
    setIsCheckingProfile(true);
    setFormError('');

    try {
      const token = await getToken();
      if (!token) {
        setIsCheckingProfile(false);
        return;
      }

      const res = await fetch(`${backendUrl}/api/students/profile`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          setProfile(result.data);
          setFormData({
            name: result.data.name || '',
            email: result.data.email || '',
            phone: result.data.phone || '',
            college: result.data.college || ''
          });
        }
      } else if (res.status === 404) {
        // Profile not completed yet
        setProfile(null);
        setFormData((prev) => ({
          ...prev,
          name: prev.name || user.fullName || '',
          email: prev.email || user.primaryEmailAddress?.emailAddress || ''
        }));
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setIsCheckingProfile(false);
    }
  }, [user, getToken, backendUrl]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user, fetchProfile]);

  // Handle form field change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // 2. Submit profile form
  const handleSubmitProfile = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormSuccess('');
    setFormError('');

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication session expired. Please log in again.');
      }

      const res = await fetch(`${backendUrl}/api/students/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.message || 'Failed to save student profile.');
      }

      setProfile(result.data);
      setFormSuccess('Student profile saved successfully!');
      setIsEditing(false);
    } catch (err) {
      console.error('Submit error:', err);
      setFormError(err.message || 'An error occurred while saving your profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Test Backend Auth API
  const handleTestBackend = async () => {
    setIsLoadingTest(true);
    setApiResponse(null);
    setApiStatus(null);
    setTestError('');

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('No active Clerk session token found.');
      }

      const response = await fetch(`${backendUrl}/api/auth/me`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      setApiStatus(response.status);
      const data = await response.json();
      setApiResponse(data);
    } catch (err) {
      console.error('API Error:', err);
      setTestError(err.message || 'Error connecting to backend');
    } finally {
      setIsLoadingTest(false);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="brand">
          <span className="logo-badge">🚗</span>
          <h2>CampusPool</h2>
        </div>
        <SignedIn>
          <div className="header-actions">
            <span className="welcome-text">
              {profile?.name || user?.fullName || user?.primaryEmailAddress?.emailAddress}
            </span>
            <UserButton afterSignOutUrl="/" />
          </div>
        </SignedIn>
      </header>

      <main className="main-content">
        <SignedOut>
          <div className="auth-card">
            <div className="auth-intro">
              <h1>Welcome to CampusPool</h1>
              <p>Sign in or create an account to access campus ride-sharing.</p>
            </div>
            <div className="clerk-signin-wrapper">
              <SignIn routing="hash" />
            </div>
          </div>
        </SignedOut>

        <SignedIn>
          <div className="dashboard-card">
            {isCheckingProfile ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Checking student profile status...</p>
              </div>
            ) : profile && !isEditing ? (
              // 4. Profile Summary
              <div className="profile-summary-view">
                <div className="summary-header">
                  <div className="avatar-placeholder">
                    {user?.imageUrl ? (
                      <img src={user.imageUrl} alt="Profile" className="user-avatar" />
                    ) : (
                      <span>🎓</span>
                    )}
                  </div>
                  <div className="summary-title">
                    <h3>{profile.name}</h3>
                    <span className={`badge ${profile.isVerified ? 'badge-verified' : 'badge-pending'}`}>
                      {profile.isVerified ? '✓ Verified Student' : '⏳ Verification Pending'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn-edit"
                    onClick={() => {
                      setIsEditing(true);
                      setFormSuccess('');
                      setFormError('');
                    }}
                  >
                    Edit Profile
                  </button>
                </div>

                {formSuccess && <div className="alert alert-success">{formSuccess}</div>}

                <div className="profile-details-grid">
                  <div className="detail-item">
                    <span className="detail-label">Email</span>
                    <span className="detail-value">{profile.email}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Phone</span>
                    <span className="detail-value">{profile.phone || 'Not provided'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">College / University</span>
                    <span className="detail-value">{profile.college || 'Not provided'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Clerk Account ID</span>
                    <span className="detail-value mono">{profile.clerkId}</span>
                  </div>
                </div>

                <div className="account-controls">
                  <button
                    type="button"
                    className="btn-logout"
                    onClick={() => signOut()}
                  >
                    Logout
                  </button>
                </div>
              </div>
            ) : (
              // 5. Profile Form (if profile not completed or editing)
              <div className="profile-form-view">
                <div className="form-header">
                  <h3>{profile ? 'Update Student Profile' : 'Complete Your Student Profile'}</h3>
                  <p>
                    {profile
                      ? 'Update your details below to keep your campus profile fresh.'
                      : 'Please provide your basic details to get started with CampusPool rides.'}
                  </p>
                </div>

                {formSuccess && <div className="alert alert-success">{formSuccess}</div>}
                {formError && <div className="alert alert-error">{formError}</div>}

                <form onSubmit={handleSubmitProfile} className="student-form">
                  <div className="form-group">
                    <label htmlFor="name">Full Name *</label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      placeholder="e.g. Aarav Sharma"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="email">College Email *</label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="e.g. student@college.edu"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="phone">Phone Number</label>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder="e.g. +91 98765 43210"
                      value={formData.phone}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="college">College / University</label>
                    <input
                      id="college"
                      name="college"
                      type="text"
                      placeholder="e.g. Delhi Technological University"
                      value={formData.college}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-actions">
                    {profile && (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          setIsEditing(false);
                          setFormError('');
                        }}
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Saving Profile...' : 'Save Profile'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <hr className="divider" />

            {/* Test Backend Auth Section */}
            <div className="test-section">
              <h4>Backend Verification</h4>
              <p className="test-desc">
                Quick diagnostic test for <code>GET {backendUrl}/api/auth/me</code> with current Clerk session.
              </p>
              <button
                type="button"
                className="btn-test"
                onClick={handleTestBackend}
                disabled={isLoadingTest}
              >
                {isLoadingTest ? 'Testing...' : 'Test Backend Authentication'}
              </button>

              {apiStatus !== null && (
                <div className={`response-box ${apiStatus === 200 ? 'success' : 'error'}`}>
                  <div className="response-header">
                    <span className="status-badge">Status: {apiStatus}</span>
                    <span className="endpoint-tag">GET /api/auth/me</span>
                  </div>
                  <pre className="json-output">
                    {JSON.stringify(apiResponse, null, 2)}
                  </pre>
                </div>
              )}

              {testError && (
                <div className="response-box error">
                  <div className="response-header">
                    <span className="status-badge">Error</span>
                  </div>
                  <p className="error-text">{testError}</p>
                </div>
              )}
            </div>
          </div>
        </SignedIn>
      </main>
    </div>
  );
}

export default App;
