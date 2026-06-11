'use client'

interface SpacingItemProps {
  name: string;
  value: string;
  pixels: string;
}

function SpacingItem({ name, value, pixels }: SpacingItemProps) {
  return (
    <div className="flex items-center gap-6 py-4 border-b border-neutral-200">
      <div className="w-32">
        <div className="text-sm font-semibold text-neutral-900">{name}</div>
        <div className="text-xs text-neutral-500">{pixels}</div>
      </div>
      <div className="flex-1">
        <div className="h-12 bg-primary-500 rounded" style={{ width: value }}></div>
      </div>
      <div className="w-24 text-right text-sm font-mono text-neutral-600">{value}</div>
    </div>
  );
}

export function SpacingShowcase() {
  const spacings = [
    { name: 'spacing-1', value: '4px', pixels: '4px' },
    { name: 'spacing-2', value: '8px', pixels: '8px' },
    { name: 'spacing-3', value: '12px', pixels: '12px' },
    { name: 'spacing-4', value: '16px', pixels: '16px' },
    { name: 'spacing-5', value: '20px', pixels: '20px' },
    { name: 'spacing-6', value: '24px', pixels: '24px' },
    { name: 'spacing-8', value: '32px', pixels: '32px' },
    { name: 'spacing-10', value: '40px', pixels: '40px' },
    { name: 'spacing-12', value: '48px', pixels: '48px' },
    { name: 'spacing-16', value: '64px', pixels: '64px' },
  ];

  return (
    <div className="space-y-0">
      {spacings.map((spacing) => (
        <SpacingItem key={spacing.name} {...spacing} />
      ))}
    </div>
  );
}
