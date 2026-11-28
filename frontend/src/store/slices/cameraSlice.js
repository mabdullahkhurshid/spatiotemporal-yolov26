import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const fetchCameras = createAsyncThunk('cameras/fetchCameras', async (params, { rejectWithValue }) => {
  try {
    const response = await api.get('/cameras', { params });
    return response.data.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to fetch cameras');
  }
});

export const fetchCameraUsage = createAsyncThunk('cameras/fetchUsage', async (_, { rejectWithValue }) => {
  try {
    const response = await api.get('/cameras/usage');
    return response.data.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to fetch camera usage');
  }
});

export const createCamera = createAsyncThunk('cameras/create', async (data, { rejectWithValue }) => {
  try {
    const response = await api.post('/cameras', data);
    return response.data.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to create camera');
  }
});

export const updateCamera = createAsyncThunk('cameras/update', async ({ id, data }, { rejectWithValue }) => {
  try {
    const response = await api.put(`/cameras/${id}`, data);
    return response.data.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to update camera');
  }
});

export const deleteCamera = createAsyncThunk('cameras/delete', async (id, { rejectWithValue }) => {
  try {
    await api.delete(`/cameras/${id}`);
    return id;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to delete camera');
  }
});

export const restoreCamera = createAsyncThunk('cameras/restore', async (id, { rejectWithValue }) => {
  try {
    const response = await api.put(`/cameras/${id}/restore`);
    return response.data.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to restore camera');
  }
});

export const permanentDeleteCamera = createAsyncThunk(
  'cameras/permanentDelete',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/cameras/${id}/permanent`);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to permanently delete camera');
    }
  }
);

const cameraSlice = createSlice({
  name: 'cameras',
  initialState: {
    cameras: [],
    loading: false,
    error: null,
    usage: {
      used: 0,
      maxCameras: 0,
      canAddMore: false,
      loading: false,
      error: null,
    },
    liveDetectionById: {},
  },
  reducers: {
    setLiveDetection: (state, action) => {
      const { cameraId, detections, metrics, timestamp } = action.payload;
      if (!cameraId) return;
      state.liveDetectionById[String(cameraId)] = {
        detections: detections || [],
        metrics: metrics || {},
        timestamp: timestamp || new Date().toISOString(),
      };
      const cam = state.cameras.find((c) => String(c._id) === String(cameraId));
      if (cam) {
        cam.inference = {
          ...(cam.inference || {}),
          fireConfidence: metrics?.fireConfidence,
          smokeConfidence: metrics?.smokeConfidence,
          detectionFrequencyPerMin: metrics?.detectionFrequencyPerMin,
          estimatedSpreadRate: metrics?.estimatedSpreadRate,
          boxes: detections,
        };
      }
    },
    // A camera changed outside the update thunk (e.g. ONVIF stream refreshed from the device).
    cameraReplaced: (state, action) => {
      const index = state.cameras.findIndex((c) => c._id === action.payload._id);
      if (index !== -1) {
        state.cameras[index] = action.payload;
      }
    },
    updateCameraStatus: (state, action) => {
      const { cameraId, status, ...rest } = action.payload;
      const targetId = cameraId != null ? String(cameraId) : '';
      const camera = state.cameras.find((c) => String(c._id) === targetId);
      if (camera) {
        camera.status = status;
        // Only fields the event carries (a pause event has no lastActivity, a heartbeat no pausedUntil).
        ['lastActivity', 'lastHeartbeat', 'pausedUntil'].forEach((key) => {
          if (key in rest) camera[key] = rest[key];
        });
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCameras.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchCameras.fulfilled, (state, action) => {
        state.loading = false;
        state.cameras = action.payload;
      })
      .addCase(fetchCameras.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(createCamera.fulfilled, (state, action) => {
        state.cameras.push(action.payload);
        state.usage.used += 1;
        if (state.usage.maxCameras > 0) {
          state.usage.canAddMore = state.usage.used < state.usage.maxCameras;
        }
      })
      .addCase(updateCamera.fulfilled, (state, action) => {
        const index = state.cameras.findIndex((c) => c._id === action.payload._id);
        if (index !== -1) {
          state.cameras[index] = action.payload;
        }
      })
      .addCase(deleteCamera.fulfilled, (state, action) => {
        state.cameras = state.cameras.filter((c) => c._id !== action.payload);
        state.usage.used = Math.max(0, state.usage.used - 1);
        if (state.usage.maxCameras > 0) {
          state.usage.canAddMore = state.usage.used < state.usage.maxCameras;
        }
      })
      .addCase(restoreCamera.fulfilled, (state, action) => {
        state.cameras.push(action.payload);
        state.usage.used += 1;
        if (state.usage.maxCameras > 0) {
          state.usage.canAddMore = state.usage.used < state.usage.maxCameras;
        }
      })
      .addCase(permanentDeleteCamera.fulfilled, (state, action) => {
        state.cameras = state.cameras.filter((c) => c._id !== action.payload);
      })
      .addCase(fetchCameraUsage.pending, (state) => {
        state.usage.loading = true;
        state.usage.error = null;
      })
      .addCase(fetchCameraUsage.fulfilled, (state, action) => {
        state.usage.loading = false;
        state.usage.used = action.payload.used;
        state.usage.maxCameras = action.payload.maxCameras;
        state.usage.canAddMore = action.payload.canAddMore;
      })
      .addCase(fetchCameraUsage.rejected, (state, action) => {
        state.usage.loading = false;
        state.usage.error = action.payload;
      });
  },
});

export const { updateCameraStatus, setLiveDetection, cameraReplaced } = cameraSlice.actions;
export default cameraSlice.reducer;
