  import { configureStore } from '@reduxjs/toolkit';
  import { persistStore, persistReducer } from 'redux-persist';
  import storage from 'redux-persist/lib/storage';

  // Import reducers
  import authReducer from './authSlice';
  import companyReducer from './companySlice';
  import jobReducer from './jobSlice';
  import applicationReducer from './applicationSlice';
  import savedJobReducer from './savedJobSlice';
  import chatReducer from './chatSlice';

  // Configure persist for auth reducer
  const authPersistConfig = {
    key: 'auth',
    storage,
    whitelist: ['user', 'isAuthenticated', 'role'] // Only persist these fields
  };

  // Create the persisted auth reducer
  const persistedAuthReducer = persistReducer(authPersistConfig, authReducer);

  // Create store with persisted auth
  const store = configureStore({
    reducer: {
      auth: persistedAuthReducer,
      company: companyReducer,
      job: jobReducer,
      application: applicationReducer,
      savedJob: savedJobReducer,
      chat: chatReducer
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
        },
      }),
  });

  export const persistor = persistStore(store);
  export default store;