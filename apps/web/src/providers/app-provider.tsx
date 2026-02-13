"use client";

import React, { type ReactNode } from 'react'
import { CheckCircle2, XCircle, Loader2, X } from "lucide-react"
import { SidebarProvider } from '@/components/ui/sidebar'
import AdminNavbar from '@/components/organisms/AdminNavbar'
import { AppSidebar } from '@/components/ui/app-sidebar'


// Set up metadata
const metadata = {
  name: 'Fundable',
  description: "A decentralized funding application.",
  url: typeof window !== 'undefined' ? window.location.origin : '',
  icons: ["/favicon_io/favicon.ico"]
}



function AppProvider({ children }: { children: ReactNode; }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex flex-col h-dvh w-full overflow-hidden">
        <AdminNavbar />
        <div className="flex-1 px-4 py-4 overflow-hidden pb-16 sm:pb-20 md:pb-4">
          {children}
        </div>
      </main>
    </SidebarProvider>
  )
}

export default AppProvider