interface Props {
  type: 'success' | 'error' | 'info';
  text: string;
}

export default function Message({ type, text }: Props) {
  return <div className={`message message--${type}`}>{text}</div>;
}

export type MessageType = Props['type'];
