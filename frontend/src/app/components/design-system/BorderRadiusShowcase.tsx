'use client'

interface RadiusItemProps {
  name: string;
  value: string;
  className: string;
}

function RadiusItem({ name, value, className }: RadiusItemProps) {
  return (
    <div className="text-center">
      <div className={`h-24 bg-primary-500 ${className}`}></div>
      <div className="mt-4">
        <div className="font-semibold text-neutral-900">{name}</div>
        <div className="text-sm text-neutral-500">{value}</div>
      </div>
    </div>
  );
}

export function BorderRadiusShowcase() {
  const radiuses = [
    { name: 'Small', value: '4px', className: 'rounded' },
    { name: 'Medium', value: '8px', className: 'rounded-lg' },
    { name: 'Large', value: '12px', className: 'rounded-xl' },
    { name: 'Extra Large', value: '16px', className: 'rounded-2xl' },
  ];

  return (
    <div className="grid grid-cols-4 gap-8">
      {radiuses.map((radius) => (
        <RadiusItem key={radius.name} {...radius} />
      ))}
    </div>
  );
}
