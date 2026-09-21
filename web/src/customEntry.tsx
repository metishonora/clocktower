import React from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { CustomGrimoireApplication } from './grimoire-custom/CustomGrimoireApplication';
import './features/script-selection/scriptLanding.css';

registerSW({immediate: true});
createRoot(document.getElementById('root')!).render(
  <React.StrictMode><CustomGrimoireApplication onExit={() => window.location.assign('/clocktower/')}/></React.StrictMode>,
);
