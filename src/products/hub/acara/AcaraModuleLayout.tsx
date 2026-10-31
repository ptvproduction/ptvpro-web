import React from 'react';
import { Outlet } from 'react-router-dom';
import { AcaraProvider } from './context/AcaraContext';
import '@/styles/acara.css';

export const AcaraModuleLayout: React.FC = () => {
  return (
    <AcaraProvider>
      <div className="r03-acara">
        <Outlet />
      </div>
    </AcaraProvider>
  );
};
