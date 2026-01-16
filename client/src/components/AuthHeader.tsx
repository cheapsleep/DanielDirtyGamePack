import useAuth from '../hooks/useAuth'
import WoodenButton from './WoodenButton'

export default function AuthHeader() {
  const { user } = useAuth()

  const go = (path: string) => { window.location.pathname = path }

  if (user) {
    return (
      <div className="flex gap-2">
        <WoodenButton onClick={() => go('/profile')} variant="white">Profile</WoodenButton>
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      <WoodenButton onClick={() => go('/login')} variant="red">Login</WoodenButton>
      <WoodenButton onClick={() => go('/register')} variant="white">Register</WoodenButton>
    </div>
  )
}
