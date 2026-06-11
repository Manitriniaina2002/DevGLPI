'use client'

interface ElevationCardProps {
  level: string;
  description: string;
  shadowClass: string;
}

function ElevationCard({ level, description, shadowClass }: ElevationCardProps) {
  return (
    <div className="text-center">
      <div className={`h-32 bg-white rounded-lg flex items-center justify-center ${shadowClass}`}>
        <div className="text-neutral-600 font-mono text-sm">{level}</div>
      </div>
      <div className="mt-4">
        <div className="font-semibold text-neutral-900">{level}</div>
        <div className="text-sm text-neutral-500 mt-1">{description}</div>
      </div>
    </div>
  );
}

export function ElevationShowcase() {
  const elevations = [
    {
      level: 'Level 1',
      description: 'Subtle elevation for cards',
      shadowClass: 'shadow-sm',
    },
    {
      level: 'Level 2',
      description: 'Dropdowns, popovers',
      shadowClass: 'shadow-md',
    },
    {
      level: 'Level 3',
      description: 'Modals, dialogs',
      shadowClass: 'shadow-lg',
    },
    {
      level: 'Level 4',
      description: 'Overlays, drawers',
      shadowClass: 'shadow-xl',
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-8 p-8 bg-neutral-50 rounded-lg">
      {elevations.map((elevation) => (
        <ElevationCard key={elevation.level} {...elevation} />
      ))}
    </div>
  );
}
