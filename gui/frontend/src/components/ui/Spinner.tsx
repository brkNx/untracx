interface Props {
  size?: 'sm' | 'lg';
}

export default function Spinner({ size = 'sm' }: Props) {
  return <span className={`spinner ${size === 'lg' ? 'spinner--lg' : ''}`} />;
}
