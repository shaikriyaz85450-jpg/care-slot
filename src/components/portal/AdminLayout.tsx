'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { signOutAction } from '@/app/actions/auth'

interface AdminLayoutProps {
  activePath: 'overview' | 'doctors' | 'departments' | 'appointments'
  children: React.ReactNode
}

export function AdminLayout({ activePath, children }: AdminLayoutProps) {
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Current formatted date
  const todayFormatted = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await signOutAction()
    } catch {
      // ignore
    }
  }

  const navItems = [
    { id: 'overview', label: 'Overview', href: '/admin', icon: 'grid_view' },
    { id: 'doctors', label: 'Doctors', href: '/admin/doctors', icon: 'stethoscope' },
    { id: 'departments', label: 'Departments', href: '/admin/departments', icon: 'domain' },
    { id: 'appointments', label: 'Appointments', href: '/admin/appointments', icon: 'calendar_today' },
  ]

  return (
    <div className="bg-surface font-body-md text-on-surface antialiased min-h-screen">
      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-50 hidden md:flex flex-col justify-between">
        <div className="flex flex-col">
          <div className="h-16 px-space-md flex items-center gap-space-sm bg-surface-container-lowest border-b border-surface-container-low">
            <img
              alt="CareSlot Brand logo"
              className="h-8 w-auto object-contain"
              src="https://lh3.googleusercontent.com/aida/AEtjO1Xuc9Rs6Ae-tAN7zLtOttlwVNu3xgirpZWKdtsMa1C3sEzJ7GBC3kiG_3bRBG3PtB7zQRAO4zmUwFlJVpHxPBps4NmzsMtuY3w9p5VVvq0K64sme4zB5y7Tfi6_XWOsQxVPGanWvZuHqsA-PZPB0wxmuQAPHH2RFOmeZUDYPaCs8JvvNxyOUJFd5u3tLAbHh1314BMy8nWjYb7N1sKvcSq3aQhGyRnM-qAkpigWWLwOeh6XI74TvAXaycs"
            />
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm text-on-surface leading-none font-bold">
                CareSlot
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant leading-tight">
                Admin Portal
              </span>
            </div>
          </div>

          <nav
            className="flex flex-col gap-space-xs px-space-sm mt-space-md"
            data-active-classes="bg-primary-container text-on-primary-container font-headline-sm rounded-lg"
          >
            {navItems.map((item) => {
              const isActive = activePath === item.id
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-space-sm px-space-md py-space-sm rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm'
                      : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                  }`}
                  data-path={item.id}
                >
                  <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  <span className="font-label-lg text-label-lg">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="p-space-sm border-t border-surface-container-low">
          <nav className="flex flex-col gap-space-xs">
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="flex items-center gap-space-sm px-space-md py-space-sm rounded-lg text-on-surface-variant hover:bg-error-container hover:text-on-error-container transition-colors w-full text-left disabled:opacity-50"
              data-path="sign-out"
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
              <span className="font-label-lg text-label-lg">
                {isSigningOut ? 'Signing out...' : 'Sign Out'}
              </span>
            </button>
          </nav>
        </div>
      </aside>

      {/* Mobile Drawer (visible on small screens when open) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden bg-slate-900/50 backdrop-blur-sm flex">
          <div className="w-64 bg-surface-container-lowest h-full p-4 flex flex-col justify-between shadow-2xl">
            <div className="flex flex-col">
              <div className="flex items-center justify-between pb-4 border-b border-surface-container-low">
                <div className="flex items-center gap-2">
                  <span className="font-headline-sm text-headline-sm font-bold text-on-surface">CareSlot</span>
                  <span className="text-xs bg-surface-container-high px-2 py-0.5 rounded text-on-surface-variant">Admin</span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container"
                  aria-label="Close menu"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
              <nav className="flex flex-col gap-1 mt-4">
                {navItems.map((item) => {
                  const isActive = activePath === item.id
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-primary-container text-on-primary-container font-semibold'
                          : 'text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                      <span className="text-sm font-medium">{item.label}</span>
                    </Link>
                  )
                })}
              </nav>
            </div>

            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-error hover:bg-error-container transition-colors text-sm font-medium"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
              <span>Sign Out</span>
            </button>
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* Main Container */}
      <div className="md:pl-64 flex flex-col min-h-screen">
        {/* Fixed Header */}
        <header className="fixed top-0 left-0 md:left-64 right-0 h-16 bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-40 px-4 md:px-space-lg flex items-center justify-between border-b border-surface-container-low">
          <div className="flex items-center gap-3 md:gap-space-md">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
              aria-label="Open mobile navigation"
            >
              <span className="material-symbols-outlined text-[24px]">menu</span>
            </button>

            <img
              alt="Brand logo"
              className="h-8 w-auto object-contain hidden sm:block"
              src="https://lh3.googleusercontent.com/aida/AEtjO1Xuc9Rs6Ae-tAN7zLtOttlwVNu3xgirpZWKdtsMa1C3sEzJ7GBC3kiG_3bRBG3PtB7zQRAO4zmUwFlJVpHxPBps4NmzsMtuY3w9p5VVvq0K64sme4zB5y7Tfi6_XWOsQxVPGanWvZuHqsA-PZPB0wxmuQAPHH2RFOmeZUDYPaCs8JvvNxyOUJFd5u3tLAbHh1314BMy8nWjYb7N1sKvcSq3aQhGyRnM-qAkpigWWLwOeh6XI74TvAXaycs"
            />
            <div className="flex items-center gap-space-xs text-on-surface-variant bg-surface-container-low px-space-sm py-space-xs rounded-lg">
              <span className="material-symbols-outlined text-[16px]">today</span>
              <span className="font-label-sm text-label-sm">Today: {todayFormatted}</span>
            </div>
          </div>

          <div className="flex items-center gap-space-md">
            <Link
              href="/notifications"
              aria-label="Notifications"
              className="relative p-space-sm rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-[22px]">notifications</span>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-error"></span>
            </Link>
            <div className="flex items-center gap-space-sm pl-space-sm">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
              </div>
              <div className="flex flex-col text-left hidden sm:flex">
                <span className="font-label-lg text-label-lg text-on-surface leading-tight font-semibold">
                  Admin Office
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant leading-tight">
                  System Administrator
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="relative pt-16 bg-surface flex-1 w-full px-4 md:px-space-lg py-space-lg">
          {children}
        </main>
      </div>
    </div>
  )
}
