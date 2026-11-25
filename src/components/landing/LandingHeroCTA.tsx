'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConnectButton } from '@/components/ConnectButton'
import { useUserData } from '@/hooks/useDAO'

export function LandingHeroCTA() {
  const userData = useUserData()

  return (
    <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
      {userData.isConnected ? (
        userData.isMember ? (
          <Button asChild size="lg" className="w-full px-8 py-3 text-base sm:w-auto">
            <Link href="/dashboard">
              Go to Dashboard
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        ) : (
          <Button asChild size="lg" className="w-full px-8 py-3 text-base sm:w-auto">
            <Link href="/register">
              Become a Member
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        )
      ) : (
        <>
          <ConnectButton.Custom>
            {({ openConnectModal }) => (
              <Button
                onClick={openConnectModal}
                size="lg"
                className="w-full px-8 py-3 text-base sm:w-auto"
              >
                Connect Wallet
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            )}
          </ConnectButton.Custom>
          <Button variant="outline" size="lg" className="w-full px-8 py-3 text-base sm:w-auto">
            Learn More
          </Button>
        </>
      )}
    </div>
  )
}
