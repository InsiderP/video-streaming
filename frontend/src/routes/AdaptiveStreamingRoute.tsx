import { Route, Routes } from 'react-router-dom';
import AdaptiveStreamingDemo from '../pages/AdaptiveStreamingDemo';

export const AdaptiveStreamingRoute = () => {
  return (
    <Routes>
      <Route path="/adaptive-streaming" element={<AdaptiveStreamingDemo />} />
    </Routes>
  );
};

export default AdaptiveStreamingRoute;
