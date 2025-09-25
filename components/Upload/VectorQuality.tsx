'use client';

interface VectorQualityProps {
  isVectorClean: boolean | null;
  onVectorCleanChange: (isClean: boolean) => void;
}

export default function VectorQuality({ isVectorClean, onVectorCleanChange }: VectorQualityProps) {
  return (
    <div className={`bg-white rounded-lg shadow-md p-6 border transition-all duration-200 ${
      isVectorClean !== null 
        ? 'border-green-300 bg-green-50' 
        : 'border-gray-200'
    }`}>
      <h3 className="text-lg font-semibold text-gray-800 mb-3">
        Vector File Quality
        {isVectorClean !== null && (
          <span className="ml-2 text-sm font-normal text-green-600">
            ✓ Selected
          </span>
        )}
      </h3>
      <div className="space-y-3">
        <div className="flex items-center space-x-6">
          <label className="flex items-center space-x-2 cursor-pointer group">
            <input
              type="radio"
              name="vectorClean"
              value="true"
              checked={isVectorClean === true}
              onChange={() => onVectorCleanChange(true)}
              className="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-500"
            />
            <span className={`font-medium transition-colors ${
              isVectorClean === true 
                ? 'text-green-700' 
                : 'text-gray-700 group-hover:text-green-600'
            }`}>
              Yes
            </span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer group">
            <input
              type="radio"
              name="vectorClean"
              value="false"
              checked={isVectorClean === false}
              onChange={() => onVectorCleanChange(false)}
              className="w-4 h-4 text-orange-600 border-gray-300 focus:ring-orange-500"
            />
            <span className={`font-medium transition-colors ${
              isVectorClean === false 
                ? 'text-orange-700' 
                : 'text-gray-700 group-hover:text-orange-600'
            }`}>
              No
            </span>
          </label>
        </div>
        <p className="text-sm text-gray-600 italic">
          Does your vector file contain only closed room areas?
        </p>
        {isVectorClean === true && (
          <p className="text-sm text-green-600 font-medium">
            ✓ Your vector file is clean and ready for mapping
          </p>
        )}
        {isVectorClean === false && (
          <p className="text-sm text-orange-600 font-medium">
            ⚠ Your vector file may need cleaning on the map
          </p>
        )}
      </div>
    </div>
  );
}
