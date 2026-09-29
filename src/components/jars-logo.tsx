import Image from "next/image";

// The round JARS mark (public/jars-logo.png). The source art is a dark square
// with the white circle inscribed, so it's clipped round — that way it sits
// cleanly on both the black header bars and white pages.
export default function JarsLogo({
  size = 40,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/jars-logo.png"
      alt="JARS"
      width={size}
      height={size}
      priority
      className={`shrink-0 rounded-full ${className}`}
    />
  );
}
