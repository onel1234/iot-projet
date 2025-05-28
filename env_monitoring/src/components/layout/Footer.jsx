
import React from 'react';
import { Settings, Info, BarChart2 } from 'lucide-react';

const Footer = () => {

  return (

    <footer className="bg-white border-t border-gray-200 py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
        <div className="text-sm text-gray-500">
          Smart Living Condition Monitoring System
        </div>
        <div className="flex space-x-4">
          <button className="text-gray-500 hover:text-gray-700">
            <Settings className="h-5 w-5" />
          </button>
          <button className="text-gray-500 hover:text-gray-700">
            <Info className="h-5 w-5" />
          </button>
          <button className="text-gray-500 hover:text-gray-700">
            <BarChart2 className="h-5 w-5" />
          </button>
        </div>
      </div>
    </footer>

  );
  
};

export default Footer;