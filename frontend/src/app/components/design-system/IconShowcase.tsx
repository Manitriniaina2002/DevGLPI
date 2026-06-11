'use client'

import {
  Home,
  BarChart3,
  FileText,
  Settings,
  Users,
  Ticket,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Calendar,
  Filter,
  Search,
  Plus,
  Edit,
  Trash2,
  Download,
  Upload,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Bell,
  Mail,
  MessageSquare,
  User,
  LogOut,
} from 'lucide-react';

interface IconItemProps {
  Icon: React.ElementType;
  name: string;
  size?: number;
}

function IconItem({ Icon, name, size = 24 }: IconItemProps) {
  return (
    <div className="flex flex-col items-center gap-3 p-4 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors">
      <Icon size={size} className="text-neutral-700" />
      <span className="text-xs text-neutral-600 text-center">{name}</span>
    </div>
  );
}

export function IconShowcase() {
  const navigationIcons = [
    { Icon: Home, name: 'Home' },
    { Icon: BarChart3, name: 'Dashboard' },
    { Icon: FileText, name: 'Reports' },
    { Icon: Settings, name: 'Settings' },
    { Icon: Users, name: 'Users' },
  ];

  const ticketIcons = [
    { Icon: Ticket, name: 'Ticket' },
    { Icon: Clock, name: 'Pending' },
    { Icon: CheckCircle2, name: 'Resolved' },
    { Icon: XCircle, name: 'Closed' },
    { Icon: AlertCircle, name: 'Alert' },
  ];

  const analyticsIcons = [
    { Icon: TrendingUp, name: 'Trending Up' },
    { Icon: TrendingDown, name: 'Trending Down' },
    { Icon: BarChart3, name: 'Chart' },
    { Icon: Calendar, name: 'Calendar' },
    { Icon: Filter, name: 'Filter' },
  ];

  const actionIcons = [
    { Icon: Search, name: 'Search' },
    { Icon: Plus, name: 'Add' },
    { Icon: Edit, name: 'Edit' },
    { Icon: Trash2, name: 'Delete' },
    { Icon: Download, name: 'Download' },
    { Icon: Upload, name: 'Upload' },
  ];

  const interfaceIcons = [
    { Icon: Menu, name: 'Menu' },
    { Icon: X, name: 'Close' },
    { Icon: ChevronDown, name: 'Chevron Down' },
    { Icon: ChevronRight, name: 'Chevron Right' },
    { Icon: Bell, name: 'Notification' },
    { Icon: Mail, name: 'Email' },
    { Icon: MessageSquare, name: 'Message' },
    { Icon: User, name: 'Profile' },
    { Icon: LogOut, name: 'Logout' },
  ];

  return (
    <div className="space-y-8">
      {/* Icon Sizes */}
      <div>
        <h4 className="font-semibold text-neutral-900 mb-4">Icon Sizes</h4>
        <div className="flex items-end gap-8 p-6 bg-neutral-50 rounded-lg">
          <div className="flex flex-col items-center gap-2">
            <Home size={16} className="text-neutral-700" />
            <span className="text-xs text-neutral-600">XS (16px)</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Home size={20} className="text-neutral-700" />
            <span className="text-xs text-neutral-600">SM (20px)</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Home size={24} className="text-neutral-700" />
            <span className="text-xs text-neutral-600">MD (24px)</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Home size={32} className="text-neutral-700" />
            <span className="text-xs text-neutral-600">LG (32px)</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Home size={40} className="text-neutral-700" />
            <span className="text-xs text-neutral-600">XL (40px)</span>
          </div>
        </div>
      </div>

      {/* Navigation Icons */}
      <div>
        <h4 className="font-semibold text-neutral-900 mb-4">Navigation Icons</h4>
        <div className="grid grid-cols-5 gap-4">
          {navigationIcons.map((icon) => (
            <IconItem key={icon.name} {...icon} />
          ))}
        </div>
      </div>

      {/* Ticket Management Icons */}
      <div>
        <h4 className="font-semibold text-neutral-900 mb-4">Ticket Management Icons</h4>
        <div className="grid grid-cols-5 gap-4">
          {ticketIcons.map((icon) => (
            <IconItem key={icon.name} {...icon} />
          ))}
        </div>
      </div>

      {/* Analytics Icons */}
      <div>
        <h4 className="font-semibold text-neutral-900 mb-4">Analytics Icons</h4>
        <div className="grid grid-cols-5 gap-4">
          {analyticsIcons.map((icon) => (
            <IconItem key={icon.name} {...icon} />
          ))}
        </div>
      </div>

      {/* Action Icons */}
      <div>
        <h4 className="font-semibold text-neutral-900 mb-4">Action Icons</h4>
        <div className="grid grid-cols-6 gap-4">
          {actionIcons.map((icon) => (
            <IconItem key={icon.name} {...icon} />
          ))}
        </div>
      </div>

      {/* Interface Icons */}
      <div>
        <h4 className="font-semibold text-neutral-900 mb-4">Interface Icons</h4>
        <div className="grid grid-cols-6 gap-4">
          {interfaceIcons.map((icon) => (
            <IconItem key={icon.name} {...icon} />
          ))}
        </div>
      </div>
    </div>
  );
}
