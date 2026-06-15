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
          style={{
            height: 16,
            marginBottom: 8,
            background: "linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%)",
            backgroundSize: "200% 100%",
            borderRadius: 4,
            animation: "shimmer 1.5s infinite",
            width: `${100 - i * 20}%`,
          }}
        />
      ))}
    </div>
  );
}
