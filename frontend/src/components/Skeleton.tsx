"use client";

export default function Skeleton({
  lines = 3,
}: {
  lines?: number;
}) {
  return (
    <div>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton-bar"
          style={{ width: `${100 - i * 20}%` }}
        />
      ))}
    </div>
  );
}
