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

const cameraSlice = createSlice({
  name: 'cameras',
  initialState: {
    cameras: [],
    loading: false,
    error: null,
  },
  reducers: {
    updateCameraStatus: (state, action) => {
      const { cameraId, status, lastActivity } = action.payload;
      const camera = state.cameras.find((c) => c._id === cameraId);
      if (camera) {
        camera.status = status;
        camera.lastActivity = lastActivity;
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
      })
      .addCase(updateCamera.fulfilled, (state, action) => {
        const index = state.cameras.findIndex((c) => c._id === action.payload._id);
        if (index !== -1) {
          state.cameras[index] = action.payload;
        }
      })
      .addCase(deleteCamera.fulfilled, (state, action) => {
        state.cameras = state.cameras.filter((c) => c._id !== action.payload);
      });
  },
});

export const { updateCameraStatus } = cameraSlice.actions;
export default cameraSlice.reducer;
