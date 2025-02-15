import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '../utils/axiosInstance';

// Async thunk to register a new company
export const registerCompany = createAsyncThunk(
  'company/registerCompany',
  async (companyData, { rejectWithValue }) => {
    try {
      // companyData is expected to be a JSON object containing { name, description, website, location }
      const response = await axiosInstance.post('/company/register', companyData);
      return response.data; // Expected: { success, message, company }
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Registration failed'
      );
    }
  }
);

// Async thunk to update a company
export const updateCompany = createAsyncThunk(
  'company/updateCompany',
  async ({ id, companyData }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.put(`/company/update/${id}`, companyData);
      return response.data; // Expected: { success, message, company }
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Update failed'
      );
    }
  }
);

// Async thunk to delete a company
export const deleteCompany = createAsyncThunk(
  'company/deleteCompany',
  async (id, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.delete(`/company/delete/${id}`);
      return response.data; // Expected: { success, message }
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Delete failed'
      );
    }
  }
);

// Async thunk to get recruiter companies using the recruiterId passed in the URL
export const getRecruiterCompanies = createAsyncThunk(
  'company/getRecruiterCompanies',
  async (recruiterId, { rejectWithValue }) => {
    try {
      // Using the recruiterId parameter to build the URL
      const response = await axiosInstance.get(`/company/companies/${recruiterId}`);
      return response.data; // Expected: { success, count, companies }
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Fetching companies failed'
      );
    }
  }
);

// Async thunk to view a single company (by its id)
export const viewCompany = createAsyncThunk(
  'company/viewCompany',
  async (id, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(`/company/${id}`);
      return response.data; // Expected: { success, company }
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Viewing company failed'
      );
    }
  }
);

// Define the initial state
const initialState = {
  companies: [],      // List of companies for the recruiter
  currentCompany: null, // Details of a single company when needed
  isLoading: false,
  error: null,
  message: null,
};

// Create the slice
const companySlice = createSlice({
  name: 'company',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearMessage: (state) => {
      state.message = null;
    },
  },
  extraReducers: (builder) => {
    // Register Company
    builder
      .addCase(registerCompany.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(registerCompany.fulfilled, (state, { payload }) => {
        state.isLoading = false;
        state.message = payload.message;
        // Optionally, you could add the new company to the companies array:
        state.companies.push(payload.company);
      })
      .addCase(registerCompany.rejected, (state, { payload }) => {
        state.isLoading = false;
        state.error = payload;
      });

    // Update Company
    builder
      .addCase(updateCompany.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateCompany.fulfilled, (state, { payload }) => {
        state.isLoading = false;
        state.message = payload.message;
        // Optionally update the corresponding company in the companies array if needed
      })
      .addCase(updateCompany.rejected, (state, { payload }) => {
        state.isLoading = false;
        state.error = payload;
      });

    // Delete Company
    builder
      .addCase(deleteCompany.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteCompany.fulfilled, (state, { payload }) => {
        state.isLoading = false;
        state.message = payload.message;
        // Remove the company from the list if stored
        state.companies = state.companies.filter(company => company._id !== payload.company?._id);
      })
      .addCase(deleteCompany.rejected, (state, { payload }) => {
        state.isLoading = false;
        state.error = payload;
      });

    // Get Recruiter Companies
    builder
      .addCase(getRecruiterCompanies.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getRecruiterCompanies.fulfilled, (state, { payload }) => {
        state.isLoading = false;
        state.companies = payload.companies;
      })
      .addCase(getRecruiterCompanies.rejected, (state, { payload }) => {
        state.isLoading = false;
        state.error = payload;
      });

    // View Company
    builder
      .addCase(viewCompany.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(viewCompany.fulfilled, (state, { payload }) => {
        state.isLoading = false;
        state.currentCompany = payload.company;
      })
      .addCase(viewCompany.rejected, (state, { payload }) => {
        state.isLoading = false;
        state.error = payload;
      });
  },
});

export const { clearError, clearMessage } = companySlice.actions;
export default companySlice.reducer;
