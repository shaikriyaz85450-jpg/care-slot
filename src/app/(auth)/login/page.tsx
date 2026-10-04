import React, { Suspense } from 'react'
import { StitchLandingPageContent } from '@/components/portal/StitchLandingPage'

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center text-slate-600">
          Loading CareSlot Portal Login...
        </div>
      }
    >
      <StitchLandingPageContent autoOpenLogin={true} />
    </Suspense>
  )
}
