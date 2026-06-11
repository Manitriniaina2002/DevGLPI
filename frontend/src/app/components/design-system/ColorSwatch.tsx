'use client'

interface ColorSwatchProps {
  name: string;
  value: string;
  textColor?: string;
}

export function ColorSwatch({ name, value, textColor = "#111827" }: ColorSwatchProps) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className="h-20 rounded-lg shadow-sm border border-neutral-200 flex items-center justify-center"
        style={{ backgroundColor: value }}
      >
        <span className="font-mono text-xs font-medium" style={{ color: textColor }}>
          {value}
        </span>
      </div>
      <div className="text-sm font-medium text-neutral-900">{name}</div>
    </div>
  );
}

interface ColorScaleProps {
  title: string;
  colors: { name: string; value: string }[];
}

export function ColorScale({ title, colors }: ColorScaleProps) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-neutral-900">{title}</h3>
      <div className="grid grid-cols-5 gap-4">
        {colors.map((color) => {
          const shade = parseInt(color.name.split('-').pop() || '500');
          const textColor = shade >= 500 ? '#ffffff' : '#111827';
          return (
            <ColorSwatch
              key={color.name}
              name={color.name}
              value={color.value}
              textColor={textColor}
            />
          );
        })}
      </div>
    </div>
  );
}
