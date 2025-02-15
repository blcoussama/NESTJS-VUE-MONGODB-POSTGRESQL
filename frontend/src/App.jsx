import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoadingSpinner from './components/LoadingSpinner';
import SignUp from './pages/SignUp';
import Login from './pages/Login';
import EmailVerification from './pages/EmailVerification';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { checkAuth, refreshToken } from './store/authSlice';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import RecruiterDashboard from './pages/RecruiterDashboard';
import CandidateDashboard from './pages/CandidateDashboard';
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

// Protect routes that require authentication
// const ProtectRoute = ({ children, allowedRoles }) => {
//   const { isLoading, isAuthenticated, user } = useSelector((state) => state.auth);

//   if (isLoading) {
//     return <LoadingSpinner />;
//   }

//   if (!isAuthenticated) {
//     return <Navigate to="/login" replace />;
//   }

//   if (!user.isVerified) {
//     return <Navigate to="/verify-email" replace />;
//   }

//   if (allowedRoles && !allowedRoles.includes(user.role)) {
//     return <Navigate to="/" replace />;
//   }

//   return children;
// };

// // Redirect authenticated users based on profile completeness and role
// const RedirectAuthenticatedUsers = ({ children }) => {
//   const { isAuthenticated, user } = useSelector((state) => state.auth);

//   if (isAuthenticated) {
//     if (!user.role) {
//       return <Navigate to="/" replace />;
//     }

//     const isProfileComplete =
//       user.profile && user.profile.firstName && user.profile.lastName;
    
//     if (!isProfileComplete) {
//       if (user.role === 'candidate') {
//         return <Navigate to="/candidate-profile-update" replace />;
//       } else if (user.role === 'recruiter') {
//         return <Navigate to="/recruiter-profile-update" replace />;
//       }
//     } else {
//       // Recruiter needs to register a company first
//       if (user.role === 'recruiter' && (!user.profile.companies || user.profile.companies.length === 0)) {
//         return <Navigate to="/company-register" replace />;
//       }
      
//       // Otherwise, redirect to the appropriate dashboard
//       if (user.role === 'candidate') {
//         return <Navigate to="/candidate-dashboard" replace />;
//       } else if (user.role === 'recruiter') {
//         return <Navigate to="/recruiter-companies" replace />;
//       }
//     }
//   }

//   return children;
// };

// New wrapper to block access to verify-email if the user is already verified
// const RedirectFromVerifyEmail = ({ children }) => {
//   const { isAuthenticated, user } = useSelector((state) => state.auth);

//   if (isAuthenticated && user.isVerified) {
//     if (user.role === 'recruiter') {
//       return <Navigate to="/recruiter-dashboard" replace />;
//     }
//     if (user.role === 'candidate') {
//       return <Navigate to="/candidate-dashboard" replace />;
//     }
//   }
//   return children;
// };

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
          console.log("Authentication required", refreshError);
        }
        console.log(error.message);
      }
    };
    checkAuthAndRefresh();
  }, [dispatch]);

  if (isCheckingAuth) return <LoadingSpinner />;

  return (
    <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
            //   <RedirectAuthenticatedUsers>
                <OnBoarding />
            //   </RedirectAuthenticatedUsers>
            }
          />
          <Route
            path="/signup"
            element={
            //   <RedirectAuthenticatedUsers>
                <SignUp />
            //   </RedirectAuthenticatedUsers>
            }
          />
          <Route
            path="/login"
            element={
            //   <RedirectAuthenticatedUsers>
                <Login />
            //   </RedirectAuthenticatedUsers>
            }
          />
          <Route
            path="/verify-email"
            element={
            //   <RedirectFromVerifyEmail>
                <EmailVerification />
            //   </RedirectFromVerifyEmail>
            }
          />
          <Route
            path="/forgot-password"
            element={
            //   <RedirectAuthenticatedUsers>
                <ForgotPassword />
            //   </RedirectAuthenticatedUsers>
            }
          />
          <Route
            path="/reset-password/:token"
            element={
            //   <RedirectAuthenticatedUsers>
                <ResetPassword />
            //   </RedirectAuthenticatedUsers>
            }
          />
          <Route
            path="/recruiter-dashboard"
            element={
            //   <ProtectRoute allowedRoles={['recruiter']}>
                <RecruiterDashboard />
            //   </ProtectRoute>
            }
          />
          <Route
            path="/candidate-dashboard"
            element={
            //   <ProtectRoute allowedRoles={['candidate']}>
                <CandidateDashboard />
            //   </ProtectRoute>
            }
          />
          <Route
            path="/recruiter-profile-update"
            element={
            //   <ProtectRoute allowedRoles={['recruiter']}>
                <RecruiterProfileSetup />
            //   </ProtectRoute>
            }
          />
          <Route
            path="/candidate-profile-update"
            element={
            //   <ProtectRoute allowedRoles={['candidate']}>
                <CandidateProfileSetup />
            //   </ProtectRoute>
            }
          />

          <Route path="/profile/:id" element={
              <UserProfile />
          } />

          <Route
            path="/company-register"
            element={
            //   <ProtectRoute allowedRoles={['recruiter']}>
                <CompanyRegister />
            //   </ProtectRoute>
            }
          />
          <Route
            path="/update-company/:id"
            element={
            //   <ProtectRoute allowedRoles={['recruiter']}>
                <CompanyUpdate />
            //   </ProtectRoute>
            }
          />

          <Route
            path="/recruiter-companies/:recruiterId"
            element={
            <RecruiterCompanies />
            }
          />

          <Route 
            path="/select-company-for-job/:recruiterId" 
            element={<SelectCompanyForJob />} 
          />

          <Route
            path="/post-job/:companyId"
            element={
                // <ProtectRoute allowedRoles={['recruiter']}>
                <PostJob />
                // </ProtectRoute>
            }
          />
          <Route
            path="/update-job/:id/from/:companyId"
            element={
                // <ProtectRoute allowedRoles={['recruiter']}>
                <UpdateJob />
                // </ProtectRoute>
            }
          />
          <Route
            path="/jobs"
            element={
                // <ProtectRoute allowedRoles={['recruiter']}>
                <JobListing />
                // </ProtectRoute>
            }
          />

          <Route 
            path="/saved-jobs" 
            element={
              <SavedJobs />
            } 
          />

          <Route
            path="/recruiter-jobs/:recruiterId"
            element={
                // <ProtectRoute allowedRoles={['recruiter']}>
                <RecruiterJobs />
                // </ProtectRoute>
            }
          />

          <Route
            path="/company/:id"
            element={
                // <ProtectRoute allowedRoles={['recruiter']}>
                <CompanyDetails />
                // </ProtectRoute>
            }
          />

          <Route
            path="/jobs/:id"
            element={
                // <ProtectRoute allowedRoles={['recruiter']}>
                <JobDetails />
                // </ProtectRoute>
            }
          />

          <Route
            path="/apply/:jobId"
            element={
                // <ProtectRoute allowedRoles={['recruiter']}>
                <ApplyJob />
                // </ProtectRoute>
            }
          />

          <Route
            path="/candidate/applications"
            element={
                // <ProtectRoute allowedRoles={['recruiter']}>
                <CandidateApplications />
                // </ProtectRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    </BrowserRouter>
  );
}

export default App;
