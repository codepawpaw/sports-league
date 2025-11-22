'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { Users, Calendar, Trophy, User } from 'lucide-react'

interface TabItem {
  key: string
  label: string
  icon: React.ReactNode
  path: string
  show?: boolean
}

interface TabNavigationProps {
  currentUser?: any
  isParticipant?: boolean
}

export default function TabNavigation({ currentUser, isParticipant }: TabNavigationProps) {
  const params = useParams()
  const pathname = usePathname()
  const slug = params.slug as string

  const tabs: TabItem[] = [
    {
      key: 'players',
      label: 'Players',
      icon: <Users className="h-4 w-4" />,
      path: `/${slug}/players`,
      show: true
    },
    {
      key: 'upcoming',
      label: 'Upcoming Matches',
      icon: <Calendar className="h-4 w-4" />,
      path: `/${slug}/upcoming`,
      show: true
    },
    {
      key: 'results',
      label: 'All Results',
      icon: <Trophy className="h-4 w-4" />,
      path: `/${slug}/results`,
      show: true
    },
    {
      key: 'my-matches',
      label: 'My Matches',
      icon: <User className="h-4 w-4" />,
      path: `/${slug}/my-matches`,
      show: currentUser && isParticipant
    }
  ]

  const visibleTabs = tabs.filter(tab => tab.show)

  const isActive = (tabPath: string) => {
    if (tabPath === `/${slug}`) {
      return pathname === `/${slug}`
    }
    return pathname === tabPath
  }

  return (
    <div className="border-b border-gray-100 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex space-x-8 overflow-x-auto">
          {visibleTabs.map((tab) => (
            <Link
              key={tab.key}
              href={tab.path}
              className={`
                flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors duration-200
                ${isActive(tab.path)
                  ? 'border-green-500 text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  )
}
