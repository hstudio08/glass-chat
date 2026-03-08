import React from 'react';
import { AppProvider } from './contexts/AppContext';
import AppLayout from './layouts/AppLayout';

function App() {
  return (
    <AppProvider>
      <AppLayout />
    </AppProvider>
  );
}

export default App;