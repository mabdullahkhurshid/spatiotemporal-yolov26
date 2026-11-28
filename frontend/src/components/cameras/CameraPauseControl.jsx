import { Pause, Play } from 'lucide-react';
import { cameraTitle, isCameraPaused } from '../../utils/camera';
import { PAUSE_OPTIONS, useCameraPause } from '../../hooks/useCameraPause';
import IconButton from '../ui/IconButton';
import Menu from '../ui/Menu';

/**
 * Pause button with a length menu, or Resume while paused. Pausing stops the live view, stream checks and
 * fire detection for the camera until it is resumed or the chosen time is up. Hidden in maintenance.
 */
const CameraPauseControl = ({ camera, className, size = 'sm', align = 'right' }) => {
  const { busy, pause, resume } = useCameraPause(camera);
  if (camera.status === 'maintenance') return null;

  if (isCameraPaused(camera.status)) {
    return <IconButton icon={Play} label={`Resume ${cameraTitle(camera)} now`} size={size} disabled={busy} onClick={resume} className={className} />;
  }

  return (
    <Menu
      align={align}
      header={<p className="text-xs text-fg-muted">No live view or fire detection while paused.</p>}
      items={PAUSE_OPTIONS.map((option) => ({ label: option.label, onClick: () => pause(option.minutes) }))}
      trigger={(props) => <IconButton {...props} icon={Pause} label={`Pause ${cameraTitle(camera)}`} size={size} disabled={busy} className={className} />}
    />
  );
};

export default CameraPauseControl;
