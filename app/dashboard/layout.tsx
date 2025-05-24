import React from 'react'
import { 
  Bell, 
  Settings, 
  ChevronDown,
  Sun
} from 'lucide-react';
import { AppleStyleDock } from '@/components/AppleStyleDock';
import LogoutButton from '@/components/LogoutButton';

const DashboardLayout = ({ children } : { children: React.ReactNode }) => {
  return (
    <div className='h-screen w-full flex flex-col'>
    {/* Top Navigation Bar */}
      <header className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200/50 py-3 px-6 flex items-center justify-between shadow-sm">
  <div className="flex items-center">
    <Sun className="h-6 w-6 text-amber-600 mr-2" />
    <h1 className="text-xl font-semibold text-amber-900">Bento Dashboard</h1>
  </div>
  <div className="flex items-center space-x-2">
    <button className="p-2 rounded-full hover:bg-amber-100/60 relative transition-colors">
      <Bell className="h-5 w-5 text-amber-700" />
      <span className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full"></span>
    </button>
    <button className="p-2 rounded-full hover:bg-amber-100/60 transition-colors">
      <Settings className="h-5 w-5 text-amber-700" />
    </button>
    <LogoutButton variant='ghost' className="text-amber-700 hover:bg-amber-100/60"/>
    <div className="flex items-center ml-2 cursor-pointer hover:bg-amber-100/40 rounded-lg px-2 py-1 transition-colors">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-medium shadow-sm">
        JD
      </div>
      <ChevronDown className="h-4 w-4 text-amber-700 ml-1" />
    </div>
  </div>
</header>
      <main className='flex-grow overflow-y-auto'>{children}</main>
      {/* Navigation Bar (Footer) */}
      <AppleStyleDock />
    </div>
  )
}

export default DashboardLayout