import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import companyReducer from './companySlice';

const store = configureStore({
  reducer: {
    auth: authReducer, // Register the auth slice
    company: companyReducer,
  },
});

export default store;