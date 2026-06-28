import clsx from 'clsx';
import { initials } from '../lib/format';

export function Avatar({
  photoUrl,
  firstName,
  lastName,
  className,
}: {
  photoUrl?: string | null;
  firstName?: string;
  lastName?: string;
  className?: string;
}) {
  if (photoUrl) {
    return <img src={photoUrl} alt="" className={clsx('object-cover', className)} />;
  }
  return (
    <span className={clsx('grid place-items-center bg-brand font-bold text-white', className)}>
      {initials(firstName, lastName)}
    </span>
  );
}
