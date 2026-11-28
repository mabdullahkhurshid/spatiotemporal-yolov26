import { useEffect, useState } from 'react';
import api from '../services/api';
import { assetUrl } from '../utils/format';

// Stored alert media (/uploads/...) requires sign-in. <img src> cannot send the Bearer header, so the
// file is fetched through the API client (token + refresh handling) and shown from an object URL.
const isProtectedUpload = (path) => typeof path === 'string' && path.startsWith('/uploads/');

/**
 * Returns a displayable URL for an asset path, or null while loading / when it cannot be loaded.
 * Paths outside /uploads (e.g. absolute third-party URLs) are returned as-is and never get the token.
 */
export default function useAuthedAsset(path) {
  const [state, setState] = useState({ path: null, url: null });

  useEffect(() => {
    if (!isProtectedUpload(path)) return undefined;

    let cancelled = false;
    let objectUrl = null;
    // baseURL '' keeps axios from prefixing /api to the /uploads path.
    api
      .get(assetUrl(path), { responseType: 'blob', baseURL: '' })
      .then((res) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(res.data);
        setState({ path, url: objectUrl });
      })
      .catch(() => {
        if (!cancelled) setState({ path, url: null });
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  if (!path) return null;
  if (!isProtectedUpload(path)) return assetUrl(path);
  return state.path === path ? state.url : null;
}
