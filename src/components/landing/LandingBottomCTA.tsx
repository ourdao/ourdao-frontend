'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConnectButton } from '@/components/ConnectButton'
import { useUserData } from '@/hooks/useDAO'

/* Intentional: white buttons on the brand gradient stay white in both themes
   (no semantic token is theme-stable against the gradient),
   so bg-white / hover:bg-gray-50 are kept raw. */
export function LandingBottomCTA() {
  const userData = useUserData()

  return (
    <div className="flex flex-col justify-center gap-4 sm:flex-row">
      {userData.isConnected ? (
        userData.isMember ? (
          <Button
            asChild
            size="lg"
            className="w-full bg-white px-8 py-3 text-base font-semibold text-blue-600 hover:bg-gray-50 sm:w-auto"
          >
            <Link href="/dashboard">
              Access Dashboard
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        ) : (
          <Button
            asChild
            size="lg"
            className="w-full bg-white px-8 py-3 text-base font-semibold text-blue-600 hover:bg-gray-50 sm:w-auto"
          >
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
                className="w-full bg-white px-8 py-3 text-base font-semibold text-blue-600 hover:bg-gray-50 sm:w-auto"
              >
                Connect Wallet
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            )}
          </ConnectButton.Custom>
          <Button
            variant="outline"
            size="lg"
            className="w-full border-white/30 bg-transparent px-8 py-3 text-base font-semibold text-white hover:bg-white/10 sm:w-auto"
          >
            Learn More
          </Button>
        </>
      )}
    </div>
  )
}
