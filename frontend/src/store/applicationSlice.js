  // src/slices/applicationSlice.js
  import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
  import axiosInstance from '../utils/axiosInstance';

  // Candidate applies for a job
  export const applyJob = createAsyncThunk(
    'application/applyJob',
    async ({ jobId, applicationData }, thunkAPI) => {
      try {
        // Now the endpoint is correct: /api/application/apply/:jobId
        const response = await axiosInstance.post(`/application/apply/${jobId}`, applicationData);
        return response.data; // Expected: { success, message, application }
      } catch (error) {
        return thunkAPI.rejectWithValue(
          error.response?.data?.message || error.message
        );
      }
    }
  );

  // Recruiter gets all applications for a specific job
  export const getJobApplications = createAsyncThunk(
    'application/getJobApplications',
    async (jobId, thunkAPI) => {
      try {
        const response = await axiosInstance.get(`/application/job/${jobId}`);
        return response.data; // Expected: { success, applications }
      } catch (error) {
        return thunkAPI.rejectWithValue(
          error.response?.data?.message || error.message
        );
      }
    }
  );

  // Recruiter accepts an application
  export const acceptApplication = createAsyncThunk(
    'application/acceptApplication',
    async (applicationId, thunkAPI) => {
      try {
        const response = await axiosInstance.put(`/application/accept/${applicationId}`);
        return response.data; // Expected: { success, message, application }
      } catch (error) {
        return thunkAPI.rejectWithValue(
          error.response?.data?.message || error.message
        );
      }
    }
  );

  // Recruiter rejects an application
  export const rejectApplication = createAsyncThunk(
    'application/rejectApplication',
    async (applicationId, thunkAPI) => {
      try {
        const response = await axiosInstance.put(`/application/reject/${applicationId}`);
        return response.data; // Expected: { success, message, application }
      } catch (error) {
        return thunkAPI.rejectWithValue(
          error.response?.data?.message || error.message
        );
      }
    }
  );

  // Candidate gets all of their applications
  export const getCandidateApplications = createAsyncThunk(
    'application/getCandidateApplications',
    async (_, thunkAPI) => {
      try {
        const response = await axiosInstance.get('/application/my-applications');
        return response.data; // Expected: { success, applications }
      } catch (error) {
        return thunkAPI.rejectWithValue(
          error.response?.data?.message || error.message
        );
      }
    }
  );

  // Candidate withdraws an application
  export const withdrawApplication = createAsyncThunk(
    'application/withdrawApplication',
    async (applicationId, thunkAPI) => {
      try {
        const response = await axiosInstance.put(`/application/withdraw/${applicationId}`);
        return response.data; // Expected: { success, message, application }
      } catch (error) {
        return thunkAPI.rejectWithValue(
          error.response?.data?.message || error.message
        );
      }
    }
  );

  const initialState = {
    application: null,
    jobApplications: [],
    candidateApplications: [],
    loading: false,
    error: null,
    message: null,
  };

  const applicationSlice = createSlice({
    name: 'application',
    initialState,
    reducers: {
      clearApplication(state) {
        state.application = null;
        state.error = null;
        state.message = null;
      },
      clearJobApplications(state) {
        state.jobApplications = [];
        state.error = null;
        state.message = null;
      },
      clearCandidateApplications(state) {
        state.candidateApplications = [];
        state.error = null;
        state.message = null;
      },
    },
    extraReducers: (builder) => {
      builder
        // applyJob
        .addCase(applyJob.pending, (state) => {
          state.loading = true;
          state.error = null;
          state.message = null;
        })
        .addCase(applyJob.fulfilled, (state, action) => {
          state.loading = false;
          state.application = action.payload.application;
          state.message = action.payload.message;
        })
        .addCase(applyJob.rejected, (state, action) => {
          state.loading = false;
          state.error = action.payload;
        })
        // getJobApplications
        .addCase(getJobApplications.pending, (state) => {
          state.loading = true;
          state.error = null;
        })
        .addCase(getJobApplications.fulfilled, (state, action) => {
          state.loading = false;
          state.jobApplications = action.payload.applications;
        })
        .addCase(getJobApplications.rejected, (state, action) => {
          state.loading = false;
          state.error = action.payload;
        })
        // acceptApplication
        .addCase(acceptApplication.pending, (state) => {
          state.loading = true;
          state.error = null;
          state.message = null;
        })
        .addCase(acceptApplication.fulfilled, (state, action) => {
          state.loading = false;
          state.message = action.payload.message;
          state.application = action.payload.application;
        })
        .addCase(acceptApplication.rejected, (state, action) => {
          state.loading = false;
          state.error = action.payload;
        })
        // rejectApplication
        .addCase(rejectApplication.pending, (state) => {
          state.loading = true;
          state.error = null;
          state.message = null;
        })
        .addCase(rejectApplication.fulfilled, (state, action) => {
          state.loading = false;
          state.message = action.payload.message;
          state.application = action.payload.application;
        })
        .addCase(rejectApplication.rejected, (state, action) => {
          state.loading = false;
          state.error = action.payload;
        })
        // getCandidateApplications
        .addCase(getCandidateApplications.pending, (state) => {
          state.loading = true;
          state.error = null;
        })
        .addCase(getCandidateApplications.fulfilled, (state, action) => {
          state.loading = false;
          state.candidateApplications = action.payload.applications;
        })
        .addCase(getCandidateApplications.rejected, (state, action) => {
          state.loading = false;
          state.error = action.payload;
        })
        // withdrawApplication
        .addCase(withdrawApplication.pending, (state) => {
          state.loading = true;
          state.error = null;
          state.message = null;
        })
        .addCase(withdrawApplication.fulfilled, (state, action) => {
          state.loading = false;
          state.message = action.payload.message;
          state.application = action.payload.application;
        })
        .addCase(withdrawApplication.rejected, (state, action) => {
          state.loading = false;
          state.error = action.payload;
        });
    },
  });

  export const { clearApplication, clearJobApplications, clearCandidateApplications } = applicationSlice.actions;
  export default applicationSlice.reducer;
