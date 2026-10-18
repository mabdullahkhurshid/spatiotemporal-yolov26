export const emptyOnvifValue = { host: '', port: '80', username: '', password: '', profileToken: '' };

/** "H264 · 1920×1080 · 25 fps" */
export const describeProfile = (profile) =>
  [profile.encoding, profile.width && profile.height ? `${profile.width}×${profile.height}` : null, profile.fps ? `${profile.fps} fps` : null]
    .filter(Boolean)
    .join(' · ');
