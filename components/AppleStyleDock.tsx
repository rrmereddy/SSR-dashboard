'use client';
import Link from 'next/link';
import {
  HomeIcon,
  FileText,
  SunMoon,
} from 'lucide-react';

import { Dock, DockIcon, DockItem, DockLabel } from '@/components/ui/dock';

const data = [
  { title: 'Home',    icon: <HomeIcon  className='h-full w-full text-neutral-600 dark:text-neutral-300' />, href: '/dashboard' },
  { title: 'Resume',  icon: <FileText   className='h-full w-full text-neutral-600 dark:text-neutral-300' />, href: '/dashboard/resume'    },
  { title: 'Theme',   icon: <SunMoon   className='h-full w-full text-neutral-600 dark:text-neutral-300' />, href: '#'          },
];

export function AppleStyleDock() {
  return (
    <div className='fixed bottom-2 left-1/2 max-w-full -translate-x-1/2'>
      <Dock className='bg-foreground items-end pb-3'>
        {data.map((item, idx) => (
          <Link href={item.href} key={idx} passHref>
            {/* inline-block so the link shrinks to the size of the DockItem */}
              <DockItem className='aspect-square rounded-full bg-background dark:bg-neutral-800 cursor-pointer'>
                <DockLabel>{item.title}</DockLabel>
                <DockIcon>{item.icon}</DockIcon>
              </DockItem>

          </Link>
        ))}
      </Dock>
    </div>
  );
}
