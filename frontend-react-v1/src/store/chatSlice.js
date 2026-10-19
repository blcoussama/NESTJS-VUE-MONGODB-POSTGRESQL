// src/store/chatSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '../utils/axiosInstance';
import { emitMessage } from '../utils/SocketManager';

// Async thunk to fetch all users for the sidebar
export const fetchUsers = createAsyncThunk(
  'chat/fetchUsers',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/message/users');
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
      const response = await axiosInstance.get(`/message/${userToChatId}`);
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
      const formData = new FormData();
      if (text) formData.append('text', text);
      if (image) formData.append('image', image); // Ensure the key is "image"

      // Let axios set the correct Content-Type with boundary automatically
      const response = await axiosInstance.post(`/message/send/${receiverId}`, formData);
      
      // The server emits the socket notification
      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message
      );
    }
  }
);


// New thunk to mark messages as read
export const markMessagesAsRead = createAsyncThunk(
  'chat/markMessagesAsRead',
  async ({ senderId }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.put(`/message/read/${senderId}`);
      // Emit socket event to inform sender
      emitMessage('markMessagesAsRead', { senderId });
      return { senderId, ...response.data };
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
      const response = await axiosInstance.delete(`/message/delete/${messageId}`);
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
    },
    updateMessagesReadStatus(state, action) {
      const { receiverId, currentUserId } = action.payload;
      state.messages = state.messages.map(msg => {
        if (
          msg.senderId === currentUserId &&
          msg.receiverId === receiverId &&
          !msg.read
        ) {
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
        // Don't set loading=true here to avoid flickering
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.sending = false;
        const messageExists = state.messages.some(msg => msg._id === action.payload._id);
        if (!messageExists) {
          state.messages.push(action.payload);
        }
        // Trigger a re-fetch of the sidebar users
        state.userLoading = true; // Optional: Indicate loading state
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.sending = false;
        state.sendError = action.payload;
      })

      // Handle markMessagesAsRead lifecycle
      .addCase(markMessagesAsRead.pending, (state) => {
        state.loading = true;
      })
      .addCase(markMessagesAsRead.fulfilled, (state, action) => {
        state.loading = false;
        const { senderId } = action.payload;
        // Update the read status of messages from this sender
        state.messages = state.messages.map(msg => {
          if (msg.senderId === senderId && !msg.read) {
            return { ...msg, read: true };
          }
          return msg;
        })
      })
      .addCase(markMessagesAsRead.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
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
        )
      })
      .addCase(deleteMessage.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
  },
});

export const { 
  clearMessages, 
  addMessage, 
  removeMessage,
  updateMessage, 
  setSelectedUser,
  updateMessagesReadStatus
} = chatSlice.actions;

export default chatSlice.reducer;