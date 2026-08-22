// Phase 27 — avatars. Originally 8 hand-tuned procedural SVG faces.
// P54 — replaced with 8 real illustrated portraits Joel provided (not photos
// of real people — AI-generated character art, so no likeness/consent
// concern). Same id (0-7) indexing kept exactly, so every existing
// <Avatar id={n}> call site across the app keeps working unchanged.
//
// Imported via ES import, not a raw '/assets/...' path string — that exact
// mistake (a hardcoded absolute path Vite's base config never rewrites)
// already broke images once on itch.io's subpath hosting and got fixed in
// P46. Importing lets Vite bundle, hash, and correctly rewrite the path for
// production automatically.
import avatar0 from '../assets/avatars/avatar-0.jpg'
import avatar1 from '../assets/avatars/avatar-1.jpg'
import avatar2 from '../assets/avatars/avatar-2.jpg'
import avatar3 from '../assets/avatars/avatar-3.jpg'
import avatar4 from '../assets/avatars/avatar-4.jpg'
import avatar5 from '../assets/avatars/avatar-5.jpg'
import avatar6 from '../assets/avatars/avatar-6.jpg'
import avatar7 from '../assets/avatars/avatar-7.jpg'

export const AVATAR_IMAGES = [avatar0, avatar1, avatar2, avatar3, avatar4, avatar5, avatar6, avatar7]

export default function Avatar({ id, size = 48, className = '' }: { id: number; size?: number; className?: string }) {
  const src = AVATAR_IMAGES[((id % AVATAR_IMAGES.length) + AVATAR_IMAGES.length) % AVATAR_IMAGES.length]
  return (
    <img
      src={src}
      width={size}
      height={size}
      className={`rounded-full object-cover ${className}`}
      style={{ width: size, height: size }}
      alt=""
      aria-hidden
    />
  )
}
