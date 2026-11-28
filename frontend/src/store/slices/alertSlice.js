import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const fetchAlerts = createAsyncThunk('alerts/fetchAlerts', async (params, { rejectWithValue }) => {
  try {
    const response = await api.get('/alerts', { params });
    return response.data.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to fetch alerts');
  }
});

export const fetchAlertStats = createAsyncThunk('alerts/fetchStats', async (params, { rejectWithValue }) => {
  try {
    const response = await api.get('/alerts/stats', { params });
    return response.data.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to fetch stats');
  }
});

export const resolveAlert = createAsyncThunk('alerts/resolve', async ({ id, note, resolutionType }, { rejectWithValue }) => {
  try {
    const response = await api.put(`/alerts/${id}/resolve`, { note, resolutionType });
    return response.data.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to resolve alert');
  }
});

export const markFalseAlarm = createAsyncThunk('alerts/falseAlarm', async ({ id, note, cause }, { rejectWithValue }) => {
  try {
    const response = await api.put(`/alerts/${id}/false-alarm`, { note, cause });
    return response.data.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to mark false alarm');
  }
});

export const acknowledgeAlert = createAsyncThunk(
  'alerts/acknowledge',
  async ({ id, note }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/alerts/${id}/acknowledge`, { note });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to acknowledge alert');
    }
  }
);

// Lifecycle endpoints return the alert without populated camera/organization; keep the populated copies.
const mergeAlert = (current, next) => ({
  ...current,
  ...next,
  cameraId: typeof next.cameraId === 'object' && next.cameraId ? next.cameraId : current?.cameraId ?? next.cameraId,
  organizationId:
    typeof next.organizationId === 'object' && next.organizationId ? next.organizationId : current?.organizationId ?? next.organizationId,
});

const applyLifecycle = (state, action) => {
  const index = state.alerts.findIndex((a) => a._id === action.payload._id);
  if (index !== -1) {
    state.alerts[index] = mergeAlert(state.alerts[index], action.payload);
  }
  state.activeAlerts = state.activeAlerts.filter((a) => a._id !== action.payload._id || action.payload.status === 'active');
};

const alertSlice = createSlice({
  name: 'alerts',
  initialState: {
    alerts: [],
    stats: null,
    activeAlerts: [],
    loading: false,
    error: null,
  },
  reducers: {
    addAlert: (state, action) => {
      state.alerts.unshift(action.payload);
      if (action.payload.status === 'active') {
        state.activeAlerts.unshift(action.payload);
      }
    },
    updateAlert: (state, action) => {
      const index = state.alerts.findIndex((a) => a._id === action.payload._id);
      if (index !== -1) {
        state.alerts[index] = {
          ...state.alerts[index],
          ...action.payload,
        };
      }
      const activeIndex = state.activeAlerts.findIndex((a) => a._id === action.payload._id);
      if (activeIndex !== -1) {
        if (action.payload.status !== 'active') {
          state.activeAlerts.splice(activeIndex, 1);
        } else {
          state.activeAlerts[activeIndex] = {
            ...state.activeAlerts[activeIndex],
            ...action.payload,
          };
        }
      }
    },
    clearActiveAlerts: (state) => {
      state.activeAlerts = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAlerts.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchAlerts.fulfilled, (state, action) => {
        state.loading = false;
        state.alerts = action.payload;
        state.activeAlerts = action.payload.filter((a) => a.status === 'active');
      })
      .addCase(fetchAlerts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchAlertStats.fulfilled, (state, action) => {
        state.stats = action.payload;
      })
      .addCase(resolveAlert.fulfilled, applyLifecycle)
      .addCase(markFalseAlarm.fulfilled, applyLifecycle)
      .addCase(acknowledgeAlert.fulfilled, applyLifecycle);
  },
});

export const { addAlert, updateAlert, clearActiveAlerts } = alertSlice.actions;
export default alertSlice.reducer;
