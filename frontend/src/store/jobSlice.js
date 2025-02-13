// src/slices/jobslice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '../utils/axiosInstance';

// Post a new job (POST /jobs/post/:id)
export const postJob = createAsyncThunk(
  'jobs/postJob',
  async ({ companyId, jobData }, thunkAPI) => {
    try {
      const response = await axiosInstance.post(`/job/post/${companyId}`, jobData);
      return response.data; // Expected: { success, message, job }
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || error.message
      );
    }
  }
);

// Update an existing job (PUT /jobs/update/:id/from/:companyId)
export const updateJob = createAsyncThunk(
  'jobs/updateJob',
  async ({ jobId, companyId, jobData }, thunkAPI) => {
    try {
      const response = await axiosInstance.put(`/job/update/${jobId}/from/${companyId}`, jobData);
      return response.data; // Expected: { success, message, job }
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || error.message
      );
    }
  }
);

// Delete a job (DELETE /jobs/delete/:id)
export const deleteJob = createAsyncThunk(
  'jobs/deleteJob',
  async (jobId, thunkAPI) => {
    try {
      const response = await axiosInstance.delete(`/job/delete/${jobId}`);
      return response.data; // Expected: { success, message }
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || error.message
      );
    }
  }
);

// Get jobs posted by a recruiter (GET /jobs/posted-jobs/:recruiterId)
export const getJobsByRecruiter = createAsyncThunk(
  'jobs/getJobsByRecruiter',
  async (recruiterId, thunkAPI) => {
    try {
      const response = await axiosInstance.get(`/job/posted-jobs/${recruiterId}`);
      return response.data; // Expected: { success, jobs }
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || error.message
      );
    }
  }
);

// Get all jobs with optional filtering/pagination (GET /jobs/all)
export const getAllJobs = createAsyncThunk(
  'jobs/getAllJobs',
  async (queryParams, thunkAPI) => {
    try {
      const queryString = new URLSearchParams(queryParams).toString();
      const response = await axiosInstance.get(`/job/all?${queryString}`);
      return response.data; // Expected: { success, jobs, totalPages, currentPage }
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || error.message
      );
    }
  }
);

// View a single job (GET /jobs/:id)
export const viewJob = createAsyncThunk(
  'jobs/viewJob',
  async (jobId, thunkAPI) => {
    try {
      const response = await axiosInstance.get(`/job/${jobId}`);
      return response.data; // Expected: { success, job }
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || error.message
      );
    }
  }
);

// Get jobs by company (GET /jobs/company-jobs/:companyId)
export const getJobsByCompany = createAsyncThunk(
  'jobs/getJobsByCompany',
  async (companyId, thunkAPI) => {
    try {
      const response = await axiosInstance.get(`/job/company-jobs/${companyId}`);
      return response.data; // Expected: { success, jobs }
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || error.message
      );
    }
  }
);

// Initial state for the jobs slice
const initialState = {
  job: null,
  jobs: [],
  loading: false,
  error: null,
  totalPages: 0,
  currentPage: 1,
};

const jobSlice = createSlice({
  name: 'jobs',
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
    clearJob(state) {
      state.job = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // postJob
      .addCase(postJob.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(postJob.fulfilled, (state, action) => {
        state.loading = false;
        state.job = action.payload.job;
      })
      .addCase(postJob.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // updateJob
      .addCase(updateJob.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateJob.fulfilled, (state, action) => {
        state.loading = false;
        state.job = action.payload.job;
      })
      .addCase(updateJob.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // deleteJob
      .addCase(deleteJob.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteJob.fulfilled, (state) => {
        state.loading = false;
        state.job = null;
      })
      .addCase(deleteJob.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // getJobsByRecruiter
      .addCase(getJobsByRecruiter.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getJobsByRecruiter.fulfilled, (state, action) => {
        state.loading = false;
        state.jobs = action.payload.jobs;
      })
      .addCase(getJobsByRecruiter.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // getAllJobs
      .addCase(getAllJobs.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getAllJobs.fulfilled, (state, action) => {
        state.loading = false;
        state.jobs = action.payload.jobs;
        state.totalPages = action.payload.totalPages;
        state.currentPage = action.payload.currentPage;
      })
      .addCase(getAllJobs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // viewJob
      .addCase(viewJob.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(viewJob.fulfilled, (state, action) => {
        state.loading = false;
        state.job = action.payload.job;
      })
      .addCase(viewJob.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // getJobsByCompany
      .addCase(getJobsByCompany.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getJobsByCompany.fulfilled, (state, action) => {
        state.loading = false;
        state.jobs = action.payload.jobs;
      })
      .addCase(getJobsByCompany.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, clearJob } = jobSlice.actions;
export default jobSlice.reducer;
