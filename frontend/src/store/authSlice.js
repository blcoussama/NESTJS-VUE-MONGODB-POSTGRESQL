import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '../utils/axiosInstance';

// Utility to handle errors from the backend
const getErrorMessage = (error) => error.response?.data?.message || error.message;

// Async Thunks

export const signUp = createAsyncThunk(
  'auth/signUp',
  async ({ email, password, username, role }, { rejectWithValue }) => {
    try {
      // Using a relative URL since axiosInstance has baseURL configured
      const response = await axiosInstance.post('/auth/signup', { email, password, username, role });
      return response.data; // Return user data from backend
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const verifyEmail = createAsyncThunk(
  'auth/verifyEmail',
  async ({ code }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post('/auth/verify-email', { code });
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const refreshToken = createAsyncThunk(
  'auth/refreshToken',
  async (_, { rejectWithValue }) => {
    try {
      // Relative URL works fine here as well
      const response = await axiosInstance.post('/auth/refresh-token');
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const checkAuth = createAsyncThunk(
  'auth/checkAuth',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/auth/check-auth');
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post('/auth/login', { email, password });
      return response.data; // Return user data from backend
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await axiosInstance.post('/auth/logout');
      return { success: true, message: 'Logged out successfully.' };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const forgotPassword = createAsyncThunk(
  'auth/forgotPassword',
  async ({ email }, { rejectWithValue }) => {
    try {
      await axiosInstance.post('/auth/forgot-password', { email });
      return { success: true, message: 'Reset password link has been sent to your email.' };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const resetPassword = createAsyncThunk(
  'auth/resetPassword',
  async ({ token, password }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post(`/auth/reset-password/${token}`, { password });
      return response.data.message;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

// Auth Slice

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    role: null,
    isAuthenticated: false,
    error: null,
    isLoading: false,
    isCheckingAuth: false,
    message: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null; // Reset the error state
    },
    clearLoading: (state) => {
      state.isLoading = false; // Reset loading state
    },
  },
  extraReducers: (builder) => {
    // SIGN UP
    builder
      .addCase(signUp.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(signUp.fulfilled, (state, { payload }) => {
        state.isLoading = false;
        state.user = payload.user;
        state.role = payload.user.role; // Store role
        state.isAuthenticated = true;
      })
      .addCase(signUp.rejected, (state, { payload }) => {
        state.isLoading = false;
        state.error = payload;
      })
      // VERIFY EMAIL
      .addCase(verifyEmail.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(verifyEmail.fulfilled, (state, { payload }) => {
        state.isLoading = false;
        state.user = payload.user;
        state.isAuthenticated = true;
      })
      .addCase(verifyEmail.rejected, (state, { payload }) => {
        state.isLoading = false;
        state.error = payload;
      })
      // CHECK AUTH
      .addCase(checkAuth.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.isCheckingAuth = true;
      })
      .addCase(checkAuth.fulfilled, (state, { payload }) => {
        state.isLoading = false;
        state.user = payload.user;
        state.role = payload.user.role;
        state.isAuthenticated = true;
        state.isCheckingAuth = false;
      })
      .addCase(checkAuth.rejected, (state) => {
        state.isLoading = false;
        state.isCheckingAuth = false;
      })
      // LOGIN
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, { payload }) => {
        state.isLoading = false;
        state.user = payload.user;
        state.role = payload.user.role;
        state.isAuthenticated = true;
      })
      .addCase(login.rejected, (state, { payload }) => {
        state.isLoading = false;
        state.error = payload;
      })
      // LOGOUT
      .addCase(logout.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(logout.fulfilled, (state, { payload }) => {
        state.isLoading = false;
        state.user = null;
        state.role = null;
        state.isAuthenticated = false;
        state.message = payload.message;
      })
      .addCase(logout.rejected, (state, { payload }) => {
        state.isLoading = false;
        state.error = payload;
      })
      // FORGOT PASSWORD
      .addCase(forgotPassword.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(forgotPassword.fulfilled, (state, { payload }) => {
        state.isLoading = false;
        state.message = payload.message;
      })
      .addCase(forgotPassword.rejected, (state, { payload }) => {
        state.isLoading = false;
        state.error = payload;
      })
      // RESET PASSWORD
      .addCase(resetPassword.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(resetPassword.fulfilled, (state, { payload }) => {
        state.isLoading = false;
        state.message = payload;
      })
      .addCase(resetPassword.rejected, (state, { payload }) => {
        state.isLoading = false;
        state.error = payload;
      });
  },
});

export const { clearError, clearLoading } = authSlice.actions;
export default authSlice.reducer;
