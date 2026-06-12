type LogoProps = {
  size?: number;
  className?: string;
};

export default function Logo({ size = 32, className = "" }: LogoProps) {
  return (
    <img
      src="/logo.png"
      alt="PulsePass"
      width={size}
      height={size}
      className={`rounded-lg object-contain ${className}`}
      style={{ imageRendering: "crisp-edges" }}
    />
  );
}
