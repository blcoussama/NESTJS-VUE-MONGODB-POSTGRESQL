import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './layout/AppLayout';
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
      <AppLayout>
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
          <Route
            path="/company-register"
            element={
            //   <ProtectRoute allowedRoles={['recruiter']}>
                <CompanyRegister />
            //   </ProtectRoute>
            }
          />
          <Route
            path="/company-update/:id"
            element={
            //   <ProtectRoute allowedRoles={['recruiter']}>
                <CompanyUpdate />
            //   </ProtectRoute>
            }
          />

          <Route
            path="/recruiter-companies"
            element={
                // <ProtectRoute allowedRoles={['recruiter']}>
                <RecruiterCompanies />
                // </ProtectRoute>
            }
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

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}

export default App;
