import { useEffect, useRef, useState } from 'react';
import { Radio, Square } from 'lucide-react';
import Button from '../ui/Button';
import { getCameraPublishToken } from '../../services/apiEndpoints';
import { publishWhip } from '../../utils/whipPublisher';

/**
 * Broadcasts this device's camera to a "Laptop camera" device (WebRTC → MediaMTX → RTSP for detection).
 * The feed is live only while this panel stays open.
 */
const WebcamBroadcastPanel = ({ cameraId }) => {
  const videoRef = useRef(null);
  const sessionRef = useRef(null);
  const mountedRef = useRef(true);
  const [state, setState] = useState('idle'); // idle | starting | live | error
  const [error, setError] = useState(null);

  const release = () => {
    const session = sessionRef.current;
    sessionRef.current = null;
    session?.publisher?.stop();
    session?.stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      release();
    };
  }, []);

  useEffect(() => {
    if (state !== 'live') return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [state]);

  const fail = (message) => {
    release();
    if (!mountedRef.current) return;
    setError(message);
    setState('error');
  };

  const start = async () => {
    setState('starting');
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access needs https:// or http://localhost');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const session = { stream };
      sessionRef.current = session;
      if (videoRef.current) videoRef.current.srcObject = stream;

      const res = await getCameraPublishToken(cameraId);
      const publisher = await publishWhip(stream, res.data.data.whipUrl, (connectionState) => {
        if (connectionState === 'failed' && sessionRef.current === session) fail('Connection to the stream server was lost');
      });
      if (sessionRef.current !== session) {
        publisher.stop();
        return;
      }
      session.publisher = publisher;
      setState('live');
    } catch (err) {
      fail(
        err.response?.data?.message ||
          (err.name === 'NotAllowedError' ? 'Camera permission was denied' : err.message) ||
          'Could not start broadcasting'
      );
    }
  };

  const stop = () => {
    release();
    setState('idle');
  };

  const live = state === 'live';

  return (
    <div className="absolute bottom-4 left-4 z-10 w-56 rounded-lg border border-white/15 bg-black/70 p-2.5 text-white backdrop-blur">
      <video ref={videoRef} autoPlay muted playsInline className={live || state === 'starting' ? 'mb-2 aspect-video w-full rounded bg-black object-cover' : 'hidden'} />
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium">
          <span className={`h-2 w-2 rounded-full ${live ? 'animate-pulse bg-critical' : 'bg-white/30'}`} aria-hidden="true" />
          {live ? 'Broadcasting' : 'This device’s camera'}
        </span>
        {live ? (
          <Button size="xs" variant="secondary" icon={Square} onClick={stop}>
            Stop
          </Button>
        ) : (
          <Button size="xs" icon={Radio} loading={state === 'starting'} onClick={start}>
            Start
          </Button>
        )}
      </div>
      {live && <p className="mt-1.5 text-2xs text-white/55">Keep this view open to stay live.</p>}
      {error && <p className="mt-1.5 text-2xs text-red-300">{error}</p>}
    </div>
  );
};

export default WebcamBroadcastPanel;
