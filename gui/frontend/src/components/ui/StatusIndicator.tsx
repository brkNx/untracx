interface Props {
  label: string;
  connected: boolean | null;
}

export default function StatusIndicator({ label, connected }: Props) {
  const className =
    connected === null
      ? 'status--loading'
      : connected
        ? 'status--connected'
        : 'status--disconnected';

  const text = connected === null ? 'Loading...' : connected ? 'Connected' : 'Disconnected';

  return (
    <span className={`status ${className}`} role="status" aria-live="polite">
      <span className="status__dot" />
      {label}: {text}
    </span>
  );
}
