import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { createGatewayClient } from './api/gateway';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App client={createGatewayClient(import.meta.env)} />
  </React.StrictMode>,
);
