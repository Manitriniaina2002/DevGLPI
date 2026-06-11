'use client'

interface TypographyItemProps {
  label: string;
  size: string;
  weight: string;
  lineHeight: string;
  example: string;
  className?: string;
}

export function TypographyItem({ label, size, weight, lineHeight, example, className = "" }: TypographyItemProps) {
  return (
    <div className="border-b border-neutral-200 pb-6">
      <div className="grid grid-cols-12 gap-6 items-center">
        <div className="col-span-2">
          <div className="text-sm font-semibold text-neutral-900">{label}</div>
          <div className="text-xs text-neutral-500 mt-1">
            {size} / {weight}
          </div>
          <div className="text-xs text-neutral-400">{lineHeight}</div>
        </div>
        <div className={`col-span-10 ${className}`}>{example}</div>
      </div>
    </div>
  );
}

export function TypographyShowcase() {
  return (
    <div className="space-y-6">
      <TypographyItem
        label="Display Large"
        size="60px"
        weight="600"
        lineHeight="1.25"
        example="The quick brown fox jumps over the lazy dog"
        className="text-[60px] font-semibold leading-tight"
      />
      <TypographyItem
        label="Display Medium"
        size="48px"
        weight="600"
        lineHeight="1.25"
        example="The quick brown fox jumps over the lazy dog"
        className="text-[48px] font-semibold leading-tight"
      />
      <TypographyItem
        label="Heading 1"
        size="40px"
        weight="600"
        lineHeight="1.25"
        example="The quick brown fox jumps over the lazy dog"
        className="text-[40px] font-semibold leading-tight"
      />
      <TypographyItem
        label="Heading 2"
        size="32px"
        weight="600"
        lineHeight="1.25"
        example="The quick brown fox jumps over the lazy dog"
        className="text-[32px] font-semibold leading-tight"
      />
      <TypographyItem
        label="Heading 3"
        size="24px"
        weight="600"
        lineHeight="1.5"
        example="The quick brown fox jumps over the lazy dog"
        className="text-2xl font-semibold"
      />
      <TypographyItem
        label="Heading 4"
        size="20px"
        weight="500"
        lineHeight="1.5"
        example="The quick brown fox jumps over the lazy dog"
        className="text-xl font-medium"
      />
      <TypographyItem
        label="Heading 5"
        size="18px"
        weight="500"
        lineHeight="1.5"
        example="The quick brown fox jumps over the lazy dog"
        className="text-lg font-medium"
      />
      <TypographyItem
        label="Heading 6"
        size="16px"
        weight="500"
        lineHeight="1.5"
        example="The quick brown fox jumps over the lazy dog"
        className="text-base font-medium"
      />
      <TypographyItem
        label="Body Large"
        size="18px"
        weight="400"
        lineHeight="1.75"
        example="The quick brown fox jumps over the lazy dog. Lorem ipsum dolor sit amet, consectetur adipiscing elit."
        className="text-lg leading-relaxed"
      />
      <TypographyItem
        label="Body Medium"
        size="16px"
        weight="400"
        lineHeight="1.5"
        example="The quick brown fox jumps over the lazy dog. Lorem ipsum dolor sit amet, consectetur adipiscing elit."
        className="text-base"
      />
      <TypographyItem
        label="Body Small"
        size="14px"
        weight="400"
        lineHeight="1.5"
        example="The quick brown fox jumps over the lazy dog. Lorem ipsum dolor sit amet, consectetur adipiscing elit."
        className="text-sm"
      />
      <TypographyItem
        label="Caption"
        size="12px"
        weight="400"
        lineHeight="1.5"
        example="The quick brown fox jumps over the lazy dog. Lorem ipsum dolor sit amet."
        className="text-xs"
      />
      <TypographyItem
        label="Label"
        size="14px"
        weight="500"
        lineHeight="1.5"
        example="Form Label / Button Text"
        className="text-sm font-medium"
      />
    </div>
  );
}
