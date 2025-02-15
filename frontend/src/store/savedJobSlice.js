import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '../utils/axiosInstance';

// Save a job
export const saveJob = createAsyncThunk(
  'savedJobs/saveJob',
  async (jobId, thunkAPI) => {
    try {
      const response = await axiosInstance.post(`/saved-job/save/${jobId}`);
      return response.data;
    } catch (error) {
      console.error('Save job error:', error.response?.data);
      if (error.response?.status === 400 && error.response.data.message.includes('already saved')) {
        // If job is already saved, get fresh saved jobs list
        await thunkAPI.dispatch(getSavedJobs());
      }
      throw error;
    }
  }
);

// Unsave a job
export const unsaveJob = createAsyncThunk(
  'savedJobs/unsaveJob',
  async (jobId, thunkAPI) => {
    try {
      const response = await axiosInstance.delete(`/saved-job/unsave/${jobId}`);
      return { ...response.data, jobId }; // Include jobId in the response
    } catch (error) {
      console.error('Unsave job error:', error.response?.data);
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || 'Failed to unsave job'
      );
    }
  }
);

// Get all saved jobs
export const getSavedJobs = createAsyncThunk(
  'savedJobs/getSavedJobs',
  async (_, thunkAPI) => {
    try {
      const response = await axiosInstance.get('/saved-job/all');
      return response.data;
    } catch (error) {
      console.error('Get saved jobs error:', error.response?.data);
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || 'Failed to get saved jobs'
      );
    }
  }
);

const savedJobSlice = createSlice({
  name: 'savedJobs',
  initialState: {
    savedJobs: [],
    loading: false,
    error: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Save Job
      .addCase(saveJob.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(saveJob.fulfilled, (state, action) => {
        state.loading = false;
        const savedJobId = action.payload.savedJob.job._id;
        if (!state.savedJobs.some(job => job.job._id === savedJobId)) {
            state.savedJobs.push(action.payload.savedJob);
        }
      })
      .addCase(saveJob.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Unsave Job
      .addCase(unsaveJob.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(unsaveJob.fulfilled, (state, action) => {
        state.loading = false;
        state.savedJobs = state.savedJobs.filter(
          (savedJob) => savedJob.job._id !== action.payload.jobId
        );
      })
      .addCase(unsaveJob.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Get Saved Jobs
      .addCase(getSavedJobs.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getSavedJobs.fulfilled, (state, action) => {
        state.loading = false;
        state.savedJobs = action.payload.savedJobs;
      })
      .addCase(getSavedJobs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError } = savedJobSlice.actions;
export default savedJobSlice.reducer;