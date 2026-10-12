import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { purgarVencidos } from './ui/borradores';
import { ServiciosProvider } from './ui/servicios';
import './App.css';

purgarVencidos();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ServiciosProvider>
      <App />
    </ServiciosProvider>
  </React.StrictMode>,
);