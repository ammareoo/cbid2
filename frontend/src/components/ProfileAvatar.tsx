import { TeacherAvatar } from './CourseMedia';
import { initials } from '../utils/format';

export function ProfileAvatar({ name, role, photoUpdatedAt, className = '' }: {
  name: string; role: 'admin' | 'teacher' | 'student'; photoUpdatedAt?: string | null; className?: string;
}) {
  if (photoUpdatedAt) return <img className={`profile-avatar ${className}`} src={`/api/me/profile/photo?v=${encodeURIComponent(photoUpdatedAt)}`} alt="" />;
  if (role === 'teacher') return <TeacherAvatar className={className} />;
  return <span className={`avatar ${className}`} aria-hidden="true">{initials(name)}</span>;
}
