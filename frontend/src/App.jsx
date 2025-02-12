import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './layout/AppLayout';
import LoadingSpinner from './components/LoadingSpinner';
import SignUp from './pages/SignUp';
import Login from './pages/Login';
import EmailVerification from './pages/EmailVerification';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux'; // Redux hooks
import { checkAuth, refreshToken } from './store/authSlice'; // Redux thunk
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AdminDashboard from './pages/AdminDashboard';
import ClientDashboard from './pages/ClientDashboard';
import OnBoarding from './pages/OnBoarding';

// PROTECT Routes that require authentication
const ProtectRoute = ({ children, allowedRoles }) => {
    const { isLoading, isAuthenticated, user } = useSelector((state) => state.auth);

    if (isLoading) {
        return <LoadingSpinner />;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (!user.isVerified) {
        return <Navigate to="/verify-email" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return <Navigate to="/" replace />;
    }

    return children;
};

// Redirect Authenticated Users to Their Dashboards or Role Selection
const RedirectAuthenticatedUsers = ({ children }) => {
    const { isAuthenticated, user } = useSelector((state) => state.auth);

    if (isAuthenticated) {
        if (!user.role) {
            return <Navigate to="/" replace />; // Redirect to role selection
        }
        if (user.isVerified) {
            switch (user.role) {
                case 'recruiter':
                    return <Navigate to="/admin-dashboard" replace />;
                case 'candidate':
                    return <Navigate to="/client-dashboard" replace />;
                default:
                    return <Navigate to="/" replace />;
            }
        }
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
            // Attempt token refresh if checkAuth fails
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
                    <Route path="/" 
                        element={
                            <RedirectAuthenticatedUsers>
                                <OnBoarding />
                            </RedirectAuthenticatedUsers>
                        } 
                    />

                    <Route
                        path="/signup"
                        element={
                            <RedirectAuthenticatedUsers>
                                <SignUp />
                            </RedirectAuthenticatedUsers>
                        }
                    />

                    <Route
                        path="/login"
                        element={
                            <RedirectAuthenticatedUsers>
                                <Login />
                            </RedirectAuthenticatedUsers>
                        }
                    />

                    <Route
                        path="/verify-email"
                        element={
                            <RedirectAuthenticatedUsers>
                                <EmailVerification />
                            </RedirectAuthenticatedUsers>
                        }
                    />

                    <Route
                        path="/forgot-password"
                        element={
                            <RedirectAuthenticatedUsers>
                                <ForgotPassword />
                            </RedirectAuthenticatedUsers>
                        }
                    />

                    <Route
                        path="/reset-password/:token"
                        element={
                            <RedirectAuthenticatedUsers>
                                <ResetPassword />
                            </RedirectAuthenticatedUsers>
                        }
                    />

                    <Route
                        path="/admin-dashboard"
                        element={
                            <ProtectRoute allowedRoles={['recruiter']}>
                                <AdminDashboard />
                            </ProtectRoute>
                        }
                    />

                    <Route
                        path="/client-dashboard"
                        element={
                            <ProtectRoute allowedRoles={['candidate']}>
                                <ClientDashboard />
                            </ProtectRoute>
                        }
                    />

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </AppLayout>
        </BrowserRouter>
    );
}

export default App;
