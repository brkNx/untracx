interface Props {
  type: 'success' | 'error' | 'info';
  text: string;
}

export default function Message({ type, text }: Props) {
  return (
    <div className={`message message--${type}`} role="status" aria-live="polite">
      {text}
    </div>
  );
}

export type MessageType = Props['type'];
