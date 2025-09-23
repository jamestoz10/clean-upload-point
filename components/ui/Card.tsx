import Link from 'next/link';

interface CardProps {
  href: string;
  title: string;
  description: string;
  className?: string;
}

export default function Card({ 
  href, 
  title, 
  description, 
  className = '' 
}: CardProps) {
  return (
    <Link 
      href={href} 
      className={`group bg-blue-900 rounded-2xl shadow-lg p-8 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border border-blue-800 ${className}`}
    >
      <h2 className="text-2xl font-bold text-white mb-3">{title}</h2>
      <p className="text-blue-100 leading-relaxed">{description}</p>
    </Link>
  );
}
