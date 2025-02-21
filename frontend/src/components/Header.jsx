import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { logout } from '../store/authSlice'
import { ThemeSelect } from './ThemeToggle'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { LogOut, User } from 'lucide-react'

const Header = () => {
  const { user } = useSelector((state) => state.auth)
  const dispatch = useDispatch()
  const [profilePicture, setProfilePicture] = useState(null)

  useEffect(() => {
    // Force refresh profile picture by adding timestamp query
    if (user?.profile?.profilePicture) {
      setProfilePicture(`${user.profile.profilePicture}?${Date.now()}`)
    }
  }, [user])

  const handleLogout = () => {
    dispatch(logout())
  }

  return (
    <header className="sticky top-0 z-50 w-full py-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link to="/jobs" className="flex items-center">
          <img src="/imageLight.png" alt="Profyle Logo" className="w-40 hidden dark:block" />
          <img src="/image.png" alt="Profyle Logo" className="w-40 block dark:hidden" />
        </Link>

        <div className="flex items-center gap-10">
          {user ? (
            <>
              {/* Post Job Button (Recruiter Only) */}
              {user.role === "recruiter" && (
                <Button asChild variant="default" size="lg" className="text-base cursor-pointer">
                  <Link to={`/select-company-for-job/${user._id}`}>
                    Post Job
                  </Link>
                </Button>
              )}

              {/* Profile Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Avatar className="cursor-pointer border-2 dark:border-gray-600 w-14 h-14">
                    {profilePicture ? (
                      <AvatarImage src={profilePicture} alt="Profile" />
                    ) : (
                      <AvatarFallback>
                        <User size={32} className="text-gray-400" />
                      </AvatarFallback>
                    )}
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64">
                  <div className="p-4 border-b">
                    <div className="flex items-center justify-between">
                      <div className="pb-2">
                        <p className="font-medium mb-2">
                          {user?.profile?.firstName} {user?.profile?.lastName}
                        </p>
                        <p className="text-sm mb-4">{user?.email}</p>
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                          {user?.role?.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <DropdownMenuItem asChild className="pl-4 cursor-pointer">
                    <Link to={`/profile/${user?._id}`}>My Profile</Link>
                  </DropdownMenuItem>
                  {user?.role === "recruiter" && (
                    <>
                      <DropdownMenuItem asChild className="pl-4 cursor-pointer">
                        <Link to={`/recruiter-companies/${user._id}`}>
                          My Companies
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="pl-4 cursor-pointer">
                        <Link to={`/recruiter-jobs/${user._id}`}>My Jobs</Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  {user?.role === "candidate" && (
                    <DropdownMenuItem asChild className="pl-4 cursor-pointer">
                      <Link to="/candidate/applications">My Applications</Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild className="pl-4 cursor-pointer">
                    <Link to="/saved-jobs">Saved Jobs</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="pl-4 cursor-pointer">
                    <Link to="/chat">Messages</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="pl-4 cursor-pointer !text-red-600 hover:!text-red-600 hover:bg-red-50/10"
                  >
                    <div className="flex items-center justify-start w-full">
                      <span className="text-base !text-red-600">Logout</span>
                      <LogOut className="ml-2 h-5 w-5 !text-red-600" />
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="flex gap-4">
              <Button asChild variant="outline">
                <Link to="/login">Login</Link>
              </Button>
              <Button asChild>
                <Link to="/onboarding">Sign Up</Link>
              </Button>
            </div>
          )}
          {/* Theme Toggle */}
          <ThemeSelect />
        </div>
      </div>
    </header>
  )
}

export default Header
