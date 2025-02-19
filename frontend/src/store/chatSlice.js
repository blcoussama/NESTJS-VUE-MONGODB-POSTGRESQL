// src/store/chatSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '../utils/axiosInstance';

// Async thunk to fetch all users for the sidebar
export const fetchUsers = createAsyncThunk(
  'chat/fetchUsers',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/api/message/users');
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message
      );
    }
  }
);

// Async thunk to fetch messages between the logged-in user and another user
export const fetchMessages = createAsyncThunk(
  'chat/fetchMessages',
  async ({ userToChatId }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(`/api/message/${userToChatId}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message
      );
    }
  }
);

// Async thunk to send a message
export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async ({ receiverId, text, image }, { rejectWithValue }) => {
    try {
      // Create a FormData instance to support file uploads (if an image is provided)
      const formData = new FormData();
      if (text) formData.append('text', text);
      if (image) formData.append('image', image);
      
      const response = await axiosInstance.post(`/api/message/send/${receiverId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      // The socket notification is handled by the server side
      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message
      );
    }
  }
);

// Async thunk to delete a message
export const deleteMessage = createAsyncThunk(
  'chat/deleteMessage',
  async (messageId, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.delete(`/api/message/delete/${messageId}`);
      // Server will emit socket event for real-time updates
      return { messageId, ...response.data };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message
      );
    }
  }
);

const chatSlice = createSlice({
  name: 'chat',
  initialState: {
    messages: [],
    users: [],
    selectedUser: null,
    loading: false,
    userLoading: false,
    error: null,
    sending: false,
    sendError: null,
  },
  reducers: {
    clearMessages(state) {
      state.messages = [];
    },
    addMessage(state, action) {
      const newMessage = action.payload;
      // Only add the message if it's related to the selected user
      if (
        state.selectedUser && 
        (newMessage.senderId === state.selectedUser._id || 
        newMessage.receiverId === state.selectedUser._id)
      ) {
        // Prevent duplicate messages
        const messageExists = state.messages.some(msg => msg._id === newMessage._id);
        if (!messageExists) {
          state.messages.push(newMessage);
        }
      }
    },
    removeMessage(state, action) {
      const messageId = action.payload;
      state.messages = state.messages.filter(msg => msg._id !== messageId);
    },
    updateMessage(state, action) {
      const index = state.messages.findIndex(
        (msg) => msg._id === action.payload._id
      );
      if (index !== -1) {
        state.messages[index] = action.payload;
      }
    },
    setSelectedUser(state, action) {
      state.selectedUser = action.payload;
    },
    markMessagesAsRead(state, action) {
      const { userId } = action.payload;
      state.messages = state.messages.map(msg => {
        if (msg.senderId === userId && !msg.read) {
          return { ...msg, read: true };
        }
        return msg;
      });
    }
  },
  extraReducers: (builder) => {
    // Handle fetchUsers lifecycle
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.userLoading = true;
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.userLoading = false;
        state.users = action.payload;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.userLoading = false;
        state.error = action.payload;
      })
      
      // Handle fetchMessages lifecycle
      .addCase(fetchMessages.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        state.loading = false;
        state.messages = action.payload;
      })
      .addCase(fetchMessages.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Handle sendMessage lifecycle
      .addCase(sendMessage.pending, (state) => {
        state.sending = true;
        state.sendError = null;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.sending = false;
        state.messages.push(action.payload);
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.sending = false;
        state.sendError = action.payload;
      })
      
      // Handle deleteMessage lifecycle
      .addCase(deleteMessage.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteMessage.fulfilled, (state, action) => {
        state.loading = false;
        state.messages = state.messages.filter(
          (msg) => msg._id !== action.payload.messageId
        );
      })
      .addCase(deleteMessage.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { 
  clearMessages, 
  addMessage, 
  removeMessage,
  updateMessage, 
  setSelectedUser,
  markMessagesAsRead
} = chatSlice.actions;

export default chatSlice.reducer;