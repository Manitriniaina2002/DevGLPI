'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { ArrowUpDown, ChevronLeft, ChevronRight, Edit, Trash2, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

const tickets = [
  {
    id: 'TKT-001',
    title: 'Network connectivity issue in Building A',
    category: 'Network',
    priority: 'High',
    status: 'Open',
    assignee: 'John Smith',
    created: '2026-06-01',
  },
  {
    id: 'TKT-002',
    title: 'Software installation request - Adobe CC',
    category: 'Software',
    priority: 'Medium',
    status: 'In Progress',
    assignee: 'Sarah Johnson',
    created: '2026-06-02',
  },
  {
    id: 'TKT-003',
    title: 'Printer malfunction - 3rd floor',
    category: 'Hardware',
    priority: 'Low',
    status: 'Resolved',
    assignee: 'Mike Davis',
    created: '2026-06-02',
  },
  {
    id: 'TKT-004',
    title: 'Password reset for user account',
    category: 'Access',
    priority: 'Critical',
    status: 'Open',
    assignee: 'Emily Wilson',
    created: '2026-06-03',
  },
  {
    id: 'TKT-005',
    title: 'Email configuration issues',
    category: 'Software',
    priority: 'Medium',
    status: 'Closed',
    assignee: 'John Smith',
    created: '2026-06-03',
  },
];

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'Critical':
      return 'bg-error-500 hover:bg-error-600';
    case 'High':
      return 'bg-warning-500 hover:bg-warning-600';
    case 'Medium':
      return 'bg-info-500 hover:bg-info-600';
    case 'Low':
      return 'bg-neutral-400 hover:bg-neutral-500';
    default:
      return 'bg-neutral-400';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Open':
      return 'bg-info-500 hover:bg-info-600';
    case 'In Progress':
      return 'bg-warning-500 hover:bg-warning-600';
    case 'Resolved':
      return 'bg-success-500 hover:bg-success-600';
    case 'Closed':
      return 'bg-neutral-400 hover:bg-neutral-500';
    default:
      return 'bg-neutral-400';
  }
};

export function TableShowcase() {
  return (
    <div className="space-y-6">
      {/* Data Table */}
      <div>
        <h4 className="font-semibold text-neutral-900 mb-4">Data Table with Actions</h4>
        <div className="border border-neutral-200 rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-neutral-50">
                <TableHead className="w-12">
                  <Checkbox />
                </TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    ID
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    Title
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    Category
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => (
                <TableRow key={ticket.id} className="hover:bg-neutral-50">
                  <TableCell>
                    <Checkbox />
                  </TableCell>
                  <TableCell className="font-mono text-sm">{ticket.id}</TableCell>
                  <TableCell className="font-medium max-w-xs truncate">{ticket.title}</TableCell>
                  <TableCell className="text-neutral-600">{ticket.category}</TableCell>
                  <TableCell>
                    <Badge className={getPriorityColor(ticket.priority)}>{ticket.priority}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(ticket.status)}>{ticket.status}</Badge>
                  </TableCell>
                  <TableCell className="text-neutral-600">{ticket.assignee}</TableCell>
                  <TableCell className="text-neutral-600">{ticket.created}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-error-600">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      <div>
        <h4 className="font-semibold text-neutral-900 mb-4">Pagination</h4>
        <div className="flex items-center justify-between">
          <div className="text-sm text-neutral-600">
            Showing <span className="font-medium">1-5</span> of{' '}
            <span className="font-medium">47</span> tickets
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled>
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <div className="flex gap-1">
              <Button variant="default" size="sm" className="w-8 h-8 p-0">
                1
              </Button>
              <Button variant="outline" size="sm" className="w-8 h-8 p-0">
                2
              </Button>
              <Button variant="outline" size="sm" className="w-8 h-8 p-0">
                3
              </Button>
              <Button variant="outline" size="sm" className="w-8 h-8 p-0">
                4
              </Button>
              <Button variant="outline" size="sm" className="w-8 h-8 p-0">
                5
              </Button>
            </div>
            <Button variant="outline" size="sm">
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Table Guidelines */}
      <div className="bg-neutral-50 p-6 rounded-lg">
        <h4 className="font-semibold text-neutral-900 mb-4">Table Design Guidelines</h4>
        <ul className="space-y-2 text-sm text-neutral-700">
          <li className="flex items-start gap-2">
            <span className="text-primary-500 mt-0.5">•</span>
            <span>Use alternating row hover states for better scannability</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-500 mt-0.5">•</span>
            <span>Include sorting controls in column headers for data tables</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-500 mt-0.5">•</span>
            <span>Use badges for status and priority indicators with semantic colors</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-500 mt-0.5">•</span>
            <span>Provide row-level actions via dropdown menus to save space</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-500 mt-0.5">•</span>
            <span>Include checkboxes for bulk selection operations</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-500 mt-0.5">•</span>
            <span>Always show pagination controls for large datasets</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
