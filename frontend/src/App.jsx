/* eslint-disable react/prop-types */
import { Routes, Route, Navigate } from 'react-router-dom';
import LoadingSpinner from './components/LoadingSpinner';
import SignUp from './pages/SignUp';
import Login from './pages/Login';
import EmailVerification from './pages/EmailVerification';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { checkAuth, refreshToken } from './store/authSlice';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import OnBoarding from './pages/OnBoarding';
import RecruiterProfileSetup from './pages/RecruiterProfileSetup';
import CandidateProfileSetup from './pages/CandidateProfileSetup';
import CompanyRegister from './pages/CompanyRegister';
import RecruiterCompanies from './pages/RecruiterCompanies';
import CompanyUpdate from './pages/CompanyUpdate';
import PostJob from './pages/PostJob';
import UpdateJob from './pages/JobUpdate';
import JobListing from './pages/JobListing';
import JobDetails from './pages/JobDetails';
import ApplyJob from './pages/ApplyJob';
import CompanyDetails from './pages/CompanyDetails';
import RecruiterJobs from './pages/RecruiterJobs';
import UserProfile from './pages/UserProfile';
import CandidateApplications from './pages/CandidateApplications';
import SelectCompanyForJob from './pages/SelectCompanyForJob';
import SavedJobs from './pages/SavedJobs';
import Chat from './pages/Chat';
import AppLayout from './layout/AppLayout';

// Protect routes that require authentication
const ProtectRoute = ({ children, allowedRoles }) => {
  const { isLoading, isAuthenticated, user } = useSelector((state) => state.auth);

  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user.isVerified) return <Navigate to="/verify-email" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;

  return children;
};

// Redirect authenticated users from auth pages
const RedirectAuthenticatedUsers = ({ children }) => {
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  if (isAuthenticated) {
    if (!user.role) return <Navigate to="/" replace />;

    // Check profile completion
    const isProfileComplete = user.profile?.firstName && user.profile?.lastName;

    if (!isProfileComplete) {
      return <Navigate to={
        user.role === 'recruiter' 
          ? '/recruiter-profile-update' 
          : '/candidate-profile-update'
      } replace />;
    }

    // Handle recruiter company requirement
    if (user.role === 'recruiter') {
      return user.profile?.companies?.length 
        ? <Navigate to="/recruiter-companies" replace /> 
        : <Navigate to="/company-register" replace />;
    }

    // Handle candidate redirect
    return <Navigate to="/jobs" replace />;
  }

  return children;
};

// Block access to verify-email if already verified
const RedirectFromVerifyEmail = ({ children }) => {
  const { isAuthenticated, user } = useSelector((state) => state.auth);
  
  if (isAuthenticated && user?.isVerified) {
    // Check profile completeness
    const isProfileComplete = user.profile?.firstName && user.profile?.lastName;
    
    if (!isProfileComplete) {
      return <Navigate to={
        user.role === 'recruiter' 
          ? '/recruiter-profile-update' 
          : '/candidate-profile-update'
      } replace />;
    }

    // Final redirect based on role
    return <Navigate to={
      user.role === 'recruiter' 
        ? (user.profile?.companies?.length ? '/recruiter-companies' : '/company-register')
        : '/jobs'
    } replace />;
  }
  return children;
};

function App() {
  const dispatch = useDispatch();
  const { isCheckingAuth } = useSelector((state) => state.auth);

  useEffect(() => {
    const checkAuthAndRefresh = async () => {
      try {
        await dispatch(checkAuth()).unwrap();
      } catch (error) {
        try {
          await dispatch(refreshToken()).unwrap();
          await dispatch(checkAuth()).unwrap();
        } catch (refreshError) {
          console.log(error);
          console.log("Authentication required", refreshError);
        }
      }
    };
    checkAuthAndRefresh();
  }, [dispatch]);

  if (isCheckingAuth) return <LoadingSpinner />;

  return (
          <AppLayout>
            <Routes>
              
              {/* Public routes */}
              <Route path="/" element={<RedirectAuthenticatedUsers><OnBoarding /></RedirectAuthenticatedUsers>} />
              <Route path="/signup" element={<RedirectAuthenticatedUsers><SignUp /></RedirectAuthenticatedUsers>} />
              <Route path="/login" element={<RedirectAuthenticatedUsers><Login /></RedirectAuthenticatedUsers>} />
              <Route path="/verify-email" element={<RedirectFromVerifyEmail><EmailVerification /></RedirectFromVerifyEmail>} />
              <Route path="/forgot-password" element={<RedirectAuthenticatedUsers><ForgotPassword /></RedirectAuthenticatedUsers>} />
              <Route path="/reset-password/:token" element={<RedirectAuthenticatedUsers><ResetPassword /></RedirectAuthenticatedUsers>} />

              {/* Protected common routes */}
              <Route path="/jobs" element={<ProtectRoute><JobListing /></ProtectRoute>} />
              <Route path="/jobs/:id" element={<ProtectRoute><JobDetails /></ProtectRoute>} />
              <Route path="/company/:id" element={<ProtectRoute><CompanyDetails /></ProtectRoute>} />
              <Route path="/saved-jobs" element={<ProtectRoute><SavedJobs /></ProtectRoute>} />
              <Route path="/profile/:id" element={<ProtectRoute><UserProfile /></ProtectRoute>} />

              {/* Recruiter-only routes */}
              <Route path="/recruiter-profile-update" element={<ProtectRoute allowedRoles={['recruiter']}><RecruiterProfileSetup /></ProtectRoute>} />
              <Route path="/company-register" element={<ProtectRoute allowedRoles={['recruiter']}><CompanyRegister /></ProtectRoute>} />
              <Route path="/update-company/:id" element={<ProtectRoute allowedRoles={['recruiter']}><CompanyUpdate /></ProtectRoute>} />
              <Route path="/recruiter-companies/:recruiterId?" element={<ProtectRoute allowedRoles={['recruiter']}><RecruiterCompanies /></ProtectRoute>} />
              <Route path="/select-company-for-job/:recruiterId" element={<ProtectRoute allowedRoles={['recruiter']}><SelectCompanyForJob /></ProtectRoute>} />
              <Route path="/post-job/:companyId" element={<ProtectRoute allowedRoles={['recruiter']}><PostJob /></ProtectRoute>} />
              <Route path="/update-job/:id/from/:companyId" element={<ProtectRoute allowedRoles={['recruiter']}><UpdateJob /></ProtectRoute>} />
              <Route path="/recruiter-jobs/:recruiterId?" element={<ProtectRoute allowedRoles={['recruiter']}><RecruiterJobs /></ProtectRoute>} />

              {/* Candidate-only routes */}
              <Route path="/candidate-profile-update" element={<ProtectRoute allowedRoles={['candidate']}><CandidateProfileSetup /></ProtectRoute>} />
              <Route path="/apply/:jobId" element={<ProtectRoute allowedRoles={['candidate']}><ApplyJob /></ProtectRoute>} />
              <Route path="/candidate/applications" element={<ProtectRoute allowedRoles={['candidate']}><CandidateApplications /></ProtectRoute>} />

              <Route path="/chat/:userToChatId" element={<ProtectRoute><Chat /></ProtectRoute>} />

              <Route path="*" element={<Navigate to="/" replace />} />

            </Routes>
          </AppLayout>
  );
}

export default App;
