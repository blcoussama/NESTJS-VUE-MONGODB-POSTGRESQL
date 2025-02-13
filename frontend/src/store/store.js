import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import companyReducer from './companySlice';
import jobReducer from './jobSlice';

const store = configureStore({
  reducer: {
    auth: authReducer, // Register the auth slice
    company: companyReducer,
    job: jobReducer,
  },
});

export default store;