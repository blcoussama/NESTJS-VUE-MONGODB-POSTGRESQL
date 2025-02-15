import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import companyReducer from './companySlice';
import jobReducer from './jobSlice';
import applicationReducer from './applicationSlice';
import savedJobReducer from './savedJobSlice';

const store = configureStore({
  reducer: {
    auth: authReducer, // Register the auth slice
    company: companyReducer,
    job: jobReducer,
    application: applicationReducer,
    savedJob: savedJobReducer
  },
});

export default store;