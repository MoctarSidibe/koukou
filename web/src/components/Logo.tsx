export function Logo({ className = 'h-9 w-auto' }: { className?: string }) {
  return <img src="/logo.jpg" alt="KouKou" className={className} />;
}