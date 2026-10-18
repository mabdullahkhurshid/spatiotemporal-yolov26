import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api, { refreshAccessToken } from '../../services/api';
import { setAccessToken, clearAccessToken } from '../../services/tokenStore';

const readCachedUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user')) || null;
  } catch {
    return null;
  }
};

// Async thunks
export const login = createAsyncThunk('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    const response = await api.post('/auth/login', credentials);
    // Access token in memory; the refresh token arrives as an httpOnly cookie.
    setAccessToken(response.data.accessToken);
    localStorage.setItem('user', JSON.stringify(response.data.user));
    return response.data;
  } catch (error) {
    return rejectWithValue({
      message: error.response?.data?.message || 'Login failed',
      code: error.response?.data?.code,
    });
  }
});

// On page load: exchange the refresh cookie for an access token, then load the profile.
export const restoreSession = createAsyncThunk('auth/restoreSession', async (_, { rejectWithValue }) => {
  try {
    await refreshAccessToken();
    const response = await api.get('/auth/me');
    localStorage.setItem('user', JSON.stringify(response.data.data));
    return response.data.data;
  } catch (error) {
    clearAccessToken();
    localStorage.removeItem('user');
    return rejectWithValue(error.response?.data?.message || 'Session expired');
  }
});

export const resendVerificationCode = createAsyncThunk(
  'auth/resendVerification',
  async ({ email }, { rejectWithValue }) => {
    try {
      const response = await api.post('/auth/resend-verification', { email });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Could not send a new code');
    }
  }
);

export const logoutAllDevices = createAsyncThunk('auth/logoutAll', async (_, { rejectWithValue }) => {
  try {
    await api.post('/auth/logout-all');
    clearAccessToken();
    localStorage.removeItem('user');
    return null;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Could not sign out other devices');
  }
});

export const register = createAsyncThunk('auth/register', async (userData, { rejectWithValue }) => {
  try {
    const response = await api.post('/auth/register', userData);
    return response.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Registration failed');
  }
});

export const verifyEmail = createAsyncThunk('auth/verifyEmail', async (data, { rejectWithValue }) => {
  try {
    const response = await api.post('/auth/verify-email', data);
    return response.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Verification failed');
  }
});

export const getMe = createAsyncThunk('auth/getMe', async (_, { rejectWithValue }) => {
  try {
    const response = await api.get('/auth/me');
    return response.data.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to get user');
  }
});

export const setPassword = createAsyncThunk(
  'auth/setPassword',
  async ({ password }, { rejectWithValue }) => {
    try {
      const response = await api.post('/auth/set-password', { password });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to set password');
    }
  }
);

// Signs out this device only (other devices keep their sessions).
export const logout = createAsyncThunk('auth/logout', async () => {
  try {
    await api.post('/auth/logout');
  } catch {
    // Clear local state even if the server is unreachable.
  }
  clearAccessToken();
  localStorage.removeItem('user');
  return null;
});

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    // Cached profile for instant UI; authenticated only after restoreSession succeeds.
    user: readCachedUser(),
    isAuthenticated: false,
    loading: false,
    error: null,
  },
  reducers: {
    setUser: (state, action) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.isAuthenticated = true;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || action.payload;
      })
      // Restore session (page load)
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(restoreSession.rejected, (state) => {
        state.user = null;
        state.isAuthenticated = false;
      })
      .addCase(logoutAllDevices.fulfilled, (state) => {
        state.user = null;
        state.isAuthenticated = false;
      })
      // Register
      .addCase(register.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(register.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Get Me
      .addCase(getMe.fulfilled, (state, action) => {
        state.user = action.payload;
        state.isAuthenticated = true;
        localStorage.setItem('user', JSON.stringify(action.payload));
      })
      // Set Password
      .addCase(setPassword.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(setPassword.fulfilled, (state) => {
        state.loading = false;
        if (state.user) {
          state.user = { ...state.user, needsPasswordSetup: false };
          localStorage.setItem('user', JSON.stringify(state.user));
        }
      })
      .addCase(setPassword.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Logout
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.isAuthenticated = false;
      });
  },
});

export const { setUser, clearError } = authSlice.actions;
export default authSlice.reducer;
