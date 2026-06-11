'use client'

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Switch } from '../ui/switch';
import { Progress } from '../ui/progress';
import { Separator } from '../ui/separator';
import { Textarea } from '../ui/textarea';
import { Search, AlertCircle, CheckCircle2, Info, Clock, TrendingUp } from 'lucide-react';

export function ButtonShowcase() {
  return (
    <div className="space-y-6">
      {/* Primary Buttons */}
      <div>
        <h4 className="font-semibold text-neutral-900 mb-4">Primary Buttons</h4>
        <div className="flex flex-wrap gap-4">
          <Button>Default</Button>
          <Button className="hover:opacity-90">Hover</Button>
          <Button className="active:scale-95">Pressed</Button>
          <Button disabled>Disabled</Button>
        </div>
      </div>

      {/* Secondary Buttons */}
      <div>
        <h4 className="font-semibold text-neutral-900 mb-4">Secondary Buttons</h4>
        <div className="flex flex-wrap gap-4">
          <Button variant="secondary">Default</Button>
          <Button variant="secondary" className="hover:opacity-90">Hover</Button>
          <Button variant="secondary" disabled>Disabled</Button>
        </div>
      </div>

      {/* Outline Buttons */}
      <div>
        <h4 className="font-semibold text-neutral-900 mb-4">Outline Buttons</h4>
        <div className="flex flex-wrap gap-4">
          <Button variant="outline">Default</Button>
          <Button variant="outline" className="hover:bg-neutral-100">Hover</Button>
          <Button variant="outline" disabled>Disabled</Button>
        </div>
      </div>

      {/* Ghost Buttons */}
      <div>
        <h4 className="font-semibold text-neutral-900 mb-4">Ghost Buttons</h4>
        <div className="flex flex-wrap gap-4">
          <Button variant="ghost">Default</Button>
          <Button variant="ghost" className="hover:bg-neutral-100">Hover</Button>
          <Button variant="ghost" disabled>Disabled</Button>
        </div>
      </div>

      {/* Destructive Buttons */}
      <div>
        <h4 className="font-semibold text-neutral-900 mb-4">Destructive Buttons</h4>
        <div className="flex flex-wrap gap-4">
          <Button variant="destructive">Default</Button>
          <Button variant="destructive" className="hover:opacity-90">Hover</Button>
          <Button variant="destructive" disabled>Disabled</Button>
        </div>
      </div>

      {/* Button Sizes */}
      <div>
        <h4 className="font-semibold text-neutral-900 mb-4">Button Sizes</h4>
        <div className="flex flex-wrap items-center gap-4">
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
          <Button size="icon">
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function InputShowcase() {
  return (
    <div className="space-y-6 max-w-md">
      {/* Text Input States */}
      <div className="space-y-2">
        <Label>Default Input</Label>
        <Input placeholder="Enter text..." />
      </div>

      <div className="space-y-2">
        <Label>Focused Input</Label>
        <Input placeholder="Click to focus..." className="ring-2 ring-primary-500" />
      </div>

      <div className="space-y-2">
        <Label>Disabled Input</Label>
        <Input placeholder="Disabled..." disabled />
      </div>

      <div className="space-y-2">
        <Label>Error Input</Label>
        <Input placeholder="Error state..." className="border-error-500 ring-error-500" />
        <p className="text-sm text-error-600">This field is required</p>
      </div>

      {/* Search Input */}
      <div className="space-y-2">
        <Label>Search Input</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <Input placeholder="Search..." className="pl-10" />
        </div>
      </div>

      {/* Textarea */}
      <div className="space-y-2">
        <Label>Textarea</Label>
        <Textarea placeholder="Enter description..." rows={4} />
      </div>

      {/* Select */}
      <div className="space-y-2">
        <Label>Select Dropdown</Label>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
            <SelectItem value="option2">Option 2</SelectItem>
            <SelectItem value="option3">Option 3</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Checkbox */}
      <div className="flex items-center space-x-2">
        <Checkbox id="terms" />
        <Label htmlFor="terms" className="text-sm font-normal">
          Accept terms and conditions
        </Label>
      </div>

      {/* Switch */}
      <div className="flex items-center justify-between">
        <Label htmlFor="notifications">Enable notifications</Label>
        <Switch id="notifications" />
      </div>
    </div>
  );
}

export function BadgeShowcase() {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="font-semibold text-neutral-900 mb-4">Badge Variants</h4>
        <div className="flex flex-wrap gap-3">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
        </div>
      </div>

      <div>
        <h4 className="font-semibold text-neutral-900 mb-4">Status Badges</h4>
        <div className="flex flex-wrap gap-3">
          <Badge className="bg-success-500 hover:bg-success-600">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Resolved
          </Badge>
          <Badge className="bg-warning-500 hover:bg-warning-600">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
          <Badge className="bg-error-500 hover:bg-error-600">
            <AlertCircle className="w-3 h-3 mr-1" />
            Critical
          </Badge>
          <Badge className="bg-info-500 hover:bg-info-600">
            <Info className="w-3 h-3 mr-1" />
            Info
          </Badge>
        </div>
      </div>
    </div>
  );
}

export function AlertShowcase() {
  return (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Information</AlertTitle>
        <AlertDescription>
          This is an informational alert message for general updates.
        </AlertDescription>
      </Alert>

      <Alert className="border-success-500 bg-success-50 text-success-900">
        <CheckCircle2 className="h-4 w-4 text-success-600" />
        <AlertTitle>Success</AlertTitle>
        <AlertDescription>
          Your changes have been saved successfully.
        </AlertDescription>
      </Alert>

      <Alert className="border-warning-500 bg-warning-50 text-warning-900">
        <AlertCircle className="h-4 w-4 text-warning-600" />
        <AlertTitle>Warning</AlertTitle>
        <AlertDescription>
          Please review your data before submitting.
        </AlertDescription>
      </Alert>

      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          An error occurred while processing your request.
        </AlertDescription>
      </Alert>
    </div>
  );
}

export function CardShowcase() {
  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Standard Card */}
      <Card>
        <CardHeader>
          <CardTitle>Standard Card</CardTitle>
          <CardDescription>A basic card component for content</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-600">
            Cards are surfaces that display content and actions on a single topic.
          </p>
        </CardContent>
      </Card>

      {/* KPI Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Total Tickets</CardDescription>
          <CardTitle className="text-3xl">1,284</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center text-sm text-success-600">
            <TrendingUp className="w-4 h-4 mr-1" />
            +12.5% from last month
          </div>
        </CardContent>
      </Card>

      {/* Statistic Card */}
      <Card className="bg-primary-500 text-white border-0">
        <CardHeader className="pb-2">
          <CardDescription className="text-primary-100">Resolved Today</CardDescription>
          <CardTitle className="text-3xl">247</CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={75} className="bg-primary-400" />
          <p className="text-sm text-primary-100 mt-2">75% of daily goal</p>
        </CardContent>
      </Card>
    </div>
  );
}

export function ProgressShowcase() {
  return (
    <div className="space-y-6 max-w-md">
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-neutral-600">Progress 25%</span>
          <span className="text-neutral-900 font-medium">25%</span>
        </div>
        <Progress value={25} />
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-neutral-600">Progress 50%</span>
          <span className="text-neutral-900 font-medium">50%</span>
        </div>
        <Progress value={50} />
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-neutral-600">Progress 75%</span>
          <span className="text-neutral-900 font-medium">75%</span>
        </div>
        <Progress value={75} />
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-neutral-600">Progress 100%</span>
          <span className="text-neutral-900 font-medium">100%</span>
        </div>
        <Progress value={100} />
      </div>
    </div>
  );
}
