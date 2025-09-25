'use client';

import Link from 'next/link';

interface ContinueToMapProps {
  isVisible: boolean;
  uploadedCount: number;
  isVectorClean?: boolean | null;
}

export default function ContinueToMap({ isVisible, uploadedCount, isVectorClean }: ContinueToMapProps) {
  if (!isVisible) {
    return null;
  }

  return (
    <div className="mt-6 transition-all duration-300 ease-in-out flex justify-center">
      <Link 
        href="/map"
        className="group inline-block bg-gradient-to-br from-blue-800 to-blue-900 rounded-xl shadow-lg p-4 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 border border-blue-700 hover:from-blue-900 hover:to-blue-950 hover:border-blue-600"
      >
        <h2 className="text-lg font-bold text-white mb-1">Continue to Map</h2>
        <p className="text-blue-100 text-sm leading-relaxed">
          Draw your rooms against the uploaded file{uploadedCount > 1 ? 's' : ''}.
        </p>
      </Link>
    </div>
  );
}
