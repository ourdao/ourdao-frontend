'use client'

import React, { useState, useEffect } from 'react'
import { useAutoNotifications, useActivityFeed } from '@/hooks/useNotifications'
import {
  usePushNotifications,
  type NotificationData,
  type ActivityItem,
} from '@/lib/pushNotifications'
import { useIsMobile } from '@/lib/responsive'
import { LoadError } from '@/components/LoadError'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import {
  Bell,
  X,
  Check,
  CheckCheck,
  Settings,
  Activity,
  Clock,
  User,
  FileText,
  Vote,
  DollarSign,
  Users,
  Wallet,
  Shield,
} from 'lucide-react'
import { VirtualizedList } from '@/components/ui/virtualized-list'

interface NotificationCenterProps {
  className?: string
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ className = '' }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'notifications' | 'activity'>('notifications')
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const isMobile = useIsMobile()

  const {
    notifications,
    isError: notificationsError,
    refetch: refetchNotifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAllNotifications,
    requestPermission,
    enableAutoNotifications,
    disableAutoNotifications,
    autoNotifyEnabled,
    startListening,
    stopListening,
    isListening,
  } = useAutoNotifications()

  const { activities, isError: activityError, refetch: refetchActivity } = useActivityFeed(50)
  const { supported, permission } = usePushNotifications()

  // Auto-start listening when component mounts
  useEffect(() => {
    if (!isListening && autoNotifyEnabled) {
      startListening()
    }
  }, [isListening, autoNotifyEnabled, startListening])

  const filteredNotifications = notifications.filter((notif) => filter === 'all' || !notif.read)

  const getActivityIcon = (type: ActivityItem['type']) => {
    const iconMap = {
      loan: DollarSign,
      vote: Vote,
      proposal: FileText,
      member: Users,
      treasury: Wallet,
      document: Shield,
    }
    const Icon = iconMap[type] || Activity
    return <Icon className="h-4 w-4" />
  }

  // Only the dot's bg color is actually used (see the split(' ')[1] call
  // below) — a solid mid-tone so the dot reads clearly in both themes.
  const getNotificationTypeColor = (type: NotificationData['type']) => {
    const colorMap = {
      info: 'text-blue-600 bg-blue-500 border-blue-200',
      success: 'text-green-600 bg-green-500 border-green-200',
      warning: 'text-yellow-600 bg-yellow-500 border-yellow-200',
      error: 'text-red-600 bg-red-500 border-red-200',
    }
    return colorMap[type] || colorMap.info
  }

  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div className={`relative ${className}`}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        {/* Notification Bell Button */}
        <PopoverTrigger asChild>
          <button
            className="relative rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            title="Notifications"
            aria-label="Open notifications"
          >
            <Bell className="h-6 w-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </PopoverTrigger>

        {/* Notification Panel — a non-modal Popover: Escape closes it and
            returns focus to the bell trigger, opening moves focus into the
            panel, and outside clicks dismiss it, all handled by Radix. The
            background is intentionally left interactive (no backdrop/scroll
            lock), matching a popover rather than a modal dialog. */}
        <PopoverContent
          align={isMobile ? 'center' : 'end'}
          aria-label="Notifications"
          className={`p-0 ${isMobile ? 'w-screen rounded-t-xl' : 'w-96'} border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 ${isMobile ? 'max-h-screen' : 'max-h-96'} flex flex-col`}
        >
          {/* Header */}
          <div className="border-border border-b p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-foreground text-lg font-semibold">Notifications</h3>
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close notifications"
                className="hover:bg-accent rounded p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="bg-muted flex space-x-1 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('notifications')}
                className={`flex-1 ${isMobile ? 'py-3 text-xs' : 'py-2 text-sm'} rounded-md px-3 transition-colors ${
                  activeTab === 'notifications'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Notifications {unreadCount > 0 && `(${unreadCount})`}
              </button>
              <button
                onClick={() => setActiveTab('activity')}
                className={`flex-1 ${isMobile ? 'py-3 text-xs' : 'py-2 text-sm'} rounded-md px-3 transition-colors ${
                  activeTab === 'activity'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Activity
              </button>
            </div>

            {/* Controls */}
            <div className="mt-3 flex items-center justify-between">
              {activeTab === 'notifications' && (
                <>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setFilter('all')}
                      className={`rounded px-2 py-1 text-xs ${
                        filter === 'all'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                          : 'text-muted-foreground hover:bg-accent'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setFilter('unread')}
                      className={`rounded px-2 py-1 text-xs ${
                        filter === 'unread'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                          : 'text-muted-foreground hover:bg-accent'
                      }`}
                    >
                      Unread
                    </button>
                  </div>

                  {filteredNotifications.length > 0 && (
                    <div className="flex space-x-1">
                      <button
                        onClick={markAllAsRead}
                        className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        aria-label="Mark all as read"
                      >
                        <CheckCheck className="h-4 w-4" />
                      </button>
                      <button
                        onClick={clearAllNotifications}
                        className="text-xs text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                        aria-label="Clear all notifications"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'activity' && (
                <div className="flex items-center space-x-2">
                  <span
                    className={`inline-flex items-center text-xs ${
                      isListening ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                    }`}
                  >
                    <Activity className={`mr-1 h-3 w-3 ${isListening ? 'animate-pulse' : ''}`} />
                    {isListening ? 'Live' : 'Paused'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'notifications' ? (
              <div className="divide-border divide-y">
                {notificationsError && filteredNotifications.length === 0 ? (
                  <LoadError
                    what="notifications"
                    onRetry={() => void refetchNotifications()}
                    className="m-4"
                  />
                ) : filteredNotifications.length === 0 ? (
                  <div className={`${isMobile ? 'p-6' : 'p-8'} text-muted-foreground text-center`}>
                    <Bell
                      className={`${isMobile ? 'h-8 w-8' : 'h-12 w-12'} mx-auto mb-3 opacity-30`}
                    />
                    <p className={isMobile ? 'text-sm' : ''}>No notifications yet</p>
                    <p className="mt-1 text-xs">
                      {!autoNotifyEnabled ? (
                        <button
                          onClick={enableAutoNotifications}
                          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          Enable notifications
                        </button>
                      ) : (
                        "You're all caught up!"
                      )}
                    </p>
                  </div>
                ) : (
                  <VirtualizedList
                    items={filteredNotifications}
                    threshold={30}
                    itemHeight={90}
                    className="divide-border divide-y"
                    listAriaLabel="Notifications list"
                    keyExtractor={(n) => n.id}
                    renderItem={(notification) => (
                      <div
                        className={`hover:bg-accent cursor-pointer p-3 ${
                          !notification.read ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                        }`}
                        onClick={() => {
                          markAsRead(notification.id)
                          if (notification.actionUrl) {
                            window.location.href = notification.actionUrl
                            setIsOpen(false)
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            markAsRead(notification.id)
                            if (notification.actionUrl) {
                              window.location.href = notification.actionUrl
                              setIsOpen(false)
                            }
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center space-x-2">
                              <div
                                className={`h-2 w-2 rounded-full ${
                                  getNotificationTypeColor(notification.type).split(' ')[1]
                                }`}
                              />
                              <h4
                                className={`text-sm font-medium ${
                                  !notification.read ? 'text-foreground' : 'text-foreground'
                                }`}
                              >
                                {notification.title}
                              </h4>
                            </div>
                            <p className="text-muted-foreground mb-2 text-sm">
                              {notification.message}
                            </p>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground text-xs">
                                {formatTime(notification.timestamp)}
                              </span>
                              {!notification.read && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    markAsRead(notification.id)
                                  }}
                                  className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                                  aria-label="Mark as read"
                                >
                                  <Check className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              removeNotification(notification.id)
                            }}
                            className="hover:bg-accent ml-2 rounded p-1"
                            title="Remove"
                            aria-label="Remove notification"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  />
                )}
              </div>
            ) : (
              <div className="divide-border divide-y">
                {activityError && activities.length === 0 ? (
                  <LoadError
                    what="recent activity"
                    onRetry={() => void refetchActivity()}
                    className="m-4"
                  />
                ) : activities.length === 0 ? (
                  <div className={`${isMobile ? 'p-6' : 'p-8'} text-muted-foreground text-center`}>
                    <Activity
                      className={`${isMobile ? 'h-8 w-8' : 'h-12 w-12'} mx-auto mb-3 opacity-30`}
                    />
                    <p className={isMobile ? 'text-sm' : ''}>No recent activity</p>
                    <p className="mt-1 text-xs">DAO events will appear here as they happen</p>
                  </div>
                ) : (
                  <VirtualizedList
                    items={activities}
                    threshold={30}
                    itemHeight={90}
                    className="divide-border divide-y"
                    listAriaLabel="Activity feed"
                    keyExtractor={(activity) => activity.id}
                    renderItem={(activity) => (
                      <div className="hover:bg-accent p-3">
                        <div className="flex items-start space-x-3">
                          <div className="text-muted-foreground mt-1 flex-shrink-0">
                            {getActivityIcon(activity.type)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-foreground mb-1 text-sm font-medium">
                              {activity.title}
                            </h4>
                            <p className="text-muted-foreground mb-2 text-sm">
                              {activity.description}
                            </p>
                            <div className="text-muted-foreground flex items-center justify-between text-xs">
                              <div className="flex items-center space-x-2">
                                <Clock className="h-3 w-3" />
                                <span>{formatTime(activity.timestamp)}</span>
                              </div>
                              {activity.user && (
                                <div className="flex items-center space-x-1">
                                  <User className="h-3 w-3" />
                                  <span className="max-w-20 truncate">{activity.user}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  />
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-border bg-muted rounded-b-xl border-t p-3">
            <div className="flex items-center justify-between">
              <div className="text-muted-foreground flex items-center space-x-2 text-xs">
                <Settings className="h-3 w-3" />
                <span>Settings</span>
              </div>

              <div className="flex items-center space-x-2">
                {activeTab === 'notifications' && (
                  <>
                    <button
                      onClick={
                        autoNotifyEnabled ? disableAutoNotifications : enableAutoNotifications
                      }
                      className={`rounded px-2 py-1 text-xs ${
                        autoNotifyEnabled
                          ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/60'
                          : 'bg-muted text-muted-foreground hover:bg-accent'
                      }`}
                    >
                      {autoNotifyEnabled ? 'Auto On' : 'Auto Off'}
                    </button>

                    {supported && permission !== 'granted' && (
                      <button
                        onClick={requestPermission}
                        className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60"
                      >
                        Enable Push
                      </button>
                    )}
                  </>
                )}

                {activeTab === 'activity' && (
                  <button
                    onClick={isListening ? stopListening : startListening}
                    className={`rounded px-2 py-1 text-xs ${
                      isListening
                        ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60'
                        : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/60'
                    }`}
                  >
                    {isListening ? 'Stop' : 'Start'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export default NotificationCenter
