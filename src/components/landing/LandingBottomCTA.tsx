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
    <div className="flex flex-col sm:flex-row gap-4 justify-center">
      {userData.isConnected ? (
        userData.isMember ? (
          <Button asChild size="lg" className="w-full sm:w-auto bg-white text-blue-600 hover:bg-gray-50 px-8 py-3 text-base font-semibold">
            <Link href="/dashboard">
              Access Dashboard
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        ) : (
          <Button asChild size="lg" className="w-full sm:w-auto bg-white text-blue-600 hover:bg-gray-50 px-8 py-3 text-base font-semibold">
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
                className="w-full sm:w-auto bg-white text-blue-600 hover:bg-gray-50 px-8 py-3 text-base font-semibold"
              >
                Connect Wallet
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            )}
          </ConnectButton.Custom>
          <Button
            variant="outline"
            size="lg"
            className="w-full sm:w-auto bg-transparent border-white/30 text-white hover:bg-white/10 px-8 py-3 text-base font-semibold"
          >
            Learn More
          </Button>
        </>
      )}
    </div>
  )
}
