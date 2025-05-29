
import React from 'react';
import { Home, Clock } from 'lucide-react';

const Header = () => {

  return (

    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
        <div className="flex items-center">
          <Home className="h-6 w-6 text-blue-500" />
          <h1 className="ml-2 text-xl font-bold text-gray-800">Smart Living Condition Monitor</h1>
        </div>
        <div className="flex items-center text-sm text-gray-500">
          <Clock className="h-4 w-4 mr-1" />
          <span>{new Date().toLocaleString()}</span>
        </div>
      </div>
    </header>

  );
  
};

export default Header;