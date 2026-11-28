/**
 * Publish a MediaStream to MediaMTX over WebRTC (WHIP). Returns { pc, stop }.
 * H.264 is preferred so the RTSP readers on the server (ffmpeg, OpenCV) can decode the feed.
 */
export async function publishWhip(stream, whipUrl, onStateChange) {
  const pc = new RTCPeerConnection();
  stream.getVideoTracks().forEach((track) => {
    const transceiver = pc.addTransceiver(track, { direction: 'sendonly', streams: [stream] });
    const codecs = RTCRtpSender.getCapabilities?.('video')?.codecs || [];
    const h264 = codecs.filter((c) => c.mimeType === 'video/H264');
    if (h264.length && transceiver.setCodecPreferences) transceiver.setCodecPreferences(h264);
  });
  pc.addEventListener('connectionstatechange', () => onStateChange?.(pc.connectionState));

  try {
    await pc.setLocalDescription(await pc.createOffer());
    // Send all candidates in the offer (no trickle ICE); give up waiting after 2 s.
    await new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') return resolve();
      const timer = setTimeout(resolve, 2000);
      pc.addEventListener('icegatheringstatechange', () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timer);
          resolve();
        }
      });
    });

    const res = await fetch(whipUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: pc.localDescription.sdp,
    });
    if (!res.ok) {
      throw new Error(res.status === 401 ? 'The stream server refused this broadcast' : `Stream server error (${res.status})`);
    }
    await pc.setRemoteDescription({ type: 'answer', sdp: await res.text() });
  } catch (error) {
    pc.close();
    throw error;
  }

  return { pc, stop: () => pc.close() };
}
