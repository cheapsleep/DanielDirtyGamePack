import useAuth from '../hooks/useAuth'
import WoodenButton from './WoodenButton'

export default function AuthHeader() {
  const { user, logout } = useAuth()

  const go = (path: string) => { window.location.pathname = path }

  if (user) {
    return (
      <div className="flex gap-2">
        <WoodenButton onClick={async () => { await logout(); window.location.href = '/home' }} variant="white">Log out</WoodenButton>
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
