
import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { LogoutIcon, UserIcon } from './icons';

export const HomePage: React.FC = () => {
  const { currentUser, logout, isLoading } = useAuth();

  return (
    <div className="w-full max-w-2xl text-center">
      <div className="bg-white dark:bg-slate-800 shadow-2xl rounded-xl p-8 md:p-12">
        <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-indigo-100 dark:bg-indigo-900/50 mb-6">
          <UserIcon className="h-12 w-12 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white">
          Welcome, <span className="text-indigo-600 dark:text-indigo-400">{currentUser?.username}</span>!
        </h1>
        <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
          You have successfully logged in. Your session is now active on this device.
        </p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          If you sign in from another browser or device, this session will be terminated.
        </p>
        <div className="mt-8">
          <button
            onClick={logout}
            disabled={isLoading}
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 dark:ring-offset-slate-800 transition-all duration-200 transform hover:scale-105"
          >
            {isLoading ? (
                 <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            ) : (
                <>
                    <LogoutIcon className="w-5 h-5 mr-2" />
                    Sign Out
                </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
