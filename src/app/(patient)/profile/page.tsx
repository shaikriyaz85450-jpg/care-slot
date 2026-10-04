import React from 'react'
import Link from 'next/link'

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-surface p-space-lg flex flex-col items-center justify-center">
      <div className="bg-surface-container-lowest p-space-xl rounded-xl shadow-sm max-w-lg w-full text-center">
        <div className="w-12 h-12 rounded-full bg-primary-container/10 flex items-center justify-center text-primary mx-auto mb-space-sm">
          <span className="material-symbols-outlined text-[28px]">person</span>
        </div>
        <h1 className="font-headline-md text-headline-md text-on-surface font-semibold">Patient Profile &amp; Settings</h1>
        <p className="font-body-md text-body-md text-secondary mt-2">
          Manage your personal contact details, medical record number, and notification preferences.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg px-space-md py-2.5 rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>Back to Home</span>
        </Link>
      </div>
    </div>
  )
}
