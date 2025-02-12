import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '../utils/axiosInstance';

// Utility function to extract error messages from API responses
const getErrorMessage = (error) =>
  error.response?.data?.message || error.message || 'An error occurred';

// Async Thunks

export const signUp = createAsyncThunk(
  'auth/signUp',
  async ({ email, password, username, role }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post('/signup', { email, password, username, role });
      return response.data; // { success, message, user }
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const verifyEmail = createAsyncThunk(
  'auth/verifyEmail',
  async ({ email, code }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post('/verify-email', { email, code });
      return response.data; // { success, message, user }
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post('/login', { email, password });
      return response.data; // { success, message, user }
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post('/logout');
      return response.data; // { success, message }
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const forgotPassword = createAsyncThunk(
  'auth/forgotPassword',
  async ({ email }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post('/forgot-password', { email });
      return response.data; // { success, message }
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const resetPassword = createAsyncThunk(
  'auth/resetPassword',
  async ({ token, password }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post(`/reset-password/${token}`, { password });
      return response.data; // { success, message }
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const checkAuth = createAsyncThunk(
  'auth/checkAuth',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/check-auth');
      return response.data; // { success, user }
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const refreshToken = createAsyncThunk(
  'auth/refreshToken',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post('/refresh-token');
      return response.data; // { success, message }
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

// Initial state for the auth slice
const initialState = {
  user: null,              // Stores user data if authenticated
  isAuthenticated: false,  // True if the user is logged in
  isLoading: false,        // True while an API request is pending
  isCheckingAuth: false,   // (Optional) True when verifying auth status on app load
  error: null,             // Error message from failed requests
  message: null,           // General messages (e.g., after logout, password reset, etc.)
};

// Create the auth slice
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Synchronous reducers to clear error or message when needed
    clearError: (state) => {
      state.error = null;
    },
    clearMessage: (state) => {
      state.message = null;
    },
    clearLoading: (state) => {
        state.isLoading = false;
    }
  },
  extraReducers: (builder) => {
    // Sign Up
    builder.addCase(signUp.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(signUp.fulfilled, (state, { payload }) => {
      state.isLoading = false;
      state.user = payload.user;
      state.isAuthenticated = true;
      state.message = payload.message;
    });
    builder.addCase(signUp.rejected, (state, { payload }) => {
      state.isLoading = false;
      state.error = payload;
    });

    // Verify Email
    builder.addCase(verifyEmail.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(verifyEmail.fulfilled, (state, { payload }) => {
      state.isLoading = false;
      state.user = payload.user;
      state.isAuthenticated = true;
      state.message = payload.message;
    });
    builder.addCase(verifyEmail.rejected, (state, { payload }) => {
      state.isLoading = false;
      state.error = payload;
    });

    // Login
    builder.addCase(login.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(login.fulfilled, (state, { payload }) => {
      state.isLoading = false;
      state.user = payload.user;
      state.isAuthenticated = true;
      state.message = payload.message;
    });
    builder.addCase(login.rejected, (state, { payload }) => {
      state.isLoading = false;
      state.error = payload;
    });

    // Logout
    builder.addCase(logout.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(logout.fulfilled, (state, { payload }) => {
      state.isLoading = false;
      state.user = null;
      state.isAuthenticated = false;
      state.message = payload.message;
    });
    builder.addCase(logout.rejected, (state, { payload }) => {
      state.isLoading = false;
      state.error = payload;
    });

    // Forgot Password
    builder.addCase(forgotPassword.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(forgotPassword.fulfilled, (state, { payload }) => {
      state.isLoading = false;
      state.message = payload.message;
    });
    builder.addCase(forgotPassword.rejected, (state, { payload }) => {
      state.isLoading = false;
      state.error = payload;
    });

    // Reset Password
    builder.addCase(resetPassword.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(resetPassword.fulfilled, (state, { payload }) => {
      state.isLoading = false;
      state.message = payload.message || payload;
    });
    builder.addCase(resetPassword.rejected, (state, { payload }) => {
      state.isLoading = false;
      state.error = payload;
    });

    // Check Auth
    builder.addCase(checkAuth.pending, (state) => {
      state.isLoading = true;
      state.error = null;
      state.isCheckingAuth = true;
    });
    builder.addCase(checkAuth.fulfilled, (state, { payload }) => {
      state.isLoading = false;
      state.user = payload.user;
      state.isAuthenticated = true;
      state.isCheckingAuth = false;
    });
    builder.addCase(checkAuth.rejected, (state, { payload }) => {
      state.isLoading = false;
      state.isCheckingAuth = false;
      state.error = payload;
    });

    // Refresh Token
    builder.addCase(refreshToken.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(refreshToken.fulfilled, (state, { payload }) => {
      state.isLoading = false;
      state.message = payload.message;
    });
    builder.addCase(refreshToken.rejected, (state, { payload }) => {
      state.isLoading = false;
      state.error = payload;
    });
  },
});

export const { clearError, clearMessage, clearLoading } = authSlice.actions;
export default authSlice.reducer;